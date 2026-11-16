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
  // The scene's authored GLB is sometimes laid on its back in its bind pose.
  // Rotating the mesh with a guessed world axis caused top-of-head / sole views.
  // Instead construct the *camera's* anatomical frame from the skeleton:
  // head-to-hips is UP; shoulders define RIGHT; their cross product is FRONT.
  // No model rotation or arbitrary world camera-up assumptions are involved.
  model.updateMatrixWorld(true);
  const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});
  const norm=name=>name.toLowerCase().replace(/[^a-z]/g,'');
  const find=rx=>bones.find(b=>rx.test(norm(b.name)));
  const head=find(/head$/)||find(/neck$/),hip=find(/hips$|pelvis$/)||find(/spine$/);
  const left=find(/leftshoulder$|leftarm$/),right=find(/rightshoulder$|rightarm$/);
  const point=b=>b?.getWorldPosition(new THREE.Vector3())||null;
  const hp=point(head),hips=point(hip),lp=point(left),rp=point(right);
  const up=hp&&hips&&hp.distanceToSquared(hips)>.005
    ?hp.clone().sub(hips).normalize():new THREE.Vector3(0,1,0);
  let anatomicalRight=lp&&rp&&lp.distanceToSquared(rp)>.005
    ?lp.clone().sub(rp):new THREE.Vector3(1,0,0);
  anatomicalRight.addScaledVector(up,-anatomicalRight.dot(up));
  if(anatomicalRight.lengthSq()<.001)anatomicalRight.set(1,0,0);
  anatomicalRight.normalize();
  let front=anatomicalRight.clone().cross(up).normalize();
  // Facial markers, when a rig contains them, resolve front/back ambiguity.
  const nose=point(find(/nose$|facefront$|jawtip$/));
  if(nose&&hp){
   const face=nose.clone().sub(hp).addScaledVector(up,-nose.clone().sub(hp).dot(up));
   if(face.lengthSq()>.004&&front.dot(face)<0)front.negate();
  }
  // The anatomical front must be perpendicular to the upright reference.
  front.addScaledVector(up,-front.dot(up)).normalize();
  const box=new THREE.Box3().setFromObject(model,true);
  const center=box.getCenter(new THREE.Vector3());
  const half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);
  const projectedHeight=2*(Math.abs(up.x)*half.x+Math.abs(up.y)*half.y+Math.abs(up.z)*half.z);
  const projectedWidth=2*(Math.abs(anatomicalRight.x)*half.x+Math.abs(anatomicalRight.y)*half.y+Math.abs(anatomicalRight.z)*half.z);
  const camera=new THREE.PerspectiveCamera(30,192/280,.001,1000);
  const distance=Math.max(projectedHeight,projectedWidth/(192/280))*.5/Math.tan(Math.PI/12)*1.19;
  camera.up.copy(up);
  camera.position.copy(center).addScaledVector(front,distance).addScaledVector(up,.015*projectedHeight);
  camera.lookAt(center);
  camera.updateMatrixWorld(true);
  const target=new THREE.WebGLRenderTarget(192,280),previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  try{renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);const pixels=new Uint8Array(192*280*4);renderer.readRenderTargetPixels(target,0,0,192,280,pixels);const canvas=document.createElement('canvas');canvas.width=192;canvas.height=280;const ctx=canvas.getContext('2d'),data=ctx.createImageData(192,280);for(let y=0;y<280;y++)data.data.set(pixels.subarray((279-y)*192*4,(280-y)*192*4),y*192*4);ctx.putImageData(data,0,0);return canvas.toDataURL();}
  finally{renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);target.dispose();model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
}
