import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';
import {itemById} from '../src/shared/catalog.js';
import {curvePoint,lateralBeamInput,targetOnBeam,updateNativeCurve,BEAM_CURVE_METRES} from '../src/native-beam-curve.js';

test('native shader Bezier curve bows toward movement: left is left, right is right; both ends remain fixed',()=>{
 const start=new THREE.Vector3(0,2,0),end=new THREE.Vector3(0,3,-18);
 for(const bend of [-3,0,3]){
  assert.ok(curvePoint(start,end,bend,0).distanceTo(start)<1e-8);
  assert.ok(curvePoint(start,end,bend,1).distanceTo(end)<1e-8);
  const mid=curvePoint(start,end,bend,.5);
  assert.ok(Math.abs(mid.x-bend)<1e-6);
  assert.ok(Math.abs(mid.y-2.5)<1e-6);
 }
 const aim=new THREE.Vector3(0,.15,-1).normalize();
 assert.equal(lateralBeamInput(new THREE.Vector3(-1,0,0),aim),-1);
 assert.equal(lateralBeamInput(new THREE.Vector3(1,0,0),aim),1);
 assert.equal(lateralBeamInput(new THREE.Vector3(1,0,0),aim,false),0);
});

test('enemy endpoint must lie on the actual server-owned forward hit tube',()=>{
 const muzzle=new THREE.Vector3(0,2,0),aim=new THREE.Vector3(0,0,-1);
 const near=new THREE.Vector3(.5,2,-9),far=new THREE.Vector3(.2,2,-16);
 const side=new THREE.Vector3(3.5,2,-5),behind=new THREE.Vector3(0,2,3);
 assert.ok(targetOnBeam(muzzle,aim,18,[side,far,near]).distanceTo(near)<1e-8);
 assert.equal(targetOnBeam(muzzle,aim,18,[behind,side]),null);
 assert.equal(targetOnBeam(muzzle,aim,7,[near]),null);
});

test('original arc-ray and charged-beam ShaderMaterials are warped, not replaced by homemade laser geometry',()=>{
 for(const id of ['storm-3','prism-3']){
  const scene=new THREE.Scene(),actor=new THREE.Group();scene.add(actor);
  const start=new THREE.Vector3(.35,2.0,0);
  const native=new NumberedWeaponEffects(scene,()=>start.clone());
  const item=itemById(id),end=new THREE.Vector3(.4,2.1,-14);
  actor.userData.staffTargetPoint=end.toArray();
  actor.userData.staffAimDirection=[0,0,-1];
  actor.userData.staffStrafe=1;
  assert.equal(native.play({origin:start.toArray(),direction:[0,0,-1],range:18,
   channel:true,ultimate:true,charge:1,qualityScale:1,qualityTier:3},item,actor),true);
  const e=native.active[0];
  assert.equal(e.fx.group.userData.vfxSource,'00GameDevs');
  assert.ok(e.fx.group.userData.templeCurveShaderCount>=1);
  assert.ok(e.visualEnd.distanceTo(end)<.001,'the original authored ray ends ON the target');
  const meshes=[];e.fx.group.traverse(x=>{if(x.isMesh)meshes.push(x);});
  const patched=meshes.filter(x=>x.material?.userData?.templeCurvePatched);
  assert.ok(patched.length>=1,id+' original GLSL vertices must be curved');
  assert.ok(patched.some(x=>x.material.vertexShader.includes('templeCurvedMV(')));
  assert.ok(!meshes.some(x=>x.name==='synthetic-beam'),'no homemade beam geometry');
  const camera=new THREE.PerspectiveCamera(55,1,.1,200);
  camera.position.set(0,3,8);camera.lookAt(0,3,-12);
  native.update(.1,camera);
  assert.ok(e.curveBend>.6,'movement smoothly becomes rightward curvature');
  assert.ok(e.fx.group.userData.templeCurve.bend.value>0);
  assert.equal(e.fx.group.userData.templeCurve.length.value,14);
  assert.ok(Math.abs(e.fx.group.userData.templeCurve.bend.value)<=BEAM_CURVE_METRES);
  actor.userData.staffStrafe=-1;
  for(let n=0;n<16;n++)native.update(.05,camera);
  assert.ok(e.curveBend<-.9,id+' movement bends left without snapping original animation');
  native.dispose();
 }
});
