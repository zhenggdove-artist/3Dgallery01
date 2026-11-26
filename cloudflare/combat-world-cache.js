// Static scene fields are read-only during attack and tick processing. All
// economic, editor and other non-combat actions retain the normal full-copy
// path. The SQLite storage format is unchanged and remains a complete JSON
// snapshot; there is no delayed durability or partial write.
const STATIC=new Set(['sceneArchive','customWings','customArtworks','artworkLayoutHistory','wallPaint','discPaint','plants','artworkLayout','floatingPlatforms','customPedestals','platformOverrides','removedPlatformIds','removedArtworkIds']);
function freezeTree(value){
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  for(const child of Object.values(value))freezeTree(child);
  Object.freeze(value);
 }
 return value;
}
export function encodeCombatWorld(world,prior=null){
 const records=new Map(),dynamic={},staticJSON=[];
 for(const [key,value] of Object.entries(world)){
  if(!STATIC.has(key)){dynamic[key]=value;continue;}
  const old=prior?.records.get(key),record=old?.value===value?old:{value:freezeTree(value),json:JSON.stringify(value)};
  records.set(key,record);
  if(record.json!==undefined)staticJSON.push(JSON.stringify(key)+':'+record.json);
 }
 const dynamicPayload=JSON.stringify(dynamic);
 // Materialize a complete checkpoint only when a noncombat reader or a
 // checkpoint actually requires it. Hot contact writes use the overlay.
 let payload;
 return {records,dynamicPayload,get payload(){if(payload===undefined){const tail=staticJSON.join(',');payload=tail?dynamicPayload.slice(0,-1)+(dynamicPayload.length>2?',':'')+tail+'}':dynamicPayload;}return payload;}};
}
export function forkCombatWorld(encoded){
 const world=JSON.parse(encoded.dynamicPayload);
 for(const [key,record] of encoded.records)world[key]=record.value;
 return world;
}
