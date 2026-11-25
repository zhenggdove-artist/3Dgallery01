import {EQUIPMENT,DEFAULT_WEAPON,attackStats as reletterAttackStats} from '../reletter/equipment-catalog.js';
import {SNIPER_RANGE,JELLYBRELLA_ULTIMATE_DAMAGE_SCALE} from './combat-balance.js';
import {normalMeleeFootprint} from './melee-contact.js';
export const RARITIES = Object.freeze([
  {id:'common',name:'Common',color:'#d7d2c6',weight:50},
  {id:'uncommon',name:'Uncommon',color:'#76d59a',weight:28},
  {id:'rare',name:'Rare',color:'#71aef4',weight:14},
  {id:'epic',name:'Epic',color:'#bd7bea',weight:6},
  {id:'relic',name:'Relic',color:'#f1cc62',weight:2}
]);

const TIER_PRICES = [240,620,1450,3300,7600];
// Weapon quality is WHITE → GREEN → BLUE → GOLD → PURPLE.
// The legacy RARITIES array remains intact for non-weapon content.
export const SHOP_WEAPON_GRADES=Object.freeze([
 {rank:1,label:'White',rarity:'common',color:'#d7d2c6'},
 {rank:2,label:'Green',rarity:'uncommon',color:'#76d59a'},
 {rank:3,label:'Blue',rarity:'rare',color:'#71aef4'},
 {rank:4,label:'Gold',rarity:'relic',color:'#f1cc62'},
 {rank:5,label:'Purple',rarity:'epic',color:'#bd7bea'}
]);
// Old IDs remain resolvable for already-owned gear, but are no longer sold, dropped or granted.
export const RETIRED_HEADGEAR=Object.freeze({'pilgrim-mask':'hat-hockey','glass-crown':'hat-crown','temple-halo':'hat-angel','hat-jelly':'hat-jellyfish','hat-crab':'hat-crab-claw','hat-banana':'hat-banana-bunch'});
export const isRetiredHeadgear=item=>!!item&&Object.hasOwn(RETIRED_HEADGEAR,item.id);
const OUTFIT_COLLECTION_NAMES=Object.freeze({pajamas:'Pajamas',silk:'Silk',fuzzy:'Fuzzy',pig:'Pig',angel:'Angel',centaur:'Centaur',dinosaur:'Dinosaur',skater:'Skater',witch:'Witch',astronaut:'Astronaut'});
export function shopOutfitCollection(item){return item?.slot==='outfit'&&!item.creature&&OUTFIT_COLLECTION_NAMES[item.design]||null;}
const SHOP_NATIVE_FAMILIES=new Set(['tide','frost','ember','storm','prism','bloom','nova','saber','whip','swatter','pan','planter','palm']);
export function shopWeaponGroupKey(item){
 if(shopOutfitCollection(item))return 'outfit:'+item.design;
 if(item?.slot!=='weapon')return item?.id||'';
 const match=/^([a-z]+)-([1-5])$/.exec(item.id);
 return 'weapon:'+(match&&SHOP_NATIVE_FAMILIES.has(match[1])?match[1]:item.id);
}
export function shopWeaponGroups(items){
 const groups=new Map();
 for(const item of items||[]){
  if(isRetiredHeadgear(item))continue;
  const key=shopWeaponGroupKey(item);
  if(!groups.has(key))groups.set(key,{key,variants:[],base:item});
  const group=groups.get(key);
  if(item.slot!=='weapon'){group.variants.push(item);continue;}
  if(item.id==='water'){group.variants.push({...item,shopTier:1});continue;}
  const native=/^([a-z]+)-([1-5])$/.exec(item.id);
  if(native&&SHOP_NATIVE_FAMILIES.has(native[1])){
   group.variants.push(shopWeaponVariant(item,Number(native[2])));
   if(Number(native[2])===1)group.base=item;
  }else{
   group.variants=SHOP_EXOTIC_TIERS.map(tier=>shopWeaponVariant(item,tier));
  }
 }
 return [...groups.values()].reverse().sort((a,b)=>(b.base.shopRelease||0)-(a.base.shopRelease||0)).map(group=>({...group,variants:group.variants.sort((a,b)=>(a.shopTier||a.tier||0)-(b.shopTier||b.tier||0))}));
}
// Mystery is limited to five-quality whip/pan/swatter sets and the giraffe.
// Family labels alone are insufficient: many unrelated exotics are 'pan'.
export const isMysteryWeapon=item=>!!item&&item.slot==='weapon'&&
 (item.id==='giraffe'||/^(whip|pan|swatter)-[1-5]$/.test(item.id));

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
export const RELETTER_ITEMS=Object.freeze([DEFAULT_WEAPON,...EQUIPMENT].filter(original=>!['chiang-token','fan'].includes(original.id)&&!['seed','harvest'].includes(original.slot)).map(original=>{
  const tier=Math.max(1,Math.min(5,original.tier||1));
  const basePrice=original.shopWing?original.price:original.notForSale||original.id==='water'?0:TIER_PRICES[tier-1]+Math.min(180,original.price||0);
  const mysteryWeapon=isMysteryWeapon(original);
  // Keeping the sniper's premium price does not require keeping it in Mystery.
  const premiumPrice=basePrice*(mysteryWeapon||original.id==='black-cat'?5:1);
  const price=original.templePrice??(original.id==='giraffe'?19999:premiumPrice);
  return Object.freeze({...original,...(original.id==='black-cat'?{chargeMs:0,autoCharge:false,description:'Scope-only precision rifle. Single normal shots; lethal verified headshots. No ultimate.'}:{}),price,mysteryWeapon,sell:Math.floor(price*.25),rarity:original.slot==='weapon'?SHOP_WEAPON_GRADES[tier-1].rarity:RARITIES[tier-1].id,damage:original.damage===undefined?undefined:original.damage*10*(original.id==='white-cat'?.5:1),chargeDamage:original.chargeDamage===undefined?undefined:original.chargeDamage*10*(original.id==='white-cat'?.5:1),cooldown:original.id==='white-cat'?Math.max(65,Math.round(original.cooldown*.5)):original.cooldown});
}));
export const WEAPONS=Object.freeze(RELETTER_ITEMS.filter(item=>item.slot==='weapon'));
 // Exotic weapons must keep their stable canonical IDs: fusion records, held
 // 3D models and skill dispatch all refer to IDs like "telephone" directly.
 // The purchased quality belongs to the unique inventory instance, not its ID.
// All accounts share the same physical-instance capacity; never truncate saves.
export const INVENTORY_CAPACITY=3000;
export const inventoryCapacity=()=>INVENTORY_CAPACITY;
export const SHOP_EXOTIC_TIERS=Object.freeze([1,2,3,4,5]);
const EXOTIC_QUALITY=Object.freeze([
  {price:.48,power:.64,reach:.84,tempo:1.18},
  {price:.72,power:.82,reach:.92,tempo:1.08},
  {price:1,power:1,reach:1,tempo:1},
  {price:1.60,power:1.26,reach:1.12,tempo:.91},
  {price:2.50,power:1.55,reach:1.22,tempo:.85}
]);
export function shopWeaponVariant(item,tier=3){
  if(!item||item.slot!=='weapon')return item;
  const rank=Number(tier);
  if(!Number.isInteger(rank)||rank<1||rank>5)return null;
  const grade=SHOP_WEAPON_GRADES[rank-1];
  const match=/^([a-z]+)-([1-5])$/.exec(item.id);
  const native=match&&SHOP_NATIVE_FAMILIES.has(match[1]);
  // Real native rank (tide-1…5) already has authored stats and geometry.
  // Do not apply a second rank multiplier to new shop purchases.
  if(native&&item.tier===rank)return {...item,shopTier:rank,rarity:grade.rarity};
  const scale=EXOTIC_QUALITY[rank-1];
  const range=Number.isFinite(item.range)?+(item.range*scale.reach).toFixed(2):null;
  const chargedRange=Number.isFinite(item.chargedRange)?+(item.chargedRange*scale.reach).toFixed(2):null;
  // Legacy purchases with a non-native grade preserve their original item ID.
  return {...item,shopTier:rank,tier:item.exotic?rank:item.tier,rarity:grade.rarity,
   name:rank===3?item.name:`${grade.label} ${item.name}`,
   price:rank===3?item.price:Math.max(100,Math.ceil(item.price*scale.price/10)*10),
   ...(Number.isFinite(item.damage)?{damage:+(item.damage*scale.power).toFixed(3)}:{}),
   ...(Number.isFinite(item.chargeDamage)?{chargeDamage:+(item.chargeDamage*scale.power).toFixed(3)}:{}),
   ...(range!==null?{range}:{}),
   ...(chargedRange!==null?{chargedRange,chargeRange:+(chargedRange-range).toFixed(2)}:
      Number.isFinite(item.chargeRange)?{chargeRange:+(item.chargeRange*scale.reach).toFixed(2)}:{}),
   ...(Number.isFinite(item.cooldown)?{cooldown:Math.max(70,Math.round(item.cooldown*scale.tempo))}:{})};
}

export const EQUIPPABLE_SLOTS=Object.freeze(['weapon','head','outfit','shield','wings']);
export const SPELL_FAMILIES=Object.freeze(['water','ice','fire','lightning','beam','petal','wave']);
export function attackStats(item,charge=0){
 const result=reletterAttackStats(item,item.id==='black-cat'?0:charge);
 // Only the giant swimming fish receives triple damage, never ordinary bubbles.
 if(item.id==='goldfish'&&result.ultimate)result.damage*=3;
 if(item.id==='jellybrella')result.damage*=result.ultimate?JELLYBRELLA_ULTIMATE_DAMAGE_SCALE:.5;
 if(item.id==='water')result.damage*=10;
 if(item.id==='black-cat'){result.range=SNIPER_RANGE;
   result.damage*=3;}
 if(item.id==='accordion'&&!result.ultimate){
  // The BAG label, aim preview and server hitbox must expose the SAME reach.
  const contact=normalMeleeFootprint(item);
  result.range=Math.min(result.range,contact.range);
  result.radius=Math.min(result.radius,contact.radius);
 }
 if(SPELL_FAMILIES.includes(item.family)&&!item.exotic)result.range=+(result.range/3).toFixed(3);
 // Keep the narrower #59 preview equal to the real server hit tube.
 // Saber normal hits must stop at the same (tier-matched) whip normal
 // contact distance. Its charged fissure still uses its own distinct shape.
 if(item.family==='saber'&&!result.ultimate){
  const whipReach=(4.7+(Math.max(1,Math.min(5,Number(item.tier)||1))-1)*1.5)/3;
  result.range=+Math.min(result.range,whipReach).toFixed(3);
  result.radius=Math.min(result.radius,.16);
 }
 if(item.family==='saber'&&result.ultimate){
  result.range=+(result.range*2.4).toFixed(3);
  result.radius=+(result.radius*2/9).toFixed(3);
 }
 return result;
}
// Consumables are independent inventory instances; matching IDs can be
// purchased in batches. Their assigned quickslots survive a zero stack.
export const COMFORT_ITEMS=Object.freeze([
 {id:'comfort-dollar-20',name:'Comfort Cash · $20',slot:'consumable',category:'Comfort for the Soul',denomination:20,healFraction:.30,cooldownMs:2000,price:300,tier:2,rarity:'uncommon',color:'#5eaa70',description:'Give me more!'},
 {id:'comfort-dollar-50',name:'Comfort Cash · $50',slot:'consumable',category:'Comfort for the Soul',denomination:50,manaFraction:.50,cooldownMs:2000,price:300,tier:3,rarity:'rare',color:'#64a7db',description:'Give me more!'},
 {id:'comfort-dollar-100',name:'Comfort Cash · $100',slot:'consumable',category:'Comfort for the Soul',denomination:100,healFraction:1,cooldownMs:3000,price:700,tier:5,rarity:'relic',color:'#e36c68',description:'Give me more!'}
].map(item=>Object.freeze({...item,sell:Math.floor(item.price*.25)})));
export const ITEMS = Object.freeze([...RELETTER_ITEMS,...COMFORT_ITEMS]);
const INDEX = new Map([...ITEMS,...ARMOR].map(item=>[item.id,item]));
const CUSTOM_IDS=new Set();
// Rehydrate custom GM wings from authoritative room data before equipment lookup.
export function registerCustomWings(wings=[]){
 for(const id of CUSTOM_IDS)INDEX.delete(id);CUSTOM_IDS.clear();
 for(const item of wings){if(!item?.id||!/^gm-wing-[0-9a-f-]{36}$/i.test(item.id)||item.design!=='painted-wing')continue;
  INDEX.set(item.id,Object.freeze({...item}));CUSTOM_IDS.add(item.id);
 }
}
export const itemById = id => INDEX.get(id) || null;
// Catalog identity is authoritative, even for an older persisted drop kind.
export const isRestorativeDrop=drop=>itemById(drop?.itemId)?.slot==='consumable';
export function groundDropVisualKind(drop){if(isRestorativeDrop(drop))return 'cash';if(drop?.kind==='consumable')return null;if(drop?.kind==='coin'||drop?.kind==='heart')return drop.kind;return itemById(drop?.itemId)?'equipment':null;}

export const SHOP_ITEMS = Object.freeze(ITEMS.filter(item=>!['material','armor'].includes(item.slot)&&!item.notForSale&&!isRetiredHeadgear(item)&&item.price>0));
export const SHOP_CATALOG_REVISION='r123';
export const SHOP_CATALOG_IDS=Object.freeze(SHOP_ITEMS.map(item=>item.id).sort());
// Canonical price keys distinguish every weapon quality, including exotics.
export const shopPriceKey=item=>item.id+(item.slot==='weapon'?':'+(item.shopTier??(item.tier||1)):'');
export function shopPrice(item,overrides={}){
 const amount=overrides?.[shopPriceKey(item)];
 return Number.isSafeInteger(amount)&&amount>=1&&amount<=100000000?amount:item.price;
}
export function shopPurchaseVariant(itemId,qualityTier){
 const base=SHOP_ITEMS.find(item=>item.id===itemId);
 if(!base||base.slot!=='weapon'&&qualityTier!==undefined)return null;
 if(base.slot!=='weapon')return base;
 const rank=qualityTier??(base.exotic?3:base.tier);
 if(!base.exotic&&rank!==base.tier)return null;
 return shopWeaponVariant(base,rank);
}
// Never let discounted purchases produce positive coin arbitrage on resale.
export function shopResalePrice(item,instance,overrides={}){
 const grade=item.slot==='weapon'?(instance?.shopTier??item.tier):undefined;
 const variant=item.slot==='weapon'?shopWeaponVariant(item,grade):item;
 const current=shopPrice(variant||item,overrides);
 const paid=Number.isSafeInteger(instance?.paidUnitPrice)?instance.paidUnitPrice:Infinity;
 return Math.max(0,Math.floor(Math.min(Number(item.sell??Infinity),current*.25,paid*.25)));
}
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

export const STARTER_LOADOUT = Object.freeze({weapon:'saber-2',head:null,outfit:null,shield:null,wings:null}); // Green uncommon Dawn Starlight saber.

export function weightedChoice(entries,rng=Math.random){
  const total=entries.reduce((sum,entry)=>sum+(entry.weight||1),0);let cursor=rng()*total;
  for(const entry of entries){cursor-=entry.weight||1;if(cursor<=0)return entry;}
  return entries.at(-1);
}

// Only explicitly relisted products may extend the preexisting loot pools.
// Keep the original category odds and native weights for every other item.
const withRelisted=(pool,relisted,slots)=>{
 const ids=new Set(pool.map(item=>item.id));
 return [...pool,...SHOP_ITEMS.filter(item=>Object.hasOwn(relisted,item.id)&&slots.includes(item.slot)&&!ids.has(item.id))];
};
export function groundDropRoll(rng=Math.random,excluded={},relisted={}){
 const allowed=item=>!Object.hasOwn(excluded,item.id);
 // Only coins and equippable gear may spawn. Former material weight is
 // redistributed to the gear categories rather than creating dead pickups.
 const kind=weightedChoice([
  {id:'coin',weight:34},{id:'weapon',weight:26},{id:'equipment',weight:20},{id:'consumable',weight:20}
 ],rng).id;
 if(kind==='coin')return {kind,amount:20+Math.floor(rng()*41)};
 if(kind==='consumable'){const pool=COMFORT_ITEMS.map((item,i)=>({id:item.id,weight:[45,40,15][i]})).filter(allowed);return pool.length?{kind,itemId:weightedChoice(pool,rng).id}:{kind:'coin',amount:20};}
 const pool=kind==='weapon'?WEAPONS.filter(item=>item.tier>0&&item.tier<=3&&!item.notForSale):
  RELETTER_ITEMS.filter(item=>['head','outfit','shield'].includes(item.slot)&&!isRetiredHeadgear(item)&&item.tier<=3);
 const weighted=withRelisted(pool,relisted,kind==='weapon'?['weapon']:['head','outfit','shield','wings']).filter(allowed).map(item=>({...item,weight:item.tier===1?58:item.tier===2?30:12}));
 return weighted.length?{kind,itemId:weightedChoice(weighted,rng).id}:{kind:'coin',amount:20};
}

export function monsterDropRoll(rng=Math.random,excluded={},relisted={}){
  const native=RELETTER_ITEMS.filter(item=>['weapon','head','outfit','shield'].includes(item.slot)&&!isRetiredHeadgear(item)&&item.tier>0);
  const pool=withRelisted(native,relisted,['weapon','head','outfit','shield','wings','consumable']).filter(item=>!Object.hasOwn(excluded,item.id)).map(item=>({...item,weight:[0,48,29,15,8][item.tier]||2}));
  if(!pool.length)return {kind:'coin',amount:20};
  const item=weightedChoice(pool,rng);return {kind:item.slot==='consumable'?'consumable':'equipment',itemId:item.id};
}
