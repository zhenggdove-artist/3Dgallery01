import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {attackDirection,cameraAimDirection,crosshairNdc} from '../src/aiming.js';
import {NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';
import {itemById} from '../src/shared/catalog.js';

const names=['storm-3','prism-3'];
const root=()=>{const r=new THREE.Group();r.position.set(0,0,0);r.rotation.y=Math.PI/2;return r;};
const arena=()=>({
 structureGroup:new THREE.Group(),
 world:{monsters:[],monster:null},
 islandEnemies:{current:null,extraModels:[]}
});
const cameraAt=(position,target)=>{
 const camera=new THREE.PerspectiveCamera(55,1,.1,400);
 camera.position.set(...position);
 camera.lookAt(...target);
 camera.updateMatrixWorld(true);
 return camera;
};
const vector=v=>new THREE.Vector3(...v);

test('camera looking UP from below the floor fires prism and lightning UP, never into the ground',()=>{
 // Old muzzle-to-ground intersection aimed the beam DOWN from the high staff
 // when the camera was under a platform / terrain but looking skyward.
 const camera=cameraAt([0,-1,8],[0,5,-12]);
 const visible=cameraAimDirection(camera);
 assert.ok(visible.y>.2,'camera actually points upward');
 const actor=root(),muzzle=new THREE.Vector3(.5,2.8,0);
 for(const name of names){
  const item=itemById(name);
  const aim=vector(attackDirection({root:actor},camera,arena(),new Map(),item,1,muzzle));
  assert.ok(aim.y>.2,name+' must shoot above the horizon');
  assert.ok(aim.dot(visible)>.999999,name+' must aim exactly at the raised 5px reticle');
  assert.ok(muzzle.clone().addScaledVector(aim,40).y>muzzle.y+8,
   name+' terminal VFX endpoint must not be underground');
 }
});

test('prism and lightning camera pitch is continuous: UP / level / DOWN; yaw not forced to actor heading',()=>{
 const actor=root(),muzzle=new THREE.Vector3(0,3,0),world=arena();
 const views=[
  {camera:cameraAt([5,.5,8],[-4,5,-12]),sign:1},
  {camera:cameraAt([5,2,8],[-4,2,-12]),sign:1},
  {camera:cameraAt([5,7,8],[-4,-3,-12]),sign:-1}
 ];
 for(const {camera,sign} of views){
  const expected=cameraAimDirection(camera);
  for(const name of names){
   const actual=vector(attackDirection({root:actor},camera,world,new Map(),itemById(name),0,muzzle));
   assert.ok(actual.dot(expected)>.999999,name+' points at the reticle throughout a pitch sweep');
   assert.ok(sign*actual.y>0,name+' keeps the camera elevation sign');
   assert.ok(actual.x<0&&actual.z<0,name+' respects camera yaw rather than the avatar facing sideways');
  }
 }
 assert.equal(crosshairNdc(1000).y,.01);
});

test('authentic 00GameDevs #08 and #29 ray endpoints follow rising aim from the live staff muzzle',()=>{
 const camera=cameraAt([0,-.5,9],[3,8,-10]);
 const direction=cameraAimDirection(camera);
 const muzzle=new THREE.Vector3(.2,2.6,.3);
 assert.ok(direction.y>.3);
 for(const name of names){
  const scene=new THREE.Scene(),actor=root();scene.add(actor);
  const original=new NumberedWeaponEffects(scene,()=>muzzle.clone());
  const item=itemById(name);
  const event={channel:true,ultimate:true,origin:muzzle.toArray(),
   direction:direction.toArray(),range:42,qualityScale:1,qualityTier:3};
  assert.equal(original.play(event,item,actor),true,name+' native channel effect is playable');
  const entry=original.active[0];
  assert.equal(entry.fx.group.userData.vfxSource,'00GameDevs');
  assert.equal(entry.spec.asset,name.startsWith('storm')?'arc-ray':'charged-beam');
  const axis=new THREE.Vector3(1,0,0).applyQuaternion(entry.fx.group.quaternion).normalize();
  assert.ok(axis.dot(direction)>.999,name+' authored +X VFX axis points upward');
  assert.ok(entry.fx.group.position.distanceTo(
   muzzle.clone().addScaledVector(direction,21))<.01,name+' centered between staff and upper endpoint');
  actor.userData.staffAimDirection=direction.toArray();
  original.update(.016);
  const after=new THREE.Vector3(1,0,0).applyQuaternion(entry.fx.group.quaternion).normalize();
  assert.ok(after.dot(direction)>.99,name+' VFX stays raised after animation update');
  original.dispose();
  assert.equal(scene.children.includes(entry.fx.group),false);
 }
});
