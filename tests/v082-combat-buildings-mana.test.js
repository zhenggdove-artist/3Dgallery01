import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';
import {itemById} from '../src/shared/catalog.js';
import {CITY_LOTS,CITY_MAX_HP} from '../src/shared/city-layout.js';
const NOW=1700000000;
const actor={key:'building-combat',name:'Building combat',role:'fighter',position:[75,0,0],color:'#fff'};
function setup(id){const world=createInitialWorld(NOW),p=ensureProfile(world,actor.key,actor.name,actor.color,NOW);p.inventory.push(id);p.equipment.weapon=id;world.monster.active=false;world.monsters=[];return {world,p};}
test('insufficient mana rejects charge before it starts; normal attack remains free',()=>{
 const {world,p}=setup('ember-1');p.mana=0;p.manaAt=NOW+1000;
 const fail=applyAction(world,actor,{action:'attack',phase:'charge'},{now:NOW+1000});
 assert.match(fail.error,/Not enough mana/);assert.equal(p.chargeStartedAt,0);
 const hit=applyAction(world,actor,{action:'attack',direction:[0,0,1],charge:0},{now:NOW+1000});
 assert.ok(hit.attackEvent,hit.error);
});
test('jelly ultimate damages GM and city buildings repeatedly and stops when expired',()=>{
 const {world,p}=setup('jellybrella'),lot=CITY_LOTS[0],time=NOW+1000;
 const origin=[lot.x,1,lot.z],center=[lot.x,.12,lot.z];
 const house={id:'gm-test-house',kind:'house',owner:'gm',position:[lot.x+1,0,lot.z],rotation:0,hp:200,maxHp:200,gmHouse:true,house:{width:6,height:6,depth:5}};
 world.structures=[house];
 world.persistentAttacks=[{id:'jelly-test',kind:'projectile',owner:actor.key,weapon:'jellybrella',origin,direction:[0,0,1],range:10,radius:6,area:{mode:'area',center,visualCenter:center,radius:6,travel:5,range:10},damage:12,pvpDamage:5,charge:1,flightMs:300,createdAt:time,lastAt:time,expiresAt:time+5000,hits:[],hitTimes:{},pelletHits:{}}];
 tickWorld(world,{now:time+100,actors:[],rng:()=>.5});const a=house.hp,b=world.cityDamage[lot.id].hp;assert.ok(a<200);assert.ok(b<CITY_MAX_HP);
 tickWorld(world,{now:time+600,actors:[],rng:()=>.5});assert.equal(house.hp,a);
 tickWorld(world,{now:time+1400,actors:[],rng:()=>.5});assert.ok(house.hp<a);assert.ok(world.cityDamage[lot.id].hp<b);
 const hp=house.hp;tickWorld(world,{now:time+5100,actors:[],rng:()=>.5});assert.equal(house.hp,hp);
});
test('fusion area hits a building outside the primary warning if its own effect contacts it',()=>{
 const {world}=setup('saber-1'),time=NOW+1000;
 const house={id:'echo-house',kind:'house',owner:'temple',position:[80,0,0],rotation:0,hp:8,maxHp:8};
 world.structures=[house];
 world.persistentAttacks=[{id:'echo-test',kind:'projectile',echo:true,owner:actor.key,weapon:'pan-1',origin:[75,1,0],direction:[1,0,0],range:5,radius:4,area:{mode:'area',center:[80,.12,0],visualCenter:[80,.16,0],radius:4,travel:5,range:5},parentFootprint:{shape:'circle',position:[75,0,0],radius:.2},damage:10,pvpDamage:5,charge:1,flightMs:200,createdAt:time,lastAt:time,expiresAt:time+5000,hits:[],hitTimes:{},pelletHits:{}}];
 tickWorld(world,{now:time+300,actors:[],rng:()=>.5});
 assert.ok(!world.structures.some(s=>s.id===house.id));
 assert.ok(world.pendingArtworkVisualEvents.some(v=>v.kind==='structure-destroyed'&&v.event.id===house.id));
});
