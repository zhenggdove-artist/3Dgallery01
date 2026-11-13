import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
// RELETTER's render-target portrait approach: one on-demand snapshot, no extra canvas loop.
export function equipmentPortrait(renderer,root){
  if(!root)return '';
  // userData contains live mixer/material references: clone only the model hierarchy.
  const model=clone(root.userData.model),scene=new THREE.Scene();model.position.set(0,0,0);model.visible=true;scene.add(model);
  scene.add(new THREE.HemisphereLight(0xffffff,0x756280,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,4,4);scene.add(light);
  model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model,true),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),camera=new THREE.PerspectiveCamera(30,192/280,.001,1000),distance=Math.max(size.y,size.x/(192/280))*.5/Math.tan(Math.PI/12)*1.15;
  camera.position.copy(center).add(new THREE.Vector3(distance,.08*distance,.2*distance));camera.lookAt(center);
  const target=new THREE.WebGLRenderTarget(192,280),previous=renderer.getRenderTarget(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  try{renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);const pixels=new Uint8Array(192*280*4);renderer.readRenderTargetPixels(target,0,0,192,280,pixels);const canvas=document.createElement('canvas');canvas.width=192;canvas.height=280;const ctx=canvas.getContext('2d'),data=ctx.createImageData(192,280);for(let y=0;y<280;y++)data.data.set(pixels.subarray((279-y)*192*4,(280-y)*192*4),y*192*4);ctx.putImageData(data,0,0);return canvas.toDataURL();}
  finally{renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);target.dispose();model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});}
}
