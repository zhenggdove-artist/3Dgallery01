import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,validateState} from '../src/shared/temple-rules.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {chargedArea,scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {weaponQuality,forwardCastRadius} from '../src/shared/weapon-abilities.js';
import {PlayerController} from '../src/player-controller.js';

const T=1_700_000;
const fighter=(key,position)=>({key,name:key,color:'#ffffff',role:'fighter',position,admin:false});

test('every frying-pan and whip tier uses the same warning/authoritative AoE footprint',()=>{
 for(const family of ['pan','whip']){
  for(let tier=1;tier<=5;tier++){
   const weapon=itemById(family+'-'+tier),q=weaponQuality(weapon);
   const base=attackStats(weapon,1);
   const stats={...base,range:+(base.range*q.range).toFixed(2),
    radius:forwardCastRadius(weapon,q,base.radius,false)};
   scaleUltimateFootprint(stats,weapon);
   const relative=family==='pan'?.5:.4;
   assert.ok(Math.abs(stats.range-base.range*q.range*.6*relative)<.002,weapon.id);
   assert.ok(Math.abs(stats.radius-forwardCastRadius(weapon,q,base.radius,false)*.6*relative)<.002,weapon.id);
   const area=chargedArea(weapon,[75,1,0],[0,0,1],stats);
   assert.equal(area.mode,'area',weapon.id);
   assert.equal(area.radius,stats.radius,weapon.id);
  }
 }
 const token=itemById('chiang-token'),before=attackStats(token,1);
 scaleUltimateFootprint(before,token);
 assert.ok(before.radius>0,'the separate spectral-token family is not shrunk as a frying pan');
});

test('pan explosion hits all victims once, recoils onto caster for exactly 15 HP regardless of armour and shield',()=>{
 const world=createInitialWorld(T),caster=fighter('caster',[75,0,0]),
  victim=fighter('victim',[75.5,0,9]),other=fighter('other',[74.5,0,9]);
 const p=ensureProfile(world,'caster','caster','#ffffff',T);
 const v=ensureProfile(world,'victim','victim','#ffffff',T);
 const o=ensureProfile(world,'other','other','#ffffff',T);
 p.inventory.push('pan-1');p.equipment.weapon='pan-1';
 p.equipment.armor='relic-shell';p.equipment.shield='shield-9';
 p.shield={hp:80,maxHp:80,lastHit:0};
 assert.equal(applyAction(world,caster,{action:'attack',phase:'charge'},{now:T+1000}).charging,true);
 const at=T+6000;
 const released=applyAction(world,caster,{action:'attack',charge:1,direction:[0,0,1]},
  {now:at,actors:[caster,victim,other],rng:()=>.5});
 assert.equal(released.error,undefined);
 assert.equal(released.attackEvent.ultimate,true);
 assert.equal(released.attackEvent.area.mode,'area');
 const radius=released.attackEvent.area.radius;
 assert.equal(p.hp,100);
 assert.equal(v.hp,100);
 tickWorld(world,{now:at+600,actors:[caster,victim,other],activeFighters:0,rng:()=>.5});
 assert.equal(p.hp,85,'exact fixed self-damage bypasses armour, resistance and shield');
 assert.equal(p.shield.hp,80,'self blast bypasses the shield rather than depleting it');
 assert.ok(v.hp<100&&o.hp<100,'all overlapping enemies receive the blast');
 for(const target of [p,v,o]){
  assert.ok(Math.abs(target.hitReaction.knockbackDistance-radius)<.001);
  assert.ok(Math.abs(Math.hypot(target.hitReaction.vector[0],target.hitReaction.vector[2])-1)<.001);
 }
 assert.ok(p.hitReaction.vector[2]<0,'caster flies backwards away from explosion');
 assert.ok(v.hitReaction.vector[0]>0,'right-hand victim flies right');
 assert.ok(o.hitReaction.vector[0]<0,'left-hand victim flies left');
 const after={p:p.hp,v:v.hp,o:o.hp};
 tickWorld(world,{now:at+1400,actors:[caster,victim,other],activeFighters:0,rng:()=>.5});
 assert.deepEqual({p:p.hp,v:v.hp,o:o.hp},after,'single frying-pan explosion must not apply phantom repeat hits');
});

test('high-platform falls pass authoritative gravity validation, horizontal teleports do not',()=>{
 const previous={position:[75,28,0],rotation:0,animation:'fall'};
 const fall={position:[75,18,0],rotation:0,animation:'fall'};
 assert.equal(validateState(previous,fall,250,'fighter').error,undefined);
 const teleport={position:[90,28,0],rotation:0,animation:'run'};
 assert.equal(validateState(previous,teleport,50,'fighter').error,'Movement rejected');
});

test('stepping across a circular edge preserves momentum and reaches the ground',()=>{
 const c=Object.create(PlayerController.prototype);
 c.root=new THREE.Group();c.root.position.set(1.8,5,0);
 c.arena={groundHeight:x=>x<2?5:0,blocked:()=>false};
 Object.assign(c,{enabled:true,grounded:true,velocityY:0,walkOffMomentum:false,
  jumpVelocity:new THREE.Vector3(),direction:new THREE.Vector3(),
  move:new THREE.Vector2(1,0),keys:new Set(),yaw:0,seat:0,
  status:{},stats:{speed:1,jump:1,gravity:1},speed:8.64,castMoveFactor:1});
 c.updateCamera=()=>{};c.state=()=>({});
 c.update(.1);
 assert.equal(c.grounded,false,'walk-off must begin free fall, not invisible side collision');
 assert.ok(c.jumpVelocity.x>0,'walk-off must keep horizontal momentum');
 let previousX=c.root.position.x;
 c.update(.1);
 assert.ok(c.root.position.x>previousX,'airborne character must continue moving beyond edge');
 for(let i=0;i<35;i++)c.update(.05);
 assert.equal(c.grounded,true,'free-falling actor lands below deck');
 assert.ok(Math.abs(c.root.position.y)<.0001,'actor must not snap upward onto deck rim');
});
