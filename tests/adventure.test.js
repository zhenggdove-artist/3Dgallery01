import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,createInitialWorld,ensureProfile,worldView} from '../src/shared/temple-rules.js';
import {FISHING_POND} from '../src/shared/arena.js';
import {EQUIPMENT} from '../src/reletter/equipment-catalog.js';
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
test('original fishing → hook → tension control → catch → aquarium → retrieve → sell',()=>{
 const {world,actor,profile}=setup();actor.position=[FISHING_POND.x+4,0,FISHING_POND.z];const rod=EQUIPMENT.filter(i=>i.slot==='rod').at(-1);profile.inventory.push(rod.id,'pond-kit');profile.equipment.rod=rod.id;profile.wallet=50000;let now=Date.now();
 const act=(action,body={})=>{const r=applyAction(world,actor,{action,...body},{now,rng:()=>0});assert.ok(!r.error,r.error);return r;};
 assert.equal(worldView(world,actor.key).reletter.fishing.holes.length,0);world.reletter??={garden:{crops:[],stacks:{},buffs:{},revision:0},fishing:{holes:[],ponds:[],sessions:{},bags:{},revision:0}};world.reletter.fishing.holes.push({id:'test-pond',position:[FISHING_POND.x,0,FISHING_POND.z],radius:7,depth:3,water:'fresh',owner:actor.key});act('cast',{hole:'test-pond'});let s=world.reletter.fishing.sessions[actor.key];now=s.biteAt+10;act('hook',{id:s.id});
 for(let i=0;i<1200;i++){s=world.reletter.fishing.sessions[actor.key];if(s.stage==='caught')break;assert.equal(s.stage,'fight');now+=250;act('reel',{id:s.id,reeling:s.tension<.65});}
 const bag=world.reletter.fishing.bags[actor.key];assert.equal(bag.length,1);const fishId=bag[0].id;
 actor.position=[-5,0,-12];act('pond-build',{position:[-5,0,-19],size:'small'});const pond=world.reletter.fishing.ponds[0];actor.position=[-5,0,-16];act('pond-release',{pond:pond.id,id:fishId});assert.equal(world.reletter.fishing.ponds[0].fish.length,1);act('pond-retrieve',{pond:pond.id,id:fishId});const wallet=profile.wallet;act('sell-fish',{id:fishId});assert.ok(profile.wallet>wallet);act('pond-destroy',{pond:pond.id});assert.equal(world.reletter.fishing.ponds.length,0);
});
test('original fusion preserves two source effects and authoritative stats',()=>{
 const {world,actor,profile}=setup();const weapons=EQUIPMENT.filter(i=>i.slot==='weapon'&&i.family==='saber').slice(0,3);profile.inventory.push(...weapons.map(i=>i.id));
 for(const source of weapons.slice(0,2)){const r=applyAction(world,actor,{action:'fuse',sourceId:source.id,targetId:weapons[2].id,requestId:crypto.randomUUID()},{now:Date.now(),rng:()=>0});assert.ok(!r.error,r.error);assert.ok(r.fusion.success);}
 assert.equal(profile.fusion[weapons[2].id].effects.length,2);assert.ok(profile.fusion[weapons[2].id].original.stats.damage>weapons[2].damage);
});
