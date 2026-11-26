import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeCombatWorld,forkCombatWorld} from '../cloudflare/combat-world-cache.js';
import {combatRows,writeCombatDelta,restoreCombatOverlay} from '../cloudflare/combat-persistence.js';
test('V096 contact serialization is shared between the isolated fork and the durable journal',()=>{
 const world={revision:1,profiles:{},cityDamage:{},wallPaint:{large:'x'.repeat(1000000)}};
 for(let i=0;i<30;i++)world.profiles['offline:'+i]={key:'offline:'+i,inventory:Array(3000).fill('saber-2'),inventoryInstances:Array.from({length:3000},(_,j)=>({uid:i+'-'+j,itemId:'saber-2'}))};
 world.profiles.live={key:'live',hp:100};
 const before=encodeCombatWorld(world);
 assert.deepEqual(JSON.parse(before.payload),JSON.parse(JSON.stringify(world)));
 assert.deepEqual(combatRows(world,before),combatRows(world));
 assert.equal(combatRows(world,before),before.rows);
 const next=forkCombatWorld(before);next.profiles.live.hp=90;next.cityDamage['city-0']={hp:90};next.revision++;delete next.profiles['offline:0'];
 const after=encodeCombatWorld(next,before);const journal=new Map();
 const delta=writeCombatDelta({exec:(_query,key,value=null)=>journal.set(key,value)},before.rows,after.rows);
 assert.equal(delta.writes,4);assert.ok(delta.bytes<500);
 assert.deepEqual(restoreCombatOverlay(JSON.parse(before.payload),Array.from(journal,([key,payload])=>({key,payload}))),JSON.parse(after.payload));
 assert.equal(world.profiles.live.hp,100);
 assert.equal(after.records.get('wallPaint'),before.records.get('wallPaint'));
});
test('each dynamic row is serialized once per committed snapshot',()=>{
 let calls=0;
 const world={profiles:{a:{toJSON(){calls++;return {key:'a',hp:100};}}},revision:1};
 const encoded=encodeCombatWorld(world);
 assert.equal(combatRows(world,encoded).get('p:a'),'{"key":"a","hp":100}');
 assert.equal(forkCombatWorld(encoded).profiles.a.hp,100);
 assert.equal(JSON.parse(encoded.payload).profiles.a.hp,100);
 assert.equal(calls,1);
});
