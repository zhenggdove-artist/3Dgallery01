import {affixById} from '../reletter/combat-traits.js';
import {normalizedWeaponAffixes,weaponAffixById,weaponAffixTotals} from './weapon-affixes.js';

const round=(n,digits=1)=>Number(n.toFixed(digits));
const elementNames={
 fire:'Flame',ice:'Frost',water:'Tide',wave:'Tide',
 lightning:'Thunder',beam:'Radiance',petal:'Bloom',
 saber:'Swordsmanship',swatter:'Venom',pan:'Impact',
 planter:'Botany',palm:'Botany',whip:'Binding'
};
const affixDescriptions={
 brutal:'Extra 25% critical chance; critical hits deal 1.8x direct damage',
 searing:'Burn: 2 damage per second for 5 seconds',
 glacial:'Chill: reduce target movement by 50% for 4 seconds',
 swift:'Reduce attack cooldown by 30%',
 thunderous:'Stun on hit for 0.65 seconds; 4-second cooldown',
 vampiric:'Restore 0.35 HP on hit; 2-second cooldown',
 farseeing:'Weapon range +35%',
 vast:'Ability radius +50%',
 sundering:'Target takes +20% damage for 5 seconds',
 venomous:'Poison: 0.8 damage per second for 14 seconds',
 resonant:'Consecutive hits increase damage by 8% per stack, up to 5 stacks',
 stalwart:'Incoming damage -25%',
 mighty:'Attack +30%; movement speed -10%',
 featherlight:'Jump height +35%; movement speed +10%',
 binding:'Root the target for 1.2 seconds',
 exultant:'Movement speed +55%'
};
export function weaponPresentation(item,record={}){
 const origin=record?.original||{},stats=record?.templeStats||origin.stats||{},count=Number.isFinite(record?.layer)?record.layer:(Number.isFinite(origin.fusionCount)?origin.fusionCount:0);
 const level=Math.max(0,Math.min(99,Math.floor(count)));
 const affixIds=[...new Set([...(origin.affixIds||[]),origin.affixId,...(record?.affixIds||[]),record?.affixId].filter(Boolean))];
 const prefixes=affixIds.map(id=>affixById(id)?.name).filter(Boolean);
 const enchantList=item.slot==='weapon'?normalizedWeaponAffixes(record).filter(e=>item.id!=='black-cat'||e.id!=='surging'):[];
 const enchantPrefixes=enchantList.map(x=>weaponAffixById(x.id)?.name||'').filter(Boolean);
 const prefix=[...prefixes,...enchantPrefixes].filter(Boolean).join(' ');
 const title=[prefix,item.name].filter(Boolean).join(' ')+(level?' (+'+level+')':'');
 const traits=[];
 for(const id of affixIds){const a=affixById(id);if(a)traits.push({name:a.name,details:affixDescriptions[id]||a.description});}
 // Every inherited affix, including duplicates, remains visible by name.
 for(const entry of enchantList){
  const def=weaponAffixById(entry.id);
  if(def)traits.push({name:def.name,details:def.label+' +'+entry.percent+'%'});
 }
 if(item.slot==='weapon'){
  const crit=Number(item.critChance);
  if(item.id==='accordion')
   traits.push({name:'Musical',details:'Ultimate: note tornado moves forward, hitting each target it touches once per second'});
  else if(Number.isFinite(crit)&&crit>=.3&&!affixIds.includes('brutal'))
   traits.push({name:'Brutal',details:'Base critical chance '+Math.round(crit*100)+'%'});
  else if(item.family&&elementNames[item.family])
   traits.push({name:elementNames[item.family],details:'Element: '+(item.element||item.family)});
 }
 const bonuses=[];
 if(enchantList.length){
  const totals=weaponAffixTotals(enchantList);
  const labels={crit:'Critical Chance',defense:'Damage Reduction',attack:'Attack Power',damage:'Weapon Damage',charge:'Ultimate Damage',haste:'Attack Speed',hp:'Maximum HP',speed:'Movement Speed',jump:'Jump Height'};
  bonuses.push('Random affixes: '+enchantList.length+' · '+Object.entries(totals).filter(([,v])=>v>0).map(([k,v])=>labels[k]+' +'+v+'%').join(' · '));
 }
 if(Number.isFinite(record.bonus)&&record.bonus>0)bonuses.push('Fusion damage +'+round(record.bonus));
 if(Number.isFinite(stats.damage)&&Number.isFinite(item.damage)){
  const difference=(record.templeStats?stats.damage:stats.damage*10)-item.damage;
  if(difference>0.05)bonuses.push('Damage +'+round(difference));
 }
 if(item.id!=='black-cat'&&Number.isFinite(stats.chargeDamage)&&Number.isFinite(item.chargeDamage)){
  const difference=(record.templeStats?stats.chargeDamage:stats.chargeDamage*10)-item.chargeDamage;
  if(difference>0.05)bonuses.push('Charged Damage +'+round(difference));
 }
 if(Number.isFinite(stats.cooldown)&&Number.isFinite(item.cooldown)&&stats.cooldown<item.cooldown)
  bonuses.push('Attack Cooldown -'+Math.round((1-stats.cooldown/item.cooldown)*100)+'%');
 if(Number.isFinite(stats.range)&&Number.isFinite(item.range)&&stats.range>item.range+.01)
  bonuses.push('Range +'+round(stats.range-item.range)+' m');
 if(Number.isFinite(stats.radius)&&Number.isFinite(item.radius)&&stats.radius>item.radius+.01)
  bonuses.push('Area Radius +'+round(stats.radius-item.radius)+' m');
 const labels={hp:'Maximum HP',attack:'Attack Power',defense:'Damage Reduction',speed:'Movement Speed',jump:'Jump Height',fusion:'Fusion Success Chance'};
 for(const [ability,value] of Object.entries(record?.templeStats?.bonuses||{})){
  const extra=(Number(value)||0)-(Number(item.bonuses?.[ability])||0);
  if(extra>.000001)bonuses.push((labels[ability]||ability)+' +'+(ability==='hp'?round(extra*10,2)+' HP':round(extra*100,2)+'%'));
 }
 for(const id of (item.id==='black-cat'?[]:(record.effects||[]).filter(id=>id!=='black-cat')).slice(0,2))bonuses.push('Additional Ultimate: '+id+' · 20% damage / 50% area');
 if(level&&!bonuses.length)bonuses.push('Fusion Level +'+level);
 return {title,level,traits,bonuses};
}
