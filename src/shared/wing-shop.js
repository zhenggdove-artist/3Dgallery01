import {SWALLOWTAIL_WINGS} from '../reletter/wing-catalog.js';

// This catalog is a future paid cosmetic catalogue. Only authenticated GMs
// have preview/draw permission. No currency, ECPay or real-money paths may
// mint wings until a separately reviewed payment fulfilment is implemented.
export const WING_SHOP_VERSION=1;
export const WING_QUALITY_WEIGHTS=Object.freeze({
 common:45,uncommon:28,rare:17,epic:8,relic:2
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
export function drawGmWing(profile,rng=Math.random){
 if(!profile?.admin)return {error:'GM only'};
 const owned=new Set(profile.inventory||[]);
 const remaining=SWALLOWTAIL_WINGS.filter(wing=>!owned.has(wing.id));
 if(!remaining.length)return {error:'All 20 Papilio wings have already been collected'};
 if(profile.inventory.length>=600)return {error:'Inventory full'};
 const total=remaining.reduce((sum,item)=>sum+WING_QUALITY_WEIGHTS[wingRarity(item)],0);
 const number=Number(rng()),clamped=Number.isFinite(number)?Math.max(0,Math.min(.9999999999999999,number)):0;
 let cursor=clamped*total;
 let chosen=remaining[remaining.length-1];
 for(const item of remaining){
  cursor-=WING_QUALITY_WEIGHTS[wingRarity(item)];
  if(cursor<0){chosen=item;break;}
 }
 return {item:chosen,quality:wingRarity(chosen),priceTwd:0,mode:'gm-preview',
  remaining:remaining.length-1};
}
