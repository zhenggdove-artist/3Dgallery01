import * as THREE from 'three';
import createFireball from '../vendor/00gamedevs/source/fireball.js';

// Every visible color treatment is attached to the TARGET'S model materials,
// never a full-scene screen tint. Times and immunity are server-authoritative.
export const ELEMENTAL_FILTERS=Object.freeze({
 freeze:'#b9edff',
 root:'#69bf49',
 soaked:'#328dfb',
 dazzle:'#fff152'
});
const FILTER_ALPHA=.30;

// Source: exact, unmodified 00GameDevs #01 "Blazing Fireball" JavaScript.
const tailUp=new THREE.Quaternion().setFromUnitVectors(
 new THREE.Vector3(1,0,0),new THREE.Vector3(0,-1,0));
const MAX_FIREBALLS_PER_TARGET=8;
const BURN_SPAWN_INTERVAL=.115;

function luminousFlames(root){
 const group=new THREE.Group();
 group.name='00GameDevs original VFX #01 Fireball — target burn';
 group.userData.vfxSource='00GameDevs';
 group.userData.vfxNumber=1;
 group.userData.vfxId='fireball';
 root.updateMatrixWorld(true);
 const model=root.userData?.model||root;
 const bounds=new THREE.Box3().setFromObject(model,true),size=bounds.getSize(new THREE.Vector3());
 const valid=Number.isFinite(size.y)&&size.y>.01;
 const height=valid?THREE.MathUtils.clamp(size.y,1,4):2;
 const center=valid?root.worldToLocal(bounds.getCenter(new THREE.Vector3())):new THREE.Vector3();
 const foot=valid?root.worldToLocal(new THREE.Vector3(
  (bounds.min.x+bounds.max.x)*.5,bounds.min.y,(bounds.min.z+bounds.max.z)*.5
 )):new THREE.Vector3();
 root.add(group);
 // Distribute flame origins across the TARGET'S BODY, never at ground level.
 // All emitters use the original factory; no custom particle recreation.
 return {group,pulses:[],elapsed:0,nextSpawn:0,serial:0,height,center,
  footY:foot.y,radiusX:THREE.MathUtils.clamp(size.x*.3,.16,.52),
  radiusZ:THREE.MathUtils.clamp(size.z*.3,.16,.46)};
}
function addFireball(root,flames){
 const n=flames.serial++;
 const fx=createFireball({
  size:.17,speed:1.1,density:.125,detail:.6,color:'#ff823e'
 });
 fx.group.name='Official 00GameDevs #01 small flame '+n;
 fx.group.userData.vfxSource='00GameDevs';
 fx.group.userData.vfxNumber=1;
 fx.group.userData.vfxId='fireball';
 // The fireball's local +X is its nose: rotate it to -Y so its thin
 // trailing flame (local -X) always points upwards, exactly as requested.
 fx.group.quaternion.copy(tailUp);
 // The vendor scene contains long projectile geometry. Scale the ENTIRE
 // original group, not just its internal "size" control, so no tall column
 // can emerge from a victim's feet. Each small fire uses its own body point.
 const size=.035*(flames.height/2);
 fx.group.scale.setScalar(THREE.MathUtils.clamp(size,.019,.055));
 const a=n*2.3999632297;
 const level=.26+.57*((n*7%17)/16);
 const y=flames.footY+flames.height*level;
 const x=flames.center.x+Math.cos(a)*flames.radiusX;
 const z=flames.center.z+Math.sin(a)*flames.radiusZ;
 fx.group.position.set(x,y,z);
 const startY=y;
 // Fireball has a 0.35s charge-up, but contact burns should be visible
 // immediately. Advance its ORIGINAL animation to the first active frame.
 fx.update(.36);
 flames.group.add(fx.group);
 flames.pulses.push({fx,age:0,stopped:false,startY});
}
function advanceFlames(root,flames,dt){
 flames.elapsed+=dt;flames.nextSpawn-=dt;
 for(let i=flames.pulses.length-1;i>=0;i--){
  const pulse=flames.pulses[i];pulse.age+=dt;
  if(pulse.age>=.20&&!pulse.stopped){pulse.fx.stop();pulse.stopped=true;}
  pulse.fx.group.position.y=pulse.startY+pulse.age*.14;
  pulse.fx.update(dt);
  if(pulse.fx.finished||pulse.age>.90){
   pulse.fx.dispose();flames.pulses.splice(i,1);
  }
 }
 if(flames.nextSpawn<=0&&flames.pulses.length<MAX_FIREBALLS_PER_TARGET){
  addFireball(root,flames);
  flames.nextSpawn=BURN_SPAWN_INTERVAL;
 }
}
function disposeFlames(flames){
 if(!flames)return;
 for(const pulse of flames.pulses)pulse.fx.dispose();
 flames.pulses.length=0;
 flames.group.removeFromParent();
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
  entry.active=active||null;entry.filterUntil=active?effects[active].until:0;
  if(burn&&!entry.flames){entry.flames=luminousFlames(root);addFireball(root,entry.flames);}
  if(!burn&&entry.flames)this.stopFlames(entry);
  entry.burnUntil=burn?effects.burn.until:0;
 }
 stopFlames(entry){
  if(!entry.flames)return;
  disposeFlames(entry.flames);
  entry.flames=null;
 }
 update(dt,now=Date.now()){
  for(const [root,entry] of this.entries){
   if(!root.parent||now>=entry.until){this.clear(root);continue;}
   if(entry.flames){
    if(now>=entry.burnUntil)this.stopFlames(entry);
    else advanceFlames(root,entry.flames,dt);
   }
   if(entry.active&&now>=entry.filterUntil)entry.uniforms.alpha.value=0;
  }
 }
 clear(root){
  const entry=this.entries.get(root);if(!entry)return;
  this.detachTint(entry);this.stopFlames(entry);
  this.entries.delete(root);
 }
 dispose(){for(const root of [...this.entries.keys()])this.clear(root);}
}
