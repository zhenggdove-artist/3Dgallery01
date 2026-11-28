import * as THREE from 'three';
import {outfitTextureResources,wearableResourceSnapshot} from './shared-render-resources.js';
// Keep a guard band and the full native bounding sphere. Never retire any
// resource that could be drawn by the current camera. Retirement distance
// is independent of the actual camera far plane: large fog distances must not
// pin every offscreen artwork/paint texture in GPU memory.
const sphere=new THREE.Sphere(),matrix=new THREE.Matrix4(),frustum=new THREE.Frustum(),eye=new THREE.Vector3();
const view={frustum,eye,distance:0};
export function residencyView(camera,retirementDistance=Infinity){
 camera.updateWorldMatrix(true,false);
 frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 eye.setFromMatrixPosition(camera.matrixWorld);view.distance=Math.min(camera.far,retirementDistance);return view;
}
export function farMesh(mesh,v,margin=12){
 const g=mesh.geometry;if(!g)return false;
 if(!g.boundingSphere)g.computeBoundingSphere();
 if(!g.boundingSphere||!Number.isFinite(g.boundingSphere.radius))return false;
 mesh.updateWorldMatrix(true,false);sphere.copy(g.boundingSphere).applyMatrix4(mesh.matrixWorld);
 if(!Number.isFinite(sphere.radius)||mesh.frustumCulled===false||sphere.center.distanceToSquared(v.eye)<=(v.distance+margin+sphere.radius)**2)return false;
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
  this.accountNodeLimit=mobile?48:96;this.accounting=null;this.accountedNodes=0;this.sceneSnapshot=null;
  this.beginFrame();
 }
 beginFrame(){this.frameRetires=0;this.frameMaintenanceMs=0;}
 retire(kind,dispose){
  if(this.frameRetires>=this.retireLimit||this.frameMaintenanceMs>=this.maintenanceMs)return false;
  const t=performance.now();try{dispose();}finally{this.frameMaintenanceMs+=performance.now()-t;this.frameRetires++;}
  this.counts[kind]=(this.counts[kind]||0)+1;return true;
 }
 recordWake(kind){this.wakes[kind]=(this.wakes[kind]||0)+1;}
 sweepPools(groups,now,scene=null){
  const candidates=[];let idle=0,reserved=0;
  for(const g of groups){
   idle+=g.list.length;reserved+=Math.min(g.keep,g.list.length);
   for(let i=0;i<g.list.length;i++){
    const e=g.list[i],root=g.root(e);
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
  this.poolSnapshot={...this.poolSnapshot,idle:idle-retired,reserved,surplus:Math.max(0,idle-reserved-retired),eligible:Math.max(0,candidates.length-retired)};
  if(!this.accounting){const roots=[];for(const g of groups)for(const e of g.list){const root=g.root(e);if(root&&!root.parent)roots.push(root);}this.accounting={stack:roots,seen:new WeakSet(),bytes:0,nodes:0,scene,phase:'pools',textures:new WeakSet(),textureCount:0,textureBytes:0};}
  return retired;
 }
 // Incremental observational accounting. Never traverses an entire scene in one call;
 // active effects and owner-specific disposal remain authoritative.
 advanceAccounting(){
  const a=this.accounting;if(!a)return 0;
  const available=Math.min(this.maintenanceMs-this.frameMaintenanceMs,.5);if(available<=0)return 0;
  const start=performance.now();let n=0;
  const add=attribute=>{const b=attribute?.buffer;if(b&&!a.seen.has(b)){a.seen.add(b);a.bytes+=b.byteLength;}};
  while(a.stack.length&&n<this.accountNodeLimit&&performance.now()-start<available){
   const o=a.stack.pop();if(!o)continue;n++;const g=o.geometry;
   if(g){add(g.index?.array);for(const attr of Object.values(g.attributes||{}))add(attr.array||attr.data?.array);}
   add(o.instanceMatrix?.array);add(o.instanceColor?.array);
   if(a.phase==='scene')for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){
    for(const value of Object.values(m))if(value?.isTexture)accountTexture(a,value);
    for(const uniform of Object.values(m.uniforms||{}))if(uniform?.value?.isTexture)accountTexture(a,uniform.value);
   }
   for(const child of o.children||[])a.stack.push(child);
  }
  a.nodes+=n;this.frameMaintenanceMs+=performance.now()-start;
  if(!a.stack.length){
   if(a.phase==='pools'){this.poolSnapshot.estimatedBufferBytes=a.bytes;this.accountedNodes=a.nodes;if(a.scene){a.stack=[a.scene];a.phase='scene';a.seen=new WeakSet();a.bytes=0;a.nodes=0;}else this.accounting=null;}
   else{this.sceneSnapshot={nodes:a.nodes,estimatedGeometryBytes:a.bytes,textureCount:a.textureCount,estimatedTextureBytes:a.textureBytes};this.accounting=null;}
  }
  return n;
 }
 snapshot(){return {retired:{...this.counts},wakes:{...this.wakes},pools:{...this.poolSnapshot,accountingPending:!!this.accounting,accountedNodes:this.accountedNodes},sharedOutfitTextures:outfitTextureResources.snapshot(),wearables:wearableResourceSnapshot(),scene:this.sceneSnapshot};}
}

// Estimate logical texture payload, not WebKit process memory or actual GPU allocation.
// Includes mip overhead for common formats; unknown/compressed layouts are not inferred.
function accountTexture(a,t){
 if(a.textures.has(t))return;a.textures.add(t);a.textureCount++;
 const image=t.image,w=image?.videoWidth||image?.width||0,h=image?.videoHeight||image?.height||0;
 if(!w||!h)return;
 const channels=t.format===THREE.RedFormat||t.format===THREE.RedIntegerFormat?1:t.format===THREE.RGFormat||t.format===THREE.RGIntegerFormat?2:4;
 const unit=t.type===THREE.FloatType?4:t.type===THREE.HalfFloatType?2:1;
 a.textureBytes+=Math.ceil(w*h*channels*unit*(t.generateMipmaps?4/3:1));
}
