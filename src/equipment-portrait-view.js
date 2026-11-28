import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';


// Gameplay player root is Y-up, +Z forward (controller yaw = atan2(x,z)).
// Never reorient the imported skeleton independently of its worn equipment.
function copyPortraitPart(source){
 if(source.isPoints||source.isSprite)return null;
 const target=source.isInstancedMesh?source.clone(false):source.isMesh?
  new THREE.Mesh(source.geometry,source.material):new THREE.Group();
 target.position.copy(source.position);target.quaternion.copy(source.quaternion);target.scale.copy(source.scale);
 target.name=source.name;target.visible=source.visible;target.renderOrder=source.renderOrder;
 if(source.userData.wingId)target.userData.wingId=source.userData.wingId;
 if(source.userData.flightVehicle)target.userData.flightVehicle=source.userData.flightVehicle;
 for(const child of source.children){const copy=copyPortraitPart(child);if(copy)target.add(copy);}
 return target;
}
const findBone=(model,pattern)=>{let bone=null;model.traverse(o=>{if(o.isBone&&pattern.test(o.name))bone=o;});return bone;};
const rootLocal=(root,node)=>root.worldToLocal(node.getWorldPosition(new THREE.Vector3()));
function disposePortraitClone(model){
 model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose?.();if(o.isInstancedMesh)o.dispose();});
 model.removeFromParent();
}
// Outfit props and vehicles are authored in a canonical +Y up / +Z front
// frame. Their world scale is taken from the actual equipped object, while
// their visual frame is explicitly mapped into the paper doll's game axes.
export function placeRigidPortraitPart(node,source,player,portrait,anchorSource,anchorTarget){
 player.updateWorldMatrix(true,true);portrait.updateMatrixWorld(true);
 const matrix=new THREE.Matrix4().multiplyMatrices(player.matrixWorld.clone().invert(),source.matrixWorld);
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 matrix.decompose(position,rotation,scale);
 // Preserve the anatomical attachment point even if the live player was
 // leaning/turning when opening BAG: undo the source prop's local rotation
 // around its attachment point, not around its geometric bounding box.
 if(anchorSource&&anchorTarget){
  const anchor=rootLocal(player,anchorSource);
  const offset=anchor.clone().sub(position).applyQuaternion(rotation.clone().invert());
  position.copy(portrait.worldToLocal(anchorTarget.getWorldPosition(new THREE.Vector3()))).sub(offset);
 }
 node.position.copy(position);node.quaternion.identity();node.scale.copy(scale);
 portrait.add(node);node.updateMatrixWorld(true);
 return node;
}
export function placeWingPortraitPart(node,source,player,portrait,spine,bodyBounds){
 // Standard wings are built in their own upright XY plane. In gameplay
 // they inherit a Mixamo spine bone rotation, which is not a preview frame.
 const matrix=new THREE.Matrix4().multiplyMatrices(player.matrixWorld.clone().invert(),source.matrixWorld);
 const pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(pos,q,scale);
 node.quaternion.identity();node.scale.copy(scale);
 const center=bodyBounds.getCenter(new THREE.Vector3());
 const spinePos=spine?portrait.worldToLocal(spine.getWorldPosition(new THREE.Vector3())):center;
 const depth=bodyBounds.max.z-bodyBounds.min.z;
 node.position.set(spinePos.x,spinePos.y,Math.min(spinePos.z,center.z)-Math.max(.02,depth*.30));
 portrait.add(node);node.updateMatrixWorld(true);return node;
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
   disposePortraitClone(this.model);
  }
  this.model=null;this.source=null;this.player=null;this.anchors?.clear();this.attachments?.clear();this.bodyBounds=null;this.focus=null;this.paintRevision++;
  this.renderer?.dispose();
  if(this.renderer){this.renderer.forceContextLoss();if(this.canvas){this.canvas.dataset.portraitRetired='1';this.canvas.width=1;this.canvas.height=1;}}
  this.renderer=null;this.scene=null;this.camera=null;this.canvas=null;
  this.signature='';this.error=null;
 }
 build(root){
  const data=root?.userData,source=data?.model;
  if(!source)throw new Error('EQUIP has no character model');
  // Rebuild on equipment changes, from the actual equipped pose. Calling
  // skeleton.pose() here previously reset Mixamo bones to a different
  // coordinate frame, rolling or turning the rigid equipment independently.
  if(this.model)disposePortraitClone(this.model);
  root.updateWorldMatrix(true,true);
  const model=clone(source),removed=[];
  this.anchors=new Map();this.attachments=new Map();
  model.traverse(o=>{
   if(o.isPoints||o.isSprite||o.userData.wingId||o.userData.headgear||o.userData.outfit)removed.push(o);
   if(o.isBone)this.anchors.set(o.name,o);
  });
  for(const o of removed){if(o.isInstancedMesh)o.dispose();o.removeFromParent();}
  // Detach from the live player without inheriting its world yaw or location.
  const relative=new THREE.Matrix4().multiplyMatrices(root.matrixWorld.clone().invert(),source.matrixWorld);
  relative.decompose(model.position,model.quaternion,model.scale);
  model.visible=true;
  this.model=new THREE.Group();this.model.add(model);this.scene.add(this.model);
  this.source=source;this.player=root;
  // Sample idle only on the detached clone, without changing game animation.
  // Preserve the model root's authored transform (animation tracks can target
  // it); the clone remains in gameplay's Y-up coordinate system.
  const idle=data.actions?.idle?.getClip?.();
  if(idle){
   const base=data.portraitBase;
   if(base){model.position.copy(base.position);model.quaternion.copy(base.quaternion);model.scale.copy(base.scale);}
   // Do not uncacheRoot/stopAllAction: Three restores the pre-sampled bone
   // values when releasing bindings. This temporary mixer is unreachable
   // after build(), so GC releases it without resetting the idle pose.
   const mixer=new THREE.AnimationMixer(model);mixer.clipAction(idle).play();mixer.setTime(.15);
  }
  model.updateMatrixWorld(true);
  model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox();}});
  this.bodyBounds=new THREE.Box3().setFromObject(model);
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
  const body=this.model.children[0],liveHead=findBone(this.source,/Head$/i),head=findBone(body,/Head$/i);
  const liveHips=findBone(this.source,/Hips$/i),hips=findBone(body,/Hips$/i);
  const spine=findBone(body,/Spine2$/i);
  for(const source of parts){
   const node=copyPortraitPart(source);
   if(!node)continue;
   if(slot==='outfit'&&source.parent===this.source){
    // A disguise is already sculpted in its own canonical frame; attach
    // its actual head aperture to the clone's head, keeping +Z toward camera.
    placeRigidPortraitPart(node,source,this.player,this.model,liveHead,head);
   }else if(slot==='wings'&&source.userData.flightVehicle){
    // Helicopter, zeppelin and bamboo rotor retain their original scale and
    // vertical mount. They are vehicles, not flat wings.
    const overhead=source.userData.flightVehicle==='bamboo-copter';
    placeRigidPortraitPart(node,source,this.player,this.model,overhead?liveHead:liveHips,overhead?head:hips);
   }else if(slot==='wings'){
    placeWingPortraitPart(node,source,this.player,this.model,spine,this.bodyBounds);
   }else{
    const target=source.parent===this.source?body:this.anchors.get(source.parent?.name);
    if(!target){node.traverse(o=>{if(o.isInstancedMesh)o.dispose();});continue;}
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
  this.camera.up.set(0,1,0);
  this.camera.position.set(center.x,center.y,center.z+depth);
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
    canvas,alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'
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
     this.canvas?.setAttribute('data-render-error',error.message);this.lastWidth=0;this.lastHeight=0;
     console.warn('EQUIP render failed',error);
    });
   });
  }
 }
}
