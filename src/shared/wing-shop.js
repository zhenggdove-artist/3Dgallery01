import {SWALLOWTAIL_WINGS} from '../reletter/wing-catalog.js';

// This catalog is a future paid cosmetic catalogue. Only authenticated GMs
// have preview/draw permission. No currency, ECPay or real-money paths may
// mint wings until a separately reviewed payment fulfilment is implemented.
export const WING_SHOP_VERSION=2;
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
// Draw the QUALITY first. This ensures exactly 5% Epic regardless of the
// number of previously collected wings. Repeats can occur as in real gacha.
export function drawGmWing(profile,rng=Math.random,customWings=[]){
 if(!profile?.admin)return {error:'GM only'};
 if((profile.inventory||[]).length>=600)return {error:'Inventory full'};
 const number=()=>{const value=Number(rng());return Number.isFinite(value)?Math.min(.9999999999999999,Math.max(0,value)):0;};
 let roll=number()*100,quality='relic';
 for(const [name,weight] of Object.entries(WING_QUALITY_WEIGHTS)){
  roll-=weight;if(roll<0){quality=name;break;}
 }
 const pool=[...SWALLOWTAIL_WINGS,...customWings].filter(item=>wingRarity(item)===quality);
 if(!pool.length)return {error:'No wings published in the selected tier'};
 const item=pool[Math.floor(number()*pool.length)];
 return {item,quality,priceTwd:0,mode:'gm-preview',
  remaining:SWALLOWTAIL_WINGS.length+customWings.length-new Set((profile.inventory||[]).filter(id=>pool.some(w=>w.id===id))).size};
}
