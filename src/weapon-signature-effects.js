import {createFlexibleGiraffe,animateFlexibleGiraffe} from './reletter/flexible-giraffe.js';
import * as THREE from 'three';
import {itemById} from './shared/catalog.js';
import {oddParts} from './reletter/odd-weapon-art.js';
import {calicoPellets,CALICO_PELLET_COUNT} from './shared/calico-pellets.js';
import {GOLDFISH_SWIM_MS} from './shared/weapon-abilities.js';
import {GOLDFISH_SCHOOL_COUNT,GOLDFISH_SCHOOL_OFFSETS,GOLDFISH_FISH_SCALE} from './shared/goldfish-school.js';
import {projectileFlightMs} from './shared/combat-balance.js';
import nativeArcRay from '../vendor/00gamedevs/arc-ray.js';

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
 constructor(scene){this.scene=scene;this.active=[];this.maxActive=18;this.recycled=new Map();this.recycledCount=0;}
 take(key){
  const list=this.recycled.get(key);
  if(!list?.length)return null;
  this.recycledCount--;return list.pop();
 }
 add(obj,duration,update,key=null){
  if(this.active.length>=this.maxActive)this.remove(this.active[0]);
  const e={obj,age:0,duration,update,key};this.scene.add(obj);this.active.push(e);return e;
 }
 disposeGroup(obj){
  obj.removeFromParent();
  obj.traverse(o=>{if(o.geometry&&![sphere,geomBox,geomCone].includes(o.geometry))o.geometry.dispose();
    if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
 }
 remove(e){
  const index=this.active.indexOf(e);if(index<0)return;
  this.active.splice(index,1);e.obj.removeFromParent();
  let list=this.recycled.get(e.key);
  if(e.key&&(!list||list.length<3)&&this.recycledCount<15){
   if(!list){list=[];this.recycled.set(e.key,list);}
   list.push(e.obj);this.recycledCount++;return;
  }
  this.disposeGroup(e.obj);
 }
 async warm(renderer,camera){
  // Construct representative signature skills while the loading screen is visible.
  // Keep their actual 3D models and GPU buffers for first-use playback.
  const event={id:'prewarm',origin:[0,1,0],direction:[0,0,1],range:18,
   qualityScale:1,qualityTier:2,qualityDuration:1,ultimate:true,time:1234,
   area:{mode:'area',center:[0,.1,10],visualCenter:[0,.1,10],radius:4}};
  const stage=new THREE.Scene();
  try{
   for(const id of ['calico-cat','calico-cat','goldfish','fan','bloom-1','planter-1','giraffe']){
    const item=itemById(id);
    if(item)this.play(event,item,null);
   }
   for(const e of this.active){stage.add(e.obj);e.update(.016);}
   await renderer.compileAsync(stage,camera);
   if(typeof renderer.getRenderTarget==='function'&&typeof renderer.setRenderTarget==='function'&&typeof renderer.render==='function'){
    const target=new THREE.WebGLRenderTarget(32,32),prior=renderer.getRenderTarget();
    try{renderer.setRenderTarget(target);renderer.render(stage,camera);}finally{renderer.setRenderTarget(prior);target.dispose();}
   }
  }finally{
   for(const e of [...this.active])this.remove(e);
  }
 }
 goldfishBubble(event){
  const key='goldfish-bubble',group=this.take(key)||new THREE.Group();
  if(!group.children.length){
   group.name='High-rate translucent goldfish water cannon ball';
   const core=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({
    color:'#063276',transparent:true,opacity:.85,metalness:.12,roughness:.08,
    emissive:'#041b5d',emissiveIntensity:.65,depthWrite:false
   }));
   const shell=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({
    color:'#104b9d',transparent:true,opacity:.35,depthWrite:false,
    blending:THREE.AdditiveBlending
   }));
   const geometry=new THREE.BufferGeometry(),points=new Float32Array(42*3);
   for(let i=0;i<42;i++){
    const a=i*2.39996323,y=1-2*(i+.5)/42,r=Math.sqrt(1-y*y);
    points[i*3]=r*Math.cos(a);points[i*3+1]=y;points[i*3+2]=r*Math.sin(a);
   }
   geometry.setAttribute('position',new THREE.BufferAttribute(points,3));
   const sparkle=new THREE.Points(geometry,new THREE.PointsMaterial({
    color:'#3276c5',size:.09,transparent:true,opacity:.9,
    blending:THREE.AdditiveBlending,depthWrite:false
   }));
   group.add(core,shell,sparkle);
   group.userData.ball={core,shell,sparkle};
  }
  const origin=vec(event.origin),direction=vec(event.direction).normalize();
  const range=Math.max(1,Math.min(11,Number(event.range)||11)),duration=.39;
  this.add(group,duration,age=>{
   const t=Math.min(1,age/duration);
   group.position.copy(origin).addScaledVector(direction,t*range);
   const wobble=.92+.09*Math.sin(age*47);
   group.scale.setScalar(.35*wobble*(1-.40*Math.pow(t,5)));
   group.rotation.y=age*16;
   group.userData.ball.shell.material.opacity=.32*(1-t*.4);
  },key);
 }
 shotgun(event){
  const source=vec(event.origin),full=!!event.ultimate,scale=event.qualityScale||1,
   rays=event.pellets?.length===CALICO_PELLET_COUNT?event.pellets:calicoPellets(event.direction,full,event.time).map(p=>p.direction),
   group=this.take('shotgun')||new THREE.Group(),balls=[];
  group.name='Twenty independent glowing rainbow shotgun spheres';
  const palette=['#ff326d','#ffbd39','#fcff63','#29e8ac','#41beff','#9e69ff','#ff82dd','#ffffff'];
  const textureColors=palette.map(hex=>new THREE.Color(hex));
  if(!group.children.length)rays.forEach((ray,i)=>{
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
    emissiveIntensity:.38,toneMapped:false,transparent:true,opacity:1,depthWrite:false});
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
  else group.children.forEach((ball,i)=>{
   ball.material.opacity=1;ball.children[0].material.opacity=.30;
   ball.position.copy(source);ball.rotation.set(i*.41,i*.69,i*.23);
   balls.push({ball,dir:vec(rays[i]).normalize(),spin:i*.5});
  });
  const duration=projectileFlightMs({pattern:'scatter'},full)/1000,range=event.range||10;
  this.add(group,duration,age=>{
   const t=Math.min(1,age/duration);
   for(const b of balls){
    b.ball.position.copy(source).addScaledVector(b.dir,range*t);
    b.ball.rotation.y=b.spin+age*10;
    b.ball.rotation.x=age*5+b.spin;
    // The physical sphere and its additive halo must dissolve together,
    // rather than vanishing in one frame at their authoritative expiry.
    const fade=Math.min(1,Math.max(0,(1-t)/.30));
    b.ball.material.opacity=fade;
    b.ball.children[0].material.opacity=.30*fade;
    b.ball.scale.setScalar((full?.29:.21)*scale*(.72+.28*fade));
   }
  },'shotgun');
 }
 goldfish(event){
  const origin=vec(event.origin),direction=vec(event.direction).normalize();
  const quality=event.qualityScale||1,duration=GOLDFISH_SWIM_MS/1000*(event.qualityDuration||1);
  const cached=this.take('goldfish');
  const group=cached||new THREE.Group(),fish=cached?.userData.fish||new THREE.Group();
  group.name='Translucent spectral goldfish swimming forward';
  let tail=cached?.userData.tail;
  if(!cached){group.add(fish);
  // A glasslike moving fish image rather than a solid stack of toy primitives.
  // Baked dorsal-to-belly gradient, with distinctly dark backs, warm orange
  // flanks and light-gold undersides. Shaded per vertex with no refraction.
  const bodyGeo=new THREE.SphereGeometry(1,20,12);
  const positions=bodyGeo.getAttribute('position'),gradient=new Float32Array(positions.count*3);
  const dorsal=new THREE.Color('#70302f'),flank=new THREE.Color('#ff7850'),belly=new THREE.Color('#ffe5a3');
  const mixed=new THREE.Color();
  for(let i=0;i<positions.count;i++){
   const y=positions.getY(i),h=THREE.MathUtils.smoothstep(y,-.65,.68);
   if(h<.5)mixed.copy(belly).lerp(flank,h*2);
   else mixed.copy(flank).lerp(dorsal,(h-.5)*2);
   gradient[i*3]=mixed.r;gradient[i*3+1]=mixed.g;gradient[i*3+2]=mixed.b;
  }
  bodyGeo.setAttribute('color',new THREE.BufferAttribute(gradient,3));
  const glow=(color,opacity,vertexColors=false)=>new THREE.MeshLambertMaterial({
   color,vertexColors,emissive:new THREE.Color(color).multiplyScalar(.16),
   emissiveIntensity:.52,transparent:opacity<1,opacity,
   depthWrite:opacity>=1,side:THREE.DoubleSide
  });
  const amber=glow('#ffb18e',.99,true),pearl=glow('#ffcf92',.96,true),
   finMat=glow('#ffac54',.88),rim=glow('#711e23',.98),
   highlight=glow('#ffebbd',.98),eye=glow('#21131a',1);
  const add=(parent,geo,mat,pos,scale)=>{
   const mesh=new THREE.Mesh(geo,mat);mesh.position.set(...pos);mesh.scale.set(...scale);
   parent.add(mesh);return mesh;
  };
  add(fish,bodyGeo,amber,[0,0,0],[.86,.66,1.36]);
  add(fish,bodyGeo,pearl,[0,-.30,.32],[.74,.38,.92]);
  add(fish,bodyGeo,amber,[0,.09,1.03],[.67,.57,.67]);
  add(fish,bodyGeo,highlight,[0,-.21,1.54],[.24,.14,.12]);
  add(fish,bodyGeo,rim,[0,.67,-.14],[.12,.10,.98]);
  for(const side of [-1,1]){
   add(fish,bodyGeo,highlight,[side*.59,.21,1.2],[.21,.22,.10]);
   add(fish,bodyGeo,eye,[side*.65,.21,1.31],[.11,.13,.055]);
   add(fish,bodyGeo,highlight,[side*.695,.245,1.34],[.038,.039,.029]);
   add(fish,bodyGeo,rim,[side*.79,-.13,-.13],[.28,.78,.105]).rotation.z=side*.48;
   add(fish,bodyGeo,finMat,[side*.81,-.13,-.12],[.23,.7,.12]).rotation.z=side*.48;
   // Curved gill filaments and light-catching seams define the facial profile.
   for(let i=0;i<3;i++){
    const curve=new THREE.CatmullRomCurve3([
     new THREE.Vector3(side*(.56+i*.06),.33,1.04-i*.12),
     new THREE.Vector3(side*(.73+i*.04),0,.94-i*.12),
     new THREE.Vector3(side*(.56+i*.06),-.27,.99-i*.12)]);
    fish.add(new THREE.Mesh(new THREE.TubeGeometry(curve,8,.023,4,false),rim));
   }
  }
  add(fish,bodyGeo,rim,[0,.73,-.23],[.24,.65,.46]);
  add(fish,bodyGeo,finMat,[0,.78,-.22],[.18,.60,.44]);
  tail=new THREE.Group();tail.position.z=-1.3;fish.add(tail);
  for(const side of [-1,1]){
   const edge=add(tail,bodyGeo,rim,[side*.37,.03,-.58],[.61,.88,.13]);
   edge.rotation.z=side*.35;
   const blade=add(tail,bodyGeo,finMat,[side*.35,.03,-.55],[.51,.78,.14]);
   blade.rotation.z=side*.35;
   for(let i=0;i<5;i++){
    const line=new THREE.CatmullRomCurve3([
     new THREE.Vector3(0,0,-.05),
     new THREE.Vector3(side*(.22+i*.065),.05+(i-2)*.16,-.48),
     new THREE.Vector3(side*(.36+i*.075),.05+(i-2)*.28,-.91)]);
    tail.add(new THREE.Mesh(new THREE.TubeGeometry(line,8,.018,4,false),highlight));
   }
  }
  // Keep the detailed original fish as a hidden source for GPU instancing.
  // Every body part, eye, gill and animated tail retains its existing model,
  // but thirty fish need only one draw call PER part, not thirty draw calls.
  const school=new THREE.Group();school.name='30 individually swimming goldfish';
  const parts=[];
  fish.traverse(node=>{
   if(!node.isMesh)return;
   const instances=new THREE.InstancedMesh(node.geometry,node.material,GOLDFISH_SCHOOL_COUNT);
   instances.frustumCulled=false;instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   const tints=['#ffffff','#ffe7bd','#fff4dc','#ffd0ae','#fff9ce','#ffdbbc'];
   const tint=new THREE.Color();
   for(let i=0;i<GOLDFISH_SCHOOL_COUNT;i++)
    instances.setColorAt(i,tint.set(tints[(i*7+Math.floor(i/4))%tints.length]));
   instances.instanceColor.needsUpdate=true;
   school.add(instances);parts.push({mesh:instances,source:node});
  });
  fish.visible=false;group.add(school);
  group.userData.fish=fish;group.userData.tail=tail;group.userData.school=school;group.userData.schoolParts=parts;
  // Reuse all transforms every frame: never allocate 30 matrices or vectors
  // while a school is swimming through simultaneous city combat.
  group.userData.schoolScratch={
   base:new THREE.Matrix4(),combined:new THREE.Matrix4(),
   offset:new THREE.Vector3(),rotation:new THREE.Quaternion(),
   scale:new THREE.Vector3(1,1,1),axis:new THREE.Vector3(0,1,0),
   transforms:Array.from({length:GOLDFISH_SCHOOL_COUNT},()=>new THREE.Matrix4())
  };
  }
  // The original four cloned fish multiplied meshes, draw calls and material
  // allocations by five, causing severe mobile stutters. No clones are built.
  const orientation=qdir(direction);
  fish.scale.setScalar(GOLDFISH_FISH_SCALE*quality);
  group.position.copy(origin);group.quaternion.copy(orientation);group.scale.setScalar(1);
  const flightEntry=this.add(group,duration,(age,world,dt=0)=> {
   const progress=Math.min(1,age/duration);
   const travel=(event.range||32)*progress;
   const track=world?.goldfishFlights?.find(v=>v.id===event.persistentAttackId);
   const target=track?.position?vec(track.position):
    origin.clone().addScaledVector(direction,travel);
   const desired=track?.direction?vec(track.direction).normalize():direction;
   // Smooth snapshots but never reset the fish to its initial straight line.
   if(age<.05)group.position.copy(target);
   else group.position.lerp(target,Math.min(1,Math.max(.08,dt*24)));
   group.quaternion.slerp(qdir(desired),Math.min(1,Math.max(.08,dt*20)));
   // The fish is authored facing local +Z; qdir already maps +Z to travel.
   // Any additional 90-degree yaw makes the nose point LEFT. Keep only swim sway.
   const yaw=Math.sin(age*8)*.045;
   fish.rotation.y=yaw;
   fish.rotation.z=Math.sin(age*7)*.035;
   tail.rotation.y=Math.sin(age*16)*.44;
   fish.updateMatrixWorld(true);
   const {base,combined,offset,rotation,scale,axis,transforms}=group.userData.schoolScratch;
   for(let i=0;i<GOLDFISH_SCHOOL_COUNT;i++){
    const [x,y,z]=GOLDFISH_SCHOOL_OFFSETS[i],phase=age*8+i*2.399963;
    offset.set(x+Math.sin(phase)*.08,y+Math.sin(phase*.71)*.065,z);
    rotation.setFromAxisAngle(axis,Math.sin(phase)*.19+Math.sin(i*3.17)*.14);
    scale.setScalar(.83+((i*11)%9)*.043);
    transforms[i].compose(offset,rotation,scale);
   }
   for(const {mesh,source} of group.userData.schoolParts){
    base.copy(source.matrix);
    for(let parent=source.parent;parent&&parent!==group;parent=parent.parent)
     base.premultiply(parent.matrix);
    for(let i=0;i<GOLDFISH_SCHOOL_COUNT;i++){
     combined.multiplyMatrices(transforms[i],base);
     mesh.setMatrixAt(i,combined);
    }
    mesh.instanceMatrix.needsUpdate=true;
   }
   const fade=Math.min(1,age*6,(duration-age)*7);
   group.scale.setScalar(Math.max(0,fade));
  },'goldfish');
  flightEntry.attackId=event.persistentAttackId||null;
 }
 flower(event){
  const quality=event.qualityScale||1,origin=vec(event.origin),direction=vec(event.direction).normalize();
  const key='flower',group=this.take(key)||new THREE.Group();
  let blossom=group.children[0],m=blossom?.material;
  if(!blossom){
  const num=2400,positions=new Float32Array(num*3),colors=new Float32Array(num*3);
  const palette=['#ffe3f6','#ff8dce','#edaaff','#c8bdff','#ffb9e7','#fff4fd'];
  for(let i=0;i<num;i++){
   const petal=i%9,angle=petal*TAU/9,rand=stable(i*3.7);
   const t=Math.sqrt(stable(i*17.3)),radius=.30+t*5.4;
   const lateral=(stable(i*23.7)*2-1)*(1.05+Math.sin(t*Math.PI)*1.9);
   positions[i*3]=(Math.cos(angle)*radius-Math.sin(angle)*lateral);
   positions[i*3+1]=(Math.sin(angle)*radius+Math.cos(angle)*lateral);
   positions[i*3+2]=(Math.sin(t*Math.PI+angle)*.42+(rand-.5)*.75);
   const c=new THREE.Color(palette[petal%palette.length]);
   colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  m=new THREE.PointsMaterial({size:.15*quality,vertexColors:true,transparent:true,opacity:.9,
    sizeAttenuation:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  blossom=new THREE.Points(g,m);group.add(blossom);
  }
  group.name='One enormous forward rotating translucent particle blossom';
  blossom.scale.setScalar(quality);m.size=.15*quality;
  const orientation=qdir(direction);group.position.copy(origin);group.quaternion.copy(orientation);blossom.rotation.z=0;m.opacity=.9;
  const duration=3.3*(event.qualityDuration||1);
  this.add(group,duration,age=>{
   const t=Math.min(1,age/duration);
   group.position.copy(origin).addScaledVector(direction,(event.range||18)*.78*t);
   group.quaternion.copy(orientation);blossom.rotation.z=age*1.1;
   m.opacity=Math.min(.95,t*6)*(1-Math.pow(t,3))*.9;
  },key);
 }
 thorns(event){
   const quality=event.qualityScale||1;
   // Match the now-halved authoritative area: the whole thorn tree,
  // leaves and vine branches shrink together rather than keeping a
  // minimum visual size at a previous quality-scaled radius.
   const scale=Math.max(.2,(Number(event.area?.radius)||Number(event.radius)||3.6)/1.95);
   const center=vec(event.area?.center||event.impactPoint||event.origin);
  center.y=Math.max(.05,center.y);
  const key='thorns:'+scale.toFixed(3),group=this.take(key)||new THREE.Group();
  group.name='Three stacked solid thorn-vine tiers';
  if(!group.children.length){
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
  }
  group.position.copy(center);group.rotation.y=0;group.scale.set(1,1,1);
  for(const child of group.children)child.material.opacity=1;
  this.add(group,3.6*(event.qualityDuration||1),age=>{
   const t=Math.min(1,age/.85);
   group.position.copy(center);group.rotation.y=age*.7;
   group.scale.set(1,Math.max(.02,t*t*(3-2*t)),1);
   const fade=Math.min(1,(3.6*(event.qualityDuration||1)-age)*2);
   for(const child of group.children)child.material.opacity=fade;
  },key);
 }
 tornado(event){
  const quality=event.qualityScale||1,origin=vec(event.origin),direction=vec(event.direction).normalize(),
    right=new THREE.Vector3(direction.z,0,-direction.x),range=event.range||20,tier=event.qualityTier||3,
    duration=(1400+tier*850)*(event.qualityDuration||1)/1000,
    group=this.take('tornado')||new THREE.Group(),vortices=[...group.children];
  group.name='Four independent wandering volumetric tornadoes';
  if(!vortices.length)for(let i=0;i<4;i++){
   const count=640,positions=new Float32Array(count*3),cols=new Float32Array(count*3);
   const tint=new THREE.Color(['#bffff3','#8feede','#d6f8f0','#a6d9ff'][i]);
   for(let j=0;j<count;j++){
    const y=(j%91)/90,angle=stable(j*11.73+i*9.7)*TAU;
    const radius=(.28+y*2.0)*(.7+stable(j*13.7+i)*.6);
    positions[j*3]=Math.cos(angle)*radius;
    positions[j*3+1]=y*10;
    positions[j*3+2]=Math.sin(angle)*radius;
    const brightness=.5+y*.5;
    cols[j*3]=tint.r*brightness;cols[j*3+1]=tint.g*brightness;cols[j*3+2]=tint.b*brightness;
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
   const mat=new THREE.PointsMaterial({size:.15*quality,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending});
   const v=new THREE.Points(geo,mat);v.name='Wandering tornado '+(i+1);
   group.add(v);vortices.push(v);
  }
  group.scale.setScalar(1);
  for(const v of vortices){v.position.set(0,0,0);v.rotation.y=0;v.material.opacity=.8;v.material.size=.15*quality;v.scale.setScalar(quality);}
  this.add(group,duration,age=>{
   const t=Math.min(1,age/duration);
   vortices.forEach((v,i)=>{
    const seed=i*1.618+(event.time||0)*.0003;
    const side=Math.sin(seed+t*12)*2.8+Math.sin(seed*2.7+t*27)*1.5;
    v.position.copy(origin).addScaledVector(direction,range*t).addScaledVector(right,side);
    v.rotation.y=age*(4.2+i*.85);
    v.material.opacity=.78*Math.min(1,age*5)*(1-Math.pow(t,4));
   });
  },'tornado');
 }
 giraffe(event,ownerRoot){
  const quality=event.qualityScale||1,origin=vec(event.origin),dir=vec(event.direction).normalize();
  const key='giraffe',cached=this.take(key),group=cached||new THREE.Group();
  group.name='Visible spinning yellow giraffe model, outbound and returning';
  if(!cached){
   const model=new THREE.Group(),giraffe=createFlexibleGiraffe(THREE);
   giraffe.name='Airborne fully skinned flexible giraffe baton';
   // Recenter the rod about its midpoint BEFORE axial spin: the swept
   // collision radius is calibrated to the same outer end of this model.
   model.add(giraffe);group.add(model);
   const nativeElectric=nativeArcRay({color:'#bd76ff',size:.42,density:.78,quantity:4});
   nativeElectric.group.name='00GameDevs arc ray following articulated giraffe spine';
   nativeElectric.setEndpoints(new THREE.Vector3(0,-.16,0),new THREE.Vector3(0,.43,0));
   giraffe.userData.flexBones[5].add(nativeElectric.group);
   group.userData.giraffe=giraffe;group.userData.model=model;
   group.userData.nativeElectric=nativeElectric;
  }
  const giraffe=group.userData.giraffe,model=group.userData.model;
  const scale=3.9*quality,rodMid=1.15;
  giraffe.scale.setScalar(scale);giraffe.position.set(0,-rodMid*scale,0);
  // Reused GPU resources must be reset, never allocated each attack.
  const nativeElectric=group.userData.nativeElectric;
  nativeElectric?.reset();nativeElectric?.setEndpoints(
   new THREE.Vector3(0,-.16,0),new THREE.Vector3(0,.43,0));
  group.userData.nativeElectricAge=0;
  const orientation=qdir(dir),duration=2.3;
  if(ownerRoot)ownerRoot.userData.giraffeHideUntil=performance.now()+duration*1000;
  this.add(group,duration,age=>{
   const t=Math.min(1,age/duration),distance=Math.sin(t*Math.PI)*(event.range||28);
   group.position.copy(origin).addScaledVector(dir,distance);
   group.quaternion.copy(orientation);
   model.rotation.z=age*15.5;
   model.rotation.x=Math.sin(age*13)*.25;
   animateFlexibleGiraffe(giraffe,age,1,true);
   if(nativeElectric){
    const delta=Math.max(0,age-(group.userData.nativeElectricAge||0));
    group.userData.nativeElectricAge=age;
    nativeElectric.update(Math.min(.11,delta));
   }
  },key);
 }
 play(event,item,ownerRoot){
  if(item.id==='goldfish'&&!event.ultimate)return this.goldfishBubble(event),true;
  if(item.id==='calico-cat')return this.shotgun(event),true;
  if(!event.ultimate)return false;
  if(item.id==='giraffe')return this.giraffe(event,ownerRoot),true;
  if(item.id==='goldfish')return this.goldfish(event),true;
  if(item.id==='fan')return this.tornado(event),true;
  if(item.family==='petal')return this.flower(event),true;
  if(item.family==='planter'&&!item.exotic)return this.thorns(event),true;
  return false;
 }
 update(dt,world=null){
  for(const entry of [...this.active]){
   try{
    entry.age+=dt;entry.update(entry.age,world,dt);
    if(entry.age>=entry.duration)this.remove(entry);
   }catch(error){
    const index=this.active.indexOf(entry);if(index>=0)this.active.splice(index,1);
    try{this.disposeGroup(entry.obj);}catch{entry.obj.removeFromParent();}
    this.failedSignatureEffects??=new Set();
    const key=entry.key||'signature';
    if(!this.failedSignatureEffects.has(key)){
     this.failedSignatureEffects.add(key);
     console.error('Failed signature animation disposed; render continues',key,error);
    }
   }
  }
 }
 dispose(){
  for(const e of [...this.active])this.remove(e);
  for(const list of this.recycled.values())for(const group of list)this.disposeGroup(group);
  this.recycled.clear();this.recycledCount=0;
 }
}
