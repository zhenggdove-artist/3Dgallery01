import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {orientPortraitModel} from './equipment-portrait.js';

function copyPortraitPart(source){
 if(source.isPoints||source.isSprite)return null;
 // No live userData, particles, animation objects or texture JSON are
 // copied. Keep the real meshes and share their immutable render assets.
 const target=source.isInstancedMesh?source.clone(false):source.isMesh?
  new THREE.Mesh(source.geometry,source.material):new THREE.Group();
 target.position.copy(source.position);target.quaternion.copy(source.quaternion);target.scale.copy(source.scale);
 target.name=source.name;target.visible=source.visible;target.renderOrder=source.renderOrder;
 if(source.userData.wingId)target.userData.wingId=source.userData.wingId;
 for(const child of source.children){const copy=copyPortraitPart(child);if(copy)target.add(copy);}
 return target;
}

// A separate persistent WebGL viewport avoids reading the live arena's
// render-target mid-frame and cannot leave a broken <img> with missing src.
export class EquipmentPortraitViewport{
 constructor(){
  this.canvas=null;this.renderer=null;this.scene=null;this.camera=null;
  this.model=null;this.signature='';this.drawCount=0;this.error=null;
  this.paintRevision=0;
 }
 close(){
  if(this.model){
   this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose?.();});
   this.model.removeFromParent();
  }
  this.model=null;this.source=null;this.paintRevision++;
  this.renderer?.dispose();
  this.renderer?.forceContextLoss();
  this.renderer=null;this.scene=null;this.camera=null;this.canvas=null;
  this.signature='';this.error=null;
 }
 build(root){
  const data=root?.userData,source=data?.model;
  if(!source)throw new Error('EQUIP has no character model');
  if(this.source!==source||!this.model){
   if(this.model){this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose?.();});this.model.removeFromParent();}
   const model=clone(source),removed=[];
   model.visible=true;model.position.set(0,0,0);
   this.anchors=new Map();this.attachments=new Map();
   model.traverse(o=>{
    if(o.isPoints||o.isSprite||o.userData.wingId||o.userData.headgear||o.userData.outfit)removed.push(o);
    if(o.isSkinnedMesh)o.skeleton.pose();
    if(o.isBone)this.anchors.set(o.name,o);
   });
   for(const o of removed)o.removeFromParent();
   for(const bone of this.anchors.values()){
    const name=bone.name.toLowerCase().replace(/[^a-z]/g,'');
    if(/leftarm$/.test(name))bone.rotation.z+=.50;
    if(/rightarm$/.test(name))bone.rotation.z-=.50;
   }
   // Bind-pose skinning and anatomical framing run once per avatar.
   model.updateMatrixWorld(true);
   model.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});
   orientPortraitModel(model,{precise:false});
   model.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2));
   this.bodyBounds=new THREE.Box3().setFromObject(model);
   this.model=new THREE.Group();this.model.add(model);this.scene.add(this.model);this.source=source;
  }
  this.updateAttachment('head',data.headgear,data.headgear?[data.headgear]:[]);
  this.updateAttachment('outfit',data.outfit,data.outfit?.parts||[]);
  this.updateAttachment('wings',data.wings,data.wings?[data.wings]:[]);
  const bounds=new THREE.Box3().setFromObject(this.model);
  if(bounds.isEmpty())throw new Error('EQUIP avatar has no visible 3D bounds');
  this.camera??=new THREE.PerspectiveCamera(28,1,.01,10000);
  this.focus={center:bounds.getCenter(new THREE.Vector3()),size:bounds.getSize(new THREE.Vector3())};
 }
 updateAttachment(slot,key,parts){
  const previous=this.attachments.get(slot);
  if(previous?.key===key)return;
  for(const part of previous?.parts||[]){
   part.traverse(o=>{if(o.isInstancedMesh)o.dispose();});part.removeFromParent();
  }
  const nodes=[];
  for(const source of parts){
   const node=copyPortraitPart(source);
   if(!node)continue;
   if(slot==='wings'){
    // Copy the actual sails, never their particle emitter. Anchor in the
    // front-facing portrait frame instead of inheriting the world bone yaw.
    node.position.set(0,0,0);node.quaternion.identity();node.scale.setScalar(1);
    const body=this.bodyBounds,size=new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
    const height=body.max.y-body.min.y,scale=height*.84/Math.max(.00001,size.x);
    node.scale.setScalar(scale);
    node.position.set((body.min.x+body.max.x)*.5,body.min.y+height*.64,body.min.z-size.z*scale*.5);
    this.model.add(node);
   }else{
    const target=this.anchors.get(source.parent?.name);
    if(!target)continue;
    target.add(node);
   }
   nodes.push(node);
  }
  this.attachments.set(slot,{key,parts:nodes});
 }
 async draw(revision){
  if(!this.renderer||!this.model||!this.canvas?.isConnected)return;
  const width=Math.max(128,Math.round(this.canvas.clientWidth||180));
  const height=Math.max(160,Math.round(this.canvas.clientHeight||320));
  const ratio=Math.min(1.5,window.devicePixelRatio||1);
  if(this.renderWidth!==width||this.renderHeight!==height||this.renderer.getPixelRatio()!==ratio){
   if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);
   this.renderer.setSize(width,height,false);this.renderWidth=width;this.renderHeight=height;
  }
  const {center,size}=this.focus;
  this.camera.aspect=width/height;
  this.camera.updateProjectionMatrix();
  const fov=THREE.MathUtils.degToRad(this.camera.fov);
  // Temple's Mixamo bind-pose is extremely small (~0.01 scene units).
  // Never impose a human-height world-unit minimum: it caused 6-pixel dolls.
  const fitH=Math.max(.00001,size.y)*.5/Math.tan(fov*.5);
  const fitW=Math.max(.00001,size.x)*.5/(Math.tan(fov*.5)*(width/height));
  const depth=Math.max(fitH,fitW)*1.33+Math.max(0,size.z*.5);
  this.camera.near=Math.max(.0000001,depth*.002);
  this.camera.far=Math.max(2,depth*100);
  this.camera.updateProjectionMatrix();
  this.camera.position.set(center.x,center.y+size.y*.015,center.z+depth);
  this.camera.lookAt(center);
  const {renderer,scene,camera}=this;
  // Avoid synchronously waiting for a cold wearable shader in the same
  // animation frame as the arena's gear change and UI update.
  await renderer.compileAsync(scene,camera);
  if(revision!==this.paintRevision||!this.canvas?.isConnected)return;
  renderer.render(scene,camera);
  this.drawCount++;
 }
 sync(canvas,root,signature=''){
  if(!canvas||!root)return;
  if(canvas!==this.canvas||!this.renderer){
   this.close();this.canvas=canvas;
   this.renderer=new THREE.WebGLRenderer({
    canvas,alpha:false,antialias:true,powerPreference:'low-power'
   });
   // Opaque neutral backing prevents translucent layered squares/old arena pixels
    // from leaking into a freshly opened EQUIP WebGL canvas.
   this.renderer.setClearColor(0xf5f4f7,1);
   this.renderer.outputColorSpace=THREE.SRGBColorSpace;
   this.renderer.toneMapping=THREE.NoToneMapping;
   this.scene=new THREE.Scene();
   const light=new THREE.DirectionalLight(0xffffff,3);
   light.position.set(2,4,6);
   const fill=new THREE.DirectionalLight(0xc7daff,1.2);
   fill.position.set(-3,1,-2);
   this.scene.add(new THREE.HemisphereLight(0xffffff,0x89779c,2.7),light,fill);
   this.signature='';this.renderWidth=0;this.renderHeight=0;
  }
  const width=Math.max(128,Math.round(canvas.clientWidth||180));
  const height=Math.max(160,Math.round(canvas.clientHeight||320));
  if(this.signature!==signature||!this.model){
   this.build(root);this.signature=signature;this.lastWidth=0;this.lastHeight=0;
  }
  if(this.lastWidth!==width||this.lastHeight!==height){
   this.lastWidth=width;this.lastHeight=height;
   const revision=++this.paintRevision;
   requestAnimationFrame(()=>{
    if(revision!==this.paintRevision)return;
    void this.draw(revision).catch(error=>{
     if(revision!==this.paintRevision)return;
     this.canvas?.setAttribute('data-render-error',error.message);
     console.warn('EQUIP render failed',error);
    });
   });
  }
 }
}
