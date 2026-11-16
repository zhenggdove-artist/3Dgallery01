import * as THREE from 'three';
// These are byte-for-byte official 00GameDevs downloads. Their SHA-256 hashes,
// source URLs and licenses are verified in vendor/00gamedevs/numbered-manifest.json.
// Do not substitute hand-built primitives, screenshots or similar-looking shaders.
import arcRay from '../vendor/00gamedevs/source/arc-ray.js';
import energyVortex from '../vendor/00gamedevs/source/energy-vortex.js';
import frostWheel from '../vendor/00gamedevs/source/frost-wheel.js';
import tidalSurge from '../vendor/00gamedevs/source/tidal-surge.js';
import magmaFissure from '../vendor/00gamedevs/source/magma-fissure.js';
import revivalBloom from '../vendor/00gamedevs/source/revival-bloom.js';
import dimensionalRend from '../vendor/00gamedevs/source/dimensional-rend.js';
import blackHole from '../vendor/00gamedevs/source/black-hole.js';
import darkchain from '../vendor/00gamedevs/source/darkchain-detonation.js';
import rollingFireburst from '../vendor/00gamedevs/source/rolling-fireburst.js';
import iceLance from '../vendor/00gamedevs/source/ice-lance-study.js';
import radiantBeam from '../vendor/00gamedevs/source/radiant-beam.js';
import animeFlame from '../vendor/00gamedevs/source/anime-flame-shield.js';

export const REQUESTED_VFX=Object.freeze({
 'clam:channel':{number:33,asset:'tidal-surge',original:true},
 'beam:normal':{number:29,asset:'radiant-beam',original:true},
 'beam:channel':{number:29,asset:'radiant-beam',original:true},
 'beam:ultimate':{number:29,asset:'radiant-beam',original:true},
 'saber:ultimate':{number:38,asset:'magma-fissure',original:true},
 'petal:channel':{number:43,asset:'revival-bloom',original:true},
 'swatter:ultimate':{number:53,asset:'darkchain-detonation',original:true},
 'fire:channel':{number:73,asset:'anime-flame-shield',original:true},
 'pan:ultimate':{number:68,asset:'rolling-fireburst',original:true},
 'ice:channel':{number:70,asset:'ice-lance-study',original:true},
 'lightning:channel':{number:8,asset:'arc-ray',original:true},
 'wave:channel':{number:20,asset:'energy-vortex',original:true},
 'saber:combo':{number:47,asset:'dimensional-rend',original:true},
 'jellybrella:ultimate':{number:26,asset:'frost-wheel',original:true},
 'whip:ultimate':{number:48,asset:'black-hole',original:true}
});
const FACTORIES={
 'arc-ray':arcRay,'energy-vortex':energyVortex,'frost-wheel':frostWheel,
 'tidal-surge':tidalSurge,'magma-fissure':magmaFissure,'revival-bloom':revivalBloom,
 'dimensional-rend':dimensionalRend,'black-hole':blackHole,
 'darkchain-detonation':darkchain,'rolling-fireburst':rollingFireburst,
 'ice-lance-study':iceLance,'anime-flame-shield':animeFlame,'radiant-beam':radiantBeam
};
const UP=new THREE.Vector3(0,1,0);
const FORWARD=new THREE.Vector3(0,0,1);
const X_FORWARD=new THREE.Vector3(1,0,0);
// #73's authored demo has its nozzle at (-3.6,1.65,0). Aim slightly
// off the original invisible demo sphere, then rotate that actual ray to
// the player's direction. No reimplementation of the official source file.
const FIRE_SOURCE=new THREE.Vector3(-3.6,1.65,0);
const FIRE_FREE_RAY=new THREE.Vector3(1,0,.42).normalize();
const CHANNEL_GRACE_MS=3100;
const CLAM_WAVE_INTERVAL=.38;
const CLAM_WAVE_LIFETIME=2.18;
const CYCLE_INTERVAL=Object.freeze({43:1.35,70:2.8});
const vector=(value,fallback)=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)?
 new THREE.Vector3(...value):fallback.clone();
const channelColors=Object.freeze({
 'arc-ray':'#2878ff','tidal-surge':'#66cddd','revival-bloom':'#ff8fbd',
 'anime-flame-shield':'#ff761f','ice-lance-study':'#d4e8ed',
 'energy-vortex':'#66d7ff','radiant-beam':'#ffe3a0'
});
export function requestedEffect(item,event){
 if(!item||!event)return null;
 // Preserve signature ultimates for other exotic weapons.
 if(item.exotic&&!['clam','jellybrella'].includes(item.id))return null;
 const key=event.channel?(item.id==='clam'?'clam':item.family)+':channel':
  event.ultimate?(item.id==='jellybrella'?'jellybrella':item.family)+':ultimate':
  item.family==='beam'?'beam:normal':
  item.family==='saber'&&(Number(event.qualityTier)||Number(item.tier))===4&&
   Number(event.combo)===5?'saber:combo':'';
 return REQUESTED_VFX[key]||null;
}

export class NumberedWeaponEffects {
 constructor(scene,muzzle=()=>null) {
  this.scene=scene;
  this.muzzle=muzzle;
  this.active=[];
 }
 create(spec,options) {
  const factory=FACTORIES[spec.asset];
  if(!factory)throw Error('Missing exact 00GameDevs factory #'+spec.number);
  const fx=factory(options);
  if(!fx?.group?.isObject3D||typeof fx.update!=='function'||typeof fx.dispose!=='function')
   throw Error('Invalid original 00GameDevs VFX #'+spec.number);
  fx.group.name='00GameDevs original VFX #'+String(spec.number).padStart(2,'0')+' '+spec.asset;
  fx.group.userData.vfxSource='00GameDevs';
  fx.group.userData.vfxId=spec.asset;
  fx.group.userData.vfxNumber=spec.number;
  if(spec.number===73) {
   // Official #73 ships two neutral demo collision props as part of its
   // source. Retain the official VFX code and conceal only the unnecessary
   // sphere/cube layers and their surface heat/soot overlays.
   fx.setLayerVisible(4,false);
   fx.setLayerVisible(5,false);
   fx.setLayerVisible(14,false);
  }
  this.scene.add(fx.group);
  return fx;
 }
 play(event,item,root) {
  const spec=requestedEffect(item,event);
  if(!spec)return false;
  const key=event.channel&&root?root.uuid+':'+spec.number:null;
  const live=key?this.active.find(e=>e.key===key):null;
  const direction=vector(event.direction,FORWARD).normalize();
  if(live) {
   live.direction.copy(direction);
   live.range=Math.max(.5,Number(event.range)||live.range);
   live.heading=root?.rotation.y||0;
   live.lastPulse=performance.now();
   if(!live.waves)this.align(live);
   return true;
  }
  const quality=Math.max(.5,Math.min(2.5,Number(event.qualityScale)||1));
  const normalSize=(spec.number===26?4.2:spec.number===38?2:spec.number===48?2:1.2)*quality;
  // The Ice Lance / erupting pillar #70 must be exactly half the previous
  // display dimensions, irrespective of rarity/fusion quality.
  let size=spec.number===70?normalSize*.5:normalSize;
  // The nozzle and authored free flame have a 10-local-metre reach.
  // Scale its world container to the server's range, not its actual props.
  if(spec.number===73)size=1;
  if(event.ultimate&&!event.channel&&Number.isFinite(event.area?.radius)&&spec.number!==29&&spec.number!==70)
   size=Math.max(.25,Math.min(3.5,event.area.radius/4.5));
  const options={size,speed:spec.number===33?.78:1,color:channelColors[spec.asset]||undefined};
  if(!options.color)delete options.color;
  const fx=this.create(spec,options);
  const origin=vector(event.origin,new THREE.Vector3(0,1,0));
  // #29 is a forward beam: even its charged shot starts at the weapon, not
  // at an unrelated remote ground-circle centre.
  const areaLocked=!!event.ultimate&&!event.channel&&spec.number!==29&&Array.isArray(event.area?.visualCenter);
  const target=areaLocked?vector(event.area.visualCenter,origin):origin.clone();
  const entry={
   spec,fx,group:fx.group,root,item,direction,origin,target,options,
   range:Math.max(.5,Number(event.range)||12),
   key,channel:!!event.channel,areaLocked,age:0,
   duration:event.channel?Infinity:(spec.number===48?6.5:spec.number===53?7:5),
   lastPulse:performance.now(),stopping:false,
   heading:root?.rotation.y||0,
   // These original assets are one-shot. Each next copy begins before the
   // previous fades: no reset-to-zero flash, no pause between server pulses.
   cycleTimer:0,cycles:null,waves:null,waveTimer:0
  };
  this.active.push(entry);
  if(this.active.length>24)this.remove(this.active[0]);
  this.align(entry);
  if(key&&spec.number===33){
   // Dedicated long-running #33 tide: staggered, overlapping ORIGINAL
   // Breaking Tidal Surge modules, progressing out from the shell.
   entry.waves=[];
   this.spawnClamWave(entry,fx);
  }else if(key&&CYCLE_INTERVAL[spec.number]) {
   entry.cycles=[{fx,age:0}];
  }
  // Only the server's projectile/sector collision applies any damage.
  return true;
 }
 muzzleAt(entry) {
  if(entry.channel&&entry.root) {
   const m=this.muzzle(entry.root,entry.item,entry.origin.clone());
   if(m?.isVector3)return m;
  }
  return entry.areaLocked?entry.target.clone():entry.origin.clone();
 }
 align(entry,fx=entry.fx) {
  const {spec,range}=entry;
  let dir=entry.direction.clone();
  if(entry.channel&&entry.root) {
   // Keep the active stream attached to the changing weapon heading even
   // between two server-authorised damage pulses.
   dir.applyAxisAngle(UP,entry.root.rotation.y-entry.heading).normalize();
  }
  const origin=this.muzzleAt(entry);
  if((spec.number===8||spec.number===29)&&typeof fx.setEndpoints==='function'){
   fx.group.position.set(0,0,0);
   fx.group.quaternion.identity();
   fx.setEndpoints(origin,origin.clone().addScaledVector(dir,range));
   return;
  }
  if(spec.number===73){
   // Original Anime Flame Flow uses +X, not the game engine's +Z axis.
   // Its built-in sphere/cube are demonstration objects, not world geometry.
   fx.group.scale.setScalar(Math.max(.25,range/10));
   fx.group.quaternion.setFromUnitVectors(FIRE_FREE_RAY,dir);
   fx.group.position.copy(origin);
   fx.group.updateWorldMatrix(true,true);
   const authoredRoot=fx.group.userData.flameAimRoot;
   const actualNozzle=authoredRoot.localToWorld(FIRE_SOURCE.clone());
   fx.group.position.add(origin.clone().sub(actualNozzle));
   fx.group.updateWorldMatrix(true,true);
   fx.setAim(origin.clone().addScaledVector(dir,range));
   return;
  }
  fx.group.position.copy(origin);
  if(entry.areaLocked){
   fx.group.quaternion.setFromAxisAngle(UP,Math.atan2(dir.x,dir.z));
  }else{
   // Original #33 and #70 are authored facing +X; rotating from +Z
   // made the released wave and ice spear travel sideways.
   fx.group.quaternion.setFromUnitVectors(
    spec.number===70||spec.number===33?X_FORWARD:FORWARD,dir);
  }
  if(typeof fx.setDirection==='function')fx.setDirection(dir,0);
  if(typeof fx.setAim==='function'){
   fx.group.updateWorldMatrix(true,false);
   fx.setAim(origin.clone().addScaledVector(dir,Math.min(range,10)));
  }
 }
 spawnClamWave(entry,existing=null) {
  if(!entry.waves)return;
  const fx=existing||this.create(entry.spec,entry.options);
  const dir=entry.direction.clone();
  if(entry.root)dir.applyAxisAngle(UP,entry.root.rotation.y-entry.heading).normalize();
  const start=this.muzzleAt(entry);
  const wave={fx,age:0,start,direction:dir,reach:entry.range};
  fx.group.position.copy(start);
  fx.group.quaternion.setFromUnitVectors(X_FORWARD,dir);
  fx.group.scale.setScalar(.001);
  entry.waves.push(wave);
  if(entry.waves.length>6)this.disposeWave(entry.waves.shift());
  entry.fx=entry.waves[0].fx;
 }
 disposeWave(wave) {
  if(!wave)return;
  wave.fx.group.removeFromParent();
  wave.fx.dispose();
 }
 updateClamWaves(entry,dt){
  entry.waveTimer+=dt;
  while(entry.waveTimer>=CLAM_WAVE_INTERVAL){
   entry.waveTimer-=CLAM_WAVE_INTERVAL;
   this.spawnClamWave(entry);
  }
  for(const wave of [...entry.waves]){
   wave.age+=dt;
   const t=Math.min(1,wave.age/CLAM_WAVE_LIFETIME);
   // Move the old crest gently outwards and let the next crest grow behind.
   // Reserve ~5 original scene metres for the source module's own front.
   const travel=Math.max(0,wave.reach-5*entry.options.size);
   const eased=t*t*(3-2*t);
   wave.fx.group.position.copy(wave.start).addScaledVector(wave.direction,travel*eased);
   const appearing=Math.min(1,wave.age/.28);
   const leaving=Math.max(0,Math.min(1,(CLAM_WAVE_LIFETIME-wave.age)/.55));
   const envelope=Math.max(.001,Math.min(appearing,leaving));
   wave.fx.group.scale.setScalar(envelope);
   wave.fx.update(dt);
   if(wave.age>=CLAM_WAVE_LIFETIME||wave.fx.finished){
    entry.waves.splice(entry.waves.indexOf(wave),1);
    this.disposeWave(wave);
   }
  }
  if(!entry.waves.length)this.spawnClamWave(entry);
 }
 updateNativeCycles(entry,dt){
  entry.cycleTimer+=dt;
  if(entry.cycleTimer>=CYCLE_INTERVAL[entry.spec.number]){
   entry.cycleTimer-=CYCLE_INTERVAL[entry.spec.number];
   const fx=this.create(entry.spec,entry.options);
   entry.cycles.push({fx,age:0});
  }
  for(const copy of [...entry.cycles]){
   copy.age+=dt;
   this.align(entry,copy.fx);
   copy.fx.update(dt);
   if(copy.fx.finished){
    entry.cycles.splice(entry.cycles.indexOf(copy),1);
    copy.fx.group.removeFromParent();
    copy.fx.dispose();
   }
  }
  if(entry.cycles.length>3){
   const old=entry.cycles.shift();
   old.fx.group.removeFromParent();
   old.fx.dispose();
  }
  if(!entry.cycles.length){
   const fx=this.create(entry.spec,entry.options);
   entry.cycles.push({fx,age:0});
  }
  entry.fx=entry.cycles[0].fx;
 }
 update(dt){
  const now=performance.now();
  for(const e of [...this.active]){
   e.age+=dt;
   if(e.key&&now-e.lastPulse>Math.max(CHANNEL_GRACE_MS,Number(e.item.cooldown||700)*2+650)){
    this.remove(e);continue;
   }
   if(e.waves){this.updateClamWaves(e,dt);continue;}
   if(e.cycles){this.updateNativeCycles(e,dt);continue;}
   this.align(e);
   if(!e.key&&e.age>3&&!e.stopping&&typeof e.fx.stop==='function'){
    e.stopping=true;e.fx.stop();
   }
   e.fx.update(dt);
   if((!e.key&&e.fx.finished)||e.age>=e.duration){
    this.remove(e);continue;
   }
   // Continuous originals (#08, #29, #20, #73) sustain without being reset
   // by individual server pulses. There is no animation reset on impact.
   if(e.key&&e.fx.finished)e.fx.reset();
  }
 }
 hasFullScreenPostprocess(){
  return this.active.some(e=>(e.spec.number===70||e.spec.number===73)&&typeof e.fx.render==='function');
 }
 render(renderer,world,camera){
  const post=this.active.find(e=>e.spec.number===73&&typeof e.fx.render==='function')||
   this.active.find(e=>e.spec.number===70&&typeof e.fx.render==='function');
  if(post)post.fx.render(renderer,world,camera);
  else renderer.render(world,camera);
 }
 stop(root){
  for(const e of [...this.active])if(e.channel&&e.root===root)this.remove(e);
 }
 remove(e){
  const i=this.active.indexOf(e);
  if(i<0)return;
  this.active.splice(i,1);
  if(e.waves){
   for(const wave of [...e.waves])this.disposeWave(wave);
   e.waves.length=0;return;
  }
  if(e.cycles){
   for(const c of [...e.cycles]){c.fx.group.removeFromParent();c.fx.dispose();}
   e.cycles.length=0;return;
  }
  e.fx.group.removeFromParent();
  e.fx.dispose();
 }
 dispose(){for(const e of [...this.active])this.remove(e);}
}
