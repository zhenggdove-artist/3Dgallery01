import * as THREE from 'three';
const geometry=new THREE.PlaneGeometry(1,1),backMaterial=new THREE.MeshBasicMaterial({color:0x4b2440,depthTest:true,toneMapped:false}),fillMaterial=new THREE.MeshBasicMaterial({color:0xff72b5,depthTest:true,toneMapped:false});
export function setHealthBar(root,hp,maxHp,height=2.15){
  if(!root)return;
  let bar=root.userData.healthBar;
  if(!bar){bar=new THREE.Group();bar.name='Pink health bar';const back=new THREE.Mesh(geometry,backMaterial),fill=new THREE.Mesh(geometry,fillMaterial);back.scale.set(1.5,.13,1);fill.position.z=.006;bar.add(back,fill);root.add(bar);root.userData.healthBar=bar;}
  const ratio=Math.max(0,Math.min(1,(hp||0)/Math.max(1,maxHp||100)));bar.position.y=height;bar.visible=ratio>0;bar.children[1].scale.set(1.46*ratio,.09,1);bar.children[1].position.x=-.73*(1-ratio);
}
export function faceHealthBar(root,camera){const bar=root?.userData.healthBar;if(bar){bar.quaternion.copy(root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(camera.quaternion));}}
