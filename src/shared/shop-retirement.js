import {ITEMS,SHOP_ITEMS,itemById} from './catalog.js';
import {removeInventoryInstances,ensureFusionIdentity} from './fusion-instances.js';
export const isDelisted=(world,id)=>!!id&&Object.hasOwn(world?.delistedShopItems||{},id);
export function reclaimDelisted(world,profile){
 if(!Object.keys(world.delistedShopItems||{}).length)return 0;
 const indices=[];for(let i=0;i<(profile.inventory||[]).length;i++)if(isDelisted(world,profile.inventory[i]))indices.push(i);
 if(indices.length)removeInventoryInstances(profile,indices);
 for(const [slot,id] of Object.entries(profile.equipment||{}))if(isDelisted(world,id)){profile.equipment[slot]=null;if(profile.equippedInstanceIds)delete profile.equippedInstanceIds[slot];}
 if(isDelisted(world,profile.starterWeaponId))profile.spentStarterWeapon=true;
 if(isDelisted(world,profile.channelWeapon)){profile.channelWeapon=null;profile.channelStartedAt=0;profile.chargeStartedAt=0;profile.manaChannelPaid=false;profile.lastChannelPulseAt=0;delete profile.channelManaNextAt;delete profile.prismChannelStats;delete profile.tidalChannelStats;if(world.prismLocks)delete world.prismLocks[profile.key];if(world.tidalLocks)delete world.tidalLocks[profile.key];}
 if(profile.quickSlots)profile.quickSlots=profile.quickSlots.map(id=>isDelisted(world,id)?null:id);
 for(const record of [...Object.values(profile.fusion||{}),...Object.values(profile.fusionByInstance||{})])if(record){if(Array.isArray(record.effects))record.effects=record.effects.filter(id=>!isDelisted(world,id));if(Array.isArray(record.original?.fusionEffects))record.original.fusionEffects=record.original.fusionEffects.filter(id=>!isDelisted(world,id));if(Array.isArray(record.sources))record.sources=record.sources.map(s=>isDelisted(world,s.id)&&s.echo?{...s,echo:false}:s);}
 return indices.length;
}
export function retireShopItem(world,id,now){
 if(!SHOP_ITEMS.some(i=>i.id===id))return {error:'Invalid shop item'};
 world.delistedShopItems??={};if(isDelisted(world,id))return {error:'Already delisted'};
 world.delistedShopItems[id]=now;let reclaimed=0;for(const p of Object.values(world.profiles||{}))reclaimed+=reclaimDelisted(world,p);
 const before=world.groundDrops.length;world.groundDrops=world.groundDrops.filter(d=>d.itemId!==id);
 world.persistentAttacks=(world.persistentAttacks||[]).filter(a=>a.weapon!==id&&a.weaponId!==id);
 return {reclaimed,removedDrops:before-world.groundDrops.length,delistedItemId:id,notice:'DELISTED · '+itemById(id).name+' · '+reclaimed+' reclaimed'};
}
