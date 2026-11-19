import {ART_DISPLAY_DISCS} from './artwork-discs.js';
export const ARENA_RADIUS = 244; // Playable outer edge encloses the doubled-surface-area ruined district.
// Covers every fighter spawn as well as the central writing plant.
export const SAFE_ZONE = Object.freeze({x:0,z:0,radius:9});
// Entire art perimeter, distinct from the central PvP/build reservation.
export const insideArtSanctuary=position=>Math.hypot(position[0],position[2])<60;
export const FISHING_POND = Object.freeze({x:-28,z:2,radius:7});
export const PLAYER_SPAWNS = Object.freeze([
  [4,0,3],[-4,0,3],[4,0,-3],[-4,0,-3],[0,0,5],[0,0,-5]
]);

// One renderer and one server rule handle every platform; only data changes.
export const PLATFORMS=Object.freeze(Array.from({length:13},(_,index)=>{
 const disc=index?ART_DISPLAY_DISCS[index-1]:null,position=disc?[disc.position[0],0,disc.position[2]]:[-12,0,-12],height=disc?.top||0,radius=disc?.radius||4;
 // Coins now sit on accessible ground beyond the full 14m GM deck radius.
 const heading=index===0?0:Math.atan2(position[2],position[0]),distance=18.5;
 const coinPosition=[position[0]+Math.cos(heading)*distance,1.05,position[2]+Math.sin(heading)*distance];
 return Object.freeze({id:'platform-'+String(index+1).padStart(2,'0'),index,position,size:[radius*2,height,radius*2],steps:'none',artYaw:disc?-Math.atan2(position[0],position[2]):0,artPosition:Object.freeze([position[0],index===0?0:height+2.4,position[2]]),coinPosition:Object.freeze(coinPosition)});
}));

export const GROUND_DROP_POINTS = Object.freeze([
  [-16,.35,-12],[-8,.35,-22],[10,.35,-20],[21,.35,-10],[18,.35,10],[8,.35,22],
  [-10,.35,21],[-22,.35,12],[-27,.35,-5],[0,.35,14],[13,.35,1],[-12,.35,1]
]);

export const MONSTER_SPAWNS = Object.freeze([[0,0,-72],[72,0,0],[0,0,72],[-72,0,0]]);

export function distance2d(a,b){return Math.hypot((a?.[0]||0)-(b?.[0]||0),(a?.[2]||0)-(b?.[2]||0));}
export function insideArena(position,pad=0){return Array.isArray(position)&&position.length===3&&position.every(Number.isFinite)&&Math.hypot(position[0],position[2])<=ARENA_RADIUS+pad&&position[1]>=-4&&position[1]<=64;}
export function insideSafeZone(position){return distance2d(position,[SAFE_ZONE.x,0,SAFE_ZONE.z])<SAFE_ZONE.radius;}
