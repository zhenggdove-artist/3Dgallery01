export const ARENA_RADIUS = 48;
// Covers every fighter spawn as well as the central writing plant.
export const SAFE_ZONE = Object.freeze({x:0,z:0,radius:9});
export const FISHING_POND = Object.freeze({x:-28,z:2,radius:7});
export const PLAYER_SPAWNS = Object.freeze([
  [-5,1,6],[5,1,6],[-5,1,-6],[5,1,-6],[0,9,34],[0,9,-34]
]);

// One renderer and one server rule handle every platform; only data changes.
export const PLATFORMS = Object.freeze([
  {id:'platform-01',position:[-35,0,-27],size:[8,2,8],steps:'east',artYaw:0},
  {id:'platform-02',position:[-20,0,-34],size:[7,5,7],steps:'south',artYaw:.35},
  {id:'platform-03',position:[-2,0,-37],size:[9,8,9],steps:'west',artYaw:0},
  {id:'platform-04',position:[18,0,-34],size:[8,4,8],steps:'east',artYaw:-.3},
  {id:'platform-05',position:[34,0,-24],size:[7,7,7],steps:'south',artYaw:0},
  {id:'platform-06',position:[38,0,-5],size:[9,3,9],steps:'west',artYaw:.4},
  {id:'platform-07',position:[34,0,15],size:[8,6,8],steps:'north',artYaw:0},
  {id:'platform-08',position:[23,0,31],size:[10,10,10],steps:'west',artYaw:-.2},
  {id:'platform-09',position:[4,0,37],size:[8,4,8],steps:'south',artYaw:0},
  {id:'platform-10',position:[-15,0,34],size:[8,7,8],steps:'east',artYaw:.28},
  {id:'platform-11',position:[-33,0,24],size:[10,11,10],steps:'north',artYaw:0},
  {id:'platform-12',position:[-39,0,5],size:[8,4,8],steps:'east',artYaw:-.35},
  {id:'platform-13',position:[-33,0,-12],size:[9,7,9],steps:'south',artYaw:0}
].map((platform,index)=>Object.freeze({
  ...platform,index,
  artPosition:Object.freeze([platform.position[0],platform.size[1]+2.4,platform.position[2]]),
  coinPosition:Object.freeze([platform.position[0]+platform.size[0]*.34,platform.size[1]+1.4,platform.position[2]+platform.size[2]*.25])
})));

export const GROUND_DROP_POINTS = Object.freeze([
  [-16,.35,-12],[-8,.35,-22],[10,.35,-20],[21,.35,-10],[18,.35,10],[8,.35,22],
  [-10,.35,21],[-22,.35,12],[-27,.35,-5],[0,.35,14],[13,.35,1],[-12,.35,1]
]);

export const MONSTER_SPAWNS = Object.freeze([[0,.2,-30],[30,.2,0],[0,.2,30],[-30,.2,0]]);

export function distance2d(a,b){return Math.hypot((a?.[0]||0)-(b?.[0]||0),(a?.[2]||0)-(b?.[2]||0));}
export function insideArena(position,pad=0){return Array.isArray(position)&&position.length===3&&position.every(Number.isFinite)&&Math.hypot(position[0],position[2])<=ARENA_RADIUS+pad&&position[1]>=-4&&position[1]<=32;}
export function insideSafeZone(position){return distance2d(position,[SAFE_ZONE.x,0,SAFE_ZONE.z])<SAFE_ZONE.radius;}
