import * as THREE from 'three';
import {CITY_LOTS,cityFacadeFloor,cityRoofHeight} from './shared/city-layout.js';

const WALLS=['front','back','left','right'];
const SIZE=512;
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
 const points=stroke.points,sideWidth=['front','back'].includes(wall)?lot.width:lot.depth;
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
  this.root=root;this.city=city;this.surfaces=new Map();this.revision=-1;this.archive={};
 }
 key(lotId,wall){return lotId+'/'+wall;}
 slot(lotId,wall){
  const key=this.key(lotId,wall);if(this.surfaces.has(key))return this.surfaces.get(key);
  const lot=CITY_LOTS.find(x=>x.id===lotId);
  if(!lot||!WALLS.includes(wall))return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=2;
  const geometry=paintGeometry(lot,wall);
  const original=geometry.attributes.position.array.slice();
  const material=new THREE.MeshBasicMaterial({
   map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Wall-painted '+key;
  mesh.renderOrder=1;this.root.add(mesh);
  const slot={lot,wall,mesh,canvas,ctx,texture,original,strokes:[],stamp:'',preview:null};
  this.surfaces.set(key,slot);
  if(this.city.hidden.has(lot.index))this.deform(slot);
  return slot;
 }
 draw(slot){
  slot.ctx.clearRect(0,0,SIZE,SIZE);
  for(const stroke of slot.strokes)strokeOnCanvas(slot.ctx,stroke,slot.lot,slot.wall);
  if(slot.preview)strokeOnCanvas(slot.ctx,slot.preview,slot.lot,slot.wall);
  slot.texture.needsUpdate=true;
 }
 preview(stroke){
  if(!stroke)return;
  const slot=this.slot(stroke.lotId,stroke.wall);if(!slot)return;
  slot.preview=stroke;this.draw(slot);
 }
 endPreview(lotId,wall,stroke=null){
  const slot=this.surfaces.get(this.key(lotId,wall));
  if(slot&&(!stroke||slot.preview===stroke)){slot.preview=null;this.draw(slot);}
 }
 sync(data={},revision=0){
  if(revision===this.revision)return;
  this.revision=revision;this.archive=data||{};
  const seen=new Set();
  for(const [lotId,walls] of Object.entries(this.archive)){
   for(const [wall,strokes] of Object.entries(walls||{})){
    if(!WALLS.includes(wall)||!Array.isArray(strokes)||!strokes.length)continue;
    const key=this.key(lotId,wall);seen.add(key);
    const slot=this.slot(lotId,wall);if(!slot)continue;
    const stamp=strokes.length+':'+(strokes.at(-1)?.id||'');
    if(slot.stamp===stamp)continue;
    slot.strokes=strokes;slot.stamp=stamp;this.draw(slot);
   }
  }
  for(const [key,slot] of this.surfaces)if(!seen.has(key)){
   this.disposeSlot(slot);this.surfaces.delete(key);
  }
 }
 disposeSlot(slot){
  slot.mesh.removeFromParent();slot.mesh.geometry.dispose();
  slot.mesh.material.dispose();slot.texture.dispose();
 }
 deform(slot){
  const lot=slot.lot,attr=slot.mesh.geometry.attributes.position,arr=attr.array;
  const original=slot.original;
  const firstFloor=lot.height/lot.floors,survivor=firstFloor*(lot.floors===1?.32:.76);
  for(let i=0;i<arr.length;i+=3){
   const ox=original[i],oy=original[i+1],oz=original[i+2];
   if(oy<=survivor){arr[i]=ox;arr[i+1]=oy;arr[i+2]=oz;continue;}
   const collapse=oy-survivor;
   const noise=Math.sin(lot.index*.73+ox*.81+oz*.59+oy*1.13);
   const compression=.08+.075*(.5+.5*noise);
   const factor=Math.min(1,collapse/Math.max(1,lot.height-survivor));
   arr[i]=ox+Math.sin(oy*1.9+lot.index*.9)*factor*.35;
   arr[i+1]=survivor+collapse*compression;
   arr[i+2]=oz+Math.cos(oy*1.5+lot.index*.7)*factor*.35;
  }
  attr.needsUpdate=true;slot.mesh.geometry.computeBoundingSphere();
 }
 collapseLot(index){
  for(const slot of this.surfaces.values())if(slot.lot.index===index)this.deform(slot);
 }
 resetBuildings(){
  for(const slot of this.surfaces.values()){
   const attr=slot.mesh.geometry.attributes.position;
   attr.array.set(slot.original);attr.needsUpdate=true;
   slot.mesh.geometry.computeBoundingSphere();
  }
 }
}
