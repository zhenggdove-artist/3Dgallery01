import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WeaponVFX} from '../src/weapon-vfx.js';
import {itemById} from '../src/shared/catalog.js';
import {projectileFlightMs} from '../src/shared/combat-balance.js';

const attack=(item,channel=false)=>({weapon:item.id,family:item.family,origin:[4,1,7],
 direction:[0,0,1],range:12,qualityScale:1,time:1234,ultimate:channel,channel});
test('each ordinary elemental staff tap creates a 3D sphere spell, not a spray',()=>{
 for(const id of ['water','tide-1','frost-1','ember-1','storm-1','prism-1','bloom-1','nova-1']){
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
  assert.equal(vfx.particleSkills.active.length,1,id);
  const stream=vfx.particleSkills.active[0];
  const forward=new THREE.Vector3(0,0,1).applyQuaternion(stream.root.quaternion);
  assert.ok(forward.distanceTo(new THREE.Vector3(0,0,1))<.001,'the '+id+' stream must move forward');
  assert.deepEqual(stream.root.position.toArray(),[4,1,7],id);
  assert.equal(stream.root.scale.x,1,id);
  vfx.dispose();assert.equal(scene.children.length,0);
 }
});
test('initial clam short press uses normal swing effects rather than a 3D spell orb',()=>{
 const scene=new THREE.Scene(),vfx=new WeaponVFX(scene),item=itemById('clam');
 vfx.play(attack(item),item);
 assert.equal(vfx.staffOrbs.length,1===0?1:0,'clam retains its melee normal attack');
 vfx.dispose();
});
