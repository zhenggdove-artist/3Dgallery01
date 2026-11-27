import {ARENA_RADIUS} from './arena.js';
import {normalizeSurfaceStroke,surfaceBudget} from './space-paint-surface.js';

export const SPACE_PAINT_MAX_POINTS=256, SPACE_PAINT_POINT_BUDGET=8192, SPACE_PAINT_STROKE_BUDGET=256;
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(id);
export function spacePaintPointAllowed(p){
 return finite3(p)&&Math.hypot(p[0],p[2])<=ARENA_RADIUS+12&&p[1]>=-4&&p[1]<=160;
}
export function validateSpacePaint(s){
 if(!s||!validId(s.id)||typeof s.color!=='string'||!/^#[0-9a-f]{6}$/i.test(s.color)||
  !Number.isFinite(s.size)||s.size<.04||s.size>.95||!Number.isFinite(s.thickness)||s.thickness<.04||s.thickness>4||
  !finite3(s.normal)||Math.abs(Math.hypot(...s.normal)-1)>.01||
  !Array.isArray(s.points)||s.points.length<1||s.points.length>SPACE_PAINT_MAX_POINTS||!s.points.every(spacePaintPointAllowed))return null;
 const normal=s.normal.map(n=>n/Math.hypot(...s.normal)),origin=s.points[0],points=[];
 for(const p of s.points){
  if(Math.abs(p.reduce((n,v,i)=>n+(v-origin[i])*normal[i],0))>.035)return null;
  const q=p.map(v=>+v.toFixed(3)),last=points.at(-1);
  if(!last||Math.hypot(...q.map((v,i)=>v-last[i]))>=.005)points.push(q);
 }
 return {id:s.id,color:s.color.toLowerCase(),size:s.size,thickness:s.thickness,normal,points};
}
// Permission and ownership come only from the persisted profile, never a client role.
export function canSpacePaint(profile){return profile?.admin===true||profile?.spacePaintEnabled===true;}
export const SPACE_PAINT_ACTIONS=['gm-paint-3d','gm-erase-3d','gm-edit-3d','gm-space-paint-access','gm-space-paint-clear','paint-space-surface'];
export function applySpacePaint(world,actor,body){
 const profile=world.profiles?.[actor.key],gm=actor.admin===true&&profile?.admin===true;
 const action=body.action,list=world.spacePaint||[],surfaces=world.spacePaintSurface||{};
 const bump=(geometry=false,surface=false)=>{if(geometry)world.spacePaintRevision=(world.spacePaintRevision||0)+1;if(surface)world.spacePaintSurfaceRevision=(world.spacePaintSurfaceRevision||0)+1;world.revision=(world.revision||0)+1;};
 if(action==='gm-space-paint-access'||action==='gm-space-paint-clear'){
  if(!gm)return {error:'GM only'};
  const key=String(body.targetKey||''),target=Object.hasOwn(world.profiles||{},key)?world.profiles[key]:null;
  if(!target)return {error:'Player not found'};
  if(action==='gm-space-paint-access'){
   if(typeof body.enabled!=='boolean'||target.admin)return {error:'Invalid player permission'};
   target.spacePaintEnabled=body.enabled;bump();
   return {spacePaintAccess:body.enabled,notice:body.enabled?'3D PAINT GRANTED':'3D PAINT REVOKED'};
  }
  const removed=list.filter(s=>s.ownerKey===key||target.admin&&!s.ownerKey),ids=new Set(removed.map(s=>s.id));
  target.spacePaintEpoch=(target.spacePaintEpoch||0)+1;
  world.spacePaint=list.filter(s=>!ids.has(s.id));
  world.spacePaintSurface=Object.fromEntries(Object.entries(surfaces).filter(([id])=>!ids.has(id)));
  bump(true,true);return {spacePaintCleared:removed.length,notice:'3D PAINT CLEARED · '+removed.length};
 }
 if(actor.role!=='fighter'||!profile||profile.hp===0||profile.deadUntil>Date.now())return {error:'Cannot paint now'};
 if(action==='paint-space-surface'){
  const raw=body.stroke,s=list.find(v=>v.id===raw?.id);
  if(!s)return {error:'3D surface no longer exists'};
  if(!actor.position)return {error:'Paint within reach of your character'};
  const paint=normalizeSurfaceStroke(raw,s,actor.position);if(!paint)return {error:'Invalid 3D surface paint or out of reach'};
  const prior=surfaces[s.id]||[];
  if(prior.length>=128)return {error:'3D surface mural is full'};
  const next={...surfaces,[s.id]:[...prior,paint]};if(!surfaceBudget(next))return {error:'3D surface mural archive is full'};
  world.spacePaintSurface=next;bump(false,true);return {spaceSurfacePainted:true};
 }
 if(!gm&&(profile.admin===true||profile.spacePaintEnabled!==true))return {error:'3D PAINT permission required'};
 const own=s=>gm||s.ownerKey===actor.key;
 const owned=(raw,history=false)=>{
  const s=validateSpacePaint(raw);if(!s)return null;
  const key=history&&gm&&raw.ownerKey?raw.ownerKey:actor.key;
  if(!gm&&history&&raw.ownerKey!==actor.key)return null;
  const owner=Object.hasOwn(world.profiles||{},key)?world.profiles[key]:null;
  if(!owner||history&&Number(raw.ownerEpoch||0)!==(owner.spacePaintEpoch||0))return null;
  return {...s,ownerKey:key,ownerEpoch:owner.spacePaintEpoch||0};
 };
 const removedRecord=s=>({...s,...(surfaces[s.id]?.length?{graffiti:surfaces[s.id]}:{})});
 if(action==='gm-edit-3d'){
  const remove=body.remove,add=body.add;
  if(!Array.isArray(remove)||!Array.isArray(add)||remove.length+add.length<1||remove.length+add.length>SPACE_PAINT_STROKE_BUDGET||
    !remove.every(validId)||new Set(remove).size!==remove.length)return {error:'Invalid 3D history edit'};
  const ids=new Set(remove),removed=list.filter(s=>ids.has(s.id));
  if(removed.length!==remove.length||removed.some(s=>!own(s)))return {error:'3D history has changed or permission denied'};
  const next=list.filter(s=>!ids.has(s.id)),seen=new Set(next.map(s=>s.id)),paint=Object.fromEntries(Object.entries(surfaces).filter(([id])=>!ids.has(id)));
  for(const raw of add){
   const s=owned(raw,true);if(!s||seen.has(s.id))return {error:'Invalid 3D history stroke'};
   seen.add(s.id);next.push(s);
   if(raw.graffiti!==undefined){
    if(!Array.isArray(raw.graffiti)||raw.graffiti.length>128)return {error:'Invalid 3D history graffiti'};
    const verified=raw.graffiti.map(v=>normalizeSurfaceStroke(v,s));if(verified.some(v=>!v))return {error:'Invalid 3D history graffiti'};
    if(verified.length)paint[s.id]=verified;
   }
  }
  if(next.length>SPACE_PAINT_STROKE_BUDGET||next.reduce((n,s)=>n+s.points.length,0)>SPACE_PAINT_POINT_BUDGET||!surfaceBudget(paint))return {error:'3D paint archive full'};
  world.spacePaint=next;world.spacePaintSurface=paint;bump(true,true);return {spacePaintEdited:true,removedStrokes:removed.map(removedRecord)};
 }
 if(action==='gm-erase-3d'){
  const s=list.find(s=>s.id===body.id);
  if(!validId(body.id)||!s||!own(s))return {error:'3D stroke not found or permission denied'};
  world.spacePaint=list.filter(s=>s.id!==body.id);
  if(surfaces[s.id]){world.spacePaintSurface=Object.fromEntries(Object.entries(surfaces).filter(([id])=>id!==s.id));}
  bump(true,!!surfaces[s.id]);return {erased3DStroke:body.id,erasedStroke:removedRecord(s)};
 }
 if(action!=='gm-paint-3d')return {error:'Unknown 3D action'};
 if(body.ownerEpoch!==undefined&&body.ownerEpoch!==(profile.spacePaintEpoch||0))return {error:'3D drawing was cleared by GM'};
 const s=owned(body.stroke);
 if(!s||list.some(p=>p.id===s.id))return {error:'Invalid 3D stroke'};
 if(list.length>=SPACE_PAINT_STROKE_BUDGET||list.reduce((n,p)=>n+p.points.length,0)+s.points.length>SPACE_PAINT_POINT_BUDGET)return {error:'3D paint archive full; erase a stroke first'};
 world.spacePaint=[...list,s];bump(true);return {spacePaintStroke:s};
}
