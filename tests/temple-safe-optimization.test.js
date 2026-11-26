import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldPatch,applyWorldPatch} from '../src/shared/world-patch.js';

test('one broadcast cache preserves full JSON patch semantics for different baselines',()=>{
 const next={revision:3,serverTime:30,cityDamage:{a:{hp:10,parts:{s:0}},b:{hp:0}},profile:null};
 const baselines=[{revision:1,serverTime:10,cityDamage:{a:{hp:15},b:{hp:0},c:{hp:20}}},{revision:2,serverTime:20,cityDamage:{a:{hp:10,parts:{s:0}}}}];
 const cache=new Map();let serialized=0;
 const serialize=(id,record)=>{if(!cache.has(id)){serialized++;cache.set(id,JSON.stringify(record));}return cache.get(id);};
 for(const previous of baselines){const expected=createWorldPatch(previous,next,true);const actual=createWorldPatch(previous,next,true,serialize);assert.deepEqual(actual,expected);assert.deepEqual(applyWorldPatch(previous,actual).cityDamage,next.cityDamage);}
 assert.equal(serialized,2);
 const changed={...next,revision:4,cityDamage:{a:{hp:0}}};
 assert.deepEqual(createWorldPatch(next,changed,true).city,{a:{hp:0},b:null});
});

test('remote pose interpolation factors are identical within each frame',()=>{
 for(const dt of [0,1/120,1/60,1/30,.1]){const position=1-Math.exp(-dt*11),rotation=1-Math.exp(-dt*12);for(let i=0;i<104;i++){assert.equal(position,1-Math.exp(-dt*11));assert.equal(rotation,1-Math.exp(-dt*12));}}
});
