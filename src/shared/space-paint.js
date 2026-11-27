import {ARENA_RADIUS} from './arena.js';

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
// Separate from surface graffiti and gameplay; immutable archive is shared by
// the combat snapshot cache. Only persisted GM authorization can mutate it.
export function applySpacePaint(world,actor,body){
 if(actor.admin!==true||world.profiles?.[actor.key]?.admin!==true||actor.role!=='fighter')return {error:'GM only'};
 const list=world.spacePaint||[];
 if(body.action==='gm-edit-3d'){
  const remove=body.remove,add=body.add;
  if(!Array.isArray(remove)||!Array.isArray(add)||remove.length+add.length<1||remove.length+add.length>SPACE_PAINT_STROKE_BUDGET||
    !remove.every(validId)||new Set(remove).size!==remove.length)return {error:'Invalid 3D history edit'};
  const ids=new Set(remove);
  if(remove.some(id=>!list.some(s=>s.id===id)))return {error:'3D history has changed'};
  const next=list.filter(s=>!ids.has(s.id)),seen=new Set(next.map(s=>s.id));
  for(const raw of add){const s=validateSpacePaint(raw);if(!s||seen.has(s.id))return {error:'Invalid 3D history stroke'};seen.add(s.id);next.push(s);}
  if(next.length>SPACE_PAINT_STROKE_BUDGET||next.reduce((n,s)=>n+s.points.length,0)>SPACE_PAINT_POINT_BUDGET)return {error:'3D paint archive full'};
  world.spacePaint=next;world.spacePaintRevision=(world.spacePaintRevision||0)+1;world.revision++;return {spacePaintEdited:true};
 }
 if(body.action==='gm-erase-3d'){
  if(!validId(body.id)||!list.some(s=>s.id===body.id))return {error:'3D stroke not found'};
  world.spacePaint=list.filter(s=>s.id!==body.id);
 }else{
  const s=validateSpacePaint(body.stroke);
  if(!s||list.some(p=>p.id===s.id))return {error:'Invalid 3D stroke'};
  if(list.length>=SPACE_PAINT_STROKE_BUDGET||list.reduce((n,p)=>n+p.points.length,0)+s.points.length>SPACE_PAINT_POINT_BUDGET)return {error:'3D paint archive full; erase a stroke first'};
  world.spacePaint=[...list,s];
 }
 world.spacePaintRevision=(world.spacePaintRevision||0)+1;world.revision++;
 return body.action==='gm-erase-3d'?{erased3DStroke:body.id,erasedStroke:list.find(s=>s.id===body.id)}:{spacePaintStroke:world.spacePaint.at(-1)};
}
