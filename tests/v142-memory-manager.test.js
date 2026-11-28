import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {RenderMemoryManager,updateResidency} from '../src/render-residency.js';
test('central scene retirement respects shared budget and never delays wake',()=>{
 const m=new RenderMemoryManager({mobile:true});m.maintenanceMs=Infinity;const states=[{},{},{}];let count=0,wake=0;
 const run=(i,far,t)=>updateResidency(states[i],far,t,()=>count++,()=>wake++,true,m,'test');
 states.forEach((_,i)=>run(i,true,0));states.forEach((_,i)=>run(i,true,15000));
 assert.equal(count,2);assert.equal(states[2].dormant,undefined);run(0,false,15001);assert.equal(wake,1);m.beginFrame();run(2,true,15002);assert.equal(count,3);
 assert.equal(m.snapshot().retired.test,3);assert.equal(m.snapshot().wakes.test,1);
});
test('global pool retirement keeps reserves, ignores active and fresh items and retires oldest across families',()=>{
 const manager=new RenderMemoryManager({mobile:true});manager.maintenanceMs=Infinity;const scene=new THREE.Scene();let disposed=[];
 const entry=(id,since)=>({id,since,root:new THREE.Group()});
 const reserve=entry('reserve',0),old=entry('old',2),active=entry('active',1),young=entry('young',39000),older=entry('older',1),third=entry('third',3);scene.add(active.root);
 const a=[reserve,old,active,young],b=[entry('reserve2',0),older,third];
 const group=(kind,list)=>({kind,list,keep:1,idleMs:30000,root:e=>e.root,since:e=>e.since,dispose:e=>disposed.push(e.id)});
 assert.equal(manager.sweepPools([group('a',a),group('b',b)],40000),2);
 assert.deepEqual(disposed,['older','old']);assert.deepEqual(a.map(e=>e.id),['reserve','active','young']);assert.deepEqual(b.map(e=>e.id),['reserve2','third']);
 assert.equal(manager.snapshot().pools.reserved,2);
 manager.beginFrame();manager.retire('scene',()=>{});manager.retire('scene',()=>{});
 assert.equal(manager.sweepPools([group('b',b)],40001),0);
});
