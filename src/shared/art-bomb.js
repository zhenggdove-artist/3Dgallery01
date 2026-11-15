import {ARENA_RADIUS} from './arena.js';
import {validateAppearance} from './artwork-library.js';
import {artworkPosition} from './artwork-flight.js';

const inside=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export const MAX_ART_BOMBS_PER_PLAYER=4;
export const MAX_ART_BOMBS_GLOBAL=32;
export function validArtBombSize(value){const n=Number(value);return Number.isFinite(n)&&n>=.5&&n<=5?n:null;}

export function publishArtBomb(world,profile,actor,body,now=Date.now()){
 const record=body?.artwork,media=body?.verifiedArtMedia,size=validArtBombSize(body?.size);
 if(!media||!record||!['image/png','image/jpeg','image/webp','video/mp4','video/webm','model/gltf-binary'].includes(media.type))return {error:'Upload a validated image, video, or 3D model first'};
 if(!size)return {error:'Artwork size must be 0.5–5.0'};
 const p=record.position;
 if(!inside(p)||p[1]<0||p[1]>30||Math.hypot(p[0],p[2])>ARENA_RADIUS-2)return {error:'Invalid artwork position'};
 world.customArtworks??=[];
 if(world.customArtworks.length>=64||(world.customArtworks.filter(a=>a.bomb).length)>=MAX_ART_BOMBS_GLOBAL)return {error:'Temple artwork-bomb capacity reached'};
 if(world.customArtworks.filter(a=>a.bomb&&a.owner===actor.key).length>=MAX_ART_BOMBS_PER_PLAYER)return {error:'Each player may place up to four art bombs'};
 const appearance=validateAppearance(record.appearance||{});if(!appearance)return {error:'Invalid artwork appearance'};
 const id='bomb-'+crypto.randomUUID(),entry={
  id,title:String(record.title||'Untitled').slice(0,100),mediaId:media.id,
  type:media.type.startsWith('image/')?'image':media.type.startsWith('video/')?'video':'model',
  mime:media.type,position:[...p],createdAt:now,owner:actor.key,version:1,bomb:true
 };
 world.customArtworks.push(entry);
 world.artworks??={};world.artworks[id]={availableAt:0,holder:null,throwEvent:null};
 world.artworkLayout??={};world.artworkLayout[id]={position:[...p],rotation:[0,0,0],scale:[size,size,size],appearance,revision:1,updatedAt:now};
 world.revision=(world.revision||0)+1;
 return {notice:'Artwork bomb placed · press E nearby to pick up and charge throw',artwork:entry};
}

export function resizeArtBomb(world,actor,body,now=Date.now()){
 const record=(world.customArtworks||[]).find(a=>a.id===body.id&&a.bomb);
 if(!record||record.owner!==actor.key&&!actor.admin)return {error:'Only its creator or GM can resize this artwork'};
 const size=validArtBombSize(body.size);if(!size)return {error:'Artwork size must be 0.5–5.0'};
 const state=world.artworks?.[record.id],layout=world.artworkLayout?.[record.id];
 if(!layout||state?.holder||state?.throwEvent||state?.availableAt>now)return {error:'Wait for artwork to return before resizing'};
 const oldSize=layout.scale?.[0]||1;layout.position=[layout.position[0],Math.max(0,Math.min(30,layout.position[1]+1.5*(size-oldSize))),layout.position[2]];layout.scale=[size,size,size];layout.revision=(layout.revision||0)+1;layout.updatedAt=now;
 world.revision=(world.revision||0)+1;
 return {notice:'Artwork bomb size saved',artworkLayout:structuredClone(layout)};
}

// Sampling actual throw trajectory is stricter than accepting any opponent
// within a long, ground-level straight ray. The server owns this calculation.
export function projectileHitsActor(event,target,landingTime,size=1){
 if(!inside(target))return false;
 const tEnd=Math.max(0,Math.min(12,Number(landingTime)||1.5)),radius=Math.min(3.8,1.15+size*.4);
 const centre=[target[0],target[1]+1,target[2]],step=Math.min(.045,tEnd/24||.045);
 for(let t=0;t<=tEnd+step*.5;t+=step){
  const p=artworkPosition(event,Math.min(t,tEnd));
  if(Math.hypot(p[0]-centre[0],p[1]-centre[1],p[2]-centre[2])<=radius)return true;
 }
 return false;
}
export function artBombDamage(maxHp,rng=Math.random){
 const chance=Math.max(0,Math.min(1,Number(rng())||0));
 return Math.max(1,(Number(maxHp)||100)*(.3+.7*chance));
}
