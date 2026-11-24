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
  this.ocean=createElectricOcean(scene,{mobile});
  this.horizon=this.ocean.surface;

 }
 update(time,roots){
  const uniform=this.mesh.material.uniforms;uniform.uTime.value=time;this.ocean.update(time);
  let i=0;for(const root of roots.values()){
   if(i>=6)break;if(!root?.visible)continue;
   uniform.uPlayers.value[i].copy(root.position);i++;
  }
  uniform.uPlayerCount.value=i;
 }
 dispose(){this.ocean.dispose();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.outerMesh.removeFromParent();this.outerMesh.geometry.dispose();this.mesh.material.dispose();this.canopy.removeFromParent();this.canopy.geometry.dispose();this.outerCanopy.removeFromParent();this.outerCanopy.geometry.dispose();this.canopy.material.dispose();}
}
/* ELECTRIC OCEAN r117: a physically displaced annular surface, not a flat
   patterned plane. All animation is on the GPU. The shoreline is fixed,
   and progressively denser tessellation near land preserves wave silhouettes. */
export const ELECTRIC_OCEAN_INNER=CITY_OUTER_RADIUS+1;
export const ELECTRIC_OCEAN_OUTER=1120;
export function electricOceanGeometry(mobile=false){
 const radial=mobile?72:112,angular=mobile?192:288;
 const positions=new Float32Array((radial+1)*(angular+1)*3),indices=[];
 for(let i=0;i<=radial;i++){
  const t=i/radial,r=ELECTRIC_OCEAN_INNER+(ELECTRIC_OCEAN_OUTER-ELECTRIC_OCEAN_INNER)*(.27*t+.73*t*t);
  for(let j=0;j<=angular;j++){const a=j/angular*Math.PI*2,k=(i*(angular+1)+j)*3;
   positions[k]=r*Math.cos(a);positions[k+1]=0;positions[k+2]=r*Math.sin(a);
   if(i&&j){const v=i*(angular+1)+j,prev=v-angular-1;indices.push(prev-1,v-1,prev,prev,v-1,v);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(indices);g.computeBoundingSphere();g.boundingSphere.radius+=65;return g;
}
// Two crossing swells, radial shockwaves and a third rotating interference
// component. One common function keeps the spray attached to the moving sea.
const oceanWaveGLSL=`
uniform float uTime;
uniform float uShore;
float waveHeight(vec2 p){
 float r=length(p),d=max(0.,r-uShore),a=atan(p.y,p.x),t=uTime;
 float shore=smoothstep(0.,17.,d);
 float swell=sin(d*.105-1.8*t+3.1*sin(a*5.+t*.23));
 float crosswave=sin(dot(p,vec2(.067,.093))+1.45*t+1.5*sin(p.x*.024-t*.2));
 float vortex=sin(d*.055+7.*a+t*.78+2.2*sin(a*3.-t*.31));
 float ripple=sin(dot(p,vec2(-.14,.085))-t*2.15);
 float ridge=pow(.5+.5*swell,2.5);
 float gain=mix(1.,1.8,smoothstep(25.,410.,d));
 // Positive elevation prevents the old meadow plane hiding troughs.
 return .024+shore*gain*(3.+9.*ridge+3.8*(.5+.5*crosswave)+5.8*(.5+.5*vortex)+1.2*(.5+.5*ripple));
}
`;
export function createElectricOcean(scene,{mobile=false}={}){
 const uniforms={uTime:{value:0},uShore:{value:ELECTRIC_OCEAN_INNER}};
 const root=new THREE.Group();root.name='Electric Ocean - real 3D animated swells';scene.add(root);
 const material=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,depthWrite:true,toneMapped:false,
  vertexShader:`precision highp float;
  ${oceanWaveGLSL}
  varying vec3 vWorld,vNormal;
  varying float vHeight;
  void main(){
   vec2 q=position.xz;float h=waveHeight(q),e=1.3;
   vec3 n=normalize(vec3(waveHeight(q-vec2(e,0.))-waveHeight(q+vec2(e,0.)),2.*e,waveHeight(q-vec2(0.,e))-waveHeight(q+vec2(0.,e))));
   vec4 p=modelMatrix*vec4(q.x,h,q.y,1.);
   vWorld=p.xyz;vNormal=n;vHeight=h;
   gl_Position=projectionMatrix*viewMatrix*p;
  }`,
  fragmentShader:`precision highp float;
  uniform float uTime,uShore;varying vec3 vWorld,vNormal;varying float vHeight;
  void main(){
   vec2 p=vWorld.xz;float r=length(p),d=r-uShore,a=atan(p.y,p.x),t=uTime;
   vec3 n=normalize(vNormal),eye=normalize(cameraPosition-vWorld);
   float face=abs(dot(n,eye)),fres=pow(1.-face,2.1);
   float diffuse=.25+.75*max(0.,dot(n,normalize(vec3(-.55,.85,.45))));
   float fold=sin(d*.105-1.8*t+3.1*sin(a*5.+t*.23));
   float phase=d*.105-1.8*t+3.1*sin(a*5.+t*.23);
   float interference=sin(dot(p,vec2(.067,.093))+1.45*t+1.5*sin(p.x*.024-t*.2));
   float curl=sin(d*.055+7.*a+t*.78+2.2*sin(a*3.-t*.31));
   float crest=smoothstep(.50,.96,fold)*smoothstep(.15,.8,n.y);
   float valley=(.5+.5*interference)*(.5+.5*curl);
   vec3 deep=vec3(.31,.018,.24),pink=vec3(.84,.055,.42),purple=vec3(.43,.045,.76);
   vec3 col=mix(deep,pink,clamp(diffuse*.76+valley*.25,0.,1.));
   col=mix(col,purple,smoothstep(.3,.95,valley)*.52);
   col=mix(col,vec3(.91,.20,.53),fres*.38+crest*.28);
   // Thick luminous wave faces, branching electric channels and a narrow
   // white-hot core; use the same moving phase as the actual vertex swell.
   float field=sin(phase*2.+1.15*sin(interference*4.+curl*2.));
   float channel=(1.-smoothstep(.06,.39,abs(field)))*smoothstep(.18,.85,fold);
   float corona=exp(-abs(field)*3.8)*smoothstep(-.1,.9,fold);
   float breakUp=.35+.65*smoothstep(-.4,.75,sin(p.x*.23+p.y*.19-t*2.+curl*3.));
   col+=vec3(.31,.038,.39)*corona*.55;
   col=mix(col,vec3(1.,.36,.64),crest*.58);
   col=mix(col,vec3(1.,.73,.49),channel*breakUp*.84);
   float glint=pow(max(0.,dot(reflect(-normalize(vec3(-.5,.8,.55)),n),eye)),22.);
   col+=vec3(.34,.20,.33)*glint;
   // Keep far waves visibly contrasting, even after the existing VHS gain.
   float haze=smoothstep(440.,1040.,length(cameraPosition-vWorld))*.26;
   col=mix(col,vec3(.65,.13,.40),haze);
   gl_FragColor=vec4(clamp(col,0.,1.),1.);
  }`});
 const surface=new THREE.Mesh(electricOceanGeometry(mobile),material);surface.name='Electric Ocean displaced pink surface';surface.frustumCulled=false;root.add(surface);
 // Electric spray occupies real positions just above the current wave.
 let state=0x5c1143a;const rnd=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 const count=mobile?900:1800,points=new Float32Array(count*3),seeds=new Float32Array(count);
 for(let i=0;i<count;i++){const a=rnd()*Math.PI*2,r=ELECTRIC_OCEAN_INNER+9+Math.pow(rnd(),1.65)*650;points.set([r*Math.cos(a),0,r*Math.sin(a)],i*3);seeds[i]=rnd();}
 const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(points,3));pg.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
 const pm=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  vertexShader:`precision highp float;
  ${oceanWaveGLSL}
  attribute float aSeed;varying float vAlpha,vSeed;
  void main(){
   float t=uTime*(.55+.5*aSeed)+aSeed*37.;
   vec2 q=position.xz+vec2(cos(t),sin(t))*6.;
   float life=fract(t*.31+aSeed),lift=sin(life*3.14159)*(1.+7.*aSeed);
   vec3 p=vec3(q.x,waveHeight(q)+.35+lift,q.y);
   vec4 eye=modelViewMatrix*vec4(p,1.);
   gl_PointSize=clamp((2.+aSeed*3.)*115./max(12.,-eye.z),1.2,6.);
   vAlpha=sin(life*3.14159)*(.4+.6*aSeed);vSeed=aSeed;
   gl_Position=projectionMatrix*eye;
  }`,
  fragmentShader:`precision highp float;varying float vAlpha,vSeed;
   void main(){float r=length(gl_PointCoord-.5);float alpha=(1.-smoothstep(.07,.5,r))*vAlpha;gl_FragColor=vec4(mix(vec3(1.,.53,.14),vec3(1.,.65,.98),vSeed),alpha);}`});
 const spray=new THREE.Points(pg,pm);spray.name='Electric Ocean wave-bound luminous spray';spray.frustumCulled=false;root.add(spray);
 return {root,surface,spray,update(time){uniforms.uTime.value=time;},dispose(){root.removeFromParent();surface.geometry.dispose();material.dispose();pg.dispose();pm.dispose();}};
}
