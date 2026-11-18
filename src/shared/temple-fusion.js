import {itemById,ECONOMY} from './catalog.js';
import {equippedItem} from './fusion-adapter.js';
import {itemAffixes} from '../reletter/combat-traits.js';
import {weaponRangeClass} from '../reletter/odd-weapons.js';

// Every attempt halves the non-GM chance, whether the previous attempt
// succeeded or failed. Legacy items start at their successful fusion count.
export function fusionChance(profile,targetId){
 const record=profile.fusion?.[targetId]||{};
 if(profile.admin)return Math.max(0,Math.min(1,Number.isFinite(profile.gmFusionChance)?profile.gmFusionChance:1));
 const attempts=Math.max(0,Math.floor(Number(record.attempts??record.layer)||0));
 return 2**(-(attempts+1));
}
// Only the server mutates inventory, spending, fusion properties and ultimate echoes.
const EQUIPMENT_FUSION_SLOTS=new Set(['weapon','head','armor','outfit','wings','shield']);
export function canFuseEquipment(source,target){
 return !!source&&!!target&&source.slot===target.slot&&EQUIPMENT_FUSION_SLOTS.has(target.slot);
}
export function fuseTemple(world,profile,body,rng=Math.random){
 const source=itemById(body.sourceId),target=itemById(body.targetId),requestId=String(body.requestId||'');
 if(requestId.length<8||requestId.length>80)return {error:'Missing fusion request ID'};
 profile.fusionReceipts??={};
 if(profile.fusionReceipts[requestId])return structuredClone(profile.fusionReceipts[requestId]);
 if(!canFuseEquipment(source,target))
  return {error:'Fusion requires identical equipment types: weapon+weapon, head+head, outfit+outfit, wings+wings, armor+armor or shield+shield'};
 const sourceIndex=profile.inventory.indexOf(source.id),targetIndex=profile.inventory.indexOf(target.id);
 if(sourceIndex<0||targetIndex<0||(source.id===target.id&&profile.inventory.filter(id=>id===source.id).length<2))
  return {error:'Both items must be owned (identical IDs require two copies)'};
 const old=profile.fusion[target.id]||{},layer=(old.layer||0)+1;
 if(layer>20)return {error:'Fusion limit reached (20)'};
 const cost=ECONOMY.fusionBaseCost*layer;
 if(!profile.admin&&profile.wallet<cost)return {error:'Not enough coins for fusion'};
 const chance=fusionChance(profile,target.id);
 const sample=Math.max(0,Math.min(1,Number(rng())));
 // Pay the coin cost and destroy exactly one material on either outcome.
 // The existing target, its affixes, and its previous echoes survive failure.
 if(!profile.admin){profile.wallet-=cost;world.activity.coinBurned+=cost;}
 profile.inventory.splice(sourceIndex,1);
 if(source.id!==target.id&&profile.equipment[source.slot]===source.id)profile.equipment[source.slot]=null;
 const attempts=Math.max(0,Math.floor(Number(old.attempts??old.layer)||0))+1;
 if(!(sample<chance)){
  profile.fusion[target.id]={...old,attempts};
  const result={notice:'FUSION FAILED · material consumed · '+(chance*100).toFixed(5)+'% chance',
   fusion:{success:false,target:target.id,layer:old.layer||0,attempts,cost,chance,nextChance:fusionChance(profile,target.id)}};
  profile.fusionReceipts[requestId]=structuredClone(result);
  const receipts=Object.keys(profile.fusionReceipts);
  if(receipts.length>64)delete profile.fusionReceipts[receipts[0]];
  return result;
 }
 const main=equippedItem(profile,target),material=equippedItem(profile,source),stats={...(old.templeStats||{})};
 // Affixes always accumulate; only ULTIMATE echoes have the two-source limit.
 const affixIds=[...new Set([...itemAffixes(main),...itemAffixes(material),
  ...itemAffixes(old),...itemAffixes(old.original)])];
 const effects=(old.effects||[]).filter(id=>itemById(id)?.slot==='weapon').slice(0,2);
 const grantsEcho=target.slot==='weapon'&&source.slot==='weapon'&&effects.length<2;
 const keys=['damage','chargeDamage','range','chargeRange','radius','defense','capacity','impulse','speed','jump'];
 for(const key of keys){
  // Normal melee geometry is an intrinsic property of the base weapon.
  // Never inherit a ranged material's ordinary reach or contact width.
  if(target.slot==='weapon'&&weaponRangeClass(target)==='near'&&['range','radius'].includes(key))continue;
  const sniperPower=source.id==='black-cat'&&['damage','chargeDamage'].includes(key);
  // A sniper source may contribute 30% of its original shot EITHER as
  // its visible echo (first two slots) OR as stats (later slots), not both.
  // Also ignore any previously inflated stats on the consumed sniper.
  if(sniperPower&&grantsEcho)continue;
  const a=sniperPower?Number(source[key]):Number(material[key]),b=Number(main[key])||0;
  if(!(a>0))continue;
  const cap=['range','chargeRange'].includes(key)?400:key==='radius'?80:key==='defense'?300:100000;
  stats[key]=+Math.min(cap,b+a*.3).toFixed(3);
 }
 let bonus=Number(old.bonus)||0;
 if(source.slot==='material'&&target.slot==='weapon')
  bonus+=({'wet-stone':3.5,'signal-wire':6,'temple-resin':10}[source.id]||0);
 if(grantsEcho)effects.push(source.id);
 profile.fusion[target.id]={...old,layer,attempts,bonus,templeStats:stats,effects,affixIds,affixId:affixIds[0]||null,
  sources:[...(old.sources||[]),{id:source.id,name:source.name,statPercent:30,echo:grantsEcho}]};
 const result={notice:'FUSION SUCCESS · '+target.name+' +'+layer+
  (grantsEcho?' · ULTIMATE ECHO '+effects.length+'/2':' · STATS +30%'),
  fusion:{success:true,target:target.id,layer,attempts,cost,chance,nextChance:fusionChance(profile,target.id),effects:[...effects],affixIds:[...affixIds]}};
 profile.fusionReceipts[requestId]=structuredClone(result);
 const receipts=Object.keys(profile.fusionReceipts);
 if(receipts.length>64)delete profile.fusionReceipts[receipts[0]];
 return result;
}
