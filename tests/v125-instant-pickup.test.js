import test from 'node:test';
import assert from 'node:assert/strict';
import {PickupScheduler} from '../src/auto-pickup.js';
import {PickupPreviewLedger} from '../src/pickup-preview.js';
const world={revision:10,coins:{c:{available:true}},groundDrops:[{id:'a',position:[0,0,0]},{id:'b',position:[0,0,0]}]};
test('start animation synchronously before network response, independently for consecutive pickups',async()=>{
 let now=0;const started=[],resolves=[],cancelled=[],ledger=new PickupPreviewLedger(e=>cancelled.push(e.id));
 const scheduler=new PickupScheduler([],async(action,data,automatic)=>{
  assert.equal(automatic,true);
  const p=ledger.begin(action,data.dropId,world,()=>{started.push(data.dropId);return {};});
  const result=await new Promise(r=>resolves.push(r));ledger.finish(p,result,world);
 },()=>now);
 const first=scheduler.poll(world,{x:0,y:0,z:0},'owner',now,now);
 assert.deepEqual(started,['a']);assert.equal(ledger.has('pickup-drop','a'),true);
 now=16;const second=scheduler.poll(world,{x:0,y:0,z:0},'owner',now,now);
 assert.deepEqual(started,['a','b']);assert.equal(ledger.has('pickup-drop','b'),true);
 assert.equal(scheduler.request('pickup-drop','a','dropId'),null);
 resolves[0]({worldRevision:11});resolves[1](null);await Promise.all([first,second]);
 assert.deepEqual(cancelled,['b']);assert.equal(ledger.has('pickup-drop','a'),true);
 ledger.reconcile({...world,revision:11,groundDrops:[world.groundDrops[1]]});
 assert.equal(ledger.has('pickup-drop','a'),false);assert.deepEqual(cancelled,['b']);
 assert.equal(world.groundDrops.length,2,'presentation never mutates authority');
});
test('authoritative removal before acknowledgement deduplicates animation; denial restores exactly once',()=>{
 const cancelled=[],ledger=new PickupPreviewLedger(e=>cancelled.push(e.id)),start=()=>({age:0});
 const a=ledger.begin('pickup-coin','c',world,start);assert.ok(a);
 assert.equal(ledger.begin('pickup-coin','c',world,start),null);
 const gone={...world,revision:11,coins:{c:{available:false}}};ledger.reconcile(gone);ledger.finish(a,{worldRevision:11},gone);assert.deepEqual(cancelled,[]);
 const b=ledger.begin('pickup-drop','b',world,start);ledger.finish(b,null,world);ledger.finish(b,null,world);assert.deepEqual(cancelled,['b']);assert.equal(ledger.has('pickup-drop','b'),false);
 const retry=ledger.begin('pickup-drop','b',world,start);ledger.finish(retry,{worldRevision:12},world);ledger.reconcile({...world,revision:12});assert.deepEqual(cancelled,['b','b']);
});
