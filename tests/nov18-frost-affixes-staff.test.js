import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInitialWorld,ensureProfile,tickWorld} from '../src/shared/temple-rules.js';
import {playerStats} from '../src/shared/player-stats.js';
import {fuseTemple} from '../src/shared/temple-fusion.js';
import {itemById} from '../src/shared/catalog.js';
import {weaponPresentation} from '../src/shared/weapon-presentation.js';
import {NumberedWeaponEffects,ultimateWorldScale} from '../src/numbered-weapon-effects.js';
import {MonsterAttackEffects} from '../src/monster-attack-effects.js';

test('one monster frost hit slows a fighter 80% for exactly 2000ms, never immobilises them',()=>{
 const now=160000,world=createInitialWorld(now);
 const actor={key:'frozen-player',name:'Target',role:'fighter',position:[75,0,25]};
 const profile=ensureProfile(world,actor.key,actor.name,'#aabbcc',now);
 const normalSpeed=playerStats(world,profile,now).speed;
 world.monster={active:true,id:'frost-monster',model:'uncle',position:[75,0,24],
  skills:[{id:'ice',motion:'freeze',phase:'active',origin:[75,0,24],aim:[75,0,25],
   start:now-100,end:now+5100,hit:[],lastTick:{},damage:8}],
  nextAttackAt:now+9000,hp:100,maxHp:100};
 tickWorld(world,{now,actors:[actor],activeFighters:0,rng:()=>.5});
 assert.equal(profile.effects?.slow?.power,.8);
 assert.equal(profile.effects?.slow?.until,now+2000);
 assert.equal(profile.effects?.freeze,undefined);
 assert.ok(Math.abs(playerStats(world,profile,now+1).speed-normalSpeed*.2)<.00001);
 assert.ok(Math.abs(playerStats(world,profile,now+2000).speed-normalSpeed)<.00001);
});

test('fusion inherits every distinct weapon affix as a composite name and live stats',()=>{
 const now=10000,world=createInitialWorld(now),profile=ensureProfile(world,'alchemist','Alchemist','#aaeecc',now,true);
 profile.inventory.push('ember-1','frost-1');
 profile.equipment.weapon='ember-1';
 profile.fusion['ember-1']={original:{affixId:'brutal',affixIds:['brutal']}};
 profile.fusion['frost-1']={original:{affixId:'stalwart',affixIds:['stalwart']}};
 const result=fuseTemple(world,profile,{sourceId:'frost-1',targetId:'ember-1',requestId:'merge-affix-001'});
 assert.equal(result.fusion.success,true);
 assert.deepEqual(profile.fusion['ember-1'].affixIds,['brutal','stalwart']);
 const visual=weaponPresentation(itemById('ember-1'),profile.fusion['ember-1']);
 assert.ok(visual.title.startsWith('殘暴堅韌的 '),visual.title);
 assert.ok(visual.traits.some(x=>x.name==='殘暴的'));
 assert.ok(visual.traits.some(x=>x.name==='堅韌的'));
 assert.ok(playerStats(world,profile,now).defense<.8,'stalwart defense is inherited by game stats');
});

test('native #53 flyswatter size follows warning radius at every quality',()=>{
 for(const radius of [2,4,8,12]){
  const nativeSize=Math.min(2,Math.max(.2,radius/4.5));
  const worldScale=ultimateWorldScale(53,{ultimate:true,area:{radius}},{size:radius/4.5});
  assert.ok(Math.abs(worldScale*4.5*nativeSize-radius)<1e-6);
 }
});

test('monsters use byte-exact ground-freeze-study native VFX with one frozen circle',()=>{
 const effects=new MonsterAttackEffects(new THREE.Scene());
 const entry=effects.make('freeze');
 assert.equal(entry.root.userData.vfxId,'ground-freeze-study');
 assert.ok(entry.native?.group?.isObject3D);
 const s={motion:'freeze',phase:'active',origin:[0,0,0],aim:[2,0,4],radius:5.2,start:1000,end:6200};
 effects.updateEntry(entry,s,1200);
 assert.ok(Math.abs(entry.native.group.position.x-2)<.01);
 assert.ok(Math.abs(entry.native.group.scale.x-5.2/2.8)<.01);
 entry.native.dispose();entry.root.removeFromParent();
});
