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

const nearbyIndexCache=new WeakMap(),NEARBY_CELL=8;
export function nearbySnapshotRows(rows,x,z,radius){
 if(!Array.isArray(rows)||rows.length<24||!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0)return rows||[];
 let grid=nearbyIndexCache.get(rows);
 if(!grid){grid=new Map();for(let i=0;i<rows.length;i++){const p=rows[i]?.position;if(!p||!Number.isFinite(p[0])||!Number.isFinite(p[2]))return rows;const key=Math.floor(p[0]/NEARBY_CELL)+':'+Math.floor(p[2]/NEARBY_CELL);let cell=grid.get(key);if(!cell)grid.set(key,cell=[]);cell.push(i);}nearbyIndexCache.set(rows,grid);}
 const hits=[];for(let cx=Math.floor((x-radius)/NEARBY_CELL);cx<=Math.floor((x+radius)/NEARBY_CELL);cx++)for(let cz=Math.floor((z-radius)/NEARBY_CELL);cz<=Math.floor((z+radius)/NEARBY_CELL);cz++){const cell=grid.get(cx+':'+cz);if(cell)for(const i of cell)hits.push(i);}
 hits.sort((a,b)=>a-b);return hits.map(i=>rows[i]);
}
export function distance2d(a,b){return Math.hypot((a?.[0]||0)-(b?.[0]||0),(a?.[2]||0)-(b?.[2]||0));}
export function insideArena(position,pad=0){return Array.isArray(position)&&position.length===3&&position.every(Number.isFinite)&&Math.hypot(position[0],position[2])<=ARENA_RADIUS+pad&&position[1]>=-4&&position[1]<=64;}
export function insideSafeZone(position){return distance2d(position,[SAFE_ZONE.x,0,SAFE_ZONE.z])<SAFE_ZONE.radius;}

export const GM_HOUSE_DEFAULT=Object.freeze({width:6,depth:5,height:6,floors:2,windows:3,signs:1,pipes:true,metal:true,wallColor:'#b4a395',roofColor:'#8b8073',doorColor:'#292b2b',bladeCount:1,roofCount:1,bladeColor:'#c84730',roofSignColor:'#4c9ea1',bladeSize:1,roofSize:1,flatColor:'#964b42',flatStyle:'wild',bladeStyle:'wild',roofStyle:'wild',flatFont:'hei',bladeFont:'hei',roofFont:'hei',flatSaturation:1,bladeSaturation:1,roofSaturation:1});
export function validateGmHouse(value){
 const s=value?.house,p=value?.position,yaw=value?.rotation;
 if(!s||!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||p[1]<0||p[1]>40||!Number.isFinite(yaw))return null;
 const range=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
 if(!range(s.width,2,24)||!range(s.depth,2,24)||!range(s.height,2,40)||!Number.isInteger(s.floors)||!range(s.floors,1,12)||!Number.isInteger(s.windows)||!range(s.windows,0,8)||!Number.isInteger(s.signs)||!range(s.signs,0,6)||typeof s.pipes!=='boolean'||typeof s.metal!=='boolean'||s.height/s.floors<1.2||p[1]+s.height>62)return null;
 if(Math.hypot(p[0],p[2])+Math.hypot(s.width,s.depth)/2>ARENA_RADIUS||Math.hypot(p[0],p[2])-Math.hypot(s.width,s.depth)/2<SAFE_ZONE.radius+1)return null;
 const colors=['wallColor','roofColor','doorColor','bladeColor','roofSignColor','flatColor'],extras={};
 for(const key of colors){const v=s[key]??GM_HOUSE_DEFAULT[key];if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))return null;extras[key]=v;}
 for(const key of ['bladeCount','roofCount']){const v=s[key]??0;if(!Number.isInteger(v)||v<0||v>(key==='bladeCount'?4:3))return null;extras[key]=key==='bladeCount'&&s.floors>5?0:v;}
 for(const key of ['bladeSize','roofSize']){const v=s[key]??1;if(!range(v,.5,2.5))return null;extras[key]=v;}
 for(const prefix of ['flat','blade','roof']){
  for(const [suffix,allowed] of [['Style',['wild','cute','handwritten','icon','portrait']],['Font',['hei','ming','kai','rounded']],['Saturation',[.5,1]]]){
   const key=prefix+suffix,v=s[key]??GM_HOUSE_DEFAULT[key];if(!allowed.includes(v))return null;extras[key]=v;
  }
 }
 return {position:[...p],rotation:Math.atan2(Math.sin(yaw),Math.cos(yaw)),house:{width:s.width,depth:s.depth,height:s.height,floors:s.floors,windows:s.windows,signs:s.signs,pipes:s.pipes,metal:s.metal,...extras}};
}
export function gmHouseBlocked(structures,x,z,y,margin=.22){
 for(const s of structures||[]){if(!s.gmHouse||!s.house||s.hp<=0||y<s.position[1]-.2||y>=s.position[1]+s.house.height+.14)continue;
  const dx=x-s.position[0],dz=z-s.position[2],c=Math.cos(s.rotation||0),q=Math.sin(s.rotation||0);
  if(Math.abs(dx*c-dz*q)<s.house.width/2+margin&&Math.abs(dx*q+dz*c)<s.house.depth/2+margin)return true;
 }return false;
}
