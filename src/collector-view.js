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

export class CollectorView{
 constructor(scene,arena){this.scene=scene;this.arena=arena;this.root=null;this.ring=null;}
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
  this.scene.add(root);root.visible=false;this.root=root;this.ring=ring;
 }
 sync(state){
  this.ensure();
  if(!this.root)return;
  const active=!!state?.active&&Array.isArray(state.position);
  this.root.visible=active;
  if(active){this.root.position.fromArray(state.position);this.root.rotation.y=0;}
 }
 update(time){
  if(!this.root?.visible)return;
  this.ring.material.opacity=.55+Math.sin(time*2.5)*.16;
  this.ring.rotation.z=time*.10;
 }
}
