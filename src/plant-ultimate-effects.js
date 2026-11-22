import * as THREE from 'three';

// Botanical ultimates: local green adaptations of the Lightning Fire Tornado
// and Golden Chain Rain effect structures. The linked vendor downloads are
// references, not bundled originals. All damage/collision stays server-owned.
const TWO_PI=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const emerald=new THREE.Color('#42ff89');
const mint=new THREE.Color('#bdffb3');
const jade=new THREE.Color('#19b85b');

const vortexVertex='uniform float uTime;varying vec2 vUv;varying float vHeight;void main(){vUv=uv;float h=position.y+.5;vHeight=h;float a=atan(position.z,position.x)+uTime*3.25+h*18.;float r=mix(.33,1.82,pow(h,.85))*(1.+.13*sin(h*30.-uTime*10.));vec3 p=vec3(cos(a)*r,h*7.,sin(a)*r);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}';
const vortexFragment='precision highp float;uniform float uTime,uOpacity;varying vec2 vUv;varying float vHeight;void main(){float wave=sin(vUv.x*36.+vUv.y*55.-uTime*14.);float curl=sin(vUv.y*88.+vUv.x*15.+uTime*11.);float core=pow(max(0.,wave),3.)*.65+pow(max(0.,curl),7.)*.30;float ends=smoothstep(0.,.09,vHeight)*(1.-smoothstep(.87,1.,vHeight));float alpha=(.09+core)*ends*uOpacity;vec3 deep=vec3(.035,.43,.17),bright=vec3(.36,1.,.52);gl_FragColor=vec4(mix(deep,bright,clamp(core*1.5,0.,1.)),alpha);}';
const moteVertex='attribute vec3 aSeed;uniform float uTime;varying float vLife;void main(){float age=fract(aSeed.x+uTime*.22);float a=aSeed.y*6.283185+uTime*3.7+age*8.;float r=(.35+age*1.6)*(.6+aSeed.z*.6);vec3 p=vec3(cos(a)*r,age*7.,sin(a)*r);vLife=sin(age*3.14159);vec4 eye=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(95./max(1.,-eye.z),1.,8.);gl_Position=projectionMatrix*eye;}';
const moteFragment='precision mediump float;uniform float uOpacity;varying float vLife;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(.37,1.,.53,(1.-d)*(1.-d)*vLife*.8*uOpacity);}';
function rings(parent,count=3){
 const result=[];
 for(let i=0;i<count;i++){
  const material=new THREE.MeshBasicMaterial({
   color:i%2?'#8aff92':'#36ff80',transparent:true,opacity:0,
   depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false
  });
  const mesh=new THREE.Mesh(new THREE.RingGeometry(.96,1.03,64),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.y=.06+i*.013;
  parent.add(mesh);result.push(mesh);
 }
 return result;
}
function makeTornado(){
 const group=new THREE.Group();group.name='Green lightning-fire tornado';
 const material=new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0},uOpacity:{value:0}},
  vertexShader:vortexVertex,fragmentShader:vortexFragment,
  side:THREE.DoubleSide,transparent:true,depthWrite:false,
  blending:THREE.AdditiveBlending,toneMapped:false
 });
 const geometry=new THREE.CylinderGeometry(1,1,1,48,40,true);
 for(let i=0;i<3;i++){
  const mesh=new THREE.Mesh(geometry,material);
  mesh.rotation.y=i*TWO_PI/3;mesh.scale.setScalar(1+i*.095);
  mesh.frustumCulled=false;group.add(mesh);
 }
 const positions=new Float32Array(14*10*2*3),arcGeometry=new THREE.BufferGeometry();
 arcGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
 const arcMaterial=new THREE.LineBasicMaterial({
  color:'#caffb3',transparent:true,opacity:0,depthWrite:false,
  blending:THREE.AdditiveBlending,toneMapped:false
 });
 const arcs=new THREE.LineSegments(arcGeometry,arcMaterial);
 arcs.frustumCulled=false;group.add(arcs);
 const pointsGeometry=new THREE.BufferGeometry(),count=240,seeds=new Float32Array(count*3);
 pointsGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));
 for(let i=0;i<count;i++){seeds[i*3]=(i*.61803398875)%1;seeds[i*3+1]=(i*.41421356237)%1;seeds[i*3+2]=(i*.73205080757)%1;}
 pointsGeometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,3));
 const pointsMaterial=new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0},uOpacity:{value:0}},
  vertexShader:moteVertex,fragmentShader:moteFragment,
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  toneMapped:false
 });
 const points=new THREE.Points(pointsGeometry,pointsMaterial);
 points.frustumCulled=false;group.add(points);
 const floorRings=rings(group,3);
 return {kind:'palm',group,material,arcMaterial,arcGeometry,positions,pointsMaterial,floorRings,
  age:0,duration:3.5};
}
function updateTornado(e){
 const t=e.age,fade=clamp(t/.18,0,1)*clamp((e.duration-t)/.65,0,1);
 e.material.uniforms.uTime.value=t;e.material.uniforms.uOpacity.value=fade;
 e.pointsMaterial.uniforms.uTime.value=t;e.pointsMaterial.uniforms.uOpacity.value=fade;
 e.arcMaterial.opacity=.83*fade;
 const a=e.positions;
 let k=0;
 for(let i=0;i<14;i++){
  const phase=i*2.3999632;
  for(let j=0;j<10;j++){
   for(let m=0;m<2;m++){
    const h=(j+m)/10,angle=phase+h*16.+t*3.8;
    const r=(.31+1.4*h)*(1+Math.sin(i*5.61+j*9.73+t*23.)*.12);
    a[k++]=Math.cos(angle)*r;
    a[k++]=.2+h*6.8;
    a[k++]=Math.sin(angle)*r;
   }
  }
 }
 e.arcGeometry.attributes.position.needsUpdate=true;
 for(let i=0;i<e.floorRings.length;i++){
  const r=e.floorRings[i],pulse=clamp((t-i*.22)/.85,0,1);
  r.scale.setScalar((.3+pulse*3.2));
  r.material.opacity=.48*(1-pulse)*fade;
  r.rotation.z=t*(i%2?-.45:.45);
 }
}
function makeChainRain(){
 const group=new THREE.Group();group.name='Three waves of eight green falling chains';
 const linkGeometry=new THREE.TorusGeometry(.19,.055,5,12);
 const linkMaterial=new THREE.MeshBasicMaterial({
  color:'#ffffff',transparent:true,opacity:.92,depthWrite:false,
  blending:THREE.AdditiveBlending,toneMapped:false
 });
 const chains=new THREE.InstancedMesh(linkGeometry,linkMaterial,3*8*7);
 chains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 chains.frustumCulled=false;
 const tints=[emerald,mint,jade];
 for(let i=0;i<chains.count;i++)chains.setColorAt(i,tints[(i+Math.floor(i/7))%3]);
 chains.instanceColor.needsUpdate=true;group.add(chains);
 const floorRings=rings(group,3);
 const streakMaterial=new THREE.LineBasicMaterial({
  color:'#a3ffa9',transparent:true,opacity:0,depthWrite:false,
  blending:THREE.AdditiveBlending,toneMapped:false
 });
 const streakPositions=new Float32Array(24*2*3),streakGeometry=new THREE.BufferGeometry();
 streakGeometry.setAttribute('position',new THREE.BufferAttribute(streakPositions,3).setUsage(THREE.DynamicDrawUsage));
 const streaks=new THREE.LineSegments(streakGeometry,streakMaterial);
 streaks.frustumCulled=false;group.add(streaks);
 const glitterGeometry=new THREE.BufferGeometry(),glitterCount=160,coordinates=new Float32Array(glitterCount*3);
 for(let i=0;i<glitterCount;i++){
  const a=i*2.3999632,r=Math.sqrt((i*.6180339)%1)*3;
  coordinates[i*3]=Math.cos(a)*r;
  coordinates[i*3+1]=((i*.4142135)%1)*1.9+.2;
  coordinates[i*3+2]=Math.sin(a)*r;
 }
 glitterGeometry.setAttribute('position',new THREE.BufferAttribute(coordinates,3));
 const glitterMaterial=new THREE.PointsMaterial({
  color:'#9cffa3',size:.14,sizeAttenuation:true,transparent:true,
  opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false
 });
 const glitter=new THREE.Points(glitterGeometry,glitterMaterial);
 glitter.frustumCulled=false;group.add(glitter);
 return {kind:'planter',group,chains,floorRings,streaks,streakGeometry,streakMaterial,
  streakPositions,glitter,age:0,duration:3.4,dummy:new THREE.Object3D()};
}
function chainPosition(wave,column){
 const a=column*TWO_PI/8+wave*.45;
 const r=.85+((column*7+wave*3)%9)/9*1.85;
 return [Math.cos(a)*r,Math.sin(a)*r];
}
function updateChainRain(e){
 const t=e.age,dummy=e.dummy;
 for(let w=0;w<3;w++){
  const phase=(t-w*.66)/.91,fall=clamp(phase,0,1);
  const ring=e.floorRings[w],impact=clamp((phase-.78)/.9,0,1);
  ring.visible=phase>.78&&phase<1.85;
  ring.scale.setScalar(.35+impact*3.1);
  ring.material.opacity=.7*(1-impact)*clamp((e.duration-t)/.48,0,1);
  ring.rotation.z=t*(w%2?-.6:.6);
  for(let c=0;c<8;c++){
   const [x,z]=chainPosition(w,c);
   const idx=w*8+c,offset=idx*6;
   e.streakPositions[offset]=x;e.streakPositions[offset+1]=Math.max(.08,8.5-fall*8.2);
   e.streakPositions[offset+2]=z;
   e.streakPositions[offset+3]=x;e.streakPositions[offset+4]=Math.max(.08,10.5-fall*8.2);
   e.streakPositions[offset+5]=z;
   for(let link=0;link<7;link++){
    const id=idx*7+link;
    dummy.position.set(x+Math.sin(t*8+c+w)*.055,
     Math.max(.12,9.1-fall*10.+link*.33),z+Math.cos(t*7+c)*.055);
    dummy.rotation.set(0,(link%2)*Math.PI/2,t*.21);
    const visible=phase>=0&&phase<=1.32;
    const factor=visible?Math.min(1,phase*9)*Math.min(1,(1.33-phase)*7):0;
    dummy.scale.setScalar(Math.max(.00001,factor));
    dummy.updateMatrix();e.chains.setMatrixAt(id,dummy.matrix);
   }
  }
 }
 e.chains.instanceMatrix.needsUpdate=true;
 e.streakGeometry.attributes.position.needsUpdate=true;
 e.streakMaterial.opacity=.34*clamp(t/.18,0,1)*clamp((e.duration-t)/.6,0,1);
 e.glitter.material.opacity=.3*clamp(t/.4,0,1)*clamp((e.duration-t)/.8,0,1);
 e.glitter.rotation.y=t*.18;
}
function disposeEffect(entry){
 entry.group.removeFromParent();
 const geometries=new Set(),materials=new Set();
 entry.group.traverse(o=>{
  if(o.geometry)geometries.add(o.geometry);
  if(o.material)for(const mat of Array.isArray(o.material)?o.material:[o.material])materials.add(mat);
  if(o.isInstancedMesh)o.dispose();
 });
 for(const geometry of geometries)geometry.dispose();
 for(const mat of materials)mat.dispose();
}

export class PlantUltimateEffects {
 constructor(scene){this.scene=scene;this.active=[];this.pools={palm:[],planter:[]};this.limit=12;}
 create(kind){return kind==='palm'?makeTornado():makeChainRain();}
 async warm(renderer,camera){
  const stage=new THREE.Scene(),created=[];
  for(const kind of ['palm','planter']){
   for(let i=0;i<2;i++){
    const e=this.create(kind);e.group.position.set((i*2-1)*4,0,0);
    if(kind==='palm')updateTornado(e);else updateChainRain(e);
    stage.add(e.group);created.push(e);
   }
  }
  const view=camera.clone();view.position.set(13,10,19);view.lookAt(0,4,0);
  const target=new THREE.WebGLRenderTarget(32,32,{depthBuffer:true});
  const previous=renderer.getRenderTarget();
  try{
   await renderer.compileAsync(stage,view);
   renderer.setRenderTarget(target);renderer.render(stage,view);
  }finally{
   renderer.setRenderTarget(previous);target.dispose();
   for(const e of created){e.group.removeFromParent();this.pools[e.kind].push(e);}
  }
 }
 play(event,item){
  if(!event?.ultimate||item?.exotic||!['palm','planter'].includes(item?.family))return false;
  const kind=item.family,pool=this.pools[kind],entry=pool.pop()||this.create(kind);
  if(this.active.length>=this.limit)this.recycle(this.active[0]);
  const direction=event.direction||[0,0,1],origin=event.origin||[0,0,0];
  const radius=Number(event.area?.radius)||Number(event.radius)||4;
  const distance=Math.min(24,(Number(event.range)||12)*.65);
  const center=event.area?.visualCenter||event.area?.center||event.impactPoint||
    [origin[0]+direction[0]*distance,0,origin[2]+direction[2]*distance];
  entry.age=0;entry.group.visible=true;
  entry.group.position.set(Number(center[0])||0,Math.max(.08,Number(center[1])||0),Number(center[2])||0);
  if(kind==='palm')entry.group.scale.set(clamp(radius/1.82,.35,15),clamp(radius/3.3,.35,3.5),clamp(radius/1.82,.35,15));
  else entry.group.scale.setScalar(clamp(radius/3.5,.35,10));
  entry.group.rotation.set(0,0,0);
  if(kind==='palm')updateTornado(entry);else updateChainRain(entry);
  this.scene.add(entry.group);this.active.push(entry);
  return true;
 }
 recycle(entry){
  const i=this.active.indexOf(entry);if(i>=0)this.active.splice(i,1);
  entry.group.removeFromParent();const pool=this.pools[entry.kind];
  if(pool.length<2)pool.push(entry);else disposeEffect(entry);
 }
 update(dt){
  const delta=Number.isFinite(dt)?clamp(dt,0,.12):0;
  for(const entry of [...this.active]){
   entry.age+=delta;
   if(entry.age>=entry.duration){this.recycle(entry);continue;}
   if(entry.kind==='palm')updateTornado(entry);else updateChainRain(entry);
  }
 }
 dispose(){
  for(const entry of [...this.active]){this.active.splice(this.active.indexOf(entry),1);disposeEffect(entry);}
  for(const pool of Object.values(this.pools)){for(const entry of pool)disposeEffect(entry);pool.length=0;}
 }
}
