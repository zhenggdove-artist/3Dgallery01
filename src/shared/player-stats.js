import {effectActive} from './combat-status.js';
import {traitStats} from '../reletter/combat-traits.js';
import {itemById} from './catalog.js';
import {originalEquipmentGame,equippedItem} from './fusion-adapter.js';

// Original equipment/crop multipliers; Temple uses a 100 HP base instead of 3 HP.
export function playerStats(world,profile,now=Date.now()){
  // Only equipped items contribute to traits. Do not rebuild every owned
  // inventory instance on each movement frame or combat broadcast.
  const key=profile.key,traits=traitStats(originalEquipmentGame(profile,world,true),key,now);
  let fusedAttack=0,fusedDefense=0;
  for(const [slot,id] of Object.entries(profile.equipment||{})){
    const base=itemById(id),stats=profile.fusion?.[id]?.templeStats;
    if(!base||!stats)continue;
    if(slot!=='weapon')fusedAttack+=Math.max(0,(Number(stats.damage)||0)-(Number(base.damage)||0))/100;
    fusedDefense+=Math.max(0,(Number(stats.defense)||0)-(Number(base.defense)||0));
  }
  const rawWing=itemById(profile.equipment.wings),wing=rawWing&&equippedItem(profile,rawWing);
  const ability=wing?.design==='painted-wing'?wing.ability:null;
  return {maxHp:100+(profile.level-1)*4+traits.hp*10,
    attack:(traits.attack+fusedAttack)*(1-(effectActive(profile,'weak',now)?.power||0)),speed:traits.speed*(ability==='swift'?1.1:1)*(1-(effectActive(profile,'slow',now)?.power||0))*(effectActive(profile,'stun',now)||effectActive(profile,'root',now)?0:1),
    jump:traits.jump*(ability==='aerial'?1.15:1),defense:Math.max(.35,traits.defense*(ability==='guardian'?.9:1)*(1+(effectActive(profile,'expose',now)?.power||0))*(1-Math.min(.5,fusedDefense/300))),
    gravity:(wing?.gravity||1)*(ability==='glide'?.85:1),impulse:wing?.impulse||0,flapMs:wing?.flapMs||0};
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
