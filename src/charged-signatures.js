import * as THREE from 'three';

// GPU-driven visual signatures. These are presentation-only: damage, target,
// radius and cooldown remain server-authoritative.
export const SIGNATURE_KINDS=Object.freeze({
 flies:0,food:1,notes:2,fissure:3,rainbow:4,gust:5,
 water:6,lightning:7,arcane:8,boomerang:9,shells:10,
 jelly:11,echo:12,fire:13,ice:14,petal:15
});
export function signatureKindFor(item){
 if(item.id==='accordion')return 'notes';
 if(item.id==='fan')return 'gust';
 if(item.id==='clam')return 'shells';
 if(item.id==='goldfish')return 'water';
 if(item.id==='jellybrella')return 'jelly';
 if(item.id==='telephone')return 'echo';
 if(item.id==='giraffe')return 'boomerang';
 if(item.firstPerson||item.id?.includes('cat'))return 'rainbow';
 const families={swatter:'flies',pan:'food',saber:'fissure',whip:'boomerang',water:'water',ice:'ice',fire:'fire',lightning:'lightning',beam:'rainbow',petal:'petal',wave:'water',planter:'petal',palm:'arcane'};
 return families[item.family]||'arcane';
}
let sharedSeed;
function particleSeeds(count){
 if(!sharedSeed||sharedSeed.count<count){
  const max=Math.max(count,4600),positions=new Float32Array(max*3),seeds=new Float32Array(max*3);
  let state=0x51a65ed;
  const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let i=0;i<max*3;i++)seeds[i]=rnd();
  sharedSeed={count:max,positions,seeds};
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.BufferAttribute(sharedSeed.positions,3));
 geo.setAttribute('seed',new THREE.BufferAttribute(sharedSeed.seeds,3));
 geo.setDrawRange(0,count);return geo;
}
const vertex=String.raw`
attribute vec3 seed;
uniform float age,duration,reach,spread,kind;
uniform vec3 tint;
varying vec3 vColor;
varying float vAlpha;
varying float vDark;
const float PI=3.141592653589793;
vec3 rainbow(float h){
 return clamp(abs(fract(h+vec3(0.0,0.66667,0.33333))*6.0-3.0)-1.0,0.0,1.0);
}
void main(){
 float t=clamp(age/duration,0.0,1.0),u=seed.x,v=seed.y,w=seed.z;
 float angle=v*PI*2.0+u*44.0,twist=age*11.0,rad=spread*(0.2+sqrt(w)*0.77);
 float z=t*reach,drift=sin(age*19.0+u*55.0);
 vec3 p=vec3(cos(angle)*rad,0.7+w*4.0,sin(angle)*rad);
 vec3 color=tint;
 float size=2.8;
 vDark=0.0;
 if(kind<0.5){
  // Dense dark fly silhouettes buzzing along a tracking, forward-moving swarm.
  float leader=pow(t,0.75),head=reach*leader;
  z=head+mix(-2.2,1.6,u);
  float swarm=(0.6+sin(u*7.0+age*3.0)*0.23)*(1.0+spread*0.22);
  p=vec3(cos(angle+twist*2.7)*swarm+sin(age*57.0+u*98.0)*0.26,
   1.25+w*3.2+cos(age*48.0+v*74.0)*0.3,
   z+sin(age*38.0+u*48.0)*0.25);
  color=u>0.94?vec3(0.55,0.6,0.67):vec3(0.008,0.012,0.018);
  size=3.1;vDark=1.0;
 }else if(kind<1.5){
  // Seven multicolour ingredients tumble and bounce as coherent particle forms.
  float piece=floor(u*7.0),part=fract(u*7.0),a=part*PI*2.0;
  float wobble=age*17.0+piece*2.4,rr=sqrt(w)*0.57;
  p=vec3(sin(piece*2.399)*(.48+piece*.16)+cos(a+wobble)*rr,
   0.72+abs(sin(wobble))*1.4+sin(a+wobble)*rr,
   0.9+t*reach*(0.62+piece*.06)+cos(wobble)*rr);
  color=rainbow(piece/7.0+0.08)*0.85+0.15;
  size=3.2;
 }else if(kind<2.5){
  // Repeating note heads, stems, flags and swirling score around a tornado.
  float note=floor(u*20.0),q=fract(u*20.0),a=note*2.399+twist;
  float rr=spread*(0.18+0.58*sqrt(v));
  float nx=0.0,ny=0.0;
  if(q<0.42){float h=q/0.42*PI*2.0;nx=cos(h)*0.18;ny=sin(h)*0.115;}
  else if(q<0.78){nx=.16;ny=(q-.42)/.36*.8;}
  else {nx=.16+(q-.78)/.22*.32;ny=.79-sin((q-.78)/.22*PI)*.22;}
  p=vec3(cos(a)*rr+nx,sin(a)*rr+1.0+v*4.5+ny,0.8+reach*(t*.72+note/20.0*.24));
  color=rainbow(note/20.0+age*.11)*.75+.25;
  size=2.6;
 }else if(kind<3.5){
  // Ground splitting into zig-zagging fissures with a high vertical eruption.
  float strand=floor(u*9.0),section=fract(u*9.0),progress=section*reach;
  p=vec3((strand-4.0)*.35+sin(progress*3.7+strand*3.0)*(.16+.3*t),
   .16+pow(v,5.0)*(1.0+8.0*t)+max(0.0,sin(section*18.0-age*16.0))*v*3.5,
   max(0.0,progress*t));
  color=mix(vec3(1.0,.18,.02),vec3(1.0,.9,.37),v);
  size=3.1;
 }else if(kind<4.5){
  // Rainbow bullet stream + seven luminous orbital trails.
  float lane=floor(u*7.0),shift=fract(u*7.0),r=.2+sqrt(w)*(.5+0.8*t);
  p=vec3(cos(angle+twist)*(r+lane*.06),
   1.25+sin(angle+twist)*(r+lane*.05),
   reach*max(0.0,t-shift*.25)+(lane-3.0)*.12);
  color=rainbow(lane/7.0+age*.08)*.85+.15;
  size=3.2;
 }else if(kind<5.5){
  float lane=floor(u*4.0),turn=angle+age*13.0+lane*PI*.5;
  float r=.25+sqrt(w)*(1.2+spread*.32)*(0.6+t*.7);
  p=vec3(cos(turn)*r,1.0+lane*.7+sin(turn)*r*.8,reach*max(0.0,t-v*.34));
  color=mix(tint,vec3(.8,1.0,1.0),w);size=3.1;
 }else if(kind<6.5){
  float r=spread*sqrt(u),a=angle+twist*.5;
  p=vec3(cos(a)*r,0.7+abs(sin(age*13.0+w*24.0))*4.4+v*2.1,sin(a)*r);
  color=mix(vec3(.04,.47,1.0),vec3(.72,1.0,1.0),v);size=3.4;
 }else if(kind<7.5){
  float branch=floor(u*12.0),segment=fract(u*12.0);
  p=vec3(sin(branch*2.1+segment*6.0)*spread*.55,
   0.8+segment*8.0+abs(sin(age*19.0+branch))*1.5,
   cos(branch*2.4)*spread*.5+sin(segment*21.0+age*20.0)*.38);
  color=mix(vec3(.4,.3,1.),vec3(.9,.97,1.),v);size=2.8;
 }else if(kind<8.5){
  float r=spread*sqrt(u),a=angle+twist;
  p=vec3(cos(a)*r,0.8+v*7.0+sin(age*17.0+u*40.0)*.45,sin(a)*r);
  color=mix(tint,rainbow(u+age*.22),.45);size=2.9;
 }else if(kind<9.5){
  float flight=sin(t*PI),r=.4+sqrt(w)*.9;
  p=vec3(cos(angle+twist)*r+sin(age*7.0)*2.2,
   1.4+sin(angle+twist)*r+v*1.6,
   reach*flight+(u-.5)*1.8);
  color=mix(tint,vec3(1.,.92,.55),v);size=2.9;
 }else if(kind<10.5){
  float shell=floor(u*6.0),a=fract(u*6.0)*PI*2.0;
  float r=.35+sqrt(w)*.8;
  p=vec3(cos(a+twist)*r+sin(shell*PI/3.0)*1.5,
   1.1+abs(sin(age*12.0+shell))*1.2+sin(a+twist)*r,
   reach*max(0.0,t-shell*.075));
  color=mix(vec3(.98,.56,.73),vec3(1.,.9,1.),v);size=3.0;
 }else if(kind<11.5){
  float jelly=floor(u*5.0),a=fract(u*5.0)*PI*2.0,ring=sqrt(w);
  p=vec3(cos(a)*(.5+ring)*1.2+sin(jelly*2.4)*1.5,
   1.0+v*3.8+sin(age*8.0+jelly)*.7,
   reach*max(0.0,t-jelly*.08)+sin(a)*ring*.5);
  color=mix(tint,vec3(1.,.76,1.),w);size=2.8;
 }else if(kind<12.5){
  float wave=floor(u*3.0),a=angle+age*5.0;
  float r=spread*sqrt(v)+wave*.4;
  p=vec3(cos(a)*r,1.2+sin(a)*r*.45+wave*.9,reach*max(0.0,t-wave*.13));
  color=mix(tint,vec3(1.,.6,1.),w);size=3.;
 }else if(kind<13.5){
  float r=spread*sqrt(u),a=angle+age*7.0;
  p=vec3(cos(a)*r,.5+v*8.5+sin(age*19.0+u*35.0)*.55,sin(a)*r);
  color=mix(vec3(1.,.12,.01),vec3(1.,.96,.2),v);size=3.2;
 }else if(kind<14.5){
  float r=spread*sqrt(u),a=angle+age*4.0;
  p=vec3(cos(a)*r,.6+v*6.7,sin(a)*r);
  color=mix(vec3(.18,.55,1.),vec3(.88,1.,1.),v);size=3.0;
 }else {
  float r=spread*sqrt(u),a=angle+age*6.0;
  p=vec3(cos(a)*r,.6+v*6.2+sin(u*45.0+age*8.0)*.5,sin(a)*r);
  color=mix(tint,rainbow(w+age*.08),.55);size=3.0;
 }
 // Every signature stays visibly ABOVE the target surface.
 p.y=max(.13,p.y);
 vColor=color;
 vAlpha=clamp(t*14.0,0.0,1.0)*pow(max(0.0,1.0-t),.58);
 vec4 view=modelViewMatrix*vec4(p,1.0);
 gl_Position=projectionMatrix*view;
 gl_PointSize=clamp(size*28.0/max(1.5,-view.z),1.7,8.0);
}
`;
const fragment=String.raw`
varying vec3 vColor;
varying float vAlpha;
varying float vDark;
void main(){
 vec2 v=gl_PointCoord*2.0-1.0;
 float r=dot(v,v);
 float a=(1.0-smoothstep(.25,.98,r))*vAlpha;
 if(a<.008)discard;
 gl_FragColor=vec4(vColor,a*(vDark>.5?.91:.76));
}
`;
const directional=new Set(['flies','food','notes','fissure','rainbow','gust','boomerang','shells','jelly','echo']);
const countFor=mobile=>mobile?1450:3800;

export function createChargedSignature(T,shot,item,origin,direction,area,{mobile=false}={}){
 const name=signatureKindFor(item),kind=SIGNATURE_KINDS[name],isForward=directional.has(name),groundArea=!isForward&&area?.mode==='area';
 const count=countFor(mobile),geometry=particleSeeds(count),dir=new T.Vector3(direction.x,0,direction.z);
 if(dir.lengthSq()<.0001)dir.set(0,0,1);dir.normalize();
 const range=Math.max(2,Math.min(shot.range||item.chargedRange||18,60));
 const reach=isForward?Math.min(range,32):Math.min(range,20);
 const radius=groundArea?Math.max(2.2,Math.min(18,Number(area.radius)||4)*1.2):Math.min(5.5,Math.max(1.4,reach*.12));
 const root=new T.Points(geometry,new T.ShaderMaterial({
  uniforms:{age:{value:0},duration:{value:1.8},reach:{value:reach},spread:{value:radius},kind:{value:kind},tint:{value:new T.Color(item.color||'#86dcff')}},
  vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:true,
  blending:name==='flies'?T.NormalBlending:T.AdditiveBlending,
  toneMapped:false
 }));
 root.name='Temple charged signature: '+name;root.frustumCulled=false;root.renderOrder=9;
 if(groundArea){root.position.set(area.center[0],Math.max(.2,area.center[1]),area.center[2]);}
 else{root.position.copy(origin);root.position.y=Math.max(.25,origin.y-.7);root.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir);}
 const hit=Array.isArray(shot.impactPoint)?new T.Vector3(...shot.impactPoint):null;
 return {root,age:0,duration:1.8,name,hit,dir,origin:root.position.clone(),groundArea};
}
export function updateChargedSignature(effect,dt){
 effect.age+=dt;
 effect.root.material.uniforms.age.value=effect.age;
 // Flies briefly steer toward an actual server-reported enemy hit.
 if(effect.name==='flies'&&effect.hit&&effect.age<.65){
  const horizontal=effect.hit.clone().sub(effect.origin);horizontal.y=0;
  if(horizontal.lengthSq()>.01){horizontal.normalize();const desired=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),horizontal);effect.root.quaternion.slerp(desired,Math.min(1,dt*3));}
 }
 return effect.age<effect.duration;
}
export function disposeChargedSignature(effect){
 effect.root.removeFromParent();effect.root.geometry.dispose();effect.root.material.dispose();
}
