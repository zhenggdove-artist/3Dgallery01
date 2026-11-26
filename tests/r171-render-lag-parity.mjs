import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Same native models, render target, fog and light counts on both sides.
// Compare the r170 source in this checkout with the candidate in a local Chrome.
const site=process.env.TEMPLE_SITE||'http://127.0.0.1:4173';
assert.match(site,/^http:\/\/127\.0\.0\.1:\d+$/);
const modules=['arena-view','island-enemies','monster-attack-effects','elemental-status-visuals'];
const baseline=new Map(modules.map(name=>['/src/'+name+'.js',
 execFileSync('git',['show','d76f5f6:src/'+name+'.js'],{encoding:'utf8'})]));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}});
 const faults=[];
 page.on('pageerror',error=>faults.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&/shader|monster vfx/i.test(message.text()))faults.push(message.text());});
 await page.route(url=>url.pathname==='/__r171-render-parity',route=>route.fulfill({
  contentType:'text/html',body:'<!doctype html><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script><body></body>'
 }));
 await page.route(url=>baseline.has(url.pathname)&&url.search==='?r170-original',route=>route.fulfill({
  contentType:'text/javascript',body:baseline.get(new URL(route.request().url()).pathname)
 }));
 await page.goto(site+'/__r171-render-parity');
 const results=await page.evaluate(async()=>{
  const T=await import('three'),{createVHS}=await import('/src/reletter-vhs.js');
  const {islandModel}=await import('/src/reletter/island-actors.js');
  const {ENEMY_HEIGHT}=await import('/src/shared/island-combat.js');
  async function run(old){
   const suffix=old?'?r170-original':'';
   const {TempleArena}=await import('/src/arena-view.js'+suffix);
   const {IslandEnemies}=await import('/src/island-enemies.js'+suffix);
   const {MonsterAttackEffects}=await import('/src/monster-attack-effects.js'+suffix);
   const {ElementalStatusVisuals}=await import('/src/elemental-status-visuals.js'+suffix);
   const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
   renderer.setSize(480,360);renderer.toneMapping=T.ACESFilmicToneMapping;
   const scene=new T.Scene();scene.background=new T.Color('#18233c');scene.fog=new T.FogExp2('#18233c',.0008);
   const data=new Uint8Array(256*128*4);
   for(let i=0;i<data.length;i+=4){data[i]=160;data[i+1]=145;data[i+2]=210;data[i+3]=255;}
   scene.environment=new T.DataTexture(data,256,128);
   scene.environment.mapping=T.EquirectangularReflectionMapping;scene.environment.needsUpdate=true;
   scene.add(new T.HemisphereLight('#ffcbd6','#25484b',1.7),new T.DirectionalLight('#ffdfee',2));
   for(let i=0;i<6;i++){
    const light=new T.PointLight('#c8c8ff',i%2?0:4,18,2);
    light.position.set(i-3,3,2);scene.add(light);
   }
   const view=new T.PerspectiveCamera(53,4/3,.1,200);view.position.set(5,5,13);view.lookAt(0,1.65,0);
   const arena=new TempleArena(scene,renderer);
   arena.coinMesh=new T.InstancedMesh(new T.CylinderGeometry(.36,.36,.06,24),
    new T.MeshStandardMaterial({color:'#f7cf2f',metalness:.8,roughness:.2}),1);
   const enemies=new IslandEnemies(scene),effects=new MonsterAttackEffects(scene),statuses=new ElementalStatusVisuals();
   const rig=await islandModel('flower',ENEMY_HEIGHT);rig.visible=false;enemies.models.set('flower',rig);scene.add(rig);
   await enemies.warmModels(renderer,view);
   await effects.warm(renderer,view);
   await arena.warmGroundDropPrograms?.(renderer,view);
   await statuses.warmModelTints?.(renderer,view,scene,[rig]);
   // The production loading stage initializes resident uniforms before Ready.
   for(const program of renderer.info.programs)program.getUniforms();
   const vhs=createVHS(renderer),gl=renderer.getContext(),compile=gl.compileShader.bind(gl);
   const ext=gl.getExtension('WEBGL_debug_renderer_info'),gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';
   let count=0,phase='none';const linkMs=[];
   const getLog=gl.getProgramInfoLog.bind(gl);
   gl.getProgramInfoLog=function(program){const at=performance.now();try{return getLog(program);}finally{linkMs.push([phase,performance.now()-at]);}};
   gl.compileShader=function(shader){count++;return compile(shader);};
   const frames=[],compiles={},sync=[];
   const capture=time=>{vhs.render(scene,view,time);frames.push(renderer.domElement.toDataURL());};
   capture(10);
   const scenery=frames[0],geometryIds=new Set(),stageStart=()=>{count=0;};
   phase='drop';stageStart();
   for(let i=0;i<10;i++){
    // The two denominations overlap deliberately: draw order and resulting
    // color must match even if batches would otherwise look interchangeable.
    const pile=den=>({id:'bill-'+den+'-'+i,itemId:'comfort-dollar-'+den,kind:'consumable',position:[0,0,0]});
    const bills=[pile(20),pile(50),pile(100)];if(i%2)bills.reverse();
    arena.world={groundDrops:[...bills,{id:'coin-'+i,kind:'coin',position:[2,0,0]}]};arena.clock=10+i*.125;
    const start=performance.now();arena.syncDrops();sync.push(performance.now()-start);
    for(const mesh of arena.dropMeshes)geometryIds.add(mesh.geometry.uuid);
    if([0,1,9].includes(i))capture(arena.clock);
   }
   compiles.drop=count;
   arena.world={groundDrops:[]};arena.syncDrops();
   phase='freeze';stageStart();
   for(let i=0;i<4;i++){
    const now=10000+i*100;
    const states=Array.from({length:3},(_,j)=>({id:'monster-'+j,active:true,position:[j*2-2,0,0],skills:[{
     id:'frost',motion:'freeze',phase:'active',aim:[j*2-2,0,0],origin:[0,0,0],radius:2.8,start:9700,end:11200
    }]}));
    effects.sync(states,now);capture(now/1000);
   }
   compiles.freeze=count;
   effects.sync([],11000);
   phase='rig';stageStart();
   const state={id:'flower',model:'flower',active:true,position:[0,0,-2],skills:[],moving:false};
   enemies.sync(state);
   for(let i=0;i<4;i++){enemies.updateModel(rig,state,.075,i*75);capture(12+i*.075);}
   compiles.rig=count;
   phase='elemental tint';stageStart();
   statuses.sync(rig,{freeze:{until:14000}},12000);capture(12.4);
   statuses.clear(rig);
   // A new status must also avoid a recompile after the first tint is gone.
   statuses.sync(rig,{paralysis:{until:14000}},12200);capture(12.5);
   statuses.clear(rig);capture(12.6);
   compiles['elemental tint']=count;
   renderer.dispose();renderer.forceContextLoss();
   return {frames,scenery,compiles,linkMs,gpu,geometryCount:geometryIds.size,syncMs:sync.reduce((a,b)=>a+b,0)};
  }
  return {before:await run(true),after:await run(false)};
 });
 const {before,after}=results;
 assert.deepEqual(faults,[]);
 assert.equal(after.frames.length,15);
 assert.deepEqual(after.frames,before.frames,'ground loot, monster freeze, and the original monster rig must render identical pixels');
 for(const frame of [1,7,11])assert.notEqual(after.frames[frame],after.scenery,'the fixture must really draw the target');
 const out='output/playwright/r171-lag';await mkdir(out,{recursive:true});
 for(const [name,frame] of [['loot',1],['freeze',7],['rig',11],['rig-frozen',12]])
  await writeFile(`${out}/${name}.png`,Buffer.from(after.frames[frame].split(',')[1],'base64'));
 const summarized=({frames,scenery,...summary})=>summary;
 console.log(JSON.stringify({identicalFrames:after.frames.length,before:summarized(before),after:summarized(after)}));
 for(const phase of ['drop','freeze','rig','elemental tint']){
  assert.ok(before.compiles[phase]>0,phase+' must reproduce the cold link on r170');
  assert.equal(after.compiles[phase],0,phase+' must not synchronously compile in the gameplay frame');
 }
 assert.ok(after.geometryCount<before.geometryCount,'changing drop snapshots must not recreate the same geometry');
}finally{await browser.close();}
