import {tunedEquipment,equipmentTuning,manaCostFromStats} from './equipment-tuning.js';
import {effectActive} from './combat-status.js';
import {traitStats} from '../reletter/combat-traits.js';
import {itemById} from './catalog.js';
import {originalEquipmentGame,equippedItem} from './fusion-adapter.js';
import {weaponAffixTotals} from './weapon-affixes.js';

// Mana is authoritative; ordinary attacks never consume it.
export function manaCapacity(level=1){return 100+4*Math.max(0,(Number(level)||1)-1);}
export function manaRegen(profile,world){
 const base=itemById(profile.equipment?.weapon),weapon=base&&{...base,shopTier:profile.fusion?.[base.id]?.shopTier??(base.exotic?Math.min(4,base.tier||3):base.tier||1)};
 const water=weapon&&(['goldfish','clam','jellybrella'].includes(weapon.id)||(!weapon.exotic&&['water','ice','wave'].includes(weapon.family)));
 return (3+.25*Math.max(0,(profile.level||1)-1))*(equipmentTuning(world,weapon).manaRegenScale??(water?1.5:1));
}
export function refreshMana(profile,now,world){
 const max=manaCapacity(profile.level),before=Number.isFinite(profile.mana)?profile.mana:max;
 const elapsed=Math.max(0,now-(profile.manaAt??now));
 profile.maxMana=max;profile.manaAt=Math.max(now,profile.manaAt||0);
 const canRegenerate=profile.hp>0&&!(profile.channelWeapon&&profile.manaChannelPaid===true);
 profile.mana=Math.min(max,Math.max(0,before)+(canRegenerate&&before<max&&elapsed>0?elapsed/1000*manaRegen(profile,world):0));
 return Math.floor(before)!==Math.floor(profile.mana);
}
export function ultimateManaCost(weapon,stats,quality,channel=false,fusionCount=0){return manaCostFromStats(weapon,stats,quality,channel,fusionCount);}
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
  const weaponEnchants=weaponAffixTotals(profile.fusion?.[profile.equipment?.weapon]);
  const rawWing=itemById(profile.equipment.wings),wing=rawWing&&tunedEquipment(world,equippedItem(profile,rawWing));
  const wingTuning=equipmentTuning(world,wing);
  const abilities=wing?.design==='painted-wing'?(wing.abilities??[wing.ability]):[];
  return {maxMana:manaCapacity(profile.level),manaRegen:manaRegen(profile,world),maxHp:+((100+(profile.level-1)*4+traits.hp*10)*(1+weaponEnchants.hp/100)).toFixed(3),
    attack:(traits.attack+fusedAttack)*(1+weaponEnchants.attack/100)*(1-(effectActive(profile,'weak',now)?.power||0)),speed:traits.speed*(1+weaponEnchants.speed/100)*(abilities.includes('swift')?(wingTuning.swiftScale??1.1):1)*(1-(effectActive(profile,'slow',now)?.power||0))*(effectActive(profile,'stun',now)||effectActive(profile,'root',now)?0:1),
    jump:traits.jump*(1+weaponEnchants.jump/100)*(abilities.includes('aerial')?(wingTuning.aerialScale??1.15):1),defense:Math.max(.35,traits.defense*(abilities.includes('guardian')?(wingTuning.guardianScale??.9):1)*(1+(effectActive(profile,'expose',now)?.power||0))*(1-Math.min(.5,fusedDefense/300))*(1-weaponEnchants.defense/100)),
    gravity:(wing?.gravity||1)*(abilities.includes('glide')?(wingTuning.glideScale??.85):1),impulse:wing?.impulse||0,flapMs:wing?.flapMs||0};
}
export function refreshStats(world,profile,now=Date.now()){
  const stats=playerStats(world,profile,now),oldMax=profile.maxHp||100;
  profile.maxHp=stats.maxHp;
  profile.maxMana=stats.maxMana;profile.mana=Math.max(0,Math.min(stats.maxMana,Number.isFinite(profile.mana)?profile.mana:stats.maxMana));
  if(profile.hp>0)profile.hp=Math.min(stats.maxHp,Math.max(1,profile.hp+stats.maxHp-oldMax));
  const rawShield=itemById(profile.equipment.shield),shield=rawShield&&tunedEquipment(world,equippedItem(profile,rawShield));
  if(!shield)profile.shield=null;
  else if(profile.shield?.item!==shield.id)profile.shield={item:shield.id,hp:shield.capacity*10,maxHp:shield.capacity*10,lastHit:0};
  else{
   profile.shield.maxHp=shield.capacity*10;if(equipmentTuning(world,shield).capacity!==undefined)profile.shield.hp=Math.min(profile.shield.hp,profile.shield.maxHp);
   if(now-profile.shield.lastHit>=shield.recharge*1000)profile.shield.hp=profile.shield.maxHp;
  }
  return stats;
}
