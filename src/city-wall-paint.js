import * as THREE from 'three';
import {CITY_LOTS,cityFacadeFloor,cityCollapsePosition,signPaintWall,signPaintDescriptor,signPaintPoint,signPaintAvailable,structurePaintLot} from './shared/city-layout.js';

const WALLS=['front','back','left','right'];
const SIZE=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches?256:512;
function panelPoint(lot,wall,floor,u,y){
 const g=cityFacadeFloor(lot,floor),delta=.033;
 let x,z;
 if(wall==='front'){x=g.shift+(u-.5)*g.w;z=g.setback+g.d/2+delta;}
 else if(wall==='back'){x=g.shift+(.5-u)*g.w;z=g.setback-g.d/2-delta;}
 else if(wall==='right'){x=g.shift+g.w/2+delta;z=g.setback+(.5-u)*g.d;}
 else {x=g.shift-g.w/2-delta;z=g.setback+(u-.5)*g.d;}
 const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
 return [lot.x+c*x+s*z,y,lot.z-s*x+c*z];
}
function paintGeometry(lot,wall){
 const positions=[],uv=[],indices=[];
 if(signPaintWall(wall)){
  for(const [u,v] of [[0,1],[1,1],[1,0],[0,0]]){const p=signPaintPoint(lot,wall,u,v);if(!p)return null;positions.push(...p);uv.push(u,1-v);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();return geometry;
 }
 for(let floor=0;floor<lot.floors;floor++){
  const g=cityFacadeFloor(lot,floor),base=positions.length/3;
  const topV=1-g.top/lot.height,bottomV=1-g.bottom/lot.height;
  for(const [u,v,y] of [[0,bottomV,g.bottom],[1,bottomV,g.bottom],
   [1,topV,g.top],[0,topV,g.top]]){
   positions.push(...panelPoint(lot,wall,floor,u,y));
   uv.push(u,1-v);
  }
  indices.push(base,base+1,base+2,base,base+2,base+3);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}
function strokeOnCanvas(ctx,stroke,lot,wall){
 if(!Array.isArray(stroke?.points)||!stroke.points.length)return;
 const points=stroke.points,sign=signPaintDescriptor(lot,wall),sideWidth=sign?.width||(['front','back'].includes(wall)?lot.width:lot.depth);
 const radius=Math.max(.8,Number(stroke.size||.14)*SIZE/Math.max(1,sideWidth));
 ctx.save();
 ctx.globalCompositeOperation=stroke.tool==='eraser'?'destination-out':'source-over';
 ctx.strokeStyle=stroke.tool==='eraser'?'#000':stroke.color||'#ff3333';
 ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=radius*2;
 ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();for(let i=0;i<points.length;i++){
  const x=points[i][0]*SIZE,y=points[i][1]*SIZE;
  if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 }
 if(points.length===1){ctx.beginPath();ctx.arc(points[0][0]*SIZE,points[0][1]*SIZE,radius,0,Math.PI*2);ctx.fill();}
 else ctx.stroke();
 ctx.restore();
}
/** Persistent material decal for walls, not a separate freestanding billboard.
 * Painted UVs use each floor's ORIGINAL structural side coordinates; on ruin
 * collapse all decal vertices receive the same fracture transform as the
 * building's core vertices. Reset restores both from their baseline arrays.
 */
export class CityWallPaint{
 constructor(root,city){
  this.root=root;this.city=city;this.surfaces=new Map();this.revision=-1;this.archive={};this.structures=[];
 }
 key(lotId,wall){return lotId+'/'+wall;}
 slot(lotId,wall){
  const key=this.key(lotId,wall);if(this.surfaces.has(key))return this.surfaces.get(key);
  const structure=signPaintWall(wall)?this.structures.find(x=>x.id===lotId&&x.kind==='house'):null;
  const lot=structure?structurePaintLot(structure):CITY_LOTS.find(x=>x.id===lotId);
  if(!lot||(!WALLS.includes(wall)&&!signPaintDescriptor(lot,wall)))return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=2;
  const geometry=paintGeometry(lot,wall);if(!geometry){texture.dispose();return null;}
  const original=geometry.attributes.position.array.slice();
  const material=new THREE.MeshBasicMaterial({
   map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Wall-painted '+key;
  mesh.renderOrder=1;this.root.add(mesh);
  const slot={lot,wall,mesh,canvas,ctx,texture,original,strokes:[],stamp:'',preview:null,pending:[]};
  this.surfaces.set(key,slot);
  const tier=this.city.renderedTiers?.get(lot.index)??this.city.damage[lot.id]?.tier??0;
  if(!lot.structure&&tier>0)this.deform(slot,tier);
  this.updateSignVisibility(slot);
  return slot;
 }
 draw(slot){
  slot.ctx.clearRect(0,0,SIZE,SIZE);
  for(const stroke of slot.strokes)strokeOnCanvas(slot.ctx,stroke,slot.lot,slot.wall);
  const acknowledged=new Set(slot.strokes.map(stroke=>stroke.clientId).filter(Boolean));
  for(const stroke of slot.pending)if(!acknowledged.has(stroke.clientId))strokeOnCanvas(slot.ctx,stroke,slot.lot,slot.wall);
  if(slot.preview)strokeOnCanvas(slot.ctx,slot.preview,slot.lot,slot.wall);
  slot.texture.needsUpdate=true;
 }
 preview(stroke){
  if(!stroke)return;
  const slot=this.slot(stroke.lotId,stroke.wall);if(!slot)return;
  slot.preview=stroke;this.draw(slot);
 }
 queuePreview(stroke){
  const slot=this.slot(stroke.lotId,stroke.wall);if(!slot)return;
  if(slot.preview===stroke)slot.preview=null;
  if(!slot.pending.some(s=>s.clientId===stroke.clientId))slot.pending.push(stroke);
  this.draw(slot);
 }
 ackPreview(stroke,serverStroke){
  const slot=this.slot(stroke.lotId,stroke.wall);if(!slot)return;
  // HTTP may be earlier or later than the websocket world broadcast.
  if(!slot.strokes.some(s=>s.id===serverStroke.id))slot.strokes=[...slot.strokes,serverStroke];
  slot.pending=slot.pending.filter(s=>s.clientId!==stroke.clientId);this.draw(slot);
 }
 rejectPreview(stroke){
  const slot=this.surfaces.get(this.key(stroke.lotId,stroke.wall));if(!slot)return;
  slot.pending=slot.pending.filter(s=>s.clientId!==stroke.clientId);this.draw(slot);
 }
 endPreview(lotId,wall,stroke=null){
  const slot=this.surfaces.get(this.key(lotId,wall));
  if(slot&&(!stroke||slot.preview===stroke)){slot.preview=null;this.draw(slot);}
 }
 sync(data={},revision=0,structures=this.structures){
  const old=this.structures;this.structures=structures||old||[];
  if(old!==this.structures){
   for(const [key,slot] of this.surfaces){if(!slot.lot?.structure)continue;const current=this.structures.find(s=>s.id===slot.lot.id);if(!current){this.disposeSlot(slot);this.surfaces.delete(key);continue;}
    const lot=structurePaintLot(current),previous=slot.lot.structure;slot.lot=lot;
    if(JSON.stringify([previous.position,previous.rotation,previous.house])!==JSON.stringify([current.position,current.rotation,current.house])){const geometry=paintGeometry(lot,slot.wall);if(!geometry){this.disposeSlot(slot);this.surfaces.delete(key);continue;}slot.mesh.geometry.dispose();slot.mesh.geometry=geometry;slot.original=geometry.attributes.position.array.slice();}
    this.updateSignVisibility(slot);
   }
  }
  if(revision===this.revision&&old===this.structures)return;
  this.revision=revision;this.archive=data||{};
  const seen=new Set();
  for(const [lotId,walls] of Object.entries(this.archive)){
   for(const [wall,strokes] of Object.entries(walls||{})){
    if((!WALLS.includes(wall)&&!signPaintWall(wall))||!Array.isArray(strokes)||!strokes.length)continue;
    const key=this.key(lotId,wall);seen.add(key);
    const slot=this.slot(lotId,wall);if(!slot)continue;
    const stamp=strokes.length+':'+(strokes.at(-1)?.id||'');
    if(slot.stamp===stamp)continue;
    slot.strokes=strokes;slot.stamp=stamp;this.draw(slot);
   }
  }
  for(const [key,slot] of this.surfaces)if(!seen.has(key)){
   if(slot.preview||slot.pending.length){slot.strokes=[];slot.stamp='';this.draw(slot);continue;}
   this.disposeSlot(slot);this.surfaces.delete(key);
  }
 }
 updateSignVisibility(slot){if(!signPaintWall(slot.wall))return;const part=slot.wall.split(':')[0];slot.mesh.visible=signPaintAvailable(slot.lot,slot.wall,this.city.damage||{})&&(slot.lot.structure||!this.city.partsHidden?.has(slot.lot.index+':'+part));}
 hideSign(index,part){for(const slot of this.surfaces.values())if(!slot.lot.structure&&slot.lot.index===index&&slot.wall.startsWith(part+':'))slot.mesh.visible=false;}
 disposeSlot(slot){
  slot.mesh.removeFromParent();slot.mesh.geometry.dispose();
  slot.mesh.material.dispose();slot.texture.dispose();slot.canvas.width=slot.canvas.height=0;
 }
 deform(slot,tier=10,shakeX=0,shakeZ=0){
  const lot=slot.lot,attr=slot.mesh.geometry.attributes.position,arr=attr.array;if(lot.structure)return;this.updateSignVisibility(slot);
  const original=slot.original;
  for(let i=0;i<arr.length;i+=3){
   const p=cityCollapsePosition(lot,original[i],original[i+1],original[i+2],tier);
   arr[i]=p[0]+shakeX;arr[i+1]=p[1];arr[i+2]=p[2]+shakeZ;
  }
  attr.needsUpdate=true;slot.mesh.geometry.computeBoundingSphere();
 }
 deformTier(index,tier,shakeX=0,shakeZ=0){
  for(const slot of this.surfaces.values())if(slot.lot.index===index)this.deform(slot,tier,shakeX,shakeZ);
 }
 collapseLot(index){
  this.deformTier(index,10);
 }
 resetBuildings(){
  for(const slot of this.surfaces.values()){
   const attr=slot.mesh.geometry.attributes.position;
   attr.array.set(slot.original);attr.needsUpdate=true;
   slot.mesh.geometry.computeBoundingSphere();this.updateSignVisibility(slot);
  }
 }
}
