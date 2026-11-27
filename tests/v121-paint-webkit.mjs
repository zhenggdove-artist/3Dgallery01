import assert from 'node:assert/strict';
import {webkit} from 'playwright';
const browser=await webkit.launch({headless:true});
try{
 const page=await browser.newPage();
 const base='http://127.0.0.1:8000';
 for(let i=0;i<50;i++){try{if((await fetch(base+'/index.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 await page.route(base+'/v121-paint-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js"}}</script><body></body>'}));
 await page.goto(base+'/v121-paint-fixture');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three'),{spacePaintGeometry}=await import('/src/space-painter.js'),{SpacePaintTexture}=await import('/src/space-paint-texture.js');
  const renderer=new THREE.WebGLRenderer(),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
  const strokes=Array.from({length:4},(_,i)=>({id:'stroke-'+i,color:'#ff00aa',size:.4,thickness:.3,normal:[0,0,1],points:[[-1,3,i],[1,3,i]]}));
  const make=(r,stable=false)=>{const {geometry,ranges}=spacePaintGeometry(strokes);return new SpacePaintTexture(new THREE.Mesh(geometry,new THREE.MeshLambertMaterial()),ranges,strokes,null,r,stable);};
  const fast=make(renderer),stable=make(renderer,true),full=make(null),target=new THREE.WebGLRenderTarget(128,128);
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial());scene.add(quad);
  const pixels=atlas=>{quad.material.map=atlas.texture;quad.material.needsUpdate=true;renderer.setRenderTarget(target);renderer.render(scene,camera);const data=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(target,0,0,128,128,data);return data;};
  const compare=()=>{const a=pixels(fast),b=pixels(full),c=pixels(stable);let mismatch=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i]||c[i]!==b[i])mismatch++;return mismatch;};
  const initial=compare();for(const s of strokes){fast.repaint(s.id,[]);stable.repaint(s.id,[]);full.repaint(s.id,[]);}
  const checks=[initial,compare()];
  const s={owner:'alice',chart:0,tool:'brush',size:.12,color:'#00ff33',points:[[.1,.92]]};
  for(const p of [[.2,.98],[.3,.03],[.7,.2]]){s.points.push(p);fast.repaint('stroke-2',[s]);stable.repaint('stroke-2',[s]);full.inkId=null;full.repaint('stroke-2',[s]);checks.push(compare());}
  const other={...s,owner:'bob',color:'#ffcc00',points:[[.2,.98],[.4,.05]]};
  const erase={...s,tool:'eraser',eraseOwn:true,size:.3};
  fast.repaint('stroke-2',[s,other,erase]);stable.repaint('stroke-2',[s,other,erase]);full.inkId=null;full.repaint('stroke-2',[s,other,erase]);checks.push(compare());
  stable.restoreTexture();checks.push(compare());
  const {staticPaintTexture}=await import('/src/paint-texture-source.js');
  const fabricCanvas=()=>{const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#ff3355';ctx.fillRect(0,0,64,64);ctx.fillStyle='#22cc88';ctx.fillRect(0,0,32,32);return c;};
  const canvas=fabricCanvas(),original=staticPaintTexture(THREE,fabricCanvas(),false),fabric=staticPaintTexture(THREE,canvas,true);original.colorSpace=THREE.SRGBColorSpace;
  const pa=pixels({texture:original}),pb=pixels({texture:fabric});let fabricMismatch=0;for(let i=0;i<pa.length;i++)if(pa[i]!==pb[i])fabricMismatch++;
  const released=canvas.width===0&&canvas.height===0;original.dispose();fabric.dispose();
  const {signAtlas}=await import('/src/outer-city.js'),{CITY_LOTS}=await import('/src/shared/city-layout.js'),{loadSignPortraits}=await import('/src/sign-art.js');
  await loadSignPortraits();
  const city=signAtlas(CITY_LOTS,true),signs=pixels({texture:city.map});let signPixels=0,signColors=0;
  for(let i=0;i<signs.length;i+=4){const r=signs[i],g=signs[i+1],b=signs[i+2];if(r+g+b>30)signPixels++;if(Math.max(r,g,b)-Math.min(r,g,b)>15)signColors++;}
  const citySize=[city.map.image.width,city.map.image.height],cityStable=city.map.isDataTexture===true;city.map.dispose();
  // Test actual Lambert material with a missing/black map, not just map bytes.
  const originalQuadMaterial=quad.material;
  const col=new THREE.Color('#ff00aa'),vertexColors=new Float32Array(quad.geometry.attributes.position.count*3);
  for(let i=0;i<vertexColors.length;i+=3)col.toArray(vertexColors,i);
  quad.geometry.setAttribute('color',new THREE.BufferAttribute(vertexColors,3));
  const flags=new THREE.BufferAttribute(new Float32Array(quad.geometry.attributes.position.count),1);
  quad.geometry.setAttribute('paintHasInk',flags);
  const ambient=new THREE.AmbientLight(0xffffff,1);scene.add(ambient);
  const reference=new THREE.MeshLambertMaterial({vertexColors:true}),black=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);black.colorSpace=THREE.SRGBColorSpace;black.needsUpdate=true;
  const renderQuad=material=>{quad.material=material;renderer.setRenderTarget(target);renderer.render(scene,camera);const p=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(target,0,0,128,128,p);return p;};
  const basePixels=renderQuad(reference),priorMap=stable.material.map;stable.material.map=black;stable.material.needsUpdate=true;
  const fallbackPixels=renderQuad(stable.material);let fallbackMismatch=0;
  for(let i=0;i<basePixels.length;i++)if(basePixels[i]!==fallbackPixels[i])fallbackMismatch++;
  flags.array.fill(1);flags.needsUpdate=true;const blackPixels=renderQuad(stable.material);
  const center=(64*128+64)*4,legitimateBlack=blackPixels[center]===0&&blackPixels[center+1]===0&&blackPixels[center+2]===0;
  stable.material.map=priorMap;quad.material=originalQuadMaterial;reference.dispose();black.dispose();scene.remove(ambient);
  const glError=renderer.getContext().getError(),partial=!!fast.uploadTexture&&fast.renderer===renderer,stablePartial=!!stable.uploadTexture&&stable.renderer===renderer;
  fast.dispose();stable.dispose();full.dispose();target.dispose();quad.geometry.dispose();quad.material.dispose();renderer.dispose();
  return {checks,glError,partial,stablePartial,fabricMismatch,released,citySize,cityStable,signPixels,signColors,fallbackMismatch,legitimateBlack};
 });
 console.log(JSON.stringify(result));assert.equal(result.glError,0);assert.equal(result.partial,true);assert.equal(result.stablePartial,true);assert.equal(result.fabricMismatch,0);assert.equal(result.released,true);assert.equal(result.cityStable,true);assert.equal(result.fallbackMismatch,0);assert.equal(result.legitimateBlack,true);assert.ok(result.signPixels>10000&&result.signColors>1000,'full-size city signs must contain visible colored pixels');assert.ok(result.checks.every(n=>n===0),'GPU tile upload and incremental brush must match full replay');
}finally{await browser.close();}
