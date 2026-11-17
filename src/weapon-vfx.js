import * as THREE from 'three';
import {createOddEffect,updateOddEffect} from './reletter/odd-weapon-effects.js';
import {chargedArea} from './shared/charge-area.js';
import {ElementalCharge} from './elemental-charge.js';
import {SaberImpact} from './saber-impact.js';
import {WeaponParticleEffects} from './weapon-particle-effects.js';
import {WeaponSignatureEffects} from './weapon-signature-effects.js';
import {NumberedWeaponEffects} from './numbered-weapon-effects.js';
import {isChannelStaff} from './shared/weapon-abilities.js';
import {projectileFlightMs} from './shared/combat-balance.js';
import sweep from '../vendor/00gamedevs/azure-sweep.js';
import smear from '../vendor/00gamedevs/weapon-smear.js';
import plasma from '../vendor/00gamedevs/plasma-bolt.js';
import ice from '../vendor/00gamedevs/ice-shard.js';
import arcane from '../vendor/00gamedevs/arcane-missile.js';
import pulse from '../vendor/00gamedevs/pulse-beam.js';
import charged from '../vendor/00gamedevs/charged-beam.js';
import arc from '../vendor/00gamedevs/arc-ray.js';
import burst from '../vendor/00gamedevs/energy-burst.js';
import shock from '../vendor/00gamedevs/shockwave.js';
import shatter from '../vendor/00gamedevs/ice-shatter.js';
import flame from '../vendor/00gamedevs/flame-surge.js';
import tidal from '../vendor/00gamedevs/tidal-surge.js';
import thorn from '../vendor/00gamedevs/thorn-crown.js';
import gale from '../vendor/00gamedevs/spiral-gale.js';
import astral from '../vendor/00gamedevs/astral-convergence.js';
import barrier from '../vendor/00gamedevs/magic-barrier.js';
import burning from '../vendor/00gamedevs/burning-ground.js';

const factories={'azure-sweep':sweep,'weapon-smear':smear,'plasma-bolt':plasma,'ice-shard':ice,'arcane-missile':arcane,'pulse-beam':pulse,'charged-beam':charged,'arc-ray':arc,'energy-burst':burst,shockwave:shock,'ice-shatter':shatter,'flame-surge':flame,'tidal-surge':tidal,'thorn-crown':thorn,'spiral-gale':gale,'astral-convergence':astral,'magic-barrier':barrier,'burning-ground':burning};
const projectiles=new Set(['plasma-bolt','ice-shard','arcane-missile']);
const beams=new Set(['pulse-beam','charged-beam','arc-ray']);
const continuous=new Set([...projectiles,...beams,'magic-barrier','burning-ground','flame-surge','tidal-surge','thorn-crown','spiral-gale']);
export const WEAPON_VFX=Object.freeze({
 water:['tidal-surge','tidal-surge'],ice:['ice-shard','ice-shatter'],fire:['flame-surge','flame-surge'],lightning:['arc-ray','energy-burst'],beam:['pulse-beam','charged-beam'],petal:['arcane-missile','arcane-missile'],wave:['tidal-surge','spiral-gale'],
 saber:['azure-sweep','azure-sweep'],whip:['azure-sweep','arc-ray'],swatter:['azure-sweep','spiral-gale'],pan:['shockwave','energy-burst'],planter:['thorn-crown','thorn-crown'],palm:['shockwave','astral-convergence'],
 'white-cat':['plasma-bolt','pulse-beam'],'black-cat':['pulse-beam','charged-beam'],'calico-cat':['plasma-bolt','energy-burst'],giraffe:['azure-sweep','arc-ray'],goldfish:['tidal-surge','tidal-surge'],clam:['shockwave','tidal-surge'],accordion:['shockwave','spiral-gale'],fan:['azure-sweep','spiral-gale'],telephone:['arc-ray','energy-burst'],jellybrella:['arcane-missile','magic-barrier'],'chiang-token':['arcane-missile','astral-convergence']
});
export function effectFor(item,ultimate=false){const pair=WEAPON_VFX[item.id]||WEAPON_VFX[item.family];if(!pair)throw Error('Unmapped weapon: '+item.id);return pair[ultimate?1:0];}
export class WeaponVFX{
 constructor(scene){this.scene=scene;this.active=[];this.snipers=[];this.staffOrbs=[];this.orbPools=new Map();this.channelStreams=new Map();this.pools=new Map();this.charger=null;this.aura=new ElementalCharge(scene);this.saberImpact=new SaberImpact(scene);this.created=0;this.replayed=0;this.particleSkills=new WeaponParticleEffects(scene);this.signatureEffects=new WeaponSignatureEffects(scene);this.numberedEffects=new NumberedWeaponEffects(scene,(root,item,fallback)=>this.channelMuzzle(root,item,fallback));}
 create(id){this.created++;const fx=factories[id]();fx.group.userData.vfxSource='00GameDevs';fx.group.userData.vfxId=id;return fx;}
 async warm(renderer,camera){
  const warmScene=new THREE.Scene(),fxs=[],warmOrbs=[];
  for(const id of Object.keys(factories)){const fx=this.create(id);fx.update(.18);warmScene.add(fx.group);fxs.push([id,fx]);}
  const sniper=createOddEffect(THREE,{charge:1,range:50,origin:[0,0,0],direction:[0,0,-1]},{pattern:'sniper',color:'#ffffff'});warmScene.add(sniper.root);
  for(const family of ['water','ice','fire','lightning','beam','petal','wave']){
   for(let i=0;i<2;i++){this.staffOrb({range:12},{family,range:12},new THREE.Vector3(i*3,2,0),new THREE.Vector3(0,0,1));
    const entry=this.staffOrbs.at(-1);warmScene.add(entry.group);warmOrbs.push(entry);}
  }
  await renderer.compileAsync(warmScene,camera);
  const previous=renderer.getRenderTarget(),target=new THREE.WebGLRenderTarget(16,16);
  try{renderer.setRenderTarget(target);renderer.render(warmScene,camera);}
  finally{renderer.setRenderTarget(previous);target.dispose();}
  sniper.root.removeFromParent();sniper.root.material.dispose();
  for(const entry of warmOrbs)this.releaseStaffOrb(entry);
  for(const [id,fx]of fxs){fx.group.removeFromParent();fx.reset();fx.group.visible=false;this.pools.set(id,[fx]);}
  let numbered=0;
  try{numbered=await this.numberedEffects.warm(renderer,camera);}catch(error){console.warn('Ultimate shader prewarm incomplete',error);}
  try{await this.particleSkills.warm(renderer,camera);}catch(error){console.warn('Particle shader prewarm incomplete',error);}
  try{await this.signatureEffects.warm(renderer,camera);}catch(error){console.warn('Signature shader prewarm incomplete',error);}
  return {source:'00GameDevs',effects:fxs.length,numbered};
 }
 acquire(id,options={}){
  if(this.active.length>=24)this.release(this.active[0]);
  const pool=this.pools.get(id)||[],fx=pool.pop()||this.create(id);this.pools.set(id,pool);
  fx.detachWeapon?.();fx.reset();fx.group.position.set(0,0,0);fx.group.quaternion.identity();fx.group.scale.setScalar(1);fx.group.visible=true;
  fx.setOptions({size:1,speed:1,color:options.color||'#a5eaff',...options});
  const entry={id,fx,age:0,stopAt:Infinity,stopped:false};this.scene.add(fx.group);this.active.push(entry);this.replayed++;return entry;
 }
 release(entry){const i=this.active.indexOf(entry);if(i<0)return;this.active.splice(i,1);const {id,fx}=entry;fx.detachWeapon?.();fx.group.removeFromParent();fx.group.visible=false;
  const pool=this.pools.get(id)||[];if(pool.length<2){pool.push(fx);this.pools.set(id,pool);}else fx.dispose();if(this.charger===entry)this.charger=null;
 }
 // The local geometry origin of a real held staff (or clam). Unlike
 // a fixed server event origin, this socket follows walking and hand poses.
 channelMuzzle(root,item,fallback=new THREE.Vector3()){
  if(!root)return fallback;
  const blade=root.userData?.blade;
  if(blade){
   const tip=item?.id==='clam'?new THREE.Vector3(0,.55,.28):new THREE.Vector3(0,1.05,0);
   blade.updateWorldMatrix(true,false);
   return blade.localToWorld(tip);
  }
  return root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,1.1,0));
 }
 stopChannel(root){
  this.numberedEffects.stop(root);
  for(const [key,entry] of [...this.channelStreams])if(entry.host===root){
   this.particleSkills.remove(entry);this.channelStreams.delete(key);
  }
 }
 // Each ordinary tap launches ONE volumetric elemental orb, visibly flying
 // on exactly the same server-owned ray and duration as the damage hitbox.
 staffOrb(data,item,origin,direction){
  if(this.staffOrbs.length>=28)this.releaseStaffOrb(this.staffOrbs[0]);
  const palette={
   water:['#65eaff','#b9ffff','#2a91e8'],
   ice:['#c9faff','#ffffff','#83caff'],
   fire:['#ff751b','#ffd044','#ff2d17'],
   lightning:['#e8d0ff','#ffffff','#8471ff'],
   beam:['#fff3a4','#ffffff','#f1b73b'],
   petal:['#ff98d6','#fff1ff','#d55fbd'],
   wave:['#59dfff','#d7ffff','#2da7ab']
  };
  const shades=palette[item.family]||palette.water;
  const group=this.orbPools.get(item.family)?.pop()||new THREE.Group();
  group.userData.orbFamily=item.family;
  group.name='Flying elemental '+item.family+' spell orb';
  if(!group.userData.orbBuilt){
  const core=new THREE.Mesh(new THREE.SphereGeometry(.38,20,16),
   new THREE.MeshPhysicalMaterial({color:shades[0],emissive:shades[0],emissiveIntensity:.65,
    metalness:.12,roughness:.24,clearcoat:1,clearcoatRoughness:.17}));
  group.add(core);
  const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(.49,1),
   new THREE.MeshBasicMaterial({color:shades[1],transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide}));
  group.add(shell);
  for(let i=0;i<9;i++){
   const angle=i*Math.PI*2/9;
   const mote=new THREE.Mesh(new THREE.SphereGeometry(.07+(i%3)*.02,7,6),
    new THREE.MeshBasicMaterial({color:shades[i%3]}));
   mote.position.set(Math.cos(angle)*.46,Math.sin(angle*1.3)*.35,Math.sin(angle)*.42);
   group.add(mote);
  }
  group.userData.orbBuilt=true;
  }
  const duration=projectileFlightMs(item,false)/1000,range=Math.max(1,Number(data.range)||12);
  group.position.copy(origin);group.scale.setScalar(Math.max(.7,Math.min(1.6,Number(data.qualityScale)||1)));
  this.scene.add(group);
  this.staffOrbs.push({group,origin:origin.clone(),direction:direction.clone(),duration,range,age:0});
 }
 releaseStaffOrb(entry){
  const at=this.staffOrbs.indexOf(entry);if(at>=0)this.staffOrbs.splice(at,1);
  entry.group.removeFromParent();
  const family=entry.group.userData.orbFamily,pool=this.orbPools.get(family)||[];
  if(pool.length<3){pool.push(entry.group);this.orbPools.set(family,pool);}else{
   entry.group.traverse(child=>{child.geometry?.dispose();if(child.material)for(const m of Array.isArray(child.material)?child.material:[child.material])m.dispose();});
  }
 }
 play(data,item,root){
  const id=effectFor(item,data.ultimate),direction=new THREE.Vector3(...(data.direction||[0,0,1])).normalize(),origin=new THREE.Vector3(...data.origin),range=Math.max(1,data.range||4),end=data.aimPoint?new THREE.Vector3(...data.aimPoint):data.impactPoint?new THREE.Vector3(...data.impactPoint):origin.clone().addScaledVector(direction,range);
  // Charged ground spells are placed on the *server validated impact area*.
  // Previously every non-projectile preset was spawned one metre below
  // the caster, leaving distant spells invisible or buried in terrain.
  const impactArea=data.area||(data.ultimate?chargedArea(item,data.origin,data.direction,data):null);
  const groundEffect=!!data.ultimate&&impactArea?.mode==='area';
  const remoteCharged=!!data.ultimate&&(groundEffect||impactArea?.mode==='corridor');
  if(data.ultimate&&Array.isArray(impactArea?.visualCenter))end.copy(new THREE.Vector3(...impactArea.visualCenter));
  // Every numbered attack uses the exact original 00GameDevs source.
  // Do not stack a custom SaberImpact or another imitation on top.
  if(this.numberedEffects.play(data,item,root))return;
  // Never re-aim or translate a server-approved trajectory to a cosmetic muzzle;
  // rendered bullets must occupy the same world-space volume as damage rays.
  if(isChannelStaff(item)&&item.id!=='clam'&&!data.ultimate&&!data.channel){
   this.staffOrb(data,item,origin,direction);
   return;
  }
  if(this.signatureEffects.play({...data,origin:origin.toArray(),direction:direction.toArray()},item,root))return;
  if(isChannelStaff(item)&&(data.channel||data.ultimate&&['water','fire','wave'].includes(item.family))){
   // Reuse ONE continuously moving emitter per owner. The weapon tip, not
   // the first network attack position, is the live emission source.
   const source=data.channel?this.channelMuzzle(root,item,origin.clone()):origin;
   const forwardEnd=source.clone().addScaledVector(direction,range);
   const key=root?root.uuid+':'+item.id:null,existing=key?this.channelStreams.get(key):null;
   if(data.channel&&existing&&this.particleSkills.active.includes(existing)){
    // Damage pulse renews the hitbox only, never restart the visual clock.
    existing.direction.copy(direction);
    existing.range=range;
    existing.heading=root?.rotation.y||0;
    existing.material.uniforms.uReach.value=range;
    existing.lastPulseAt=performance.now();
   }else{
    const entry=this.particleSkills.play(data,item,source,forwardEnd);
    if(data.channel&&root&&entry){
     entry.host=root;entry.weapon=item;entry.direction=direction.clone();entry.heading=root.rotation.y;
     entry.range=range;entry.lastPulseAt=performance.now();entry.channelKey=key;
     this.channelStreams.set(key,entry);
    }
   }
   return;
  }
  this.particleSkills.play(data,item,origin,end);
  // Dedicated point-cloud ultimates: do not summon a shared physical object.
  if(data.ultimate&&(item.family==='petal'||item.id==='giraffe'))return;
  // Orient actual 00GameDevs flame/tidal presets along the weapon muzzle.
  // The companion GPU streams travel from the player toward the target.
  const spray=item.family==='fire'||item.family==='water'||item.family==='wave'||item.id==='goldfish'||item.id==='clam'&&data.ultimate;
  if(spray&&!['white-cat','black-cat','calico-cat'].includes(item.id)){
   const fireJet=item.family==='fire',effect=fireJet?'flame-surge':'tidal-surge';
   for(let i=0;i<(item.id==='clam'&&data.ultimate?10:data.ultimate?2:1);i++){
    const jet=this.acquire(effect,{color:fireJet?'#ff6d2d':'#70e5ff',size:(data.ultimate?3.8:2.6)*(data.qualityScale||1),speed:2.6,density:1,quantity:10});
    jet.fx.group.position.copy(origin).addScaledVector(direction,.4+i*(item.id==='clam'?1.1:2.4));
    if(item.id==='clam'&&data.ultimate){const side=new THREE.Vector3(direction.z,0,-direction.x).normalize();jet.fx.group.position.addScaledVector(side,((i%5)-2)*.92);}
    jet.fx.group.quaternion.setFromUnitVectors(fireJet?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1),direction);
    jet.fx.update(jet.fx.lifecycle.start||0);
    jet.stopAt=item.id==='clam'?2.25:data.channel?1.35:data.ultimate?1.4:.75;
   }
   return;
  }
  // Calico uses only its three-dimensional rainbow shot cloud. Do not layer
  // the former plasma bolt or electrical burst on top of the shotgun pellets.
  if(item.id==='calico-cat')return;
  if(data.ultimate&&item.family==='saber')this.saberImpact.play(data,origin,direction);
  if(item.id==='black-cat'){
   if(this.snipers.length>=4){
    const old=this.snipers.shift();
    old.root.removeFromParent();
    old.root.material.dispose();
   }
   // Project exactly from the server-owned muzzle, not the old -1.8m
   // camera-relative offset which caused premature / detached bullet traces.
   const f=createOddEffect(THREE,{...data,origin:origin.toArray(),direction:direction.toArray(),range},{...item,pattern:'sniper'});
   this.scene.add(f.root);this.snipers.push(f);return;
  }
  const entry=this.acquire(id,{color:item.color,size:(data.ultimate?Math.min(3.6,Math.max(1.2,(impactArea?.radius||5)/3.5)):.6)*(data.qualityScale||1),speed:data.ultimate?1:1.8}),fx=entry.fx;
  fx.group.position.copy(origin);fx.group.rotation.y=Math.atan2(direction.x,direction.z)-Math.PI/2;
  if(beams.has(id)){fx.group.position.set(0,0,0);fx.group.quaternion.identity();fx.setEndpoints(origin,end);fx.update(fx.lifecycle.start||0);entry.stopAt=data.channel?1.1:data.ultimate?.65:.12;}
  else if(projectiles.has(id)){fx.setDirection(direction,0);fx.update(fx.lifecycle.start||0);entry.start=origin;entry.end=end;entry.travel=Math.min(.45,Math.max(.12,origin.distanceTo(end)/45));entry.stopAt=entry.travel;entry.hit=!!data.impactPoint;}
  else {
   if(remoteCharged){fx.group.position.copy(end);fx.group.position.y=Math.max(.7,end.y);}
   else if(data.impactPoint){fx.group.position.copy(end);fx.group.position.y=Math.max(.16,end.y);}
   else {fx.group.position.y=Math.max(.7,origin.y-.15);}
   if(id==='azure-sweep'&&!groundEffect)fx.group.position.y=Math.max(.18,origin.y-.15);
   if(continuous.has(id))fx.update(fx.lifecycle.start||0);
   if(groundEffect){
    // Prefab local geometry sometimes extends below its origin. Raise the
    // visible effect instead of allowing a frozen half-buried animation.
    fx.group.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(fx.group);
    if(Number.isFinite(bounds.min.y)&&Number.isFinite(bounds.max.y))
     fx.group.position.y+=Math.max(0,Math.min(14,end.y+.3-bounds.min.y));
   }
   entry.stopAt=data.channel?1.3:data.ultimate?1.35:.35;
  }
  if(root?.userData.blade&&!beams.has(id)&&!projectiles.has(id)){
   let trail=this.active.find(e=>e.id==='weapon-smear'&&e.weapon===root.userData.blade&&!e.stopped);
   if(!trail){trail=this.acquire('weapon-smear',{color:item.color,size:.8});trail.fx.attachWeapon(root.userData.blade,{base:[0,0,0],tip:[0,1.1,0]});trail.weapon=root.userData.blade;}
   trail.stopAt=trail.age+(root.userData.attack?.duration||.5);
  }
  // Fusion echoes are complete server-authored source weapon events, not placeholder flashes.
  if(data.impactPoint&&!projectiles.has(id)){const impact=this.acquire(item.family==='ice'?'ice-shatter':'energy-burst',{size:.3,color:item.color,speed:2});impact.fx.group.position.copy(end);}
 }
 charging(root,progress,item){
  // No arcane-missile emitter here: that effect used to float to the right
  // and remain suspended as a stuck particle cloud.
  this.aura.charging(root,progress,item);
 }

 update(dt){
  for(const [key,entry] of [...this.channelStreams]){
   if(!this.particleSkills.active.includes(entry)||!entry.host?.parent){
    this.channelStreams.delete(key);continue;
   }
   const now=performance.now();
   if(now-entry.lastPulseAt>Math.max(3100,entry.weapon.cooldown*2+650)){
    this.particleSkills.remove(entry);this.channelStreams.delete(key);continue;
   }
   entry.root.position.copy(this.channelMuzzle(entry.host,entry.weapon,entry.root.position));
   const delta=entry.host.rotation.y-entry.heading,axis=new THREE.Vector3(0,1,0);
   const aim=entry.direction.clone().applyAxisAngle(axis,delta).normalize();
   entry.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),aim);
   // No stale detached beam: the currently drawn particles remain weapon-bound.
  }
  this.saberImpact.update(dt);this.particleSkills.update(dt);this.signatureEffects.update(dt);this.numberedEffects.update(dt);
  for(const orb of [...this.staffOrbs]){
   orb.age+=dt;
   const t=Math.min(1,orb.age/orb.duration);
   orb.group.position.copy(orb.origin).addScaledVector(orb.direction,orb.range*t);
   orb.group.rotation.z=orb.age*4.8;
   orb.group.rotation.y=orb.age*7;
   if(orb.age>=orb.duration)this.releaseStaffOrb(orb);
  }for(let i=this.snipers.length-1;i>=0;i--){const f=this.snipers[i];if(!updateOddEffect(f,dt)){f.root.removeFromParent();f.root.material.dispose();this.snipers.splice(i,1);}}for(const e of [...this.active]){e.age+=dt;if(e.weapon)e.weapon.updateWorldMatrix(true,false);
   if(e.start&&!e.stopped)e.fx.group.position.lerpVectors(e.start,e.end,Math.min(1,e.age/e.travel));
   if(!e.stopped&&e.age>=e.stopAt){if(e.hit)e.fx.hit(e.end);else if(continuous.has(e.id)||e.id==='weapon-smear')e.fx.stop();e.stopped=true;}
   e.fx.update(dt);if(e.fx.finished||e.age>12)this.release(e);
  }}
 dispose(){this.numberedEffects.dispose();this.channelStreams.clear();for(const orb of [...this.staffOrbs])this.releaseStaffOrb(orb);this.saberImpact.dispose();this.aura.dispose();this.particleSkills.dispose();this.signatureEffects.dispose();for(const f of this.snipers){f.root.removeFromParent();f.root.material.dispose();}this.snipers=[];for(const e of [...this.active]){e.fx.dispose();e.fx.group.removeFromParent();}this.active=[];for(const pool of this.pools.values())for(const fx of pool)fx.dispose();this.pools.clear();}
}
