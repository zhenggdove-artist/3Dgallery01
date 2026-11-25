import {insideArena,insideSafeZone} from './arena.js';
import {cityBlocked} from './city-layout.js';
export const WANTED_PAGE_SIZE=12;
export function wantedSettings(world){return {label:world.wantedSettings?.label||'Wanted List',background:world.wantedSettings?.background||null};}
export function wantedPage(world,page=0){
 const profiles=Object.values(world.profiles||{}).filter(p=>p.wanted&&!p.wanted.hidden).sort((a,b)=>a.wanted.createdAt-b.wanted.createdAt||a.key.localeCompare(b.key));
 const pages=Math.max(1,Math.ceil(profiles.length/WANTED_PAGE_SIZE)),index=Math.max(0,Math.min(pages-1,Math.floor(Number(page)||0)));
 const authors=new Set((world.customArtworks||[]).map(a=>a.owner));
 return {page:index,pages,total:profiles.length,entries:profiles.slice(index*WANTED_PAGE_SIZE,(index+1)*WANTED_PAGE_SIZE).map(p=>({key:p.key,...p.wanted,level:p.level||1,kills:p.wantedKills||0,deaths:p.wantedDeaths||0,hasArtwork:authors.has(p.key)})),settings:wantedSettings(world)};
}
export function wantedProfile(input,previous,now){
 const name=String(input.name||'').trim(),website=String(input.website||'').trim(),quote=String(input.quote||'').trim();
 if(!name||name.length>24||/[<>\x00-\x1f]/.test(name))throw Error('Artist name: 1–24 characters');
 if(quote.length>160||website.length>300)throw Error('Statement or website too long');
 if(website){let u;try{u=new URL(website)}catch{throw Error('Enter a complete HTTPS or HTTP website URL')};if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid website URL');}
 const crop=input.crop||{},n=(v,d)=>Number.isFinite(Number(v))?Math.min(100,Math.max(0,Number(v))):d;
 return {name,website,quote,avatar:input.avatar??previous?.avatar??null,crop:{x:n(crop.x,50),y:n(crop.y,50)},useName:input.useName===true,hidden:previous?.hidden===true,createdAt:previous?.createdAt||now};
}
export function wantedDestination(world,key){
 for(const art of world.customArtworks||[]){
  if(art.owner!==key||world.artworks?.[art.id]?.holder||world.artworks?.[art.id]?.throwEvent)continue;
  const layout=world.artworkLayout?.[art.id],p=layout?.position||art.position;
  if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))continue;
  const yaw=layout?.rotation?.[1]||0;
  for(const angle of [yaw,yaw+Math.PI/2,yaw-Math.PI/2,yaw+Math.PI]){
   const pos=[p[0]+Math.sin(angle)*4,0,p[2]+Math.cos(angle)*4];
   if(insideArena(pos,-2)&&!insideSafeZone(pos)&&!cityBlocked(pos[0],pos[2],.002,world.cityDamage||{},.5))return {id:art.id,position:pos,rotation:Math.atan2(p[0]-pos[0],p[2]-pos[2])};
  }
 }
 return null;
}
export function countWantedDeath(target,source){target.wantedDeaths=(target.wantedDeaths||0)+1;if(source&&source.key!==target.key)source.wantedKills=(source.wantedKills||0)+1;}
