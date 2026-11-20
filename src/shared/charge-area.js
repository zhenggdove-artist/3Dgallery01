import {discGroundHeight} from './artwork-discs.js';
import {isChannelStaff,weaponQuality,forwardCastRadius} from './weapon-abilities.js';
import {itemById,attackStats} from './catalog.js';

// All coordinates and dimensions are world metres, shared by client previews
// and the authoritative attack. Never apply a separate cosmetic range bonus.
const AREAS=new Set(['water','ice','fire','lightning','petal','wave']);
const EXOTIC_AREAS=new Set(['jet','score','gust','echo','jelly','shells']);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const safeDirection=direction=>{
 const values=Array.isArray(direction)?direction:[0,0,1];
 const length=Math.hypot(...values)||1;
 return values.map(v=>v/length);
};
const flatDirection=direction=>{
 const d=safeDirection(direction),length=Math.hypot(d[0],d[2]);
 return length>.0001?[d[0]/length,d[2]/length]:[0,1];
};
export const CLAM_SECTOR_ANGLE=90;
export const ULTIMATE_FOOTPRINT_SCALE=.6;
// Authoritative damage geometry and warning VFX always use identical dimensions.
export function scaleUltimateFootprint(stats,item=null,quality=null){
 if(stats?.ultimate){
  // The global 60% change remains in force. The frying-pan ultimate is
  // another 50% smaller; the whip ultimate is now another 80% smaller.
  // Use the item ID, not the family: the Chiang token is not a frying pan.
  const pan=/^pan-[1-5]$/.test(item?.id||'');
  const swatter=/^swatter-[1-5]$/.test(item?.id||'');
  const whip=/^whip-[1-5]$/.test(item?.id||'');
  const planter=/^planter-[1-5]$/.test(item?.id||'');
  const rangeFactor=ULTIMATE_FOOTPRINT_SCALE*(pan?.5:swatter?.85:whip?.2:planter?.5:item?.family==='ice'?1.5:item?.family==='wave'?3:1);
  // Broaden only the whip's warning/hit radius; retain its travel distance.
  const radiusFactor=rangeFactor*(whip?1.5:1);
  stats.range=+(Math.max(.5,Number(stats.range)||0)*rangeFactor).toFixed(3);
  stats.radius=+(Math.max(.1,Number(stats.radius)||0)*radiusFactor).toFixed(3);
  if(item?.id==='telephone'){
   // The screaming handset's ultimate warning AND hit area are exactly
   // the same diameter as the matching-quality frying-pan ultimate.
   const grade=quality||weaponQuality(item);
   const pan=itemById('pan-'+Math.min(5,Math.max(1,grade.tier)));
   const panQuality=weaponQuality(pan);
   const panNormal=attackStats(pan,1);
   const panRadius=forwardCastRadius(pan,panQuality,panNormal.radius,false);
   stats.radius=+(panRadius*ULTIMATE_FOOTPRINT_SCALE*.5).toFixed(3);
  }
 }
 return stats;
}

export function chargedArea(item,origin,direction,stats,ground=()=>0,channel=false){
 const dir=safeDirection(direction);
 const range=clamp(Number(stats?.range)||Number(item?.range)||8,2,100);
 const radius=clamp(Number(stats?.radius)||2,.1,50);
 // Staff/clam streams are fired from the weapon, not an unrelated distant
 // round explosion. Other spell families retain their target-centred circles.
 const areaUltimate=!!stats?.ultimate&&/^(pan|whip|swatter|palm)-[1-5]$/.test(item?.id||'');
 const mode=item?.id==='clam'?'sector':channel&&isChannelStaff(item)?'corridor':
  (areaUltimate||AREAS.has(item?.family)&&!item?.exotic||EXOTIC_AREAS.has(item?.pattern))?'area':'corridor';
 const defaultDistance=clamp(range*.65,mode==='area'?9:5,mode==='area'?48:60);
 const floorAtDistance=ground(origin[0]+dir[0]*defaultDistance,origin[2]+dir[2]*defaultDistance,origin[1]);
 const intercept=dir[1]<-.04?(origin[1]-floorAtDistance)/(-dir[1]):Infinity;
 const travel=clamp(Number.isFinite(intercept)?intercept:defaultDistance,3,range);
 const [dx,dz]=flatDirection(direction);
 // Shift pan and whip centres forward by one CURRENT blast radius. This
 // single coordinate drives the warning, authoritative hitbox and VFX.
 const blastOffset=stats?.ultimate&&/^(?:pan|whip|swatter)-[1-5]$/.test(item?.id||'')?radius:0;
 const centerDistance=travel+blastOffset;
 const x=origin[0]+(blastOffset?dx:dir[0])*centerDistance,
  z=origin[2]+(blastOffset?dz:dir[2])*centerDistance;
 const floor=Math.max(0,ground(x,z,origin[1]));
 const nearFloor=Math.max(0,ground(origin[0],origin[2],origin[1]));
 return {
  mode,visualCenter:[x,floor+.16,z],
  center:[x,mode==='area'?floor+.12:Math.max(floor+.12,origin[1]+dir[1]*travel),z],
  // Sector radius is its forward reach; circle radius is its AoE extent.
  radius,travel:centerDistance,range,
  ...(mode==='sector'?{apex:[origin[0],nearFloor+.12,origin[2]],
   forward:[dx,dz],angleDeg:CLAM_SECTOR_ANGLE}: {})
 };
}

export function insideChargedArea(area,target,actorRadius=1){
 if(!area)return false;
 if(area.mode==='sector'){
  const dx=target[0]-area.apex[0],dz=target[2]-area.apex[2];
  const along=dx*area.forward[0]+dz*area.forward[1];
  const sideways=Math.abs(dx*area.forward[1]-dz*area.forward[0]);
  return along>=-actorRadius&&Math.hypot(dx,dz)<=area.range+actorRadius&&
   sideways<=Math.max(0,along)*Math.tan(area.angleDeg*Math.PI/360)+actorRadius&&
   Math.abs(target[1]-area.apex[1])<=Math.max(3,area.radius*.7);
 }
 if(area.mode!=='area')return false;
 return Math.hypot(target[0]-area.center[0],target[2]-area.center[2])<=area.radius+actorRadius&&
  Math.abs(target[1]-area.center[1])<=Math.max(3,area.radius*.7);
}

// One dimensional contract for authored warning assets #58/#59 and casting
// geometry. #58 starts at the staff/clam mouth; #59 is centered midway along
// the full server ray, never on the remote area.visualCenter marker.
export function spellFootprint(item,origin,direction,stats,area,ground=()=>0){
 // Collision sweeps use the full quality-adjusted projectile range/radius.
 // Unlike chargedArea's bounded ground-explosion area, a channel has NO
 // 100m / 18m cosmetic clamp. Its #59 width must cover the entire hit tube.
 const range=Math.max(2,Number(stats?.range)||Number(item?.range)||8);
 const width=Math.max(.5,(Number(stats?.radius)||1)*2);
 const [dx,dz]=flatDirection(direction);
 const yaw=Math.atan2(-dz,dx); // official effects face local +X
 const at=(x,z)=>Math.max(0,ground(x,z,origin[1]))+.16;
 if(item?.id==='clam'){
  return {shape:'sector',position:[origin[0],at(origin[0],origin[2]),origin[2]],
   yaw,radius:range,angleDeg:CLAM_SECTOR_ANGLE,range,width};
 }
 if(isChannelStaff(item)||item?.firstPerson||item?.family==='saber'||(item?.family==='palm'&&!stats?.ultimate)||item?.pattern==='scatter'||item?.id==='goldfish'){
  const x=origin[0]+dx*range*.5,z=origin[2]+dz*range*.5;
  return {shape:'rectangle',position:[x,at(x,z),z],yaw,length:range,width,range};
 }
 const center=area?.visualCenter||[origin[0],at(origin[0],origin[2]),origin[2]];
 return {shape:'circle',position:[...center],radius:Number(area?.radius)||Number(stats?.radius)||1,range};
}

export function spellGroundHeight(world,x,z,y=0){
 let height=discGroundHeight(x,z,y);
 for(const p of world?.floatingPlatforms||[]){
  if(!Array.isArray(p.position)||p.position.length!==3)continue;
  if(y>=p.position[1]-.5&&Math.hypot(x-p.position[0],z-p.position[2])<(Number(p.radius)||0)*2)
   height=Math.max(height,p.position[1]);
 }
 return height;
}
