import * as THREE from 'three';
import {surfaceInfo,surfaceFace} from './shared/space-paint-surface.js';
import {surfaceChartRect,isSurfaceCheckpoint,iterateSurfaceLayers,RASTER_TILE} from './shared/space-paint-raster.js';
import {paintOwnerStrokes} from './paint-composite.js';
// A single bounded atlas for all saved stroke surfaces. Geometry stays batched.
// Canvas is allocated only after the first surface-paint operation.
export class SpacePaintTexture{
 constructor(mesh,ranges,strokes,loadRaster){
  this.loadRaster=loadRaster;this.disposed=false;
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
  return surfaceChartRect(this.tile,chart);
 }
 drawInk(paint,info,ctx=this.ink,mode=paint.tool==='eraser'?'destination-out':'source-over'){
  const r=this.rect(paint.chart),w=paint.chart===0?info.total:2*info.a,h=paint.chart===0?info.circumference:2*info.b;
  const rx=Math.max(.5,paint.size*r.w/Math.max(.001,w)),ry=Math.max(.5,paint.size*r.h/Math.max(.001,h));
  ctx.save();ctx.beginPath();ctx.rect(r.x-1,r.y-1,r.w+2,r.h+2);ctx.clip();ctx.globalCompositeOperation=mode;ctx.fillStyle=paint.color;
  const stamp=(u,v)=>{for(const offset of paint.chart===0?[-1,0,1]:[0]){ctx.beginPath();ctx.ellipse(r.x+u*r.w,r.y+(v+offset)*r.h,rx,ry,0,0,Math.PI*2);ctx.fill();}};
  let prev=null;for(const point of paint.points){let [u,v]=point;if(prev){let dv=v-prev[1];if(paint.chart===0)dv-=Math.round(dv);const du=u-prev[0],steps=Math.min(128,Math.max(1,Math.ceil(Math.hypot(du*r.w/Math.max(.5,rx),dv*r.h/Math.max(.5,ry))*2)));for(let i=1;i<=steps;i++)stamp(prev[0]+du*i/steps,prev[1]+dv*i/steps);}else stamp(u,v);prev=point;}
  ctx.restore();
 }
 repaint(id,paints){
  const e=this.entries.get(id);if(!e)return;
  e.paints=paints;
  const checkpoint=isSurfaceCheckpoint(paints[0])?paints[0].checkpoint:null;
  if(checkpoint&&e.checkpoint!==checkpoint){
   if(e.loading!==checkpoint&&this.loadRaster){
    e.loading=checkpoint;
    if(e.failedCheckpoint!==checkpoint){e.failedCheckpoint=checkpoint;e.failures=0;}
    this.loadRaster(checkpoint).then(bytes=>{
     if(this.disposed||e.loading!==checkpoint)return;
     const canvas=document.createElement('canvas');canvas.width=canvas.height=RASTER_TILE;
     const ctx=canvas.getContext('2d'),scaled=document.createElement('canvas');scaled.width=scaled.height=this.tile;
     const sc=scaled.getContext('2d',{willReadFrequently:true}),base=[];
     for(const layer of iterateSurfaceLayers(bytes)){
      ctx.putImageData(new ImageData(layer.pixels,RASTER_TILE,RASTER_TILE),0,0);
      sc.clearRect(0,0,this.tile,this.tile);sc.drawImage(canvas,0,0,this.tile,this.tile);
      const data=sc.getImageData(0,0,this.tile,this.tile).data;let x=this.tile,y=this.tile,right=-1,bottom=-1;
      for(let j=0;j<this.tile;j++)for(let i=0;i<this.tile;i++)if(data[(j*this.tile+i)*4+3]){x=Math.min(x,i);y=Math.min(y,j);right=Math.max(right,i);bottom=Math.max(bottom,j);}
      if(right<0)continue;
      const image=document.createElement('canvas');image.width=right-x+1;image.height=bottom-y+1;
      image.getContext('2d').drawImage(scaled,x,y,image.width,image.height,0,0,image.width,image.height);
      base.push({owner:layer.owner,image,x,y});
     }
     e.base=base;canvas.width=canvas.height=scaled.width=scaled.height=0;
     e.checkpoint=checkpoint;e.loading=null;this.repaint(id,e.paints);
    }).catch(error=>{if(this.disposed||e.loading!==checkpoint)return;e.loading=null;console.warn('3D paint checkpoint',error);if(++e.failures<=1)setTimeout(()=>{if(!this.disposed&&e.paints?.[0]?.checkpoint===checkpoint)this.repaint(id,e.paints);},500);});
   }
   // Keep the last displayed tile during asynchronous checkpoint loading.
   if(!e.initialized){this.ctx.fillStyle=e.stroke.color;this.ctx.fillRect(e.x,e.y,this.tile,this.tile);this.texture.needsUpdate=true;e.initialized=true;}
   return;
  }
  this.ink.clearRect(0,0,this.tile,this.tile);
  if(!checkpoint){e.base=null;e.checkpoint=null;e.loading=null;}
  const records=[...(checkpoint&&e.base?e.base:[]),...paints.filter(p=>!isSurfaceCheckpoint(p))];
  paintOwnerStrokes(this.ink,records,(ctx,paint,mode)=>{
   if(paint.image){ctx.save();ctx.globalCompositeOperation=mode;ctx.drawImage(paint.image,paint.x,paint.y);ctx.restore();}
   else this.drawInk(paint,e.info,ctx,mode);
  });
  this.ctx.fillStyle=e.stroke.color;this.ctx.fillRect(e.x,e.y,this.tile,this.tile);
  this.ctx.drawImage(this.scratch,e.x,e.y);this.texture.needsUpdate=true;e.initialized=true;
 }
 dispose(){this.disposed=true;this.entries.clear();this.mesh.material=this.originalMaterial;this.material.dispose();this.texture.dispose();}
}
