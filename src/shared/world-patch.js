// Changes are based on the last WORLD sent on this socket, never an HTTP
// response. A welcome/full frame reestablishes the baseline after hibernation.
export function changedWorldFields(previous,next,skip=new Set()){
 const fields={};
 for(const [key,value] of Object.entries(next)){
  if(skip.has(key)||value===undefined)continue;
  if(value!==previous[key]&&JSON.stringify(value)!==JSON.stringify(previous[key]))fields[key]=value;
 }
 return fields;
}
const headerKeys=new Set(['cityDamage','revision','serverTime']);
const commonHeaderKeys=new Set([...headerKeys,'profile']);
const serializeCityRecord=(_id,record)=>JSON.stringify(record);
export function createWorldPatch(previous,next,ignoreProfile=false,serializeNextCityRecord=serializeCityRecord){
 const fields=changedWorldFields(previous,next,ignoreProfile?commonHeaderKeys:headerKeys),city={};
 const oldCity=previous.cityDamage||{},newCity=next.cityDamage||{};
 for(const [id,record] of Object.entries(newCity))if(serializeNextCityRecord(id,record)!==JSON.stringify(oldCity[id]))city[id]=record;
 for(const id of Object.keys(oldCity))if(!Object.hasOwn(newCity,id))city[id]=null;
 return {base:previous.revision,revision:next.revision,serverTime:next.serverTime,fields,...(Object.keys(city).length?{city}:{})};
}

export function applyWorldPatch(previous,patch){
 if(!previous||previous.revision!==patch.base||patch.revision<=patch.base)return null;
 let cityDamage=previous.cityDamage;
 if(patch.city){cityDamage={...cityDamage};for(const [id,record] of Object.entries(patch.city)){if(record===null)delete cityDamage[id];else cityDamage[id]=record;}}
 const profile=patch.profile&&previous.profile?{...previous.profile,...patch.profile}:
  Object.hasOwn(patch.fields,'profile')?patch.fields.profile:previous.profile;
 return {...previous,...patch.fields,profile,cityDamage,revision:patch.revision,serverTime:patch.serverTime};
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
