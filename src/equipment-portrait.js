import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
// RELETTER's render-target portrait approach: one on-demand snapshot, no extra canvas loop.
export function equipmentPortrait(renderer,root){
  if(!root)return '';
  // userData contains live mixer/material references: clone only the model hierarchy.
  const model=clone(root.userData.model),scene=new THREE.Scene();
  // Drop every animated pose before capturing inventory art.
  model.traverse(part=>{if(part.isSkinnedMesh)part.skeleton.pose();});
  // The bind pose is close to A-pose; restore lowered upper arms if a rig
  // happened to supply a straight T-pose as its reference posture.
  model.traverse(bone=>{if(!bone.isBone)return;
    const name=bone.name.toLowerCase().replace(/[^a-z]/g,'');
    if(/leftarm$/.test(name))bone.rotation.z+=.24;
    if(/rightarm$/.test(name))bone.rotation.z-=.24;
  });
  // Preserve the rig's authored orientation; resetting its local Euler angles
  // is what previously turned the avatar into a top/sole-view in EQUIP.
  model.position.set(0,0,0);
  model.visible=true;scene.add(model);
  scene.add(new THREE.HemisphereLight(0xffffff,0x756280,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,4,-4);scene.add(light);
  // Compute an upright, front-facing camera from the ACTUAL rig bones,
  // not a guessed model Z axis (some GLB rest poses lie along world Z).
  // Align the hips-to-head vector with world +Y, then photograph from the
  // anatomical front established by the left/right shoulder positions.
  model.updateMatrixWorld(true);
  const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});
  const norm=name=>name.toLowerCase().replace(/[^a-z]/g,'');
  const find=(rx)=>bones.find(b=>rx.test(norm(b.name)));
  const head=find(/head$/)||find(/neck$/),hips=find(/hips$|pelvis$/)||find(/spine$/);
  const left=find(/leftshoulder$|leftarm$/),right=find(/rightshoulder$|rightarm$/);
  const get=b=>b?.getWorldPosition(new THREE.Vector3())||null;
  const hp=get(head),hip=get(hips);
  if(hp&&hip&&hp.distanceToSquared(hip)>.01){
   const currentUp=hp.clone().sub(hip).normalize();
   const correction=new THREE.Quaternion().setFromUnitVectors(currentUp,new THREE.Vector3(0,1,0));
   model.quaternion.premultiply(correction);
   model.updateMatrixWorld(true);
  }
  let front=new THREE.Vector3(0,0,1);
  const lp=get(left),rp=get(right);
  if(lp&&rp&&lp.distanceToSquared(rp)>.01){
   front.copy(lp).sub(rp).cross(new THREE.Vector3(0,1,0));
   front.y=0;
   if(front.lengthSq()>.001)front.normalize();
   else front.set(0,0,1);
  }
  const box=new THREE.Box3().setFromObject(model,true),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const camera=new THREE.PerspectiveCamera(30,192/280,.001,1000);
  const distance=Math.max(size.y,size.x/(192/280))*.5/Math.tan(Math.PI/12)*1.12;
  camera.up.set(0,1,0);
  camera.position.copy(center).addScaledVector(front,distance);
  camera.position.y+=Math.min(size.y*.015,.08);
  camera.lookAt(center);
  const target=new THREE.WebGLRenderTarget(192,280),previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  try{renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);const pixels=new Uint8Array(192*280*4);renderer.readRenderTargetPixels(target,0,0,192,280,pixels);const canvas=document.createElement('canvas');canvas.width=192;canvas.height=280;const ctx=canvas.getContext('2d'),data=ctx.createImageData(192,280);for(let y=0;y<280;y++)data.data.set(pixels.subarray((279-y)*192*4,(280-y)*192*4),y*192*4);ctx.putImageData(data,0,0);return canvas.toDataURL();}
  finally{renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);target.dispose();model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
}
