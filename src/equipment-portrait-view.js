import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {orientPortraitModel} from './equipment-portrait.js';

// A separate persistent WebGL viewport avoids reading the live arena's
// render-target mid-frame and cannot leave a broken <img> with missing src.
export class EquipmentPortraitViewport{
 constructor(){
  this.canvas=null;this.renderer=null;this.scene=null;this.camera=null;
  this.model=null;this.signature='';this.drawCount=0;this.error=null;
 }
 close(){
  if(this.model){
   this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose?.();});
   this.model.removeFromParent();
  }
  this.model=null;
  this.renderer?.dispose();
  this.renderer?.forceContextLoss();
  this.renderer=null;this.scene=null;this.camera=null;this.canvas=null;
  this.signature='';this.error=null;
 }
 build(root){
  if(this.model){
   this.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose?.();});
   this.model.removeFromParent();
  }
  const source=root?.userData?.model;
  if(!source)throw new Error('EQUIP has no character model');
  const model=clone(source);
  model.visible=true;
  model.position.set(0,0,0);
  model.traverse(o=>{if(o.isMesh||o.isSkinnedMesh)o.visible=true;});
  model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});
  model.traverse(bone=>{
   if(!bone.isBone)return;
   const name=bone.name.toLowerCase().replace(/[^a-z]/g,'');
   if(/leftarm$/.test(name))bone.rotation.z+=.50;
   if(/rightarm$/.test(name))bone.rotation.z-=.50;
  });
  // Temporarily detach cloned wings before portrait orientation: the
  // original fallback must not select a horizontal axis because of wings.
  const wings=[];
  model.traverse(o=>{if(o.userData?.wingId&&o.parent)wings.push({root:o,parent:o.parent});});
  for(const wing of wings)wing.root.removeFromParent();
  orientPortraitModel(model);
  // The actual Temple avatar's anatomical 'front' lies on the sideways
  // imported model's world +X, unlike the generic Mixamo landmark fallback.
  // Rotate around WORLD Y to put its face toward the portrait's +Z camera.
  model.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(
   new THREE.Vector3(0,1,0),-Math.PI/2));
  model.updateMatrixWorld(true);
  const bodyBounds=new THREE.Box3().setFromObject(model,true);
  const bodySize=bodyBounds.getSize(new THREE.Vector3());
  // Restore wing meshes, but shrink only their width when they exceed the
  // visible front-facing portrait. The model quaternion never changes here.
  for(const wing of wings)wing.parent.add(wing.root);
  const aspect=(this.canvas?.clientWidth||180)/(this.canvas?.clientHeight||320);
  const maxWidth=Math.max(bodySize.x*1.15,bodySize.y*aspect*.83);
  for(let attempt=0;attempt<7&&wings.length;attempt++){
   model.updateMatrixWorld(true);
   const width=new THREE.Box3().setFromObject(model,true).getSize(new THREE.Vector3()).x;
   if(width<=maxWidth*1.005)break;
   const reduction=Math.max(.30,Math.min(.95,maxWidth/Math.max(width,.00001)));
   for(const wing of wings)wing.root.scale.multiplyScalar(reduction);
  }
  this.scene.add(model);
  this.model=model;
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model,true);
  if(bounds.isEmpty())throw new Error('EQUIP avatar has no visible 3D bounds');
  const size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  this.camera=new THREE.PerspectiveCamera(28,1,.01,10000);
  this.camera.up.set(0,1,0);
  this.focus={center,size};
 }
 draw(){
  if(!this.renderer||!this.model||!this.canvas?.isConnected)return;
  const width=Math.max(128,Math.round(this.canvas.clientWidth||180));
  const height=Math.max(160,Math.round(this.canvas.clientHeight||320));
  this.renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));
  this.renderer.setSize(width,height,false);
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
  this.renderer.render(this.scene,this.camera);
  this.drawCount++;
 }
 sync(canvas,root,signature=''){
  if(!canvas||!root)return;
  if(canvas!==this.canvas||!this.renderer){
   this.close();this.canvas=canvas;
   this.renderer=new THREE.WebGLRenderer({
    canvas,alpha:true,antialias:true,powerPreference:'low-power',
    preserveDrawingBuffer:true
   });
   this.renderer.setClearColor(0x000000,0);
   this.renderer.outputColorSpace=THREE.SRGBColorSpace;
   this.renderer.toneMapping=THREE.NoToneMapping;
   this.scene=new THREE.Scene();
   const light=new THREE.DirectionalLight(0xffffff,3);
   light.position.set(2,4,6);
   const fill=new THREE.DirectionalLight(0xc7daff,1.2);
   fill.position.set(-3,1,-2);
   this.scene.add(new THREE.HemisphereLight(0xffffff,0x89779c,2.7),light,fill);
   this.signature='';
  }
  const width=Math.max(128,Math.round(canvas.clientWidth||180));
  const height=Math.max(160,Math.round(canvas.clientHeight||320));
  if(this.signature!==signature||!this.model){
   this.build(root);this.signature=signature;this.lastWidth=0;this.lastHeight=0;
  }
  if(this.lastWidth!==width||this.lastHeight!==height){
   this.draw();this.lastWidth=width;this.lastHeight=height;
  }
 }
}
