import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeCombatWorld,forkCombatWorld} from '../cloudflare/combat-world-cache.js';
import {combatRows,writeCombatDelta,restoreCombatOverlay} from '../cloudflare/combat-persistence.js';
test('idle account ledgers remain unmaterialized through multiple authoritative contact snapshots',()=>{
 const world={revision:1,profiles:{},cityDamage:{},wallPaint:{large:'x'.repeat(1000000)}};
 for(let i=0;i<30;i++)world.profiles['offline:'+i]={key:'offline:'+i,hp:100,inventory:Array(3000).fill('saber-2'),inventoryInstances:Array.from({length:3000},(_,j)=>({uid:i+'-'+j,itemId:'saber-2'})),fusionByInstance:{a:{layer:1}}};
 world.profiles.live={key:'live',hp:100};
 const before=encodeCombatWorld(world);assert.deepEqual(JSON.parse(before.payload),world);
 let current=before;
 for(let i=0;i<8;i++){
  const next=forkCombatWorld(current);next.profiles.live.hp--;next.revision++;next.cityDamage['city-0']={hp:100-i};
  const offline=next.profiles['offline:0'],getter=Object.getOwnPropertyDescriptor(offline,'inventoryInstances').get;
  assert.equal(typeof getter,'function');
  const encoded=encodeCombatWorld(next,current);
  const rows=combatRows(next,encoded);
  assert.equal(Object.getOwnPropertyDescriptor(offline,'inventoryInstances').get,getter);
  assert.equal(encoded.profiles.get('offline:0'),before.profiles.get('offline:0'));
  assert.equal(rows.get('p:offline:0'),before.profileRows.get('p:offline:0'));
  current=encoded;
 }
 const journal=new Map(),delta=writeCombatDelta({exec:(_query,key,value=null)=>journal.set(key,value)},combatRows(world,before),combatRows(forkCombatWorld(current),current));
 assert.equal(delta.writes,3);assert.ok(delta.bytes<500);
 assert.deepEqual(restoreCombatOverlay(JSON.parse(before.payload),Array.from(journal,([key,payload])=>({key,payload}))),JSON.parse(current.payload));
});
test('lazy ledger reads, writes, deletion, and nested mutation are fully isolated and persisted',()=>{
 const w={profiles:{a:{hp:100,inventory:['x'],inventoryInstances:[{uid:'a'}],fusionByInstance:{a:{layer:1}}},b:{hp:50,inventory:['y']}},revision:1};
 const base=encodeCombatWorld(w),a=forkCombatWorld(base),b=forkCombatWorld(base);
 a.profiles.a.inventory.push('z');a.profiles.a.inventoryInstances[0].uid='changed';a.profiles.a.fusionByInstance.a.layer=2;
 a.profiles.b.inventory=['replacement'];delete a.profiles.b; a.profiles.c={hp:80,inventory:['new']};
 const next=encodeCombatWorld(a,base);
 assert.deepEqual(JSON.parse(next.payload),JSON.parse(JSON.stringify(a)));
 assert.deepEqual(JSON.parse(base.payload),w);assert.deepEqual(JSON.parse(JSON.stringify(b)),w);
 assert.equal(next.profileRows.has('p:b'),false);
 assert.deepEqual(combatRows(a,next),combatRows(a));
});
