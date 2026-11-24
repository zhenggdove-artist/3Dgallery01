import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {ELECTRIC_OCEAN_INNER,ELECTRIC_OCEAN_OUTER,electricOceanGeometry,createElectricOcean} from '../src/grass-field.js';
import {CITY_OUTER_RADIUS} from '../src/shared/city-layout.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('electric ocean is a continuous densely tessellated annulus with a fixed outer-city shoreline',()=>{
 for(const mobile of [true,false]){
  const g=electricOceanGeometry(mobile),p=g.attributes.position;
  let lo=Infinity,hi=0;for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));lo=Math.min(lo,r);hi=Math.max(hi,r);}
  assert.ok(Math.abs(lo-(CITY_OUTER_RADIUS+1))<.001);assert.ok(Math.abs(hi-ELECTRIC_OCEAN_OUTER)<.001);
  assert.ok(g.index.count/3>(mobile?25000:60000));assert.ok(g.index.count/3<70000);g.dispose();
 }
 assert.equal(ELECTRIC_OCEAN_INNER,CITY_OUTER_RADIUS+1);
});
test('electric ocean uses two draws, one shared animated wave height for surface and spray, and no flat backdrop',()=>{
 const scene=new THREE.Scene(),o=createElectricOcean(scene,{mobile:true});
 assert.equal(o.root.children.length,2);assert.ok(o.surface.isMesh);assert.ok(o.spray.isPoints);
 assert.match(o.surface.material.vertexShader,/waveHeight\(q\)/);
 assert.match(o.surface.material.vertexShader,/vec4\(q.x,h,q.y,1.\)/);
 assert.match(o.spray.material.vertexShader,/waveHeight\(q\)\+\.35\+lift/);
 assert.equal(o.surface.material.uniforms,o.spray.material.uniforms);o.update(3.25);assert.equal(o.spray.material.uniforms.uTime.value,3.25);
 assert.equal(o.surface.material.depthWrite,true);assert.equal(o.spray.material.depthTest,true);
 o.dispose();assert.equal(scene.children.length,0);
});
test('CHAT plus starts moving on 5px motion or 180ms hold, rather than canceling the gesture',()=>{
 const s=read('src/chat-layout.js');assert.match(s,/MINI_DRAG_HOLD_MS=180,MINI_DRAG_SLOP=5/);
 assert.match(s,/Math.hypot\(dx,dy\)>=MINI_DRAG_SLOP\)\{\s*clearTimeout\(miniTimer\);miniDrag.mode='move'/);
 assert.match(s,/if\(size==='max'\|\|e.button!==0\|\|miniDrag\)return/);
 assert.match(s,/toggle.setPointerCapture\(e.pointerId\)/);
 assert.doesNotMatch(s,/miniDrag.mode='cancel'/);
});
