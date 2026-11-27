import {checkpointId,isSurfaceCheckpoint,compactSurfaceRecords,surfaceTailSize,SURFACE_TAIL_BYTES} from '../src/shared/space-paint-raster.js';
export function initializeSpacePaintCheckpoints(sql){
 sql.exec('CREATE TABLE IF NOT EXISTS space_paint_checkpoints (id TEXT PRIMARY KEY, stroke_id TEXT NOT NULL, pixels BLOB NOT NULL, expires INTEGER NOT NULL DEFAULT 0, kind INTEGER NOT NULL DEFAULT 0)');
 sql.exec('CREATE INDEX IF NOT EXISTS space_paint_checkpoint_expiry ON space_paint_checkpoints(expires)');
 sql.exec('CREATE INDEX IF NOT EXISTS space_paint_checkpoint_stroke ON space_paint_checkpoints(stroke_id,kind,expires)');
}
export function readSpacePaintCheckpoint(sql,id,strokeId=null){
 if(!checkpointId(id))return null;
 return (strokeId===null?sql.exec('SELECT pixels FROM space_paint_checkpoints WHERE id=?',id):sql.exec('SELECT pixels FROM space_paint_checkpoints WHERE id=? AND stroke_id=?',id,strokeId)).toArray()[0]?.pixels??null;
}
export function verifySpacePaintCheckpoint(sql,strokeId,id){
 return checkpointId(id)&&!!sql.exec('SELECT id FROM space_paint_checkpoints WHERE id=? AND stroke_id=? AND (expires=0 OR expires>?)',id,strokeId,Date.now()).toArray().length;
}
const refs=map=>new Map(Object.entries(map||{}).flatMap(([id,list])=>isSurfaceCheckpoint(list?.[0])?[[id,list[0].checkpoint]]:[]));
// Only touch the target tile for a new paint; restoring history can restore
// several tiles atomically. Legacy vector records are compacted on next edit.
export function prepareSpacePaintCheckpoints(sql,world,action,body){
 const ids=action==='paint-space-surface'?[body.stroke.id]:action==='gm-edit-3d'?(body.add||[]).map(s=>s.id):[];
 const writes=[];
 for(const id of ids){
  const records=world.spacePaintSurface?.[id];
  if(!records?.length||surfaceTailSize(records)<=SURFACE_TAIL_BYTES)continue;
  const stroke=world.spacePaint.find(s=>s.id===id);if(!stroke)continue;
  const old=records[0],prior=isSurfaceCheckpoint(old)?readSpacePaintCheckpoint(sql,old.checkpoint,id):null;
  if(isSurfaceCheckpoint(old)&&!prior)throw Error('Missing surface checkpoint');
  // A legacy mural may have thousands of vector samples. Flatten a bounded
  // oldest prefix per edit, preserving the remaining vectors without blocking
  // the room for an entire historical replay.
  let end=isSurfaceCheckpoint(old)?1:0,points=0;
  while(end<records.length&&points+(records[end].points?.length||0)<=512){points+=records[end].points?.length||0;end++;}
  const key=crypto.randomUUID(),next=compactSurfaceRecords(stroke,records.slice(0,end),prior,key);
  world.spacePaintSurface={...world.spacePaintSurface,[id]:[...next.records,...records.slice(end)]};
  writes.push({id:key,strokeId:id,bytes:next.bytes});
 }
 return writes;
}
export function commitSpacePaintCheckpoints(sql,previous,next,writes,action,now=Date.now()){
 const before=refs(previous),after=refs(next);
 for(const w of writes)sql.exec('INSERT INTO space_paint_checkpoints(id,stroke_id,pixels,expires) VALUES(?,?,?,0)',w.id,w.strokeId,w.bytes);
 // Current checkpoints never expire. Superseded tiles only need a short
 // in-flight cache window; deleted geometry retains its undo image for 24h.
 for(const [stroke,id] of before)if(after.get(stroke)!==id){
  if(action==='gm-space-paint-clear')sql.exec('DELETE FROM space_paint_checkpoints WHERE stroke_id=?',stroke);
  else{
   const superseded=after.has(stroke);
   sql.exec('UPDATE space_paint_checkpoints SET expires=?,kind=? WHERE id=?',now+(superseded?300_000:86_400_000),superseded?1:2,id);
   if(superseded)sql.exec('DELETE FROM space_paint_checkpoints WHERE stroke_id=? AND kind=1 AND id NOT IN (SELECT id FROM space_paint_checkpoints WHERE stroke_id=? AND kind=1 ORDER BY expires DESC,id DESC LIMIT 2)',stroke,stroke);
  }
 }
 for(const [stroke,id] of after)if(before.get(stroke)!==id)sql.exec('UPDATE space_paint_checkpoints SET expires=0,kind=0 WHERE id=?',id);
 if(writes.length||before.size!==after.size||action==='gm-space-paint-clear'){
  sql.exec('DELETE FROM space_paint_checkpoints WHERE expires>0 AND expires<?',now);
  // Bound only obsolete undo images, never the number of accepted paint operations or current murals.
  sql.exec('DELETE FROM space_paint_checkpoints WHERE id IN (SELECT id FROM space_paint_checkpoints WHERE kind=2 ORDER BY expires DESC,id DESC LIMIT -1 OFFSET 512)');
 }
}
