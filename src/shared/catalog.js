export const RARITIES = Object.freeze([
  {id:'common',name:'Common',color:'#d7d2c6',weight:50},
  {id:'uncommon',name:'Uncommon',color:'#76d59a',weight:28},
  {id:'rare',name:'Rare',color:'#71aef4',weight:14},
  {id:'epic',name:'Epic',color:'#bd7bea',weight:6},
  {id:'relic',name:'Relic',color:'#f1cc62',weight:2}
]);

const WEAPON_FAMILIES = [
  ['tide','Tide Blade','water','#63dcff',14,3.8,520],
  ['frost','Glacier Staff','ice','#a9edff',18,12,760],
  ['ember','Ember Maul','fire','#ff9c50',23,4.2,920],
  ['storm','Storm Lance','lightning','#c4b2ff',16,9,620],
  ['prism','Prism Bow','beam','#ffe8a0',20,18,850],
  ['bloom','Bloom Whip','petal','#ff9ed5',13,7,480],
  ['nova','Nova Orb','wave','#95ffe0',27,10,1100],
  ['saber','Starlight Saber','light','#c5a8ff',19,3.4,410]
];
const TIER_NAMES = ['Worn','Tempered','Radiant','Celestial','Eternal'];
const TIER_PRICES = [240,620,1450,3300,7600];

export const WEAPONS = Object.freeze(WEAPON_FAMILIES.flatMap(([family,name,element,color,baseDamage,range,cooldown],familyIndex)=>
  TIER_NAMES.map((rank,index)=>Object.freeze({
    id:`${family}-${index+1}`, name:`${rank} ${name}`, slot:'weapon', family, element, color,
    tier:index+1, rarity:RARITIES[index].id,
    price:TIER_PRICES[index]+familyIndex*35,
    sell:Math.floor((TIER_PRICES[index]+familyIndex*35)*.25),
    damage:+(baseDamage*(1+index*.42)).toFixed(1),
    range:+(range*(1+index*.18)).toFixed(1),
    cooldown:Math.max(240,cooldown-index*35),
    knockback:+(2.4+index*.65).toFixed(2)
  }))
));

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

export const ITEMS = Object.freeze([...WEAPONS,...ARMOR,...MATERIALS]);
const INDEX = new Map(ITEMS.map(item=>[item.id,item]));
export const itemById = id => INDEX.get(id) || null;

export const SHOP_ITEMS = Object.freeze(ITEMS.filter(item=>item.slot!=='material'));
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
  buildCosts:Object.freeze({wall:80,column:110,platform:170,tree:95,house:240}),
  fishValues:Object.freeze({minnow:35,koi:95,relic:260})
});

export const STARTER_LOADOUT = Object.freeze({weapon:'tide-1',armor:null,head:null});

export function weightedChoice(entries,rng=Math.random){
  const total=entries.reduce((sum,entry)=>sum+(entry.weight||1),0);let cursor=rng()*total;
  for(const entry of entries){cursor-=entry.weight||1;if(cursor<=0)return entry;}
  return entries.at(-1);
}

export function groundDropRoll(rng=Math.random){
  const kind=weightedChoice([{id:'coin',weight:42},{id:'material',weight:25},{id:'weapon',weight:20},{id:'equipment',weight:13}],rng).id;
  if(kind==='coin')return {kind,amount:20+Math.floor(rng()*41)};
  if(kind==='material')return {kind,itemId:MATERIALS[Math.floor(rng()*MATERIALS.length)].id};
  const pool=kind==='weapon'?WEAPONS.filter(item=>item.tier<=3):ARMOR.filter(item=>item.tier<=3);
  const weighted=pool.map(item=>({...item,weight:item.tier===1?58:item.tier===2?30:12}));
  return {kind,itemId:weightedChoice(weighted,rng).id};
}

export function monsterDropRoll(rng=Math.random){
  const pool=[...WEAPONS,...ARMOR].map(item=>({...item,weight:[0,48,29,15,8][item.tier]||2}));
  return {kind:'equipment',itemId:weightedChoice(pool,rng).id};
}
