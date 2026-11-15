import * as THREE from 'three';

// Single GPU draw call for thousands of slender segmented grass blades.
// All meshes and wind/trample rules are generated in JS; no external assets.
export function grassPositions(count=8500,seed=17331){
 const points=new Float32Array(count*2),heights=new Float32Array(count),angles=new Float32Array(count),phases=new Float32Array(count),shades=new Float32Array(count);
 let state=seed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(let i=0;i<count;i++){
  const r=Math.sqrt(11*11+(90*90-11*11)*rand()),a=rand()*Math.PI*2;
  points[i*2]=Math.cos(a)*r;points[i*2+1]=Math.sin(a)*r;
  heights[i]=.32+rand()*.85;angles[i]=rand()*Math.PI*2;
  phases[i]=rand()*100;shades[i]=rand();
 }
 return {points,heights,angles,phases,shades};
}
function bladeGeometry(){
 const positions=[],indices=[],uvs=[],segments=5;
 for(let i=0;i<=segments;i++){
  const t=i/segments,w=(1-t)**1.3*.035+.001;
  positions.push(-w,t,0,w,t,0);
  uvs.push(0,t,1,t);
  if(i<segments){const b=i*2;indices.push(b,b+1,b+2,b+1,b+3,b+2);}
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
 vec2 blade=vec2(position.x*c,position.x*s);
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
  this.count=count??(mobile?2800:9500);
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
 }
 update(time,roots){
  const uniform=this.mesh.material.uniforms;uniform.uTime.value=time;
  let i=0;for(const root of roots.values()){
   if(i>=6)break;if(!root?.visible)continue;
   uniform.uPlayers.value[i].copy(root.position);i++;
  }
  uniform.uPlayerCount.value=i;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}