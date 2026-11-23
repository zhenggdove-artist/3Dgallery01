// Authored toy weapons. Statistics are authoritative; category describes the charged reach.
const ORIGINAL_ODD_WEAPONS=[
 ['giraffe','Giraffe Boomerang','whip','near','#e6b95d',4,3.6,56,310,16,'boomerang',2,'Swing a flexible giraffe-shaped club. Charge to throw a swaying boomerang that damages targets on its outbound and return paths.'],
 ['goldfish','Goldfish Water Cannon','water','mid','#ff963c',2.5,11,32,115,22,'jet',5,'Spray water from a goldfish cannon. Full charge summons a school of giant fish that swim forward and damage enemies on contact.'],
 ['clam','Giant Clam','pan','near','#e7a9c7',5,3,8,310,18,'shells',6,'Swing a snapping clam. Full charge fires six spinning shells; hold the button to repeat the volley.'],
 ['white-cat','White Cat SMG','water','mid','#f4f2e6',2,22,28,220,18,'rainbow',7,'Rapid-fire colorful bullets in first person. Charge to launch seven rainbow shots.'],
 ['black-cat','Black Cat Sniper Rifle','beam','far','#343347',10,80,140,3600,48,'sniper',1,'Aim through a first-person sniper scope. Fully charged shots launch powerful long-range energy rounds.'],
 ['calico-cat','Calico Cat Shotgun','water','near','#e6ac76',8,10,17,850,36,'scatter',10,'Fire independently colliding colorful pellets. Charging increases the spread and reach, but remains shorter than the White Cat SMG.'],
 ['accordion','Red Accordion','pan','near','#d43c57',4,3.5,30,275,24,'score',6,'Swing to scatter colorful musical notes. Full charge releases a traveling tornado of score particles.'],
 ['fan','Rampaging Electric Fan','swatter','mid','#85d4bd',3,4,20,450,16,'gust',4,'Swing spinning fan blades to create gusts. Full charge releases four twisting wind streams that briefly slow enemies.'],
 ['telephone','Screaming Telephone','whip','mid','#bd7fce',4,4,24,550,20,'echo',3,'Swing a coiled telephone cable. Full charge emits three rings of sound that temporarily weaken enemies.'],
 ['jellybrella','Jellyfish Umbrella','planter','mid','#91d8ed',5,4,9,800,22,'jelly',5,'Swing a soft jellyfish umbrella. Full charge releases five luminous jellyfish clouds that slow enemies.']
].map(([id,name,family,rangeClass,color,damage,range,chargedRange,cooldown,chargeDamage,pattern,burst,description])=>({id,name,slot:'weapon',family,rangeClass,color,damage,range,chargedRange,chargeRange:chargedRange-range,cooldown,chargeDamage,pattern,burst,description,radius:.3,price:45+Math.round(chargeDamage*2),tier:3,baseId:id,exotic:true,firstPerson:(id.includes('cat')&&id!=='calico-cat')||id==='goldfish',autoCharge:id==='clam',chargeMs:({'giraffe':1900,goldfish:1570,clam:1170,'white-cat':970,'black-cat':2850,'calico-cat':1450,accordion:1770,fan:1330,telephone:1660,jellybrella:1810})[id],element:['goldfish','clam','jellybrella'].includes(id)?'water':id==='fan'?'wind':id==='accordion'?'light':'earth'}));

const ODD_QUALITY_NAMES=['Common','Uncommon','Rare','Epic'];
const ODD_QUALITY_FACTORS=[.65,.82,1,1.2];
// Retain the original tier-3 identifier for all existing saved inventory,
// fusions and authored animations. Additional tiers use new stable IDs.
export const ODD_WEAPONS=ORIGINAL_ODD_WEAPONS.flatMap(base=>
 [1,2,3,4].map(tier=>{
  const multiplier=ODD_QUALITY_FACTORS[tier-1];
  const variant=tier===3?base:{
   ...base,id:base.id+'-q'+tier,tier,
   damage:+(base.damage*multiplier).toFixed(3),
   chargeDamage:+(base.chargeDamage*multiplier).toFixed(3),
   name:ODD_QUALITY_NAMES[tier-1]+' '+base.name
  };
  return variant;
 }));
export const oddWeapon=id=>ODD_WEAPONS.find(w=>w.id===id);
export const weaponRangeClass=w=>w.rangeClass||(w.range<12?'near':w.range<30?'mid':'far');
export function oddAttackStats(w,c){const full=c>=1;return {ultimate:full,range:full?w.chargedRange:w.range,radius:(w.baseId||w.id)==='accordion'&&full?4.5:w.pattern==='scatter'?(full?5.3:2.35):full&&w.pattern==='jet'?.65:w.radius,damage:full?w.chargeDamage:w.damage};}
export function oddVolley(w,shot){const charged=shot.charge>=1,count=w.pattern==='scatter'?20:charged?w.burst:1,spread=w.pattern==='scatter'?(charged?.82:.48):0;return Array.from({length:count},(_,i)=>{const a=spread*(i/(count-1||1)*2-1),d=shot.direction,c=Math.cos(a),s=Math.sin(a);return {...shot,subshot:true,projectile:w.firstPerson||charged,damage:shot.damage/count,direction:[d[0]*c+d[2]*s,d[1],d[2]*c-d[0]*s],delay:(w.firstPerson?0:200)+(w.pattern==='scatter'?0:i*(w.pattern==='boomerang'?420:95))};});}
