import * as THREE from 'three';

// A staged, ground-attached sword strike. No actual terrain is removed;
// two opaque crack banks, a broad descending blade wave, rising rock shards
// and an expanding dust ring make the split visibly legible in the arena.
const up=new THREE.Vector3(0,1,0);
const maxSaberEffects=5;
function crackGeometry(length){
 const gap=[],rims=[];
 let x=0;
 for(let i=0;i<19;i++){
  const z0=.6+i*length/19,z1=.6+(i+1)*length/19;
  const next=Math.sin(i*2.8)*.45+Math.sin(i*.9)*.7;
  const w=.19+(i%4)*.11;
  gap.push(x-w,.065,z0,x+w,.065,z0,next-w,.065,z1,
    x+w,.065,z0,next+w,.065,z1,next-w,.065,z1);
  rims.push(x-w-.045,.085,z0,next-w-.045,.085,z1,
    x+w+.045,.085,z0,next+w+.045,.085,z1);
  if(i%3===1){
   const offset=i%2?1:-1,branchX=next+offset*(1.6+i*.08);
   rims.push(next,.086,z1,branchX,.087,z1+.7);
  }
  x=next;
 }
 const g=new THREE.BufferGeometry(),r=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(gap,3));
 r.setAttribute('position',new THREE.Float32BufferAttribute(rims,3));
 return {gap:g,rims:r};
}
const slashVertex=String.raw`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const slashFragment=String.raw`
varying vec2 vUv;
uniform float strength;
void main(){
 vec2 p=vUv*2.0-1.0;
 float d=length(vec2(p.x*.77,p.y*.98-.14));
 float rim=exp(-abs(d-.77)*21.0);
 float core=exp(-abs(d-.76)*50.0);
 float middle=exp(-abs(p.x*.42+p.y*.7)*6.0)*exp(-abs(p.x)*1.2);
 float alpha=(rim*.70+core+middle*.44)*strength;
 if(alpha<.015)discard;
 vec3 color=mix(vec3(.98,.47,.14),vec3(1.0,.98,.71),core+middle*.6);
 gl_FragColor=vec4(color,clamp(alpha,0.0,1.0));
}
`;
export class SaberImpact{
 constructor(scene){this.scene=scene;this.active=[];}
 play(event,origin,direction){
  if(this.active.length>=maxSaberEffects)this.remove(this.active[0]);
  const dir=new THREE.Vector3(direction.x,0,direction.z);
  if(dir.lengthSq()<.01)dir.set(0,0,1);dir.normalize();
  const length=Math.min(100,Math.max(.5,Number(event.range)||26)),ground=Math.max(.06,(event.origin?.[1]??origin.y)-.92);
  const root=new THREE.Group();
  root.name='Ground-splitting sword energy: cracks and flying stones';
  root.position.set(event.origin?.[0]??origin.x,ground,event.origin?.[2]??origin.z);
  root.rotation.y=Math.atan2(dir.x,dir.z);
  this.scene.add(root);
  const crack=crackGeometry(length);
  const gap=new THREE.Mesh(crack.gap,new THREE.MeshBasicMaterial({
   color:'#050913',transparent:true,opacity:.94,side:THREE.DoubleSide,
   depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2
  }));gap.name='Visible split in the floor';
  const glowingRims=new THREE.LineSegments(crack.rims,new THREE.LineBasicMaterial({
   color:'#ffce7b',transparent:true,opacity:.94,depthTest:true,depthWrite:false
  }));
  root.add(gap,glowingRims);gap.visible=glowingRims.visible=false;
  const waveMat=new THREE.ShaderMaterial({
   uniforms:{strength:{value:1}},vertexShader:slashVertex,fragmentShader:slashFragment,
   transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
   blending:THREE.AdditiveBlending,toneMapped:false
  });
  const wave=new THREE.Mesh(new THREE.PlaneGeometry(16,13),waveMat);
  wave.name='Enormous forward cutting blade wave';
  wave.position.set(0,6.0,2);root.add(wave);
  const shockwave=new THREE.Mesh(new THREE.RingGeometry(.86,1.07,80),new THREE.MeshBasicMaterial({
   color:'#ffcf7a',transparent:true,opacity:.78,side:THREE.DoubleSide,
   depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending
  }));
  shockwave.rotation.x=-Math.PI/2;
  shockwave.position.set(0,.15,length*.72);
  root.add(shockwave);shockwave.visible=false;
  // Instancing avoids 75 separate GPU draw calls.
  const n=75,rocks=new THREE.InstancedMesh(
   new THREE.DodecahedronGeometry(.22,0),
   new THREE.MeshStandardMaterial({color:'#63606b',metalness:.06,roughness:.92,emissive:'#6e462c',emissiveIntensity:.13}),
   n
  );rocks.name='Flying rocky debris';rocks.frustumCulled=false;root.add(rocks);
  const seeds=Array.from({length:n},(_,i)=>({
   x:(Math.sin((i+1)*31.73)*.5)*7,z:2+(i*17.13%1)*length,
   speed:3.5+(i*13.71%1)*9.5,twist:i*2.39996,velocity:(i%2?1:-1)*(1.5+(i%7)*.29)
  }));
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),pos=new THREE.Vector3();
  for(let i=0;i<n;i++)rocks.setMatrixAt(i,matrix.makeScale(0,0,0));
  rocks.instanceMatrix.needsUpdate=true;
  const e={root,age:0,duration:3.2,length,wave,waveMat,gap,glowingRims,shockwave,rocks,seeds,matrix,q,scale,pos};
  this.active.push(e);return e;
 }
 update(dt){
  for(const fx of [...this.active]){
   try{
    fx.age+=dt;const t=fx.age,burst=Math.max(0,t-.34);
    const travel=Math.min(1,t/.54);
    fx.wave.position.z=1+fx.length*travel*.81;
    fx.wave.rotation.z=-.38+Math.sin(t*6)*.06;
    fx.wave.scale.setScalar(1+Math.min(1,travel)*.5);
    fx.waveMat.uniforms.strength.value=Math.max(0,1-t/.83)*1.45;
    fx.wave.visible=t<.85;
    fx.gap.visible=fx.glowingRims.visible=t>.27;
    fx.gap.material.opacity=Math.max(0,Math.min(1,(t-.27)*8))*.94*(1-Math.max(0,t-2.1)/1.1);
    fx.glowingRims.material.opacity=Math.max(0,1-Math.max(0,t-1.6)/1.4)*.94;
    fx.shockwave.visible=t>.3&&t<1.55;
    fx.shockwave.scale.setScalar(1+burst*11);
    fx.shockwave.material.opacity=Math.max(0,.8-burst*.64);
    for(let i=0;i<fx.seeds.length;i++){
     const s=fx.seeds[i],delay=.24+(s.z/fx.length)*.26,d=Math.max(0,t-delay);
     const live=d>0&&d<2;
     fx.pos.set(s.x+s.velocity*d,.22+Math.max(0,s.speed*d-13*d*d),s.z+Math.sin(s.twist)*d*1.4);
     fx.q.setFromAxisAngle(up,s.twist+d*11);
     fx.scale.setScalar(live?(0.32+(i%7)*.13)*Math.max(.08,1-d*.5):0);
     fx.matrix.compose(fx.pos,fx.q,fx.scale);fx.rocks.setMatrixAt(i,fx.matrix);
    }
    fx.rocks.instanceMatrix.needsUpdate=true;
    if(t>=fx.duration)this.remove(fx);
   }catch(error){
    try{this.remove(fx);}catch{fx.root?.removeFromParent();this.active.splice(this.active.indexOf(fx),1);}
    if(!this.failedSaberError){this.failedSaberError=true;console.error('Saber impact failed; animation frame continues',error);}
   }
  }
 }
 remove(fx){
  const index=this.active.indexOf(fx);if(index>=0)this.active.splice(index,1);
  fx.root.removeFromParent();
  fx.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.geometry?.dispose();o.material?.dispose();});
 }
 dispose(){for(const e of [...this.active])this.remove(e);}
}
