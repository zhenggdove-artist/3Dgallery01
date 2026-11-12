// Original RELETTER projectile shaders, particles and melee ribbons; scoped host adapter.
import * as THREE from 'three';
import {equipmentById} from './equipment-catalog.js';
import {meleeDuration,meleeTrailPattern,meleeMoveNames} from './melee-motion.js';
export function createOriginalCombatVisuals(scene,showSignatureBurst){
const equipmentFX=[],gameView={},selectedCharacter='',remotePlayers=new Map(),charRoot=new THREE.Group();
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const glowCtx=glowCanvas.getContext('2d'),glowGradient=glowCtx.createRadialGradient(32,32,0,32,32,32);glowGradient.addColorStop(0,'#fff');glowGradient.addColorStop(.2,'#fffc');glowGradient.addColorStop(.55,'#fff4');glowGradient.addColorStop(1,'#fff0');glowCtx.fillStyle=glowGradient;glowCtx.fillRect(0,0,64,64);const equipmentGlow=new THREE.CanvasTexture(glowCanvas);
function glowMaterial(color,opacity=1){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});}

function showEquipmentAttack(data){
 if(['saber','whip','swatter','pan','planter','palm'].includes(data.family)){showMeleeAttack(data);return;}
 const origin=new THREE.Vector3(...data.origin),direction=new THREE.Vector3(...data.direction).normalize(),group=new THREE.Group(),color=data.red?'#ff3355':data.color||'#cbbaff';group.position.copy(origin);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);group.name='Equipment '+data.family;
 let travel=data.range;if(data.impact)travel=Math.min(travel,new THREE.Vector3(...data.impact).distanceTo(origin));else if(data.hit){const target=data.hit==='Auntie'?gameView.boss?.position:data.hit===selectedCharacter?charRoot.position.toArray():[...remotePlayers.values()].find(p=>p.character===data.hit)?.state?.position;if(target)travel=Math.min(travel,Math.max(.5,new THREE.Vector3(...target).distanceTo(origin)-1));}
 const tier=equipmentById(data.weapon)?.tier||1;const count=100+tier*60,positions=new Float32Array(count*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));const points=new THREE.Points(geo,new THREE.PointsMaterial({color,map:equipmentGlow,size:(data.family==='fire'?.28:.1)*(1+(tier-1)*.65),transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));points.frustumCulled=false;group.add(points);
 const accents=[];
 for(let k=0;k<(data.family==='fire'?0:tier-1);k++){const path=[];for(let n=0;n<=40;n++){const z=travel*n/40,a=n*.55+k*Math.PI*2/Math.max(1,tier-1),r=data.radius*(.5+k*.15);path.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,z));}const helix=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),64,.025+tier*.012,5,false),glowMaterial(k%2?'#fff4cf':color,.5));helix.userData.stationary=true;group.add(helix);accents.push(helix);}

 if(data.family==='fire')for(let layer=0;layer<2+tier;layer++){
  const geometry=new THREE.ConeGeometry(data.radius*(.4+layer*.09),travel*(.65+layer*.05),48,24,true);geometry.rotateX(Math.PI/2);geometry.translate(0,0,travel*(.65+layer*.05)/2);
  const material=new THREE.ShaderMaterial({uniforms:{time:{value:0},fade:{value:1},seed:{value:layer*2.7},tint:{value:new THREE.Color(data.red?'#ff1838':layer%2?'#ff4814':'#ffb326')}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:`uniform float time;uniform float seed;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;float a=uv.y;float wobble=sin(a*18.-time*16.+seed)*.15+sin(a*31.-time*23.+seed)*.07;p.x+=wobble*a;p.y+=sin(a*22.-time*18.+seed)*a*.24;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
  fragmentShader:`uniform float time;uniform float seed;uniform float fade;uniform vec3 tint;varying vec2 vUv;void main(){float flow=sin(vUv.y*32.-time*24.+sin(vUv.x*38.+seed)*3.);float tongues=pow(max(0.,sin(vUv.x*31.+sin(vUv.y*12.-time*8.)+seed)),2.);float tail=smoothstep(0.,.18,vUv.y)*(1.-smoothstep(.7,1.,vUv.y));float a=tail*(.12+.18*tongues)*(.65+.35*flow)*fade;vec3 c=mix(tint,vec3(1.,.86,.35),max(0.,flow)*.4);gl_FragColor=vec4(c,a);}`});
  const flame=new THREE.Mesh(geometry,material);flame.userData.stationary=true;flame.userData.flame=true;group.add(flame);accents.push(flame);
 }
 if(data.family==='beam'||data.family==='lightning'){
  const path=[];for(let i=0;i<20;i++){const z=travel*i/19,offset=data.family==='lightning'&&i>0&&i<19?Math.sin(i*14.2)*.12:0;path.push(new THREE.Vector3(offset,Math.sin(i*9.4)*Math.abs(offset),z));}
  const curve=new THREE.CatmullRomCurve3(path);for(const [width,opacity] of [[.012,.85],[.04,.26],[.09,.09]]){const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,40,width*(1+data.charge)*(1+(tier-1)*2.5),6,false),glowMaterial(width===.012?'#e8eeff':color,opacity));group.add(mesh);accents.push(mesh);}
 }else{
  const mesh=data.family==='fire'?new THREE.Sprite(new THREE.SpriteMaterial({map:equipmentGlow,color,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending})):data.family==='ice'?new THREE.Mesh(new THREE.OctahedronGeometry(.28+data.charge*.15),new THREE.MeshPhongMaterial({color,emissive:color,emissiveIntensity:.5,shininess:100,transparent:true,opacity:.9})):new THREE.Mesh(new THREE.TorusGeometry(.5,.035,8,48),glowMaterial(color,.8));group.add(mesh);accents.push(mesh);
 }
 if(data.family==='petal')for(let i=0;i<12;i++){const petal=new THREE.Mesh(new THREE.SphereGeometry(.13,8,5),new THREE.MeshBasicMaterial({color:i%2?'#ffc7e7':color,transparent:true,opacity:.75,depthWrite:false}));petal.scale.set(.5,1,1.6);petal.userData.petal=i+1;group.add(petal);accents.push(petal);}
 const impact=new THREE.Sprite(new THREE.SpriteMaterial({map:equipmentGlow,color,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));impact.position.z=travel;group.add(impact);
 for(const m of accents)m.userData.baseOpacity=m.material.opacity;
 scene.add(group);equipmentFX.push({group,points,accents,impact,data,travel,age:0,duration:data.contactDelay?data.contactDelay/1000*1.7:data.family==='saber'?.55:1.05});
}

const meleeEffects=[],meleePoseRestore=[];
const slashNames=['Dawn cleave','Reverse crescent','Horizon cut','Rising star','Twin cross','Spiral finale','Astral bloom'];
const slashOuter=new THREE.Vector3(),slashInner=new THREE.Vector3(),slashSpark=new THREE.Vector3();
function slashPoint(stroke,t,radius,out){const angle=stroke.start+(stroke.end-stroke.start)*t,x=Math.sin(angle)*radius;return out.set(x*Math.cos(stroke.tilt),x*Math.sin(stroke.tilt)+(stroke.lift||0),Math.cos(angle)*radius);}
function slashRibbon(color,opacity){
 const geo=new THREE.BufferGeometry(),n=64,position=new Float32Array((n+1)*6),uv=new Float32Array((n+1)*4),indices=[];
 for(let i=0;i<=n;i++){uv.set([i/n,0,i/n,1],i*4);if(i<n){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}geo.setAttribute('position',new THREE.BufferAttribute(position,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(indices);
 const material=new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(color)},fade:{value:opacity},time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 vUv;uniform vec3 tint;uniform float fade;uniform float time;
 void main(){float edge=pow(max(0.0,sin(vUv.y*3.14159)),1.3);float tail=pow(vUv.x,.65);float filament=pow(max(0.0,1.0-abs(vUv.y-.8)*13.0),3.0);float shimmer=.85+.15*sin(vUv.x*50.0-time*12.0);vec3 c=mix(tint,vec3(.92,.96,1.0),filament*.5);gl_FragColor=vec4(c,fade*edge*tail*shimmer);}`,transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
 const mesh=new THREE.Mesh(geo,material);mesh.frustumCulled=false;return mesh;
}
function showMeleeAttack(data){
 const combo=Math.max(0,Math.min(6,data.combo||0)),charged=combo===6,group=new THREE.Group(),color=data.color||'#a77bff';group.position.fromArray(data.origin);group.rotation.y=Math.atan2(data.direction[0],data.direction[2]);group.name=data.family+' '+(meleeMoveNames[data.family]||slashNames)[combo];
 if(data.quiet){scene.add(group);meleeEffects.push({group,poseOnly:true,combo,data,age:0,duration:meleeDuration(data.family,combo)+.35});return;}
 const patterns=[[[.7,-1.25,1.25,0]], [[-.7,1.25,-1.25,0]], [[.08,-1.45,1.45,0]], [[1.45,-1.3,1.3,0]], [[.8,-1.3,1.3,0],[-.8,1.3,-1.3,.22]], [[.18,-1.5,1.5,0],[-.25,1.5,-1.5,.2]], [[.75,-1.5,1.5,0],[-.75,1.5,-1.5,.18],[.02,-1.6,1.6,.36]]];
 const strokes=meleeTrailPattern(data.family,combo).map(([tilt,start,end,delay],i)=>{const ribbon=slashRibbon(color,.52),filament=slashRibbon(i%2?'#ffd4ec':'#c9deff',.36);group.add(ribbon,filament);return {tilt: data.family==='whip'?tilt*1.3:tilt,start,end,delay:delay+meleeDuration(data.family,combo)*(['pan','planter','palm'].includes(data.family)?.33:.24),lift:0,ribbon,filament};});
 const tier=equipmentById(data.weapon)?.tier||1;const count=(charged?150:80)+tier*45,geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({map:equipmentGlow,color,size:charged?.11:.07,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));sparks.frustumCulled=false;group.add(sparks);
 const sigil=new THREE.Group();sigil.position.y=-.92;const radius=data.range*.8;for(let j=0;j<3;j++){const ring=new THREE.Mesh(new THREE.RingGeometry(radius*(.45+j*.16),radius*(.45+j*.16)+.018+tier*.009,96),glowMaterial(color,.28));ring.rotation.x=-Math.PI/2;sigil.add(ring);}
 const vertices=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,r=radius*.8;vertices.push(Math.cos(a)*r,0,Math.sin(a)*r,Math.cos(a+.13)*(r-.18),0,Math.sin(a+.13)*(r-.18),Math.cos(a+.13)*(r-.18),0,Math.sin(a+.13)*(r-.18),Math.cos(a+.21)*r,0,Math.sin(a+.21)*r);}
 const runeGeo=new THREE.BufferGeometry();runeGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));sigil.add(new THREE.LineSegments(runeGeo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending})));group.add(sigil);
 const flash=new THREE.Sprite(new THREE.SpriteMaterial({map:equipmentGlow,color,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));flash.position.set(0,0,Math.min(radius,2.5));group.add(flash);scene.add(group);
 sigil.visible=data.family==='saber';const waves=[];for(let i=0;i<(data.family==='saber'?Math.ceil(tier/2):0);i++){const wave=new THREE.Mesh(new THREE.RingGeometry(.84,1,48,1,.15,Math.PI*1.65),glowMaterial(i%2?'#fff0d2':color,.5));wave.rotation.z=combo*.65+i*.9;group.add(wave);waves.push(wave);}
 if(!data.ultimate&&!data.quiet)showSignatureBurst(data);
 meleeEffects.push({group,strokes,sparks,sigil,flash,waves,combo,data,age:0,radius:data.range,duration:meleeDuration(data.family,combo)+.35});
}
function updateMeleeEffects(dt){
 for(let j=meleeEffects.length-1;j>=0;j--){const fx=meleeEffects[j];fx.age+=Math.max(dt,Math.min(.2,(performance.now()-(fx.wallTime||performance.now()))/1000));fx.wallTime=performance.now();const life=fx.age/fx.duration;
  if(fx.poseOnly){if(life>=1){scene.remove(fx.group);meleeEffects.splice(j,1);}continue;}
  for(const stroke of fx.strokes){const swing=THREE.MathUtils.clamp((fx.age-stroke.delay)/(meleeDuration(fx.data.family,fx.combo)*.4),0,1),head=1-Math.pow(1-swing,3),fade=Math.max(0,1-Math.max(0,fx.age-stroke.delay-.14)/.32);
   for(const [mesh,thin] of [[stroke.ribbon,false],[stroke.filament,true]]){const attr=mesh.geometry.attributes.position;for(let i=0;i<=64;i++){const t=i/64,progress=Math.max(0,head-(1-t)*.48),taper=Math.sin(Math.PI*t)*(.5+(equipmentById(fx.data.weapon)?.tier||1)*.12+fx.data.charge*.35),r=fx.radius*(thin?1.025:1);const outer=slashPoint(stroke,progress,r,slashOuter),inner=slashPoint(stroke,progress,r-(thin?.025:taper),slashInner);attr.setXYZ(i*2,inner.x,inner.y,inner.z);attr.setXYZ(i*2+1,outer.x,outer.y,outer.z);}attr.needsUpdate=true;mesh.material.uniforms.fade.value=(thin?.32:.5)*fade*(swing>0?1:0);mesh.material.uniforms.time.value=fx.age;}
  }
  const attr=fx.sparks.geometry.attributes.position;for(let i=0;i<attr.count;i++){const stroke=fx.strokes[i%fx.strokes.length],t=i/attr.count,age=Math.max(0,fx.age-stroke.delay-t*.25),point=slashPoint(stroke,t,fx.radius*(.8+.2*Math.sin(i*7)),slashSpark);point.x+=Math.sin(i*12.1)*age*.8;point.z+=Math.cos(i*4.7)*age*.8;point.y+=(1.4+(i%7)*.23)*age+age*age*.5;attr.setXYZ(i,point.x,point.y,point.z);}attr.needsUpdate=true;fx.sparks.material.opacity=Math.max(0,Math.sin(Math.min(1,life)*Math.PI)*.55);
  for(let i=0;i<fx.waves.length;i++){const t=Math.max(0,Math.min(1,(fx.age-i*.055)/.48)),wave=fx.waves[i];wave.position.set(0,.2,fx.radius*t*.85);wave.scale.setScalar((.35+t*.65)*Math.min(3.8,fx.radius*.35));wave.material.opacity=Math.sin(t*Math.PI)*.52;wave.rotation.z+=dt*(i%2?-1.4:1.4);}
  fx.sigil.rotation.y=fx.age*(fx.combo%2?-.5:.5);fx.sigil.scale.setScalar(.85+Math.sin(Math.min(1,life)*Math.PI)*.18);fx.sigil.traverse(o=>{if(o.material)o.material.opacity=Math.sin(Math.min(1,life)*Math.PI)*(fx.combo===6?.6:.28);});
  const impact=Math.max(0,1-Math.abs(fx.age-meleeDuration(fx.data.family,fx.combo)*.5)*8);fx.flash.material.opacity=impact*(fx.data.hit?.5:.16);fx.flash.scale.setScalar(.3+impact*(fx.combo===6?2:1));
  if(life>=1){scene.remove(fx.group);fx.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});meleeEffects.splice(j,1);}
 }
}

function update(dt){ for(let j=equipmentFX.length-1;j>=0;j--){const fx=equipmentFX[j];fx.age+=dt;const u=fx.age/fx.duration,attr=fx.points.geometry.attributes.position,f=fx.data.family,charge=fx.data.charge||0,head=Math.min(1,u*1.7)*fx.travel;
  for(let i=0;i<attr.count;i++){const t=i/attr.count,a=i*2.39996+u*5,r=(f==='wave'?fx.data.radius: .12+fx.data.radius*.45)*Math.sqrt(t),trail=Math.max(0,head-t*(f==='fire'?5:3));let x=Math.cos(a)*r,y=Math.sin(a)*r,z=trail;
   if(f==='petal'){x=Math.sin(t*22-u*9)*(r+.5);y=Math.cos(t*16+u*6)*r;}
   if(f==='saber'){const theta=-.9+t*1.8+u*.5;x=Math.sin(theta)*fx.travel;y=Math.sin(t*22)*.08;z=Math.cos(theta)*fx.travel;}
   if(f==='wave'){x=Math.cos(a)*r*(.5+u*2);y=Math.sin(a)*r*(.5+u*2);z=head+Math.sin(a*3)*.12;}
   if(f==='fire')y+=t*t*.6;
   attr.setXYZ(i,x,y,z);
  }attr.needsUpdate=true;fx.points.material.opacity=Math.max(0,(1-u)*(f==='fire'?.28:.6));
  for(const m of fx.accents){if(m.userData.flame){m.material.uniforms.time.value=fx.age;m.material.uniforms.fade.value=Math.max(0,1-u);continue;}if(!m.userData.stationary&&!['beam','lightning','saber'].includes(f)){m.position.z=head;if(m.userData.petal){const a=m.userData.petal*2.39996+u*7;m.position.set(Math.cos(a)*(.3+u),Math.sin(a)*(.3+u),Math.max(0,head-m.userData.petal*.2));}m.rotation.z+=dt*3;if(!m.userData.petal)m.scale.setScalar(f==='wave'?1+u*fx.data.radius*2:(1+charge)*(1+(equipmentById(fx.data.weapon)?.tier||1)*.45));}if(f==='saber')m.rotation.z+=dt*2.8;m.material.opacity=Math.max(0,(1-u)*(m.userData.baseOpacity??.5));}
  const hitT=Math.max(0,(u-.55)/.45);fx.impact.material.opacity=hitT>0?(1-hitT)*.8:0;fx.impact.scale.setScalar((.4+hitT*3)*(1+charge));
  if(u>=1){scene.remove(fx.group);fx.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});equipmentFX.splice(j,1);}
 }

updateMeleeEffects(dt);}
function trim(list,max){while(list.length>max){const f=list.shift();f.group.removeFromParent();f.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}}
return {show(data){showEquipmentAttack({...data,hit:null});trim(equipmentFX,8);trim(meleeEffects,8);},update,meleeEffects,equipmentFX};
}
