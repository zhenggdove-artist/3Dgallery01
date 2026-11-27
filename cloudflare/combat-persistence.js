// The existing world_state row remains the full checkpoint. The overlay is
// a durable, atomic journal of the latest changed fields (not an event log).
// A cold start reconstructs EXACTLY the last committed world, including deletes.
// Only unchanged large fields are omitted from each SQLite write.
export function combatRows(world,encoded,externalPaint=false){
 const rows=new Map();
 for(const [key,value] of Object.entries(world)){
  if(externalPaint&&(key==='spacePaint'||key==='spacePaintSurface'))continue;
  if(key==='profiles'){
   if(encoded?.hasProfiles){for(const [rowKey,json] of encoded.profileRows)rows.set(rowKey,json);}
   else for(const [id,profile] of Object.entries(value||{}))
    rows.set('p:'+id,JSON.stringify(profile));
  }else{
   const json=encoded?.records.get(key)?.json??JSON.stringify(value);
   if(json!==undefined)rows.set('w:'+key,json);
  }
 }
 return rows;
}
export function writeCombatDelta(sql,previous,next){
 let bytes=0,writes=0;
 for(const [key,json] of next){
  if(previous.get(key)===json)continue;
  sql.exec('INSERT OR REPLACE INTO combat_world_overlay (key,payload) VALUES (?,?)',key,json);
  writes++;bytes+=json.length;
 }
 for(const key of previous.keys())if(!next.has(key)){
  sql.exec('INSERT OR REPLACE INTO combat_world_overlay (key,payload) VALUES (?,NULL)',key);writes++;
 }
 return {writes,bytes};
}
export function restoreCombatOverlay(world,rows){
 for(const {key,payload} of rows){
  const parent=key.startsWith('p:')?(world.profiles??={}):world;
  const field=key.slice(2);
  if(payload===null)delete parent[field];
  else Object.defineProperty(parent,field,{value:JSON.parse(payload),writable:true,enumerable:true,configurable:true});
 }
 return world;
}
