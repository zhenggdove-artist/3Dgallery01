// A BAG slot contains a real individual gear instance, not just a catalog ID.
// Existing combat and UI continue to use profile.fusion[itemId] as a projected
// equipped/selected view; the authoritative ledger is keyed by instance UID.
import {itemById} from './catalog.js';
import {rollWeaponAffixes} from './weapon-affixes.js';
const newUid=()=>crypto.randomUUID();
// A legacy profile can still contain a pre-instance upgrade projection. Keep
// it when converting a virgin enchant-only UID record, but NEVER transfer a
// record already owned by another physical UID.
function detachedLegacyRecord(profile,itemId,uid,direct){
 const projected=profile.fusion?.[itemId];
 // Persisted JSON detaches legacy projection objects from their owning UID.
 // A collapsed ×N stack cannot inherit one target copy's fusion progress.
 if(profile.fusionIdentityMigrated){
  const copies=profile.inventoryInstances?.filter(row=>row.itemId===itemId)||[];
  if(copies.some(row=>row.uid!==uid&&
    (profile.fusionByInstance?.[row.uid]?.layer||profile.fusionByInstance?.[row.uid]?.templeStats)))
   return null;
  if(copies[0]?.uid!==uid)return null;
 }
 if(!projected||typeof projected!=='object'||projected===direct)return null;
 const equippedSlot=Object.entries(profile.equipment||{}).find(([,selected])=>selected===itemId)?.[0];
 if(equippedSlot&&profile.equippedInstanceIds?.[equippedSlot]&&profile.equippedInstanceIds[equippedSlot]!==uid)return null;
 if(Object.entries(profile.fusionByInstance||{}).some(([id,record])=>id!==uid&&record===projected))
  return null;
 if(direct?.layer||direct?.templeStats||direct?.original||direct?.effects?.length||
    direct?.affixIds?.length)return null;
 if(!(projected.layer||projected.templeStats||projected.original||
    projected.effects?.length||projected.affixIds?.length||projected.bonus))return null;
 return {...direct,...projected,weaponAffixes:direct?.weaponAffixes||projected.weaponAffixes};
}
// Server migration is idempotent: previously owned equipment receives a
// randomly rolled property ONCE, tied to its immutable inventory UID.
export function ensureWeaponAffixes(profile,rng=Math.random){
 if(!profile.inventoryInstances)ensureFusionIdentity(profile);
 for(const row of profile.inventoryInstances||[]){
  if(itemById(row.itemId)?.slot!=='weapon')continue;
  if(row.origin!=='ground'){
   // Shop and grants have the same fixed stats, but still need an editable
   // per-instance record so fusion and existing gameplay retain their contract.
   profile.fusionByInstance[row.uid]??={weaponAffixes:[]};
   // Legacy and freshly migrated instances must retain their price-paid tier.
   if(Number.isInteger(row.shopTier))profile.fusionByInstance[row.uid].shopTier=row.shopTier;
   continue;
  }
  const old=profile.fusionByInstance?.[row.uid]||{};
  if(Array.isArray(old.weaponAffixes)&&old.weaponAffixes.length)continue;
  // Do not clone previously projected records: the original reference still
  // identifies the upgraded physical UID, not a different virgin copy.
  if(profile.fusionByInstance[row.uid])old.weaponAffixes=rollWeaponAffixes(itemById(row.itemId),rng);
  else profile.fusionByInstance[row.uid]={weaponAffixes:rollWeaponAffixes(itemById(row.itemId),rng)};
 }
 const itemId=profile.equipment?.weapon;
 const uid=profile.equippedInstanceIds?.weapon;
 if(uid&&itemId&&profile.inventoryInstances?.some(row=>row.uid===uid&&row.itemId===itemId)){
  const preserved=detachedLegacyRecord(profile,itemId,uid,profile.fusionByInstance?.[uid]);
  if(preserved)profile.fusionByInstance[uid]=preserved;
  projectFusionForInstance(profile,itemId,uid);
 }
 return profile;
}

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
  // Per-instance provenance. Never infer a newly purchased item's stats from catalog ID.
  const source=profile.itemOrigins?.[itemId];
  const origin=found?.origin||(source==='monster'||source==='ground'?'ground':source==='shop'?'shop':'grant');
  return {uid,itemId,origin,acquiredAt:Number.isFinite(found?.acquiredAt)?found.acquiredAt:index,...(Number.isSafeInteger(found?.paidUnitPrice)?{paidUnitPrice:found.paidUnitPrice}:{}),viewed:found?.viewed!==false,...(Number.isInteger(found?.shopTier)?{shopTier:found.shopTier}:{})};
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
 // Versioned, one-time repair for profiles that already migrated to stable
 // instance UIDs under the former failure-count rule. Failure history must
 // never reduce the success-only chance or appear as completed fusions.
 if(!profile.fusionSuccessOnlyMigrated){
  const seen=new Set();
  for(const record of [...Object.values(profile.fusionByInstance),...Object.values(profile.fusion)]){
   if(!record||typeof record!=='object'||seen.has(record))continue;
   seen.add(record);
   const completed=Math.max(0,Math.floor(Number(record.layer)||0));
   const historical=Math.max(0,Math.floor(Number(record.attempts??completed)||0));
   if(historical>completed)
    record.legacyAttemptsBeforeRepair=Math.max(historical,
     Number(record.legacyAttemptsBeforeRepair)||0);
   record.attempts=completed;
  }
  profile.fusionSuccessOnlyMigrated=true;
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
 if(direct)return detachedLegacyRecord(profile,itemId,uid,direct)||direct;
 // Older tests or save rehydration can provide a legacy record after
 // initialization; never share a record between two *actual* instances.
 const owned=profile.inventoryInstances||[];
  if(owned.some(row=>row.itemId===itemId&&profile.fusionByInstance?.[row.uid]))return {};
  // No direct UID record: at most the FIRST legacy physical copy can inherit.
  if(profile.fusionIdentityMigrated&&owned.find(row=>row.itemId===itemId)?.uid!==uid)return {};
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

export function appendInventoryInstance(profile,itemId,origin='ground',shopTier=null,paidUnitPrice=null){
 ensureFusionIdentity(profile);
 profile.inventory.push(itemId);
 const uid=newUid();
 profile.inventoryInstances.push({uid,itemId,origin,acquiredAt:Date.now(),viewed:false,...(Number.isSafeInteger(paidUnitPrice)?{paidUnitPrice}:{}),
  ...(Number.isInteger(shopTier)?{shopTier}:{})});
 if(itemById(itemId)?.slot==='weapon'){
  profile.fusionByInstance??={};
  profile.fusionByInstance[uid]={
   weaponAffixes:origin==='ground'?rollWeaponAffixes(itemById(itemId)):[],
   ...(Number.isInteger(shopTier)?{shopTier}:{})
  };
 }
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
