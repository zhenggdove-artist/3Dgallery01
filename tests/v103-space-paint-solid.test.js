import test from 'node:test';
import assert from 'node:assert/strict';
import {spacePaintMoveFraction,spacePaintFloor} from '../src/shared/space-paint-collision.js';
import {applySpacePaint} from '../src/shared/space-paint.js';
import {validateState} from '../src/shared/temple-rules.js';
const stroke={id:'stroke-0001',color:'#ff00aa',size:.5,thickness:.4,normal:[0,0,1],points:[[-2,3,0],[2,3,0]]};
test('solid 3D paint blocks continuous crossing and provides floor support',()=>{
 const list=[stroke];
 assert.ok(spacePaintMoveFraction(list,[0,2,-5],[0,2,5])<.5);
 assert.equal(spacePaintMoveFraction(list,[0,7,-5],[0,7,5]),1);
 assert.equal(spacePaintMoveFraction([], [0,2,-5],[0,2,5]),1);
 const floor=spacePaintFloor(list,0,0,6);
 assert.ok(floor>3.45&&floor<3.55);
 assert.equal(spacePaintMoveFraction(list,[0,floor,0],[.1,floor,0]),1);
 assert.ok(spacePaintMoveFraction(list,[0,0,0],[0,5,0])<1);
});
test('server rejects crossing, GM-only high flight, normal descent after flight',()=>{
 const state=(position,paintFlight=false)=>({position,rotation:0,paintFlight});
 const mobility={spacePaint:[stroke],admin:false};
 assert.equal(validateState(state([0,2,-1]),state([0,2,1]),100,'fighter',null,null,Date.now(),mobility).error,'3D paint collision');
 assert.equal(validateState(state([0,64,0]),state([0,65,0],true),100,'fighter',null,null,Date.now(),mobility).error,'Invalid position');
 assert.ok(validateState(state([0,64,0]),state([0,65,0],true),100,'fighter',null,null,Date.now(),{admin:true}).state);
 assert.ok(validateState(state([0,100,0]),state([0,99,0]),100,'fighter',null,null,Date.now(),{admin:true}).state);
});
test('undo redo edits archive atomically with GM permission and version',()=>{
 const gm={key:'gm',admin:true,role:'fighter'},world={profiles:{gm:{admin:true}},spacePaint:[stroke],spacePaintRevision:1,revision:1};
 const undo={action:'gm-edit-3d',remove:[stroke.id],add:[]};
 assert.ok(applySpacePaint(world,{...gm,admin:false},undo).error);
 assert.equal(applySpacePaint(world,gm,undo).spacePaintEdited,true);
 assert.equal(world.spacePaint.length,0);
 assert.equal(applySpacePaint(world,gm,{action:'gm-edit-3d',remove:[],add:[stroke]}).spacePaintEdited,true);
 assert.equal(world.spacePaint[0].id,stroke.id);
 assert.ok(applySpacePaint(world,gm,{action:'gm-edit-3d',remove:[stroke.id],add:[{...stroke,thickness:99}]}).error);
 assert.equal(world.spacePaint.length,1);assert.equal(world.spacePaintRevision,3);
});
