import {fuseEquipment} from '../reletter/server/fusion-rules.js';
import {equipmentById} from '../reletter/equipment-catalog.js';
import {itemAffixes} from '../reletter/combat-traits.js';

export function originalEquipmentGame(profile,world={}){
 const key=profile.key,instances=profile.inventory.filter(id=>equipmentById(id)).map(id=>{
  const record=profile.fusion?.[id],original=record?.original||{};
  const affixIds=[...new Set([...itemAffixes(original),...itemAffixes(record)])];
  return {id,baseId:id,origin:profile.itemOrigins?.[id]||'monster',sourceLevel:profile.level,
   obtainedAt:profile.createdAt,...original,affixIds,affixId:affixIds[0]||null};
 });
 return {inventories:{[key]:[...profile.inventory]},equipment:{[key]:{...profile.equipment}},weaponInstances:{[key]:instances},garden:world.reletter?.garden,equipmentRevision:0};
}
export function fuseOriginal(world,profile,body,rng){
 const g=originalEquipmentGame(profile,world),key=profile.key,result=fuseEquipment(g,key,{source:body.sourceId,target:body.targetId,requestId:body.requestId},rng);
 if(result.error)return result;
 // Temple stacks duplicate base IDs; consume exactly one source, not the entire stack.
 const sourceIndex=profile.inventory.indexOf(body.sourceId);if(sourceIndex>=0)profile.inventory.splice(sourceIndex,1);
 if(result.fusion.success){const instance=g.weaponInstances[key].find(i=>i.id===body.targetId);profile.fusion[body.targetId]={layer:instance.fusionCount,original:instance,effects:instance.fusionEffects||[]};}
 return result;
}
export function equippedItem(profile,item){
 const record=profile.fusion?.[item.id],original=record?.original||{};
 const affixIds=[...new Set([...itemAffixes(item),...itemAffixes(original),...itemAffixes(record)])];
 const named={...item,affixId:affixIds[0]||null,affixIds};
 if(record?.templeStats)return {...named,...record.templeStats};
 const raw=original.stats;if(!raw)return named;
 return {...named,...raw,damage:raw.damage===undefined?item.damage:raw.damage*10,
  chargeDamage:raw.chargeDamage===undefined?item.chargeDamage:raw.chargeDamage*10};
}
