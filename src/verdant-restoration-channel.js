// Byte-identical official 00GameDevs Verdant Restoration VFX.
// The effect is positioned at the caster's FEET and recycled on successive
// authenticated channel pulses. No replacement particle art or hit collider.
import * as THREE from 'three';
import verdantRestoration from '../vendor/00gamedevs/source/verdant-restoration.js';

export const RESTORATION_GROUND_SIZE=.42;
export class VerdantRestorationChannel {
 constructor(scene){this.scene=scene;this.live=new Map();this.pool=[];this.failed=false;this.tmp=new THREE.Vector3();}
 make(){
  const fx=verdantRestoration({size:RESTORATION_GROUND_SIZE,speed:1});
  fx.group.name='00GameDevs original Verdant Restoration · flower crown';
  fx.group.userData.vfxSource='00GameDevs';
  fx.group.userData.vfxId='verdant-restoration';
  fx.group.visible=false;
  return fx;
 }
 async warm(renderer,camera){
  // First native textures, shaders and buffers are created during Loading.
  const fx=this.make(),stage=new THREE.Scene(),target=new THREE.WebGLRenderTarget(32,32);
  const previous=renderer.getRenderTarget();
  try{
   fx.group.visible=true;stage.add(fx.group);
   fx.update(.016);fx.prepareRender?.(camera);
   await renderer.compileAsync(stage,camera);
   renderer.setRenderTarget(target);
   renderer.render(stage,camera);
   renderer.setRenderTarget(previous);
   fx.group.visible=false;fx.reset();fx.group.removeFromParent();
   this.pool.push(fx);
  }finally{
   renderer.setRenderTarget(previous);target.dispose();
   if(fx.group.parent===stage)fx.group.removeFromParent();
   if(!this.pool.includes(fx))fx.dispose();
  }
 }
 pulse(root){
  if(!root?.parent||this.failed)return;
  const current=this.live.get(root);
  if(current){
   current.lastPulse=performance.now();
   if(current.stopping){current.fx.reset();current.stopping=false;}
   return;
  }
  try{
   const fx=this.pool.pop()||this.make();
   fx.reset();fx.group.visible=true;
   this.scene.add(fx.group);
   this.live.set(root,{root,fx,lastPulse:performance.now(),stopping:false,stopAt:Infinity});
  }catch(error){this.failed=true;console.error('Original Verdant Restoration failed to start',error);}
 }
 stop(root){
  const entry=this.live.get(root);
  if(entry&&!entry.stopping){
   entry.stopping=true;entry.stopAt=performance.now()+1100;
   entry.fx.stop();
  }
 }
 update(dt,camera){
  const now=performance.now();
  for(const [root,e] of [...this.live]){
   try{
    if(!root.parent||now-e.lastPulse>1800)this.stop(root);
    root.getWorldPosition(this.tmp);
    e.fx.group.position.set(this.tmp.x,this.tmp.y+.035,this.tmp.z);
    // Exact native emitter is restricted to a human-sized footprint.
    e.fx.group.scale.setScalar(RESTORATION_GROUND_SIZE);
    e.fx.update(dt);
    if(camera)e.fx.prepareRender?.(camera);
    if(!e.stopping&&e.fx.finished)e.fx.reset();
    if(e.stopping&&(e.fx.finished||now>e.stopAt))this.release(root,e);
   }catch(error){
    this.live.delete(root);e.fx.group.removeFromParent();e.fx.dispose();
    this.failed=true;console.error('Original Verdant Restoration VFX error',error);
   }
  }
 }
 release(root,entry){
  this.live.delete(root);entry.fx.group.removeFromParent();
  entry.fx.group.visible=false;
  if(this.pool.length<2){entry.fx.reset();this.pool.push(entry.fx);}
  else entry.fx.dispose();
 }
 dispose(){
  for(const [root,entry] of [...this.live]){
   this.live.delete(root);entry.fx.group.removeFromParent();entry.fx.dispose();
  }
  for(const fx of this.pool){fx.group.removeFromParent();fx.dispose();}
  this.pool.length=0;
 }
}
