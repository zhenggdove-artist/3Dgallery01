import * as THREE from 'three';
import {surfaceInfo,surfaceFace} from './shared/space-paint-surface.js';
// A single bounded atlas for all saved stroke surfaces. Geometry stays batched.
// Canvas is allocated only after the first surface-paint operation.
export class SpacePaintTexture{
 constructor(mesh,ranges,strokes){
  this.mesh=mesh;this.grid=Math.ceil(Math.sqrt(ranges.length));this.tile=Math.min(256,Math.floor(2048/this.grid));this.side=this.tile*this.grid;
  this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=this.side;this.ctx=this.canvas.getContext('2d');
  this.scratch=document.createElement('canvas');this.scratch.width=this.scratch.height=this.tile;this.ink=this.scratch.getContext('2d');
  this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.generateMipmaps=false;this.texture.minFilter=THREE.LinearFilter;this.texture.magFilter=THREE.LinearFilter;
  const uv=[],old=mesh.geometry,geometry=old.toNonIndexed();this.entries=new Map();
  ranges.forEach((range,i)=>{
   const stroke=strokes[i],info=range.info||surfaceInfo(stroke),x=(i%this.grid)*this.tile,y=Math.floor(i/this.grid)*this.tile;
   const entry={stroke,info,x,y};this.entries.set(stroke.id,entry);
   for(let f=0;f<range.end-range.start;f++){
    const face=surfaceFace(info,f),rect=this.rect(face.chart);
    for(const [u,v] of face.uv)uv.push((x+rect.x+u*rect.w)/this.side,1-(y+rect.y+v*rect.h)/this.side);
   }
  });
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));mesh.geometry=geometry;old.dispose();
  this.originalMaterial=mesh.material;
  this.material=new THREE.MeshLambertMaterial({map:this.texture,side:THREE.DoubleSide});mesh.material=this.material;
 }
 rect(chart){
  const t=this.tile,h=Math.floor(t*.62),half=Math.floor(t/2);
  if(chart===0)return {x:2,y:2,w:t-4,h:h-4};
  return {x:(chart===1?0:half)+2,y:h+2,w:half-4,h:t-h-4};
 }
 drawInk(paint,info){
  const ctx=this.ink,r=this.rect(paint.chart),w=paint.chart===0?info.total:2*info.a,h=paint.chart===0?info.circumference:2*info.b;
  const rx=Math.max(.5,paint.size*r.w/Math.max(.001,w)),ry=Math.max(.5,paint.size*r.h/Math.max(.001,h));
  ctx.save();ctx.beginPath();ctx.rect(r.x-1,r.y-1,r.w+2,r.h+2);ctx.clip();ctx.globalCompositeOperation=paint.tool==='eraser'?'destination-out':'source-over';ctx.fillStyle=paint.color;
  const stamp=(u,v)=>{for(const offset of paint.chart===0?[-1,0,1]:[0]){ctx.beginPath();ctx.ellipse(r.x+u*r.w,r.y+(v+offset)*r.h,rx,ry,0,0,Math.PI*2);ctx.fill();}};
  let prev=null;for(const point of paint.points){let [u,v]=point;if(prev){let dv=v-prev[1];if(paint.chart===0)dv-=Math.round(dv);const du=u-prev[0],steps=Math.min(128,Math.max(1,Math.ceil(Math.hypot(du*r.w/Math.max(.5,rx),dv*r.h/Math.max(.5,ry))*2)));for(let i=1;i<=steps;i++)stamp(prev[0]+du*i/steps,prev[1]+dv*i/steps);}else stamp(u,v);prev=point;}
  ctx.restore();
 }
 repaint(id,paints){
  const e=this.entries.get(id);if(!e)return;
  this.ink.clearRect(0,0,this.tile,this.tile);
  for(const paint of paints)this.drawInk(paint,e.info);
  this.ctx.fillStyle=e.stroke.color;this.ctx.fillRect(e.x,e.y,this.tile,this.tile);
  this.ctx.drawImage(this.scratch,e.x,e.y);this.texture.needsUpdate=true;
 }
 dispose(){this.mesh.material=this.originalMaterial;this.material.dispose();this.texture.dispose();}
}
