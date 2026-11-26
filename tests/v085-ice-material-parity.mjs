import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const site=process.env.TEMPLE_SITE||'http://127.0.0.1:4173';
assert.match(site,/^http:\/\/127\.0\.0\.1:\d+$/);
const original=execFileSync('git',['show','15ede91:src/weapon-vfx.js'],{encoding:'utf8'});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}});
 const failures=[];
 page.on('pageerror',error=>failures.push(error.message));
 page.on('console',msg=>{if(msg.type()==='error'&&/shader/i.test(msg.text()))failures.push(msg.text());});
 await page.route(url=>url.pathname==='/__v085-ice-test',route=>route.fulfill({
  contentType:'text/html',body:`<!doctype html><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script><body></body>`
 }));
 await page.route(url=>url.pathname==='/src/weapon-vfx.js'&&url.search==='?v085-original',
  route=>route.fulfill({contentType:'text/javascript',body:original}));
 await page.goto(site+'/__v085-ice-test');
 const cases=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {createVHS}=await import('/src/reletter-vhs.js');
  const old=(await import('/src/weapon-vfx.js?v085-original')).WeaponVFX;
  const current=(await import('/src/weapon-vfx.js')).WeaponVFX;
  const compare=async(WeaponVFX)=>{
   const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
   renderer.toneMapping=THREE.ACESFilmicToneMapping;
   renderer.setSize(480,360);
   const scene=new THREE.Scene();
   scene.background=new THREE.Color('#101b36');scene.fog=new THREE.FogExp2('#101b36',.0008);
   scene.add(new THREE.HemisphereLight(),new THREE.DirectionalLight());
   // Five desktop artwork lights plus the persistent WRITE point light.
   for(let i=0;i<6;i++)scene.add(new THREE.PointLight());
   const camera=new THREE.PerspectiveCamera(56,4/3,.1,200);
   camera.position.set(2,2.5,6);camera.lookAt(0,1,0);
   const vfx=new WeaponVFX(scene);
   // Isolate just the original generic factory warm/pool. The production
   // gameplay path (acquire, reset, options, update, VHS) is unmodified.
   for(const layer of [vfx.particleSkills,vfx.signatureEffects,vfx.numberedEffects,vfx.restoration,vfx.plantUltimates])
    layer.warm=async()=>0;
   vfx.warmStaffOrbs=async()=>{};
   const start=performance.now();await vfx.warm(renderer,camera);const warmMs=performance.now()-start;
   // OuterCity already initializes cached program uniforms during normal boot.
   for(const program of renderer.info.programs)program.getUniforms();
   const vhs=createVHS(renderer);
   vhs.render(scene,camera,10);
   const seed=renderer.domElement.toDataURL();
   const gl=renderer.getContext();
   const oldCompile=gl.compileShader.bind(gl);
   let shaders=0;gl.compileShader=(...args)=>{shaders++;return oldCompile(...args);};
   // A charged frost line outlives the two ready instances. Match a normal
   // three-segment overlap, including the first new instance beyond the pool.
   const entries=Array.from({length:3},(_,i)=>{
    const entry=vfx.acquire('ice-shatter',{color:'#a7e4ff',size:1,density:.65,quantity:9,speed:1});
    entry.fx.group.position.set((i-1)*1.2,.28,-i*.85);
    return entry;
   });
   const frames=[];
   for(let i=1;i<=12;i++){
    for(const entry of entries)entry.fx.update(.075);
    vhs.render(scene,camera,10+i*.075);
    frames.push({pixels:renderer.domElement.toDataURL(),draws:renderer.info.render.calls,faces:renderer.info.render.triangles});
   }
   renderer.dispose();renderer.forceContextLoss();
   return {frames,shaders,warmMs,seed};
  };
  return {before:await compare(old),after:await compare(current)};
 });
 assert.equal(cases.before.seed,cases.after.seed);
 assert.deepEqual(cases.before.frames,cases.after.frames,'every rendered RGBA frame, draw call and triangle count must match');
 assert.deepEqual(failures,[]);
 const out='output/v085-skill';await mkdir(out,{recursive:true});
 await writeFile(out+'/deterministic-ice-before.png',Buffer.from(cases.before.frames[6].pixels.split(',')[1],'base64'));
 await writeFile(out+'/deterministic-ice-after.png',Buffer.from(cases.after.frames[6].pixels.split(',')[1],'base64'));
 assert.ok(cases.before.frames[6].pixels!==cases.before.seed,'test must draw real visible skill pixels');
 console.log(JSON.stringify({identicalFrames:12,newShaders:{before:cases.before.shaders,after:cases.after.shaders},warmMs:{before:cases.before.warmMs,after:cases.after.warmMs}}));
 assert.ok(cases.before.shaders>cases.after.shaders,'the exact arena programs must not compile on the first cast');
}finally{await browser.close();}
