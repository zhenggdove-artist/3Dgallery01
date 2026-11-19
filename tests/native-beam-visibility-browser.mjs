// Isolated GPU pixel-level diagnostic: no mocked VFX or assumed geometry visibility.
// Runs in Chrome/SwiftShader against the exact production imported vendor modules.
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
await mkdir('output/beam-visibility',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}});
 const errors=[];
 page.on('pageerror',error=>errors.push('PAGE: '+error.message));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.type()+': '+m.text().slice(0,1000));});
 await page.goto('http://127.0.0.1:8000',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.classList.contains('ready'),null,{timeout:80000});
 const diagnostic=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {NumberedWeaponEffects}=await import('/src/numbered-weapon-effects.js');
  const renderer=templeTest.renderer;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#000000');
  const camera=new THREE.PerspectiveCamera(46,1,.1,200);
  camera.position.set(0,2.7,10);camera.lookAt(0,2,-10);camera.updateWorldMatrix(true);
  const target=new THREE.WebGLRenderTarget(512,512,{depthBuffer:true});
  const previous=renderer.getRenderTarget();
  const pixels=new Uint8Array(512*512*4);
  const check=()=>{
   renderer.setRenderTarget(target);
   renderer.render(scene,camera);
   renderer.readRenderTargetPixels(target,0,0,512,512,pixels);
   let bright=0,light=0,max=0,total=0;
   for(let k=0;k<pixels.length;k+=4){
    const v=Math.max(pixels[k],pixels[k+1],pixels[k+2]);
    if(v>15)bright++;if(v>80)light++;max=Math.max(max,v);total+=v;
   }
   renderer.setRenderTarget(previous);
   return {bright,light,max,avg:total/(512*512)};
  };
  const idle=check();
  const numbered=new NumberedWeaponEffects(scene,(r,i,fallback)=>fallback);
  const cases=[];
  for(const item of [{id:'storm-3',family:'lightning'},{id:'prism-3',family:'beam'}]){
   const event={channel:true,ultimate:true,origin:[0,2,-1],
    direction:[0,0,-1],range:20,qualityTier:3,qualityScale:1,flightMs:250};
   try{
    const spawned=numbered.play(event,item,null);
    const entry=numbered.active.at(-1);
    const atStart=entry?{visible:entry.fx.group.visible,phase:entry.fx.phase,
     scale:entry.fx.group.scale.toArray(),position:entry.fx.group.position.toArray(),spec:entry.spec.asset}:null;
    const gpuAtStart=check();
    if(entry?.fx.phase!=='active'||gpuAtStart.light<30)
     throw Error(item.id+' native beam is not VISIBLE on its first authenticated channel frame: '+JSON.stringify({phase:entry?.fx.phase,gpuAtStart}));
    for(let i=0;i<126;i++)numbered.update(1/60);
    const after=entry?{visible:entry.fx.group.visible,phase:entry.fx.phase,
     scale:entry.fx.group.scale.toArray(),position:entry.fx.group.position.toArray(),rotation:entry.fx.group.quaternion.toArray(),
     children:entry.fx.group.children.map(c=>({name:c.name,type:c.type,visible:c.visible,drawRange:c.geometry?.drawRange,frustumCulled:c.frustumCulled})).slice(0,22)}:null;
    const gpu=check();
    cases.push({id:item.id,spawned,atStart,gpuAtStart,after,gpu});
    numbered.remove(entry);
   }catch(error){cases.push({id:item.id,error:String(error),stack:error.stack?.slice(0,2000)});}
  }
  numbered.dispose();target.dispose();
  return {idle,cases,gl:renderer.getContext().getError()};
 });
 console.log('BEAM_RENDER_DIAGNOSTIC='+JSON.stringify({diagnostic,errors}));
 if(diagnostic.cases.some(x=>x.gpu?.light>100))console.log('Some native beam renders measurable pixels');
 else console.log('NATIVE_BEAMS_INVISIBLE: no light pixels produced');

 // End-to-end client smoke: enter the actual game, equip both weapons locally,
 // hold A through charge and fire by server-shaped channel responses.
 await page.evaluate(()=>templeTest.ui.emit('join',{name:'BeamDebug',color:'#ffaabb',backendUrl:window.TEMPLE_CONFIG.backendUrl}));
 await page.waitForFunction(()=>!document.querySelector('#hud')?.hidden&&templeTest.controller()?.enabled,null,{timeout:22000});
 const reticleOffset=await page.evaluate(()=>{
  const r=document.getElementById('crosshair').getBoundingClientRect();
  return innerHeight/2-(r.top+r.height/2);
 });
 if(Math.abs(reticleOffset-30)>1)throw Error('Visible CSS reticle not raised by 30px: '+reticleOffset);
 await page.evaluate(()=>{
  const t=templeTest;
  t.network.close(); // prevent remote world updates from overwriting test equipment
  window.beamActions=[];window.beamChannelEvents=[];window.nativeChannelRemovals=[];
  const native=t.arena.presentation.vfx.numberedEffects;
  const actualRemove=native.remove.bind(native);
  native.remove=function(entry){
   window.nativeChannelRemovals.push({weapon:entry?.item?.id,channel:entry?.channel,
    liveKey:entry?.key,age:entry?.age,time:performance.now(),
    stack:new Error('Native channel removed').stack?.slice(0,1100)});
   if(window.nativeChannelRemovals.length>12)window.nativeChannelRemovals.shift();
   return actualRemove(entry);
  };
  t.network.action=async(action,data)=>{
   window.beamActions.push({action,phase:data?.phase||'',direction:data?.direction});
   if(action==='attack'&&data?.phase==='charge')return {charging:true};
   if(action==='attack'&&data?.phase==='channel-start')return {channeling:true};
   if(action==='attack'&&data?.phase==='channel'){
    const item=t.items.find(x=>x.id===t.ui.world.profile.equipment.weapon);
    const ev={id:crypto.randomUUID(),owner:t.ui.self.key,weapon:item.id,family:item.family,
     origin:data.origin||t.controller().root.position.clone().add(new (t.camera.position.constructor)(0,1,0)).toArray(),
     direction:data.direction||[0,0,-1],range:20,channel:true,ultimate:true,charge:1,qualityTier:3,qualityScale:1,time:Date.now()};
    window.beamChannelEvents.push(ev);
    return {attackEvent:ev};
   }
   return {};
  };
 });
 const integrated=[];
 for(const name of ['storm-3','prism-3']){
  const setup=await page.evaluate(id=>{
   const t=templeTest;
   const world={...t.ui.world,revision:(Number(t.ui.world.revision)||0)+1000,profile:{...t.ui.world.profile,equipment:{...t.ui.world.profile.equipment,weapon:id}}};
   t.network.dispatchEvent(new CustomEvent('world',{detail:world}));
   const item=t.items.find(x=>x.id===id);
   t.arena.setPlayerEquipment(t.controller().root,{weapon:id});
   t.controller().pitch=-.35;
   return {item:item?.id,chargeMs:item?.chargeMs,channelItem:item?.family};
  },name);
  // The real socket's pending initial snapshot can otherwise overwrite the
  // fixture before the next animation frame, reverting to white-cat.
  await page.waitForFunction(id=>templeTest.ui.world?.profile?.equipment?.weapon===id,name,{timeout:12000});
  await page.evaluate(()=>templeTest.ui.emit('attack-start'));
  await page.waitForTimeout(Math.max(5300,(setup.chargeMs||1500)+2900));
  const snapshot=await page.evaluate(()=>{
   const t=templeTest,n=t.arena.presentation.vfx.numberedEffects,camera=t.camera;
   return {name:t.ui.world.profile.equipment.weapon,channelState:t.channelDebug(),actions:window.beamActions.slice(-24),
    nEvents:window.beamChannelEvents.length,
    active:n.active.map(e=>({weapon:e.item?.id,kind:e.spec.asset,channel:e.channel,
     phase:e.fx.phase,visible:e.fx.group.visible,origin:e.origin.toArray(),
     muzzle:n.muzzleAt(e).toArray(),direction:e.visualDirection.toArray(),
     projected:e.fx.group.position.clone().project(camera).toArray(),
     fxPosition:e.fx.group.position.toArray(),
     fxScale:e.fx.group.scale.toArray()})),
    camera:camera.position.toArray(),camDirection:camera.getWorldDirection(camera.position.clone()).toArray(),
    hudVisible:!t.ui.hud.hidden,root:t.controller().root.position.toArray()};
  });
  // Verify REAL GAME SCENE pixels from the live camera, not merely the
  // vendor's isolated module. Detect occlusion/clipping with full environment.
  const gamePixels=await page.evaluate(async id=>{
   const THREE=await import('three');
   const t=templeTest,renderer=t.renderer,scene=t.arena.scene,camera=t.camera;
   const fx=t.arena.presentation.vfx.numberedEffects.active.find(e=>e.item?.id===id&&e.channel);
   if(!fx)return {error:'No active channel VFX'};
   const previous=renderer.getRenderTarget(),previousVisible=fx.fx.group.visible;
   const rt=new THREE.WebGLRenderTarget(440,300,{depthBuffer:true});
   const baseline=new Uint8Array(440*300*4),rendered=new Uint8Array(440*300*4);
   const read=(arr,visible)=>{
    fx.fx.group.visible=visible;
    renderer.setRenderTarget(rt);renderer.render(scene,camera);
    renderer.readRenderTargetPixels(rt,0,0,440,300,arr);
   };
   try{
    read(baseline,false);read(rendered,true);
    let delta=0,bright=0,total=0;
    for(let i=0;i<baseline.length;i+=4){
     const diff=Math.max(Math.abs(baseline[i]-rendered[i]),Math.abs(baseline[i+1]-rendered[i+1]),Math.abs(baseline[i+2]-rendered[i+2]));
     if(diff>20)delta++;
     if(diff>70)bright++;
     total+=diff;
    }
    return {delta,bright,avg:total/(440*300),glError:renderer.getContext().getError(),
     cameraDistance:camera.position.distanceTo(t.controller().root.position)};
   }finally{fx.fx.group.visible=previousVisible;renderer.setRenderTarget(previous);rt.dispose();}
  },name);
  // Also tilt the actual game camera sharply upward (about 49 degrees),
  // without relying on a unit vector assertion or an isolated black scene.
  const steepPixels=await page.evaluate(async id=>{
   const THREE=await import('three');
   const {raisedBeamDirection}=await import('/src/aiming.js');
   const t=templeTest,scene=t.arena.scene,renderer=t.renderer,camera=t.camera;
   const controller=t.controller(),native=t.arena.presentation.vfx.numberedEffects;
   const entry=native.active.find(e=>e.item?.id===id&&e.channel);
   if(!entry)return {
    error:'Previously confirmed native channel is no longer active',
    weapon:id,channel:t.channelDebug(),equipment:controller.root.userData.equipment,
    staffCasting:controller.root.userData.staffCasting,
    staffCastingUntil:controller.root.userData.staffCastingUntil,
    failedEffects:[...(native.failedEffects||[])],
    channelRemovals:window.nativeChannelRemovals,
    active:native.active.map(e=>({weapon:e.item?.id,channel:e.channel,
     key:e.key,age:e.age,elapsed:performance.now()-e.lastPulse,
     rootSame:e.root===controller.root}))
   };
   const oldPitch=controller.pitch,oldDirection=entry.visualDirection.clone();
   const originalTarget=renderer.getRenderTarget(),rt=new THREE.WebGLRenderTarget(440,300);
   const absent=new Uint8Array(440*300*4),present=new Uint8Array(440*300*4);
   try{
    controller.pitch=-.85;controller.updateCamera(1);
    const origin=native.muzzleAt(entry);
    entry.visualDirection.copy(raisedBeamDirection(camera,origin));
    native.align(entry);
    const render=(array,visible)=>{
     entry.fx.group.visible=visible;renderer.setRenderTarget(rt);
     renderer.render(scene,camera);renderer.readRenderTargetPixels(rt,0,0,440,300,array);
    };
    render(absent,false);render(present,true);
    let bright=0;
    for(let i=0;i<absent.length;i+=4)
     if(Math.max(Math.abs(present[i]-absent[i]),Math.abs(present[i+1]-absent[i+1]),Math.abs(present[i+2]-absent[i+2]))>70)bright++;
    return {bright,elevation:entry.visualDirection.y,cameraPitch:controller.pitch};
   }finally{
    if(entry){entry.fx.group.visible=true;entry.visualDirection.copy(oldDirection);native.align(entry);}
    controller.pitch=oldPitch;controller.updateCamera(1);renderer.setRenderTarget(originalTarget);rt.dispose();
   }
  },name);
  // REAL GPU test: this must be the original #08/#29 mesh, not an overlay.
  // Render its lateral movement bends in the actual world, and require
  // distinct left/right arc positions while both keep the target endpoint.
  const curvedPixels=await page.evaluate(async id=>{
   const THREE=await import('three');
   const t=templeTest,renderer=t.renderer,scene=t.arena.scene,camera=t.camera;
   const native=t.arena.presentation.vfx.numberedEffects;
   const entry=native.active.find(e=>e.item?.id===id&&e.channel);
   if(!entry)return {error:'No active original beam'};
   const prior=renderer.getRenderTarget(),rt=new THREE.WebGLRenderTarget(440,300);
   const oldBend=entry.curveBend,target=entry.root?.userData.staffTargetPoint;
   const n=440*300,buffer=new Uint8Array(n*4),ref=new Uint8Array(n*4);
   const capture=(bend,visible)=>{
    entry.curveBend=bend;
    native.align(entry);
    entry.fx.group.visible=visible;
    renderer.setRenderTarget(rt);renderer.render(scene,camera);
    renderer.readRenderTargetPixels(rt,0,0,440,300,buffer);
    return new Uint8Array(buffer);
   };
   try{
    const start=native.muzzleAt(entry),dir=entry.visualDirection.clone();
    const enemy=start.clone().addScaledVector(dir,Math.min(11,entry.range*.7));
    entry.root.userData.staffTargetPoint=enemy.toArray();
    const background=capture(0,false);
    const reads=[];
    for(const bend of [-1,1]){
     const pixels=capture(bend,true),uniform=entry.fx.group.userData.templeCurve;
     let count=0,weightedX=0;
     for(let i=0;i<n;i++){
      const offset=i*4,delta=Math.max(Math.abs(pixels[offset]-background[offset]),
       Math.abs(pixels[offset+1]-background[offset+1]),
       Math.abs(pixels[offset+2]-background[offset+2]));
      if(delta>60){count++;weightedX+=(i%440);}
     }
     reads.push({bend,count,meanX:count?weightedX/count:null,
      amplitude:uniform?.bend.value,endpoint:entry.visualEnd?.toArray(),
      shaderCount:entry.fx.group.userData.templeCurveShaderCount});
    }
    return {reads,enemy:enemy.toArray(),glError:renderer.getContext().getError()};
   }finally{
    entry.curveBend=oldBend;
    if(entry.root)entry.root.userData.staffTargetPoint=target;
    entry.fx.group.visible=true;native.align(entry);
    renderer.setRenderTarget(prior);rt.dispose();
   }
  },name);
  integrated.push({setup,snapshot,gamePixels,steepPixels,curvedPixels});
  await page.screenshot({path:'output/beam-visibility/'+name+'-held.png'});
  await page.evaluate(()=>{templeTest.ui.emit('attack-release');window.beamActions=[];window.beamChannelEvents=[];});
  await page.waitForTimeout(300);
 }
 console.log('INTEGRATED_BEAM_DIAGNOSTIC='+JSON.stringify(integrated));
 for(const {setup,snapshot} of integrated){
  if(snapshot.nEvents<1)throw Error(setup.item+' has no actual channel spell pulses: '+JSON.stringify(snapshot.channelState));
  const native=snapshot.active.find(e=>e.weapon===setup.item);
  if(native?.phase!=='active'||!native.visible)
   throw Error(setup.item+' native channel does not appear when held: '+JSON.stringify(snapshot));
  const pixels=integrated.find(x=>x.setup.item===setup.item)?.gamePixels;
  if(!pixels||pixels.bright<50)
   throw Error(setup.item+' native effect is hidden by world scene/camera: '+JSON.stringify(pixels));
  if(pixels.cameraDistance<8)
   throw Error(setup.item+' camera not pulled sufficiently away from the avatar: '+JSON.stringify(pixels));
  const steep=integrated.find(x=>x.setup.item===setup.item)?.steepPixels;
  if(!steep||steep.bright<50||steep.elevation<.6)
   throw Error(setup.item+' disappears or points down on steep upward camera angle: '+JSON.stringify(steep));
  const curve=integrated.find(x=>x.setup.item===setup.item)?.curvedPixels;
  const [left,right]=curve?.reads||[];
  if(!left||!right||left.shaderCount<1||left.count<50||right.count<50||
      !(left.amplitude<0&&right.amplitude>0)||
      !(left.meanX<right.meanX-2)||curve.glError!==0)
   throw Error(setup.item+' ORIGINAL #08/#29 vertex shader must visibly curve left/right toward target: '+JSON.stringify(curve));
  if(left.endpoint.some((v,i)=>Math.abs(v-curve.enemy[i])>.01)||
      right.endpoint.some((v,i)=>Math.abs(v-curve.enemy[i])>.01))
   throw Error(setup.item+' curved ray failed to land on intended enemy: '+JSON.stringify(curve));
 }
 await page.screenshot({path:'output/beam-visibility/scene-diagnostic.png'});
}finally{await browser.close();}
