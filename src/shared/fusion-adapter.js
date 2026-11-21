import {fuseEquipment} from '../reletter/server/fusion-rules.js';
import {equipmentById} from '../reletter/equipment-catalog.js';
import {itemAffixes} from '../reletter/combat-traits.js';
import {sniperMaterialStat} from './fusion-balance.js';
import {itemById} from './catalog.js';

export function originalEquipmentGame(profile,world={},equippedOnly=false){
 const inventory=equippedOnly?[...new Set(Object.values(profile.equipment||{}))].filter(id=>profile.inventory.includes(id)):profile.inventory;
 const key=profile.key,instances=inventory.filter(id=>equipmentById(id)).map(id=>{
  const record=profile.fusion?.[id],original=record?.original||{};
  // Project Temple's authoritative successful headgear/outfit fusions into
  // resolveItem -> traitStats; without this, only the BAG number changes.
  const templeBonuses=record?.templeStats?.bonuses;
  const rolledStats=templeBonuses?{...(original.stats||{}),
   bonuses:{...(original.stats?.bonuses||{}),...templeBonuses}}:original.stats;
  const affixIds=[...new Set([...itemAffixes(original),...itemAffixes(record)])];
  return {id,baseId:id,origin:profile.itemOrigins?.[id]||'monster',sourceLevel:profile.level,
   obtainedAt:profile.createdAt,...original,...(rolledStats?{stats:rolledStats}:{}),affixIds,affixId:affixIds[0]||null};
 });
 return {inventories:{[key]:[...inventory]},equipment:{[key]:{...profile.equipment}},weaponInstances:{[key]:instances},garden:world.reletter?.garden,equipmentRevision:0};
}
export function fuseOriginal(world,profile,body,rng){
 const g=originalEquipmentGame(profile,world),key=profile.key,result=fuseEquipment(g,key,{source:body.sourceId,target:body.targetId,requestId:body.requestId},rng);
 if(result.error)return result;
 // Temple stacks duplicate base IDs; consume exactly one source, not the entire stack.
 const sourceIndex=profile.inventory.indexOf(body.sourceId);if(sourceIndex>=0)profile.inventory.splice(sourceIndex,1);
 if(result.fusion.success){const instance=g.weaponInstances[key].find(i=>i.id===body.targetId);profile.fusion[body.targetId]={layer:instance.fusionCount,original:instance,effects:instance.fusionEffects||[]};}
 return result;
}
export function equippedItem(profile,item,instanceRecord=null){
 const record=instanceRecord??profile.fusion?.[item.id],original=record?.original||{};
 const affixIds=[...new Set([...itemAffixes(item),...itemAffixes(original),...itemAffixes(record)])];
 const named={...item,affixId:affixIds[0]||null,affixIds};
 if(record?.templeStats){
  const fused={...named,...record.templeStats};
  // Migrate legacy cross-class records at read time without deleting bonuses.
  // The primary melee weapon's real model owns normal-attack reach; range
  // modifiers from a distant rifle ingredient must never turn it into a gun.
  if(item.slot==='weapon'){
   // Fusion grants power and source ultimates, never replaces the primary
   // weapon's own travel distance, charge reach or collision radius.
   fused.range=item.range;fused.chargeRange=item.chargeRange;fused.radius=item.radius;
  }
  // An old save can contain a sniper added as a third+ material before the
  // balance change. Clamp only records that identify a stat-only sniper.
  if(Array.isArray(record.sources)&&record.sources.some(v=>v.id==='black-cat'&&!v.echo))
   for(const key of ['damage','chargeDamage']){
    const base=Math.max(0,Number(item[key])||0);
    const bonus=record.sources.filter(v=>!v.echo).reduce((sum,v)=>{
     const ingredient=itemById(v.id);
     return sum+sniperMaterialStat(ingredient,key)*.3;
    },0);
    if(Number.isFinite(fused[key]))fused[key]=Math.min(fused[key],base+bonus);
   }
  return fused;
 }
 const raw=original.stats;if(!raw)return named;
 const stats={...named,...raw,damage:raw.damage===undefined?item.damage:raw.damage*10,
  chargeDamage:raw.chargeDamage===undefined?item.chargeDamage:raw.chargeDamage*10};
 if(item.slot==='weapon'){stats.range=item.range;stats.chargeRange=item.chargeRange;stats.radius=item.radius;}
 return stats;
}
