import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SpacePainter} from '../src/space-painter.js';
import {applyAction,createInitialWorld,worldView} from '../src/shared/temple-rules.js';
import {spacePaintMoveFraction} from '../src/shared/space-paint-collision.js';
const gm={key:'gm',role:'fighter',admin:true};
const stroke=id=>({id,color:'#ff00aa',size:.5,thickness:.4,normal:[0,0,1],points:[[-2,3,0],[2,3,0]]});
function fixture(){
 const world=createInitialWorld();world.profiles[gm.key]={admin:true};
 const notices=[],calls=[],scene=new THREE.Scene();
 const painter=new SpacePainter({scene,canvas:{hasPointerCapture:()=>false},camera:new THREE.PerspectiveCamera(),ui:{toast:x=>notices.push(x)},send:async(action,data)=>{
  calls.push(action);
  const result=applyAction(world,gm,{action,...data});
  if(result.error)throw Error(result.error);
  // Match the HTTP response/authoritative sync that main.sendAction applies.
  painter.sync(worldView(world,null));return result;
 }});
 const draw=(id,gesture=id)=>{painter.gesture=gesture;painter.stroke=stroke(id);painter.finish();};
 const solid=()=>spacePaintMoveFraction(world.spacePaint,[0,2,-5],[0,2,5])<1;
 const erase=async id=>{const result=await painter.send('gm-erase-3d',{id});painter.record({add:[],remove:[result.erasedStroke]});};
 return {world,painter,draw,solid,erase,notices,calls};
}
test('client draw, immediate undo and redo reach the authoritative archive and remove/restore geometry and collision',async()=>{
 const {world,painter,draw,solid,notices,calls}=fixture();
 draw('stroke-0001');
 await painter.history(); // queued before the original draw acknowledgement
 assert.deepEqual(calls,['gm-paint-3d','gm-edit-3d']);
 assert.equal(world.spacePaint.length,0);assert.equal(painter.saved,null);assert.equal(solid(),false);
 await painter.history(true);
 assert.equal(world.spacePaint.length,1);assert.ok(painter.saved?.geometry.index.count);assert.equal(solid(),true);
 assert.equal(painter.undoStack.length,1);assert.equal(painter.redoStack.length,0);assert.deepEqual(notices,[]);
});
test('split gestures undo together, erase is reversible, and a new stroke invalidates redo',async()=>{
 const {world,painter,draw,erase,notices}=fixture();
 draw('stroke-0001','gesture-1');draw('stroke-0002','gesture-1');await painter.queue;
 assert.equal(painter.undoStack.length,1);assert.equal(world.spacePaint.length,2);
 await painter.history();assert.equal(world.spacePaint.length,0);
 await painter.history(true);assert.equal(world.spacePaint.length,2);
 await erase('stroke-0001');assert.equal(world.spacePaint.length,1);
 await painter.history();assert.equal(world.spacePaint.length,2);
 await painter.history(true);assert.equal(world.spacePaint.length,1);
 await painter.history();draw('stroke-0003');await painter.queue;
 assert.equal(world.spacePaint.length,3);assert.equal(painter.redoStack.length,0);assert.deepEqual(notices,[]);
});
test('history failure leaves stacks intact for retry',async()=>{
 const {world,painter,draw,notices}=fixture();
 draw('stroke-0001');await painter.queue;
 const original=painter.send;painter.send=async()=>{throw Error('Unknown action');};
 await painter.history();
 assert.equal(painter.undoStack.length,1);assert.equal(painter.redoStack.length,0);assert.equal(world.spacePaint.length,1);
 assert.match(notices.at(-1),/updated Worker/);
 painter.send=original;await painter.history();assert.equal(world.spacePaint.length,0);
});
