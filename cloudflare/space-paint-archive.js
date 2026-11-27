// Individual immutable strokes and graffiti tails live in separate bounded rows.
// Call only within the same transaction as the world revision/checkpoint.
export class SpacePaintArchiveStore{
 constructor(sql){this.sql=sql;this.cache=null;this.json=new WeakMap();
  sql.exec('CREATE TABLE IF NOT EXISTS space_paint_archive_rows (key TEXT PRIMARY KEY, ord INTEGER NOT NULL, payload TEXT NOT NULL)');
 }
 snapshot(){
  const meta=this.sql.exec("SELECT payload FROM space_paint_archive_rows WHERE key='meta'").toArray()[0]?.payload;
  if(!meta)return null;
  if(this.cache?.meta===meta)return this.cache;
  const versions=JSON.parse(meta);
  const rows=new Map(this.sql.exec("SELECT key,ord,payload FROM space_paint_archive_rows WHERE key!='meta' ORDER BY ord,key").toArray().map(r=>[r.key,r]));
  return this.cache={meta,versions,rows};
 }
 serialized(value){
  if(Object.isFrozen(value)&&this.json.has(value))return this.json.get(value);
  const s=JSON.stringify(value);if(Object.isFrozen(value))this.json.set(value,s);return s;
 }
 restore(world){
  const state=this.snapshot();if(!state)throw Error('Missing 3D paint archive');
  const geometry=[],surface={};
  for(const [key,row] of state.rows){
   if(key.startsWith('g:'))geometry.push(row);
   else if(key.startsWith('s:'))Object.defineProperty(surface,key.slice(2),{value:JSON.parse(row.payload),writable:true,enumerable:true,configurable:true});
  }
  geometry.sort((a,b)=>a.ord-b.ord);world.spacePaint=geometry.map(row=>JSON.parse(row.payload));world.spacePaintSurface=surface;
  delete world.spacePaintExternalV118;return world;
 }
 write(world){
  // Verify persisted metadata, including after an enclosing transaction rolls back.
  const old=this.snapshot(),g=world.spacePaintRevision||0,s=world.spacePaintSurfaceRevision||0;
  if(old&&old.versions.g===g&&old.versions.s===s)return {writes:0};
  const rows=new Map(old?.rows||[]);let writes=0;
  const update=(prefix,entries)=>{
   const seen=new Set();for(const [id,ord,value] of entries){
    const key=prefix+id,payload=this.serialized(value),prior=rows.get(key);seen.add(key);
    if(prior?.ord===ord&&prior.payload===payload)continue;
    this.sql.exec('INSERT OR REPLACE INTO space_paint_archive_rows (key,ord,payload) VALUES (?,?,?)',key,ord,payload);
    rows.set(key,{key,ord,payload});writes++;
   }
   for(const key of rows.keys())if(key.startsWith(prefix)&&!seen.has(key)){this.sql.exec('DELETE FROM space_paint_archive_rows WHERE key=?',key);rows.delete(key);writes++;}
  };
  if(!old||old.versions.g!==g){
   let ord=-1;const entries=[];
   for(const stroke of world.spacePaint||[]){
    const prior=rows.get('g:'+stroke.id);ord=Math.max(ord+1,prior?.ord??0);
    entries.push([stroke.id,ord,stroke]);
   }
   update('g:',entries);
  }
  if(!old||old.versions.s!==s)update('s:',Object.entries(world.spacePaintSurface||{}).map(([id,value])=>[id,0,value]));
  const versions={g,s,token:globalThis.crypto.randomUUID()},meta=JSON.stringify(versions);
  this.sql.exec("INSERT OR REPLACE INTO space_paint_archive_rows (key,ord,payload) VALUES ('meta',-1,?)",meta);
  this.cache={meta,versions,rows};return {writes};
 }
}
export function externalPaintCheckpoint(world){
 return JSON.stringify({...world,spacePaint:[],spacePaintSurface:{},spacePaintExternalV118:true});
}
