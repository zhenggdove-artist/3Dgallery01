import {itemById,shopWeaponVariant,shopPriceKey,attackStats} from './catalog.js';
// Persist only validated numeric deviations from authored defaults, per exact grade.
const field=(key,label,value,min,max,step=.01)=>({key,label,value,min,max,step});
export function tuningVariant(id,tier){
 const item=itemById(id);if(!item||!['weapon','head','outfit','shield','wings','consumable'].includes(item.slot))return null;
 if(item.slot!=='weapon')return tier===undefined?item:null;
 const rank=tier??(item.exotic?3:item.tier||1);
 if(!item.exotic&&rank!==(item.tier||1))return null;
 return shopWeaponVariant(item,rank);
}
export function tuningFields(item){
 if(!item)return [];
 const f=field,one=(k,l)=>f(k,l,1,0,10);
 if(item.slot==='weapon'){
  const a=attackStats(item,0),b=attackStats(item,1);
  const fields=[f('damage','普通攻擊基礎傷害',a.damage,0,100000),f('ultimateDamage','大絕基礎傷害',b.damage,0,100000),f('cooldown','普攻冷卻 (ms)',item.cooldown||800,70,60000,1),f('chargeMs','蓄力時間 (ms)',item.chargeMs||1500,100,60000,1),one('rangeScale','射程倍率'),one('radiusScale','技能範圍倍率'),one('effectPower','特殊效果強度倍率'),one('effectDuration','特殊效果持續時間倍率')];
  if(item.family==='petal'&&!item.exotic)fields.push(f('healPerSecond','花冠每秒回血',1,0,100));
  if(/^whip-/.test(item.id))fields.push(f('pullSpeed','牽引速度 (m/s)',4.32,0,50));
  if(['goldfish','clam','jellybrella'].includes(item.id)||(!item.exotic&&['water','ice','wave'].includes(item.family)))fields.push(f('manaRegenScale','魔力回復倍率',1.5,0,10));
  return fields;
 }
 if(item.slot==='head'||item.slot==='outfit')return ['hp','attack','defense','speed','jump'].map(k=>f('bonus_'+k,k==='hp'?'生命加成 (每單位 10 HP)':({attack:'攻擊加成',defense:'防禦加成',speed:'移速加成',jump:'跳躍加成'})[k]+' (1 = 100%)',Number(item.bonuses?.[k])||0,0,k==='hp'?100:k==='defense'?.95:10));
 if(item.slot==='shield')return [f('capacity','護盾容量 (每單位 10 HP)',item.capacity||0,0,10000),f('recharge','護盾恢復秒數',item.recharge||0,0,600)];
 if(item.slot==='wings')return [f('impulse','跳躍推力',item.impulse||0,0,100),f('gravity','重力係數',item.gravity||1,.05,5),f('flapMs','拍動間隔 (ms)',item.flapMs||300,100,10000,1),f('swiftScale','移速倍率',1.1,0,10),f('aerialScale','跳躍倍率',1.15,0,10),f('guardianScale','承傷倍率',.9,0,10),f('glideScale','滑翔重力倍率',.85,.05,5)];
 if(item.slot==='consumable')return [f(item.manaFraction!==undefined?'manaFraction':'healFraction','恢復比例 (1 = 100%)',item.manaFraction??item.healFraction??0,0,1),f('cooldownMs','冷卻 (ms)',item.cooldownMs||2000,0,60000,1)];
 return [];
}
export function validateTuning(item,values){
 if(values===null)return null;
 if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Invalid equipment tuning');
 const fields=new Map(tuningFields(item).map(f=>[f.key,f])),out={};
 for(const [k,v] of Object.entries(values)){
  const f=fields.get(k);if(!f||typeof v!=='number'||!Number.isFinite(v)||v<f.min||v>f.max||(f.step===1&&!Number.isInteger(v)))throw Error('Invalid tuning: '+k);
  if(v!==f.value)out[k]=v;
 }
 return out;
}
export function equipmentTuning(world,item){
 return item&&world?.equipmentTuning?.[shopPriceKey(item)]||{};
}
export function tunedEquipment(world,item){
 if(!item)return item;
 const t=equipmentTuning(world,item);if(!Object.keys(t).length)return item;
 const next={...item,gmTuning:t};
 for(const k of ['cooldown','chargeMs','capacity','recharge','impulse','gravity','flapMs','manaFraction','healFraction','cooldownMs'])if(t[k]!==undefined)next[k]=t[k];
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
 return v/Math.max(.001,attackStats(base,ultimate?1:0).damage);
}
