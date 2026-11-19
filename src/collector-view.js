import * as THREE from 'three';
import {COLLECTOR_RADIUS} from './shared/collector.js';
import {attachOutfit} from './reletter/outfit-model.js';

// Visual enlargement only: the server's Collector trade/defence radius is unchanged.
const COLLECTOR_VISUAL_SCALE=2;

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
 // Multilayer neon outline is baked once; only the sprite opacity animates
 // each frame, avoiding expensive canvas texture reuploads on mobile.
 ctx.shadowColor='#e08bff';ctx.shadowBlur=24;
 ctx.lineWidth=11;ctx.strokeStyle='rgba(164,35,255,.63)';
 ctx.strokeText('Collector',160,44);
 ctx.shadowColor='#bb61ff';ctx.shadowBlur=15;
 ctx.lineWidth=6;ctx.strokeStyle='#faf2ff';
 ctx.strokeText('Collector',160,44);
 ctx.lineWidth=2.5;ctx.strokeStyle='rgba(236,214,255,.95)';
 ctx.strokeText('Collector',160,44);
 ctx.fillStyle='#a74cff';ctx.shadowColor='#7f33de';ctx.shadowBlur=11;
 ctx.fillText('Collector',160,44);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
 sprite.scale.set(2.85*1.5,.75*1.5,1);sprite.renderOrder=20;return sprite;
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
  this.speech=null;this.speechUntil=0;this.speechPosition=new THREE.Vector3();
 }
 ensure(){
  if(this.root||!this.arena.characterAsset)return;
  const root=this.arena.createPlayer('#253247',false,'Collector');
  root.name='Collector';
  root.userData.ring.visible=false;
  root.userData.label.visible=false;
  dressCollector(root);
  // Scale the actual skinned body and its floating 'Collector' sprite together.
  // Avoid scaling the server interaction zone or changing spawn coordinates.
  root.scale.setScalar(COLLECTOR_VISUAL_SCALE);
  const ring=new THREE.Mesh(
   new THREE.RingGeometry(COLLECTOR_RADIUS-.14,COLLECTOR_RADIUS,64),
   new THREE.MeshBasicMaterial({color:'#f8d489',side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false})
  );
  ring.rotation.x=-Math.PI/2;
  ring.position.y=.08/COLLECTOR_VISUAL_SCALE;
  ring.scale.setScalar(1/COLLECTOR_VISUAL_SCALE); // exact original interaction ring radius
  root.add(ring);
  const label=collectorLabel();
  label.position.y=Math.max(2.35,root.userData.chatHeadY+.35);
  root.add(label);
  const {pistol,muzzle}=createCollectorPistol();
  root.add(pistol);
  root.userData.model.traverse(o=>{
   if(o.isBone&&/(?:^|mixamorig)RightHand$/i.test(o.name))this.gunBone=o;
  });
  this.scene.add(root);root.visible=false;
  this.root=root;this.ring=ring;this.gun=pistol;this.muzzle=muzzle;this.label=label;
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
  this.showTaunt(shot.taunt);
  // Keep the warning-shot tracer visually attached to the enlarged hand,
  // rather than the server's pre-enlargement muzzle height.
  this.root.updateMatrixWorld(true);
  const from=this.gunBone?
    this.gunBone.getWorldPosition(new THREE.Vector3()):
    this.root.localToWorld(new THREE.Vector3(.49,1.15,.30));
  const to=new THREE.Vector3(...shot.to);
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
 showTaunt(message){
  if(!message||typeof document==='undefined')return;
  this.speech?.remove();
  const speech=document.createElement('div');
  speech.className='collector-angry-speech';
  speech.setAttribute('role','status');
  speech.textContent=String(message);
  speech.style.left='-9999px';speech.style.top='-9999px';
  document.body.append(speech);
  this.speech=speech;
  this.speechUntil=performance.now()+3000;
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
 update(time,camera=null){
  const now=performance.now();
  if(this.speech){
   if(!this.root?.visible||now>=this.speechUntil){
    this.speech.remove();this.speech=null;
   }else if(camera){
    this.speechPosition.set(
     this.root.position.x,
     this.root.position.y+Math.max(3.4,(this.root.userData.chatHeadY||2.8)*COLLECTOR_VISUAL_SCALE+1.25),
     this.root.position.z
    ).project(camera);
    const p=this.speechPosition;
    const visible=p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1.2&&Math.abs(p.y)<=1.2;
    this.speech.hidden=!visible;
    if(visible){
     this.speech.style.left=((p.x+1)*innerWidth/2)+'px';
     this.speech.style.top=((1-p.y)*innerHeight/2-12)+'px';
    }
   }
  }
  for(let i=this.tracers.length-1;i>=0;i--){
   const tracer=this.tracers[i];
   if(now>=tracer.until){
    tracer.mesh.removeFromParent();
    tracer.mesh.geometry.dispose();tracer.mesh.material.dispose();
    this.tracers.splice(i,1);
   }else tracer.mesh.material.opacity=.92*Math.max(0,(tracer.until-now)/230);
  }
  if(!this.root?.visible)return;
  // High-frequency flicker over a slow neon pulse; no animation allocations.
  if(this.label)this.label.material.opacity=Math.min(1,Math.max(.3,
   .69+.23*Math.sin(time*5.2)+.11*Math.sin(time*29)*Math.sin(time*8.1)));
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
