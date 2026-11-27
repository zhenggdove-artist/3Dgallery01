import {checkpointId,isSurfaceCheckpoint,compactSurfaceRecords,surfaceTailSize,SURFACE_TAIL_BYTES,surfaceRasterOwners} from '../src/shared/space-paint-raster.js';
export function initializeSpacePaintCheckpoints(sql){
 sql.exec('CREATE TABLE IF NOT EXISTS space_paint_checkpoints (id TEXT PRIMARY KEY, stroke_id TEXT NOT NULL, pixels BLOB NOT NULL, expires INTEGER NOT NULL DEFAULT 0, kind INTEGER NOT NULL DEFAULT 0)');
 sql.exec('CREATE INDEX IF NOT EXISTS space_paint_checkpoint_expiry ON space_paint_checkpoints(expires)');
 sql.exec('CREATE INDEX IF NOT EXISTS space_paint_checkpoint_stroke ON space_paint_checkpoints(stroke_id,kind,expires)');
 sql.exec('CREATE TABLE IF NOT EXISTS space_paint_checkpoint_parts (id TEXT NOT NULL REFERENCES space_paint_checkpoints(id) ON DELETE CASCADE, part INTEGER NOT NULL, pixels BLOB NOT NULL, PRIMARY KEY(id,part))');
}
export function readSpacePaintCheckpoint(sql,id,strokeId=null){
 if(!checkpointId(id))return null;
 const raw=(strokeId===null?sql.exec('SELECT pixels FROM space_paint_checkpoints WHERE id=?',id):sql.exec('SELECT pixels FROM space_paint_checkpoints WHERE id=? AND stroke_id=?',id,strokeId)).toArray()[0]?.pixels;if(!raw)return null;
 const bytes=new Uint8Array(raw);if(bytes.length!==1||bytes[0]!==3)return raw;
 const parts=sql.exec('SELECT pixels FROM space_paint_checkpoint_parts WHERE id=? ORDER BY part',id).toArray().map(row=>new Uint8Array(row.pixels));
 if(!parts.length)return null;const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;
}
export function verifySpacePaintCheckpoint(sql,strokeId,id){
 return checkpointId(id)&&!!sql.exec('SELECT id FROM space_paint_checkpoints WHERE id=? AND stroke_id=? AND (expires=0 OR expires>?)',id,strokeId,Date.now()).toArray().length;
}
export function readSpacePaintCheckpointOwners(sql,strokeId,id){const bytes=readSpacePaintCheckpoint(sql,id,strokeId);return bytes?surfaceRasterOwners(bytes):null;}
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
 for(const w of writes){
  const chunk=512*1024,split=w.bytes.length>chunk;
  sql.exec('INSERT INTO space_paint_checkpoints(id,stroke_id,pixels,expires) VALUES(?,?,?,0)',w.id,w.strokeId,split?new Uint8Array([3]):w.bytes);
  if(split)for(let i=0;i<w.bytes.length;i+=chunk)sql.exec('INSERT INTO space_paint_checkpoint_parts(id,part,pixels) VALUES(?,?,?)',w.id,i/chunk,w.bytes.subarray(i,i+chunk));
 }
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
