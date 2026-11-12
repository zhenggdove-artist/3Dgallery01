import {effectActive} from './combat-status.js';
import {traitStats} from '../reletter/combat-traits.js';
import {itemById} from './catalog.js';
import {originalEquipmentGame,equippedItem} from './fusion-adapter.js';

// Original equipment/crop multipliers; Temple uses a 100 HP base instead of 3 HP.
export function playerStats(world,profile,now=Date.now()){
  const key=profile.key,traits=traitStats(originalEquipmentGame(profile,world),key,now);
  const buffs=world.reletter?.garden?.buffs?.[key]||{},bonus=k=>buffs[k]?.until>now?buffs[k].power:0;
  const rawWing=itemById(profile.equipment.wings),wing=rawWing&&equippedItem(profile,rawWing);
  return {maxHp:100+(profile.level-1)*4+(traits.hp+bonus('hp'))*10,
    attack:traits.attack*(1+bonus('attack'))*(1-(effectActive(profile,'weak',now)?.power||0)),speed:traits.speed*(1+bonus('speed'))*(1-(effectActive(profile,'slow',now)?.power||0))*(effectActive(profile,'stun',now)||effectActive(profile,'root',now)?0:1),
    jump:traits.jump*(1+bonus('jump')),defense:traits.defense*(1-bonus('defense'))*(1+(effectActive(profile,'expose',now)?.power||0)),
    gravity:wing?.gravity||1,impulse:wing?.impulse||0,flapMs:wing?.flapMs||0};
}
export function refreshStats(world,profile,now=Date.now()){
  const stats=playerStats(world,profile,now),oldMax=profile.maxHp||100;
  profile.maxHp=stats.maxHp;
  if(profile.hp>0)profile.hp=Math.min(stats.maxHp,Math.max(1,profile.hp+stats.maxHp-oldMax));
  const rawShield=itemById(profile.equipment.shield),shield=rawShield&&equippedItem(profile,rawShield);
  if(!shield)profile.shield=null;
  else if(profile.shield?.item!==shield.id)profile.shield={item:shield.id,hp:shield.capacity*10,lastHit:0};
  else if(now-profile.shield.lastHit>=shield.recharge*1000)profile.shield.hp=shield.capacity*10;
  return stats;
}
