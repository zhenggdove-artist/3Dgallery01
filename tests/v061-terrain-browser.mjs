import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const ui=await read('src/ui.js'),shared=await read('src/shared/terrain-style.js');
const start=ui.indexOf('  renderTerrainStyle(){'),end=ui.indexOf('  renderSkyColor(){',start);
assert.ok(start>=0&&end>start);
const editor=ui.slice(start,end).trim();
const css=(await Promise.all(['styles.css','sketch-hud.css','fidelity-ui.css','wanted-list.css'].map(read))).join('\n');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
  const page=await browser.newPage({viewport});
  await page.setContent('<style>'+css+'</style><body class="panel-open"><aside id="panel" class="build-floating terrain-style-floating"><header><h2>草地環境</h2></header><div id="panel-content"></div></aside>');
  const result=await page.evaluate(async ({editor,shared})=>{
   const mod=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(shared+'\nexport const render=({'+editor+'}).renderTerrainStyle;'));
   const events=[],content=document.getElementById('panel-content'),context={content,world:{environment:{}},emit:(type,value)=>events.push({type,value})};
   mod.render.call(context);
   const q=s=>content.querySelector(s),color=q('[data-terrain-color]'),change=(el,val)=>{el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}));};
   change(color,'#aa0022');q('[data-terrain-tab="grassColor"]').click();change(color,'#0044dd');q('[data-terrain-tab="floorColor"]').click();change(color,'#ef9944');change(q('[data-terrain-length]'),'185');
   change(q('[data-terrain-param="soilExposure"]'),'60');change(q('[data-terrain-param="flowerDensity"]'),'75');change(q('[data-terrain-param="grassPushRadius"]'),'310');q('[data-terrain-tab="flowerBlue"]').click();change(color,'#2266ff');
   const draft=events.at(-1).value,correct=draft.soilExposure===.6&&draft.flowerDensity===.75&&draft.grassPushRadius===3.1&&draft.flowerBlue==='#2266ff'&&draft.meadowColor==='#aa0022'&&draft.grassColor==='#0044dd'&&draft.floorColor==='#ef9944'&&draft.grassLength===1.85;
   const oneTab=content.querySelectorAll('[data-terrain-tab][aria-pressed=true]').length===1;
   const length=q('[data-terrain-length]').nextElementSibling.textContent==='185%';
   const bounds=document.getElementById('panel').getBoundingClientRect(),fits=bounds.right<=innerWidth&&bounds.bottom<=innerHeight;
   q('[data-terrain-reset]').click();const reset=JSON.stringify(events.at(-1).value)===JSON.stringify(mod.TERRAIN_DEFAULTS);
   return {correct,oneTab,length,fits,reset};
  },{editor,shared});
  assert.deepEqual(result,{correct:true,oneTab:true,length:true,fits:true,reset:true});await page.close();
 }
 // Compile and render the actual production grass shaders on the static server.
 const page=await browser.newPage({viewport:{width:320,height:240}});
 const base='http://127.0.0.1:8000';
 // Resolve the repo's actual dev-server port from its package start script below.
 const host=process.env.TEMPLE_STATIC_URL||base;await page.route(host+'/terrain-test',route=>route.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script>'}));await page.goto(host+'/terrain-test',{waitUntil:'domcontentloaded',timeout:60000});
 const render=await page.evaluate(async()=>{
  const THREE=await import('three'),{GrassField}=await import('./src/grass-field.js');
  const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(64,64);
  const camera=new THREE.PerspectiveCamera(60,1,.1,300);camera.position.set(0,20,50);camera.lookAt(0,0,30);
  const field=new GrassField(scene,{mobile:true,count:500});field.outerMesh.visible=false;field.outerCanopy.visible=false;field.outerFlowerMesh.visible=false;
  const sample=()=>{renderer.render(scene,camera);const pixels=new Uint8Array(64*64*4),gl=renderer.getContext();gl.readPixels(0,0,64,64,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return Array.from(pixels);};
  const before=sample();field.setTerrainStyle({terrain:{meadowColor:'#ff0000',grassColor:'#ffffff',floorColor:'#0000ff',grassLength:2}});const after=sample();field.setTerrainStyle({});const restored=sample();
  const result={changed:before.some((v,i)=>v!==after[i]),restored:before.every((v,i)=>v===restored[i]),programs:renderer.info.programs.length>0};field.dispose();renderer.dispose();return result;
 });
 assert.deepEqual(render,{changed:true,restored:true,programs:true});await page.close();
}finally{await browser.close();}
