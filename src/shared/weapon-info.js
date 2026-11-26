import {attackStats} from './catalog.js';
import {weaponRangeClass} from '../engine/odd-weapons.js';
import {pvpShotDamage,SNIPER_RANGE} from './combat-balance.js';
import {weaponQuality,forwardCastRadius,GOLDFISH_SWIM_RADIUS} from './weapon-abilities.js';
import {scaleUltimateFootprint} from './charge-area.js';
import {GOLDFISH_SCHOOL_RADIUS} from './goldfish-school.js';
import {normalizedWeaponAffixes,weaponAffixLabel,weaponAffixTotals} from './weapon-affixes.js';

// English descriptions reflect effective Temple mechanics, not retired moves.
const familySkills={
 water:'Normal: launch a water projectile toward the reticle. Ultimate: unleash a tidal blast forward.',
 ice:'Normal: fire an ice crystal. Ultimate: summon Ice Shatter inside a forward magic circle, freezing enemies for 3 seconds (6-second activation interval).',
 fire:'Normal: spray fire forward. Ultimate: maintain a burning field that ignites targets on contact.',
 lightning:'Normal: strike with an electric arc. Ultimate: channel a stream of lightning that locks onto and tracks an enemy.',
 beam:'Normal: attack with a beam. Ultimate: focus on one enemy, increasing damage through continuous hits.',
 petal:'Normal: fire petals and magical shots. Ultimate: create a thorn-and-petal field; channeling restores 1 HP per second and displays +1 even at full HP.',
 wave:'Normal: release a wave. Ultimate: summon a homing vortex that damages enemies along its path.',
 saber:'Normal: chain close-range sword slashes. Ultimate: send a blade fissure toward the reticle.',
 whip:'Normal: perform successive whip strikes. Ultimate: hit enemies in front and pull them closer.',
 swatter:'Normal: deliver quick fly-swatter strikes. Ultimate: create a wide frontal whirlwind.',
 pan:'Normal: perform a close-range smash. Ultimate: trigger an explosion that knocks back nearby characters.',
 planter:'Normal: swing a potted plant. Ultimate: call down three waves of luminous green chains over the targeted area, striking enemies caught in the chain rain.',
 palm:'Normal: swing a coconut palm. Ultimate: summon a green lightning-fire tornado for 6 seconds, damaging enemies inside once every 2 seconds (up to 3 hits). Warning, damage radius and tornado size grow together with weapon quality.'
};
const specials={
 accordion:'Red Accordion — Normal: colorful notes spin around the wielder. Ultimate: a dense note tornado travels forward at triple rotation speed; each target in its path can be hit once per second.',
 giraffe:'Giraffe Boomerang — Normal: swing a flexible giraffe club. Ultimate: throw a wobbling boomerang that damages targets on outbound and return contact.',
 goldfish:'Goldfish Water Cannon — Normal: launch water jets. Ultimate: summon a three-dimensional school of goldfish that swim forward and damage enemies on contact.',
 clam:'Giant Clam — Normal: swing a snapping shell. Ultimate: fire spinning clams forward.',
 'white-cat':'White Cat SMG — Rapid-fire colorful bullets using the first-person reticle. Charge for a continuous rainbow barrage.',
 'black-cat':'Black Cat Sniper Rifle — Scope-only single shots. Verified headshots are lethal. No charge or ultimate.',
 'calico-cat':'Calico Cat Shotgun — Scatter independently colliding pellets. Ultimate: increase the spread and power.',
 fan:'Rampaging Electric Fan — Normal: swing to generate gusts. Ultimate: unleash moving tornadoes that slow enemies.',
 telephone:'Screaming Telephone — Normal: swing the coiled handset cord. Ultimate: emit weakening rings of sound.',
 jellybrella:'Jellyfish Umbrella — Normal: swing the umbrella. Ultimate: summon a wide rotating cloud of luminous jellyfish that slows enemies.'
};
const bonusNames={hp:'Maximum HP',attack:'Attack Power',speed:'Movement Speed',jump:'Jump Height',defense:'Damage Reduction',fusion:'Fusion Success Chance'};
const num=(value,decimal=1)=>Number(value).toFixed(decimal).replace(/\.0+$/,'');
function actualBonuses(item,record){
 return {...(item.bonuses||{}),...(record?.templeStats?.bonuses||{})};
}
function describeBonuses(item,record){
 const bonus=actualBonuses(item,record);
 return Object.entries(bonus).map(([key,value])=>{
  const v=Number(value);
  if(!Number.isFinite(v)||v===0)return null;
  if(key==='hp')return bonusNames.hp+' +'+num(v*10,2)+' HP';
  return (bonusNames[key]||key)+' +'+num(v*100,2)+'%';
 }).filter(Boolean);
}
export function weaponClass(item){return weaponRangeClass(item);}
export function explainWeapon(item,fusion=null){
 if(!item)return '';
 if(item.slot!=='weapon')return explainEquipment(item,fusion);
 const enchants=normalizedWeaponAffixes(fusion),totals=weaponAffixTotals(enchants);
 const effective={...item,...(fusion?.templeStats||{}),weaponAffixes:enchants,
  critChance:Math.min(.85,(Number(item.critChance)||0)+totals.crit/100),
  cooldown:Math.max(70,Math.round((Number(item.cooldown)||800)*(1-totals.haste/100)))};
 // The primary weapon always determines the base reach.
 effective.range=item.range;effective.radius=item.radius;
 effective.chargeRange=item.chargeRange;
 const quality=weaponQuality(effective,fusion);
 const normal=attackStats(effective,0),charged=attackStats(effective,1);
 if(item.id==='black-cat')return [specials[item.id],'Normal effective range: '+num(normal.range)+' m','Approximate PvP base damage: '+num(pvpShotDamage(effective,normal,quality),2),'Attack interval: '+num(effective.cooldown/1000,3)+' s',...(enchants.length?['Random affixes: '+enchants.filter(e=>e.id!=='surging').map(weaponAffixLabel).join(', ')]:[])].join(' · ');
 charged.range=+(charged.range*quality.range).toFixed(2);
 charged.radius=forwardCastRadius(effective,quality,charged.radius,false);
 if(item.id==='black-cat')charged.range=SNIPER_RANGE;
 if(item.id==='jellybrella')charged.radius=Math.max(10,charged.radius*2);
 if(item.id==='goldfish')charged.radius=GOLDFISH_SWIM_RADIUS*quality.visual;
 scaleUltimateFootprint(charged,effective,quality);
 if(item.id==='goldfish')charged.radius=GOLDFISH_SCHOOL_RADIUS*quality.visual;
 if(item.id==='giraffe')charged.range=+(item.chargedRange*quality.range).toFixed(2);
 const cls=({near:'Close-Range',mid:'Mid-Range',far:'Long-Range'})[weaponClass(item)]||'Special';
 const description=specials[item.id]||familySkills[item.family]||item.description||'Hold the attack button to charge an ultimate with a different range and damage profile.';
 const extent=item.id==='accordion'
  ?'Ultimate collision corridor: '+num(charged.range)+' m long, '+num(charged.radius*2)+' m wide; each target can be hit at most once per second'
  :'Ultimate preview: range '+num(charged.range)+' m, approximately '+num(charged.radius)+' m radius';
 const damage='Approximate PvP base damage per hit: '+num(pvpShotDamage(item,normal,quality),2)+
  '; ultimate: '+num(pvpShotDamage(item,charged,quality),2)+' (actual damage depends on hit count, critical hits and damage reduction)';
 return [cls+' Weapon',description,
  'Normal effective range: '+num(normal.range)+' m',extent,
  ...(enchants.length?['Random affixes: '+enchants.map(weaponAffixLabel).join(', ')]:[]),
  ...(Number(fusion?.layer)>0?['Fusion affixes inherit 30% of each ingredient affix in acquisition order; repeated names are preserved']:[]),
  damage,'Full charge: '+num((item.chargeMs||1500)/1000,2)+' s; attack interval: '+num(effective.cooldown/1000,3)+' s'].join(' · ');
}
export function explainEquipment(item,record=null){
 if(!item)return '';
 if(item.slot==='weapon')return explainWeapon(item,record);
 const bonuses=describeBonuses(item,record);
 const fusionInfo=Number(record?.layer)>0?' · Fused '+Math.floor(record.layer)+' time(s), inheriting 30% of ingredient stats per success':'';
 if(item.slot==='head')return 'Headgear: '+(bonuses.length?bonuses.join(', '):'Cosmetic headwear')+fusionInfo;
 if(item.slot==='outfit')return 'Outfit: '+(bonuses.length?bonuses.join(', '):'Cosmetic outfit')+fusionInfo;
 if(item.slot==='armor'){
  const defense=Number(record?.templeStats?.defense??item.defense)||0;
  return 'Armor: '+num(Math.min(.65,defense/100)*100)+'% direct damage reduction (65% maximum per armor piece)'+fusionInfo;
 }
 if(item.slot==='shield'){
  const capacity=Number(record?.templeStats?.capacity??item.capacity)||0;
  return 'Shield: absorbs up to '+num(capacity*10,2)+' damage; regenerates after '+num(item.recharge||0)+' seconds without taking damage'+fusionInfo;
 }
 if(item.slot==='wings'){
  const impulse=Number(record?.templeStats?.impulse??item.impulse)||0;
  const gravity=Number(item.gravity),flap=Number(item.flapMs);
  return 'Wings: jump impulse '+num(impulse,2)+(Number.isFinite(gravity)?', gravity multiplier '+num(gravity,2):'')+
   (Number.isFinite(flap)?', wing-flap cooldown '+num(flap/1000,2)+' s':'')+fusionInfo;
 }
 return [item.description||item.family||item.slot,...bonuses].filter(Boolean).join(' · ')+fusionInfo;
}
