import test from 'node:test';import assert from 'node:assert/strict';
import {suspendSpacePaint,applySpacePaint,SPACE_PAINT_ACTIONS,canSpacePaint} from '../src/shared/space-paint.js';
import {createInitialWorld,worldView} from '../src/shared/temple-rules.js';
test('V141 clears all 3D geometry and surface data exactly once, retains 2D data and original grants',()=>{
 const world=createInitialWorld();world.spacePaint=[{id:'old'}];world.spacePaintSurface={old:[{color:'#ffffff'}]};world.spacePaintRevision=8;world.spacePaintSurfaceRevision=12;
 world.wallPaint={wall:[{color:'#fff'}]};world.discPaint={disc:[{color:'#fff'}]};
 world.profiles={gm:{admin:true,spacePaintEpoch:2},p:{spacePaintEnabled:true}};
 const wall=world.wallPaint,disc=world.discPaint,rev=world.revision;
 assert.equal(suspendSpacePaint(world),true);assert.deepEqual(world.spacePaint,[]);assert.deepEqual(world.spacePaintSurface,{});
 assert.equal(world.spacePaintRevision,9);assert.equal(world.spacePaintSurfaceRevision,13);assert.equal(world.revision,rev+1);
 assert.equal(world.profiles.gm.spacePaintEpoch,3);assert.equal(world.profiles.p.spacePaintEnabled,true);
 assert.equal(world.wallPaint,wall);assert.equal(world.discPaint,disc);
 for(const action of SPACE_PAINT_ACTIONS)assert.ok(applySpacePaint(world,{key:'gm',admin:true,role:'fighter'},{action}).error);
 assert.equal(canSpacePaint(world.profiles.gm,true),false);assert.equal(canSpacePaint(world.profiles.p,true),false);
 assert.equal(suspendSpacePaint(world),false);assert.equal(world.revision,rev+1);
});
