import test from 'node:test';
import assert from 'node:assert/strict';
import {applyStatus,tickStatus} from '../src/shared/combat-status.js';
import {createInitialWorld,ensureProfile} from '../src/shared/temple-rules.js';
import {playerStats,refreshStats} from '../src/shared/player-stats.js';
import {ITEMS} from '../src/shared/catalog.js';
import {fuseOriginal} from '../src/shared/fusion-adapter.js';
test('original fire ticks, ice slows, pan knocks back; duration is bounded',()=>{
 const world=createInitialWorld(1000),a=ensureProfile(world,'a','A',null,1000),b=ensureProfile(world,'b','B',null,1000),shot={direction:[1,0,0],charge:1,damage:20};
 applyStatus(world,a,b,ITEMS.find(i=>i.family==='fire'),shot,2000);let damage=0;tickStatus(b,7000,(_,n)=>damage+=n);assert.ok(damage>0);assert.deepEqual(b.effects,{});
 applyStatus(world,a,b,ITEMS.find(i=>i.family==='ice'),shot,8000);assert.equal(playerStats(world,b,8500).speed,.6);assert.equal(playerStats(world,b,13000).speed,1);
 applyStatus(world,a,b,ITEMS.find(i=>i.family==='pan'&&!i.exotic),shot,14000);assert.deepEqual(b.impulse.vector,[2,0,0]);
});
test('fusion consumes one duplicate only; fused shield capacity is used',()=>{
 const w=createInitialWorld(),p=ensureProfile(w,'p','P'),shields=ITEMS.filter(i=>i.slot==='shield').slice(0,2);p.inventory.push(shields[0].id,shields[0].id,shields[1].id);
 const r=fuseOriginal(w,p,{sourceId:shields[0].id,targetId:shields[1].id,requestId:crypto.randomUUID()},()=>0);assert.ok(r.fusion.success);assert.equal(p.inventory.filter(i=>i===shields[0].id).length,1);p.equipment.shield=shields[1].id;refreshStats(w,p);assert.ok(p.shield.hp>shields[1].capacity*10);
});
