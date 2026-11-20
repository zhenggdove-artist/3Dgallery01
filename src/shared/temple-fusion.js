import {itemById} from './catalog.js';
import {equippedItem} from './fusion-adapter.js';
import {ensureFusionIdentity,fusionRecordAt,inventoryIndexFor,projectFusionForInstance,removeInventoryInstance} from './fusion-instances.js';
import {itemAffixes} from '../reletter/combat-traits.js';
import {sniperMaterialStat} from './fusion-balance.js';

// Only SUCCESSFUL fusions lower the odds for this physical target:
// 0 successes -> 50%, 1 -> 25%, 2 -> 12.5% and so forth.
// Failed rolls consume the ingredient but do not advance the upgrade tier.
// Duplicate request IDs return their original receipt without another roll.
export function fusionChance(profile,targetId,targetIndex){
 if(profile.admin)return Math.max(0,Math.min(1,Number.isFinite(profile.gmFusionChance)?profile.gmFusionChance:1));
 const raw=fusionRecordForChance(profile,targetId,targetIndex);
 const successfulFusions=Math.max(0,Math.floor(Number(raw.layer)||0));
 return 2**(-(successfulFusions+1));
}
function fusionRecordForChance(profile,targetId,targetIndex){
 ensureFusionIdentity(profile);
 const index=inventoryIndexFor(profile,targetId,targetIndex);
 return index>=0?fusionRecordAt(profile,index):profile.fusion?.[targetId]||{};
}
// Only the server mutates inventory, spending, fusion properties and ultimate echoes.
export function fuseTemple(world,profile,body,rng=Math.random){
 const source=itemById(body.sourceId),target=itemById(body.targetId),requestId=String(body.requestId||'');
 if(requestId.length<8||requestId.length>80)return {error:'Missing fusion request ID'};
 profile.fusionReceipts??={};
 if(profile.fusionReceipts[requestId])return structuredClone(profile.fusionReceipts[requestId]);
 const equip=new Set(['weapon','head','armor','outfit','wings','shield']);
 if(!source||!target||!equip.has(target.slot)||!equip.has(source.slot))
  return {error:'Select two owned equippable items of the same category'};
 // Weapon→weapon, head→head, outfit→outfit, wings→wings, and likewise
 // for shield/armor. No cross-slot or raw crafting-material fusion.
 if(source.slot!==target.slot)return {error:'Fusion requires matching equipment categories'};
 ensureFusionIdentity(profile);
 // Precise slot references must match both the ID and the immutable UID sent
 // with a drag. This makes late/duplicate gestures harmless after a reorder.
 let sourceIndex=inventoryIndexFor(profile,source.id,body.sourceIndex);
 let targetIndex=inventoryIndexFor(profile,target.id,body.targetIndex);
 if(source.id===target.id&&sourceIndex===targetIndex&&
    !Number.isInteger(body.sourceIndex)&&!Number.isInteger(body.targetIndex)){
  const copies=profile.inventory.flatMap((id,i)=>id===source.id?[i]:[]);
  sourceIndex=copies[0]??-1;
  targetIndex=copies[1]??-1;
 }
 if(sourceIndex<0||targetIndex<0||
    (source.id===target.id&&sourceIndex===targetIndex))
  return {error:'Both items must be owned (identical IDs require two copies)'};
 const materialInstance=profile.inventoryInstances[sourceIndex];
 const targetInstance=profile.inventoryInstances[targetIndex];
 if(body.sourceInstanceUid&&body.sourceInstanceUid!==materialInstance.uid||
    body.targetInstanceUid&&body.targetInstanceUid!==targetInstance.uid)
  return {error:'Inventory changed during drag; select the items again'};
 const old=fusionRecordAt(profile,targetIndex),layer=(old.layer||0)+1;
 if(layer>20)return {error:'Fusion limit reached (20)'};
 const cost=0; // Equipment fusion never charges coins.
 const chance=fusionChance(profile,target.id,targetIndex);
 const sample=Math.max(0,Math.min(1,Number(rng())));
 const main=equippedItem(profile,target,old);
 const material=equippedItem(profile,source,fusionRecordAt(profile,sourceIndex));
 // Exactly one physical ingredient is consumed on success or failure.
 removeInventoryInstance(profile,sourceIndex,targetInstance.uid);
 if(source.id==='white-cat'&&!profile.inventory.includes(source.id))profile.spentStarterWeapon=true;
 const completed=Math.max(0,Math.floor(Number(old.layer)||0));
 if(!(sample<chance)){
  // Retain successful progress unchanged after a miss: no progression penalty.
  // Normalize legacy 'attempts' so it never leaks the old failure counter to UI.
  const attempts=completed;
  profile.fusionByInstance[targetInstance.uid]={...old,attempts};
  projectFusionForInstance(profile,target.id,targetInstance.uid);
  const result={notice:'FUSION FAILED · material consumed · '+(chance*100).toFixed(5)+'% chance',
   fusion:{success:false,target:target.id,layer:completed,attempts,cost,chance,nextAttempt:completed+1,nextChance:fusionChance(profile,target.id,profile.inventoryInstances.findIndex(row=>row.uid===targetInstance.uid))}};
  profile.fusionReceipts[requestId]=structuredClone(result);
  const receipts=Object.keys(profile.fusionReceipts);
  if(receipts.length>64)delete profile.fusionReceipts[receipts[0]];
  return result;
 }
 const stats={...(old.templeStats||{})};
 // Remove legacy inherited long-range stats so subsequent server saves no
 // longer retain oversized normal collision dimensions.
 if(target.slot==='weapon'){
  // Retroactively strip inherited geometry, including chargeRange, for all
  // weapon families. Ingredients cannot move the primary ultimate's landing.
  delete stats.range;delete stats.chargeRange;delete stats.radius;
 }
 // Affixes always accumulate; only ULTIMATE echoes have the two-source limit.
 const affixIds=[...new Set([...itemAffixes(main),...itemAffixes(material),
  ...itemAffixes(old),...itemAffixes(old.original)])];
 const effects=(old.effects||[]).filter(id=>itemById(id)?.slot==='weapon').slice(0,2);
 const grantsEcho=target.slot==='weapon'&&source.slot==='weapon'&&effects.length<2;
 const keys=['damage','chargeDamage','range','chargeRange','radius','defense','capacity','impulse','speed','jump'];
 for(const key of keys){
  const sniperPower=source.id==='black-cat'&&['damage','chargeDamage'].includes(key);
  // A sniper source may contribute 30% of its original shot EITHER as
  // its visible echo (first two slots) OR as stats (later slots), not both.
  // Also ignore any previously inflated stats on the consumed sniper.
  if(sniperPower&&grantsEcho)continue;
  // Close-contact strikes retain the primary weapon's own contact reach.
  // Weapon reach is determined by the actual held model, not the ingredient.
  if(target.slot==='weapon'&&['range','chargeRange','radius'].includes(key))continue;
  const a=sniperPower?sniperMaterialStat(source,key):Number(material[key]),b=Number(main[key])||0;
  if(!(a>0))continue;
  const cap=['range','chargeRange'].includes(key)?400:key==='radius'?80:key==='defense'?300:100000;
  stats[key]=+Math.min(cap,b+a*.3).toFixed(3);
 }
 let bonus=Number(old.bonus)||0;
  if(grantsEcho)effects.push(source.id);
 // A successful upgrade is the ONLY event advancing fusion progression.
 const attempts=layer;
 profile.fusionByInstance[targetInstance.uid]={...old,layer,attempts,bonus,templeStats:stats,effects,affixIds,affixId:affixIds[0]||null,
  sources:[...(old.sources||[]),{id:source.id,name:source.name,statPercent:30,echo:grantsEcho}]};
 projectFusionForInstance(profile,target.id,targetInstance.uid);
 const result={notice:'FUSION SUCCESS · '+target.name+' +'+layer+
  (grantsEcho?' · ULTIMATE ECHO '+effects.length+'/2':' · STATS +30%'),
  fusion:{success:true,target:target.id,layer,attempts,cost,chance,nextAttempt:layer+1,nextChance:fusionChance(profile,target.id,profile.inventoryInstances.findIndex(row=>row.uid===targetInstance.uid)),effects:[...effects],affixIds:[...affixIds]}};
 profile.fusionReceipts[requestId]=structuredClone(result);
 const receipts=Object.keys(profile.fusionReceipts);
 if(receipts.length>64)delete profile.fusionReceipts[receipts[0]];
 return result;
}
