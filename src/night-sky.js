import * as THREE from 'three';

// The sky is an infinitely distant WORLD-ORIENTED backdrop. Only its origin
// follows the camera position: it never follows the camera's rotation.
// Every cloud is a translucent object hundreds of metres away with depth
// testing enabled, so scene geometry always occludes it.
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
// Batched camera-facing layers at REAL 3D positions. A cloud is a volume
// of overlapping translucent vapour puffs, never an opaque clipped paper card.
// Soft fragment masks are zero along ALL quad edges; shader noise breaks any
// artificial rectangular silhouette without canvas mask truncation.
const cloudVertex=`
attribute float aSeed;
varying vec2 vUv;varying float vSeed;varying vec3 vEye;
uniform float uTime;
void main(){
 vUv=uv;vSeed=aSeed;
 vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
 float sx=length(instanceMatrix[0].xyz),sy=length(instanceMatrix[1].xyz);
 // In view space, translating XY makes each puff billboard to the camera;
 // the instance center (including its Z) retains full depth and perspective.
 vec2 drift=vec2(sin(uTime*.08+aSeed*31.),cos(uTime*.055+aSeed*17.))*vec2(1.,.45);
 center.xy+=(position.xy+drift*.013)*vec2(sx,sy);
 vEye=center.xyz;
 gl_Position=projectionMatrix*center;
}`;
const cloudFragment=`
precision highp float;
varying vec2 vUv;varying float vSeed;varying vec3 vEye;
uniform float uTime,uOpacity;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
void main(){
 vec2 p=vUv*2.-1.;float wobble=uTime*.014;
 float n=noise(p*vec2(3.7,4.2)+vec2(vSeed*13.1,wobble));
 n=n*.54+noise(p*8.3+vec2(vSeed*27.,-wobble))*.29+noise(p*17.5+vSeed*37.)*.17;
 float contour=length(vec2(p.x,p.y*1.2));
 float cloud=(1.-smoothstep(.25,1.14,contour+(n-.5)*.42));
 // Reject all fragments along the physical quad boundaries: never a hard
 // vertical edge even when an ellipse expands beyond the cloud bank.
 float feather=(1.-smoothstep(.73,1.,abs(p.x)))*(1.-smoothstep(.70,1.,abs(p.y)));
 float alpha=cloud*feather*(.5+n*.5)*uOpacity;
 if(alpha<.007)discard;
 vec3 top=vec3(.85,.9,1.),bottom=vec3(.48,.62,.82);
 vec3 light=mix(bottom,top,clamp(vUv.y*.8+n*.25,0.,1.));
 gl_FragColor=vec4(light,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
function cloudBank(root,index,touch){
 const kinds=['broad','wispy','broken','broad','broken','wispy','broad','wispy','broken','broad','broken','wispy'];
 const kind=kinds[index],rnd=random(0xc0124+index*2997);
 const angle=index*Math.PI*2/kinds.length+(index%2)*.12;
 const distance=252+(index%3)*26,altitude=80+(index%5)*23;
 const count=(kind==='broad'?32:kind==='wispy'?16:23)*(touch ? .65 : 1);
 const width=(kind==='broad'?220:kind==='wispy'?152:183)*(touch ? .83 : 1);
 const group=new THREE.Group();group.name='Translucent volumetric '+kind+' cloud '+index;
 group.position.set(Math.cos(angle)*distance,altitude,Math.sin(angle)*distance);
 group.lookAt(0,altitude,0);
 const geometry=new THREE.PlaneGeometry(1,1);
 const seeds=new Float32Array(Math.round(count));
 const material=new THREE.ShaderMaterial({
  vertexShader:cloudVertex,fragmentShader:cloudFragment,
  uniforms:{uTime:{value:0},uOpacity:{value:kind==='wispy' ? .24 : kind==='broken' ? .34 : .29}},
  transparent:true,depthTest:true,depthWrite:false,
  side:THREE.DoubleSide,blending:THREE.NormalBlending,fog:false,toneMapped:false
 });
 const mist=new THREE.InstancedMesh(geometry,material,seeds.length);
 const dummy=new THREE.Object3D();
 for(let i=0;i<seeds.length;i++){
  const spread=(rnd()-.5)*width,cluster=Math.cos(spread/width*Math.PI);
  const cloudY=(rnd()-.5)*(kind==='wispy'?23:kind==='broken'?49:48);
  const x=spread+(rnd()-.5)*12,y=cloudY+cluster*9;
  const depth=(rnd()-.5)*(kind==='wispy'?21:44);
  const sx=(kind==='broad'?33:kind==='wispy'?32:26)*(0.6+rnd()*.8);
  const sy=(kind==='broad'?23:kind==='wispy'?8:18)*(0.6+rnd()*.7);
  dummy.position.set(x,y,depth);dummy.rotation.set(0,0,0);
  dummy.scale.set(sx,sy,1);dummy.updateMatrix();mist.setMatrixAt(i,dummy.matrix);
  seeds[i]=rnd();
 }
 geometry.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,1));
 mist.instanceMatrix.needsUpdate=true;
 mist.frustumCulled=false;mist.renderOrder=-120;
 group.add(mist);root.add(group);
 return {group,base:angle,distance,altitude,phase:index*1.17,wind:.0018+(index%3)*.0006,kind,material};
}
export function createMoonlitSky(scene){
  const touch=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
  const rand=random(173331);
  const root=new THREE.Group();
  root.name='World-oriented distant cloud sky (no moon)';
  scene.add(root);
  const clouds=Array.from({length:12},(_,i)=>cloudBank(root,i,touch));
  const stars=[],colors=[];
  for(let i=0;i<(touch?900:1900);i++){
    const a=rand()*Math.PI*2,el=.24+rand()*1.17,r=345;
    stars.push(r*Math.cos(a)*Math.cos(el),r*Math.sin(el),r*Math.sin(a)*Math.cos(el));
    const c=new THREE.Color(rand()<.12?'#f3e2bd':'#adc8ff');const shade=.43+rand()*.57;
    colors.push(c.r*shade,c.g*shade,c.b*shade);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const starfield=new THREE.Points(geo,new THREE.PointsMaterial({
    size:1.15,vertexColors:true,opacity:.77,transparent:true,depthTest:true,
    depthWrite:false,sizeAttenuation:false,toneMapped:false,fog:false
  }));
  starfield.name='Distant stars';starfield.renderOrder=-150;root.add(starfield);
  return {root,clouds,update(camera,time){
    if(camera)root.position.copy(camera.position);
    // Slow wind in world-space; no camera-relative quad or screen-space dirt.
    for(const cloud of clouds){
      const theta=cloud.base+time*cloud.wind+Math.sin(time*.07+cloud.phase)*.018;
      cloud.group.position.set(Math.cos(theta)*cloud.distance,cloud.altitude+Math.sin(time*.22+cloud.phase)*1.8,Math.sin(theta)*cloud.distance);
      cloud.material.uniforms.uTime.value=time;
    }
  }};
}
