import * as THREE from 'three';

// Bounded, re-used forward-ray visualization for sustained 00GameDevs #08/#29.
// Native effects remain active at the muzzle; this extends the visible ray
// across its actual server-authorized range without per-frame allocation.
const Y=new THREE.Vector3(0,1,0);
// World-space ray follows the actual server-authorized direction and reach.
export class ForwardChannelBeam{
 constructor(scene,lightning=false){
  this.lightning=lightning;this.scene=scene;
  this.group=new THREE.Group();this.group.name=lightning?'lightning-forward-channel':'prism-forward-channel';
  this.color=lightning?0x4fbbff:0xc59dff;
  const geo=new THREE.CylinderGeometry(1,1,1,10,1,true);
  this.shell=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
   color:this.color,transparent:true,opacity:lightning?.52:.4,depthTest:false,
   blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  this.core=new THREE.Mesh(geo.clone(),new THREE.MeshBasicMaterial({
   color:lightning?0xe2ffff:0xfff6ff,transparent:true,opacity:.99,depthTest:false,
   blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  this.group.add(this.shell,this.core);
  this.shell.renderOrder=12;this.core.renderOrder=13;
  this.pulse=new THREE.Mesh(new THREE.SphereGeometry(1,12,9),new THREE.MeshBasicMaterial({
   color:lightning?0xa5ffff:0xf0bcff,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false}));
  this.group.add(this.pulse);this.pulse.renderOrder=14;
  this.paths=[];
  const count=lightning?3:2;
  for(let i=0;i<count;i++){
   const arr=new Float32Array(33*3);
   const lineGeo=new THREE.BufferGeometry();
   lineGeo.setAttribute('position',new THREE.BufferAttribute(arr,3).setUsage(THREE.DynamicDrawUsage));
   const line=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({
    color:lightning?(i%2?0xffffff:0x49acff):(i%2?0xffe5ff:0x8af6ff),
    transparent:true,opacity:.92,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false}));
   line.frustumCulled=false;line.renderOrder=15;this.group.add(line);this.paths.push(line);
  }
  this.mid=new THREE.Vector3();this.direction=new THREE.Vector3();this.right=new THREE.Vector3();this.up=new THREE.Vector3();
  this.group.frustumCulled=false;scene.add(this.group);
 }
 update(origin,direction,range,age,width=.4){
  if(!origin||!direction||!Number.isFinite(range))return;
  this.direction.copy(direction).normalize();
  if(this.direction.lengthSq()<.01)this.direction.set(0,0,1);
  const distance=Math.max(.5,Math.min(160,range));
  const radius=Math.max(.12,Math.min(1.2,Number(width)||.4));
  // Reach the full ray promptly, then move a luminous pulse toward its end.
  const reach=distance*Math.min(1,Math.max(.12,age/.22));
  this.mid.copy(origin).addScaledVector(this.direction,reach*.5);
  this.shell.position.copy(this.mid);this.core.position.copy(this.mid);
  this.shell.quaternion.setFromUnitVectors(Y,this.direction);this.core.quaternion.copy(this.shell.quaternion);
  const wobble=this.lightning?Math.sin(age*17)*.018:Math.sin(age*7)*.024;
  this.shell.scale.set(radius*.9+wobble,reach,radius*.9+wobble);
  this.core.scale.set(radius*.35,reach,radius*.35);
  const travel=(age*2.6)%1;
  this.pulse.position.copy(origin).addScaledVector(this.direction,reach*travel);
  this.pulse.scale.setScalar(radius*.8);
  this.right.crossVectors(this.direction,Y);
  if(this.right.lengthSq()<.001)this.right.set(1,0,0);else this.right.normalize();
  this.up.crossVectors(this.right,this.direction).normalize();
  for(let j=0;j<this.paths.length;j++){
   const line=this.paths[j],a=line.geometry.attributes.position.array;
   for(let i=0;i<=32;i++){
    const t=i/32,theta=t*Math.PI*(this.lightning?9:7)+age*(this.lightning?18:7)+j*2.3;
    const amplitude=radius*(this.lightning?.55:.43)*Math.sin(Math.PI*t);
    const saw=this.lightning?(i%3===0?1.4:.7):1;
    const x=Math.cos(theta)*amplitude*saw,z=Math.sin(theta)*amplitude*saw;
    const idx=i*3;
    a[idx]=origin.x+this.direction.x*reach*t+this.right.x*x+this.up.x*z;
    a[idx+1]=origin.y+this.direction.y*reach*t+this.right.y*x+this.up.y*z;
    a[idx+2]=origin.z+this.direction.z*reach*t+this.right.z*x+this.up.z*z;
   }
   line.geometry.attributes.position.needsUpdate=true;
  }
 }
 dispose(){
  this.group.removeFromParent();
  for(const mesh of [this.shell,this.core,this.pulse]){mesh.geometry.dispose();mesh.material.dispose();}
  for(const path of this.paths){path.geometry.dispose();path.material.dispose();}
 }
}
