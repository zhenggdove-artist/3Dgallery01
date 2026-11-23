import * as THREE from 'three';
import {createOddEffect,updateOddEffect} from './reletter/odd-weapon-effects.js';
import {chargedArea} from './shared/charge-area.js';
import {ElementalCharge} from './elemental-charge.js';
import {SaberImpact} from './saber-impact.js';
import {WeaponParticleEffects} from './weapon-particle-effects.js';
import {WeaponSignatureEffects} from './weapon-signature-effects.js';
import {NumberedWeaponEffects} from './numbered-weapon-effects.js';
import {VerdantRestorationChannel} from './verdant-restoration-channel.js';
import {PlantUltimateEffects} from './plant-ultimate-effects.js';
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
import venomStream from '../vendor/00gamedevs/venom-stream.js';
import thorn from '../vendor/00gamedevs/thorn-crown.js';
import gale from '../vendor/00gamedevs/spiral-gale.js';
import astral from '../vendor/00gamedevs/astral-convergence.js';
import barrier from '../vendor/00gamedevs/magic-barrier.js';
import burning from '../vendor/00gamedevs/burning-ground.js';

const factories={'azure-sweep':sweep,'weapon-smear':smear,'plasma-bolt':plasma,'ice-shard':ice,'arcane-missile':arcane,'pulse-beam':pulse,'charged-beam':charged,'arc-ray':arc,'energy-burst':burst,shockwave:shock,'ice-shatter':shatter,'flame-surge':flame,'tidal-surge':tidal,'venom-stream':venomStream,'thorn-crown':thorn,'spiral-gale':gale,'astral-convergence':astral,'magic-barrier':barrier,'burning-ground':burning};
const projectiles=new Set(['plasma-bolt','ice-shard','arcane-missile']);
const beams=new Set(['pulse-beam','charged-beam','arc-ray']);
const continuous=new Set([...projectiles,...beams,'magic-barrier','burning-ground','flame-surge','tidal-surge','thorn-crown','spiral-gale']);
export const WEAPON_VFX=Object.freeze({
 water:['venom-stream','venom-stream'],ice:['ice-shard','ice-shatter'],fire:['flame-surge','flame-surge'],lightning:['arc-ray','energy-burst'],beam:['pulse-beam','charged-beam'],petal:['arcane-missile','arcane-missile'],wave:['tidal-surge','spiral-gale'],
 saber:['azure-sweep','azure-sweep'],whip:['azure-sweep','arc-ray'],swatter:['azure-sweep','spiral-gale'],pan:['shockwave','energy-burst'],planter:['thorn-crown','golden-chain-rain'],palm:['shockwave','lightning-fire-tornado'],
 'white-cat':['plasma-bolt','pulse-beam'],'black-cat':['pulse-beam','charged-beam'],'calico-cat':['plasma-bolt','energy-burst'],giraffe:['azure-sweep','arc-ray'],goldfish:['tidal-surge','tidal-surge'],clam:['shockwave','tidal-surge'],accordion:['shockwave','spiral-gale'],fan:['azure-sweep','spiral-gale'],telephone:['arc-ray','energy-burst'],jellybrella:['arcane-missile','magic-barrier'],'chiang-token':['arcane-missile','astral-convergence']
});
export function effectFor(item,ultimate=false){const pair=WEAPON_VFX[item.id]||WEAPON_VFX[item.family];if(!pair)throw Error('Unmapped weapon: '+item.id);return pair[ultimate?1:0];}
export class WeaponVFX{
 constructor(scene){this.scene=scene;this.active=[];this.snipers=[];this.staffOrbs=[];this.orbPools=new Map();this.channelStreams=new Map();this.waterStreams=new Map();this.pools=new Map();this.charger=null;this.aura=new ElementalCharge(scene);this.saberImpact=new SaberImpact(scene);this.created=0;this.replayed=0;this.particleSkills=new WeaponParticleEffects(scene);this.signatureEffects=new WeaponSignatureEffects(scene);this.numberedEffects=new NumberedWeaponEffects(scene,(root,item,fallback)=>this.channelMuzzle(root,item,fallback));this.restoration=new VerdantRestorationChannel(scene);this.plantUltimates=new PlantUltimateEffects(scene);}
 create(id){this.created++;const fx=factories[id]();fx.group.userData.vfxSource='00GameDevs';fx.group.userData.vfxId=id;return fx;}
 async warm(renderer,camera){
  const warmScene=new THREE.Scene(),fxs=[];
  for(const id of Object.keys(factories)){const fx=this.create(id);fx.update(.18);warmScene.add(fx.group);fxs.push([id,fx]);}
  const sniper=createOddEffect(THREE,{charge:1,range:50,origin:[0,0,0],direction:[0,0,-1]},{pattern:'sniper',color:'#ffffff'});warmScene.add(sniper.root);await renderer.compileAsync(warmScene,camera);if(typeof renderer.getRenderTarget==='function'&&typeof renderer.setRenderTarget==='function'&&typeof renderer.render==='function'){const gpuWarmTarget=new THREE.WebGLRenderTarget(32,32),priorTarget=renderer.getRenderTarget();try{renderer.setRenderTarget(gpuWarmTarget);renderer.render(warmScene,camera);}finally{renderer.setRenderTarget(priorTarget);gpuWarmTarget.dispose();}}sniper.root.removeFromParent();sniper.root.material.dispose();
  for(const [id,fx]of fxs){fx.group.removeFromParent();fx.reset();fx.group.visible=false;this.pools.set(id,[fx]);}
  // Native skills frequently produce two or more simultaneous pooled bursts.
  // Upload the second copy's vertex buffers before leaving the loading screen.
  const frequentlyLayered=['tidal-surge','flame-surge','energy-burst','shockwave',
   'ice-shatter','azure-sweep','arc-ray','charged-beam','thorn-crown',
   'spiral-gale','plasma-bolt'];
  const layeredScene=new THREE.Scene(),layered=[];
  try{
   for(const id of frequentlyLayered){
    const fx=this.create(id);fx.update(.18);layeredScene.add(fx.group);layered.push([id,fx]);
   }
   await renderer.compileAsync(layeredScene,camera);
   const target=new THREE.WebGLRenderTarget(32,32),prior=renderer.getRenderTarget();
   try{renderer.setRenderTarget(target);renderer.render(layeredScene,camera);}
   finally{renderer.setRenderTarget(prior);target.dispose();}
  }finally{
   for(const [id,fx] of layered){
    fx.group.removeFromParent();fx.reset();fx.group.visible=false;
    this.pools.get(id).push(fx);
   }
  }
  let numbered=0;
  try{numbered=await this.numberedEffects.warm(renderer,camera);}catch(error){console.warn('Ultimate shader prewarm incomplete',error);}
  try{await this.particleSkills.warm(renderer,camera);}catch(error){console.warn('Particle shader prewarm incomplete',error);}
  try{await this.signatureEffects.warm(renderer,camera);}catch(error){console.warn('Signature shader prewarm incomplete',error);}
  try{await this.plantUltimates.warm(renderer,camera);}catch(error){console.warn('Green botanical ultimate GPU prewarm incomplete',error);}
  try{await this.warmStaffOrbs(renderer,camera);}catch(error){console.warn('Orb GPU warmup incomplete',error);}
  try{await this.restoration.warm(renderer,camera);}catch(error){console.warn('Original Verdant Restoration warmup incomplete',error);}
  return {source:'00GameDevs',effects:fxs.length,numbered};
 }
 acquire(id,options={}){
  if(this.active.length>=24)this.release(this.active[0]);
  const pool=this.pools.get(id)||[],fx=pool.pop()||this.create(id);this.pools.set(id,pool);
  fx.detachWeapon?.();fx.reset();fx.group.position.set(0,0,0);fx.group.quaternion.identity();fx.group.scale.setScalar(1);fx.group.visible=true;
  fx.setOptions({size:1,speed:1,color:options.color||'#a5eaff',...options});
  const entry={id,fx,age:0,stopAt:Infinity,stopped:false};this.scene.add(fx.group);this.active.push(entry);this.replayed++;return entry;
 }
 release(entry){const i=this.active.indexOf(entry);if(i<0)return;this.active.splice(i,1);
  if(entry.waterKey)this.waterStreams.delete(entry.waterKey);
  if(entry.waterParticles){
   entry.waterParticles.removeFromParent();
   entry.waterParticles.geometry.dispose();
   entry.waterParticles.material.dispose();
   entry.waterParticles=null;
  }
  const {id,fx}=entry;fx.detachWeapon?.();fx.group.removeFromParent();fx.group.visible=false;
  const pool=this.pools.get(id)||[];if(pool.length<3){pool.push(fx);this.pools.set(id,pool);}else fx.dispose();if(this.charger===entry)this.charger=null;
 }
 // The local geometry origin of a real held staff (or clam). Unlike
 // a fixed server event origin, this socket follows walking and hand poses.
 channelMuzzle(root,item,fallback=new THREE.Vector3()){
  if(!root)return fallback;
  const blade=root.userData?.blade;
  if(blade){
   const tip=item?.id==='clam'?new THREE.Vector3(0,.68,.28):new THREE.Vector3(0,Number(blade.userData.muzzleHeight)||1.18,0);
   blade.updateWorldMatrix(true,false);
   return blade.localToWorld(tip);
  }
  return root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,1.1,0));
 }
 playWaterStream(data,item,root,origin,direction,range){
  // Native 00GameDevs venom-stream beam. One recycled source per caster,
  // blue re-tint only; collisions remain exclusively server-owned.
  const key=root?.uuid||data.owner;
  if(!key)return;
  let entry=this.waterStreams.get(key);
  if(entry&&!this.active.includes(entry)){this.waterStreams.delete(key);entry=null;}
  if(!entry){
   entry=this.acquire('venom-stream',{
    color:'#2d9fff',quantity:8,density:.55,
    size:Math.max(.35,Math.min(2,(Number(data.radius)||1.05)/1.5))
   });
   entry.waterChannel=true;
   // The hand-authored venom preset previously produced no visible pixels
   // on some GPUs despite returning a valid native effect. Retain the native
   // shader, but provide a guaranteed bright blue liquid slug/splash volume.
   const count=128,geometry=new THREE.BufferGeometry();
   const positions=new Float32Array(count*3),colors=new Float32Array(count*3);
   const shades=['#239cff','#68d9ff','#b5f7ff','#0872d9'];
   for(let i=0;i<count;i++){
    const color=new THREE.Color(shades[(i*3+Math.floor(i/8))%shades.length]);
    colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
   }
   geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
   entry.waterParticles=new THREE.Points(geometry,new THREE.PointsMaterial({
    size:.19,vertexColors:true,transparent:true,opacity:.88,depthWrite:false,
    depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false,
    sizeAttenuation:true
   }));
   entry.waterParticles.frustumCulled=false;
   entry.waterParticles.name='Visible blue Venom Stream liquid slugs and impact droplets';
   this.scene.add(entry.waterParticles);
   this.waterStreams.set(key,entry);
  }
  entry.waterKey=key;entry.host=root;entry.waterWeapon=item;
  entry.waterOwner=data.owner||null;
  entry.waterWidthFactor=/^tide-[1-5]$/.test(item.id)?3:1;
  if(entry.waterParticles)entry.waterParticles.material.size=.19*entry.waterWidthFactor;
  entry.waterOrigin??=origin.clone();
  entry.waterDirection??=direction.clone();
  entry.waterOrigin.copy(origin); // overwritten by live weapon tip when present
  entry.waterDirection.copy(direction);
  entry.waterRange=range;
  entry.lastWaterPulseAt=performance.now();
  this.alignWaterStream(entry);
 }
 alignWaterStream(entry,world=null){
  if(!this.active.includes(entry))return;
  const source=entry.host?this.channelMuzzle(entry.host,entry.waterWeapon,entry.waterOrigin.clone()):entry.waterOrigin.clone();
  const ray=entry.host?.userData?.staffAimDirection;
  const dir=Array.isArray(ray)&&ray.length===3&&ray.every(Number.isFinite)?
   new THREE.Vector3(...ray).normalize():entry.waterDirection;
  const straight=source.clone().addScaledVector(dir,entry.waterRange);
  const lock=entry.waterOwner&&world?.tidalLocks?.[entry.waterOwner];
  const ends=(lock?.targets||[]).slice(0,3).filter(t=>
   Array.isArray(t.position)&&t.position.length===3&&t.position.every(Number.isFinite))
   .map(t=>new THREE.Vector3(...t.position));
  if(!ends.length)ends.push(straight);
  // Retain one native blue Venom Stream, connected to the closest locked
  // target. Two additional guided rays share ONE buffered 128-point cloud.
  entry.fx.setEndpoints(source,ends[0]);
  const buffer=entry.waterParticles?.geometry?.attributes?.position;
  if(!buffer)return;
  const a=buffer.array,count=buffer.count,n=ends.length;
  for(let i=0;i<count;i++){
   const beam=i%n,end=ends[beam],ordinal=Math.floor(i/n);
   const span=Math.ceil((count-beam)/n);
   const progress=(ordinal/Math.max(1,span)+entry.age*(.48+.055*(i%7)))%1;
   const theta=i*2.399963+entry.age*11;
   const dx=end.x-source.x,dy=end.y-source.y,dz=end.z-source.z;
   const length=Math.max(.001,Math.hypot(dx,dz));
   const sx=dz/length,sz=-dx/length;
   const radius=(.08+.20*progress)*(entry.waterWidthFactor||1);
   const splash=progress>.88?(progress-.88)/.12:0;
   const curve=Math.sin(theta)*radius+Math.cos(entry.age*8+i)*splash*.5;
   a[i*3]=source.x+dx*progress+sx*curve;
   a[i*3+1]=source.y+dy*progress+Math.cos(theta)*radius*.75+splash*Math.sin(theta*3)*.38;
   a[i*3+2]=source.z+dz*progress+sz*curve;
  }
  buffer.needsUpdate=true;
 }
 stopChannel(root){
  this.restoration.stop(root);
  for(const entry of [...this.waterStreams.values()])
   if(entry.host===root)this.release(entry);
  this.numberedEffects.stop(root);
  for(const [key,entry] of [...this.channelStreams])if(entry.host===root){
   this.particleSkills.remove(entry);this.channelStreams.delete(key);
  }
 }
 // Each ordinary tap launches ONE volumetric elemental orb, visibly flying
 // on exactly the same server-owned ray and duration as the damage hitbox.
 // Pooled three-draw elemental globes replace per-cast geometry and
 // physical-material allocations. The shell and the spark cloud pulsate.
 staffOrb(data,item,origin,direction){
  if(this.staffOrbs.length>=28)this.releaseStaffOrb(this.staffOrbs[0]);
  const palette={water:['#35c9ff','#d7ffff'],ice:['#9eeaff','#ffffff'],
   fire:['#ff581d','#ffd063'],lightning:['#42aaff','#e1ffff'],
   beam:['#fff2a3','#ffffff'],petal:['#ff8dcc','#fff1fd'],wave:['#44dccb','#e4fffb']};
  const family=item.family,colors=palette[family]||palette.water;
  const pool=this.orbPools.get(family)||[];let entry=pool.pop();
  if(!entry){
   const group=new THREE.Group();group.name='Pulsing '+family+' elemental orb';
   const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.35,2),
    new THREE.MeshBasicMaterial({color:colors[0],toneMapped:false}));
   const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(.47,1),
    new THREE.MeshBasicMaterial({color:colors[1],transparent:true,opacity:.24,
     depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide}));
   const n=64,positions=new Float32Array(n*3);
   for(let i=0;i<n;i++){
    const a=i*2.39996323,h=1-2*(i+.5)/n,r=.45*Math.sqrt(Math.max(0,1-h*h));
    positions[i*3]=Math.cos(a)*r;positions[i*3+1]=h*.47;positions[i*3+2]=Math.sin(a)*r;
   }
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
   const cloud=new THREE.Points(geometry,new THREE.PointsMaterial({color:colors[1],size:.14,
    transparent:true,opacity:.64,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
   cloud.frustumCulled=false;group.add(core,shell,cloud);entry={group,core,shell,cloud,family};
   if(family==='lightning'){
    // Local crackling arcs revolve around the projectile itself, never a laser
    // extending from the staff. Construct once and reuse from the orb pool.
    const points=[];
    for(let arc=0;arc<4;arc++)for(let i=0;i<12;i++){
     const segment=t=>{
      const a=(i+t)*Math.PI/6+arc*.42,r=.49+.06*Math.sin(i*3.1+arc*2.2+t);
      return [r*Math.cos(a),r*Math.sin(a)*Math.cos(arc*1.23),
       r*Math.sin(a)*Math.sin(arc*1.23)];
     };
     points.push(...segment(0),...segment(1));
    }
    const arcGeometry=new THREE.BufferGeometry();
    arcGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    const arcs=new THREE.LineSegments(arcGeometry,new THREE.LineBasicMaterial({
     color:'#bceaff',transparent:true,opacity:.95,depthWrite:false,
     blending:THREE.AdditiveBlending,toneMapped:false}));
    arcs.frustumCulled=false;group.add(arcs);entry.arcs=arcs;
   }
  }
  this.orbPools.set(family,pool);
  entry.origin=origin.clone();entry.direction=direction.clone();
  entry.age=0;entry.range=Math.max(1,Number(data.range)||12);
  entry.duration=Math.max(.16,Number(data.flightMs)||projectileFlightMs(item,false,entry.range))/1000;
  entry.group.position.copy(origin);entry.group.scale.setScalar(Math.max(.7,Math.min(1.6,Number(data.qualityScale)||1)));
  entry.group.visible=true;this.scene.add(entry.group);this.staffOrbs.push(entry);
 }
 releaseStaffOrb(entry){
  const index=this.staffOrbs.indexOf(entry);if(index>=0)this.staffOrbs.splice(index,1);
  entry.group.removeFromParent();entry.group.visible=false;
  const pool=this.orbPools.get(entry.family)||[];
  if(pool.length<12){pool.push(entry);this.orbPools.set(entry.family,pool);}
  else entry.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});
 }
 async warmStaffOrbs(renderer,camera){
  const stage=new THREE.Scene(),entries=[];
  for(const family of ['water','ice','fire','lightning','beam','petal','wave']){
   for(let i=0;i<2;i++){
    this.staffOrb({range:14,flightMs:420},{family,range:14},new THREE.Vector3(0,1,i*2),new THREE.Vector3(0,0,1));
    const entry=this.staffOrbs[this.staffOrbs.length-1];
    stage.add(entry.group);entries.push(entry);
   }
  }
  const target=new THREE.WebGLRenderTarget(16,16),previous=renderer.getRenderTarget();
  try{await renderer.compileAsync(stage,camera);renderer.setRenderTarget(target);renderer.render(stage,camera);}
  finally{renderer.setRenderTarget(previous);target.dispose();for(const entry of entries)this.releaseStaffOrb(entry);}
 }
 play(data,item,root){
  // Sustained beams use only the authentic 00GameDevs #08 / #29 animations.
  // Short taps are orb projectiles; no independently fabricated ray.
  // Native ground healing ring is independent of #43's travelling blossom.
  // Repeated server pulses refresh ONE pooled ring, never spawn duplicates.
  if(data.channel&&!data.fusionEcho&&item.family==='petal'&&root)this.restoration.pulse(root);
  const id=effectFor(item,data.ultimate),direction=new THREE.Vector3(...(data.direction||[0,0,1])).normalize(),origin=new THREE.Vector3(...data.origin),range=Math.max(1,data.range||4),end=data.aimPoint?new THREE.Vector3(...data.aimPoint):data.impactPoint?new THREE.Vector3(...data.impactPoint):origin.clone().addScaledVector(direction,range);
  if(item.id==='accordion'&&!data.ultimate&&!data.fusionEcho){
   const notes=createOddEffect(THREE,{
    ...data,charge:0,origin:origin.toArray(),direction:direction.toArray(),range:3.2
   },{...item,pattern:'score'});
   notes.root.position.copy(root?.position||origin);
   if(this.snipers.length>=24){
    const old=this.snipers.shift();old.root.removeFromParent();old.root.material.dispose();
   }
   this.scene.add(notes.root);this.snipers.push(notes);
  }
  // Charged ground spells are placed on the *server validated impact area*.
  // Previously every non-projectile preset was spawned one metre below
  // the caster, leaving distant spells invisible or buried in terrain.
  const impactArea=data.area||(data.ultimate?chargedArea(item,data.origin,data.direction,data):null);
  const groundEffect=!!data.ultimate&&impactArea?.mode==='area';
  const remoteCharged=!!data.ultimate&&(groundEffect||impactArea?.mode==='corridor');
  // Scoped firearm rounds and charged White Cat bullets must converge from
  // the physical muzzle on the camera reticle, never at a ground-AoE marker.
  if(data.ultimate&&Array.isArray(impactArea?.visualCenter)&&!item.firstPerson)
   end.copy(new THREE.Vector3(...impactArea.visualCenter));
  // Retire the palm thorn crowns/binding curse and planter thorn forest.
  // Server-authoritative collision, warning and fusion footprints are unchanged.
  if(data.ultimate&&!item.exotic&&['palm','planter'].includes(item.family)){
   this.plantUltimates.play({...data,area:impactArea},item);return;
  }
  // Every ordinary staff shot, including beam, is a pulsing elemental orb.
  if(isChannelStaff(item)&&item.id!=='clam'&&!data.channel&&(!data.ultimate||['lightning','beam'].includes(item.family))){
   this.staffOrb(data,item,origin,direction);return;
  }
  // Ice staff summons the original Shattering Frostburst at the exact
  // server-owned forward circle; never release the old travelling ice spear.
  if(item.family==='ice'&&data.ultimate&&impactArea?.mode==='area'){
   const spell=this.acquire('ice-shatter',{
    color:'#a7e4ff',size:1,density:.65,quantity:9,speed:1
   });
   spell.fx.group.position.fromArray(impactArea.visualCenter||impactArea.center||origin.toArray());
   spell.fx.group.position.y+=.28;
   spell.fx.update(.02);
   spell.iceRadius=Math.max(.35,(Number(impactArea.radius)||2)/2.5);
   spell.fx.group.scale.setScalar(spell.iceRadius);
   spell.stopAt=3;
   return;
  }
  // Water staff projects the actual 00GameDevs Corrosive Venom Jet in blue.
  // Do not stack the former tidal-surge prefab or custom stream.
  if(item.family==='water'&&data.channel&&!data.fusionEcho){
   this.playWaterStream(data,item,root,origin,direction,range);
   return;
  }
  // Charged and sustained spells keep their original 00GameDevs effects.
  if(this.numberedEffects.play(data,item,root))return;
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
  if(data.ultimate&&(item.id==='accordion'||item.family==='petal'||item.id==='giraffe'))return;
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
  const meleeColor=({dark:'#18121e',light:'#ffe65b',fire:'#ff5f1d',
   water:'#4fbaff',wind:'#96e6ba',earth:'#d9a761'})[item.element];
  const entry=this.acquire(id,{color:meleeColor&&['saber','whip','swatter','pan','planter','palm'].includes(item.family)?meleeColor:item.color,size:(data.ultimate?Math.min(3.6,Math.max(1.2,(impactArea?.radius||5)/3.5)):.6)*(data.qualityScale||1),speed:data.ultimate?1:1.8}),fx=entry.fx;
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

 update(dt,camera=null,world=null){
  this.restoration.update(dt,camera);
  for(const [key,entry] of [...this.channelStreams]){
   if(!this.particleSkills.active.includes(entry)||!entry.host?.parent){
    this.channelStreams.delete(key);continue;
   }
   const now=performance.now();
   if(now-entry.lastPulseAt>Math.max(3100,entry.weapon.cooldown*2+650)){
    this.particleSkills.remove(entry);this.channelStreams.delete(key);continue;
   }
   entry.root.position.copy(this.channelMuzzle(entry.host,entry.weapon,entry.root.position));
   // The character does not necessarily rotate while standing still and
   // aiming the mouse. Sample the active camera ray every frame, not a
   // handful of server pulse headings or its old body orientation.
   const ray=entry.host.userData?.staffAimDirection;
   const target=Array.isArray(ray)&&ray.length===3&&ray.every(Number.isFinite)?
    new THREE.Vector3(...ray).normalize():entry.direction;
   entry.aimDirection??=entry.direction.clone();
   entry.aimDirection.lerp(target,1-Math.exp(-dt*28)).normalize();
   entry.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),entry.aimDirection);
   // No stale detached beam: the currently drawn particles remain weapon-bound.
  }
  // An exception in one animation subsystem must never abort the gameplay frame.
  for(const [label,system] of [['saber',this.saberImpact],['particles',this.particleSkills],
    ['signature',this.signatureEffects],['numbered',this.numberedEffects],['botanical',this.plantUltimates]]){
   try{if(label==='signature')system.update(dt,world);else system.update(dt,camera,label==='numbered'?world:null);}catch(error){
    this.failedAnimationSystems??=new Set();
    if(!this.failedAnimationSystems.has(label)){
     this.failedAnimationSystems.add(label);
     console.error('VFX subsystem update failed without blocking other effects',label,error);
    }
   }
  }
  for(const orb of [...this.staffOrbs]){
   orb.age+=dt;
   const t=Math.min(1,orb.age/orb.duration);
   orb.group.position.copy(orb.origin).addScaledVector(orb.direction,orb.range*t);
   orb.group.rotation.z=orb.age*2.8;orb.cloud.rotation.y=orb.age*7;
    if(orb.arcs){orb.arcs.rotation.x=orb.age*5.4;orb.arcs.rotation.y=orb.age*9.3;orb.arcs.material.opacity=.72+.23*Math.sin(orb.age*36);}
    orb.shell.scale.setScalar(1+.18*Math.sin(orb.age*18));
    orb.core.scale.setScalar(.93+.11*Math.sin(orb.age*22));
    orb.cloud.material.opacity=.52+.12*Math.sin(orb.age*16);
   if(orb.age>=orb.duration)this.releaseStaffOrb(orb);
  }
  for(let i=this.snipers.length-1;i>=0;i--){
   const f=this.snipers[i];
   try{
    if(!updateOddEffect(f,dt)){f.root.removeFromParent();f.root.material.dispose();this.snipers.splice(i,1);}
   }catch(error){
    this.snipers.splice(i,1);
    try{f.root.removeFromParent();f.root.material.dispose();}catch{}
    this.reportAnimationFailure('sniper',error);
   }
  }
  for(const e of [...this.active]){
   try{
    if(e.waterChannel){
     if(performance.now()-e.lastWaterPulseAt>Math.max(3100,Number(e.waterWeapon?.cooldown||650)*2+650)){
      this.release(e);continue;
     }
     this.alignWaterStream(e,world);
    }
    e.age+=dt;if(e.weapon)e.weapon.updateWorldMatrix(true,false);
    if(e.start&&!e.stopped)e.fx.group.position.lerpVectors(e.start,e.end,Math.min(1,e.age/e.travel));
    if(!e.stopped&&e.age>=e.stopAt){
     if(e.hit)e.fx.hit(e.end);
     else if(continuous.has(e.id)||e.id==='weapon-smear')e.fx.stop();
     e.stopped=true;
    }
    e.fx.update(dt);
    if(e.iceRadius)e.fx.group.scale.setScalar(e.iceRadius);
    if(e.fx.finished||(!e.waterChannel&&e.age>12))this.release(e);
   }catch(error){
    // The failed native instance cannot go back to the reusable GPU pool.
    const index=this.active.indexOf(e);if(index>=0)this.active.splice(index,1);
    if(e.waterKey)this.waterStreams.delete(e.waterKey);
    if(e.waterParticles){e.waterParticles.removeFromParent();e.waterParticles.geometry.dispose();e.waterParticles.material.dispose();}
    if(this.charger===e)this.charger=null;
    try{e.fx.group.removeFromParent();e.fx.dispose();}catch{}
    this.reportAnimationFailure(e.id,error);
   }
  }
 }
 reportAnimationFailure(id,error){
  this.failedAnimations??=new Set();
  if(this.failedAnimations.has(id))return;
  this.failedAnimations.add(id);
  console.error('Weapon animation failed; quarantined this instance',id,error);
 }
 dispose(){
  for(const e of this.waterStreams.values())if(e.waterParticles){
   e.waterParticles.removeFromParent();e.waterParticles.geometry.dispose();e.waterParticles.material.dispose();
  }
  this.waterStreams.clear();this.plantUltimates.dispose();this.restoration.dispose();this.numberedEffects.dispose();this.channelStreams.clear();for(const orb of [...this.staffOrbs])this.releaseStaffOrb(orb);
  for(const pool of this.orbPools.values())for(const entry of pool)entry.group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});
  this.orbPools.clear();this.saberImpact.dispose();this.aura.dispose();this.particleSkills.dispose();this.signatureEffects.dispose();for(const f of this.snipers){f.root.removeFromParent();f.root.material.dispose();}this.snipers=[];for(const e of [...this.active]){e.fx.dispose();e.fx.group.removeFromParent();}this.active=[];for(const pool of this.pools.values())for(const fx of pool)fx.dispose();this.pools.clear();}
}
