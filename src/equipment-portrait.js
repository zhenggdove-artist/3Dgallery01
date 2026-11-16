import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
// The character's GLB can have a nonstandard standing axis and authored
// root yaw. Build a *front-facing anatomical frame* instead of guessing 90°
 // turns from its imported Euler rotation. Only the EQUIP clone is changed.
export function orientPortraitModel(model){
 model.updateMatrixWorld(true);
 const bones=[];
 model.traverse(o=>{if(o.isBone)bones.push({bone:o,name:o.name.toLowerCase().replace(/[^a-z]/g,'')});});
 const find=patterns=>patterns.map(re=>bones.find(b=>re.test(b.name))?.bone).find(Boolean);
 const head=find([/head$/,/neck$/]);
 const hip=find([/hips$/,/pelvis$/,/spine$/]);
 const left=find([/leftshoulder$/,/leftupperarm$/,/leftarm$/]);
 const right=find([/rightshoulder$/,/rightupperarm$/,/rightarm$/]);
 if(head&&hip&&left&&right){
  const at=b=>b.getWorldPosition(new THREE.Vector3());
  const up=at(head).sub(at(hip));
  const horizontal=at(left).sub(at(right));
  if(up.lengthSq()>1e-6&&horizontal.lengthSq()>1e-6){
   up.normalize();
   horizontal.addScaledVector(up,-horizontal.dot(up));
   if(horizontal.lengthSq()>1e-6){
    horizontal.normalize();
    const front=horizontal.clone().cross(up).normalize();
    const rightAxis=up.clone().cross(front).normalize();
    const basis=new THREE.Matrix4().makeBasis(rightAxis,up,front);
    // Inverse of the anatomical basis brings HEAD to screen +Y, left /
    // right shoulders to horizontal ±X and FACE directly toward +Z camera.
    const correction=new THREE.Quaternion().setFromRotationMatrix(basis).invert();
    model.quaternion.premultiply(correction);
    model.updateMatrixWorld(true);
    return 'anatomical';
   }
  }
 }
 // Fallback for models without Mixamo bone names: an upright silhouette
 // is mandatory, even if the imported scene lies horizontally.
 const bounds=new THREE.Box3().setFromObject(model,true);
 const size=bounds.getSize(new THREE.Vector3());
 const axis=size.x>=size.y&&size.x>=size.z?new THREE.Vector3(1,0,0):
  size.z>size.y?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
 model.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(axis,new THREE.Vector3(0,1,0)));
 model.updateMatrixWorld(true);
 return 'bounds';
}

// RELETTER's render-target portrait approach: one on-demand snapshot, no extra canvas loop.
export function equipmentPortrait(renderer,root){
  if(!root)return '';
  // userData contains live mixer/material references: clone only the model hierarchy.
  const model=clone(root.userData.model),scene=new THREE.Scene();
  model.traverse(part=>{if(part.isMesh||part.isSkinnedMesh)part.visible=true;});
  // Drop every animated pose before capturing inventory art.
  model.traverse(part=>{if(part.isSkinnedMesh)part.skeleton.pose();});
  // The bind pose is close to A-pose; restore lowered upper arms if a rig
  // happened to supply a straight T-pose as its reference posture.
  model.traverse(bone=>{if(!bone.isBone)return;
    const name=bone.name.toLowerCase().replace(/[^a-z]/g,'');
    if(/leftarm$/.test(name))bone.rotation.z+=.24;
    if(/rightarm$/.test(name))bone.rotation.z-=.24;
  });
  // The correct orientation depends on the imported Mixamo skeleton.
  // It is not necessarily a 90° Euler turn. Align its head/hip/shoulder
  // landmarks to the viewer, independently of current combat animation.
  model.position.set(0,0,0);
  model.visible=true;
  orientPortraitModel(model);
  scene.add(model);
  scene.add(new THREE.HemisphereLight(0xffffff,0x756280,2.5));
  const light=new THREE.DirectionalLight(0xffffff,3);
  light.position.set(2,4,4);
  scene.add(light);
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model,true);
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  // Screen UP must be fixed to world +Y, never inferred from animated bones.
  const camera=new THREE.PerspectiveCamera(30,256/384,.001,1000);
  const height=Math.max(.5,size.y),width=Math.max(.3,size.x);
  const distance=Math.max(height,width/(256/384))*.5/Math.tan(Math.PI/12)*1.33;
  camera.up.set(0,1,0);
  camera.position.copy(center).add(new THREE.Vector3(0,height*.015,distance));
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const target=new THREE.WebGLRenderTarget(256,384),previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  try{renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);const pixels=new Uint8Array(256*384*4);renderer.readRenderTargetPixels(target,0,0,192,280,pixels);const canvas=document.createElement('canvas');canvas.width=256;canvas.height=384;const ctx=canvas.getContext('2d'),data=ctx.createImageData(256,384);for(let y=0;y<384;y++)data.data.set(pixels.subarray((383-y)*256*4,(384-y)*256*4),y*256*4);ctx.putImageData(data,0,0);let occupied=0;for(let i=0;i<pixels.length;i+=16){if(pixels[i]+pixels[i+1]+pixels[i+2]>18)occupied++;}if(occupied<64)throw Error('EQUIP snapshot has no visible character pixels');return canvas.toDataURL();}
  finally{renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);target.dispose();model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
}
