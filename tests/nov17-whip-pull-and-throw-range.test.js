import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';
import {artworkPosition,artworkLanding} from '../src/shared/artwork-flight.js';
import {WHIP_PULL_SPEED,whipPullDurationMs} from '../src/shared/weapon-abilities.js';
import {ultimateWorldScale} from '../src/numbered-weapon-effects.js';
import {PlayerController} from '../src/player-controller.js';

const T=5_300_000;
const fighter=(key,position)=>({key,name:key,color:'#ffffff',role:'fighter',position,admin:false});

test('artwork has fivefold horizontal reach with unchanged vertical ballistic arc',()=>{
 const shot={origin:[0,1.4,0],direction:[0,0,1],power:1};
 const p=artworkPosition(shot,.6);
 assert.ok(Math.abs(p[2]-30)<1e-8,'30 metres forward at 0.6s, previously 6m');
 assert.ok(Math.abs(p[1]-(1.4+6*.6-4.9*.6*.6))<1e-8);
 const landing=artworkLanding(shot,()=>0);
 assert.ok(landing.position[2]>65&&landing.position[2]<75);
 const world=createInitialWorld(T),caster=fighter('caster',[45,0,0]),victim=fighter('victim',[45,0,45]);
 ensureProfile(world,'caster','caster','#ffffff',T);
 ensureProfile(world,'victim','victim','#ffffff',T);
 world.artworks[Object.keys(world.artworks)[0]].holder='caster';
 const result=applyAction(world,caster,{action:'throw-artwork',direction:[0,0,1],power:1},
  {now:T+1000,actors:[caster,victim],rng:()=>.5});
 assert.equal(result.error,undefined);
 assert.equal(result.hit?.target,'victim','server hit range tracks longer ordinary artwork flight');
});

test('whip applies all quality-based pull durations on server-confirmed contact',()=>{
 for(let tier=1;tier<=5;tier++){
  const now=T+tier*15_000,world=createInitialWorld(now);
  const caster=fighter('caster',[75,0,0]),victim=fighter('victim',[75,0,3]);
  const source=ensureProfile(world,'caster','caster','#ffffff',now);
  const target=ensureProfile(world,'victim','victim','#ffffff',now);
  const weaponId='whip-'+tier;
  source.inventory.push(weaponId);source.equipment.weapon=weaponId;
  assert.equal(applyAction(world,caster,{action:'attack',phase:'charge'},{now:now+1000}).charging,true);
  const at=now+6000;
  const attack=applyAction(world,caster,{action:'attack',direction:[0,0,1],charge:1},
   {now:at,actors:[caster,victim],rng:()=>.5});
  assert.equal(attack.error,undefined,weaponId);
  const center=attack.attackEvent.area.center;
  victim.position=[center[0]+.2,center[1]-.12,center[2]];
  tickWorld(world,{now:at+650,actors:[caster,victim],activeFighters:0,rng:()=>.5});
  assert.ok(target.hitReaction?.whipPull,weaponId+' actually pulls target: '+JSON.stringify({area:attack.attackEvent.area,attacks:world.persistentAttacks,position:victim.position,hp:target.hp,reaction:target.hitReaction}));
  assert.equal(target.hitReaction.whipPull.durationMs,whipPullDurationMs(tier),weaponId);
  assert.equal(target.hitReaction.whipPull.speed,WHIP_PULL_SPEED);
  assert.deepEqual(target.hitReaction.whipPull.center,[center[0],center[2]]);
  assert.equal(target.hitReaction.stunMs,0,'pull allows steering immediately');
 }
});

test('whip uses 1.5x larger collision circle without enlarging original #48 VFX',()=>{
 for(const previousRadius of [1,2.4,5,8]){
  const newRadius=previousRadius*1.5;
  const previousSize=Math.max(.25,Math.min(3.5,(previousRadius/.2)/4.5));
  const legacyScale=.2*Math.max(2,Math.min(12,
   (previousRadius/.2)/Math.max(.25,previousSize*.8)));
  const actual=ultimateWorldScale(48,{ultimate:true,area:{radius:newRadius}},
   {size:previousSize});
  assert.ok(Math.abs(actual-legacyScale)<1e-8,'authored black-hole visual footprint stays unchanged');
 }
});

test('whip pulls a still player at exactly half base walk speed, but outward movement resists',()=>{
 const makeController=()=>{
  const c=Object.create(PlayerController.prototype);
  c.root=new THREE.Group();c.root.position.set(20,0,0);
  c.arena={groundHeight:()=>0,blocked:()=>false};
  Object.assign(c,{enabled:true,grounded:true,velocityY:0,walkOffMomentum:false,
   jumpVelocity:new THREE.Vector3(),direction:new THREE.Vector3(),move:new THREE.Vector2(),
   keys:new Set(),yaw:0,seat:0,role:'fighter',status:{},
   stats:{speed:1,jump:1,gravity:1},speed:8.64,castMoveFactor:1,stunUntil:0});
  c.updateCamera=()=>{};c.state=()=>({});
  assert.equal(c.beginWhipPull({center:[0,0],durationMs:400,speed:WHIP_PULL_SPEED}),true);
  return c;
 };
 const passive=makeController();
 passive.update(.1);
 assert.ok(Math.abs(passive.root.position.x-(20-WHIP_PULL_SPEED*.1))<1e-8);
 passive.update(.1);passive.update(.1);passive.update(.1);
 assert.equal(passive.whipPull,null);
 assert.ok(Math.abs(passive.root.position.x-(20-WHIP_PULL_SPEED*.4))<1e-8);
 const resisting=makeController();resisting.keys.add('KeyD');
 resisting.update(.1);
 assert.ok(resisting.root.position.x>20,'walk speed exceeds inward 50%-speed suction');
 assert.ok(Math.abs(resisting.root.position.x-(20+(8.64-WHIP_PULL_SPEED)*.1))<1e-8);
});
