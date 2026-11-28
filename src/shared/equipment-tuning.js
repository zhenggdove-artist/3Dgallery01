import {weaponQuality,forwardCastRadius,channelReachMultiplier,isChannelStaff,GOLDFISH_SWIM_RADIUS,sustainedSpellBalance,channelInterval,isBalancedStaff,staffBaseDps,staffBaseDamage} from './weapon-abilities.js';
import {scaleUltimateFootprint} from './charge-area.js';
import {GOLDFISH_TRAVEL_SCALE,GOLDFISH_SCHOOL_RADIUS} from './goldfish-school.js';
import {SNIPER_RANGE} from './combat-balance.js';
import {weaponAffixTotals} from './weapon-affixes.js';
import {itemById,shopWeaponVariant,shopPriceKey,attackStats,ITEMS,shopWeaponGroups,shopWeaponGroupKey} from './catalog.js';
// Persist only validated numeric deviations from authored defaults, per exact grade.
const field=(key,label,value,min,max,step=.01)=>({key,label,value,min,max,step});
export function tuningVariant(id,tier){
 const item=itemById(id);if(!item||!['weapon','head','outfit','shield','wings','consumable'].includes(item.slot))return null;
 if(item.slot!=='weapon')return tier===undefined?item:null;
 const rank=tier??(item.exotic?3:item.tier||1);if(item.id==='water')return rank===1?{...item,shopTier:1}:null;
 if(!item.exotic&&rank!==(item.tier||1))return null;
 return shopWeaponVariant(item,rank);
}
// Highest authored quality keeps its V047 values. Apply a separate quality
// factor to skill area and special effects, not ordinary attack reach.
export function skillGradeScale(item){if(item?.slot!=='weapon'||item.id==='water')return 1;return [.6,.7,.8,.9,1][Math.max(1,Math.min(5,item.shopTier??item.tier??1))-1]??1;}
export function qualitySkillDefaults(item){
 if(item?.slot!=='weapon')return {};
 const scale=skillGradeScale(item);
 return {radiusScale:scale,effectPower:scale,effectDuration:scale,...(item.family==='petal'&&!item.exotic?{healPerSecond:Math.max(1,Math.min(5,item.shopTier??item.tier??1))}:{})};
}
export function migrateSkillQuality(world){
 if(world.skillQualityV048)return;
 const overrides=world.equipmentTuning??={};
 for(const group of shopWeaponGroups(ITEMS.filter(i=>i.slot==='weapon'))){
  const variants=group.variants,top=variants.at(-1);if(!top)continue;
  const baseline=overrides[shopPriceKey(top)]||{};
  for(const item of variants){const key=shopPriceKey(item),next={...overrides[key]};
   for(const [field,value] of Object.entries(qualitySkillDefaults(item))){
    if(baseline[field]!==undefined)next[field]=+(baseline[field]*value/(qualitySkillDefaults(top)[field]??1)).toFixed(6);else delete next[field];
   }
   if(Object.keys(next).length)overrides[key]=next;else delete overrides[key];
  }
 }
 world.skillQualityV048=true;
}
// One-time rebalance: old staff damage values used catalog units, not HP/DPS.
export function migrateStaffBalance(world){
 if(world.staffBalanceV150)return;
 const overrides=world.equipmentTuning??={};
 for(const item of ITEMS.filter(isBalancedStaff)){
  const key=shopPriceKey(tuningVariant(item.id,item.tier)||item),prior=overrides[key];if(!prior)continue;
  const next={...prior};for(const field of ['damage','ultimateDamage','manaCost','healPerSecond'])delete next[field];
  if(Object.keys(next).length)overrides[key]=next;else delete overrides[key];
 }
 world.staffBalanceV150=true;
}
function authoredDamageField(item,ultimate){
 if(isBalancedStaff(item))return ultimate&&item.family!=='ice'?staffBaseDps(item):staffBaseDamage(item,ultimate);
 return attackStats(item,ultimate?1:0).damage;
}
export function tuningFields(item,world){
 if(!item)return [];
 const f=field,defaults=qualitySkillDefaults(item),one=(k,l)=>f(k,l,defaults[k]??1,0,10);
 if(item.slot==='weapon'){
  const a=attackStats(item,0),b=attackStats(item,1);
  if(item.id==='black-cat')return [f('damage','普通攻擊基礎傷害',a.damage,0,100000),f('cooldown','普攻冷卻 (ms)',item.cooldown||800,70,4000,1),one('rangeScale','射程倍率')];
  const staff=isBalancedStaff(item),fields=[f('damage',staff?'普通攻擊基礎 HP／次':'普通攻擊基礎傷害',authoredDamageField(item,false),0,100000),f('ultimateDamage',staff?(item.family==='ice'?'大絕基礎 HP／次':'大絕基礎 DPS（單一目標）'):'大絕基礎傷害',authoredDamageField(item,true),0,100000),f('manaCost','大絕單次魔力消耗 (MP)',weaponManaQuote(world,item).initial,0,10000,1),f('cooldown','普攻冷卻 (ms)',item.cooldown||800,70,4000,1),f('chargeMs','蓄力時間 (ms)',item.chargeMs||1500,100,60000,1),one('rangeScale','射程倍率'),one('radiusScale','技能範圍倍率'),one('effectPower','特殊效果強度倍率'),one('effectDuration','特殊效果持續時間倍率')];
  if(staff&&item.family!=='ice'){const balance=sustainedSpellBalance(item),initial=equipmentTuning(world,item).manaCost??balance.initial;fields.push(f('channelManaPerSecond','持續施法每秒消耗 MP',balance.mpPerSecond*initial/balance.initial,0,10000));}
  if(item.family==='petal'&&!item.exotic)fields.push(f('healPerSecond','花冠每秒回血',defaults.healPerSecond,0,100));
  if(/^whip-/.test(item.id))fields.push(f('pullSpeed','牽引速度 (m/s)',4.32,0,50));
  if(item.family==='beam'&&!item.exotic)fields.push(f('ramp','每秒增傷倍率',1.2,1,3),f('rampCap','累積增傷上限',5,1,30));
  if(/^tide-/.test(item.id))fields.push(f('pushDistance','擊退距離 (m)',3,0,20));
  if(['goldfish','clam','jellybrella'].includes(item.id)||(!item.exotic&&['water','ice','wave'].includes(item.family)))fields.push(f('manaRegenScale','魔力回復倍率',1.5,0,10));
  return fields;
 }
 if(item.slot==='head'||item.slot==='outfit')return ['hp','attack','defense','speed','jump'].map(k=>f('bonus_'+k,k==='hp'?'生命加成 (每單位 10 HP)':({attack:'攻擊加成',defense:'防禦加成',speed:'移速加成',jump:'跳躍加成'})[k]+' (1 = 100%)',Number(item.bonuses?.[k])||0,0,k==='hp'?100:k==='defense'?.95:10));
 if(item.slot==='shield')return [f('capacity','護盾容量 (每單位 10 HP)',item.capacity||0,0,10000),f('recharge','護盾恢復秒數',item.recharge||0,0,600)];
 if(item.slot==='wings'){const a=item.design==='painted-wing'?(item.abilities??[item.ability]):[];return [f('impulse','跳躍推力',item.impulse||0,0,100),f('gravity','重力係數',item.gravity||1,.05,5),f('flapMs','拍動間隔 (ms)',item.flapMs||300,100,10000,1),...(a.includes('swift')?[f('swiftScale','移速倍率',1.1,0,10)]:[]),...(a.includes('aerial')?[f('aerialScale','跳躍倍率',1.15,0,10)]:[]),...(a.includes('guardian')?[f('guardianScale','承傷倍率',.9,0,10)]:[]),...(a.includes('glide')?[f('glideScale','滑翔重力倍率',.85,.05,5)]:[])];}
 if(item.slot==='consumable')return [f(item.manaFraction!==undefined?'manaFraction':'healFraction','恢復比例 (1 = 100%)',item.manaFraction??item.healFraction??0,0,1),f('cooldownMs','冷卻 (ms)',item.cooldownMs||2000,0,60000,1)];
 return [];
}
export function validateTuning(item,values){
 if(values===null)return null;
 if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Invalid equipment tuning');
 const fields=new Map(tuningFields(item).map(f=>[f.key,f])),out={};
 for(const [k,v] of Object.entries(values)){
  const f=fields.get(k);if(!f||typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max||(f.step===1&&!Number.isInteger(v)))throw Error('Invalid tuning: '+k);
  out[k]=v;
 }
 return out;
}
export function equipmentTuning(world,item){
 return item?{...qualitySkillDefaults(item),...(world?.equipmentTuning?.[shopPriceKey(item)]||{})}:{};
}
export function tunedEquipment(world,item){
 if(!item)return item;
 const t=equipmentTuning(world,item);if(!Object.keys(t).length)return item;
 const next={...item,gmTuning:t};
 for(const k of ['cooldown','chargeMs','capacity','recharge','impulse','gravity','flapMs','manaFraction','healFraction','cooldownMs'])if(t[k]!==undefined)next[k]=t[k];
 if(item.id==='black-cat'){next.chargeMs=0;next.autoCharge=false;}
 if(item.slot==='head'||item.slot==='outfit'){
  next.bonuses={...item.bonuses};for(const k of ['hp','attack','defense','speed','jump'])if(t['bonus_'+k]!==undefined)next.bonuses[k]=t['bonus_'+k];
 }
 return next;
}
// The damage numbers are authored attackStats units, not the final post-armour
// HP hit; preserve existing quality/fusion/affix ratios and PvP balance.
export function tuningDamageRatio(world,item,ultimate){
 const t=equipmentTuning(world,item),v=t[ultimate?'ultimateDamage':'damage'];
 if(v===undefined)return 1;
 const base=tuningVariant(item.id,item.shopTier??item.tier??1)||item;
 return v/Math.max(.001,authoredDamageField(base,ultimate));
}

export function linkedTuningVariants(item){
 if(!item)return [];
 if(item.slot==='weapon'||item.slot==='outfit'){
  const group=shopWeaponGroups(ITEMS).find(g=>g.key===shopWeaponGroupKey(item));
  const variants=group?.variants?.filter(v=>v&&tuningVariant(v.id,v.shopTier))||[];
  if(variants.length&&variants.some(v=>shopPriceKey(v)===shopPriceKey(item)))return variants;
 }
 return [item];
}
export function linkedEquipmentTuning(world,item,values){
 const variants=linkedTuningVariants(item),out={...world.equipmentTuning};
 if(values===null){for(const v of variants)delete out[shopPriceKey(v)];return {overrides:out,variants};}
 const supplied=validateTuning(item,values),sourceFields=new Map(tuningFields(item,world).map(f=>[f.key,f])),defaults=new Map(tuningFields(item).map(f=>[f.key,f]));
 const sourceOld=equipmentTuning(world,item);
 for(const variant of variants){
  const key=shopPriceKey(variant),prior=equipmentTuning(world,variant),next={...world.equipmentTuning?.[key]};
  const authored=new Map(tuningFields(variant).map(f=>[f.key,f])),effective=new Map(tuningFields(variant,world).map(f=>[f.key,f]));
  for(const [field,value] of Object.entries(supplied)){
   const f=effective.get(field),original=authored.get(field),source=sourceFields.get(field);
   if(!f||!source)continue;
   const before=sourceOld[field]??source.value,current=prior[field]??f.value;
   if(value===before)continue;
   const sourceDefault=defaults.get(field)?.value||0;
   let result=shopPriceKey(item)===key?value:before!==0?current*value/before:sourceDefault!==0?original.value*value/sourceDefault:value;
   result=Math.min(f.max,Math.max(f.min,result));
   result=f.step===1?Math.round(result):+result.toFixed(6);
   if(!['manaCost','channelManaPerSecond'].includes(field)&&Math.abs(result-original.value)<1e-9)delete next[field];else next[field]=result;
  }
  if(Object.keys(next).length)out[key]=next;else delete out[key];
 }
 return {overrides:out,variants};
}
export function manaCostFromStats(weapon,stats,quality,channel=false,fusionCount=0){
 if(!stats.ultimate)return 0;
 const sustained=sustainedSpellBalance(weapon);
 if(sustained){
  const initial=weapon.gmTuning?.manaCost??sustained.initial;
  const rate=weapon.gmTuning?.channelManaPerSecond??sustained.mpPerSecond*initial/sustained.initial;
  return channel?+(rate*channelInterval(weapon)/1000).toFixed(2):initial;
 }
 const tier=Math.max(1,quality?.tier||weapon.tier||1);
 const power=Math.max(0,Number(stats.damage)||0),range=Math.max(0,Number(stats.range)||0),radius=Math.max(0,Number(stats.radius)||0);
 const cost=weapon.gmTuning?.manaCost??Math.min(75,Math.round(30+(tier-1)*4+Math.max(0,power-12)*.28+Math.max(0,range-30)*.10+Math.max(0,radius-6)*.55+fusionCount*4));
 return channel?(cost===0?0:Math.max(2,Math.ceil(cost*.28*Math.max(260,weapon.cooldown||700)/1000))):cost;
}
export function weaponManaQuote(world,item,record=null){
 if(item?.slot!=='weapon'||item.id==='black-cat')return {initial:0,pulse:0,channel:false};
 const w=tunedEquipment(world,item),q=weaponQuality(w,record),stats=attackStats(w,1),en=weaponAffixTotals(w);
 const channel=isChannelStaff(w)&&w.family!=='ice';
 stats.damage=+(stats.damage*q.damage*(1+en.damage/100)*(1+en.charge/100)).toFixed(3);
 if(channel||w.family==='ice')stats.range=Math.max(stats.range,w.id==='clam'?10:Math.min(18,w.range))*channelReachMultiplier(w);
 stats.range=+(stats.range*q.range).toFixed(2);
 if(w.id==='black-cat')stats.range=SNIPER_RANGE;
 stats.radius=forwardCastRadius(w,q,stats.radius,channel||w.family==='ice');
 if(w.id==='jellybrella')stats.radius=Math.max(10,stats.radius*2);
 if(w.id==='goldfish')stats.radius=GOLDFISH_SWIM_RADIUS*q.visual;
 scaleUltimateFootprint(stats,w,q);
 if(w.id==='goldfish'){stats.range=+(stats.range*GOLDFISH_TRAVEL_SCALE).toFixed(3);stats.radius=GOLDFISH_SCHOOL_RADIUS*q.visual;}
 if(w.id==='giraffe'){stats.range=+(w.chargedRange*q.range).toFixed(2);stats.damage=+(stats.damage*3).toFixed(3);stats.radius=Math.max(stats.radius,5.9*q.visual);}
 const t=equipmentTuning(world,w);stats.damage*=tuningDamageRatio(world,w,true);stats.range*=t.rangeScale??1;applySkillAreaScale(stats,w,t);
 const count=(record?.effects||[]).length;
 return {initial:manaCostFromStats(w,stats,q,false,count),pulse:channel?manaCostFromStats(w,stats,q,true,count):0,channel};
}
export function weaponManaLabel(q){return 'ULT '+q.initial+' MP'+(q.channel?' · +'+q.pulse+' MP / pulse':'');}
export const restorativeType=item=>item?.manaFraction!==undefined?'mana':'health';
export function restorativeCooldown(profile,item){return Number(profile?.restorativeCooldowns?.[restorativeType(item)]??profile?.consumableCooldownUntil??0)||0;}

export function applySkillAreaScale(stats,item,tuning=equipmentTuning(null,item)){
 if(!stats?.ultimate)return stats;
 const scale=tuning.radiusScale??1;stats.radius*=scale;
 if(item?.family==='saber'||item?.id==='clam')stats.range*=scale;
 return stats;
}
export function bloomHealRate(world,item){
 const t=equipmentTuning(world,item);
 // Healing has its own absolute quality-scaled field; effect power modifies
 // it relative to that grade's baseline, avoiding a second default nerf.
 return (t.healPerSecond??1)*(t.effectPower??1)/skillGradeScale(item);
}
