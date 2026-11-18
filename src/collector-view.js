import * as THREE from 'three';
import {COLLECTOR_RADIUS} from './shared/collector.js';

// Create a single copy of the real player avatar and procedurally tailor
// a three-dimensional suit onto it. No new GLB or image assets are loaded.
function dressCollector(root){
 const coat=new THREE.MeshStandardMaterial({color:'#171d2b',roughness:.88,metalness:.06});
 const trim=new THREE.MeshStandardMaterial({color:'#343e53',roughness:.8});
 const shirt=new THREE.MeshStandardMaterial({color:'#faf8f3',roughness:.86});
 const tie=new THREE.MeshStandardMaterial({color:'#9e2733',roughness:.55});
 const shoes=new THREE.MeshStandardMaterial({color:'#101015',roughness:.65});
 const gold=new THREE.MeshStandardMaterial({color:'#d7b770',roughness:.4,metalness:.6});
 const suit=new THREE.Group();
 const height=new THREE.Box3().setFromObject(root.userData.model,true).getSize(new THREE.Vector3()).y;
 suit.scale.setScalar(Math.max(.25,height/2.1));
 // The original avatar faces local +X; build a suit facing +Z then rotate it.
 suit.rotation.y=Math.PI/2;
 const box=(w,h,d,x,y,z,material)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);suit.add(mesh);return mesh;
 };
 box(.94,.99,.64,0,1.28,0,coat);
 box(.32,.78,.07,0,1.33,.355,shirt);
 for(const sign of [-1,1]){
  const sleeve=box(.26,.82,.33,sign*.61,1.27,-.01,coat);
  sleeve.rotation.z=sign*.13;
  box(.36,.76,.42,sign*.23,.48,0,trim);
  box(.40,.16,.65,sign*.23,.095,.14,shoes);
  const lapel=new THREE.Shape();
  lapel.moveTo(sign*.14,1.78);lapel.lineTo(sign*.49,1.75);
  lapel.lineTo(sign*.27,1.26);lapel.lineTo(sign*.10,1.40);
  lapel.closePath();
  const face=new THREE.Mesh(new THREE.ShapeGeometry(lapel),trim);
  face.position.z=.397;suit.add(face);
  const button=new THREE.Mesh(new THREE.SphereGeometry(.028,8,6),gold);
  button.position.set(sign*.13,1.02,.403);suit.add(button);
 }
 const knot=new THREE.Mesh(new THREE.ConeGeometry(.105,.17,3),tie);
 knot.rotation.z=Math.PI;knot.position.set(0,1.58,.416);suit.add(knot);
 const tail=new THREE.Mesh(new THREE.ConeGeometry(.085,.53,3),tie);
 tail.position.set(0,1.28,.414);suit.add(tail);
 root.add(suit);
}

function collectorLabel(){
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=84;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='rgba(13,17,30,.88)';ctx.fillRect(0,0,320,84);
 ctx.strokeStyle='#e8d6ac';ctx.lineWidth=4;ctx.strokeRect(3,3,314,78);
 ctx.fillStyle='#fff4d9';ctx.font='bold 47px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
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
