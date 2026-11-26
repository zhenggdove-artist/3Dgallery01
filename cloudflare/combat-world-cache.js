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
 const records=new Map(),rows=new Map(),dynamicJSON=[],staticJSON=[];
 for(const [key,value] of Object.entries(world)){
  const quoted=JSON.stringify(key);
  if(STATIC.has(key)){
   const old=prior?.records.get(key),record=old?.value===value?old:{value:freezeTree(value),json:JSON.stringify(value)};
   records.set(key,record);
   if(record.json!==undefined){staticJSON.push(quoted+':'+record.json);rows.set('w:'+key,record.json);}
   continue;
  }
  // Serialize each profile once. Both the isolated combat fork and SQLite
  // journal use the exact same bytes, including thousands of inventory UIDs.
  if(key==='profiles'&&value&&typeof value==='object'&&!Array.isArray(value)){
   const parts=[];
   for(const [id,profile] of Object.entries(value)){
    const json=JSON.stringify(profile);
    if(json===undefined)continue;
    rows.set('p:'+id,json);parts.push(JSON.stringify(id)+':'+json);
   }
   dynamicJSON.push(quoted+':{'+parts.join(',')+'}');
   continue;
  }
  const json=JSON.stringify(value);
  if(json===undefined)continue;
  dynamicJSON.push(quoted+':'+json);
  if(key!=='profiles')rows.set('w:'+key,json);
 }
 const dynamicPayload='{'+dynamicJSON.join(',')+'}';
 // Construct the full checkpoint only on demand. No second stringify of
 // the large dynamic world or profiles is needed by the hot journal path.
 let payload;
 return {records,rows,dynamicPayload,get payload(){if(payload===undefined){const tail=staticJSON.join(',');payload=tail?dynamicPayload.slice(0,-1)+(dynamicPayload.length>2?',':'')+tail+'}':dynamicPayload;}return payload;}};
}
export function forkCombatWorld(encoded){
 const world=JSON.parse(encoded.dynamicPayload);
 for(const [key,record] of encoded.records)world[key]=record.value;
 return world;
}
