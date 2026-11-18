import {SWALLOWTAIL_WINGS} from '../reletter/wing-catalog.js';
import {wingDrawRatePercent,totalCustomWingRates} from './custom-wings.js';

// Public Google accounts get five lifetime free trial draws. The server owns
// the draw counter and prize. No payment or external checkout is represented
// as successful until a verified payment fulfilment exists.
export const WING_SHOP_VERSION=4;
export const FREE_WING_TRIAL_LIMIT=5;
export const WING_QUALITY_WEIGHTS=Object.freeze({
 common:45,uncommon:30,rare:18,epic:5,relic:2
});
export const WING_QUALITY_NAMES=Object.freeze({
 common:'WHITE · Common',uncommon:'GREEN · Uncommon',
 rare:'BLUE · Rare',epic:'PURPLE · Epic',relic:'GOLD · Relic'
});
export const WING_QUALITY_COLORS=Object.freeze({
 common:'#e5dfed',uncommon:'#83da9b',
 rare:'#79bbfa',epic:'#ba7dff',relic:'#f2d27c'
});
const index=['common','uncommon','rare','epic','relic'];
export function wingRarity(item){
 return index[Math.max(0,Math.min(index.length-1,(item?.tier||1)-1))];
}
// GM-defined percentages are exact absolute chances per draw. They are
// resolved before the remaining probability follows the unchanged base
// rarity bands (45/30/18/5/2). Retired wings and 0% wings never drop.
export function drawGmWing(profile,rng=Math.random,customWings=[]){
 if(!profile?.admin)return {error:'GM only'};
 const drawn=drawWing(profile,rng,customWings);
 return drawn.error?drawn:{...drawn,mode:'gm-preview'};
}
export function drawWing(profile,rng=Math.random,customWings=[]){
 if((profile?.inventory||[]).length>=600)return {error:'Inventory full'};
 const number=()=>{
  const value=Number(rng());
  return Number.isFinite(value)?Math.min(.9999999999999999,Math.max(0,value)):0;
 };
 const available=customWings.filter(wing=>wing?.retired!==true);
 const total=totalCustomWingRates(available);
 if(total>100+1e-8)return {error:'Published wing probabilities exceed 100%'};
 let roll=number()*100,item=null;
 if(roll<total){
  for(const wing of available){
   roll-=wingDrawRatePercent(wing);
   if(roll<0){item=wing;break;}
  }
 }else{
  // Conditional base rarity distribution applies only to the remaining pool.
  let qualityRoll=total>=100?0:(roll-total)*100/(100-total);
  let quality='relic';
  for(const [name,weight] of Object.entries(WING_QUALITY_WEIGHTS)){
   qualityRoll-=weight;
   if(qualityRoll<0){quality=name;break;}
  }
  const pool=SWALLOWTAIL_WINGS.filter(wing=>wingRarity(wing)===quality);
  if(!pool.length)return {error:'No wings published in the selected tier'};
  item=pool[Math.floor(number()*pool.length)];
 }
 if(!item)return {error:'No eligible wing in the configured draw pool'};
 const quality=wingRarity(item);
 const all=[...SWALLOWTAIL_WINGS,...available],ids=new Set(all.map(wing=>wing.id));
 const uniqueOwned=new Set([...(profile.inventory||[]),item.id].filter(id=>ids.has(id)));
 return {item,quality,priceTwd:0,mode:'free-trial',
  remaining:all.length-uniqueOwned.size};
}
