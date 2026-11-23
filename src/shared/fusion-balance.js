import {attackStats,itemById} from './catalog.js';
import {pvpShotDamage} from './combat-balance.js';
import {weaponQuality} from './weapon-abilities.js';

// Compare against a same-rarity ordinary elemental staff, not the sniper's
// deliberately lethal standalone headshot. A borrowed sniper must be no
// stronger than ANY other first/second-slot echo in normal fusion balance.
export function sniperFusionReference(sniper=itemById('black-cat')){
 const tier=Math.min(5,Math.max(1,Math.floor(Number(sniper?.tier)||3)));
 return itemById('ember-'+tier);
}
export function sniperMaterialStat(sniper,key){
 const raw=Math.max(0,Number(sniper?.[key])||0);
 if(sniper?.id!=='black-cat'||!['damage','chargeDamage'].includes(key))return raw;
 const reference=sniperFusionReference(sniper);
 return Math.min(raw,Math.max(0,Number(reference?.[key])||0)*.45);
}
export function fusionSniperEchoDamage(sniper=itemById('black-cat')){
 const reference=sniperFusionReference(sniper),full=attackStats(sniper,1),
  referenceFull=attackStats(reference,1),referenceQuality=weaponQuality(reference);
 return {
  // Always use the usual fusion echo multiplier, and cap to a conventional
  // staff of the same rarity; the original sniper itself remains untouched.
  damage:+Math.min(full.damage*.08,referenceFull.damage*.10).toFixed(3),
   pvpDamage:+Math.min(2.5,
    pvpShotDamage(sniper,full,weaponQuality(sniper))*.08,
    pvpShotDamage(reference,referenceFull,referenceQuality)*.10
   ).toFixed(3)
 };
}
