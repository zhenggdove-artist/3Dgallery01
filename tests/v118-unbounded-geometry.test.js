import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import * as THREE from 'three';
import {SpacePaintArchiveStore,externalPaintCheckpoint} from '../cloudflare/space-paint-archive.js';
import {encodeCombatWorld,forkCombatWorld} from '../cloudflare/combat-world-cache.js';
import {combatRows,writeCombatDelta,restoreCombatOverlay} from '../cloudflare/combat-persistence.js';
import {initializeLargeReceipts,writeActionReceipt,readActionReceipt} from '../cloudflare/large-action-receipts.js';
import {createWorldPatch,applyWorldPatch} from '../src/shared/world-patch.js';
import {SpacePainter} from '../src/space-painter.js';
import {spacePaintMoveFraction,spacePaintFloor} from '../src/shared/space-paint-collision.js';
import {applySpacePaint} from '../src/shared/space-paint.js';
const stroke=(i,z=i%40)=>({id:'stroke-'+String(i).padStart(5,'0'),ownerKey:'alice',ownerEpoch:0,color:'#ff00aa',normal:[0,0,1],size:.4,thickness:.34,points:Array.from({length:32},(_,j)=>[-1.6+j*.1,3,z])});
const ink={owner:'alice',tool:'brush',chart:0,color:'#112233',size:.2,points:[[.5,.5]]};
function sqlite(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 return {db,sql:{exec(q,...args){const s=db.prepare(q);return /^SELECT/i.test(q)?{toArray:()=>s.all(...args)}:s.run(...args);}}};
}
test('legacy paint survives atomic migration and cold reload; appending above old budgets writes only one stroke row',()=>{
 const {db,sql}=sqlite();const store=new SpacePaintArchiveStore(sql);
 db.exec('CREATE TABLE world_state(id INTEGER PRIMARY KEY,payload TEXT);CREATE TABLE combat_world_overlay(key TEXT PRIMARY KEY,payload TEXT);');
 const original={revision:1,spacePaintRevision:1,spacePaintSurfaceRevision:1,spacePaint:Array.from({length:300},(_,i)=>stroke(i)),spacePaintSurface:{'stroke-00000':[ink]},profiles:{alice:{hp:100}},wallPaint:{wall:[ink]}};
 db.prepare('INSERT INTO world_state VALUES(1,?)').run(JSON.stringify(original));
 // Migration and full checkpoint share the same transaction.
 db.exec('BEGIN');assert.equal(store.write(original).writes,301);db.prepare('UPDATE world_state SET payload=? WHERE id=1').run(externalPaintCheckpoint(original));db.exec('COMMIT');
 const cold=new SpacePaintArchiveStore(sql);
 const base=JSON.parse(db.prepare('SELECT payload FROM world_state').get().payload);
 assert.equal(base.spacePaint.length,0);assert.deepEqual(cold.restore(base),original);
 const encoded=encodeCombatWorld(original),next=forkCombatWorld(encoded);
 next.spacePaint=[...next.spacePaint,stroke(300)];next.spacePaintRevision++;next.revision++;
 const newEncoded=encodeCombatWorld(next,encoded);
 const before=combatRows(original,encoded,true),after=combatRows(next,newEncoded,true);
 assert.equal(before.has('w:spacePaint'),false);assert.equal(before.has('w:spacePaintSurface'),false);
 db.exec('BEGIN');assert.equal(cold.write(next).writes,1);writeCombatDelta(sql,before,after);db.exec('COMMIT');
 const restored=new SpacePaintArchiveStore(sql).restore(restoreCombatOverlay(JSON.parse(db.prepare('SELECT payload FROM world_state').get().payload),db.prepare('SELECT key,payload FROM combat_world_overlay').all()));
 assert.deepEqual(restored,JSON.parse(newEncoded.payload));
 assert.deepEqual(new SpacePaintArchiveStore(sql).restore(JSON.parse(newEncoded.checkpointPayload)),restored);
 assert.equal(cold.write(next).writes,0);
 // A rolled-back transaction must not poison the cached baseline.
 const deleted={...next,revision:3,spacePaintRevision:3,spacePaint:next.spacePaint.slice(1),spacePaintSurfaceRevision:2,spacePaintSurface:{}};
 db.exec('BEGIN');assert.equal(cold.write(deleted).writes,2);db.exec('ROLLBACK');
 assert.equal(cold.write(deleted).writes,2);
 const afterDelete=cold.restore(JSON.parse(externalPaintCheckpoint(deleted)));
 assert.deepEqual(afterDelete,deleted);db.close();
});
test('geometry delta contains only one appended stroke and preserves old object identities and ordering',()=>{
 const old={revision:1,serverTime:1,spacePaintRevision:1,spacePaint:Array.from({length:300},(_,i)=>stroke(i))};
 const fresh={...old,revision:2,serverTime:2,spacePaintRevision:2,spacePaint:[...old.spacePaint,stroke(300)]};
 const delta=createWorldPatch(old,fresh,false,undefined,true,true);
 assert.equal(Object.hasOwn(delta.fields,'spacePaint'),false);
 assert.equal(delta.spaceGeometry.add.length,1);assert.deepEqual(delta.spaceGeometry.remove,[]);
 assert.ok(JSON.stringify(delta).length<JSON.stringify(fresh).length/100);
 const rebuilt=applyWorldPatch(old,delta);assert.deepEqual(rebuilt.spacePaint,fresh.spacePaint);assert.equal(rebuilt.spacePaint[0],old.spacePaint[0]);
 const reorder={...fresh,revision:3,spacePaintRevision:3,spacePaint:[...fresh.spacePaint.slice(1),fresh.spacePaint[0]]};
 assert.deepEqual(applyWorldPatch(fresh,createWorldPatch(fresh,reorder,false,undefined,true,true)).spacePaint,reorder.spacePaint);
 assert.deepEqual(createWorldPatch(old,fresh).fields.spacePaint,fresh.spacePaint);
});
test('3D painting at 300 strokes only rebuilds the affected render batch and preserves exact tube geometry',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,200);
 const painter=new SpacePainter({scene,camera,canvas:{}});
 const list=Array.from({length:300},(_,i)=>stroke(i));
 painter.sync({spacePaint:list,spacePaintRevision:1});
 const pages=painter.pages.slice(),geometries=pages.map(p=>p.mesh.geometry);
 painter.pending.set('stroke-00300',stroke(300));painter.rebuild();
 const changed=painter.pages.filter((p,i)=>p.mesh.geometry!==geometries[i]);
 assert.equal(changed.length,1);assert.ok(painter.pages.every(p=>p.strokes.length<=16));
 const optimistic=painter.pages.at(-1).mesh.geometry;
 painter.sync({spacePaint:[...list,structuredClone(stroke(300))],spacePaintRevision:2});
 assert.equal(painter.pages.at(-1).mesh.geometry,optimistic);
 assert.equal(painter.pending.size,0);
 assert.equal(painter.pages[0],pages[0]);
 const single=painter.pages[0].mesh.geometry;
 assert.ok(single.attributes.position.count>0);assert.ok(single.index.count>0);
});
test('per-stroke collision cache still blocks crossing and resolves the same floor after append and removal',()=>{
 const a=stroke(1,0),b=stroke(2,20);
 const from=[0,2,-5],to=[0,2,5],first=spacePaintMoveFraction([a],from,to);
 assert.ok(first<1);assert.equal(spacePaintMoveFraction([a,b],from,to),first);
 assert.equal(spacePaintMoveFraction([b],from,to),1);
 assert.equal(spacePaintFloor([a,b],0,0,8),spacePaintFloor([a],0,0,8));
});
test('more than 8192 points and 256 strokes still accept new geometry and own undo/redo',()=>{
 const world={profiles:{alice:{spacePaintEnabled:true,hp:100}},revision:1,spacePaint:Array.from({length:300},(_,i)=>stroke(i)),spacePaintSurface:{}};
 const actor={key:'alice',role:'fighter',position:[0,2,0]},s=stroke(300);
 assert.ok(applySpacePaint(world,actor,{action:'gm-paint-3d',stroke:s}).spacePaintStroke);
 const erased=applySpacePaint(world,actor,{action:'gm-erase-3d',id:s.id}).erasedStroke;
 assert.ok(erased);assert.ok(applySpacePaint(world,actor,{action:'gm-edit-3d',remove:[],add:[erased]}).spacePaintEdited);
 assert.equal(world.spacePaint.length,301);
});
test('large receipts are losslessly split and cleaned with the original idempotency record',()=>{
 const {db,sql}=sqlite();db.exec('CREATE TABLE request_receipts(session_id TEXT,request_id TEXT,response TEXT,created_at INTEGER,PRIMARY KEY(session_id,request_id))');
 initializeLargeReceipts(sql);const content=JSON.stringify({text:'藝術🎨'.repeat(150000)});
 writeActionReceipt(sql,'session','request',content,10);
 const marker=db.prepare('SELECT response FROM request_receipts').get().response;
 assert.equal(readActionReceipt(sql,'session','request',marker),content);
 db.exec('DELETE FROM request_receipts');assert.equal(db.prepare('SELECT count(*) AS n FROM request_receipt_parts').get().n,0);db.close();
});
