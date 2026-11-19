import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {weaponClass} from '../src/shared/weapon-info.js';
import {normalMeleeFootprint} from '../src/shared/melee-contact.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {animateIslandModel} from '../src/reletter/island-actors.js';
import {IslandEnemies} from '../src/island-enemies.js';
import {MonsterAttackEffects} from '../src/monster-attack-effects.js';
import {STAFF_RAISE_SECONDS,advanceStaffRaise,poseOverheadStaff} from '../src/staff-raise-pose.js';

test('accordion is close-range; ordinary strikes share pan melee contact instead of ranged score reach',()=>{
 const accordion=itemById('accordion'),pan=itemById('pan-1');
 const area=normalMeleeFootprint(accordion),panArea=normalMeleeFootprint(pan);
 assert.equal(weaponClass(accordion),'near');
 assert.ok(area.range<=panArea.range+.001);
 assert.equal(area.radius,panArea.radius);
 assert.equal(attackStats(accordion,0).range,area.range);
 assert.equal(attackStats(accordion,0).radius,area.radius);
 assert.equal(attackStats(accordion,1).range,30,'leave ultimate score-tornado reach unchanged');
 const now=80000,world=createInitialWorld(now);
 const actor={key:'musician',name:'Musician',role:'fighter',position:[75,0,0]};
 const profile=ensureProfile(world,actor.key,actor.name,'#abcdef',now);
 profile.inventory.push('accordion');profile.equipment.weapon='accordion';
 const action=applyAction(world,actor,{action:'attack',direction:[0,0,1]},{
  now:now+1000,actors:[actor],rng:()=>.5});
 assert.equal(action.attackEvent?.weapon,'accordion');
 assert.ok(action.attackEvent.range<=area.range+.001);
 assert.ok(action.attackEvent.radius<=area.radius+.001);
});

function fakeMonsterClips(includeWalk=true){
 const root=new THREE.Group(),pivot=new THREE.Group(),model=new THREE.Group();
 root.add(pivot);pivot.add(model);
 const mixer=new THREE.AnimationMixer(model),actions={};
 for(const name of ['Idle','Run','Kick','Jump',...(includeWalk?['Walk']:[])]){
  actions[name]=mixer.clipAction(new THREE.AnimationClip(name,1,[]));
 }
 root.userData={pivot,mixer,actions,clipYaw:{},materials:[],bones:{},active:null};
 return root;
}

test('uncle walks upright during beam and general movement, Kick only during freeze',()=>{
 const root=fakeMonsterClips();
 animateIslandModel(root,{moving:true,patrolling:false,skills:[]},.016,1000);
 assert.equal(root.userData.active.getClip().name,'Walk');
 animateIslandModel(root,{moving:false,skills:[{motion:'beam',phase:'active'}]},.016,1100);
 assert.equal(root.userData.active.getClip().name,'Walk');
 animateIslandModel(root,{moving:false,skills:[{motion:'freeze',phase:'active'}]},.016,1200);
 assert.equal(root.userData.active.getClip().name,'Kick');
 animateIslandModel(root,{moving:true,skills:[]},.016,1300);
 assert.equal(root.userData.active.getClip().name,'Walk');
 assert.equal(root.userData.pivot.rotation.x,0);
 const legacy=fakeMonsterClips(false);
 animateIslandModel(legacy,{moving:true,patrolling:false,skills:[]},.016,1400);
 assert.equal(legacy.userData.active.getClip().name,'Idle','never play the broken Run fallback');
});

test('monster original red beam starts at mouth bone and rises by projected 4 CSS px',()=>{
 const scene=new THREE.Scene(),effects=new MonsterAttackEffects(scene);
 const e=effects.make('beam');
 assert.equal(e.native.settings.color,'#ff2020');
 assert.equal(e.root.userData.vfxId,'pulse-beam');
 const actors=new IslandEnemies(scene),root=new THREE.Group(),pivot=new THREE.Group();
 const head=new THREE.Bone();head.position.set(0,8,0);
 root.add(pivot);pivot.add(head);root.userData={bones:{Head:head},pivot};
 const camera=new THREE.PerspectiveCamera(60,1,.1,300);
 camera.position.set(0,9,15);camera.lookAt(0,7,0);camera.updateMatrixWorld(true);
 const baseline=actors.mouthWorld(root,null,800),raised=actors.mouthWorld(root,camera,800);
 const view=baseline.clone().applyMatrix4(camera.matrixWorldInverse);
 const expected=8*Math.abs(view.z)*Math.tan(Math.PI/6)/800;
 assert.ok(Math.abs((raised.y-baseline.y)-expected)<.0001);
 const skill={motion:'beam',phase:'active',origin:[0,0,0],aim:[0,0,38],
  start:1000,end:6000,radius:4.95};
 effects.updateEntry(e,skill,2000,raised,[0,0,0]);
 assert.ok(e.native.group.visible);
 // Endpoints are supplied from the actual skinned rig in world coordinates.
 assert.ok(raised.y>baseline.y);
 e.native.dispose();e.root.removeFromParent();
});

function makeStaffRig(){
 const root=new THREE.Group(),model=new THREE.Group();root.add(model);
 const bones=new Map();
 for(const side of ['Right','Left']){
  const sign=side==='Right'?1:-1;
  const arm=new THREE.Bone(),fore=new THREE.Bone(),hand=new THREE.Bone();
  arm.name=side+'Arm';fore.name=side+'ForeArm';hand.name=side+'Hand';
  arm.position.set(sign*.32,1.58,0);
  fore.position.set(sign*.08,-.38,.08);
  hand.position.set(0,-.36,.03);
  model.add(arm);arm.add(fore);fore.add(hand);
  bones.set(arm.name,arm);bones.set(fore.name,fore);bones.set(hand.name,hand);
 }
 const blade=new THREE.Group();root.add(blade);
 root.position.set(2,0,-5);root.rotation.y=.4;
 root.userData={staffAimDirection:[0,0,1]};
 return {root,bones,blade};
}

test('staff raise is a 100ms interpolation and the grip never leaves the real right hand',()=>{
 assert.equal(STAFF_RAISE_SECONDS,.1);
 assert.ok(Math.abs(advanceStaffRaise(0,true,.04)-.4)<1e-12);
 assert.ok(Math.abs(advanceStaffRaise(.4,true,.06)-1)<1e-12);
 assert.ok(Math.abs(advanceStaffRaise(1,false,.05)-.5)<1e-12);
 for(const amount of [.2,.6,1]){
  const {root,bones,blade}=makeStaffRig(),restore=[];
  poseOverheadStaff(root,blade,bones,restore,amount);
  const hand=bones.get('RightHand').getWorldPosition(new THREE.Vector3());
  const grip=blade.getWorldPosition(new THREE.Vector3());
  assert.ok(hand.distanceTo(grip)<.00001,'right palm and staff grip must coincide mid-animation');
  assert.ok(Number.isFinite(blade.quaternion.w));
  const axis=new THREE.Vector3(0,1,0).applyQuaternion(blade.getWorldQuaternion(new THREE.Quaternion()));
  if(amount===1){
   assert.ok(axis.y>.95,'staff must remain nearly vertical at full raise');
   const left=bones.get('LeftHand').getWorldPosition(new THREE.Vector3());
   const lowerGrip=blade.localToWorld(new THREE.Vector3(0,-.15,0));
   assert.ok(left.distanceTo(lowerGrip)<.24,'left palm must stay near the same staff shaft');
  }
  assert.equal(restore.length,4,'all two-hand arm joints are restored before mixer update');
 }
});

test('lightning and prism grips sit lower than ordinary staffs but remain bone-attached',()=>{
 const heights={};
 for(const family of ['fire','lightning','beam']){
  const {root,bones,blade}=makeStaffRig(),restore=[];
  blade.userData.family=family;
  poseOverheadStaff(root,blade,bones,restore,1);
  const palm=bones.get('RightHand').getWorldPosition(new THREE.Vector3());
  const tip=blade.getWorldPosition(new THREE.Vector3());
  assert.ok(palm.distanceTo(tip)<.00001,'the lowered '+family+' staff cannot detach from its hand');
  heights[family]=tip.y;
 }
 assert.ok(heights.lightning<heights.fire-.10,'lightning wand must physically lower on the avatar');
 assert.ok(heights.beam<heights.fire-.10,'prism wand must physically lower on the avatar');
});
