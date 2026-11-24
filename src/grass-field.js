import * as THREE from 'three';
import {CITY_INNER_RADIUS,CITY_OUTER_RADIUS} from './shared/city-layout.js';

// Single GPU draw call for thousands of slender segmented grass blades.
// All meshes and wind/trample rules are generated in JS; no external assets.
export function grassPositions(count=65000,seed=17331,inner=11,outer=CITY_INNER_RADIUS-2){
 const points=new Float32Array(count*2),heights=new Float32Array(count),angles=new Float32Array(count),phases=new Float32Array(count),shades=new Float32Array(count);
 let state=seed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<count;i++){
  const r=Math.sqrt(inner*inner+(outer*outer-inner*inner)*rand()),a=rand()*Math.PI*2;
  points[i*2]=Math.cos(a)*r;points[i*2+1]=Math.sin(a)*r;
  heights[i]=.48+rand()*.82;angles[i]=rand()*Math.PI*2;
  phases[i]=rand()*100;shades[i]=rand();
 }
 return {points,heights,angles,phases,shades};
}
// Five crossed long leaves per instanced tuft; no one-mesh-per-blade overhead.
function bladeGeometry({segments=3,blades=4}={}){
 const positions=[],indices=[],uvs=[];
 for(let j=0;j<blades;j++){
  const phi=j*2.39996,cs=Math.cos(phi),sn=Math.sin(phi);
  const lean=.22+.11*Math.sin(j*4.17),yScale=.77+(j%3)*.14;
  const base=positions.length/3;
  for(let i=0;i<=segments;i++){
   const t=i/segments,w=(1-t)**1.22*.14+.0015,drift=lean*t*t;
   for(const side of [-1,1]){
    const x=side*w,z=drift;
    positions.push(x*cs-z*sn,t*yScale,x*sn+z*cs);
    uvs.push(side<0?0:1,t);
   }
   if(i<segments){const b=base+i*2;indices.push(b,b+1,b+2,b+1,b+3,b+2);}
  }
 }
 const geo=new THREE.InstancedBufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geo.setIndex(indices);
 return geo;
}
const vertex=`
attribute vec2 aOffset;
attribute float aHeight;
attribute float aAngle;
attribute float aPhase;
attribute float aShade;
uniform float uTime;
uniform vec3 uPlayers[6];
uniform float uPlayerCount;
varying float vHeight;
varying float vShade;
varying float vWind;
void main(){
 float t=position.y;
 float c=cos(aAngle),s=sin(aAngle);
 vec2 blade=vec2(position.x*c-position.z*s,position.x*s+position.z*c);
 vec2 wind=vec2(sin(uTime*1.3+aPhase+aOffset.x*.13),cos(uTime*.93+aPhase*1.3+aOffset.y*.11));
 wind*=.13+.06*sin(uTime*.3+aPhase*.4);
 vec2 trample=vec2(0.);
 for(int i=0;i<6;i++){
  if(float(i)>=uPlayerCount)break;
  vec2 push=aOffset-uPlayers[i].xz;
  float dist=length(push);
  float press=1.-smoothstep(.12,2.4,dist);
  trample+=push/max(.15,dist)*press*1.05;
 }
 vec2 bend=(wind+trample)*t*t;
 vec3 p=vec3(aOffset.x+blade.x+bend.x,.014+t*aHeight,aOffset.y+blade.y+bend.y);
 vHeight=t;vShade=aShade;vWind=length(wind+trample);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const fragment=`
precision mediump float;
varying float vHeight;
varying float vShade;
varying float vWind;
void main(){
 vec3 dark=vec3(.11,.29,.12),green=vec3(.29,.54,.22),straw=vec3(.53,.59,.28);
 vec3 tone=mix(dark,green,clamp(vHeight*.8+vShade*.3,0.,1.));
 tone=mix(tone,straw,vShade*.24*vHeight);
 tone+=vec3(.06,.08,.02)*clamp(vWind*.3,0.,1.)*vHeight;
 gl_FragColor=vec4(tone,1.);
}`;
export class GrassField{
 constructor(scene,{mobile=false,count}={}){
  this.count=count??(mobile?25000:65000);
  const geo=bladeGeometry(),seed=grassPositions(this.count);
  geo.setAttribute('aOffset',new THREE.InstancedBufferAttribute(seed.points,2));
  geo.setAttribute('aHeight',new THREE.InstancedBufferAttribute(seed.heights,1));
  geo.setAttribute('aAngle',new THREE.InstancedBufferAttribute(seed.angles,1));
  geo.setAttribute('aPhase',new THREE.InstancedBufferAttribute(seed.phases,1));
  geo.setAttribute('aShade',new THREE.InstancedBufferAttribute(seed.shades,1));
  geo.instanceCount=this.count;
  const positions=Array.from({length:6},()=>new THREE.Vector3(10000,0,10000));
  const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,depthWrite:true,
   uniforms:{uTime:{value:0},uPlayers:{value:positions},uPlayerCount:{value:0}}});
  this.mesh=new THREE.Mesh(geo,material);this.mesh.name='JS procedural wind and footsteps grass';this.mesh.frustumCulled=false;
  scene.add(this.mesh);
  // Match central grass with living wind/trample blades across every street,
  // backed by an unbroken green canopy, so the sandy ground never leaks out.
  // Instanced GPU rendering keeps all 432 collision buildings intact.
  this.outerCount=mobile?85000:190000;
  const cityGeo=bladeGeometry({segments:1,blades:4}),city=grassPositions(this.outerCount,73917,
   CITY_INNER_RADIUS-.5,CITY_OUTER_RADIUS+.5);
  cityGeo.setAttribute('aOffset',new THREE.InstancedBufferAttribute(city.points,2));
  cityGeo.setAttribute('aHeight',new THREE.InstancedBufferAttribute(city.heights,1));
  cityGeo.setAttribute('aAngle',new THREE.InstancedBufferAttribute(city.angles,1));
  cityGeo.setAttribute('aPhase',new THREE.InstancedBufferAttribute(city.phases,1));
  cityGeo.setAttribute('aShade',new THREE.InstancedBufferAttribute(city.shades,1));
  cityGeo.instanceCount=this.outerCount;
  this.outerMesh=new THREE.Mesh(cityGeo,material);
  this.outerMesh.name='Dense living wind-blown city grass - full ruined district';
  this.outerMesh.frustumCulled=false;scene.add(this.outerMesh);
  // Continuous fine-blade grass canopy covers every small gap between tufts;
  // no bare underlying meadow plane is visible while walking or looking down.
  this.canopy=new THREE.Mesh(new THREE.CircleGeometry(CITY_INNER_RADIUS,128),new THREE.ShaderMaterial({
   vertexShader:`varying vec2 grassPoint;void main(){grassPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`precision mediump float;varying vec2 grassPoint;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){vec2 p=grassPoint*28.;vec2 g=floor(p);vec2 f=fract(p);
     float n=hash(g),n2=hash(g+vec2(17.,47.));
     float stripe=sin((f.x+n*.7)*28.+sin(f.y*17.+n*6.)*1.7);
     vec3 dark=vec3(.085,.20,.069),mid=vec3(.16,.32,.093),bright=vec3(.27,.44,.15);
     vec3 col=mix(dark,mid,.26+.6*n);
     col=mix(col,bright,clamp(stripe*.18+n2*.24,0.,.45));
     gl_FragColor=vec4(col,1.);
    }`,side:THREE.DoubleSide,depthWrite:true}));
  this.canopy.name='Continuous dense grass canopy';
  this.canopy.rotation.x=-Math.PI/2;this.canopy.position.y=.006;scene.add(this.canopy);
  this.outerCanopy=new THREE.Mesh(new THREE.RingGeometry(CITY_INNER_RADIUS-.25,CITY_OUTER_RADIUS+1,192),this.canopy.material);
  this.outerCanopy.name='Full city green grass canopy with no exposed earth';
  this.outerCanopy.rotation.x=-Math.PI/2;this.outerCanopy.position.y=.007;scene.add(this.outerCanopy);
  // One opaque annular shader replaces the dark off-map floor. No CPU particle
  // simulation, framebuffers, bloom passes, textures or per-particle draw calls.
  const horizonMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,depthWrite:true,toneMapped:false,
   uniforms:{uTime:{value:0}},vertexShader:`varying vec2 vWorld;void main(){vWorld=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`precision mediump float;
    varying vec2 vWorld;uniform float uTime;
    float hash(vec2 p){return fract(sin(dot(mod(p,97.),vec2(127.1,311.7)))*4375.45);}
    void main(){
     vec2 q=vWorld*.031;float r=length(q),a=atan(q.y,q.x),t=uTime*.28;
     float fold=abs(sin(a*7.+r*.7-t)),ribbon=sin(r*2.3+fold*5.+t*2.);
     float web=sin(q.x*2.1+sin(q.y*.72+t)*2.7)*cos(q.y*1.7+sin(q.x*.8-t)*2.);
     float line=1.-smoothstep(.045,.24,abs(ribbon));float grid=1.-smoothstep(.04,.22,abs(web));
     vec2 p=q*4.,cell=floor(p),f=fract(p)-.5;float h=hash(cell);
     f-=.22*vec2(sin(t+h*6.28),cos(t*.8+h*5.));
     float sparkle=(1.-smoothstep(.025,.15,length(f)))*(.35+.65*h);
     vec3 col=mix(vec3(.79,.13,.47),vec3(1.,.36,.68),.5+.5*sin(r*.7-t+web));
     col=mix(col,vec3(.63,.19,.85),grid*.44);col=mix(col,vec3(1.,.77,.47),line*.70);
     col=mix(col,vec3(1.,.92,.86),sparkle*.8);gl_FragColor=vec4(col,1.);
    }`});
  this.horizon=new THREE.Mesh(new THREE.RingGeometry(CITY_OUTER_RADIUS+.65,1500,128),horizonMaterial);
  this.horizon.name='Pink psychedelic off-map geometric particle field';
  this.horizon.rotation.x=-Math.PI/2;this.horizon.position.y=-.075;scene.add(this.horizon);
 }
 update(time,roots){
  const uniform=this.mesh.material.uniforms;uniform.uTime.value=time;this.horizon.material.uniforms.uTime.value=time%600;
  let i=0;for(const root of roots.values()){
   if(i>=6)break;if(!root?.visible)continue;
   uniform.uPlayers.value[i].copy(root.position);i++;
  }
  uniform.uPlayerCount.value=i;
 }
 dispose(){this.horizon.removeFromParent();this.horizon.geometry.dispose();this.horizon.material.dispose();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.outerMesh.removeFromParent();this.outerMesh.geometry.dispose();this.mesh.material.dispose();this.canopy.removeFromParent();this.canopy.geometry.dispose();this.outerCanopy.removeFromParent();this.outerCanopy.geometry.dispose();this.canopy.material.dispose();}
}