// Changes are based on the last WORLD sent on this socket, never an HTTP
// response. A welcome/full frame reestablishes the baseline after hibernation.
export function changedWorldFields(previous,next,skip=new Set()){
 const fields={};
 for(const [key,value] of Object.entries(next)){
  if(skip.has(key)||value===undefined)continue;
  if(key==='spacePaint'&&previous.spacePaint!==undefined&&previous.spacePaintRevision===next.spacePaintRevision)continue;
  if(key==='spacePaintSurface'&&previous.spacePaintSurface!==undefined&&previous.spacePaintSurfaceRevision===next.spacePaintSurfaceRevision)continue;
  if(value!==previous[key]&&JSON.stringify(value)!==JSON.stringify(previous[key]))fields[key]=value;
 }
 return fields;
}
const headerKeys=new Set(['cityDamage','revision','serverTime']);
const commonHeaderKeys=new Set([...headerKeys,'profile']);
const serializeCityRecord=(_id,record)=>JSON.stringify(record);
const surfaceHeaderKeys=new Set([...headerKeys,'spacePaintSurface']),surfaceCommonHeaderKeys=new Set([...commonHeaderKeys,'spacePaintSurface']);
export function createWorldPatch(previous,next,ignoreProfile=false,serializeNextCityRecord=serializeCityRecord,surfaceDelta=false,paintDelta=false){
 const skip=surfaceDelta?(ignoreProfile?surfaceCommonHeaderKeys:surfaceHeaderKeys):(ignoreProfile?commonHeaderKeys:headerKeys);
 const fields=changedWorldFields(previous,next,paintDelta?new Set([...skip,'spacePaint']):skip),city={};
 const oldCity=previous.cityDamage||{},newCity=next.cityDamage||{};
 for(const [id,record] of Object.entries(newCity))if(serializeNextCityRecord(id,record)!==JSON.stringify(oldCity[id]))city[id]=record;
 for(const id of Object.keys(oldCity))if(!Object.hasOwn(newCity,id))city[id]=null;
 let spaceSurface;
 if(surfaceDelta&&(previous.spacePaintSurfaceRevision!==next.spacePaintSurfaceRevision||previous.spacePaintSurface===undefined)){
  const old=previous.spacePaintSurface||{},fresh=next.spacePaintSurface||{};spaceSurface={};
  for(const [id,value] of Object.entries(fresh))if(value!==old[id]&&JSON.stringify(value)!==JSON.stringify(old[id]))spaceSurface[id]=value;
  for(const id of Object.keys(old))if(!Object.hasOwn(fresh,id))spaceSurface[id]=null;
 }
 let spaceGeometry;
 if(paintDelta&&(previous.spacePaintRevision!==next.spacePaintRevision||previous.spacePaint===undefined)){
  const old=previous.spacePaint||[],fresh=next.spacePaint||[],before=new Map(old.map(s=>[s.id,s])),after=new Set(fresh.map(s=>s.id));
  const remove=old.filter(s=>!after.has(s.id)).map(s=>s.id),add=fresh.filter(s=>!before.has(s.id)||before.get(s.id)!==s&&JSON.stringify(before.get(s.id))!==JSON.stringify(s));
  const expected=[...old.filter(s=>after.has(s.id)).map(s=>s.id),...add.filter(s=>!before.has(s.id)).map(s=>s.id)];
  const order=expected.length!==fresh.length||fresh.some((s,i)=>s.id!==expected[i])?fresh.map(s=>s.id):undefined;
  if(remove.length||add.length||order)spaceGeometry={remove,add,...(order?{order}:{})};
 }
 return {base:previous.revision,revision:next.revision,serverTime:next.serverTime,fields,...(Object.keys(city).length?{city}:{}),...(spaceSurface&&Object.keys(spaceSurface).length?{spaceSurface}:{}),...(spaceGeometry?{spaceGeometry}:{})};
}

export function applyWorldPatch(previous,patch){
 if(!previous||previous.revision!==patch.base||patch.revision<=patch.base)return null;
 let cityDamage=previous.cityDamage;
 if(patch.city){cityDamage={...cityDamage};for(const [id,record] of Object.entries(patch.city)){if(record===null)delete cityDamage[id];else cityDamage[id]=record;}}
 const profile=patch.profile&&previous.profile?{...previous.profile,...patch.profile}:
  Object.hasOwn(patch.fields,'profile')?patch.fields.profile:previous.profile;
 let spacePaintSurface=previous.spacePaintSurface;
 if(patch.spaceSurface){
  spacePaintSurface={...(spacePaintSurface||{})};
  for(const [id,value] of Object.entries(patch.spaceSurface))if(value===null)delete spacePaintSurface[id];else Object.defineProperty(spacePaintSurface,id,{value,writable:true,configurable:true,enumerable:true});
 }
 let spacePaint=previous.spacePaint;
 if(patch.spaceGeometry){
  const map=new Map((spacePaint||[]).map(s=>[s.id,s]));for(const id of patch.spaceGeometry.remove)map.delete(id);for(const s of patch.spaceGeometry.add)map.set(s.id,s);
  spacePaint=patch.spaceGeometry.order?patch.spaceGeometry.order.map(id=>map.get(id)):[...map.values()];
  if(spacePaint.some(s=>!s))return null;
 }
 return {...previous,...patch.fields,...(patch.spaceGeometry?{spacePaint}:{}),...(patch.spaceSurface?{spacePaintSurface}:{}),profile,cityDamage,revision:patch.revision,serverTime:patch.serverTime};
}

// Catalog updates are independent of combat revisions. A previously queued
// world packet may contain an older full catalog; never drop newer definitions.
export function mergeWingCatalog(previous=[],incoming=[]){
 const map=new Map(previous.map(w=>[w.id,w]));let changed=false;
 const time=w=>Math.max(w?.createdAt||0,w?.updatedAt||0,w?.retiredAt||0);
 for(const item of incoming){
  if(!item?.id)continue;
  const old=map.get(item.id);if(old===item)continue;
  if(!old||time(item)>=time(old)&&JSON.stringify(old)!==JSON.stringify(item)){
   map.set(item.id,item);changed=true;
  }
 }
 return changed?[...map.values()]:previous;
}

// A full HTTP response has fresh JSON identities even for unchanged scene
// data. Retain only equal, already-rendered sections; never reuse a changed
// field, invent a revision or alter the socket's independent patch baseline.
const sceneSnapshotKeys=['environment','audioSettings','customArtworks','artworks','artworkLayout','floatingPlatforms','customPedestals','platformOverrides','removedPlatformIds','structures','cityDamage','wallPaint','discPaint','spacePaint','spacePaintSurface','groundDrops','coins','equipmentTuning','shopPrices','delistedShopItems','wantedSettings','chatDefault','artworkPromptPositions','collector'];
export function reuseHttpSceneFields(previous,next){
 if(!previous||!next)return next;
 let result=next;
 for(const key of sceneSnapshotKeys){
  const old=previous[key],fresh=next[key];
  if(old===fresh||old==null||fresh==null||typeof old!=='object'||typeof fresh!=='object')continue;
  if(JSON.stringify(old)===JSON.stringify(fresh)){if(result===next)result={...next};result[key]=old;}
 }
 return result;
}
