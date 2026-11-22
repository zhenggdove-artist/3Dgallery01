import {affixById} from '../reletter/combat-traits.js';
import {normalizedWeaponAffixes,weaponAffixById,weaponAffixTotals} from './weapon-affixes.js';

const round=(n,digits=1)=>Number(n.toFixed(digits));
const elementNames={
 fire:'熾焰',ice:'凜冽',water:'潮汐',wave:'潮汐',
 lightning:'雷鳴',beam:'光耀',petal:'繁花',
 saber:'劍術',swatter:'毒蝕',pan:'震盪',
 planter:'繁茂',palm:'繁茂',whip:'纏繞'
};
const affixDescriptions={
 brutal:'暴擊率額外 +25%；暴擊時直接傷害 ×1.8',
 searing:'燃燒：每秒 2 傷害，持續 5 秒',
 glacial:'冰緩：目標移速降低 50%，持續 4 秒',
 swift:'攻擊冷卻縮短 30%',
 thunderous:'命中暈眩 0.65 秒，每 4 秒可再次觸發',
 vampiric:'每次命中恢復 0.35 HP，每 2 秒可觸發',
 farseeing:'武器射程 +35%',
 vast:'技能影響半徑 +50%',
 sundering:'命中後目標受傷害 +20%，持續 5 秒',
 venomous:'中毒：每秒 0.8 傷害，持續 14 秒',
 resonant:'連續命中每層傷害 +8%，最多 5 層',
 stalwart:'受到的傷害減少 25%',
 mighty:'攻擊力 +30%，移動速度 -10%',
 featherlight:'跳躍高度 +35%，移動速度 +10%',
 binding:'纏繞目標 1.2 秒',
 exultant:'移動速度 +55%'
};
export function weaponPresentation(item,record={}){
 const origin=record?.original||{},stats=record?.templeStats||origin.stats||{},count=Number.isFinite(record?.layer)?record.layer:(Number.isFinite(origin.fusionCount)?origin.fusionCount:0);
 const level=Math.max(0,Math.min(99,Math.floor(count)));
 const affixIds=[...new Set([...(origin.affixIds||[]),origin.affixId,...(record?.affixIds||[]),record?.affixId].filter(Boolean))];
 const prefixes=affixIds.map(id=>affixById(id)?.name.replace(/的$/,'')).filter(Boolean);
 const enchantList=item.slot==='weapon'?normalizedWeaponAffixes(record):[];
 const enchantPrefixes=enchantList.map(x=>weaponAffixById(x.id)?.name||'');
 const prefix=[...prefixes,...enchantPrefixes].filter(Boolean).join('');
 const title=(prefix?prefix+'的':'')+item.name+(level?'（+'+level+'）':'');
 const traits=[];
 for(const id of affixIds){const a=affixById(id);if(a)traits.push({name:a.name,details:affixDescriptions[id]||a.description});}
 // One visible entry for EACH original and inherited enchant, including
 // repeated prefixes. Fused values keep their 30% material contribution.
 for(const entry of enchantList){
  const def=weaponAffixById(entry.id);
  if(def)traits.push({name:def.name+'的',details:def.label+' +'+entry.percent+'%'});
 }
 if(item.slot==='weapon'){
  const crit=Number(item.critChance);
  if(Number.isFinite(crit)&&crit>=.3&&!affixIds.includes('brutal'))
   traits.push({name:'殘暴',details:'基礎暴擊率 '+Math.round(crit*100)+'%'});
  else if(item.family&&elementNames[item.family])
   traits.push({name:elementNames[item.family],details: '屬性：'+(item.element||item.family)});
 }
 const bonuses=[];
 if(enchantList.length){const totals=weaponAffixTotals(enchantList);
  bonuses.push('隨機詞條 '+enchantList.length+' 個 · '+Object.entries(totals).filter(([,v])=>v>0).map(([k,v])=>({crit:'暴擊率',defense:'減傷',attack:'攻擊力',damage:'武器傷害',charge:'大絕傷害',haste:'攻擊速度',hp:'生命上限',speed:'移速',jump:'跳高'}[k]+' +'+v+'%')).join(' · '));}

 if(Number.isFinite(record.bonus)&&record.bonus>0)bonuses.push('合成增傷 +'+round(record.bonus));
 if(Number.isFinite(stats.damage)&&Number.isFinite(item.damage)){
  const difference=(record.templeStats?stats.damage:stats.damage*10)-item.damage;
  if(difference>0.05)bonuses.push('傷害 +'+round(difference));
 }
 if(Number.isFinite(stats.chargeDamage)&&Number.isFinite(item.chargeDamage)){
  const difference=(record.templeStats?stats.chargeDamage:stats.chargeDamage*10)-item.chargeDamage;
  if(difference>0.05)bonuses.push('蓄力傷害 +'+round(difference));
 }
 if(Number.isFinite(stats.cooldown)&&Number.isFinite(item.cooldown)&&stats.cooldown<item.cooldown)
  bonuses.push('攻擊冷卻 -'+Math.round((1-stats.cooldown/item.cooldown)*100)+'%');
 if(Number.isFinite(stats.range)&&Number.isFinite(item.range)&&stats.range>item.range+.01)
  bonuses.push('射程 +'+round(stats.range-item.range)+'m');
 if(Number.isFinite(stats.radius)&&Number.isFinite(item.radius)&&stats.radius>item.radius+.01)
  bonuses.push('範圍半徑 +'+round(stats.radius-item.radius)+'m');
 const labels={hp:'生命上限',attack:'攻擊力',defense:'減傷',speed:'移動速度',jump:'跳躍高度',fusion:'合成成功率'};
 for(const [ability,value] of Object.entries(record?.templeStats?.bonuses||{})){
  const extra=(Number(value)||0)-(Number(item.bonuses?.[ability])||0);
  if(extra>.000001)bonuses.push((labels[ability]||ability)+' +'+(ability==='hp'?round(extra*10,2)+' HP':round(extra*100,2)+'%'));
 }
 for(const id of (record.effects||[]).slice(0,2))bonuses.push('附加大絕 '+id+' · 20% 傷害 / 50% 範圍');
 if(level&&!bonuses.length)bonuses.push('強化次數 '+level);
 return {title,level,traits,bonuses};
}
