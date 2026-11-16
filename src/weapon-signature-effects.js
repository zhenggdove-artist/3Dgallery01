import * as THREE from 'three';
import {oddParts} from './reletter/odd-weapon-art.js';
import {calicoPellets} from './shared/calico-pellets.js';

const TAU=Math.PI*2;
const sphere=new THREE.SphereGeometry(1,16,12);
const geomCone=new THREE.ConeGeometry(1,1,6);
const geomBox=new THREE.BoxGeometry(1,1,1);
const COLORS=['#ff365e','#ffa82f','#faff5a','#39ef94','#48ceff','#8b63ff','#ff82ce','#ff6f38','#baff58','#79f6ff'];
const qdir=dir=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),dir);
const vec=a=>new THREE.Vector3(...(a||[0,0,1]));
const material=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity>=1,toneMapped:false});
const lineMat=(color,opacity=.8)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
const stable=(n)=>((Math.sin(n*127.1+17.7)*43758.5453)%1+1)%1;

export class WeaponSignatureEffects {
 constructor(scene){this.scene=scene;this.active=[];this.maxActive=18;}
 add(obj,duration,update){
  if(this.active.length>=this.maxActive)this.remove(this.active[0]);
  const e={obj,age:0,duration,update};this.scene.add(obj);this.active.push(e);return e;
 }
 remove(e){
  this.active.splice(this.active.indexOf(e),1);e.obj.removeFromParent();
  e.obj.traverse(o=>{if(o.geometry&&![sphere,geomBox,geomCone].includes(o.geometry))o.geometry.dispose();
    if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
 }
 shotgun(event){
  const source=vec(event.origin),full=!!event.ultimate,scale=event.qualityScale||1,
   rays=event.pellets?.length===10?event.pellets:calicoPellets(event.direction,full).map(p=>p.direction),
   group=new THREE.Group(),balls=[];
  group.name='Ten actual coloured pellet spheres (server aligned)';
  rays.forEach((ray,i)=>{
   const core=new THREE.Mesh(sphere,material(COLORS[i],.995));
   core.scale.setScalar((full?.57:.30)*scale);
   const halo=new THREE.Mesh(sphere,lineMat(COLORS[i],.24));
   halo.scale.setScalar((full?.88:.51)*scale);
   group.add(halo,core);
   balls.push({core,halo,dir:vec(ray).normalize(),offset:i*.012});
  });
  const duration=full?.47:.33,range=event.range||10;
  this.add(group,duration,(age)=>{
   const t=Math.min(1,age/duration);
   for(const b of balls){
    const motion=Math.max(0,Math.min(1,(t-b.offset)*1.5));
    const p=source.clone().addScaledVector(b.dir,range*motion);
    b.core.position.copy(p);b.halo.position.copy(p);
    b.halo.material.opacity=.28*(1-t*.7);
    b.core.material.opacity=1-t*.62;b.core.material.transparent=true;b.core.material.depthWrite=false;
   }
  });
 }
 flower(event){
  const quality=event.qualityScale||1,origin=vec(event.origin),direction=vec(event.direction).normalize();
  const num=2400,positions=new Float32Array(num*3),colors=new Float32Array(num*3);
  const palette=['#ffe3f6','#ff8dce','#edaaff','#c8bdff','#ffb9e7','#fff4fd'];
  for(let i=0;i<num;i++){
   const petal=i%9,angle=petal*TAU/9,rand=stable(i*3.7);
   const t=Math.sqrt(stable(i*17.3)),radius=.30+t*5.4;
   const lateral=(stable(i*23.7)*2-1)*(1.05+Math.sin(t*Math.PI)*1.9);
   positions[i*3]=(Math.cos(angle)*radius-Math.sin(angle)*lateral)*quality;
   positions[i*3+1]=(Math.sin(angle)*radius+Math.cos(angle)*lateral)*quality;
   positions[i*3+2]=(Math.sin(t*Math.PI+angle)*.42+(rand-.5)*.75)*quality;
   const c=new THREE.Color(palette[petal%palette.length]);
   colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const m=new THREE.PointsMaterial({size:.15*quality,vertexColors:true,transparent:true,opacity:.9,
    sizeAttenuation:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const blossom=new THREE.Points(g,m),group=new THREE.Group();
  group.name='One enormous forward rotating translucent particle blossom';group.add(blossom);
  const orientation=qdir(direction);
  const duration=3.3*(event.qualityDuration||1);
  this.add(group,duration,age=>{
   const t=Math.min(1,age/duration);
   group.position.copy(origin).addScaledVector(direction,(event.range||18)*.78*t);
   group.quaternion.copy(orientation);blossom.rotation.z=age*1.1;
   m.opacity=Math.min(.95,t*6)*(1-Math.pow(t,3))*.9;
  });
 }
 thorns(event){
  const scale=event.qualityScale||1,center=vec(event.area?.center||event.impactPoint||event.origin);
  center.y=Math.max(.05,center.y);
  const group=new THREE.Group();group.name='Three stacked solid thorn-vine tiers';
  const leaves=[];
  for(let tier=0;tier<3;tier++){
   const baseY=tier*3.45;
   for(let coil=0;coil<3;coil++){
    const pts=[],turns=2.3+(tier%2)*.3;
    for(let k=0;k<=90;k++){
     const t=k/90,angle=t*TAU*turns+coil*TAU/3+tier*1.4;
     const radius=(1.55+Math.sin(t*Math.PI)*.4)*scale;
     pts.push(new THREE.Vector3(Math.cos(angle)*radius,baseY+3.6*t,Math.sin(angle)*radius));
    }
    const curve=new THREE.CatmullRomCurve3(pts),tube=new THREE.Mesh(
      new THREE.TubeGeometry(curve,100,(.10+tier*.012)*scale,6,false),
      material(tier===1?'#84ed93':coil===0?'#477f52':'#79cd78'));
    group.add(tube);
    // Clearly articulated three-dimensional thorns, not a three-layer dust cloud.
    for(let i=4;i<87;i+=5){
     const position=curve.getPoint(i/90),tangent=curve.getTangent(i/90);
     const radial=new THREE.Vector3(position.x,0,position.z).normalize();
     const thorn=new THREE.Mesh(geomCone,material(i%3?'#d3ff87':'#91ff9a'));
     thorn.scale.set(.17*scale,(.52+stable(i*11+tier)*.39)*scale,.17*scale);
     thorn.position.copy(position).addScaledVector(radial,.14);
     thorn.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),radial.clone().addScaledVector(tangent,.35).normalize());
     group.add(thorn);leaves.push(thorn);
    }
   }
  }
  this.add(group,3.6*(event.qualityDuration||1),age=>{
   const t=Math.min(1,age/.85);
   group.position.copy(center);group.rotation.y=age*.7;
   group.scale.set(1,Math.max(.02,t*t*(3-2*t)),1);
   const fade=Math.min(1,(3.6*(event.qualityDuration||1)-age)*2);
   for(const child of group.children)child.material.opacity=fade;
  });
 }
 tornado(event){
  const quality=event.qualityScale||1,origin=vec(event.origin),direction=vec(event.direction).normalize(),
    right=new THREE.Vector3(direction.z,0,-direction.x),range=event.range||20,tier=event.qualityTier||3,
    duration=(1400+tier*850)*(event.qualityDuration||1)/1000,
    group=new THREE.Group(),vortices=[];
  group.name='Four independent wandering volumetric tornadoes';
  for(let i=0;i<4;i++){
   const count=640,positions=new Float32Array(count*3),cols=new Float32Array(count*3);
   const tint=new THREE.Color(['#bffff3','#8feede','#d6f8f0','#a6d9ff'][i]);
   for(let j=0;j<count;j++){
    const y=(j%91)/90,angle=stable(j*11.73+i*9.7)*TAU;
    const radius=(.28+y*2.0)*quality*(.7+stable(j*13.7+i)*.6);
    positions[j*3]=Math.cos(angle)*radius;
    positions[j*3+1]=y*10*quality;
    positions[j*3+2]=Math.sin(angle)*radius;
    const brightness=.5+y*.5;
    cols[j*3]=tint.r*brightness;cols[j*3+1]=tint.g*brightness;cols[j*3+2]=tint.b*brightness;
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
   const mat=new THREE.PointsMaterial({size:.15*quality,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending});
   const v=new THREE.Points(geo,mat);v.name='Wandering tornado '+(i+1);
   group.add(v);vortices.push(v);
  }
  this.add(group,duration,age=>{
   const t=Math.min(1,age/duration);
   vortices.forEach((v,i)=>{
    const seed=i*1.618+(event.time||0)*.0003;
    const side=Math.sin(seed+t*12)*2.8+Math.sin(seed*2.7+t*27)*1.5;
    v.position.copy(origin).addScaledVector(direction,range*t).addScaledVector(right,side);
    v.rotation.y=age*(4.2+i*.85);
    v.material.opacity=.78*Math.min(1,age*5)*(1-Math.pow(t,4));
   });
  });
 }
 giraffe(event,ownerRoot){
  const quality=event.qualityScale||1,origin=vec(event.origin),dir=vec(event.direction).normalize();
  const giraffe=new THREE.Group();giraffe.name='Visible spinning yellow giraffe model, outbound and returning';
  for(const p of oddParts('giraffe')){
   const g=p.shape==='box'?geomBox:p.shape==='cone'?geomCone:sphere;
   const m=new THREE.Mesh(g,material(p.color));m.position.set(p.x,p.y,p.z);m.scale.set(p.sx,p.sy,p.sz);giraffe.add(m);
  }
  // It must read as ONE recognizable yellow giraffe, not a V-shaped dust trail.
  const model=new THREE.Group();model.add(giraffe);
  const group=new THREE.Group();group.name='Visible spinning yellow giraffe model, outbound and returning';group.add(model);
  giraffe.scale.setScalar(5.4*quality);
  const orientation=qdir(dir),duration=2.3;
  this.add(group,duration,age=>{
   const t=Math.min(1,age/duration),distance=Math.sin(t*Math.PI)*(event.range||28);
   const home=(ownerRoot?.position||origin),last=Math.max(0,(t-.82)/.18);
   group.position.copy(origin).addScaledVector(dir,distance);
   if(last>0)group.position.lerp(home.clone?home.clone().add(new THREE.Vector3(0,1,0)):origin,last);
   group.quaternion.copy(orientation);
   model.rotation.z=age*15.5;
   model.rotation.x=Math.sin(age*13)*.25;
  });
 }
 play(event,item,ownerRoot){
  if(item.id==='calico-cat')return this.shotgun(event),true;
  if(!event.ultimate)return false;
  if(item.id==='giraffe')return this.giraffe(event,ownerRoot),true;
  if(item.id==='fan')return this.tornado(event),true;
  if(item.family==='petal')return this.flower(event),true;
  if(item.family==='planter'&&!item.exotic)return this.thorns(event),true;
  return false;
 }
 update(dt){
  for(const entry of [...this.active]){
   entry.age+=dt;entry.update(entry.age);
   if(entry.age>=entry.duration)this.remove(entry);
  }
 }
 dispose(){for(const e of [...this.active])this.remove(e);}
}
