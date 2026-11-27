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
  const make=r=>{const {geometry,ranges}=spacePaintGeometry(strokes);return new SpacePaintTexture(new THREE.Mesh(geometry,new THREE.MeshLambertMaterial()),ranges,strokes,null,r);};
  const fast=make(renderer),full=make(null),target=new THREE.WebGLRenderTarget(128,128);
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial());scene.add(quad);
  const pixels=atlas=>{quad.material.map=atlas.texture;quad.material.needsUpdate=true;renderer.setRenderTarget(target);renderer.render(scene,camera);const data=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(target,0,0,128,128,data);return data;};
  const compare=()=>{const a=pixels(fast),b=pixels(full);let mismatch=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])mismatch++;return mismatch;};
  for(const s of strokes){fast.repaint(s.id,[]);full.repaint(s.id,[]);}
  const checks=[compare()];
  const s={owner:'alice',chart:0,tool:'brush',size:.12,color:'#00ff33',points:[[.1,.92]]};
  for(const p of [[.2,.98],[.3,.03],[.7,.2]]){s.points.push(p);fast.repaint('stroke-2',[s]);full.inkId=null;full.repaint('stroke-2',[s]);checks.push(compare());}
  const other={...s,owner:'bob',color:'#ffcc00',points:[[.2,.98],[.4,.05]]};
  const erase={...s,tool:'eraser',eraseOwn:true,size:.3};
  fast.repaint('stroke-2',[s,other,erase]);full.inkId=null;full.repaint('stroke-2',[s,other,erase]);checks.push(compare());
  const glError=renderer.getContext().getError(),partial=!!fast.uploadTexture&&fast.renderer===renderer;
  fast.dispose();full.dispose();target.dispose();quad.geometry.dispose();quad.material.dispose();renderer.dispose();
  return {checks,glError,partial};
 });
 console.log(JSON.stringify(result));assert.equal(result.glError,0);assert.equal(result.partial,true);assert.ok(result.checks.every(n=>n===0),'GPU tile upload and incremental brush must match full replay');
}finally{await browser.close();}
