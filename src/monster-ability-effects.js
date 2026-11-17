import * as THREE from 'three';
// The laser is the unmodified, licensed 00GameDevs Pulse Beam factory.
// Venom's dedicated vendor preset is not bundled with this repo; its field
// is drawn with a lightweight authored fallback, never mislabeled as vendor.
import pulseBeam from '../vendor/00gamedevs/pulse-beam.js';

const up=new THREE.Vector3(0,1,0),a=new THREE.Vector3(),b=new THREE.Vector3();
const createMat=(color,opacity)=>new THREE.MeshBasicMaterial({
 color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide
});
const rectangle=()=>new THREE.Mesh(new THREE.PlaneGeometry(1,1),createMat('#ff476d',.35));
const ring=()=>{const o=new THREE.Mesh(new THREE.RingGeometry(.94,1,48),createMat('#ff354e',.8));
 o.rotation.x=-Math.PI/2;return o;};
const strip=(root,mesh,from,to,width,height=.08)=>{
 a.fromArray(from);b.fromArray(to);
 const d=b.clone().sub(a);d.y=0;const distance=d.length();
 mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.position.y=height;
 mesh.rotation.set(-Math.PI/2,0,-Math.atan2(d.z,d.x));
 mesh.scale.set(distance,width,1);root.add(mesh);
};
const pointBubbles=(count=24)=>{
 const geo=new THREE.SphereGeometry(.12,7,5);
 const material=new THREE.MeshBasicMaterial({color:'#b1ff56',transparent:true,opacity:.62,depthWrite:false});
 const mesh=new THREE.InstancedMesh(geo,material,count);mesh.frustumCulled=false;
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);return mesh;
};
const temp=new THREE.Object3D();
function bubbleUpdate(mesh,time,radius){
 for(let i=0;i<mesh.count;i++){
  const seed=i*2.3999632297,rad=Math.sqrt((i+.5)/mesh.count)*radius*.86;
  const wobble=Math.sin(time*3.6+i*2)*.25;
  temp.position.set(Math.cos(seed)*rad,.15+((time*.65+i*.27)%1.2)+wobble,Math.sin(seed)*rad);
  temp.scale.setScalar(.6+(i%4)*.21);temp.updateMatrix();mesh.setMatrixAt(i,temp.matrix);
 }
 mesh.instanceMatrix.needsUpdate=true;
}
export function createArenaAbilityEffect(skill){
 const root=new THREE.Group();root.name='Arena monster '+skill.motion;
 root.userData.arenaSkill=skill.motion;
 const motion=skill.motion;
 if(motion==='charge'||motion==='laser'){
  const route=rectangle();strip(root,route,skill.origin,skill.aim,motion==='charge'?5.0:2.5);
  root.userData.warning=route;
  if(motion==='laser'){
   const fx=pulseBeam({size:1.7,density:.65,color:'#ff61cc'});
   root.userData.sourceVfx=fx;
   root.add(fx.group);
   // The native preset retains its original rendering; this straight core
   // makes the source ray and server-authoritative hit tube read identically.
   const core=new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,1,9,1,true),
    createMat('#ef5dff',.45));root.add(core);root.userData.beamCore=core;
  }
 }else if(motion==='slam'){
  const marker=ring();root.add(marker);root.userData.warning=marker;
  const shock=new THREE.Mesh(new THREE.RingGeometry(.1,.9,48),createMat('#ffc07a',.7));
  shock.rotation.x=-Math.PI/2;root.add(shock);root.userData.shock=shock;
 }else if(motion==='venom'){
  const marker=ring();marker.material.color.set('#b0ff35');root.add(marker);root.userData.warning=marker;
  const pool=new THREE.Mesh(new THREE.CircleGeometry(1,48),createMat('#48d623',.42));
  pool.rotation.x=-Math.PI/2;pool.position.y=.11;root.add(pool);root.userData.pool=pool;
  const bubbles=pointBubbles();root.add(bubbles);root.userData.bubbles=bubbles;
 }else{
  const marker=ring();root.add(marker);root.userData.warning=marker;
 }
 return root;
}
export function updateArenaAbilityEffect(root,skill,now,dt){
 const motion=skill.motion,ud=root.userData,active=skill.phase==='active';
 const progress=Math.max(0,Math.min(1,(now-skill.start)/Math.max(1,skill.end-skill.start)));
 const origin=skill.origin,aim=skill.aim;
 if(ud.warning){ud.warning.visible=!active;ud.warning.material.opacity=.35+.3*Math.sin(now*.014)**2;}
 if(motion==='charge'){
  if(active&&ud.warning)ud.warning.visible=true;
  if(ud.warning)ud.warning.material.opacity=active?.22:.4+.25*Math.sin(now*.02)**2;
 }else if(motion==='laser'){
  const vfx=ud.sourceVfx;
  const from=skill.mouth||[origin[0],origin[1]+6,origin[2]];
  a.fromArray(from);b.fromArray(aim);
  if(vfx){vfx.group.visible=active;vfx.setEndpoints?.(a,b);if(active)vfx.update(Math.min(.06,Math.max(0,dt)));}
  const core=ud.beamCore;core.visible=active;
  if(active){const delta=b.clone().sub(a),distance=delta.length();
   core.position.copy(a).addScaledVector(delta,.5);
   core.quaternion.setFromUnitVectors(up,delta.normalize());
   core.scale.set(1,distance,1);
   core.material.opacity=.35+.22*Math.sin(now*.04)**2;
  }
 }else if(motion==='slam'){
  const pos=origin;root.position.set(pos[0],.09,pos[2]);
  if(ud.warning)ud.warning.scale.setScalar(skill.radius||7);
  if(ud.shock){ud.shock.visible=active;
   const spread=Math.max(.01,progress)*(skill.radius||7);
   ud.shock.scale.setScalar(spread);ud.shock.material.opacity=.8*(1-progress);}
 }else if(motion==='venom'){
  const pos=aim;root.position.set(pos[0],0,pos[2]);
  const radius=skill.radius||5.5;
  if(ud.warning)ud.warning.scale.setScalar(radius);
  if(ud.pool){ud.pool.visible=active;ud.pool.scale.setScalar(radius);
   ud.pool.material.opacity=.32+.14*Math.sin(now*.008)**2;}
  if(ud.bubbles){ud.bubbles.visible=active;if(active)bubbleUpdate(ud.bubbles,now/1000,radius);}
 }else{
  root.position.set(origin[0],.09,origin[2]);
  if(ud.warning)ud.warning.scale.setScalar(skill.radius||4);
 }
}
export function disposeArenaAbilityEffect(root){
 const vfx=root.userData.sourceVfx;
 if(vfx){vfx.group.removeFromParent();vfx.dispose();root.userData.sourceVfx=null;}
 root.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();});
 root.removeFromParent();
}
