import test from 'node:test';
import assert from 'node:assert/strict';
import {applySpacePaint,validateSpacePaint,SPACE_PAINT_MAX_POINTS} from '../src/shared/space-paint.js';
import {spacePaintGeometry} from '../src/space-painter.js';
import {createWorldPatch,applyWorldPatch} from '../src/shared/world-patch.js';
import {encodeCombatWorld,forkCombatWorld} from '../cloudflare/combat-world-cache.js';
import {createInitialWorld,migrateWorld,applyAction,worldView} from '../src/shared/temple-rules.js';

const stroke=(id='stroke-0001')=>({id,color:'#ff00aa',size:.17,thickness:1.4,normal:[0,0,1],points:[[0,2,6],[1,2,6],[2,3,6]]});
const gm={key:'gm-test',role:'fighter',admin:true};
const makeWorld=()=>({revision:5,profiles:{'gm-test':{admin:true}},spacePaint:[],spacePaintRevision:0});
test('3D paint requires persisted GM authorization and valid geometry',()=>{
 const world=makeWorld(),body={action:'gm-paint-3d',stroke:stroke()};
 assert.ok(applySpacePaint(world,{...gm,admin:false},body).error);
 assert.ok(applySpacePaint(world,{...gm,key:'not-gm'},body).error);
 assert.ok(applySpacePaint(world,{...gm,role:'spectator'},body).error);
 assert.equal(world.revision,5);
 assert.equal(validateSpacePaint({...stroke(),thickness:5}),null);
 assert.equal(validateSpacePaint({...stroke(),normal:[0,0,0]}),null);
 assert.equal(validateSpacePaint({...stroke(),points:[[0,0,0],[0,0,1]]}),null);
 assert.equal(validateSpacePaint({...stroke(),points:[[Infinity,0,0]]}),null);
 assert.equal(validateSpacePaint({...stroke(),points:Array(SPACE_PAINT_MAX_POINTS+1).fill([0,2,6])}),null);
 assert.equal(validateSpacePaint({...stroke(),points:[[0,2,6]]}).points.length,1);
});
test('3D paint is immutable, versioned and erased independently',()=>{
 const world=makeWorld(),old=world.spacePaint;
 const result=applySpacePaint(world,gm,{action:'gm-paint-3d',stroke:stroke()});
 assert.equal(result.spacePaintStroke.id,'stroke-0001');assert.equal(old.length,0);
 assert.equal(world.spacePaintRevision,1);assert.equal(world.revision,6);
 assert.ok(applySpacePaint(world,gm,{action:'gm-paint-3d',stroke:stroke()}).error);
 const encoded=encodeCombatWorld(world);const fork=forkCombatWorld(encoded);
 assert.equal(fork.spacePaint,world.spacePaint);assert.ok(Object.isFrozen(fork.spacePaint));
 assert.equal(applySpacePaint(fork,gm,{action:'gm-erase-3d',id:'stroke-0001'}).erased3DStroke,'stroke-0001');
 assert.equal(fork.spacePaint.length,0);assert.equal(world.spacePaint.length,1);
 assert.equal(fork.spacePaintRevision,2);
});
test('archive grows beyond the former 256 strokes and 8192 points while per-stroke validation remains',()=>{
 const world=makeWorld();world.spacePaint=Array.from({length:300},(_,i)=>({...stroke('existing-'+i),ownerKey:gm.key,points:Array.from({length:32},(_,j)=>[j*.01,2,6])}));
 assert.ok(applySpacePaint(world,gm,{action:'gm-paint-3d',stroke:stroke()}).spacePaintStroke);
 assert.equal(world.revision,6);assert.equal(world.spacePaint.length,301);
 assert.ok(applySpacePaint(world,gm,{action:'gm-erase-3d',id:'stroke-0001'}).erasedStroke);
 assert.equal(world.spacePaint.length,300);
});
test('migration, authoritative action and world view include the archive',()=>{
 const world=createInitialWorld();delete world.spacePaint;delete world.spacePaintRevision;
 migrateWorld(world);world.profiles[gm.key]={admin:true};
 const before=world.revision;
 assert.equal(applyAction(world,gm,{action:'gm-paint-3d',stroke:stroke()}).spacePaintStroke.id,'stroke-0001');
 assert.equal(world.revision,before+1);
 const view=worldView(world,null);
 assert.equal(view.spacePaintRevision,1);assert.equal(view.spacePaint[0].id,'stroke-0001');
});
test('unchanged geometry is omitted from combat patches, changes synchronize',()=>{
 const old={revision:5,serverTime:1,spacePaint:[],spacePaintRevision:0};
 const fresh={...old,revision:6,serverTime:2,spacePaint:[stroke()],spacePaintRevision:1};
 const patch=createWorldPatch(old,fresh);
 assert.deepEqual(applyWorldPatch(old,patch).spacePaint,fresh.spacePaint);
 const again={...fresh,revision:7,spacePaint:structuredClone(fresh.spacePaint)};
 assert.equal(Object.hasOwn(createWorldPatch(fresh,again).fields,'spacePaint'),false);
});
test('closed indexed geometry has independent physical thickness and batched face ranges',()=>{
 const s=stroke(),dot={...stroke('stroke-0002'),points:[[5,2,6]]};
 const {geometry,ranges}=spacePaintGeometry([s,dot]);
 geometry.computeBoundingBox();
 assert.ok(Math.abs(geometry.boundingBox.max.z-6.7)<1e-5);
 assert.ok(Math.abs(geometry.boundingBox.min.z-5.3)<1e-5);
 assert.equal(ranges.length,2);assert.equal(ranges[0].end,ranges[1].start);
 assert.equal(ranges[1].end,geometry.index.count/3);
 assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
 assert.ok(geometry.attributes.position.array.every(Number.isFinite));
 geometry.dispose();
});
