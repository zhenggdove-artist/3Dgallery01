// Deterministic charged attack area, used by both the authoritative server
// and the client's blue ground rune. Coordinates use world-space metres.
const AREAS=new Set(['ice','fire','lightning','petal','wave']);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function chargedArea(item,origin,direction,stats,ground=()=>0){
 const mag=Math.hypot(...direction)||1,dir=direction.map(x=>x/mag);
 const range=clamp(Number(stats?.range)||Number(item?.range)||8,2,100);
 const radius=clamp(Number(stats?.radius)||2,1,18);
 const mode=AREAS.has(item?.family)&&!item?.exotic?'area':item?.family==='saber'||['pan','planter','palm','swatter','whip'].includes(item?.family)?'melee':'corridor';
 // Long-distance skills must actually land away from the caster. A downward
 // aim intersects the ground first; a horizontal aim travels along the arena.
 const defaultDistance=mode==='melee'?Math.min(range,3):clamp(range*.65,mode==='area'?9:5,mode==='area'?48:60);
 const floorAtDistance=ground(origin[0]+dir[0]*defaultDistance,origin[2]+dir[2]*defaultDistance,origin[1]);
 const intercept=dir[1]<-.04?(origin[1]-floorAtDistance)/(-dir[1]):Infinity;
 const travel=clamp(Number.isFinite(intercept)?intercept:defaultDistance,mode==='melee'?1:3,range);
 const x=origin[0]+dir[0]*travel,z=origin[2]+dir[2]*travel;
 const floor=Math.max(0,ground(x,z,origin[1]));
 return {mode,center:[x,mode==='area'||mode==='melee'?floor+.12:Math.max(floor+.12,origin[1]+dir[1]*travel),z],radius,travel,range};
}
export function insideChargedArea(area,target,actorRadius=1){
 if(!area||area.mode!=='area')return false;
 return Math.hypot(target[0]-area.center[0],target[2]-area.center[2])<=area.radius+actorRadius&&
        Math.abs(target[1]-area.center[1])<=Math.max(3,area.radius*.7);
}
