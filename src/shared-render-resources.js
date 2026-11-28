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
