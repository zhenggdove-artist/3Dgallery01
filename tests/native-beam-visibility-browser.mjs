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
    for(let i=0;i<126;i++)numbered.update(1/60);
    const after=entry?{visible:entry.fx.group.visible,phase:entry.fx.phase,
     scale:entry.fx.group.scale.toArray(),position:entry.fx.group.position.toArray(),rotation:entry.fx.group.quaternion.toArray(),
     children:entry.fx.group.children.map(c=>({name:c.name,type:c.type,visible:c.visible,drawRange:c.geometry?.drawRange,frustumCulled:c.frustumCulled})).slice(0,22)}:null;
    const gpu=check();
    cases.push({id:item.id,spawned,atStart,after,gpu});
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
 await page.evaluate(()=>{
  const t=templeTest;
  t.network.close(); // prevent remote world updates from overwriting test equipment
  window.beamActions=[];window.beamChannelEvents=[];
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
   const world={...t.ui.world,profile:{...t.ui.world.profile,equipment:{...t.ui.world.profile.equipment,weapon:id}}};
   t.network.dispatchEvent(new CustomEvent('world',{detail:world}));
   const item=t.items.find(x=>x.id===id);
   t.arena.setPlayerEquipment(t.controller().root,{weapon:id});
   t.controller().pitch=-.35;
   return {item:item?.id,chargeMs:item?.chargeMs,channelItem:item?.family};
  },name);
  await page.evaluate(()=>templeTest.ui.emit('attack-start'));
  await page.waitForTimeout(Math.max(3400,(setup.chargeMs||1500)+1400));
  const snapshot=await page.evaluate(()=>{
   const t=templeTest,n=t.arena.presentation.vfx.numberedEffects,camera=t.camera;
   return {name:t.ui.world.profile.equipment.weapon,actions:window.beamActions.slice(-24),
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
  integrated.push({setup,snapshot});
  await page.screenshot({path:'output/beam-visibility/'+name+'-held.png'});
  await page.evaluate(()=>{templeTest.ui.emit('attack-release');window.beamActions=[];window.beamChannelEvents=[];});
  await page.waitForTimeout(300);
 }
 console.log('INTEGRATED_BEAM_DIAGNOSTIC='+JSON.stringify(integrated));
 await page.screenshot({path:'output/beam-visibility/scene-diagnostic.png'});
}finally{await browser.close();}
