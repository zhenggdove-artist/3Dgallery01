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
 // Temple's six elemental responses are authoritative and generated only after a real hit.
 applyElementalHit(target,source,weapon,now);
 const durationScale=Math.max(1,Math.min(2.4,Number(shot.qualityDuration)||1));
 for(const [key,effect] of Object.entries(target.effects||{})){
  if(['freeze','root','confuse','dazzle','soaked'].includes(key)||effect.owner!==source.key||effect.until<=(previous[key]||0))continue;
  effect.until+=Math.round((effect.until-now)*(durationScale-1));
 }
 for(const id of source.fusion?.[weapon.id]?.effects||[]){const item=equipmentById(id);if(item)applyWeaponTraits(game,item,{...shot,shooter:source.key},now);}
 source.hp=Math.min(source.maxHp,source.maxHp-game.hits[source.key]*10);
 if(resolved.knockback)target.impulse={id:now,vector:resolved.knockback};
}
// Same original durations/tick schedule; 10x damage converts RELETTER HP to Temple HP.
export function tickStatus(target,now,deal){let changed=false;for(const [key,e]of Object.entries(target.effects||{})){
 if(['burn','poison','bleed'].includes(key)&&target.hp>0){const ticks=Math.max(0,Math.floor((Math.min(now,e.until)-e.next)/1000)+1);if(ticks){deal(e.owner,e.power*ticks*10);e.next+=ticks*1000;changed=true;}}
 if(now>=e.until){delete target.effects[key];changed=true;}
 }return changed;}

// Independent of the legacy RELETTER traits, so the same status rules apply
// to both human fighters and enemy actors on server-authorised contact.
export function applyElementalHit(target,source,weapon,now){
 if(!target||target.admin||target.hp<=0||!weapon)return null;
 target.effects??={};target.effectLocks??={};
 const e=target.effects,locks=target.effectLocks,owner=source?.key||'environment';
 const put=(key,duration,power=0,cooldown=0)=>{
  if(cooldown&&(locks[key]||0)>now)return null;
  e[key]={owner,power,until:now+duration,next:now+1000};
  if(cooldown)locks[key]=now+cooldown;
  return key;
 };
 // Ice and plant are distinct: ice prevents every action, while vines only
 // restrain locomotion, leaving look and attacks available.
 const family=weapon.family;
 if(family==='ice'){delete e.slow;return put('freeze',1000,0,5000);}
 if(['planter','petal','palm','whip'].includes(family)&&!weapon.exotic){delete e.root;return put('root',1000,0,5000);}
 if(family==='fire'||weapon.element==='fire'){
  if(!e.burn||e.burn.until<=now)return put('burn',5000,1);
  return 'burn';
 }
 if(weapon.element==='water'||family==='water') {
  e.soaked={owner,power:.5,until:now+5000,next:now+1000};
  return 'soaked';
 }
 if(weapon.element==='dark')return put('confuse',3000,0,10000);
 if(weapon.element==='light'||family==='saber'||family==='beam')return put('dazzle',3000,0,10000);
 return null;
}
