import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,worldView,isLiveStaffChannel} from '../src/shared/temple-rules.js';
import {attackStats,itemById} from '../src/shared/catalog.js';
import {scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {rebaseRejectedPose,keepPredictedMoveOnLatencyReject} from '../src/shared/state-reconciliation.js';
import * as THREE from 'three';
import {curvePoint} from '../src/native-beam-curve.js';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import {GOLDFISH_SWIM_MS} from '../src/shared/weapon-abilities.js';
import {advanceHomingVortex,vortexSpinPoint,VORTEX_DAMAGE_INTERVAL_MS,VORTEX_SPIN_LOCK_MS} from '../src/shared/vortex-flight.js';
const NOW=3200000;
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function cast(weapon,monsterZ=10){
 const world=createInitialWorld(NOW),actor={key:'tester',name:'tester',role:'fighter',color:'#aabbcc',position:[65,0,0],seat:0};
 const profile=ensureProfile(world,actor.key,actor.name,actor.color,NOW);
 profile.inventory.push(weapon);
 profile.equipment.weapon=weapon;
 world.monster={id:'vortex-test-mob',active:true,model:'uncle',variant:'uncle',
  position:[65,0,monsterZ],hp:10000,maxHp:10000,skills:[],nextAttackAt:NOW+100000};
 const attack=(at,rest={})=>applyAction(world,actor,{action:'attack',direction:[0,0,1],...rest},
  {now:at,actors:[actor],rng:()=>.5});
 assert.equal(attack(NOW+1000,{phase:'charge'}).charging,true);
 const result=attack(NOW+3700,{charge:1});
 assert.equal(result?.error,undefined);
 assert.ok(result.attackEvent?.ultimate);
 return {world,actor,profile,result,start:NOW+3700};
}
test('late acknowledgement can replay several real strides without teleporting backwards',()=>{
 assert.deepEqual(rebaseRejectedPose([8,0,0],[9,0,0],[14,0,0]),[13,0,0]);
 const net=source('src/network.js'),main=source('src/main.js');
 assert.match(net,/data\.submitted=\[\.\.\.this\.sentStates\.get\(seq\)\.position\]/);
 assert.match(main,/rebaseRejectedPose\(ack\.position,ack\.submitted/);
 assert.match(main,/const goldfishUltimate=item\.id==='goldfish'/);
 assert.match(main,/goldfishUltimate\?cameraAimDirection\(camera\)/);
});
test('goldfish water projectiles are deep blue without recoloring the giant red fish',()=>{
 const signature=source('src/weapon-signature-effects.js');
 assert.match(signature,/color:'#063276'/);
 assert.match(signature,/emissive:'#041b5d'/);
 assert.match(signature,/const dorsal=new THREE.Color\('#e85c32'/);
  assert.match(signature,/bodyGeo\.setAttribute\('color'/);
});
test('wave conch charged range is exactly three times the previous server/client footprint',()=>{
 const item=itemById('nova-1');
 const base=attackStats(item,1),stats=scaleUltimateFootprint({...base},item);
 assert.ok(item);
 assert.equal(stats.range,Number((base.range*.6*3).toFixed(3)));
});
test('server vortex homes, damages on contact and imposes a 2s spin on a 5s debuff lock',()=>{
 const {world,actor,result,start}=cast('nova-1');
 const fx=world.persistentAttacks.find(v=>v.kind==='vortex');
 assert.ok(fx);
 assert.equal(result.attackEvent.persistentAttackId,fx.id);
 assert.equal(result.attackEvent.area,null);
 const hp=world.monster.hp;
 tickWorld(world,{now:start+500,actors:[actor],activeFighters:0,rng:()=>.5});
 assert.ok(world.monster.hp<hp,'vortex should damage the contacted target');
 assert.ok(world.monster.vortexSpin,'contact causes an authoritative two-second spin');
 assert.equal(world.monster.vortexSpinCooldownUntil,start+500+VORTEX_SPIN_LOCK_MS);
 assert.ok(worldView(world,actor.key,start+500).vortexes.some(v=>v.id===fx.id));
 const firstHit=fx.hitTimes[world.monster.id];
 assert.equal(firstHit,start+500+VORTEX_DAMAGE_INTERVAL_MS);
 const post=world.monster.hp;
 tickWorld(world,{now:start+650,actors:[actor],activeFighters:0,rng:()=>.5});
 assert.equal(world.monster.hp,post,'damage cannot tick more often than 500ms');
});
test('homing steering preserves travel budget and spin path orbits toward center',()=>{
 const fx={origin:[0,1,0],position:[0,1,0],direction:[0,0,1],range:30,travelled:0};
 advanceHomingVortex(fx,{position:[15,0,12]},420);
 assert.ok(fx.position[0]>0,'rotates toward a target off the initial line');
 assert.ok(fx.position[2]>0);
 for(let i=0;i<15;i++)advanceHomingVortex(fx,{position:[15,0,12]},420);
 assert.ok(fx.travelled<=30+1e-9,'homing cannot exceed the original travel range');
 const spin={time:1000,start:[2,0,0],center:[0,0]};
 const a=vortexSpinPoint(spin,1000),b=vortexSpinPoint(spin,2000);
 assert.ok(a[0]>b[0]);
 assert.ok(Math.hypot(b[0],b[2])<Math.hypot(a[0],a[2]));
});
test('returning giraffe has separate building collision histories on both legs',()=>{
 const {world,actor,start}=cast('giraffe',60);
 world.monster.active=false;
 world.structures.push({id:'test-structure',kind:'house',owner:'tester',position:[65,0,10],hp:10000,maxHp:10000});
 const fx=world.persistentAttacks.find(v=>v.kind==='giraffe');
 assert.ok(fx);
 tickWorld(world,{now:start+690,actors:[actor],activeFighters:0,rng:()=>.5});
 const house=world.structures.find(v=>v.id==='test-structure');
 assert.ok(fx.structureOutHitIds?.includes('test-structure'),'outbound hit was registered');
 const first=house.hp;
 tickWorld(world,{now:start+2280,actors:[actor],activeFighters:0,rng:()=>.5});
 assert.ok(fx.structureBackHitIds?.includes('test-structure'),'return path must strike the same house');
 assert.ok(house.hp<first,'return must apply additional building damage');
});

test('bounded latency rejection keeps recent valid walking poses without bypassing walls',()=>{
 assert.equal(keepPredictedMoveOnLatencyReject('Movement rejected',[0,0,0],[2,0,0],[4,0,0]),true);
 assert.equal(keepPredictedMoveOnLatencyReject('Movement rejected',[0,0,0],[2,0,0],[4,0,0],x=>x>3),false);
 assert.equal(keepPredictedMoveOnLatencyReject('Building collision',[0,0,0],[2,0,0],[4,0,0]),false);
 assert.equal(keepPredictedMoveOnLatencyReject('Invalid position',[0,0,0],[2,0,0],[4,0,0]),false);
 assert.equal(keepPredictedMoveOnLatencyReject('Movement rejected',[0,0,0],[2,0,0],[50,0,0]),false);
 assert.match(source('src/main.js'),/keepPredictedMoveOnLatencyReject\(rejection\.error/);
});
test('prism casts a smooth signed S-curve, never a semicircular middle bulge',()=>{
 const a=new THREE.Vector3(0,2,0),b=new THREE.Vector3(0,3,-20);
 const start=curvePoint(a,b,2.5,0,'s'),middle=curvePoint(a,b,2.5,.5,'s');
 const early=curvePoint(a,b,2.5,.27,'s'),late=curvePoint(a,b,2.5,.73,'s');
 assert.ok(start.distanceTo(a)<1e-9);
 assert.ok(middle.distanceTo(a.clone().lerp(b,.5))<1e-9,'the middle must be an inflection, not a bulge');
 assert.ok(early.x*late.x<0,'curvature crosses the straight muzzle-to-target chord');
 assert.ok(curvePoint(a,b,2.5,1,'s').distanceTo(b)<1e-9);
 assert.match(source('src/numbered-weapon-effects.js'),/entry\.item\?\.family==='beam'\?'s':'bow'/);
});
test('goldfish giant ultimate triples ONLY reach and damage, retaining hitbox width and doubling swimming speed',()=>{
 const item=itemById('goldfish'),basic=attackStats(item,0),charged=attackStats(item,1);
 assert.equal(charged.damage,item.chargeDamage*3);
 assert.equal(basic.damage,item.damage);
 const size=scaleUltimateFootprint({...charged},item);
 assert.ok(Math.abs(size.range-charged.range*.6*3)<.001);
 assert.ok(Math.abs(size.radius-charged.radius*.6)<.001);
 assert.equal(GOLDFISH_SWIM_MS,2400);
});
test('goldfish seeks off-axis target from elevated swimming position and syncs visual position',()=>{
 const {world,actor,result,start}=cast('goldfish',12);
 const fx=world.persistentAttacks.find(f=>f.kind==='goldfish');
 assert.ok(fx);
 assert.ok(fx.origin[1]>3,'giant fish no longer starts half below the water');
 assert.equal(result.attackEvent.origin[1],fx.origin[1],'visual and server start at identical height');
 world.monster.position=[73,0,11];
 const before=world.monster.hp;
 tickWorld(world,{now:start+700,actors:[actor],rng:()=>.5,activeFighters:0});
 assert.ok(fx.position[0]>65,'fish homed toward an off-center enemy');
 assert.ok(fx.direction[0]>0,'server track turned rather than continuing a fixed ray');
 assert.ok(worldView(world,actor.key,start+700).goldfishFlights.some(v=>v.id===fx.id));
 const effects=new WeaponSignatureEffects(new THREE.Scene());
 assert.equal(effects.play(result.attackEvent,itemById('goldfish')),true);
 effects.update(.08,worldView(world,actor.key,start+700));
 const visual=effects.active.at(-1).obj;
 assert.ok(Math.abs(visual.position.y-fx.position[1])<Math.abs(fx.origin[1]-fx.position[1])+1e-6,'visual converges toward authoritative swim height');
 const fish=visual.userData.fish;
 const mats=[];fish.traverse(node=>{if(node.material)mats.push(node.material);});
 assert.ok(mats.some(mat=>mat.opacity===.30),'translucent VHS goldfish have increased transparency');
 assert.ok(mats.some(mat=>mat.vertexColors),'goldfish body receives a real dorsal-to-belly gradient');
 effects.dispose();
});
test('White Cat charged shots retain physical muzzle and reticle endpoints',()=>{
 const src=source('src/weapon-vfx.js');
 assert.match(src,/if\(data\.ultimate&&Array\.isArray\(impactArea\?\.visualCenter\)&&!item\.firstPerson\)/,
  'ground AoE center must never override White Cat gun reticle target');
 const gun=source('src/gun-controller.js');
 assert.match(gun,/weaponMuzzle\(c\.root,this\.weapon\(\)\)/);
 assert.match(gun,/direction:point\.clone\(\)\.sub\(origin\)\.normalize\(\)\.toArray\(\)/);
});

test('lost channel-stop cannot permanently freeze ordinary server movement to 5% speed',()=>{
 const w=createInitialWorld(NOW),p=ensureProfile(w,'channel-test','Channel','#ffffff',NOW);
 p.equipment.weapon='nova-1';p.channelWeapon='nova-1';p.channelStartedAt=NOW;p.lastChannelPulseAt=NOW;
 assert.equal(isLiveStaffChannel(p,NOW+200),true);
 assert.equal(isLiveStaffChannel(p,NOW+6000),false);
 tickWorld(w,{now:NOW+6000,actors:[],activeFighters:0,rng:()=>.5});
 assert.equal(p.channelWeapon,null,'abandoned staff casting is cleared server-side');
 assert.match(source('cloudflare/worker.js'),/channeling:isLiveStaffChannel\(profile,now\)/);
});
