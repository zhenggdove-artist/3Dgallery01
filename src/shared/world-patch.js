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
export function createWorldPatch(previous,next,ignoreProfile=false){
 const fields=changedWorldFields(previous,next,ignoreProfile?commonHeaderKeys:headerKeys),city={};
 const oldCity=previous.cityDamage||{},newCity=next.cityDamage||{};
 for(const [id,record] of Object.entries(newCity))if(JSON.stringify(record)!==JSON.stringify(oldCity[id]))city[id]=record;
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
