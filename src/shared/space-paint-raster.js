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
export function rasterizeSurfaceStroke(pixels,paint,info,eraseLayers=null){
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
 if(paint.tool==='eraser'){
  for(const layer of eraseLayers||[pixels])for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
   const j=y*RASTER_TILE+x,c=coverage[j];if(!c)continue;const i=j*4;
   layer[i+3]=Math.round(layer[i+3]*(1-c/255));if(!layer[i+3])layer.fill(0,i,i+4);
  }
  return pixels;
 }
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  const j=y*RASTER_TILE+x,c=coverage[j];if(!c)continue;
  const i=j*4,a=c/255,alpha=pixels[i+3];
  const old=alpha*(1-a),next=c+old;
  pixels[i]=Math.round((red*c+pixels[i]*old)/next);pixels[i+1]=Math.round((green*c+pixels[i+1]*old)/next);pixels[i+2]=Math.round((blue*c+pixels[i+2]*old)/next);pixels[i+3]=Math.round(next);
 }
 return pixels;
}
export function surfaceTailSize(records){return JSON.stringify(records.filter(v=>!isSurfaceCheckpoint(v))).length;}
// Format 2: one binary checkpoint, ordered compressed RGBA runs with owner keys.
// Keeping chronological runs (not sorting whole layers by author) preserves
// overlapping artwork. Format 0/1 remains readable as protected legacy ink.
function layerHeader(data){
 const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
 if(bytes[0]!==2)return {bytes,entries:null,offset:0};
 if(bytes.length<5)throw Error('Invalid owner raster header');
 const length=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(1,true),offset=5+length;
 if(offset>bytes.length)throw Error('Invalid owner raster header');
 const entries=JSON.parse(new TextDecoder().decode(bytes.subarray(5,offset)));
 if(!Array.isArray(entries)||entries.some(v=>!Array.isArray(v)||!(v[0]===null||typeof v[0]==='string')||!Number.isInteger(v[1])||v[1]<1||v[1]>RASTER_BYTES+1)||entries.reduce((n,v)=>n+v[1],offset)!==bytes.length)throw Error('Invalid owner raster layers');
 return {bytes,entries,offset};
}
export function surfaceRasterOwners(data){
 const {entries}=layerHeader(data);return entries?[...new Set(entries.map(v=>v[0]))]:[null];
}
function unpackLayers(data){
 const {bytes,entries,offset}=layerHeader(data);
 if(!entries)return [{owner:null,packed:bytes}];
 let at=offset;return entries.map(([owner,length])=>{const packed=bytes.subarray(at,at+length);at+=length;return {owner,packed};});
}
export function* iterateSurfaceLayers(data){
 for(const layer of unpackLayers(data))yield {owner:layer.owner,pixels:decodeSurfaceRaster(layer.packed)};
}
export function decodeSurfaceLayers(data){return [...iterateSurfaceLayers(data)];}
function packLayers(layers){
 const header=new TextEncoder().encode(JSON.stringify(layers.map(l=>[l.owner,l.packed.length])));
 const out=new Uint8Array(5+header.length+layers.reduce((n,l)=>n+l.packed.length,0));out[0]=2;
 new DataView(out.buffer).setUint32(1,header.length,true);out.set(header,5);
 let at=5+header.length;for(const l of layers){out.set(l.packed,at);at+=l.packed.length;}return out;
}
export function encodeSurfaceLayers(layers){return packLayers(layers.map(l=>({owner:l.owner,packed:encodeSurfaceRaster(l.pixels)})));}
const hasInk=pixels=>{for(let i=3;i<pixels.length;i+=4)if(pixels[i])return true;return false;};
export function compactSurfaceRecords(stroke,records,priorBytes,newId){
 let layers=priorBytes?unpackLayers(priorBytes):[],info=surfaceInfo(stroke),active=null,pixels=null;
 const flush=()=>{if(active){active.packed=encodeSurfaceRaster(pixels);active=null;pixels=null;}};
 for(const paint of records){
  if(isSurfaceCheckpoint(paint))continue;
  const owner=typeof paint.owner==='string'&&paint.owner?paint.owner:null;
  if(paint.tool==='eraser'){
   flush();
   const targets=layers.filter(l=>paint.eraseOwn===true?owner!==null&&l.owner===owner:true);
   if(targets.length){
    // Decode at most one target at a time; never allocate all authors' tiles.
    function* eraseTargets(){for(const l of targets){const p=decodeSurfaceRaster(l.packed);yield p;l.packed=hasInk(p)?encodeSurfaceRaster(p):null;}}
    rasterizeSurfaceStroke(null,paint,info,eraseTargets());layers=layers.filter(l=>l.packed);
   }
   continue;
  }
  if(!active||active.owner!==owner){
   flush();active=layers.at(-1);
   if(!active||active.owner!==owner){active={owner,packed:null};layers.push(active);}
   pixels=active.packed?decodeSurfaceRaster(active.packed):new Uint8ClampedArray(RASTER_BYTES);
  }
  rasterizeSurfaceStroke(pixels,paint,info);
 }
 flush();
 const owners=[...new Set(layers.map(l=>l.owner))];
 return {records:[{checkpoint:newId,owners,chart:0,tool:'eraser',size:.04,color:'#000000',points:[]}],bytes:packLayers(layers)};
}
