import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CityWallPainter} from '../src/city-wall-painter.js';
import {PlayerController} from '../src/player-controller.js';
import {validateState} from '../src/shared/temple-rules.js';
import {applySpacePaint} from '../src/shared/space-paint.js';

test('2D and 3D share flight controls; only 3D has rotation; leaving either restores gravity',()=>{
 const title={textContent:''},turns=[{style:{}},{style:{}}],calls=[];
 const controls={hidden:true,querySelector:()=>title,querySelectorAll:()=>turns};
 const painter=Object.assign(Object.create(CityWallPainter.prototype),{active:true,mode3D:false,role:()=> 'fighter',controller:()=>({setPaintFlight:v=>calls.push(v)}),clearFlight:()=>calls.push('clear'),flightControls:controls});
 painter.syncPaintFlight();assert.deepEqual(calls,['clear','2d']);assert.equal(controls.hidden,false);assert.equal(title.textContent,'2D MOVE');assert.ok(turns.every(b=>b.hidden));
 painter.mode3D=true;painter.syncPaintFlight();assert.deepEqual(calls.slice(-2),['clear',true]);assert.ok(turns.every(b=>!b.hidden&&b.style.display===''));
 painter.mode3D=false;painter.syncPaintFlight();assert.equal(calls.at(-1),'2d');
 painter.active=false;painter.syncPaintFlight();assert.equal(calls.at(-1),false);assert.equal(controls.hidden,true);
 painter.active=true;painter.role=()=> 'spectator';painter.syncPaintFlight();assert.equal(calls.at(-1),false);assert.equal(controls.hidden,true);
});
test('shared movement preserves height without input, supports six directions, and restores normal falling',()=>{
 const p=Object.assign(Object.create(PlayerController.prototype),{role:'fighter',root:{position:new THREE.Vector3(0,80,0),rotation:{y:0}},yaw:0,arena:{groundHeight:()=>0,blocked:()=>false,spacePaintClip:()=>1},jumpVelocity:new THREE.Vector3(),keys:new Set(),move:new THREE.Vector2(),updateCamera(){}});
 p.setPaintFlight('2d');assert.equal(p.paintFlight,true);assert.equal(p.state().paintFlight,'2d');
 const start=p.root.position.clone();p.advancePaintFlight(.1);assert.deepEqual(p.root.position.toArray(),start.toArray());
 for(const axis of [0,1,2])for(const dir of [-1,1]){p.root.position.copy(start);p.paintAxes=[0,0,0];p.paintAxes[axis]=dir;p.advancePaintFlight(.1);assert.ok(Math.abs(p.root.position.getComponent(axis)-start.getComponent(axis)-dir*.864)<1e-9);}
 p.setPaintFlight(true);assert.equal(p.state().paintFlight,true);
 p.setPaintFlight(false);assert.equal(p.paintFlight,false);assert.equal(p.paintHighDescent,true);assert.deepEqual(p.paintAxes,[0,0,0]);assert.equal(p.state().paintFlight,undefined);
});
test('ordinary fighters can move vertically in 2D paint but gain neither 3D creation permission nor collision bypass',()=>{
 const pose=(y,paintFlight,x=0,z=0)=>({position:[x,y,z],rotation:0,paintFlight});
 const now=Date.now(),check=(a,b,role='fighter',mobility={})=>validateState(a,b,100,role,null,null,now,mobility);
 assert.ok(check(pose(64),pose(65,'2d')).state);
 assert.ok(check(pose(100,'2d'),pose(101,'2d')).state);
 assert.equal(check(pose(64),pose(65,true)).error,'Invalid position');
 assert.equal(check(pose(149),pose(151,'2d')).error,'Invalid position');
 assert.equal(check(pose(64),pose(65,'2d'),'spectator').error,'Invalid position');
 assert.equal(check(pose(65),pose(100,'2d')).error,'Movement rejected');
 assert.ok(check(pose(100,'2d'),pose(99)).state);
 const stroke={id:'stroke-2d-test',ownerKey:'other',color:'#ff00aa',size:.5,thickness:.4,normal:[0,0,1],points:[[-2,3,0],[2,3,0]]};
 assert.equal(check(pose(2,'2d',0,-1),pose(2,'2d',0,1),'fighter',{spacePaint:[stroke]}).error,'3D paint collision');
 assert.ok(applySpacePaint({profiles:{alice:{hp:100}},spacePaint:[],revision:0},{key:'alice',role:'fighter'},{action:'gm-paint-3d',stroke}).error);
});
