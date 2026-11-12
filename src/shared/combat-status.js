import {applyWeaponTraits,effectActive} from '../reletter/server/combat-effects.js';
import {originalEquipmentGame} from './fusion-adapter.js';
import {equipmentById} from '../reletter/equipment-catalog.js';
export {effectActive};
export function applyStatus(world,source,target,weapon,shot,now){
 if(!target||target.admin||target.hp<=0)return;
 const game={...originalEquipmentGame(source,world),boss:target,hits:{[source.key]:Math.max(0,(source.maxHp-source.hp)/10)}};
 const resolved={...shot,shooter:source.key,damage:shot.damage/10};
 applyWeaponTraits(game,{...weapon,damage:weapon.damage/10},resolved,now);
 for(const id of source.fusion?.[weapon.id]?.effects||[]){const item=equipmentById(id);if(item)applyWeaponTraits(game,item,{...shot,shooter:source.key},now);}
 source.hp=Math.min(source.maxHp,source.maxHp-game.hits[source.key]*10);
 if(resolved.knockback)target.impulse={id:now,vector:resolved.knockback};
}
// Same original durations/tick schedule; 10x damage converts RELETTER HP to Temple HP.
export function tickStatus(target,now,deal){let changed=false;for(const [key,e]of Object.entries(target.effects||{})){
 if(['burn','poison','bleed'].includes(key)&&target.hp>0){const ticks=Math.max(0,Math.floor((Math.min(now,e.until)-e.next)/1000)+1);if(ticks){deal(e.owner,e.power*ticks*10);e.next+=ticks*1000;changed=true;}}
 if(now>=e.until){delete target.effects[key];changed=true;}
 }return changed;}
