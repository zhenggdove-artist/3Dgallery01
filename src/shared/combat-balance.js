export const SNIPER_RANGE=256; // Entire 184m-diameter arena from either edge, with margin.
// The sniper head check is performed on the SERVER against the actual shot ray.
// The fighter's combat capsule is 2.35m tall; the head is a small sphere near its top.
export function sniperHitsHead(origin,direction,range,position){
 if(![origin,direction,position].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))return false;
 if(!Number.isFinite(range)||range<=0)return false;
 const head=[position[0],position[1]+1.70,position[2]]; // Covers actual avatar face and top of the 2.35m capsule.
 const delta=head.map((v,i)=>v-origin[i]);
 const along=delta.reduce((n,v,i)=>n+v*direction[i],0);
 if(along<0||along>range)return false;
 const gap=Math.hypot(...delta.map((v,i)=>v-along*direction[i]));
 return gap<=.36;
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
 return +(weapon.id==='white-cat'?base*.5:base).toFixed(3);
}
// These durations describe the actual visible moving volumes, not an
// arbitrary instant-hit timer. Damage cannot precede projectile intersection.
export function projectileFlightMs(weapon,charged=false,range=null){
 // All normal staff orbs move at the same 38 metres per second.
 if(!charged&&['water','ice','fire','lightning','beam','petal','wave'].includes(weapon?.family)&&weapon.id!=='clam')
  return Math.round(Math.max(240,Math.min(3600,(Number(range)||weapon.range||12)/38*1000)));
 // Synchronize authoritative swept-hit travel with the visible, moving
 // 00GameDevs source. Doubling reach without flight time would silently
 // double speed and make strikes hit before the graphics reach targets.
 if(charged&&weapon.id==='clam')return 2180; // original #33 crest full eased path
 if(charged&&weapon.family==='palm')return 1650; // triple #31 tower
 if(charged&&weapon.family==='saber')return 1100; // extended #38 fissure
 if(charged&&weapon.family==='ice')return 1260;  // doubled #70 reach
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
  planter:1800,swatter:1400,palm:2200})[family]||2000;
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
  lightning:2500,beam:3500,saber:1250,palm:2500,
  planter:3400,water:2200})[family]||projectileFlightMs(weapon,true);
}
