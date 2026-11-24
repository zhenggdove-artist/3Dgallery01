import * as THREE from 'three';

// World-oriented, camera-centred celestial ocean. All geometry is uploaded
// once; per-frame animation is exclusively a shared time uniform.
export const SKY_PARTICLE_COUNTS=Object.freeze({mobile:36000,desktop:64000});
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const PI=Math.PI,TAU=2*PI;
const fieldGLSL=`
 float band(vec3 d){
  float a=sin(dot(d,vec3(3.7,5.2,-2.8))+1.8*sin(dot(d,vec3(-4.2,1.8,3.6))));
  float b=sin(dot(d,vec3(-6.3,2.9,4.7))+1.5*sin(dot(d,vec3(2.7,4.9,1.8))));
  return .5+.5*sin(2.8*a+1.4*b+dot(d,vec3(2.,-1.7,3.)));
 }
 vec3 roll(vec3 d,float t){
  vec3 a=vec3(sin(d.y*7.4+d.z*4.3+t*.28),sin(d.z*6.9-d.x*4.2-t*.24),sin(d.x*7.8+d.y*3.7+t*.21));
  vec3 b=vec3(sin(d.z*13.2-d.y*4.7-t*.43),sin(d.x*12.8+d.z*3.9+t*.37),sin(d.y*11.5-d.x*5.1+t*.33));
  return normalize(d+a*.072+b*.031);
 }
 vec3 nebulaColor(vec3 d){
  float mix1=.5+.5*sin(dot(d,vec3(5.9,-3.1,4.2))+2.*sin(d.y*5.));
  float mix2=.5+.5*sin(dot(d,vec3(-3.4,5.8,6.1)));
  vec3 blue=vec3(.045,.17,.46),violet=vec3(.25,.075,.46);
  vec3 pink=vec3(.72,.14,.42),cyan=vec3(.045,.48,.60);
  return mix(mix(blue,violet,mix1),mix(pink,cyan,mix2),smoothstep(.34,.85,mix1)*.86);
 }
`;
// Same continuous field for CPU seeding and GPU illumination: no longitude
// seam and no poles, and dense dust is concentrated in curved galactic lanes.
export function nebulaBand(x,y,z){
 const a=Math.sin(3.7*x+5.2*y-2.8*z+1.8*Math.sin(-4.2*x+1.8*y+3.6*z));
 const b=Math.sin(-6.3*x+2.9*y+4.7*z+1.5*Math.sin(2.7*x+4.9*y+1.8*z));
 return .5+.5*Math.sin(2.8*a+1.4*b+2*x-1.7*y+3*z);
}
function noiseTexture(){
 const size=256,data=new Uint8Array(size*size*4),rand=random(0x77a29);
 const grids=[8,16,32,64,128].map(n=>({n,values:Float32Array.from({length:n*n},()=>rand())}));
 const sample=(grid,x,y)=>{
  const {n,values}=grid,u=x*n/size,v=y*n/size,ix=Math.floor(u),iy=Math.floor(v);
  let fx=u-ix,fy=v-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  const at=(a,b)=>values[(b%n)*n+a%n];
  return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
 };
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let v=0;const weights=[.34,.27,.19,.13,.07];
  for(let j=0;j<grids.length;j++)v+=sample(grids[j],x,y)*weights[j];
  const k=(y*size+x)*4;data[k]=data[k+1]=data[k+2]=Math.round(v*255);data[k+3]=255;
 }
 const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
 return texture;
}
export function nebulaParticleGeometry(count){
 const rand=random(173331),positions=new Float32Array(count*3),seeds=new Float32Array(count),layers=new Float32Array(count),sizes=new Float32Array(count);
 for(let i=0;i<count;i++){
  // 28% diffuse stars, 60% dense nebula filaments, 12% luminous stars.
  const layer=i<count*.28?0:i<count*.88?1:2;
  let x,y,z,density;
  do{
   y=rand()*2-1;const a=rand()*TAU,r=Math.sqrt(Math.max(0,1-y*y));
   x=r*Math.cos(a);z=r*Math.sin(a);density=nebulaBand(x,y,z);
  }while(layer===1&&rand()>.045+.955*Math.pow(density,4));
  const radius=layer===0?790+rand()*45:layer===1?570+rand()*155:650+rand()*110;
  positions.set([x*radius,y*radius,z*radius],i*3);
  layers[i]=layer;seeds[i]=rand();sizes[i]=rand();
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));
 g.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
 g.setAttribute('aLayer',new THREE.BufferAttribute(layers,1));
 g.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
 return g;
}
export function createMoonlitSky(scene,renderer=null,{mobile=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches}={}){
 const root=new THREE.Group();root.name='Cosmic nebula turbulent particle ocean';scene.add(root);
 const texture=noiseTexture();
 const baseColor=new THREE.Color('#101b36');
 const uniforms={uBaseColor:{value:baseColor},uTime:{value:0},uNoise:{value:texture},uPixelRatio:{value:renderer?.getPixelRatio()||1}};
 // Opaque background draws first without touching depth. Existing terrain,
 // buildings, ocean and transparent VFX retain their normal occlusion.
 const dome=new THREE.Mesh(new THREE.SphereGeometry(880,40,24),new THREE.ShaderMaterial({
  uniforms,side:THREE.BackSide,depthWrite:false,depthTest:false,toneMapped:false,fog:false,
  vertexShader:`
   varying vec3 vDir;
   void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    gl_Position.z=gl_Position.w*.99999;}
  `,
  fragmentShader:`
   precision highp float;varying vec3 vDir;uniform float uTime;uniform sampler2D uNoise;uniform vec3 uBaseColor;
   ${fieldGLSL}
   float dust(vec3 d,float scale,vec2 offset){
    vec3 w=abs(d);w*=w;w*=w;w/=max(.001,w.x+w.y+w.z);
    return texture2D(uNoise,d.yz*scale+offset).r*w.x+
      texture2D(uNoise,d.xz*scale+offset).r*w.y+
      texture2D(uNoise,d.xy*scale+offset).r*w.z;
   }
   void main(){
    vec3 d=normalize(vDir),p=roll(d,uTime);
    float t=uTime*.012;
    float n=dust(p,1.45,vec2(t,-t*.62));
    float detail=dust(p,3.7,vec2(-t*.71,t*.48));
    float lane=band(p);
    float billow=smoothstep(.27,.78,n*.73+detail*.27);
    float clouds=pow(lane,1.8)*(.18+.82*billow);
    float crest=pow(lane,6.)*smoothstep(.43,.76,n);
    vec3 col=uBaseColor*(.65+.55*n);
    vec3 gas=nebulaColor(p);
    col+=gas*clouds*.40;
    col+=mix(gas,vec3(.53,.66,.88),.32)*crest*.19;
    // Dark dust lanes and turbulent overlapping swells, not a flat blue sky.
    col*=.72+.28*smoothstep(.20,.57,detail);
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
   }
  `
 }));
 dome.name='Deep space rolling nebula dome';dome.renderOrder=-200;dome.frustumCulled=false;root.add(dome);
 const geometry=nebulaParticleGeometry(mobile?SKY_PARTICLE_COUNTS.mobile:SKY_PARTICLE_COUNTS.desktop);
 // One point-cloud draw, three depth populations. Real radial displacement,
 // coherent advection, slow counter-currents and a bright stellar population.
 const particles=new THREE.Points(geometry,new THREE.ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,depthTest:true,fog:false,toneMapped:false,blending:THREE.AdditiveBlending,
  vertexShader:`
   precision highp float;uniform float uTime,uPixelRatio;
   attribute float aSeed,aLayer,aSize;varying vec3 vColor;varying float vAlpha,vSpark;
   ${fieldGLSL}
   void main(){
    float radius=length(position);vec3 d=position/radius;
    float t=uTime*(aLayer<.5?.26:aLayer<1.5?1.:.60);
    // Advect stars with the inverse of the cloud warp so both luminous
    // particles and the gaseous current travel in the same direction.
    vec3 flow=roll(d,-t);
    float fold=sin(dot(flow,vec3(16.4,-12.7,9.3))+t*.69+2.8*sin(dot(flow,vec3(5.2,7.6,-3.))));
    float crosswave=sin(dot(flow,vec3(-11.3,17.1,12.6))-t*.53);
    float swell=(fold*.68+crosswave*.32)*(aLayer<.5?6.:35.);
    vec3 q=flow*(radius+swell);
    vec4 eye=modelViewMatrix*vec4(q,1.);
    gl_Position=projectionMatrix*eye;
    // Sky stars are behind ALL world geometry, including distant sea.
    gl_Position.z=gl_Position.w*.999995;
    float twinkle=.72+.28*sin(t*(.8+aSeed*1.8)+aSeed*91.);
    float sparkle=pow(max(0.,sin(t*.8+aSeed*128.)),12.);
    float lane=band(d);
    vec3 gas=nebulaColor(d);
    float bright=pow(aSize,5.);
    vSpark=aLayer>1.5?bright:0.;
    if(aLayer<.5){
      vColor=mix(vec3(.48,.66,1.),vec3(1.,.90,.76),aSeed);
      vAlpha=(.30+.65*aSize)*twinkle;
      gl_PointSize=(.85+1.05*bright)*uPixelRatio;
    }else if(aLayer<1.5){
      vColor=mix(gas,vec3(.63,.77,1.),.18+.30*bright);
      vAlpha=(.20+.48*lane+.24*bright)*twinkle;
      gl_PointSize=(.85+1.65*aSize+1.4*bright)*uPixelRatio*(700./max(500.,radius+swell));
    }else{
      vColor=mix(vec3(.63,.81,1.),vec3(1.,.65,.80),aSeed*.8);
      vAlpha=(.48+.52*bright)*(.82+.18*twinkle);
      gl_PointSize=(1.15+3.5*bright+sparkle*.8)*uPixelRatio;
    }
    gl_PointSize=clamp(gl_PointSize,.85,8.);
   }
  `,
  fragmentShader:`
   precision highp float;varying vec3 vColor;varying float vAlpha,vSpark;
   void main(){
    vec2 p=gl_PointCoord*2.-1.;float r=length(p);
    float core=1.-smoothstep(.03,.75,r);
    float halo=exp(-r*r*5.5)*(1.-smoothstep(.68,1.,r));
    float rays=(exp(-abs(p.x)*18.)+exp(-abs(p.y)*18.))*(1.-smoothstep(.25,1.,r))*vSpark*.22;
    float a=(core*.82+halo*.30+rays)*vAlpha;
    if(a<.008)discard;
    gl_FragColor=vec4(vColor,a);
    #include <colorspace_fragment>
   }
  `
 }));
 particles.name='Dense advected nebula stars and rolling particle swells';
 particles.renderOrder=-150;particles.frustumCulled=false;root.add(particles);
 return {root,dome,particles,setBaseColor(value){if(typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)){baseColor.set(value);scene.background?.set?.(value);}},update(camera,time){
  if(camera)root.position.copy(camera.position);
  uniforms.uTime.value=time;
  if(renderer)uniforms.uPixelRatio.value=renderer.getPixelRatio();
 },dispose(){
  root.removeFromParent();dome.geometry.dispose();dome.material.dispose();geometry.dispose();particles.material.dispose();texture.dispose();
 }};
}
