import {fuseEquipment} from '../reletter/server/fusion-rules.js';
import {equipmentById} from '../reletter/equipment-catalog.js';

export function originalEquipmentGame(profile,world={}){
 const key=profile.key,instances=profile.inventory.filter(id=>equipmentById(id)).map(id=>({id,baseId:id,origin:profile.itemOrigins?.[id]||'monster',sourceLevel:profile.level,obtainedAt:profile.createdAt,...profile.fusion?.[id]?.original}));
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
 const raw=profile.fusion?.[item.id]?.original?.stats;if(!raw)return item;
 return {...item,...raw,damage:raw.damage===undefined?item.damage:raw.damage*10,chargeDamage:raw.chargeDamage===undefined?item.chargeDamage:raw.chargeDamage*10};
}
