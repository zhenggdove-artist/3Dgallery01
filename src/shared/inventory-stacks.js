// Pure display grouping, preserving each owned item UID and inventory index.
import {normalizedWeaponAffixes} from './weapon-affixes.js';
export function inventoryStackKey(item,record={}){
 const o=record?.original||{};
 return JSON.stringify([item.id,item.rarity,item.tier||1,
  Number(record?.layer??o.fusionCount)||0,Number(record?.bonus)||0,
  record?.affixId||null,record?.affixIds||[],normalizedWeaponAffixes(record),
  record?.effects||[],record?.templeStats||null,
  o.stats||null,o.bonuses||null,o.affixId||null,o.affixIds||[],
  o.effects||[],o.quality||null]);
}
export function groupInventoryStacks(rows,recordAt){
 const groups=new Map();
 for(const row of rows){
  const key=inventoryStackKey(row.item,recordAt(row.item,row.index)),group=groups.get(key);
  if(group){group.count++;group.indices.push(row.index);}
  else groups.set(key,{...row,count:1,indices:[row.index]});
 }
 return [...groups.values()];
}
