import {skillGradeScale} from '../src/shared/equipment-tuning.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';
import {artworkPosition,artworkLanding} from '../src/shared/artwork-flight.js';
import {visibleCollisionLifetimeMs} from '../src/shared/combat-balance.js';
import {itemById} from '../src/shared/catalog.js';
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
 assert.equal(result.hit,undefined,'no early damage when the artwork is launched');
 const victimHp=world.profiles.victim.hp;
 assert.equal(victimHp,world.profiles.victim.maxHp);
 tickWorld(world,{now:T+1300,actors:[caster,victim],activeFighters:0,rng:()=>.5});
 assert.equal(world.profiles.victim.hp,victimHp,'not yet at target');
 tickWorld(world,{now:T+1960,actors:[caster,victim],activeFighters:0,rng:()=>.5});
 assert.ok(world.profiles.victim.hp<victimHp,'impact is applied when projectile reaches victim');
});

test('native pan/whip authoritative damage lifetime matches the visible original animation',()=>{
 for(let tier=1;tier<=5;tier++){
  assert.equal(visibleCollisionLifetimeMs(itemById('pan-'+tier),true),5000);
  assert.equal(visibleCollisionLifetimeMs(itemById('whip-'+tier),true),6500);
 }
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
  assert.equal(target.hitReaction.whipPull.durationMs,Math.round(whipPullDurationMs(tier)*skillGradeScale({slot:'weapon',tier})),weaponId);
  assert.equal(target.hitReaction.whipPull.speed,WHIP_PULL_SPEED*skillGradeScale({slot:'weapon',tier}));
  assert.deepEqual(target.hitReaction.whipPull.center,[center[0],center[2]]);
  assert.equal(target.hitReaction.stunMs,0,'pull allows steering immediately');
  assert.equal(target.effects?.root,undefined,'no root may prevent resisting the suction');
  const initialPullId=target.whipPull.id;
  tickWorld(world,{now:at+3000,actors:[caster,victim],activeFighters:0,rng:()=>.5});
  assert.equal(target.whipPull.id,initialPullId,'repeat weapon damage does not prolong the initial suction');
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


test('whip ultimate pulls both the boss and the five-monster pack toward its centre once per cast',()=>{
 for(const tier of [1,3,5]){
  const now=T+100_000+tier*20_000,world=createInitialWorld(now);
  const caster=fighter('caster',[75,0,0]);
  const profile=ensureProfile(world,'caster','caster','#ffffff',now);
  profile.inventory.push('whip-'+tier);profile.equipment.weapon='whip-'+tier;
  world.monster={active:true,id:'boss',generation:1,model:'uncle',variant:'warden',
   position:[75,0,9],hp:10000,maxHp:10000,nextAttackAt:now+100000};
  world.monsters=[{active:true,id:'minion',slot:0,model:'uncle',variant:'uncle',generation:1,
   position:[75,0,9],hp:10000,maxHp:10000,nextAttackAt:now+100000}];
  assert.equal(applyAction(world,caster,{action:'attack',phase:'charge'},{now:now+1000}).charging,true);
  const at=now+6000,shot=applyAction(world,caster,
   {action:'attack',direction:[0,0,1],charge:1},
   {now:at,actors:[caster],rng:()=>.5});
  assert.equal(shot.error,undefined);
  const [cx,,cz]=shot.attackEvent.area.center;
  world.monster.position=[cx+.6,0,cz];
  world.monsters[0].position=[cx-.6,0,cz];
  tickWorld(world,{now:at+650,actors:[caster],activeFighters:1,rng:()=>.5});
  const victims=[world.monster,world.monsters[0]];
  for(const monster of victims){
   assert.ok(monster.whipPull,'monster must gain a server-owned suction window');
   assert.equal(monster.whipPull.durationMs,Math.round(whipPullDurationMs(tier)*skillGradeScale({slot:'weapon',tier})));
   assert.equal(monster.whipPull.speed,WHIP_PULL_SPEED*skillGradeScale({slot:'weapon',tier}));
   assert.deepEqual(monster.whipPull.center,[cx,cz]);
  }
  const started=victims.map(monster=>monster.whipPull.id);
  const before=victims.map(monster=>Math.hypot(monster.position[0]-cx,monster.position[2]-cz));
  tickWorld(world,{now:at+750,actors:[caster],activeFighters:1,rng:()=>.5});
  for(let i=0;i<victims.length;i++){
   const monster=victims[i];
   assert.ok(Math.hypot(monster.position[0]-cx,monster.position[2]-cz)<before[i],
    'boss and pack members move visibly inward during the same timed vortex');
   assert.equal(monster.whipPull?.id,started[i],'continued contact cannot refresh suction');
  }
  tickWorld(world,{now:at+2500,actors:[caster],activeFighters:1,rng:()=>.5});
  assert.equal(world.monster.whipPull,undefined);
  assert.equal(world.monsters[0].whipPull,undefined);
  const fx=world.persistentAttacks.find(f=>f.weapon==='whip-'+tier);
  assert.ok(fx.pullHits?.includes('boss')&&fx.pullHits?.includes('minion'));
 }
});
