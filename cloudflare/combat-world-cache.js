// Isolate authoritative combat mutations from the committed snapshot. Large
// inactive BAG ledgers are materialized only if game rules actually access
// them. Durability, JSON checkpoint/overlay format and simulation stay intact.
const STATIC=new Set(['sceneArchive','customWings','customArtworks','artworkLayoutHistory','wallPaint','discPaint','spacePaint','spacePaintSurface','plants','artworkLayout','floatingPlatforms','customPedestals','platformOverrides','removedPlatformIds','removedArtworkIds']);
const LAZY=new Set(['inventory','inventoryInstances','fusionByInstance','retiredArmorInventory','fusion','itemOrigins','collectorSoldArtworks']);
const lazyFields=new WeakMap();
function freezeTree(value){
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  for(const child of Object.values(value))freezeTree(child);
  Object.freeze(value);
 }
 return value;
}
function encodeProfile(profile,prior){
 const fields=new Map(),deferred=lazyFields.get(profile);
 for(const key of Object.keys(profile)){
  const original=deferred?.get(key),descriptor=Object.getOwnPropertyDescriptor(profile,key);
  // The getter is replaced on the first read OR write. Untouched fields
  // retain their exact prior bytes and need neither parse nor stringify.
  const json=original&&descriptor.get===original.get?original.json:JSON.stringify(profile[key]);
  if(json!==undefined)fields.set(key,json);
 }
 if(prior&&fields.size===prior.fields.size&&[...fields].every(([key,json],i)=>prior.keys[i]===key&&prior.fields.get(key)===json))return prior;
 return {fields,keys:[...fields.keys()],json:'{'+[...fields].map(([key,json])=>JSON.stringify(key)+':'+json).join(',')+'}'};
}
function forkProfile(record){
 const profile={},deferred=new Map();
 for(const [key,json] of record.fields){
  const install=value=>Object.defineProperty(profile,key,{value,writable:true,configurable:true,enumerable:true});
  if(LAZY.has(key)&&(json[0]==='['||json[0]==='{')){
   const get=()=>{const value=JSON.parse(json);install(value);return value;};
   Object.defineProperty(profile,key,{get,set:install,configurable:true,enumerable:true});
   deferred.set(key,{get,json});
  }else install(JSON.parse(json));
 }
 lazyFields.set(profile,deferred);
 return profile;
}
export function encodeCombatWorld(world,prior=null){
 const records=new Map(),profiles=new Map(),profileRows=new Map(),dynamic={},staticJSON=[];
 const hasProfiles=Object.hasOwn(world,'profiles')&&world.profiles&&typeof world.profiles==='object'&&!Array.isArray(world.profiles);
 for(const [key,value] of Object.entries(world)){
  if(key==='profiles'&&hasProfiles){
   for(const [id,profile] of Object.entries(value)){
    const record=encodeProfile(profile,prior?.profiles?.get(id));
    profiles.set(id,record);profileRows.set('p:'+id,record.json);
   }
   continue;
  }
  if(!STATIC.has(key)){dynamic[key]=value;continue;}
  const old=prior?.records.get(key),record=old?.value===value?old:{value:freezeTree(value),json:JSON.stringify(value)};
  records.set(key,record);
  if(record.json!==undefined)staticJSON.push(JSON.stringify(key)+':'+record.json);
 }
 const dynamicBase=JSON.stringify(dynamic);
 let dynamicPayload,payload,checkpointPayload;
 return {records,profiles,profileRows,hasProfiles,dynamicBase,get dynamicPayload(){
  if(dynamicPayload===undefined){
   const tail=hasProfiles?'"profiles":{'+[...profiles].map(([id,record])=>JSON.stringify(id)+':'+record.json).join(',')+'}':'';
   dynamicPayload=tail?dynamicBase.slice(0,-1)+(dynamicBase.length>2?',':'')+tail+'}':dynamicBase;
  }
  return dynamicPayload;
 },get checkpointPayload(){if(checkpointPayload===undefined){const base=this.dynamicPayload,tail=[...records].filter(([key])=>key!=='spacePaint'&&key!=='spacePaintSurface').filter(([,r])=>r.json!==undefined).map(([key,r])=>JSON.stringify(key)+':'+r.json).concat(['"spacePaint":[]','"spacePaintSurface":{}','"spacePaintExternalV118":true']).join(',');checkpointPayload=base.slice(0,-1)+(base.length>2?',':'')+tail+'}';}return checkpointPayload;},get payload(){if(payload===undefined){const base=this.dynamicPayload,tail=staticJSON.join(',');payload=tail?base.slice(0,-1)+(base.length>2?',':'')+tail+'}':base;}return payload;}};
}
export function forkCombatWorld(encoded){
 const world=JSON.parse(encoded.dynamicBase);
 if(encoded.hasProfiles)world.profiles=Object.fromEntries([...encoded.profiles].map(([id,record])=>[id,forkProfile(record)]));
 for(const [key,record] of encoded.records)world[key]=record.value;
 return world;
}
