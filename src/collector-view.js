import * as THREE from 'three';
import {COLLECTOR_RADIUS} from './shared/collector.js';
import {attachOutfit} from './reletter/outfit-model.js';

// Put a real outfit on the *skinned* Temple protagonist. The torso, arms
// and legs remain the original animated avatar; no substitute cube body.
function dressCollector(root){
 const tailoredSuit={
  id:'collector-tailored-suit',name:'Collector Tailored Suit',slot:'outfit',
  family:'outfit',design:'suit',pattern:0,tier:5,color:'#20293b'
 };
 const outfit=attachOutfit(THREE,root.userData.model,tailoredSuit,{hood:false});
 if(!outfit)throw new Error('Collector: original character rig cannot wear an outfit');
 root.userData.outfit=outfit;
}

function collectorLabel(){
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=84;
 const ctx=canvas.getContext('2d');
 // Transparent canvas: the word floats above the model with no plaque.
 ctx.clearRect(0,0,320,84);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 52px sans-serif';
 ctx.lineWidth=2.5;ctx.strokeStyle='rgba(236,214,255,.95)';
 ctx.strokeText('Collector',160,44);
 ctx.fillStyle='#a74cff';ctx.shadowColor='#7f33de';ctx.shadowBlur=11;
 ctx.fillText('Collector',160,44);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
 sprite.scale.set(2.85,.75,1);sprite.renderOrder=20;return sprite;
}

// Compact semi-realistic handgun. It appears in the original avatar's right
// hand on the first warning shot and is holstered again after the recoil pose.
function createCollectorPistol(){
 const steel=new THREE.MeshStandardMaterial({color:'#23282e',metalness:.75,roughness:.32});
 const barrel=new THREE.MeshStandardMaterial({color:'#777b81',metalness:.85,roughness:.25});
 const grip=new THREE.MeshStandardMaterial({color:'#15151b',metalness:.13,roughness:.83});
 const pistol=new THREE.Group();
 const piece=(geometry,material,position)=>{
  const part=new THREE.Mesh(geometry,material);
  part.position.set(...position);pistol.add(part);return part;
 };
 piece(new THREE.BoxGeometry(.17,.14,.50),steel,[0,.06,.19]);
 piece(new THREE.BoxGeometry(.145,.11,.38),barrel,[0,-.055,.17]);
 const handle=piece(new THREE.BoxGeometry(.145,.32,.16),grip,[0,-.22,-.03]);
 handle.rotation.x=-.24;
 const barrelEnd=piece(new THREE.CylinderGeometry(.049,.049,.16,12),steel,[0,.045,.50]);
 barrelEnd.rotation.x=Math.PI/2;
 const sight=piece(new THREE.BoxGeometry(.04,.036,.055),barrel,[0,.15,.37]);
 const guard=piece(new THREE.TorusGeometry(.10,.017,6,14),steel,[0,-.16,.14]);
 guard.rotation.x=Math.PI/2;
 const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.115,10,8),
  new THREE.MeshBasicMaterial({color:'#ffeaa3',transparent:true,opacity:.93,
   blending:THREE.AdditiveBlending,depthWrite:false}));
 muzzle.position.set(0,.03,.59);muzzle.visible=false;pistol.add(muzzle);
 pistol.visible=false;
 return {pistol,muzzle};
}

export class CollectorView{
 constructor(scene,arena,onShot=null){
  this.scene=scene;this.arena=arena;this.onShot=onShot;
  this.root=null;this.ring=null;this.gun=null;this.muzzle=null;
  this.gunBone=null;this.aimUntil=0;this.flashUntil=0;
  this.target=null;this.seenShots=new Set();this.tracers=[];
  this.tmpHand=new THREE.Vector3();this.tmpAim=new THREE.Vector3();
 }
 ensure(){
  if(this.root||!this.arena.characterAsset)return;
  const root=this.arena.createPlayer('#253247',false,'Collector');
  root.name='Collector';
  root.userData.ring.visible=false;
  root.userData.label.visible=false;
  dressCollector(root);
  const ring=new THREE.Mesh(
   new THREE.RingGeometry(COLLECTOR_RADIUS-.14,COLLECTOR_RADIUS,64),
   new THREE.MeshBasicMaterial({color:'#f8d489',side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false})
  );
  ring.rotation.x=-Math.PI/2;ring.position.y=.08;root.add(ring);
  const label=collectorLabel();
  label.position.y=Math.max(2.35,root.userData.chatHeadY+.35);
  root.add(label);
  const {pistol,muzzle}=createCollectorPistol();
  root.add(pistol);
  root.userData.model.traverse(o=>{
   if(o.isBone&&/(?:^|mixamorig)RightHand$/i.test(o.name))this.gunBone=o;
  });
  this.scene.add(root);root.visible=false;
  this.root=root;this.ring=ring;this.gun=pistol;this.muzzle=muzzle;
 }
 showShot(shot){
  if(!this.root?.visible||!Array.isArray(shot.to)||!Array.isArray(shot.from))return;
  const now=performance.now();
  this.aimUntil=now+800;
  this.flashUntil=now+160;
  this.target=new THREE.Vector3(...shot.to);
  // The Collector actually faces the offending player and draws the pistol.
  this.root.rotation.y=Math.atan2(
   shot.to[0]-this.root.position.x,shot.to[2]-this.root.position.z
  );
  this.gun.visible=true;
  this.muzzle.visible=true;
  this.onShot?.(shot);
  const from=new THREE.Vector3(...shot.from),to=new THREE.Vector3(...shot.to);
  const offset=to.clone().sub(from),length=offset.length();
  if(length>.05){
   const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.023,.035,1,8),
    new THREE.MeshBasicMaterial({color:'#ffdb87',transparent:true,opacity:.92,
     blending:THREE.AdditiveBlending,depthWrite:false}));
   mesh.scale.y=length;
   mesh.position.copy(from).add(to).multiplyScalar(.5);
   mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),offset.normalize());
   this.scene.add(mesh);
   this.tracers.push({mesh,until:now+230});
  }
 }
 sync(state){
  this.ensure();
  if(!this.root)return;
  const active=!!state?.active&&Array.isArray(state.position);
  this.root.visible=active;
  if(active){
   this.root.position.fromArray(state.position);
   if(performance.now()>=this.aimUntil)this.root.rotation.y=0;
  }else{
   this.gun.visible=false;this.aimUntil=0;
  }
  for(const shot of state?.shots||[]){
   if(!shot?.id||this.seenShots.has(shot.id))continue;
   this.seenShots.add(shot.id);
   if(this.seenShots.size>128)this.seenShots.delete(this.seenShots.values().next().value);
   if(Date.now()-shot.time<3500&&Date.now()>=shot.time-1000)this.showShot(shot);
  }
 }
 update(time){
  const now=performance.now();
  for(let i=this.tracers.length-1;i>=0;i--){
   const tracer=this.tracers[i];
   if(now>=tracer.until){
    tracer.mesh.removeFromParent();
    tracer.mesh.geometry.dispose();tracer.mesh.material.dispose();
    this.tracers.splice(i,1);
   }else tracer.mesh.material.opacity=.92*Math.max(0,(tracer.until-now)/230);
  }
  if(!this.root?.visible)return;
  this.ring.material.opacity=.55+Math.sin(time*2.5)*.16;
  this.ring.rotation.z=time*.10;
  const firing=now<this.aimUntil;
  this.gun.visible=firing;
  this.muzzle.visible=now<this.flashUntil&&firing;
  if(!firing){this.root.rotation.y=0;return;}
  // Follow the animated RightHand bone without a second humanoid model.
  this.root.updateMatrixWorld(true);
  if(this.gunBone){
   this.gunBone.getWorldPosition(this.tmpHand);
   this.root.worldToLocal(this.tmpHand);
   this.gun.position.copy(this.tmpHand).add(new THREE.Vector3(0,-.035,0));
  }else this.gun.position.set(.49,1.15,.30);
  this.tmpAim.copy(this.target);this.root.worldToLocal(this.tmpAim);
  this.gun.lookAt(this.tmpAim);
  const elapsed=this.aimUntil-now;
  if(elapsed>580&&elapsed<720)this.gun.rotateX(-.10*Math.sin((elapsed-580)/140*Math.PI));
 }
}
