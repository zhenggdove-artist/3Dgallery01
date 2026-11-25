import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction,worldView} from '../src/shared/temple-rules.js';
import {advanceHomingVortex,vortexSpinPoint} from '../src/shared/vortex-flight.js';
test('GM chat position is persisted, shared, revisioned and validated',()=>{
 const world=createInitialWorld(),gm={key:'gm',name:'GM',color:'#abcdef',admin:true,role:'fighter'},user={key:'user',name:'User',color:'#abcdef',admin:false,role:'fighter'};
 ensureProfile(world,gm.key,gm.name,gm.color,Date.now(),true);
 assert.ok(applyAction(world,user,{action:'gm-chat-default',x:.25,y:.75}).error);
 assert.ok(applyAction(world,gm,{action:'gm-chat-default',x:2,y:.75}).error);
 assert.ok(!applyAction(world,gm,{action:'gm-chat-default',x:.25,y:.75}).error);
 assert.deepEqual(worldView(world,user.key).chatDefault,{x:.25,y:.75,revision:1});
 assert.ok(!applyAction(world,gm,{action:'gm-chat-default',x:.5,y:.4}).error);
 assert.equal(worldView(world,gm.key).chatDefault.revision,2);
});
test('captured vortex stops homing while victim orbits fixed center',()=>{
 const fx={origin:[0,1,0],position:[3,1,4],direction:[1,0,0],range:20,travelled:3,locked:true};
 for(let i=0;i<10;i++)assert.deepEqual(advanceHomingVortex(fx,{position:[10+i,0,8]},200),[3,1,4]);
 const spin={time:1000,start:[4,0,4],center:[3,4]};
 assert.notDeepEqual(vortexSpinPoint(spin,1250),vortexSpinPoint(spin,1500));
 assert.deepEqual(fx.position,[3,1,4]);
});
