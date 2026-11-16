export const SNIPER_RANGE=256; // Entire 184m-diameter arena from either edge, with margin.
// The sniper head check is performed on the SERVER against the actual shot ray.
// The fighter's combat capsule is 2.35m tall; the head is a small sphere near its top.
export function sniperHitsHead(origin,direction,range,position){
 if(![origin,direction,position].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))return false;
 if(!Number.isFinite(range)||range<=0)return false;
 const head=[position[0],position[1]+2.02,position[2]];
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
 return +base.toFixed(3);
}
// These durations describe the actual visible moving volumes, not an
// arbitrary instant-hit timer. Damage cannot precede projectile intersection.
export function projectileFlightMs(weapon,charged=false){
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
