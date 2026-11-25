import {insideArena,PLATFORMS} from './arena.js';
import {cityBlocked,cityGroundHeight} from './city-layout.js';
export const WANTED_PAGE_SIZE=12;
export function wantedSettings(world){const s=world.wantedSettings||{};return {label:s.label||'Wanted List',background:s.background||null,color:/^#[0-9a-f]{6}$/i.test(s.color||'')?s.color:'#422943',fontSize:Math.max(8,Math.min(30,Number(s.fontSize)||13))};}
const authorKey=v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function wantedArtworks(world,key){
 const profile=world.profiles?.[key],name=authorKey(profile?.wanted?.name),removed=new Set(world.removedArtworkIds||[]);
 const originals=PLATFORMS.filter(p=>!removed.has(p.id)).map(p=>({id:p.id,position:p.artPosition,original:true,platform:p}));
 const custom=(world.customArtworks||[]).filter(a=>!removed.has(a.id));
 const credited=[],legacy=[];
 for(const art of [...originals,...custom]){
  const layout=world.artworkLayout?.[art.id],author=authorKey(layout?.author??art.author);
  if(author&&name&&author===name)credited.push(art);
  else if(!author&&(art.owner===key||art.original&&profile?.admin===true))legacy.push(art);
 }
 // Explicit displayed credit takes priority. Original uncredited gallery works
 // are legacy GM works; never treat a differently credited work as the GM's.
 return [...credited,...legacy];
}
export function wantedPage(world,page=0){
 const profiles=Object.values(world.profiles||{}).filter(p=>p.wanted&&!p.wanted.hidden).sort((a,b)=>a.wanted.createdAt-b.wanted.createdAt||a.key.localeCompare(b.key));
 const pages=Math.max(1,Math.ceil(profiles.length/WANTED_PAGE_SIZE)),index=Math.max(0,Math.min(pages-1,Math.floor(Number(page)||0)));
 return {page:index,pages,total:profiles.length,entries:profiles.slice(index*WANTED_PAGE_SIZE,(index+1)*WANTED_PAGE_SIZE).map(p=>({key:p.key,...p.wanted,level:p.level||1,kills:p.wantedKills||0,deaths:p.wantedDeaths||0,hasArtwork:wantedArtworks(world,p.key).length>0})),settings:wantedSettings(world)};
}
export function wantedProfile(input,previous,now){
 const name=String(input.name||'').trim(),website=String(input.website||'').trim(),quote=String(input.quote||'').trim();
 if(!name||name.length>24||/[<>\x00-\x1f]/.test(name))throw Error('Artist name: 1–24 characters');
 if(quote.length>160||website.length>300)throw Error('Statement or website too long');
 if(website){let u;try{u=new URL(website)}catch{throw Error('Enter a complete HTTPS or HTTP website URL')};if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid website URL');}
 const crop=input.crop||{},n=(v,d)=>Number.isFinite(Number(v))?Math.min(100,Math.max(0,Number(v))):d;
 return {name,website,quote,avatar:input.avatar??previous?.avatar??null,crop:{x:n(crop.x,50),y:n(crop.y,50)},useName:input.useName===true,hidden:previous?.hidden===true,createdAt:previous?.createdAt||now};
}
export function wantedDestination(world,key,now=Date.now()){
 const dims={cube:[2,2,2],bar:[6,2,2],cylinder:[2,2,2],wall:[5,2.5,.45],column:[1.4,4,1.4],platform:[4,.7,4],house:[5,3.8,4],tree:[1.2,4,1.2]};
 for(const art of wantedArtworks(world,key)){
  const state=world.artworks?.[art.id];if(state?.holder||Number(state?.availableAt)>now)continue;
  const layout=world.artworkLayout?.[art.id],p=layout?.position||art.position;
  if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))continue;
  const yaw=layout?.rotation?.[1]??art.platform?.artYaw??0;
  const reach=Math.max(4,Math.min(12,3+Math.abs(layout?.scale?.[2]||1)));
  for(const distance of [reach,reach+2,reach+4])for(const angle of [yaw,yaw+Math.PI/4,yaw-Math.PI/4,yaw+Math.PI/2,yaw-Math.PI/2,yaw+Math.PI]){
   const x=p[0]+Math.sin(angle)*distance,z=p[2]+Math.cos(angle)*distance;
   let y=cityGroundHeight(x,z,p[1]+.5,world.cityDamage||{});
   // Exhibition decks are fixed fixtures, not attached to a moved artwork.
   // Respect the current GM overrides and never use the old procedural discs.
   for(const deck of PLATFORMS){const k='display:'+deck.id;if((world.removedPlatformIds||[]).includes(k)||(world.removedArtworkIds||[]).includes(deck.id))continue;const override=world.platformOverrides?.[k],center=override?.position||[deck.position[0],deck.size[1],deck.position[2]],radius=override?.radius??world.artworkLayout?.[deck.id]?.platformRadius??4.8;if(center[1]<=p[1]+.5&&Math.hypot(x-center[0],z-center[2])<radius)y=Math.max(y,center[1]);}
   for(const d of world.floatingPlatforms||[])if(Math.hypot(x-d.position[0],z-d.position[2])<d.radius*2&&d.position[1]<=p[1]+.5)y=Math.max(y,d.position[1]);
   const pos=[x,y,z];
   if(!insideArena(pos,-2)||cityBlocked(x,z,y+.002,world.cityDamage||{},.5))continue;
   if((world.structures||[]).some(s=>{const d=dims[s.kind]||[2,2,2];return y<d[1]&&Math.abs(x-s.position[0])<d[0]/2+.5&&Math.abs(z-s.position[2])<d[2]/2+.5;}))continue;
   return {id:art.id,position:pos,rotation:Math.atan2(p[0]-x,p[2]-z),lookAt:p};
  }
 }
 return null;
}
export function countWantedDeath(target,source){target.wantedDeaths=(target.wantedDeaths||0)+1;if(source&&source.key!==target.key)source.wantedKills=(source.wantedKills||0)+1;}
