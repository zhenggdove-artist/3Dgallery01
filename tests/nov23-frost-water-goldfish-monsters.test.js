import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WeaponVFX,effectFor} from '../src/weapon-vfx.js';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import {MONSTER_PACK_SIZE,spawnMonsterPack} from '../src/shared/monster-pack.js';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';
import {itemById} from '../src/shared/catalog.js';
import {channelInterval,ICE_FREEZE_INTERVAL_MS} from '../src/shared/weapon-abilities.js';
import {applyElementalHit} from '../src/shared/combat-status.js';

test('ten independently authoritative monster slots replace five, without changing T1 monster damage',()=>{
 const world=createInitialWorld(50000);
 assert.equal(MONSTER_PACK_SIZE,10);
 assert.equal(spawnMonsterPack(world,50000,()=>.5),true);
 assert.equal(world.monsters.length,10);
 assert.ok(world.monsters.every(m=>m.active&&m.id));
 assert.equal(new Set(world.monsters.map(m=>m.id)).size,10);
 assert.equal(world.monsters[0].damage,world.monsters[5].damage);
 assert.equal(world.monsters[4].maxHp,world.monsters[9].maxHp);
});

test('native blue Venom Stream is pooled per held tide staff and replaces old spray',()=>{
 const scene=new THREE.Scene(),vfx=new WeaponVFX(scene);
 const root=new THREE.Group();scene.add(root);root.userData.staffAimDirection=[0,0,1];
 const item=itemById('tide-1');
 const event={owner:'water-user',origin:[0,1,0],direction:[0,0,1],range:12,
   radius:1.05,charge:1,ultimate:true,channel:true,time:1234};
 assert.equal(effectFor(item,true),'venom-stream');
 vfx.play(event,item,root);
 assert.equal(vfx.waterStreams.size,1);
 const entry=[...vfx.waterStreams.values()][0];
 assert.equal(entry.id,'venom-stream');
 assert.equal(entry.fx.settings.color,'#2d9fff');
 assert.ok(entry.fx.group.userData.vfxSource==='00GameDevs');
 vfx.play({...event,time:1300},item,root);
 assert.equal([...vfx.waterStreams.values()][0],entry,'new pulses must not create another stream');
 vfx.update(.1,null,null);
 assert.ok(entry.fx.group.visible,'emitter follows the actual weapon');
 assert.equal(entry.waterParticles.geometry.attributes.position.count,128);
 const positions=entry.waterParticles.geometry.attributes.position;
 assert.ok(Number.isFinite(positions.getZ(17))&&positions.getZ(17)!==0,
  'water ultimate always renders moving blue Venom slugs, even when native shader fails');
 vfx.stopChannel(root);
 assert.equal(vfx.waterStreams.size,0);
 vfx.dispose();
});

test('ice ultimate is release-only and damage recasts are not delayed by freeze immunity',()=>{
 const T=500000,world=createInitialWorld(T);
 const actor={key:'frost-caster',name:'Frost',color:'#ffffff',role:'fighter',position:[75,0,0]};
 const profile=ensureProfile(world,actor.key,actor.name,actor.color,T);
 profile.inventory.push('frost-1');profile.equipment.weapon='frost-1';
 const item=itemById('frost-1');
 assert.equal(ICE_FREEZE_INTERVAL_MS,6000);
 assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},{now:T+1000}).charging,true);
 const first=T+1000+item.chargeMs+25;
 assert.match(applyAction(world,actor,{action:'attack',phase:'channel-start'},{now:first}).error,/release/);
 const cast=applyAction(world,actor,{action:'attack',direction:[0,0,1],charge:1},
  {now:first,actors:[actor],rng:()=>.5});
 assert.equal(cast.attackEvent?.ultimate,true);
 assert.equal(cast.attackEvent?.channel,false);
 assert.equal(cast.attackEvent?.area?.mode,'area');
 assert.ok(cast.attackEvent.area.visualCenter[2]>actor.position[2]+5);
 assert.ok(cast.attackEvent.area.radius>0);
 assert.equal(world.persistentAttacks.at(-1)?.iceGround,true);
 const secondStart=first+item.cooldown+50;
 assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},{now:secondStart}).charging,true);
 const ready=applyAction(world,actor,{action:'attack',direction:[0,0,1],charge:1},
  {now:secondStart+item.chargeMs+25,actors:[actor],rng:()=>.5});
 assert.equal(ready.attackEvent?.ultimate,true,'6 seconds locks freeze, never the ice damage spell');
});

test('frost status is exactly 3000ms long, with 6000ms reapplication lock',()=>{
 const target={hp:100,maxHp:100,effects:{},effectLocks:{}};
 const source={key:'frost'};
 assert.equal(applyElementalHit(target,source,itemById('frost-1'),100000),'freeze');
 assert.equal(target.effects.freeze.until,103000);
 assert.equal(applyElementalHit(target,source,itemById('frost-1'),105999),'slow');
 assert.equal(target.effects.slow.power,.3);
 assert.equal(applyElementalHit(target,source,itemById('frost-1'),106000),'freeze');
 assert.equal(target.effects.freeze.until,109000);
});

test('original Ice Shatter appears sequentially at server-owned ground positions',()=>{
 const scene=new THREE.Scene(),vfx=new WeaponVFX(scene),root=new THREE.Group();
 const area={mode:'area',shape:'ice-line',center:[1,.12,12],visualCenter:[1,.16,12],radius:3.9,travel:20,range:20,spacing:20,forward:[0,1],segments:[{position:[1,.16,0],delayMs:0},{position:[1,.16,20],delayMs:1260}]};
 vfx.play({origin:[0,1,0],direction:[0,0,1],area,range:20,
  charge:1,ultimate:true,channel:true,owner:'frost',qualityScale:1},itemById('frost-1'),root);
 const ice=vfx.active.find(e=>e.id==='ice-shatter');
 assert.ok(ice);
 assert.equal(ice.fx.group.position.x,1);
 assert.equal(ice.fx.group.position.z,0);
 assert.equal(vfx.active.filter(e=>e.id==='ice-shatter').length,1);
 vfx.advanceIceEruptions(1.26);assert.ok(vfx.active.some(e=>e.id==='ice-shatter'&&e.fx.group.position.z===20));
 assert.equal(vfx.numberedEffects.active.length,0,'retired travelling native ice-lance must not play');
 vfx.dispose();
});

test('all thirty goldfish tails become one blue instanced particle cloud, tracking consumption',()=>{
 const scene=new THREE.Scene(),visual=new WeaponSignatureEffects(scene);
 const event={origin:[0,2,0],direction:[0,0,1],qualityScale:1,
  qualityDuration:1,ultimate:true,range:24,persistentAttackId:'fishcast'};
 visual.goldfish(event);
 assert.equal(visual.active.length,1);
 const group=visual.active[0].obj;
 const tail=group.userData.tailParticles;
 assert.ok(tail?.cloud?.isPoints);
 assert.equal(tail.cloud.geometry.getAttribute('position').count,30*16);
 assert.ok(group.userData.schoolParts.every(p=>p.mesh.material.opacity===.30));
 assert.equal(tail.cloud.material.opacity,.435);
 assert.ok(group.userData.schoolParts.every(p=>!p.tailPart),
  'solid orange tail geometry must not be instanced');
 visual.update(.04,{goldfishFlights:[{id:'fishcast',position:[0,2,0],consumed:[0],direction:[0,0,1]}]});
 const position=tail.cloud.geometry.getAttribute('position');
 assert.equal(position.getX(0),1e5,'consumed fish cannot leave orphan particles');
 assert.ok(Number.isFinite(position.getX(16))&&position.getX(16)!==1e5);
 visual.dispose();
});
