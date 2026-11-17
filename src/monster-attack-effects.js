import * as THREE from 'three';
import pulseBeam from '../vendor/00gamedevs/pulse-beam.js';
import venomPool from '../vendor/00gamedevs/venom-pool.js';
import {ENEMY_HEIGHT} from './shared/island-combat.js';

const TAU=Math.PI*2;
const range2=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const BEAM_RANGE=38;
const toVec=a=>new THREE.Vector3(a[0],a[1]||0,a[2]);
const softMat=(color)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.50,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
const warningRect=new THREE.PlaneGeometry(1,1),warningCircle=new THREE.CircleGeometry(1,64);
export class MonsterAttackEffects {
 constructor(scene){
  this.scene=scene;this.live=new Map();this.pool=new Map();this.completed=new Set();
 }
 make(motion){
  const root=new THREE.Group();root.name='Monster skill '+motion;
  const marker=new THREE.Mesh((motion==='charge'||motion==='beam')?warningRect:warningCircle,softMat('#ff242c'));
  marker.rotation.x=-Math.PI/2;marker.position.y=.12;root.add(marker);
  const fringe=new THREE.Mesh(warningCircle,softMat('#ff242c'));
  fringe.rotation.x=-Math.PI/2;fringe.position.y=.125;root.add(fringe);
  const native=motion==='beam'?pulseBeam({size:1.8,density:.48,color:'#80ffed',quantity:4}):
   motion==='venom'?venomPool({size:1.8,density:.5,color:'#b4f745',quantity:7}):null;
  if(native){native.group.visible=false;root.add(native.group);}
  const wave=new THREE.Mesh(new THREE.RingGeometry(.84,1,48),softMat('#ffe8ab'));
  wave.rotation.x=-Math.PI/2;wave.position.y=.18;wave.visible=false;root.add(wave);
  // Impact debris uses a single instanced mesh instead of dozens of draw calls.
  let rubble=null,fractures=null;
  if(motion==='stomp'){
   rubble=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.18,0),
    new THREE.MeshStandardMaterial({color:'#82776b',roughness:.95,flatShading:true}),32);
   rubble.name='Stomp shattered rocks';rubble.frustumCulled=false;root.add(rubble);
   const segments=[];
   for(let ray=0;ray<18;ray++){
    const angle=ray*TAU/18,tip=4.5+Math.sin(ray*23.71)*.55;
    let x=0,z=0;
    for(let step=1;step<=4;step++){
     const f=step/4,offset=Math.sin(ray*17.7+step*2.8)*.26;
     const nx=Math.cos(angle)*tip*f+Math.cos(angle+Math.PI/2)*offset;
     const nz=Math.sin(angle)*tip*f+Math.sin(angle+Math.PI/2)*offset;
     segments.push(x,.17,z,nx,.17,nz);x=nx;z=nz;
    }
   }
   fractures=new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(segments,3)),
    new THREE.LineBasicMaterial({color:'#382a2a',transparent:true,opacity:.9,depthWrite:false}));
   fractures.name='Stomp branching floor cracks';root.add(fractures);
   rubble.visible=false;fractures.visible=false;
  }
  const entry={root,motion,marker,fringe,wave,native,rubble,fractures,last:0};
  root.userData.weaponVfxSource=native?'00GameDevs':'Temple warning';
  root.userData.vfxId=motion==='beam'?'pulse-beam':motion==='venom'?'venom-pool':motion;
  this.scene.add(root);
  return entry;
 }
 take(motion){
  const arr=this.pool.get(motion);const e=arr?.pop()||this.make(motion);
  e.root.visible=true;
  if(e.native){e.native.reset?.();e.native.group.visible=false;}
  e.last=0;return e;
 }
 put(e){
  e.root.visible=false;e.root.removeFromParent();e.native?.stop?.();
  let list=this.pool.get(e.motion);if(!list){list=[];this.pool.set(e.motion,list);}
  if(list.length<6){list.push(e);return;}
  e.native?.dispose?.();e.root.traverse(o=>{if(o.isMesh&&o!==e.marker&&o!==e.fringe&&o!==e.wave&&o.geometry!==warningCircle&&o.geometry!==warningRect)o.geometry?.dispose();o.material?.dispose?.();});
 }
 async warm(renderer,camera){
  // First use is GPU-warmed behind the loading screen, not in the combat frame.
  const target=new THREE.WebGLRenderTarget(32,32),before=renderer.getRenderTarget();
  try{
   for(const motion of ['beam','venom','charge','stomp','swipe']){
    const count=motion==='beam'||motion==='venom'?3:2;
    for(let i=0;i<count;i++){
     const e=this.make(motion),stage=new THREE.Scene();
     stage.add(e.root);e.native?.group&&(e.native.group.visible=true);
     if(e.native&&motion==='beam')e.native.setEndpoints(new THREE.Vector3(0,7,0),new THREE.Vector3(10,7,6));
     e.native?.update(.016);
     await renderer.compileAsync(stage,camera);
     renderer.setRenderTarget(target);renderer.render(stage,camera);
     renderer.setRenderTarget(before);
     this.scene.add(e.root);this.put(e);
    }
   }
  }finally{renderer.setRenderTarget(before);target.dispose();}
 }
 updateEntry(e,s,now,mouth=null){
  const {marker,fringe,wave,native}=e,aim=s.aim||s.origin,origin=s.origin;
  const dx=aim[0]-origin[0],dz=aim[2]-origin[2],length=Math.max(.01,Math.hypot(dx,dz));
  const warning=s.phase==='warning',active=s.phase==='active';
  marker.visible=warning;fringe.visible=warning&&s.motion!=='charge'&&s.motion!=='beam';
  marker.material.opacity=.36+.28*Math.sin(now*.024);
  const r=s.radius||5;
  if(s.motion==='beam'||s.motion==='charge'){
   const reach=s.motion==='beam'?BEAM_RANGE:length;
   marker.scale.set(r*2,reach,1);
   marker.position.set(origin[0]+dx/length*reach/2,.16,origin[2]+dz/length*reach/2);
   // Plane's local +Y maps to world -Z; orient along the marked world path.
   marker.rotation.set(-Math.PI/2,0,Math.atan2(dx,dz)+Math.PI);
  }else{
   marker.position.set(s.motion==='swipe'?origin[0]:aim[0],.16,s.motion==='swipe'?origin[2]:aim[2]);
   marker.scale.setScalar(r);marker.rotation.set(-Math.PI/2,0,0);
   fringe.position.copy(marker.position);fringe.scale.setScalar(r*1.02);
  }
  wave.visible=active&&(s.motion==='stomp'||s.motion==='swipe');
  if(wave.visible){
   const t=Math.min(1,Math.max(0,(now-s.start)/Math.max(1,s.end-s.start)));
   const c=s.motion==='stomp'?aim:origin;
   wave.position.set(c[0],.20,c[2]);
   wave.scale.setScalar(Math.max(.01,r*t));wave.material.opacity=.90*(1-t);
  }
  if(e.rubble){
   e.rubble.visible=active;e.fractures.visible=active;
   if(active){
    const phase=Math.min(1,Math.max(0,(now-s.start)/Math.max(1,s.end-s.start)));
    const origin=s.aim||s.origin;
    const mat=new THREE.Matrix4(),pos=new THREE.Vector3(),rot=new THREE.Quaternion(),
     scale=new THREE.Vector3(),axis=new THREE.Vector3(.4,.8,.3).normalize();
    e.fractures.position.set(origin[0],.03,origin[2]);
    e.fractures.scale.setScalar(Math.max(.01,(s.radius||7)/7*Math.min(1,phase*5)));
    for(let j=0;j<32;j++){
     const angle=j*2.3999632297,r=(.4+(j%11)/10)*Math.min(1,phase*4)*(s.radius||7)*.8;
     const lift=Math.sin(Math.PI*phase)*(1+(j%7)*.34);
     pos.set(origin[0]+Math.cos(angle)*r,.22+lift,origin[2]+Math.sin(angle)*r);
     rot.setFromAxisAngle(axis,phase*(j%2?9:-7)+j);
     scale.setScalar(.42+(j%5)*.22);
     mat.compose(pos,rot,scale);e.rubble.setMatrixAt(j,mat);
    }
    e.rubble.instanceMatrix.needsUpdate=true;
   }
  }
  if(!native)return;
  native.group.visible=active;
  if(!active)return;
  if(s.motion==='beam'){
   const a=mouth?.isVector3?mouth:new THREE.Vector3(origin[0],ENEMY_HEIGHT*.86,origin[2]);
   const b=new THREE.Vector3(aim[0],(aim[1]||0)+1.3,aim[2]);
   native.group.position.set(0,0,0);native.group.quaternion.identity();
   native.setEndpoints(a,b);
  }else{
   native.group.position.set(aim[0],.05,aim[2]);
   native.group.quaternion.identity();
   native.group.scale.setScalar(Math.max(.35,r/3.4));
  }
  const dt=e.last?Math.min(.06,Math.max(.001,(now-e.last)/1000)):.016;
  e.last=now;native.update(dt);
 }
 sync(states,now,mouthForState=()=>null){
  const needed=new Set();
  for(const state of states){
   if(!state?.active)continue;
   for(const s of state.skills||[]){
    if(!s.motion||now>=s.end)continue;
    const key=state.id+':'+s.id;needed.add(key);
    let e=this.live.get(key);
    if(!e){e=this.take(s.motion);this.scene.add(e.root);this.live.set(key,e);}
    this.updateEntry(e,s,now,s.motion==='beam'?mouthForState(state,s):null);
   }
  }
  for(const [key,e] of this.live)if(!needed.has(key)){this.put(e);this.live.delete(key);}
 }
}
