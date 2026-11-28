// Shared immutable render assets, with explicit ownership and final-release disposal.
// Never share mutable materials, per-instance geometry, or live video/canvas surfaces.
export class SharedRenderResources{
 constructor(){this.entries=new Map();this.refs=0;}
 acquire(key,create,dispose,bytes=()=>0){
  let entry=this.entries.get(key);
  if(!entry){const value=create();entry={value,dispose,bytes:Math.max(0,Number(bytes(value))||0),refs:0};this.entries.set(key,entry);}
  entry.refs++;this.refs++;return entry.value;
 }
 release(key,value){
  const e=this.entries.get(key);if(!e||e.value!==value||e.refs<=0)return false;
  e.refs--;this.refs--;if(e.refs===0){this.entries.delete(key);e.dispose(e.value);}return true;
 }
 snapshot(){let bytes=0;for(const e of this.entries.values())bytes+=e.bytes;return {entries:this.entries.size,references:this.refs,estimatedPixelBytes:bytes};}
}
export const outfitTextureResources=new SharedRenderResources();
export function disposeOutfitTexture(t){t.dispose();if(t.isCanvasTexture&&t.image)t.image.width=t.image.height=0;}
export function acquireOutfitTexture(key,create){return outfitTextureResources.acquire(key,create,disposeOutfitTexture,t=>(t.image?.width||0)*(t.image?.height||0)*4);}
export function releaseOutfitTexture(key,t){return outfitTextureResources.release(key,t);}

// One ownership contract for headwear, outfits, their nested headpieces and previews.
// Weak keys never retain an abandoned model; counts are diagnostic, not an eviction policy.
const wearableOwners=new WeakMap();
const wearableCounts={head:{active:0,created:0,released:0},outfit:{active:0,created:0,released:0}};
export function registerWearable(owner,kind){
 if(!owner||!wearableCounts[kind])throw Error('Invalid wearable owner');
 if(wearableOwners.has(owner))throw Error('Wearable registered twice');
 wearableOwners.set(owner,{kind,released:false});wearableCounts[kind].active++;wearableCounts[kind].created++;return owner;
}
export function isManagedHeadwear(owner){return wearableOwners.get(owner)?.kind==='head';}
export function releaseWearable(owner,cleanup){
 if(!owner)return false;
 let state=wearableOwners.get(owner);
 if(state?.released)return false;
 if(!state){state={kind:null,released:false};wearableOwners.set(owner,state);}
 state.released=true;
 try{cleanup();}finally{if(state.kind){const c=wearableCounts[state.kind];c.active--;c.released++;}}
 return true;
}
export function wearableResourceSnapshot(){return {head:{...wearableCounts.head},outfit:{...wearableCounts.outfit}};}
export function wearableMaterial(T,materials,color,roughness,metalness){
 const material=new T.MeshStandardMaterial({color,roughness,metalness});materials.push(material);return material;
}
// Only call for owned wearable roots, never the borrowed avatar/portrait clone.
// Explicit extra materials include unused builder materials and skinned replacements.
export function disposeWearableParts(roots,materials=[],geometries=[]){
 const mats=new Set(materials),geo=new Set(geometries),instances=new Set();
 for(const root of roots){root.traverse(o=>{
  if(o.isInstancedMesh)instances.add(o);if(o.geometry)geo.add(o.geometry);
  for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])mats.add(m);
 });root.removeFromParent();}
 for(const instance of instances)instance.dispose();
 for(const g of geo)g.dispose();
 for(const m of mats)m.dispose();
}

// Root leases extend the same shared registry to wings and pickup sprites.
// Keep ownership out of userData: Three clones/serializes that object.
const rootTextureLeases=new WeakMap();
export function acquireRootTexture(root,key,create,dispose=disposeOutfitTexture){
 const texture=outfitTextureResources.acquire(key,create,dispose,t=>(t.image?.width||0)*(t.image?.height||0)*4);
 texture.userData.sharedGarden=true;
 let leases=rootTextureLeases.get(root);if(!leases){leases=[];rootTextureLeases.set(root,leases);}
 leases.push({key,texture});return texture;
}
export function releaseRootTextures(root){
 const leases=rootTextureLeases.get(root);if(!leases)return false;
 rootTextureLeases.delete(root);for(const {key,texture} of leases)outfitTextureResources.release(key,texture);return true;
}
// All visual inputs are part of the key, including custom drawing revisions.
export function wingRenderKey(item){return 'wing:'+JSON.stringify([item.id,item.design,item.updatedAt,item.createdAt,item.tier,item.color,item.accent,item.style,item.motif,item.specimen,item.patternVariant,item.visualComplexity,item.outline,item.contours,item.strokes,item.shape,item.scaleX,item.scaleY,item.offsetX,item.offsetY,item.shapes,item.layers]);}

// Runtime ownership metadata must not be serialized by Object3D.clone().
// Three's userData JSON clone otherwise serializes material/texture images
// (including PNG data URLs) while constructing the equipment portrait.
export function runtimeResource(owner,key,value){Object.defineProperty(owner.userData,key,{value,writable:true,configurable:true,enumerable:false});return value;}
