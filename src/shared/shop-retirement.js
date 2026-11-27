import {SHOP_ITEMS,itemById,shopWeaponGroupKey} from './catalog.js';
import {removeInventoryInstances} from './fusion-instances.js';
export const isRemovedShopAsset=(world,id)=>!!id&&Object.hasOwn(world?.removedShopAssets||{},id);
export const isDelisted=(world,id)=>!!id&&(Object.hasOwn(world?.delistedShopItems||{},id)||isRemovedShopAsset(world,id));
// Native weapon grades are separate IDs; exotic grades share a single ID.
// Use the exact shop card identity for every slot, including the five outfit variants.
export function shopQualityIds(id){const item=SHOP_ITEMS.find(i=>i.id===id);if(!item)return [];const group=shopWeaponGroupKey(item);return SHOP_ITEMS.filter(i=>shopWeaponGroupKey(i)===group).map(i=>i.id);}
export const shopGroupDelisted=(world,id)=>{const ids=shopQualityIds(id);return ids.length>0&&ids.every(key=>isDelisted(world,key));};
export const activePreviewItems=(items,removed={})=>(items||[]).filter(item=>item&&!Object.hasOwn(removed,item.id));
export function reclaimDelisted(world,profile){
 if(!Object.keys(world.delistedShopItems||{}).length&&!Object.keys(world.removedShopAssets||{}).length)return 0;
 const indices=[];for(let i=0;i<(profile.inventory||[]).length;i++)if(isDelisted(world,profile.inventory[i]))indices.push(i);
 if(indices.length)removeInventoryInstances(profile,indices);
 for(const [slot,id] of Object.entries(profile.equipment||{}))if(isDelisted(world,id)){profile.equipment[slot]=null;if(profile.equippedInstanceIds)delete profile.equippedInstanceIds[slot];}
 if(isDelisted(world,profile.starterWeaponId))profile.spentStarterWeapon=true;
 if(isDelisted(world,profile.channelWeapon)){profile.channelWeapon=null;profile.channelStartedAt=0;profile.chargeStartedAt=0;profile.manaChannelPaid=false;profile.lastChannelPulseAt=0;delete profile.channelManaNextAt;delete profile.prismChannelStats;delete profile.tidalChannelStats;if(world.prismLocks)delete world.prismLocks[profile.key];if(world.tidalLocks)delete world.tidalLocks[profile.key];}
 if(profile.quickSlots)profile.quickSlots=profile.quickSlots.map(id=>isDelisted(world,id)?null:id);
 for(const record of [...Object.values(profile.fusion||{}),...Object.values(profile.fusionByInstance||{})])if(record){if(Array.isArray(record.effects))record.effects=record.effects.filter(id=>!isDelisted(world,id));if(Array.isArray(record.original?.fusionEffects))record.original.fusionEffects=record.original.fusionEffects.filter(id=>!isDelisted(world,id));if(Array.isArray(record.sources))record.sources=record.sources.map(s=>isDelisted(world,s.id)&&s.echo?{...s,echo:false}:s);}
 return indices.length;
}
function recallShopGroup(world,ids,now){
 world.delistedShopItems??={};
 for(const id of ids)world.delistedShopItems[id]??=now;
 let reclaimed=0;for(const p of Object.values(world.profiles||{}))reclaimed+=reclaimDelisted(world,p);
 const excluded=new Set(ids),before=world.groundDrops.length;
 world.groundDrops=world.groundDrops.filter(d=>!excluded.has(d.itemId));
 world.persistentAttacks=(world.persistentAttacks||[]).filter(a=>!excluded.has(a.weapon)&&!excluded.has(a.weaponId));
 return {reclaimed,removedDrops:before-world.groundDrops.length,delistedItemId:ids[0],delistedItemIds:ids};
}
export function retireShopItem(world,id,now){
 const ids=shopQualityIds(id);if(!ids.length)return {error:'Invalid shop item'};
 if(ids.every(key=>isDelisted(world,key)))return {error:'Already delisted'};
 const result=recallShopGroup(world,ids,now);
 return {...result,delistedItemId:id,notice:'DELISTED · '+itemById(id).name+' · ALL QUALITIES · '+result.reclaimed+' reclaimed'};
}
// Permanent logical asset removal: keep stable IDs for old saved data, but
// never reissue, relist or render these products as inventory/preview assets.
export function removeShopAsset(world,id,now){
 const ids=shopQualityIds(id);if(!ids.length)return {error:'Invalid shop item'};
 if(ids.every(key=>isRemovedShopAsset(world,key)))return {error:'Asset already removed'};
 const result=recallShopGroup(world,ids,now);world.removedShopAssets??={};
 for(const key of ids){world.removedShopAssets[key]=now;if(world.relistedShopItems)delete world.relistedShopItems[key];}
 return {...result,delistedItemId:id,removedShopAssetIds:ids,notice:'ASSET REMOVED · '+itemById(id).name+' · '+ids.length+' product IDs · '+result.reclaimed+' reclaimed'};
}
// Relisting restores availability, never any recalled inventory or drop.
export function relistShopItem(world,id,now){
 const ids=shopQualityIds(id);if(!ids.length)return {error:'Invalid shop item'};
 if(ids.some(key=>isRemovedShopAsset(world,key)))return {error:'Asset permanently removed'};
 const delisted=ids.filter(key=>isDelisted(world,key));if(!delisted.length)return {error:'Item is already listed'};
 for(const p of Object.values(world.profiles||{}))reclaimDelisted(world,p);
 world.relistedShopItems??={};
 for(const key of delisted){world.relistedShopItems[key]=now;delete world.delistedShopItems[key];}
 return {relistedItemId:id,relistedItemIds:delisted,notice:'RELISTED · '+itemById(id).name+' · ALL QUALITIES'};
}
