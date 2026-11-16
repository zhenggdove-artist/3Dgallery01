import * as THREE from 'three';
import {oddParts} from './reletter/odd-weapon-art.js';
import {calicoPellets,CALICO_PELLET_COUNT} from './shared/calico-pellets.js';
import {GOLDFISH_SWIM_MS} from './shared/weapon-abilities.js';
import {projectileFlightMs} from './shared/combat-balance.js';

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
   rays=event.pellets?.length===CALICO_PELLET_COUNT?event.pellets:calicoPellets(event.direction,full,event.time).map(p=>p.direction),
   group=new THREE.Group(),balls=[];
  group.name='Twenty independent glowing rainbow shotgun spheres';
  const palette=['#ff326d','#ffbd39','#fcff63','#29e8ac','#41beff','#9e69ff','#ff82dd','#ffffff'];
  const textureColors=palette.map(hex=>new THREE.Color(hex));
  rays.forEach((ray,i)=>{
   // Every pellet has hundreds of shaded faces with its OWN intertwined
   // ribbons, marbling and iridescent colours, not one flat disc/colour.
   const geometry=new THREE.SphereGeometry(1,40,28);
   const positions=geometry.attributes.position,colors=new Float32Array(positions.count*3);
   for(let n=0;n<positions.count;n++){
    const x=positions.getX(n),y=positions.getY(n),z=positions.getZ(n);
    const latitude=Math.atan2(y,Math.hypot(x,z)),longitude=Math.atan2(z,x);
    const ribbon=Math.sin(longitude*7+latitude*5+i*1.39)+.56*Math.sin(longitude*15-latitude*9-i*.83);
    const marble=Math.sin(x*13.4+y*9.2-z*11.7+i*2.1)*Math.cos(y*18.1+z*7.6+i);
    const contour=Math.sin(longitude*23+latitude*15+i*.41);
    const index=Math.abs(Math.floor((ribbon*2.2+marble*2.1+contour+12+i*2.13)*2))%textureColors.length;
    const next=(index+2+(i%3))%textureColors.length;
    const blend=.22+.24*(.5+.5*Math.sin(longitude*12-latitude*21+i));
    const color=textureColors[index].clone().lerp(textureColors[next],blend);
    const bright=.75+.25*(.5+.5*Math.cos(x*28+y*19+z*13+i));
    colors.set([color.r*bright,color.g*bright,color.b*bright],n*3);
   }
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
   const surface=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.12,metalness:.06,
    clearcoat:1,clearcoatRoughness:.04,emissive:palette[i%palette.length],
    emissiveIntensity:.38,toneMapped:false});
   const ball=new THREE.Mesh(geometry,surface);
   ball.name='Multicolour sphere '+(i+1);
   ball.scale.setScalar((full?.29:.21)*scale);
   ball.position.copy(source);
   ball.rotation.set(i*.41,i*.69,i*.23);
   // Additive halo stays attached to its real raycasted 3D projectile.
   const halo=new THREE.Mesh(new THREE.SphereGeometry(1.16,12,8),
    new THREE.MeshBasicMaterial({color:palette[i%palette.length],transparent:true,opacity:.30,
      depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
   halo.scale.setScalar(1.45);halo.name='Prismatic glow '+(i+1);
   ball.add(halo);
   group.add(ball);
   balls.push({ball,dir:vec(ray).normalize(),spin:i*.5});
  });
  const duration=projectileFlightMs({pattern:'scatter'},full)/1000,range=event.range||10;
  this.add(group,duration,age=>{
   const t=Math.min(1,age/duration);
   for(const b of balls){
    b.ball.position.copy(source).addScaledVector(b.dir,range*t);
    b.ball.rotation.y=b.spin+age*10;
    b.ball.rotation.x=age*5+b.spin;
   }
  });
 }
 goldfish(event){
  const origin=vec(event.origin),direction=vec(event.direction).normalize();
  const quality=event.qualityScale||1,duration=GOLDFISH_SWIM_MS/1000*(event.qualityDuration||1);
  const group=new THREE.Group(),fish=new THREE.Group();
  group.name='Translucent spectral goldfish swimming forward';
  group.add(fish);
  // A glasslike moving fish image rather than a solid stack of toy primitives.
  const bodyGeo=new THREE.SphereGeometry(1,48,32);
  const glow=(color,opacity)=>new THREE.MeshPhysicalMaterial({
   color,emissive:color,emissiveIntensity:.17,metalness:.08,roughness:.3,
   clearcoat:1,clearcoatRoughness:.18,transparent:true,opacity,
   depthWrite:false,side:THREE.DoubleSide,transmission:.10,thickness:.12
  });
  const amber=glow('#ff9f4e',.37),pearl=glow('#ffe8af',.29),
   finMat=glow('#ffb467',.24),rim=glow('#fff2d9',.55),eye=glow('#162b40',.8);
  const add=(parent,geo,mat,pos,scale)=>{
   const mesh=new THREE.Mesh(geo,mat);mesh.position.set(...pos);mesh.scale.set(...scale);
   parent.add(mesh);return mesh;
  };
  add(fish,bodyGeo,amber,[0,0,0],[.86,.66,1.36]);
  add(fish,bodyGeo,pearl,[0,-.21,.43],[.77,.43,.9]);
  add(fish,bodyGeo,amber,[0,.09,1.03],[.67,.57,.67]);
  add(fish,bodyGeo,rim,[0,-.21,1.54],[.24,.14,.12]);
  for(const side of [-1,1]){
   add(fish,bodyGeo,rim,[side*.59,.21,1.2],[.21,.22,.10]);
   add(fish,bodyGeo,eye,[side*.65,.21,1.31],[.11,.13,.055]);
   add(fish,bodyGeo,finMat,[side*.79,-.12,-.13],[.24,.76,.09]).rotation.z=side*.48;
   // Curved gill filaments and light-catching seams define the facial profile.
   for(let i=0;i<3;i++){
    const curve=new THREE.CatmullRomCurve3([
     new THREE.Vector3(side*(.56+i*.06),.33,1.04-i*.12),
     new THREE.Vector3(side*(.73+i*.04),0,.94-i*.12),
     new THREE.Vector3(side*(.56+i*.06),-.27,.99-i*.12)]);
    fish.add(new THREE.Mesh(new THREE.TubeGeometry(curve,18,.009,5,false),rim));
   }
  }
  add(fish,bodyGeo,finMat,[0,.73,-.23],[.20,.62,.44]);
  const tail=new THREE.Group();tail.position.z=-1.3;fish.add(tail);
  for(const side of [-1,1]){
   const blade=add(tail,bodyGeo,finMat,[side*.35,.03,-.55],[.55,.83,.11]);
   blade.rotation.z=side*.35;
   for(let i=0;i<5;i++){
    const line=new THREE.CatmullRomCurve3([
     new THREE.Vector3(0,0,-.05),
     new THREE.Vector3(side*(.22+i*.065),.05+(i-2)*.16,-.48),
     new THREE.Vector3(side*(.36+i*.075),.05+(i-2)*.28,-.91)]);
    tail.add(new THREE.Mesh(new THREE.TubeGeometry(line,14,.006,4,false),rim));
   }
  }
  // Four semi-transparent temporal silhouettes supply a depth-bearing motion blur.
  const ghosts=[];
  for(let i=0;i<4;i++){
   const echo=fish.clone(true);
   echo.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.opacity*=.34/(i+1);o.material.depthWrite=false;}});
   group.add(echo);ghosts.push(echo);
  }
  const orientation=qdir(direction);
  fish.scale.setScalar(2.5*quality);
  this.add(group,duration,age=>{
   const progress=Math.min(1,age/duration);
   const travel=(event.range||32)*progress;
   group.position.copy(origin).addScaledVector(direction,travel);
   group.quaternion.copy(orientation);
   // The fish is authored facing local +Z; qdir already maps +Z to travel.
   // Any additional 90-degree yaw makes the nose point LEFT. Keep only swim sway.
   const yaw=Math.sin(age*8)*.045;
   fish.rotation.y=yaw;
   fish.rotation.z=Math.sin(age*7)*.035;
   tail.rotation.y=Math.sin(age*16)*.44;
   for(let i=0;i<ghosts.length;i++){
    const echo=ghosts[i],lag=(i+1)*.41;
    echo.position.set(0,0,-lag);
    echo.rotation.y=yaw-Math.sin(age*5-i)*.045;
    echo.rotation.z=fish.rotation.z;
    echo.scale.setScalar(2.5*quality*(1-.07*(i+1)));
    echo.visible=progress>(i+1)*.006;
   }
   const fade=Math.min(1,age*6,(duration-age)*7);
   group.scale.setScalar(Math.max(0,fade));
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
   group.position.copy(origin).addScaledVector(dir,distance); // identical server-owned sin(πt) route
   group.quaternion.copy(orientation);
   model.rotation.z=age*15.5;
   model.rotation.x=Math.sin(age*13)*.25;
  });
 }
 play(event,item,ownerRoot){
  if(item.id==='calico-cat')return this.shotgun(event),true;
  if(!event.ultimate)return false;
  if(item.id==='giraffe')return this.giraffe(event,ownerRoot),true;
  if(item.id==='goldfish')return this.goldfish(event),true;
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
