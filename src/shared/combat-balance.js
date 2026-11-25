import {weaponAffixTotals} from './weapon-affixes.js';
export const JELLYBRELLA_ULTIMATE_DAMAGE_SCALE=.35;
export const PALM_STORM_DURATION_MS=3000;
export const PALM_STORM_TICK_MS=2000;
export const SNIPER_RANGE=256; // Entire 184m-diameter arena from either edge, with margin.
export const SNIPER_SHOULDER_RETICLE_DIAMETER_PX=132;
export const SNIPER_SHOULDER_FOV_DEG=62;
// Uniform server-owned cone whose projection stays within the 132px reticle.
export function shoulderSniperSpread(direction,viewportHeight=720,rng=Math.random){
 if(!Array.isArray(direction)||direction.length!==3||!direction.every(Number.isFinite))return null;
 const length=Math.hypot(...direction);if(length<1e-8)return null;
 const d=direction.map(x=>x/length),h=clamp(Number(viewportHeight)||720,320,2160);
 const cone=Math.tan(SNIPER_SHOULDER_FOV_DEG*Math.PI/360)*SNIPER_SHOULDER_RETICLE_DIAMETER_PX/h;
 const radius=Math.sqrt(clamp(Number(rng()),0,1))*cone;
 const a=clamp(Number(rng()),0,1)*Math.PI*2;
 const hx=Math.hypot(d[0],d[2]),right=hx>1e-6?[d[2]/hx,0,-d[0]/hx]:[1,0,0];
 const up=[d[1]*right[2],d[2]*right[0]-d[0]*right[2],-d[1]*right[0]];
 const x=Math.cos(a)*radius,y=Math.sin(a)*radius;
 const changed=d.map((v,i)=>v+right[i]*x+up[i]*y),n=Math.hypot(...changed);
 return changed.map(v=>v/n);
}
// Overlapping head spheres cover the scaled avatar's face and crown.
export function sniperHitsHead(origin,direction,range,position){
 if(![origin,direction,position].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||!Number.isFinite(range)||range<=0)return false;
 const n=Math.hypot(...direction);if(n<1e-8)return false;const d=direction.map(v=>v/n);
 return [1.72,2.04].some(y=>{
  const delta=[position[0]-origin[0],position[1]+y-origin[1],position[2]-origin[2]];
  const along=Math.max(0,Math.min(range,delta.reduce((s,v,i)=>s+v*d[i],0)));
  return Math.hypot(...delta.map((v,i)=>v-along*d[i]))<=.36;
 });
}
// Authoritative PvP balance independent from monster HP scaling (Temple uses
// 100 HP per fighter; RELETTER's monster-scaled weapon numbers are far higher).
// A clean 100-HP fighter should survive roughly 8–10 ordinary starter hits.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const MELEE=new Set(['saber','whip','swatter','pan','planter','palm']);
export function pvpShotDamage(weapon,stats,quality={tier:1}){
 const reach=Number(weapon.range)||8,cd=clamp(Number(weapon.cooldown)||800,200,4500);
 const radius=Math.max(.1,Number(weapon.radius)||.5);
 const near=reach<=10||weapon.id==='calico-cat',far=reach>=22&&!near;
 const distanceFactor=near?1.13:far?.83:1;
 const cadenceFactor=.70+.37*Math.sqrt((cd-180)/3800);
 const reachFactor=clamp(Math.pow(12/Math.max(3,reach),.13),.76,1.13);
 const areaFactor=1/Math.sqrt(1+Math.max(0,radius-1.2)*.25);
 const tierFactor=1+clamp((quality.tier||1)-1,0,4)*.035;
 let base=clamp(10.7*distanceFactor*cadenceFactor*reachFactor*areaFactor*tierFactor,5.5,12.2);
 if(weapon.id==='black-cat')base=81; // Three times the previous 27 damage.
 if(stats?.ultimate){
  const time=clamp(Number(weapon.chargeMs)||1500,650,3200);
  const spread=Math.max(radius,Number(stats.radius)||radius);
  const areaPenalty=1/Math.sqrt(1+Math.max(0,spread-2)*.055);
  const chargeFactor=1.35+.65*time/2500;
  base=clamp(base*chargeFactor*areaPenalty,base*1.1,weapon.id==='black-cat'?129:26);
 }
 // A giraffe ultimate is a two-pass 3x-strength rubber boomerang. Preserve
 // this multiplier for PvP as well as monster and structural damage.
 if(weapon.id==='giraffe'&&stats?.ultimate)base*=3;
 if(weapon.id==='goldfish'&&stats?.ultimate)base*=3;
 if(weapon.id==='jellybrella')base*=stats?.ultimate?JELLYBRELLA_ULTIMATE_DAMAGE_SCALE:.5;
 const enchant=weaponAffixTotals(weapon);
 // The per-instance bonus applies to PvP as well as the server's monster
 // damage, without changing the weapon's physical reach or collision shape.
 base*=1+(enchant.damage+enchant.attack)/100;
 if(stats?.ultimate)base*=1+enchant.charge/100;
  // Piercing ultimate: multiple targets but at most 42 HP per target.
  if(weapon.id==='black-cat'&&stats?.ultimate)base=Math.min(base,42);
  return +(weapon.id==='white-cat'?base*.5:base).toFixed(3);
}
// These durations describe the actual visible moving volumes, not an
// arbitrary instant-hit timer. Damage cannot precede projectile intersection.
export function projectileFlightMs(weapon,charged=false,range=null){
 // All normal staff orbs move at the same 38 metres per second.
 if(!charged&&!weapon?.exotic&&['water','ice','fire','lightning','beam','petal','wave'].includes(weapon?.family)&&weapon.id!=='clam')
  return Math.round(Math.max(240,Math.min(3600,(Number(range)||weapon.range||12)/38*1000)));
 // Synchronize authoritative swept-hit travel with the visible, moving
 // 00GameDevs source. Doubling reach without flight time would silently
 // double speed and make strikes hit before the graphics reach targets.
 if(charged&&weapon.id==='accordion')return 2300;
 if(charged&&weapon.id==='clam')return 2180; // original #33 crest full eased path
 if(charged&&weapon.family==='palm')return 1650; // triple #31 tower
 if(charged&&weapon.family==='saber')return 1550; // official five-wave native cast
 if(charged&&weapon.family==='ice')return 1260;  // sequential ground eruption
 if(charged&&weapon.family==='petal')return 2200; // native #43 flower traverses its full doubled reach
 if(weapon.pattern==='scatter')return charged?530:360;
 if(weapon.id==='black-cat')return charged?450:310;
 if(weapon.firstPerson)return charged?460:330;
 if(MELEE.has(weapon.family))return charged?550:245;
 return charged?630:360;
}

// A single still-visible attack volume can contact the same actor again.
// Intervals vary by weapon but remain in the requested 1–3 second range.
export function contactDamageIntervalMs(weapon){
 const id=weapon?.id;
 if(id==='accordion')return 1000;
 if(id==='jellybrella')return 1200;
 if(id==='goldfish')return 1100;
 if(id==='giraffe')return 1200;
 if(id==='fan')return 1000;
 if(id==='clam')return 1350;
 if(id==='black-cat')return 3000;
 if(id==='calico-cat')return 1700;
 const family=weapon?.family;
 return ({fire:1000,lightning:1500,water:1400,wave:1500,ice:1800,
  petal:1650,beam:2200,saber:1600,whip:1600,pan:1500,
  planter:1800,swatter:1400,palm:PALM_STORM_TICK_MS})[family]||2000;
}
// Lifetimes follow the authored 00GameDevs and signature effect animations.
// Never leave an invisible damaging field after its visible animation ends.
export function visibleCollisionLifetimeMs(weapon,ultimate){
 if(!ultimate)return projectileFlightMs(weapon,false);
 const id=weapon?.id;
 // Actual tiered IDs are pan-1..5 / whip-1..5, not bare 'pan'/'whip'.
 // Keep their server hit volumes alive for the entire native visual effect.
 if(/^pan-[1-5]$/.test(id))return 5000;
 if(/^whip-[1-5]$/.test(id))return 6500;
 const duration=({jellybrella:5000,clam:3300,pan:5000,
  swatter:7000,fan:2500,whip:6500,accordion:3300,
  telephone:2600})[id];
 if(duration)return duration;
 const family=weapon?.family;
 return ({petal:2250,wave:4500,fire:2200,ice:1260,
  lightning:2500,beam:3500,saber:1550,palm:PALM_STORM_DURATION_MS,
  planter:3400,water:2200})[family]||projectileFlightMs(weapon,true);
}
