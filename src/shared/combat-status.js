import {applyWeaponTraits,effectActive} from '../reletter/server/combat-effects.js';
import {originalEquipmentGame} from './fusion-adapter.js';
import {equipmentById} from '../reletter/equipment-catalog.js';
export {effectActive};
export function applyStatus(world,source,target,weapon,shot,now){
 if(!target||target.admin||target.hp<=0)return;
 const game={...originalEquipmentGame(source,world),boss:target,hits:{[source.key]:Math.max(0,(source.maxHp-source.hp)/10)}};
 const resolved={...shot,shooter:source.key,damage:shot.damage/10};
 const previous=Object.fromEntries(Object.entries(target.effects||{}).map(([key,value])=>[key,value.until]));
 applyWeaponTraits(game,{...weapon,damage:weapon.damage/10},resolved,now);
 // Rarity extends every newly inflicted debuff without multiplying older
 // stacks each time the same persistent fire or vine hits again.
 const durationScale=Math.max(1,Math.min(2.4,Number(shot.qualityDuration)||1));
 for(const [key,effect] of Object.entries(target.effects||{})){
  if(effect.owner!==source.key||effect.until<=(previous[key]||0))continue;
  effect.until+=Math.round((effect.until-now)*(durationScale-1));
 }
 for(const id of source.fusion?.[weapon.id]?.effects||[]){const item=equipmentById(id);if(item)applyWeaponTraits(game,item,{...shot,shooter:source.key},now);}
 if(weapon.family==='planter'&&!weapon.exotic){
  target.effects??={};
  const until=now+(shot.charge>=1?5000:2800),old=target.effects.root;
  target.effects.root={owner:source.key,power:1,until:Math.max(old?.until||0,until),next:now+1000};
 }
 source.hp=Math.min(source.maxHp,source.maxHp-game.hits[source.key]*10);
 if(resolved.knockback)target.impulse={id:now,vector:resolved.knockback};
}
// Same original durations/tick schedule; 10x damage converts RELETTER HP to Temple HP.
export function tickStatus(target,now,deal){let changed=false;for(const [key,e]of Object.entries(target.effects||{})){
 if(['burn','poison','bleed'].includes(key)&&target.hp>0){const ticks=Math.max(0,Math.floor((Math.min(now,e.until)-e.next)/1000)+1);if(ticks){deal(e.owner,e.power*ticks*10);e.next+=ticks*1000;changed=true;}}
 if(now>=e.until){delete target.effects[key];changed=true;}
 }return changed;}
