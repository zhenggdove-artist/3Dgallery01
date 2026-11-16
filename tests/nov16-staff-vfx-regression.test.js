import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WeaponVFX} from '../src/weapon-vfx.js';
import {itemById} from '../src/shared/catalog.js';
import {projectileFlightMs} from '../src/shared/combat-balance.js';

const attack=(item,channel=false)=>({weapon:item.id,family:item.family,origin:[4,1,7],
 direction:[0,0,1],range:12,qualityScale:1,time:1234,ultimate:channel,channel});
test('each ordinary elemental staff tap creates a 3D sphere spell, not a spray',()=>{
 for(const id of ['water','tide-1','frost-1','ember-1','storm-1','bloom-1','nova-1']){
  const scene=new THREE.Scene(),vfx=new WeaponVFX(scene),item=itemById(id);
  vfx.play(attack(item),item);
  assert.equal(vfx.staffOrbs.length,1,id);
  assert.equal(vfx.particleSkills.active.length,0,id);
  const orb=vfx.staffOrbs[0];
  assert.match(orb.group.name,/Flying elemental/);
  assert.ok(orb.group.children.some(c=>c.isMesh&&c.geometry.type==='SphereGeometry'),id);
  assert.equal(orb.duration*1000,projectileFlightMs(item,false),id);
  vfx.update(orb.duration/2);
  assert.ok(Math.abs(orb.group.position.x-4)<.001&&Math.abs(orb.group.position.y-1)<.001,id);
  assert.ok(orb.group.position.z>7&&orb.group.position.z<19,id);
  vfx.dispose();assert.equal(scene.children.length,0);
 }
});
test('full-charge fire and water staff streams point straight along server aim; no sideways prefab jets',()=>{
 for(const id of ['tide-1','ember-1','nova-1','frost-1','clam']){
  const scene=new THREE.Scene(),vfx=new WeaponVFX(scene),item=itemById(id);
  const event={...attack(item,true),area:{mode:'area',center:[100,-4,-99],radius:8}};
  vfx.play(event,item);
  assert.equal(vfx.staffOrbs.length,0);
  assert.equal(vfx.active.length,0,'no prefab with incorrect local axis for '+id);
  const numbered=vfx.numberedEffects.active.at(-1);
  const stream=numbered||vfx.particleSkills.active[0];
  assert.ok(stream,id);
  // Official #70 faces +X, #33 faces +Z. #73 uses its oblique
  // free-fire ray, with its nozzle separate from the native group centre.
  const authoredForward=id==='ember-1'?new THREE.Vector3(1,0,.42).normalize():
   id==='frost-1'?new THREE.Vector3(1,0,0):
   new THREE.Vector3(0,0,1);
  const forward=authoredForward.applyQuaternion((numbered?numbered.group:stream.root).quaternion);
  assert.ok(forward.distanceTo(new THREE.Vector3(0,0,1))<.001,'the '+id+' stream must move forward');
  if(id==='ember-1'){
   const actualNozzle=numbered.group.userData.flameAimRoot.localToWorld(new THREE.Vector3(-3.6,1.65,0));
   assert.ok(actualNozzle.distanceTo(new THREE.Vector3(4,1,7))<1e-6,'fire must originate from the correct socket');
   assert.ok(numbered.group.userData.flameAimTargets.every(mesh=>!mesh.parent.visible),'no neutral demo objects');
  }else assert.deepEqual((numbered?numbered.group:stream.root).position.toArray(),[4,1,7],id);
  if(!numbered)assert.ok(Math.abs(stream.root.scale.x-1.6/4.9)<1e-6,id+' lateral hitbox/particle width');
  vfx.dispose();assert.equal(scene.children.length,0);
 }
});
test('initial clam short press uses normal swing effects rather than a 3D spell orb',()=>{
 const scene=new THREE.Scene(),vfx=new WeaponVFX(scene),item=itemById('clam');
 vfx.play(attack(item),item);
 assert.equal(vfx.staffOrbs.length,0,'clam retains a normal melee attack');
 assert.ok(vfx.active.some(x=>x.id==='shockwave'),'starter clam normal swing must display its normal shockwave');
 vfx.dispose();
});


test('repeated server pulses do not restart the moving water stream',()=>{
 const scene=new THREE.Scene(),vfx=new WeaponVFX(scene),root=new THREE.Group();
 const item=itemById('tide-1');scene.add(root);
 const event={...attack(item,true)};
 vfx.play(event,item,root);
 const stream=vfx.channelStreams.get(root.uuid+':'+item.id);
 assert.ok(stream);
 vfx.update(.6);
 const age=stream.age;
 const prior=stream.material.uniforms.uAge.value;
 vfx.play({...event,time:1700},item,root);
 assert.equal(stream.age,age);
 assert.equal(stream.material.uniforms.uAge.value,prior);
 assert.equal(stream.material.uniforms.uLooping.value,1);
 vfx.update(3.1);
 assert.equal(vfx.particleSkills.active.includes(stream),true,'continuous stream does not expire after one-shot duration');
 vfx.stopChannel(root);
 assert.equal(vfx.particleSkills.active.includes(stream),false);
 vfx.dispose();root.removeFromParent();
 assert.equal(scene.children.length,0);
});
