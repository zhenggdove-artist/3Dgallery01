import {EQUIPMENT,DEFAULT_WEAPON,attackStats as reletterAttackStats} from '../reletter/equipment-catalog.js';
import {SNIPER_RANGE} from './combat-balance.js';
import {normalMeleeFootprint} from './melee-contact.js';
export const RARITIES = Object.freeze([
  {id:'common',name:'Common',color:'#d7d2c6',weight:50},
  {id:'uncommon',name:'Uncommon',color:'#76d59a',weight:28},
  {id:'rare',name:'Rare',color:'#71aef4',weight:14},
  {id:'epic',name:'Epic',color:'#bd7bea',weight:6},
  {id:'relic',name:'Relic',color:'#f1cc62',weight:2}
]);

const TIER_PRICES = [240,620,1450,3300,7600];
// Only the specified five quality tiers and Black Cat belong to Mystery.
// Family labels alone are insufficient: many unrelated exotics are 'pan'.
export const isMysteryWeapon=item=>!!item&&item.slot==='weapon'&&
 (item.id==='black-cat'||/^(whip|pan|swatter)-[1-5]$/.test(item.id));

export const ARMOR = Object.freeze([
  ['moss-guard','Moss Guard','armor','#73936c',1,310,14],
  ['flood-coat','Flood Coat','armor','#5d92a6',2,760,28],
  ['signal-mail','Signal Mail','armor','#ae78bd',3,1700,45],
  ['relic-shell','Relic Shell','armor','#d7bd63',4,3800,66],
  ['pilgrim-mask','Pilgrim Mask','head','#a98f72',1,260,7],
  ['glass-crown','Glass Crown','head','#89cddb',2,880,13],
  ['temple-halo','Temple Halo','head','#e4c467',4,4400,24]
].map(([id,name,slot,color,tier,price,defense])=>Object.freeze({id,name,slot,color,tier,design:({'pilgrim-mask':'hockey','glass-crown':'crown','temple-halo':'angel'})[id],rarity:RARITIES[tier-1].id,price,sell:Math.floor(price*.25),defense})));

// Material-type pickups are retired. Keep an empty named export for existing
// consumers; the three legacy IDs are no longer in the catalog or inventory.
export const MATERIALS = Object.freeze([]);

// Original RELETTER identity, range, cadence and effects; only Temple economy/HP scale differ.
export const RELETTER_ITEMS=Object.freeze([DEFAULT_WEAPON,...EQUIPMENT].filter(original=>original.id!=='chiang-token'&&!['seed','harvest'].includes(original.slot)).map(original=>{
  const tier=Math.max(1,Math.min(5,original.tier||1));
  const basePrice=original.notForSale||original.id==='water'?0:TIER_PRICES[tier-1]+Math.min(180,original.price||0);
  const mysteryWeapon=isMysteryWeapon(original),price=basePrice*(mysteryWeapon?5:1);
  return Object.freeze({...original,price,mysteryWeapon,sell:Math.floor(price*.25),rarity:RARITIES[tier-1].id,damage:original.damage===undefined?undefined:original.damage*10*(original.id==='white-cat'?.5:1),chargeDamage:original.chargeDamage===undefined?undefined:original.chargeDamage*10*(original.id==='white-cat'?.5:1),cooldown:original.id==='white-cat'?Math.max(65,Math.round(original.cooldown*.5)):original.cooldown});
}));
export const WEAPONS=Object.freeze(RELETTER_ITEMS.filter(item=>item.slot==='weapon'));
export const EQUIPPABLE_SLOTS=Object.freeze(['weapon','armor','head','outfit','shield','wings']);
export const SPELL_FAMILIES=Object.freeze(['water','ice','fire','lightning','beam','petal','wave']);
export function attackStats(item,charge=0){
 const result=reletterAttackStats(item,charge);
 if(item.id==='water')result.damage*=10;
 if(item.id==='black-cat'){result.range=SNIPER_RANGE;result.damage*=3;}
 if(item.id==='accordion'&&!result.ultimate){
  // The BAG label, aim preview and server hitbox must expose the SAME reach.
  const contact=normalMeleeFootprint(item);
  result.range=Math.min(result.range,contact.range);
  result.radius=Math.min(result.radius,contact.radius);
 }
 if(SPELL_FAMILIES.includes(item.family)&&!item.exotic)result.range=+(result.range/3).toFixed(3);
 // Keep the narrower #59 preview equal to the real server hit tube.
 // The sword fissure is now 60% of the previous full-charge reach.
 // The width contracts to one third of the previous hitbox and warning.
 if(item.family==='saber'&&result.ultimate){
  result.range=+(result.range*2.4).toFixed(3);
  result.radius=+(result.radius*2/9).toFixed(3);
 }
 return result;
}
export const ITEMS = Object.freeze([...RELETTER_ITEMS,...ARMOR]);
const INDEX = new Map(ITEMS.map(item=>[item.id,item]));
export const itemById = id => INDEX.get(id) || null;

export const SHOP_ITEMS = Object.freeze(ITEMS.filter(item=>item.slot!=='material'&&!item.notForSale&&item.price>0));
export const ECONOMY = Object.freeze({
  platformCoinValue:40,
  platformCoinRespawnMs:90_000,
  deathCoinFraction:.20,
  groundSpawnMinMs:28_000,
  groundSpawnMaxMs:52_000,
  groundDropLifetimeMs:300_000,
  maxGroundDrops:10,
  monsterIntervalMs:600_000,
  monsterCoinMin:280,
  monsterCoinMax:520,
  fusionBaseCost:0,
  buildCosts:Object.freeze({cube:80,bar:110,cylinder:110,wall:80,column:110,platform:170,tree:95,house:240})
});

export const STARTER_LOADOUT = Object.freeze({weapon:'white-cat',armor:null,head:null,outfit:null,shield:null,wings:null});

export function weightedChoice(entries,rng=Math.random){
  const total=entries.reduce((sum,entry)=>sum+(entry.weight||1),0);let cursor=rng()*total;
  for(const entry of entries){cursor-=entry.weight||1;if(cursor<=0)return entry;}
  return entries.at(-1);
}

export function groundDropRoll(rng=Math.random){
 // Only coins and equippable gear may spawn. Former material weight is
 // redistributed to the gear categories rather than creating dead pickups.
 const kind=weightedChoice([
  {id:'coin',weight:42},{id:'weapon',weight:35},{id:'equipment',weight:23}
 ],rng).id;
 if(kind==='coin')return {kind,amount:20+Math.floor(rng()*41)};
 const pool=kind==='weapon'?WEAPONS.filter(item=>item.tier>0&&item.tier<=3&&!item.notForSale):
  RELETTER_ITEMS.filter(item=>['head','outfit','shield','wings'].includes(item.slot)&&item.tier<=3);
 const weighted=pool.map(item=>({...item,weight:item.tier===1?58:item.tier===2?30:12}));
 return {kind,itemId:weightedChoice(weighted,rng).id};
}

export function monsterDropRoll(rng=Math.random){
  const pool=RELETTER_ITEMS.filter(item=>['weapon','head','outfit','shield','wings'].includes(item.slot)&&item.tier>0).map(item=>({...item,weight:[0,48,29,15,8][item.tier]||2}));
  return {kind:'equipment',itemId:weightedChoice(pool,rng).id};
}
