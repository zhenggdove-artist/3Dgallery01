import {PLATFORMS,ARENA_RADIUS} from './arena.js';
export const APPEARANCE_DEFAULTS={depth:.1,brightness:1,contrast:1,saturation:1,blackPoint:0,tint:'#ffffff'};
export function validateAppearance(value={}){const out={...APPEARANCE_DEFAULTS,...value};for(const [key,min,max] of [['depth',0,2],['brightness',0,3],['contrast',0,3],['saturation',0,3],['blackPoint',0,.95]])if(!Number.isFinite(out[key])||out[key]<min||out[key]>max)return null;if(!/^#[0-9a-f]{6}$/i.test(out.tint))return null;return out;}
export function artworkDefinitions(world){return [...PLATFORMS,...(world?.customArtworks||[]).map((a,index)=>({id:a.id,index:PLATFORMS.length+index,artPosition:a.position,position:[a.position[0],0,a.position[2]],artYaw:0,size:[4,4,4]}))];}
export function addArtwork(world,profile,actor,body,now){
 if(!profile.admin)return {error:'GM only'};const record=body.artwork,media=body.verifiedArtMedia;
 if(!record||!media||!['image/png','image/jpeg','image/webp','video/mp4','video/webm','model/gltf-binary'].includes(media.type))return {error:'Validated artwork upload required'};
 if((world.customArtworks?.length||0)>=64)return {error:'Artwork limit reached (64 uploads)'};
 const p=record.position;if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||Math.hypot(p[0],p[2])>ARENA_RADIUS||p[1]<0||p[1]>50)return {error:'Invalid artwork position'};
 const appearance=validateAppearance(record.appearance);if(!appearance)return {error:'Invalid artwork appearance'};
 const id='art-'+crypto.randomUUID(),entry={id,title:String(record.title||'Untitled').slice(0,120),mediaId:media.id,type:media.type.startsWith('image/')?'image':media.type.startsWith('video/')?'video':'model',mime:media.type,position:[...p],createdAt:now,owner:actor.key,version:1};
 world.customArtworks??=[];world.customArtworks.push(entry);world.artworks[id]={availableAt:0,holder:null,throwEvent:null};world.artworkLayout[id]={position:[...p],rotation:[0,0,0],scale:[1,1,1],appearance,revision:1,updatedAt:now};world.revision++;
 return {notice:'Artwork published',artwork:entry};
}
