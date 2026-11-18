// A BAG slot contains a real individual gear instance, not just a catalog ID.
// Existing combat and UI continue to use profile.fusion[itemId] as a projected
// equipped/selected view; the authoritative ledger is keyed by instance UID.
const newUid=()=>crypto.randomUUID();

export function ensureFusionIdentity(profile){
 profile.inventory??=[];
 const previous=Array.isArray(profile.inventoryInstances)?profile.inventoryInstances:[];
 const used=new Set();
 const current=profile.inventory.map((itemId,index)=>{
  let found=previous[index];
  if(!found||found.itemId!==itemId||used.has(found.uid))
   found=previous.find(record=>record?.itemId===itemId&&!used.has(record.uid));
  const uid=found?.uid||newUid();
  used.add(uid);
  return {uid,itemId};
 });
 profile.inventoryInstances=current;
 profile.fusionByInstance??={};
 profile.equippedInstanceIds??={};
 profile.fusion??={};
 // One-time migration of pre-instance profiles. Old client retries could
 // inflate 'attempts' well past the number of completed upgrades. An older
 // record cannot distinguish legitimate retries from duplicates, so preserve
 // its successful layers and reset its chance progression to those layers.
 if(!profile.fusionIdentityMigrated){
  for(const [itemId,original] of Object.entries(profile.fusion)){
   if(!original||typeof original!=='object')continue;
   const slot=Object.entries(profile.equipment||{}).find(([,id])=>id===itemId)?.[0];
   const preferred=current.find(row=>row.itemId===itemId&&
    (slot?row.uid===profile.equippedInstanceIds[slot]:false))||
    current.find(row=>row.itemId===itemId);
   if(!preferred)continue;
   const layer=Math.max(0,Math.floor(Number(original.layer)||0));
   const oldAttempts=Math.max(0,Math.floor(Number(original.attempts??original.layer)||0));
   const record={...original,attempts:Math.min(oldAttempts,layer)};
   if(oldAttempts>layer)record.legacyAttemptsBeforeRepair=oldAttempts;
   profile.fusionByInstance[preferred.uid]=record;
   profile.fusion[itemId]=record;
  }
  profile.fusionIdentityMigrated=true;
 }
 for(const [slot,itemId] of Object.entries(profile.equipment||{})){
  if(!itemId){delete profile.equippedInstanceIds[slot];continue;}
  const uid=profile.equippedInstanceIds[slot];
  if(!current.some(v=>v.uid===uid&&v.itemId===itemId)){
   const entry=current.find(v=>v.itemId===itemId&&profile.fusionByInstance[v.uid])||
    current.find(v=>v.itemId===itemId);
   if(entry)profile.equippedInstanceIds[slot]=entry.uid;
   else delete profile.equippedInstanceIds[slot];
  }
 }
 const valid=new Set(current.map(v=>v.uid));
 for(const uid of Object.keys(profile.fusionByInstance))if(!valid.has(uid))
  delete profile.fusionByInstance[uid];
 return profile;
}

export function fusionRecordAt(profile,index){
 const itemId=profile.inventory?.[index],uid=profile.inventoryInstances?.[index]?.uid;
 if(!itemId||!uid)return {};
 const direct=profile.fusionByInstance?.[uid];
 if(direct)return direct;
 // Older tests or save rehydration can provide a legacy record after
 // initialization; never share a record between two *actual* instances.
 const owned=profile.inventoryInstances||[];
 if(owned.some(row=>row.itemId===itemId&&profile.fusionByInstance?.[row.uid]))return {};
 return profile.fusion?.[itemId]||{};
}

export function inventoryIndexFor(profile,itemId,index){
 if(Number.isInteger(index))
  return profile.inventory[index]===itemId?index:-1;
 const slot=Object.entries(profile.equipment||{}).find(([,id])=>id===itemId)?.[0];
 const uid=slot&&profile.equippedInstanceIds?.[slot];
 const equippedIndex=uid?profile.inventoryInstances?.findIndex(entry=>entry.uid===uid&&entry.itemId===itemId):-1;
 return equippedIndex>=0?equippedIndex:profile.inventory.indexOf(itemId);
}

export function fusionRecordFor(profile,itemId,index){
 ensureFusionIdentity(profile);
 const position=inventoryIndexFor(profile,itemId,index);
 return position<0?profile.fusion?.[itemId]||{}:fusionRecordAt(profile,position);
}

export function projectFusionForInstance(profile,itemId,uid){
 const equipSlot=Object.entries(profile.equipment||{}).find(([,id])=>id===itemId)?.[0];
 const active=equipSlot&&profile.equippedInstanceIds?.[equipSlot];
 if(active&&active!==uid)return; // Do not buff another copy that is equipped.
 const record=profile.fusionByInstance?.[uid];
 if(record)profile.fusion[itemId]=record;
 else delete profile.fusion[itemId];
}

export function selectEquipmentInstance(profile,slot,index){
 ensureFusionIdentity(profile);
 const entry=profile.inventoryInstances[index];
 if(!entry)return false;
 profile.equipment[slot]=entry.itemId;
 profile.equippedInstanceIds[slot]=entry.uid;
 projectFusionForInstance(profile,entry.itemId,entry.uid);
 return true;
}

export function appendInventoryInstance(profile,itemId){
 ensureFusionIdentity(profile);
 profile.inventory.push(itemId);
 profile.inventoryInstances.push({uid:newUid(),itemId});
}

export function removeInventoryInstance(profile,index,replacementUid=null){
 ensureFusionIdentity(profile);
 const record=profile.inventoryInstances[index];
 if(!record)return null;
 profile.inventory.splice(index,1);
 profile.inventoryInstances.splice(index,1);
 delete profile.fusionByInstance[record.uid];
 for(const [slot,uid] of Object.entries(profile.equippedInstanceIds)){
  if(uid!==record.uid)continue;
  const replacement=profile.inventoryInstances.find(entry=>entry.uid===replacementUid&&entry.itemId===record.itemId);
  if(replacement){
   profile.equippedInstanceIds[slot]=replacement.uid;
  }else{
   profile.equipment[slot]=null;
   delete profile.equippedInstanceIds[slot];
  }
 }
 const surviving=profile.inventoryInstances.filter(entry=>entry.itemId===record.itemId);
 if(!surviving.length)delete profile.fusion[record.itemId];
 else{
  const equippedUid=Object.entries(profile.equipment||{})
   .filter(([,id])=>id===record.itemId)
   .map(([slot])=>profile.equippedInstanceIds[slot]).find(Boolean);
  const chosen=surviving.find(entry=>entry.uid===equippedUid)||surviving[0];
  projectFusionForInstance(profile,record.itemId,chosen.uid);
 }
 return record;
}

export function swapInventoryInstances(profile,from,to){
 ensureFusionIdentity(profile);
 [profile.inventory[from],profile.inventory[to]]=[profile.inventory[to],profile.inventory[from]];
 [profile.inventoryInstances[from],profile.inventoryInstances[to]]=
  [profile.inventoryInstances[to],profile.inventoryInstances[from]];
}
