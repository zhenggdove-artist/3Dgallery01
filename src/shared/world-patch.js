// Changes are based on the last WORLD sent on this socket, never an HTTP
// response. A welcome/full frame reestablishes the baseline after hibernation.
export function createWorldPatch(previous,next,ignoreProfile=false){
 const fields={},city={};const nextEntries=Object.entries(next);
 for(const [key,value] of nextEntries){
  if(key==='cityDamage'||key==='revision'||key==='serverTime'||value===undefined||(ignoreProfile&&key==='profile'))continue;
  if(JSON.stringify(value)!==JSON.stringify(previous[key]))fields[key]=value;
 }
 const oldCity=previous.cityDamage||{},newCity=next.cityDamage||{};
 for(const [id,record] of Object.entries(newCity))if(JSON.stringify(record)!==JSON.stringify(oldCity[id]))city[id]=record;
 for(const id of Object.keys(oldCity))if(!Object.hasOwn(newCity,id))city[id]=null;
 return {base:previous.revision,revision:next.revision,serverTime:next.serverTime,fields,...(Object.keys(city).length?{city}:{})};
}

export function applyWorldPatch(previous,patch){
 if(!previous||previous.revision!==patch.base||patch.revision<=patch.base)return null;
 let cityDamage=previous.cityDamage;
 if(patch.city){cityDamage={...cityDamage};for(const [id,record] of Object.entries(patch.city)){if(record===null)delete cityDamage[id];else cityDamage[id]=record;}}
 return {...previous,...patch.fields,cityDamage,revision:patch.revision,serverTime:patch.serverTime};
}
