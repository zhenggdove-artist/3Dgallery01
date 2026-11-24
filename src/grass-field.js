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
  // Real 3D off-map field: depth-tested sculptural forms and particles.
  // No bloom framebuffer, CPU particle updates, or repeated per-object draw calls.
  const horizonMaterial=new THREE.ShaderMaterial({side:THREE.DoubleSide,depthWrite:true,toneMapped:false,
   uniforms:{uTime:{value:0}},vertexShader:`varying vec2 vWorld;void main(){vWorld=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`precision mediump float;varying vec2 vWorld;uniform float uTime;
    void main(){float r=length(vWorld);float cloud=.5+.5*sin(vWorld.x*.018+sin(vWorld.y*.025)*1.7+uTime*.08);
    vec3 col=mix(vec3(.54,.10,.34),vec3(.95,.30,.61),cloud*.45+.45);
    col=mix(col,vec3(1.,.60,.79),smoothstep(270.,780.,r)*.65);
    gl_FragColor=vec4(col,1.);}`});
  this.horizon=new THREE.Mesh(new THREE.RingGeometry(CITY_OUTER_RADIUS+.65,1500,128),horizonMaterial);
  this.horizon.name='Pink atmospheric foundation outside city';this.horizon.rotation.x=-Math.PI/2;
  this.horizon.position.y=-.075;scene.add(this.horizon);
  this.horizonVolume=new THREE.Group();this.horizonVolume.name='Floating psychedelic 3D sculpture field';
  scene.add(this.horizonVolume);
  const uniforms={uTime:{value:0}};
  const geometryShader=new THREE.ShaderMaterial({uniforms,depthWrite:true,side:THREE.DoubleSide,toneMapped:false,
   vertexShader:`uniform float uTime;varying vec3 vNormal,vEye,vPos;varying float vSeed;
    void main(){vec3 p=position,n=normal;vec3 anchor=instanceMatrix[3].xyz;
    float seed=fract(sin(dot(anchor.xz,vec2(.031,.072)))*416.17);
    float t=uTime*(.12+seed*.13)+seed*6.28,c=cos(t),s=sin(t);
    mat2 rot=mat2(c,s,-s,c);p.xz=rot*p.xz;n.xz=rot*n.xz;
    float pulse=1.+.12*sin(t*2.+p.y*2.);p*=pulse;
    vec4 local=instanceMatrix*vec4(p,1.);
    local.y+=sin(t*1.7)*5.;vec4 eye=modelViewMatrix*local;
    vNormal=normalize(normalMatrix*mat3(instanceMatrix)*n);vEye=-eye.xyz;vPos=local.xyz;vSeed=seed;
    gl_Position=projectionMatrix*eye;}`,
   fragmentShader:`precision mediump float;uniform float uTime;varying vec3 vNormal,vEye,vPos;varying float vSeed;
    void main(){vec3 n=normalize(vNormal),v=normalize(vEye);float facing=abs(dot(n,v));
    float rim=pow(1.-facing,2.2),lit=.25+.75*max(0.,dot(n,normalize(vec3(-.4,.8,.65))));
    float flow=.5+.5*sin(vPos.y*.23+vPos.x*.09+vPos.z*.07+uTime*.55+vSeed*9.);
    vec3 base=mix(vec3(.85,.10,.57),vec3(.47,.13,.88),flow);
    vec3 col=base*lit+vec3(1.,.53,.13)*pow(flow,4.)*.9+vec3(1.,.67,.92)*rim*.85;
    float haze=smoothstep(180.,850.,length(vEye));col=mix(col,vec3(.99,.42,.69),haze*.68);
    gl_FragColor=vec4(col,1.);}`});
  let rngState=0x46c083a1;const rnd=()=>((rngState=(Math.imul(rngState,1664525)+1013904223)>>>0)/4294967296);
  const dummy=new THREE.Object3D(),geos=[
   new THREE.TorusKnotGeometry(1,.22,mobile?48:72,8,2,3),
   new THREE.TorusGeometry(1,.24,8,mobile?24:36),
   new THREE.IcosahedronGeometry(1,1)
  ];
  for(let kind=0;kind<geos.length;kind++){
   const count=(mobile?[30,42,38]:[54,66,58])[kind],mesh=new THREE.InstancedMesh(geos[kind],geometryShader,count);
   mesh.name=['Twisted luminous knots','Orbital sculptural rings','Floating faceted crystals'][kind];
   for(let i=0;i<count;i++){const group=i%12,angle=group*Math.PI/6+(rnd()-.5)*.42;
    const r=CITY_OUTER_RADIUS+35+rnd()*340,scale=kind===0?10+rnd()*22:kind===1?7+rnd()*18:3+rnd()*12;
    dummy.position.set(Math.cos(angle)*r,8+rnd()*88,Math.sin(angle)*r);
    dummy.rotation.set(rnd()*Math.PI,rnd()*Math.PI*2,rnd()*Math.PI);
    dummy.scale.set(scale,scale*(.75+rnd()*.65),scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;this.horizonVolume.add(mesh);
  }
  const particleCount=mobile?700:1500,particles=new Float32Array(particleCount*3),seeds=new Float32Array(particleCount);
  for(let i=0;i<particleCount;i++){const a=rnd()*Math.PI*2,r=CITY_OUTER_RADIUS+20+rnd()*500;
   particles.set([Math.cos(a)*r,3+rnd()*135,Math.sin(a)*r],i*3);seeds[i]=rnd();}
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particles,3));particleGeo.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
  const particleMat=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
   vertexShader:`attribute float aSeed;uniform float uTime;varying float vAlpha,vSeed;
    void main(){vec3 p=position;float t=uTime*.3+aSeed*6.28;
    p.x+=cos(t)*12.;p.z+=sin(t)*12.;p.y+=sin(t*1.6)*8.;vec4 eye=modelViewMatrix*vec4(p,1.);
    gl_PointSize=clamp((1.+aSeed*2.)*250./max(30.,-eye.z),1.,5.);vAlpha=.35+.55*pow(.5+.5*sin(t*2.),2.);vSeed=aSeed;
    gl_Position=projectionMatrix*eye;}`,
   fragmentShader:`precision mediump float;varying float vAlpha,vSeed;void main(){float d=length(gl_PointCoord-.5);
    float a=(1.-smoothstep(.06,.5,d))*vAlpha;gl_FragColor=vec4(mix(vec3(1.,.62,.18),vec3(1.,.77,1.),vSeed),a);}`});
  const sparkles=new THREE.Points(particleGeo,particleMat);sparkles.frustumCulled=false;this.horizonVolume.add(sparkles);
  this.horizonUniforms=uniforms;
 }
 update(time,roots){
  const uniform=this.mesh.material.uniforms;uniform.uTime.value=time;this.horizon.material.uniforms.uTime.value=time;this.horizonUniforms.uTime.value=time;
  let i=0;for(const root of roots.values()){
   if(i>=6)break;if(!root?.visible)continue;
   uniform.uPlayers.value[i].copy(root.position);i++;
  }
  uniform.uPlayerCount.value=i;
 }
 dispose(){const mats=new Set();this.horizonVolume.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)mats.add(o.material);});mats.forEach(m=>m.dispose());this.horizonVolume.removeFromParent();this.horizon.removeFromParent();this.horizon.geometry.dispose();this.horizon.material.dispose();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.outerMesh.removeFromParent();this.outerMesh.geometry.dispose();this.mesh.material.dispose();this.canopy.removeFromParent();this.canopy.geometry.dispose();this.outerCanopy.removeFromParent();this.outerCanopy.geometry.dispose();this.canopy.material.dispose();}
}