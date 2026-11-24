import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {GrassField} from '../src/grass-field.js';
import {CITY_OUTER_RADIUS} from '../src/shared/city-layout.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('V035 grass meets the nebula with no ocean or extra ground annulus',()=>{
 const scene=new THREE.Scene(),grass=new GrassField(scene,{mobile:true,count:8});
 assert.equal(scene.children.length,4);
 assert.equal(grass.outerCanopy.geometry.parameters.outerRadius,CITY_OUTER_RADIUS+1);
 assert.equal(grass.ocean,undefined);assert.equal(grass.horizon,undefined);
 grass.update(4,new Map());assert.equal(grass.mesh.material.uniforms.uTime.value,4);
 assert.match(read('src/reletter-presentation.js'),/CircleGeometry\(CITY_OUTER_RADIUS\+1,192\)/);
 assert.doesNotMatch(read('src/grass-field.js'),/createElectricOcean|waveHeight|ELECTRIC_OCEAN/);
 assert.match(read('src/night-sky.js'),/Cosmic nebula turbulent particle ocean/);
 grass.dispose();assert.equal(scene.children.length,0);
});
test('CHAT plus starts moving on 5px motion or 180ms hold, rather than canceling the gesture',()=>{
 const s=read('src/chat-layout.js');assert.match(s,/MINI_DRAG_HOLD_MS=180,MINI_DRAG_SLOP=5/);
 assert.match(s,/Math.hypot\(dx,dy\)>=MINI_DRAG_SLOP\)\{\s*clearTimeout\(miniTimer\);miniDrag.mode='move'/);
 assert.match(s,/if\(size==='max'\|\|e.button!==0\|\|miniDrag\)return/);
 assert.match(s,/toggle.setPointerCapture\(e.pointerId\)/);
 assert.doesNotMatch(s,/miniDrag.mode='cancel'/);
});
