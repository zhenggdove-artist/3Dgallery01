import * as THREE from 'three';
// Keep a guard band and the full native bounding sphere. Never retire any
// resource that could be drawn by the current camera.
const sphere=new THREE.Sphere(),matrix=new THREE.Matrix4(),frustum=new THREE.Frustum(),eye=new THREE.Vector3();
const view={frustum,eye,distance:0};
export function residencyView(camera){
 camera.updateWorldMatrix(true,false);
 frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 eye.setFromMatrixPosition(camera.matrixWorld);view.distance=camera.far;return view;
}
export function farMesh(mesh,v,margin=12){
 const g=mesh.geometry;if(!g)return false;
 if(!g.boundingSphere)g.computeBoundingSphere();
 if(!g.boundingSphere||!Number.isFinite(g.boundingSphere.radius))return false;
 mesh.updateWorldMatrix(true,false);sphere.copy(g.boundingSphere).applyMatrix4(mesh.matrixWorld);
 if(!Number.isFinite(sphere.radius)||sphere.center.distanceToSquared(v.eye)<=(v.distance+margin+sphere.radius)**2)return false;
 sphere.radius+=margin;return !v.frustum.intersectsSphere(sphere);
}
export function updateResidency(state,far,now,suspend,resume,allowSuspend=true,manager=null,kind='scene'){
 if(!far){state.farSince=null;if(state.dormant){resume();state.dormant=false;manager?.recordWake(kind);}return false;}
 if(state.farSince==null)state.farSince=now;
 if(!state.dormant&&allowSuspend&&now-state.farSince>=15000){if(manager&&!manager.retire(kind,suspend))return false;if(!manager)suspend();state.dormant=true;return true;}
 return false;
}
// Lossless per-tile packing: solid tiles need only one word. Preserve
// all four RGBA bytes, even unused tiles and transparent pixel channels.
export function packTile(pixels,side,tile,x,y){
 const words=new Uint32Array(pixels.buffer,pixels.byteOffset,pixels.byteLength/4),first=words[y*side+x];
 let solid=true;
 for(let row=0;row<tile&&solid;row++)for(let col=0;col<tile;col++)if(words[(y+row)*side+x+col]!==first){solid=false;break;}
 if(solid)return first;
 const data=new Uint32Array(tile*tile);
 for(let row=0;row<tile;row++)data.set(words.subarray((y+row)*side+x,(y+row)*side+x+tile),row*tile);
 return data;
}
export function unpackTile(packed,pixels,side,tile,x,y){
 const words=new Uint32Array(pixels.buffer,pixels.byteOffset,pixels.byteLength/4);
 for(let row=0;row<tile;row++){const start=(y+row)*side+x;if(typeof packed==='number')words.fill(packed,start,start+tile);else words.set(packed.subarray(row*tile,(row+1)*tile),start);}
}
export function packAtlas(pixels,side,tile){
 const result=[];for(let y=0;y<side;y+=tile)for(let x=0;x<side;x+=tile)result.push(packTile(pixels,side,tile,x,y));return result;
}
export function unpackAtlas(packed,side,tile){
 const pixels=new Uint8Array(side*side*4),grid=side/tile;
 for(let i=0;i<packed.length;i++)unpackTile(packed[i],pixels,side,tile,(i%grid)*tile,Math.floor(i/grid)*tile);return pixels;
}

/** Unified memory maintenance. No visual, active-effect, or frame-rate caps.
 * Owner-specific disposers and warmed reserves remain authoritative.
 */
export class RenderMemoryManager{
 constructor({mobile=false}={}){
  this.retireLimit=mobile?2:4;this.maintenanceMs=mobile?1.5:3;
  this.counts=Object.create(null);this.wakes=Object.create(null);
  this.poolSnapshot={idle:0,reserved:0,surplus:0,eligible:0,estimatedBufferBytes:0};
  this.beginFrame();
 }
 beginFrame(){this.frameRetires=0;this.frameMaintenanceMs=0;}
 retire(kind,dispose){
  if(this.frameRetires>=this.retireLimit||this.frameMaintenanceMs>=this.maintenanceMs)return false;
  const t=performance.now();try{dispose();}finally{this.frameMaintenanceMs+=performance.now()-t;this.frameRetires++;}
  this.counts[kind]=(this.counts[kind]||0)+1;return true;
 }
 recordWake(kind){this.wakes[kind]=(this.wakes[kind]||0)+1;}
 sweepPools(groups,now){
  const candidates=[],seen=new Set();let idle=0,reserved=0,bytes=0;
  const addArray=a=>{const b=a?.buffer;if(b&&!seen.has(b)){seen.add(b);bytes+=b.byteLength;}};
  for(const g of groups){
   idle+=g.list.length;reserved+=Math.min(g.keep,g.list.length);
   for(let i=0;i<g.list.length;i++){
    const e=g.list[i],root=g.root(e);
    root?.traverse(o=>{const geom=o.geometry;if(geom){addArray(geom.index?.array);for(const a of Object.values(geom.attributes||{}))addArray(a.array||a.data?.array);}addArray(o.instanceMatrix?.array);addArray(o.instanceColor?.array);});
    if(i<g.keep||root?.parent)continue;
    const since=g.since(e);if(Number.isFinite(since)&&now-since>=g.idleMs)candidates.push({g,e,since});
   }
  }
  candidates.sort((a,b)=>a.since-b.since);
  let retired=0;
  for(const {g,e} of candidates){
   if(retired>=this.retireLimit)break;
   const i=g.list.indexOf(e);if(i<g.keep||g.root(e)?.parent)continue;
   if(!this.retire(g.kind,()=>{g.list.splice(i,1);g.dispose(e);}))break;
   retired++;
  }
  this.poolSnapshot={idle:idle-retired,reserved,surplus:Math.max(0,idle-reserved-retired),eligible:Math.max(0,candidates.length-retired),estimatedBufferBytes:bytes};
  return retired;
 }
 snapshot(){return {retired:{...this.counts},wakes:{...this.wakes},pools:{...this.poolSnapshot}};}
}
