import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const site=process.env.TEMPLE_SITE||'http://127.0.0.1:4173';
assert.match(site,/^http:\/\/127\.0\.0\.1:\d+$/);
const baseline=execFileSync('git',['show','d76f5f6:src/grass-field.js'],{encoding:'utf8'});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}});
 const faults=[];page.on('pageerror',error=>faults.push(error.message));
 await page.route(url=>url.pathname==='/__r171-grass-parity',route=>route.fulfill({
  contentType:'text/html',body:'<!doctype html><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js"}}</script><body></body>'
 }));
 await page.route(url=>url.pathname==='/src/grass-field.js'&&url.search==='?r170-original',route=>route.fulfill({contentType:'text/javascript',body:baseline}));
 await page.goto(site+'/__r171-grass-parity');
 const {before,after}=await page.evaluate(async()=>{
  const T=await import('three'),{createVHS}=await import('/src/reletter-vhs.js');
  const {GrassField:Old}=await import('/src/grass-field.js?r170-original');
  const {GrassField:Current}=await import('/src/grass-field.js');
  // Move, turn 180 degrees, aim up/down, and vary the longest permitted
  // blades, FOV and player positions. Revisit a prior view after cache churn.
  const steps=[
   [[0,3,0],[20,.3,40],1,55],[[3,4,5],[25,1,40],1,55],
   [[101,2.5,-51],[122,.7,-30],2.4,55],[[104,2.5,-54],[80,1,-73],2.4,55],
   [[189,3,20],[257,-.5,27],.45,42],[[189,4,20],[180,-.5,35],2.1,78],
   [[0,4,0],[.01,24,0],2.4,50],[[12,25,-10],[13,0,-9],1.8,50],
   [[0,3,0],[20,.3,40],1,55]
  ];
  const run=async(GrassField,mobile)=>{
   const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(480,360);
   const scene=new T.Scene();scene.background=new T.Color('#191939');
   const view=new T.PerspectiveCamera(55,4/3,.1,575),vhs=createVHS(renderer);
   const grass=new GrassField(scene,{mobile}),frames=[],triangles=[],cpu=[],gpu=[];
   const gl=renderer.getContext(),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   for(let i=0;i<steps.length;i++){
    const [eye,aim,length,fov]=steps[i];view.position.fromArray(eye);view.lookAt(...aim);view.fov=fov;view.updateProjectionMatrix();
    grass.setTerrainStyle({terrain:{grassLength:length}});
    const roots=new Map(Array.from({length:6},(_,j)=>[j,{visible:true,position:new T.Vector3(eye[0]+.6+j*.08,0,eye[2]+.75)}]));
    grass.update(9.2+i*.45,roots);
    const at=performance.now();grass.prepareVisibility?.(view);cpu.push(performance.now()-at);
    const q=timer?gl.createQuery():null;if(q)gl.beginQuery(timer.TIME_ELAPSED_EXT,q);
    vhs.render(scene,view,9.2+i*.45);
    if(q)gl.endQuery(timer.TIME_ELAPSED_EXT);
    triangles.push(renderer.info.render.triangles);
    frames.push(renderer.domElement.toDataURL());
    if(q){
     for(let n=0;n<7&&!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE);n++)await new Promise(requestAnimationFrame);
     if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&!gl.getParameter(timer.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);
     gl.deleteQuery(q);
    }
   }
   grass.dispose();renderer.dispose();renderer.forceContextLoss();
   return {frames,triangles,cpu,gpu};
  };
  return {before:[await run(Old,false),await run(Old,true)],after:[await run(Current,false),await run(Current,true)]};
 });
 assert.deepEqual(faults,[]);
 assert.deepEqual(after.map(r=>r.frames),before.map(r=>r.frames),'clip only provably invisible blades, retaining original order and colors');
 const out='output/playwright/r171-lag';await mkdir(out,{recursive:true});
 await writeFile(out+'/grass.png',Buffer.from(after[0].frames[2].split(',')[1],'base64'));
 const summary=rows=>rows.map(({frames,...row})=>({frames:frames.length,...row}));
 console.log(JSON.stringify({before:summary(before),after:summary(after)}));
 for(let i=0;i<after.length;i++)assert.ok(after[i].triangles.some((n,j)=>n<before[i].triangles[j]*.65),'should submit fewer actually hidden vertices');
}finally{await browser.close();}
