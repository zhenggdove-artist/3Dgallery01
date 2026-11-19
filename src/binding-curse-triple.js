import * as THREE from 'three';

// Three stacked binding-vine tiers for the palm ultimate. Animated in
// existing object transforms: the continuous vine geometry is GPU-resident,
// never regenerated on each spell tick. This is an authored equivalent of
// the Binding Curse visual motif, not the unlicensed external source file.
const UNIT_UP=new THREE.Vector3(0,1,0);
const makeGeometry=tier=>{
 const points=[];
 for(let j=0;j<=96;j++){
  const t=j/96,angle=t*Math.PI*5.6+tier*Math.PI*.66;
  const radius=.86+.13*Math.sin(t*Math.PI*4+tier);
  points.push(new THREE.Vector3(Math.cos(angle)*radius,
   .12+tier*1.46+t*1.46,
   Math.sin(angle)*radius));
 }
 return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),110,.07,7,false);
};
export class TripleBindingCurse{
 constructor(scene){
  this.scene=scene;this.active=[];this.pool=[];
  this.geometries=Array.from({length:3},(_,i)=>makeGeometry(i));
  this.ringGeometry=new THREE.TorusGeometry(.92,.025,5,64);
  this.thornGeometry=new THREE.ConeGeometry(.09,.43,5);
  this.materials=[
   new THREE.MeshBasicMaterial({color:'#4dd599',transparent:true,opacity:.9,
    depthWrite:false,blending:THREE.AdditiveBlending}),
   new THREE.MeshBasicMaterial({color:'#b6ff7b',transparent:true,opacity:.93,
    depthWrite:false,blending:THREE.AdditiveBlending}),
   new THREE.MeshBasicMaterial({color:'#67ddad',transparent:true,opacity:.9,
    depthWrite:false,blending:THREE.AdditiveBlending})
  ];
 }
 create(){
  const group=new THREE.Group();
  group.name='Three stacked binding-curse vine levels';
  const vines=[],rings=[],thorns=[];
  for(let tier=0;tier<3;tier++){
   const vine=new THREE.Mesh(this.geometries[tier],this.materials[tier]);
   vine.frustumCulled=false;vine.renderOrder=15;
   group.add(vine);vines.push(vine);
   const ring=new THREE.Mesh(this.ringGeometry,this.materials[(tier+1)%3]);
   ring.rotation.x=-Math.PI/2;
   ring.position.y=tier*1.46+.14;
   ring.renderOrder=15;group.add(ring);rings.push(ring);
  }
  // 27 sharp leaves per layer. One shared instanced mesh avoids 81 draws.
  const leaves=new THREE.InstancedMesh(this.thornGeometry,this.materials[1],81);
  const dummy=new THREE.Object3D();
  let n=0;
  for(let tier=0;tier<3;tier++)for(let k=0;k<27;k++){
   const t=k/27,angle=t*Math.PI*5.6+tier*Math.PI*.66;
   const radius=.88+.13*Math.sin(t*Math.PI*4+tier);
   dummy.position.set(Math.cos(angle)*radius,.18+tier*1.46+t*1.46,Math.sin(angle)*radius);
   const radial=new THREE.Vector3(Math.cos(angle),.3,Math.sin(angle)).normalize();
   dummy.quaternion.setFromUnitVectors(UNIT_UP,radial);
   dummy.scale.setScalar(.6+.35*(k%4)/3);dummy.updateMatrix();
   leaves.setMatrixAt(n++,dummy.matrix);
  }
  leaves.instanceMatrix.needsUpdate=true;
  leaves.frustumCulled=false;leaves.renderOrder=16;
  group.add(leaves);thorns.push(leaves);
  group.userData.vines=vines;group.userData.rings=rings;
  return group;
 }
 play(event){
  const center=event?.area?.visualCenter||event?.area?.center||
   event?.impactPoint||event?.origin;
  if(!Array.isArray(center)||center.length!==3)return null;
  const group=this.pool.pop()||this.create();
  const radius=Math.max(.7,Number(event.area?.radius)||2.5);
  // Strictly contained within the authoritative warning/hit area.
  const lateral=Math.min(9,radius*.74);
  group.position.set(center[0],Math.max(.13,center[1]),center[2]);
  group.scale.set(lateral,.015,lateral);
  group.rotation.y=0;
  group.visible=true;this.scene.add(group);
  if(this.active.length>=5){
   const old=this.active.shift();old.group.removeFromParent();
   this.pool.push(old.group);
  }
  this.active.push({group,age:0,duration:3.3});
  return group;
 }
 update(dt){
  for(let i=this.active.length-1;i>=0;i--){
   const entry=this.active[i],group=entry.group;
   entry.age+=Math.max(0,dt);
   if(entry.age>=entry.duration){
    group.removeFromParent();this.active.splice(i,1);this.pool.push(group);
    continue;
   }
   const enter=Math.min(1,entry.age/.39);
   const ease=enter*enter*(3-2*enter);
   const depart=Math.min(1,Math.max(0,(entry.duration-entry.age)/.55));
   group.scale.y=Math.max(.01,ease*depart);
   group.rotation.y=entry.age*.49;
   group.userData.vines.forEach((vine,j)=>{
    vine.rotation.y=entry.age*(j%2?-1.35:1.15);
    vine.scale.x=vine.scale.z=.99+.09*Math.sin(entry.age*9+j);
   });
   group.userData.rings.forEach((ring,j)=>{
    ring.rotation.z=entry.age*(j%2?-1.1:1.3);
    ring.scale.setScalar(.9+.1*Math.sin(entry.age*6+j));
   });
  }
 }
 dispose(){
  for(const entry of this.active)entry.group.removeFromParent();
  this.active.length=0;this.pool.length=0;
  for(const geometry of [...this.geometries,this.ringGeometry,this.thornGeometry])geometry.dispose();
  for(const material of this.materials)material.dispose();
 }
}
