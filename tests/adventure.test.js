import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,createInitialWorld,ensureProfile,worldView} from '../src/shared/temple-rules.js';
import {EQUIPMENT} from '../src/reletter/equipment-catalog.js';
import {ITEMS,EQUIPPABLE_SLOTS} from '../src/shared/catalog.js';
import {SEEDS} from '../src/reletter/garden-catalog.js';
const setup=()=>{const world=createInitialWorld(1000),actor={key:'tester',name:'Test',role:'fighter',position:[-5,0,-12]},profile=ensureProfile(world,actor.key,actor.name,null,1000);return {world,actor,profile};};
test('Garden seeds, watering, harvesting and crops are retired from Temple',()=>{
 const {world,actor,profile}=setup();profile.inventory.push(SEEDS[0].id);
 for(const action of ['seed-plant','crop-water','crop-harvest','harvest-eat']){
  assert.equal(applyAction(world,actor,{action,item:SEEDS[0].id,position:actor.position},{now:10000}).error,'Unknown action',action);
 }
 assert.ok(!ITEMS.some(item=>['seed','harvest'].includes(item.slot)));
 assert.equal(worldView(JSON.parse(JSON.stringify(world)),actor.key,10000).reletter.garden,undefined);
});
test('FISH gameplay and fishing inventory no longer exist',()=>{
 const {world,actor}=setup();
 assert.ok(!ITEMS.some(item=>['rod','tool','pond'].includes(item.slot)));
 assert.ok(!EQUIPPABLE_SLOTS.some(slot=>['rod','tool','pond'].includes(slot)));
 assert.equal('fishing' in worldView(world,actor.key).reletter,false);
 for(const action of ['fish','cast','hook','reel','pond-build','sell-fish']){
  const result=applyAction(world,actor,{action},{now:12000});
  assert.equal(result.error,'Unknown action',action);
 }
});
test('original fusion preserves two source effects and authoritative stats',()=>{
 const {world,actor,profile}=setup();const weapons=EQUIPMENT.filter(i=>i.slot==='weapon'&&i.family==='saber').slice(0,3);profile.inventory.push(...weapons.map(i=>i.id));profile.equipment.weapon=null;profile.wallet=100000;
 for(const source of weapons.slice(0,2)){const r=applyAction(world,actor,{action:'fuse',sourceId:source.id,targetId:weapons[2].id,requestId:crypto.randomUUID()},{now:Date.now(),rng:()=>0});assert.ok(!r.error,r.error);assert.ok(r.fusion.success);}
 assert.equal(profile.fusion[weapons[2].id].effects.length,2);assert.ok(profile.fusion[weapons[2].id].templeStats.damage>weapons[2].damage);
});
