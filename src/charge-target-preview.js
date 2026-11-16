import * as THREE from 'three';
import {attackStats} from './shared/catalog.js';
import {chargedArea,spellGroundHeight} from './shared/charge-area.js';

// Blue rune projection shown while charging, derived from the same target-area
// calculation used by server-side full-charge hit testing.
export class ChargeTargetPreview{
 constructor(scene){
  this.scene=scene;this.group=new THREE.Group();this.group.name='Blue charged spell target rune';scene.add(this.group);
  const mat=new THREE.MeshBasicMaterial({color:'#37b5ff',transparent:true,opacity:.62,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
  const inner=new THREE.Mesh(new THREE.RingGeometry(.61,.65,72),mat.clone());
  const outer=new THREE.Mesh(new THREE.RingGeometry(.965,1,96),mat.clone());
  for(const ring of [inner,outer]){ring.rotation.x=-Math.PI/2;ring.renderOrder=20;this.group.add(ring);}
  this.outer=outer;this.inner=inner;
  const v=[];
  const seg=(x1,z1,x2,z2)=>{v.push(x1,0,z1,x2,0,z2);};
  const polar=(a,r)=>[Math.sin(a)*r,Math.cos(a)*r];
  for(let k=0;k<12;k++){const a=k*Math.PI/6,[x,z]=polar(a,.74),[u,w]=polar(a,.9);seg(x,z,u,w);}
  for(const step of [0,1])for(let k=0;k<3;k++){const a=(k*2+step)*Math.PI/3,b=((k*2+step+2)%6)*Math.PI/3,[x,z]=polar(a,.72),[u,w]=polar(b,.72);seg(x,z,u,w);}
  for(let k=0;k<8;k++){const a=k*Math.PI/4,[x,z]=polar(a,1.04),[u,w]=polar(a,1.12);seg(x,z,u,w);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  this.runes=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#70d5ff',transparent:true,opacity:.85,depthTest:false,depthWrite:false}));
  this.runes.renderOrder=21;this.group.add(this.runes);
  this.path=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3)),new THREE.LineBasicMaterial({color:'#37b5ff',transparent:true,opacity:.65,depthTest:false,depthWrite:false}));
  this.path.frustumCulled=false;this.path.renderOrder=19;scene.add(this.path);
  // Show charged non-area skills as a corridor reaching forward.
  const guide=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(24),3));
  this.corridor=new THREE.LineSegments(guide,new THREE.LineBasicMaterial({color:'#a5eeff',transparent:true,opacity:.84,depthTest:false,depthWrite:false}));
  this.corridor.name='Forward charged skill corridor';this.corridor.renderOrder=22;this.corridor.frustumCulled=false;scene.add(this.corridor);
  this.group.visible=this.path.visible=this.corridor.visible=false;this.t=0;
 }
 update(root,item,charge,direction,arena){
  if(!root||!item||charge<.1||!Array.isArray(direction)){this.hide();return;}
  const origin=[root.position.x,root.position.y+1,root.position.z];
  const area=chargedArea(item,origin,direction,attackStats(item,1),(x,z,y)=>spellGroundHeight(arena.world,x,z,y));
  this.group.visible=area.mode==='area';this.path.visible=true;this.corridor.visible=area.mode!=='area';
  const p=area.center,r=area.radius;
  this.group.position.set(p[0],Math.max(.15,p[1])+.06,p[2]);
  this.group.scale.setScalar(r);
  this.t+=.028;
  this.group.rotation.y+=.008;
  this.outer.material.opacity=.6+.2*Math.sin(this.t*3);
  this.inner.material.opacity=.45+.18*Math.cos(this.t*2);
  this.runes.material.opacity=.62+.3*Math.sin(this.t*2.5);
  this.path.geometry.attributes.position.setXYZ(0,origin[0],origin[1],origin[2]);
  this.path.geometry.attributes.position.setXYZ(1,p[0],Math.max(.2,p[1])+.05,p[2]);
  this.path.geometry.attributes.position.needsUpdate=true;
  this.path.material.opacity=.35+.4*charge;
   if(area.mode!=='area'){
     const d=new THREE.Vector3(direction[0],0,direction[2]);if(d.lengthSq()<.01)d.set(0,0,1);d.normalize();
     const right=new THREE.Vector3(-d.z,0,d.x),halfWidth=Math.min(7,Math.max(1.2,attackStats(item,1).radius+1.3));
     const start=new THREE.Vector3(origin[0],Math.max(.25,origin[1]-.8),origin[2]);
     const finish=new THREE.Vector3(p[0],Math.max(.25,p[1]),p[2]);
     const arr=this.corridor.geometry.attributes.position,k=[start.clone().addScaledVector(right,halfWidth),finish.clone().addScaledVector(right,halfWidth),
       start.clone().addScaledVector(right,-halfWidth),finish.clone().addScaledVector(right,-halfWidth),
       finish.clone().addScaledVector(right,halfWidth),finish.clone().addScaledVector(right,-halfWidth),
       start.clone().addScaledVector(right,halfWidth),start.clone().addScaledVector(right,-halfWidth)];
     k.forEach((v,i)=>arr.setXYZ(i,v.x,v.y,v.z));arr.needsUpdate=true;
     this.corridor.material.opacity=.55+.4*charge;
   }
 }
 hide(){this.group.visible=false;this.path.visible=false;this.corridor.visible=false;}
 dispose(){this.hide();this.group.removeFromParent();this.path.removeFromParent();this.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.path.geometry.dispose();this.path.material.dispose();this.corridor.removeFromParent();this.corridor.geometry.dispose();this.corridor.material.dispose();}
}
