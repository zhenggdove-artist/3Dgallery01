import * as THREE from 'three';

// Every visible color treatment is attached to the TARGET'S model materials,
// never a full-scene screen tint. Times and immunity are server-authoritative.
export const ELEMENTAL_FILTERS=Object.freeze({
 freeze:'#b9edff',
 root:'#69bf49',
 soaked:'#328dfb',
 dazzle:'#fff152'
});
const FILTER_ALPHA=.30;

function luminousFlames(){
 const count=44,geometry=new THREE.BufferGeometry(),
  positions=new Float32Array(count*3),phase=new Float32Array(count);
 for(let i=0;i<count;i++){
  const a=i*2.39996323,r=.27+.38*((i*7%19)/19);
  positions[i*3]=Math.cos(a)*r;
  positions[i*3+1]=.38+((i*11%29)/29)*1.18;
  positions[i*3+2]=Math.sin(a)*r;
  phase[i]=((i*17%47)/47);
 }
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('aPhase',new THREE.BufferAttribute(phase,1));
 const material=new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0}},
  transparent:true,depthTest:true,depthWrite:false,
  blending:THREE.AdditiveBlending,toneMapped:false,
  vertexShader:`
   attribute float aPhase;
   uniform float uTime;
   varying float vProgress;
   varying float vSeed;
   void main(){
    float progress=fract(aPhase+uTime*0.74);
    vProgress=progress;vSeed=aPhase;
    vec3 p=position;
    p.y+=progress*1.03;
    p.x+=sin(uTime*5.1+aPhase*23.0+progress*7.0)*progress*.16;
    p.z+=cos(uTime*4.0+aPhase*17.0+progress*8.0)*progress*.10;
    vec4 eye=modelViewMatrix*vec4(p,1.0);
    gl_Position=projectionMatrix*eye;
    gl_PointSize=clamp(22.0/(-eye.z)*5.0,3.0,22.0)*(1.0-progress*.42);
   }`,
  fragmentShader:`
   varying float vProgress;
   varying float vSeed;
   void main(){
    vec2 uv=gl_PointCoord;
    float x=abs(uv.x-.5)*2.0;
    // Flame tail becomes narrower towards its upper end.
    float y=uv.y;
    float taper=mix(.64,.12,y);
    float shape=1.0-smoothstep(taper*.35,taper,x);
    float vertical=smoothstep(0.0,.14,y)*(1.0-smoothstep(.78,1.0,y));
    float alpha=shape*vertical*(1.0-vProgress)*.73;
    if(alpha<.012)discard;
    vec3 warm=mix(vec3(1.0,.29,.04),vec3(1.0,.83,.22),clamp(1.0-y*.9,0.0,1.0));
    gl_FragColor=vec4(warm,alpha);
   }`
 });
 const points=new THREE.Points(geometry,material);
 points.name='Target burn: rising fading small flames (asset #01 unavailable)';
 points.frustumCulled=false;
 return points;
}

function tintMaterial(source,uniforms){
 if(source.isShaderMaterial||source.isRawShaderMaterial)return null;
 const material=source.clone();
 const previousCompile=source.onBeforeCompile;
 const previousKey=source.customProgramCacheKey?.bind(source);
 material.onBeforeCompile=function(shader,renderer){
  previousCompile?.call(this,shader,renderer);
  const token='#include <opaque_fragment>';
  if(!shader.fragmentShader.includes(token))return;
  shader.uniforms.elementalFilterTint=uniforms.color;
  shader.uniforms.elementalFilterAlpha=uniforms.alpha;
  shader.fragmentShader='uniform vec3 elementalFilterTint;\nuniform float elementalFilterAlpha;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace(token,
   token+'\ngl_FragColor.rgb=mix(gl_FragColor.rgb,elementalFilterTint,elementalFilterAlpha);');
 };
 material.customProgramCacheKey=()=>String(previousKey?.()||'')+':temple-elemental-filter-v1';
 material.needsUpdate=true;
 return material;
}

export class ElementalStatusVisuals{
 constructor(){this.entries=new Map();}
 detachTint(entry){
  for(const {mesh,original,owned} of entry.materials){
   // Equipment changes may have already replaced a mesh's old material.
   if(owned.includes(mesh.material)||Array.isArray(mesh.material)&&
    mesh.material.some(material=>owned.includes(material)))mesh.material=original;
   for(const material of owned)material.dispose();
  }
  entry.materials.length=0;
 }
 applyTint(root,entry){
  this.detachTint(entry);
  const body=root.userData?.model||root.userData?.pivot||root;
  const uniforms=entry.uniforms;
  body.traverse(obj=>{
   if(!obj.isMesh||!obj.material)return;
   const originals=Array.isArray(obj.material)?obj.material:[obj.material],
    patched=originals.map(mat=>tintMaterial(mat,uniforms)||mat),
    owned=patched.filter((mat,i)=>mat!==originals[i]);
   if(!owned.length)return;
   entry.materials.push({mesh:obj,original:obj.material,owned});
   obj.material=Array.isArray(obj.material)?patched:patched[0];
  });
 }
 sync(root,effects={},now=Date.now()){
  if(!root)return;
  const active=Object.keys(ELEMENTAL_FILTERS).find(key=>effects?.[key]?.until>now);
  const burn=(effects?.burn?.until||0)>now;
  let entry=this.entries.get(root);
  if(!active&&!burn){if(entry)this.clear(root);return;}
  if(!entry){
   entry={materials:[],flames:null,uniforms:{
     color:{value:new THREE.Color('#ffffff')},
     alpha:{value:0}
    },until:0,active:null};
   this.entries.set(root,entry);
  }
  entry.until=Math.max(burn?effects.burn.until:0,active?effects[active].until:0);
  if(active){
   entry.uniforms.color.value.set(ELEMENTAL_FILTERS[active]);
   entry.uniforms.alpha.value=FILTER_ALPHA;
   if(!entry.materials.length)this.applyTint(root,entry);
  }else{entry.uniforms.alpha.value=0;}
  entry.active=active||null;
  if(burn&&!entry.flames){entry.flames=luminousFlames();root.add(entry.flames);}
  if(!burn&&entry.flames)this.stopFlames(entry);
  entry.burnUntil=burn?effects.burn.until:0;
 }
 stopFlames(entry){
  if(!entry.flames)return;
  entry.flames.removeFromParent();
  entry.flames.geometry.dispose();entry.flames.material.dispose();
  entry.flames=null;
 }
 update(dt,now=Date.now()){
  for(const [root,entry] of this.entries){
   if(!root.parent||now>=entry.until){this.clear(root);continue;}
   if(entry.flames){
    if(now>=entry.burnUntil)this.stopFlames(entry);
    else entry.flames.material.uniforms.uTime.value+=dt;
   }
   if(entry.active&&now>=entry.until)entry.uniforms.alpha.value=0;
  }
 }
 clear(root){
  const entry=this.entries.get(root);if(!entry)return;
  this.detachTint(entry);this.stopFlames(entry);
  this.entries.delete(root);
 }
 dispose(){for(const root of [...this.entries.keys()])this.clear(root);}
}
