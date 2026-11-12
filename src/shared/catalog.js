import {EQUIPMENT,DEFAULT_WEAPON,attackStats as reletterAttackStats} from '../reletter/equipment-catalog.js';
export const RARITIES = Object.freeze([
  {id:'common',name:'Common',color:'#d7d2c6',weight:50},
  {id:'uncommon',name:'Uncommon',color:'#76d59a',weight:28},
  {id:'rare',name:'Rare',color:'#71aef4',weight:14},
  {id:'epic',name:'Epic',color:'#bd7bea',weight:6},
  {id:'relic',name:'Relic',color:'#f1cc62',weight:2}
]);

const TIER_PRICES = [240,620,1450,3300,7600];

export const ARMOR = Object.freeze([
  ['moss-guard','Moss Guard','armor','#73936c',1,310,14],
  ['flood-coat','Flood Coat','armor','#5d92a6',2,760,28],
  ['signal-mail','Signal Mail','armor','#ae78bd',3,1700,45],
  ['relic-shell','Relic Shell','armor','#d7bd63',4,3800,66],
  ['pilgrim-mask','Pilgrim Mask','head','#a98f72',1,260,7],
  ['glass-crown','Glass Crown','head','#89cddb',2,880,13],
  ['temple-halo','Temple Halo','head','#e4c467',4,4400,24]
].map(([id,name,slot,color,tier,price,defense])=>Object.freeze({id,name,slot,color,tier,rarity:RARITIES[tier-1].id,price,sell:Math.floor(price*.25),defense})));

export const MATERIALS = Object.freeze([
  {id:'wet-stone',name:'Wet Stone',slot:'material',color:'#7695a0',price:70,sell:18},
  {id:'signal-wire',name:'Signal Wire',slot:'material',color:'#d1a35e',price:125,sell:32},
  {id:'temple-resin',name:'Temple Resin',slot:'material',color:'#bc77bd',price:260,sell:65}
]);

// Original RELETTER identity, range, cadence and effects; only Temple economy/HP scale differ.
export const RELETTER_ITEMS=Object.freeze([DEFAULT_WEAPON,...EQUIPMENT].map(original=>{
  const tier=Math.max(1,Math.min(5,original.tier||1)),price=original.notForSale||original.id==='water'?0:original.slot==='seed'?80+tier*35:TIER_PRICES[tier-1]+Math.min(180,original.price||0);
  return Object.freeze({...original,price,sell:Math.floor(price*.25),rarity:RARITIES[tier-1].id,damage:original.damage===undefined?undefined:original.damage*10,chargeDamage:original.chargeDamage===undefined?undefined:original.chargeDamage*10});
}));
export const WEAPONS=Object.freeze(RELETTER_ITEMS.filter(item=>item.slot==='weapon'));
export const EQUIPPABLE_SLOTS=Object.freeze(['weapon','armor','head','outfit','shield','wings','rod','tool']);
export function attackStats(item,charge=0){const result=reletterAttackStats(item,charge);if(item.id==='water')result.damage*=10;return result;}
export const ITEMS = Object.freeze([...RELETTER_ITEMS,...ARMOR,...MATERIALS]);
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
  fusionBaseCost:320,
  buildCosts:Object.freeze({cube:80,bar:110,cylinder:110,wall:80,column:110,platform:170,tree:95,house:240}),
  fishValues:Object.freeze({minnow:35,koi:95,relic:260})
});

export const STARTER_LOADOUT = Object.freeze({weapon:'tide-1',armor:null,head:null,outfit:null,shield:null,wings:null,rod:null,tool:null});

export function weightedChoice(entries,rng=Math.random){
  const total=entries.reduce((sum,entry)=>sum+(entry.weight||1),0);let cursor=rng()*total;
  for(const entry of entries){cursor-=entry.weight||1;if(cursor<=0)return entry;}
  return entries.at(-1);
}

export function groundDropRoll(rng=Math.random){
  const kind=weightedChoice([{id:'coin',weight:42},{id:'material',weight:25},{id:'weapon',weight:20},{id:'equipment',weight:13}],rng).id;
  if(kind==='coin')return {kind,amount:20+Math.floor(rng()*41)};
  if(kind==='material')return {kind,itemId:MATERIALS[Math.floor(rng()*MATERIALS.length)].id};
  const pool=kind==='weapon'?WEAPONS.filter(item=>item.tier>0&&item.tier<=3&&!item.notForSale):RELETTER_ITEMS.filter(item=>['head','outfit','shield','wings'].includes(item.slot)&&item.tier<=3);
  const weighted=pool.map(item=>({...item,weight:item.tier===1?58:item.tier===2?30:12}));
  return {kind,itemId:weightedChoice(weighted,rng).id};
}

export function monsterDropRoll(rng=Math.random){
  const pool=RELETTER_ITEMS.filter(item=>['weapon','head','outfit','shield','wings'].includes(item.slot)&&item.tier>0).map(item=>({...item,weight:[0,48,29,15,8][item.tier]||2}));
  return {kind:'equipment',itemId:weightedChoice(pool,rng).id};
}
