import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const base=process.env.TEMPLE_SITE||'http://127.0.0.1:8000';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:640,height:400}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/__ocean-r117',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}#chat-hud{position:fixed;left:20px;top:20px;width:120px;height:80px;z-index:3;background:white}#chat-hud.chat-minimized{width:42px;height:42px}#chat-toggle{touch-action:none;width:42px;height:42px}</style><div id="chat-hud"><div id="chat-resize"><button id="chat-toggle">+</button></div></div><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js"}}</script><script type="module">import {bindChatLayout} from '/src/chat-layout.js';bindChatLayout();window.chatReady=true;</script>`}));
 await page.goto(base+'/__ocean-r117');await page.waitForFunction(()=>window.chatReady);
 const metrics=await page.evaluate(async()=>{
  const T=await import('three'),{createElectricOcean,ELECTRIC_OCEAN_INNER}=await import('/src/grass-field.js');
  const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(640,400);document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#365c92');
  const ocean=createElectricOcean(scene,{mobile:true});
  const land=new T.Mesh(new T.CircleGeometry(ELECTRIC_OCEAN_INNER,192),new T.MeshBasicMaterial({color:'#527b42'}));land.rotation.x=-Math.PI/2;scene.add(land);
  const camera=new T.PerspectiveCamera(55,1.6,.1,1000);
  const target=new T.WebGLRenderTarget(320,200);const pixels=new Uint8Array(320*200*4);
  function sample(time){
   ocean.update(time);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,320,200,pixels);
   const colors=new Set();let pink=0;for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(r>g*1.25&&b>g*1.1&&r>65){pink++;colors.add([r>>4,g>>4,b>>4].join(','));}}
   return {pink,colors:colors.size,pixels:Array.from(pixels)};
  }
  const views=[];
  for(const [x,y] of [[ELECTRIC_OCEAN_INNER-9,4],[110,22]]){
   camera.position.set(x,y,0);camera.lookAt(x+180,9,0);camera.updateMatrixWorld(true);
   const a=sample(.2),b=sample(2.4);let changed=0;for(let i=0;i<a.pixels.length;i+=4){if(Math.abs(a.pixels[i]-b.pixels[i])+Math.abs(a.pixels[i+1]-b.pixels[i+1])+Math.abs(a.pixels[i+2]-b.pixels[i+2])>24)changed++;}
   views.push({pink:a.pink,colors:a.colors,changed});
  }
  camera.position.set(ELECTRIC_OCEAN_INNER-12,7,0);camera.lookAt(ELECTRIC_OCEAN_INNER+150,12,0);renderer.setRenderTarget(null);ocean.update(3);renderer.render(scene,camera);
  return {views,glError:renderer.getContext().getError()};
 });
 console.log('ELECTRIC_OCEAN_GPU='+JSON.stringify(metrics));
 assert.equal(metrics.glError,0);for(const m of metrics.views){assert.ok(m.pink>1500,JSON.stringify(m));assert.ok(m.colors>12,JSON.stringify(m));assert.ok(m.changed>500,JSON.stringify(m));}
 await mkdir('output/electric-ocean',{recursive:true});await page.screenshot({path:'output/electric-ocean/shoreline.png'});
 const toggle=page.locator('#chat-toggle');await toggle.click();assert.equal(await page.locator('#chat-hud').getAttribute('data-chat-size'),'min');
 let pos=await toggle.boundingBox();await page.mouse.move(pos.x+20,pos.y+20);await page.mouse.down();await page.mouse.move(pos.x+100,pos.y+80);await page.mouse.up();
 let moved=await toggle.boundingBox();assert.ok(moved.x>pos.x+40);assert.equal(await page.locator('#chat-hud').getAttribute('data-chat-size'),'min');
 await toggle.click();assert.equal(await page.locator('#chat-hud').getAttribute('data-chat-size'),'max');
 await toggle.click();assert.equal(await page.locator('#chat-hud').getAttribute('data-chat-size'),'medium');
 pos=await toggle.boundingBox();await page.mouse.move(pos.x+20,pos.y+20);await page.mouse.down();await page.waitForTimeout(210);assert.ok(await page.locator('#chat-hud').evaluate(el=>el.classList.contains('chat-dragging')));await page.mouse.move(pos.x+60,pos.y+60);await page.mouse.up();
 assert.equal(await page.locator('#chat-hud').getAttribute('data-chat-size'),'medium');assert.equal(errors.length,0,errors.join('\n'));
}finally{await browser.close();}
