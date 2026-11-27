import {surfaceInfo} from './space-paint-surface.js';
// Checkpoints preserve the maximum existing atlas tile resolution (256).
// A single immutable RGBA tile, encoded with lossless run-length compression
// when smaller than raw pixels, replaces an arbitrarily long stroke log.
export const RASTER_TILE=256,RASTER_BYTES=RASTER_TILE*RASTER_TILE*4;
export const SURFACE_TAIL_BYTES=2400;
export const checkpointId=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
export const isSurfaceCheckpoint=v=>!!v&&checkpointId(v.checkpoint);
export function surfaceChartRect(tile,chart){
 const h=Math.floor(tile*.62),half=Math.floor(tile/2);
 return chart===0?{x:2,y:2,w:tile-4,h:h-4}:{x:(chart===1?0:half)+2,y:h+2,w:half-4,h:tile-h-4};
}
export function encodeSurfaceRaster(pixels){
 if(pixels.byteLength!==RASTER_BYTES)throw Error('Invalid surface raster size');
 const source=new Uint8Array(pixels.buffer,pixels.byteOffset,pixels.byteLength);
 const packed=new Uint8Array(RASTER_BYTES+1);packed[0]=1;let offset=1;
 for(let i=0;i<source.length;){
  let run=1;while(run<65535&&i+run*4<source.length&&source[i]===source[i+run*4]&&source[i+1]===source[i+run*4+1]&&source[i+2]===source[i+run*4+2]&&source[i+3]===source[i+run*4+3])run++;
  if(offset+6>=packed.length){const raw=new Uint8Array(RASTER_BYTES+1);raw.set(source,1);return raw;}
  packed[offset++]=run&255;packed[offset++]=run>>8;
  packed.set(source.subarray(i,i+4),offset);offset+=4;i+=run*4;
 }
 return packed.slice(0,offset);
}
export function decodeSurfaceRaster(data){
 const src=data instanceof Uint8Array?data:new Uint8Array(data),out=new Uint8ClampedArray(RASTER_BYTES);
 if(src[0]===0&&src.length===RASTER_BYTES+1){out.set(src.subarray(1));return out;}
 if(src[0]!==1||src.length>RASTER_BYTES+1||(src.length-1)%6)throw Error('Invalid surface raster encoding');
 let at=0;for(let i=1;i<src.length;i+=6){
  const run=src[i]+256*src[i+1],end=at+run*4;if(!run||end>out.length)throw Error('Invalid surface raster run');
  const rgba=src.subarray(i+2,i+6);while(at<end){out.set(rgba,at);at+=4;}
 }
 if(at!==out.length)throw Error('Incomplete surface raster');return out;
}
// Match the existing elliptical brush, shortest seam path and chart clipping.
// Analytic capsule coverage bounds work by the tile area and input point count,
// not by the number of strokes ever made. Coverage is antialiased per pixel.
export function rasterizeSurfaceStroke(pixels,paint,info){
 const r=surfaceChartRect(RASTER_TILE,paint.chart),side=paint.chart===0;
 const rx=Math.max(.5,paint.size*r.w/Math.max(.001,side?info.total:2*info.a));
 const ry=Math.max(.5,paint.size*r.h/Math.max(.001,side?info.circumference:2*info.b));
 const color=parseInt(paint.color.slice(1),16),red=color>>16,green=color>>8&255,blue=color&255;
 const coverage=new Uint8Array(RASTER_TILE*RASTER_TILE);
 let minX=RASTER_TILE,minY=RASTER_TILE,maxX=-1,maxY=-1;
 function segment(a,b,shift){
  const ax=r.x+a[0]*r.w,ay=r.y+(a[1]+shift)*r.h,bx=r.x+b[0]*r.w,by=r.y+(b[1]+shift)*r.h;
  const x0=Math.max(r.x-1,Math.floor(Math.min(ax,bx)-rx-1)),x1=Math.min(r.x+r.w,Math.ceil(Math.max(ax,bx)+rx+1));
  const y0=Math.max(r.y-1,Math.floor(Math.min(ay,by)-ry-1)),y1=Math.min(r.y+r.h,Math.ceil(Math.max(ay,by)+ry+1));
  if(x0>x1||y0>y1)return;
  minX=Math.min(minX,x0);maxX=Math.max(maxX,x1);minY=Math.min(minY,y0);maxY=Math.max(maxY,y1);
  const dx=(bx-ax)/rx,dy=(by-ay)/ry,den=dx*dx+dy*dy,edge=Math.min(rx,ry);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const i=y*RASTER_TILE+x;if(coverage[i]===255)continue;
   const px=(x+.5-ax)/rx,py=(y+.5-ay)/ry,t=den?Math.max(0,Math.min(1,(px*dx+py*dy)/den)):0;
   const c=Math.max(0,Math.min(255,Math.round((.5+(1-Math.hypot(px-t*dx,py-t*dy))*edge)*255)));
   if(c>coverage[i])coverage[i]=c;
  }
 }
 let previous=null;for(const p of paint.points){
  let a=previous||p,b=p;
  if(side&&previous){let d=p[1]-a[1];d-=Math.round(d);b=[p[0],a[1]+d];}
  for(const shift of side?[-1,0,1]:[0])segment(a,b,shift);
  previous=p;
 }
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  const j=y*RASTER_TILE+x,c=coverage[j];if(!c)continue;
  const i=j*4,alpha=pixels[i+3],a=c/255;
  if(paint.tool==='eraser'){pixels[i+3]=Math.round(alpha*(1-a));if(!pixels[i+3])pixels.fill(0,i,i+4);continue;}
  const old=alpha*(1-a),next=c+old;
  pixels[i]=Math.round((red*c+pixels[i]*old)/next);pixels[i+1]=Math.round((green*c+pixels[i+1]*old)/next);pixels[i+2]=Math.round((blue*c+pixels[i+2]*old)/next);pixels[i+3]=Math.round(next);
 }
 return pixels;
}
export function surfaceTailSize(records){return JSON.stringify(records.filter(v=>!isSurfaceCheckpoint(v))).length;}
export function compactSurfaceRecords(stroke,records,priorBytes,newId){
 const pixels=priorBytes?decodeSurfaceRaster(priorBytes):new Uint8ClampedArray(RASTER_BYTES),info=surfaceInfo(stroke);
 for(const paint of records)if(!isSurfaceCheckpoint(paint))rasterizeSurfaceStroke(pixels,paint,info);
 return {records:[{checkpoint:newId,chart:0,tool:'eraser',size:.04,color:'#000000',points:[]}],bytes:encodeSurfaceRaster(pixels)};
}
