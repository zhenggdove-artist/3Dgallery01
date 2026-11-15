import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,createInitialWorld,ensureProfile,worldView} from '../src/shared/temple-rules.js';
import {EQUIPMENT} from '../src/reletter/equipment-catalog.js';
import {ITEMS,EQUIPPABLE_SLOTS} from '../src/shared/catalog.js';
import {SEEDS} from '../src/reletter/garden-catalog.js';
const setup=()=>{const world=createInitialWorld(1000),actor={key:'tester',name:'Test',role:'fighter',position:[-5,0,-12]},profile=ensureProfile(world,actor.key,actor.name,null,1000);return {world,actor,profile};};
test('original seed → water → growth → harvest → eat persists',()=>{
 const {world,actor,profile}=setup();profile.inventory.push(SEEDS[0].id);let now=10000;
 const act=(action,body={})=>{const r=applyAction(world,actor,{action,...body},{now,rng:()=>.5});assert.ok(!r.error,r.error);return r;};
 act('seed-plant',{item:SEEDS[0].id,position:actor.position});const crop=world.reletter.garden.crops[0];
 for(let i=0;i<3;i++){now+=1500;act('crop-water',{id:crop.id});}now+=SEEDS[0].growMs+100;
 act('crop-harvest',{id:crop.id});assert.equal(world.reletter.garden.crops.length,0);const harvest=profile.inventory.find(id=>id.startsWith('harvest-'));assert.ok(harvest);profile.hp=50;act('harvest-eat',{item:harvest});assert.ok(profile.hp>50);assert.ok(Object.keys(world.reletter.garden.buffs[actor.key]).length);
 assert.ok(worldView(JSON.parse(JSON.stringify(world)),actor.key,now).reletter.garden);
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
 const {world,actor,profile}=setup();const weapons=EQUIPMENT.filter(i=>i.slot==='weapon'&&i.family==='saber').slice(0,3);profile.inventory.push(...weapons.map(i=>i.id));
 for(const source of weapons.slice(0,2)){const r=applyAction(world,actor,{action:'fuse',sourceId:source.id,targetId:weapons[2].id,requestId:crypto.randomUUID()},{now:Date.now(),rng:()=>0});assert.ok(!r.error,r.error);assert.ok(r.fusion.success);}
 assert.equal(profile.fusion[weapons[2].id].effects.length,2);assert.ok(profile.fusion[weapons[2].id].original.stats.damage>weapons[2].damage);
});
