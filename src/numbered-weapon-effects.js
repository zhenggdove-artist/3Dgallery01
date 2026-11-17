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
import thornCrown from '../vendor/00gamedevs/source/thorn-crown.js';
import animeFlame from '../vendor/00gamedevs/source/anime-flame-shield.js';

export const REQUESTED_VFX=Object.freeze({
 'clam:channel':{number:33,asset:'tidal-surge',original:true},
 'clam:ultimate':{number:33,asset:'tidal-surge',original:true},
 'beam:normal':{number:29,asset:'radiant-beam',original:true},
 'beam:channel':{number:29,asset:'radiant-beam',original:true},
 'beam:ultimate':{number:29,asset:'radiant-beam',original:true},
 'saber:ultimate':{number:38,asset:'magma-fissure',original:true},
 'palm:ultimate':{number:31,asset:'thorn-crown',original:true},
 'petal:channel':{number:43,asset:'revival-bloom',original:true},
 'petal:ultimate':{number:43,asset:'revival-bloom',original:true},
 'swatter:ultimate':{number:53,asset:'darkchain-detonation',original:true},
 'fire:channel':{number:73,asset:'anime-flame-shield',original:true},
 'pan:ultimate':{number:68,asset:'rolling-fireburst',original:true},
 'ice:channel':{number:70,asset:'ice-lance-study',original:true},
 'lightning:channel':{number:8,asset:'arc-ray',original:true},
 'wave:channel':{number:20,asset:'energy-vortex',original:true},
 'wave:ultimate':{number:20,asset:'energy-vortex',original:true},
 'saber:combo':{number:47,asset:'dimensional-rend',original:true},
 'jellybrella:ultimate':{number:26,asset:'frost-wheel',original:true},
 'whip:ultimate':{number:48,asset:'black-hole',original:true}
});
const FACTORIES={
 'arc-ray':arcRay,'energy-vortex':energyVortex,'frost-wheel':frostWheel,
 'tidal-surge':tidalSurge,'magma-fissure':magmaFissure,'revival-bloom':revivalBloom,
 'dimensional-rend':dimensionalRend,'black-hole':blackHole,
 'darkchain-detonation':darkchain,'rolling-fireburst':rollingFireburst,
 'ice-lance-study':iceLance,'anime-flame-shield':animeFlame,'radiant-beam':radiantBeam,
 'thorn-crown':thornCrown
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
const CYCLE_INTERVAL=Object.freeze({20:1.35,43:1.08,70:.76});
const TRAVELLING_NATIVE=new Set([20,43,70]);
const travelLifetime=number=>number===70?1.26:number===43?2.2:4.2;
const vector=(value,fallback)=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)?
 new THREE.Vector3(...value):fallback.clone();
const channelColors=Object.freeze({
 'arc-ray':'#2878ff','tidal-surge':'#66cddd','revival-bloom':'#ff8fbd',
 'anime-flame-shield':'#ff761f','ice-lance-study':'#d4e8ed',
 'energy-vortex':'#66d7ff','radiant-beam':'#ffe3a0','thorn-crown':'#88d49a'
});
// Scale the ORIGINAL authored effect, rather than replacing its artwork.
// #68 and #48 retain their pre-change vendor size and apply the exact same
// post-quality reduction as their server-owned circle: 50% pan, 80% whip (a further 50% reduction).
export function ultimateWorldScale(number,event,options={}){
 if(!event?.ultimate||event.channel)return null;
 const radius=Math.max(.1,Number(event.area?.radius)||Number(event.radius)||.1);
 if(number===68)return .5*Math.max(7.5,(radius/.5)/Math.max(.2,Number(options.size)||1));
 if(number===26)return Math.max(2*(Number(options.quality)||1),Math.min(12,radius/2));
 if(number===48)return .2*Math.max(2,Math.min(12,(radius/.2)/Math.max(.25,(Number(options.size)||1)*.8)));
 if(number===53)return Math.max(2,Math.min(12,radius/Math.max(.25,(Number(options.size)||1)*.8)));
 return null; // directional originals already follow the server-approved ray
}
export function requestedEffect(item,event){
 if(!item||!event)return null;
 // Preserve signature ultimates for other exotic weapons.
 if(item.exotic&&!['clam','jellybrella'].includes(item.id))return null;
 const key=event.channel?(item.id==='clam'?'clam':item.family)+':channel':
  event.ultimate?(item.id==='clam'?'clam':item.id==='jellybrella'?'jellybrella':item.family)+':ultimate':
  item.family==='beam'?'beam:normal':
  item.family==='saber'&&(Number(event.qualityTier)||Number(item.tier))===4&&
   Number(event.combo)===5?'saber:combo':'';
 return REQUESTED_VFX[key]||null;
}

export class NumberedWeaponEffects {
 constructor(scene,muzzle=()=>null) {
  this.scene=scene;
  this.muzzle=muzzle;
  this.active=[];this.prewarmed=new Map();
  }
 acquire(spec,options){
  const pool=this.prewarmed.get(spec.asset),cached=pool?.pop();
  const fx=cached||this.create(spec,options);
  if(cached){fx.reset?.();fx.setOptions?.(options);this.scene.add(fx.group);}
  fx.group.visible=true;
  return fx;
 }
 recycle(spec,fx){
  if(!fx)return;
  fx.group.removeFromParent();fx.group.visible=false;fx.reset?.();
  let pool=this.prewarmed.get(spec.asset);
  if(!pool){pool=[];this.prewarmed.set(spec.asset,pool);}
  // Keep the real 00GameDevs module and GPU resources alive between casts.
  if(pool.length<4)pool.push(fx);else fx.dispose();
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
  async warm(renderer,camera) {
    // Compile every original #00GameDevs shader while the loading window is
    // open, and retain one expensive module for immediate first-use playback.
    const unique=new Map(Object.values(REQUESTED_VFX).map(spec=>[spec.asset,spec]));
    // The 3-crown and overlapping travelling-wave skills need MULTIPLE real
    // native instances on their first cast. Create these before entering play.
    const copiesByNumber={31:3,33:4,20:2,43:2,70:2};
    let warmed=0;
    for(const spec of unique.values()){
      const copies=copiesByNumber[spec.number]||1;
      for(let i=0;i<copies;i++){
        let fx=null;
        try{
          fx=this.create(spec,{size:1,detail:1,density:.5});
          const stage=new THREE.Scene();stage.add(fx.group);fx.group.visible=true;
          fx.update(.016);
          await renderer.compileAsync(stage,camera);
          this.recycle(spec,fx);fx=null;warmed++;
        }catch(error){
          if(fx){fx.group.removeFromParent();fx.dispose();}
          console.warn('Cannot prewarm 00GameDevs #'+spec.number,error);
          break;
        }
      }
    }
    return warmed;
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
   if(!live.waves&&!live.cycles)this.align(live);
   return true;
  }
  const quality=Math.max(.25,Math.min(4,Number(event.qualityScale)||1));
  const normalSize=(spec.number===26?84:spec.number===38?2:spec.number===48?2:1.2)*quality;
  // The Ice Lance / erupting pillar #70 must be exactly half the previous
  // display dimensions, irrespective of rarity/fusion quality.
  let size=spec.number===70?normalSize*.5:normalSize;
  // The nozzle and authored free flame have a 10-local-metre reach.
  // Scale its world container to the server's range, not its actual props.
  if(spec.number===73)size=1;
  if(spec.number===31)size=Math.max(.25,Math.min(3.5,quality));
  if(event.ultimate&&!event.channel&&Number.isFinite(event.area?.radius)&&![26,29,31,38,70].includes(spec.number)){
   // Reconstruct the old vendor size first. Applying only the matching
   // outer world scale ensures identical proportional shrink at all tiers.
   const originalRadius=event.area.radius/(spec.number===68?.5:spec.number===48?.2:1);
   size=Math.max(.25,Math.min(3.5,originalRadius/4.5));
  }
  const options={size,quality,detail:event.fusionEcho?.55:1,density:event.fusionEcho?.3:.5,speed:spec.number===70?2:spec.number===33?.78:1,color:channelColors[spec.asset]||undefined};
  if(!options.color)delete options.color;
  const fx=this.acquire(spec,options);
  const origin=vector(event.origin,new THREE.Vector3(0,1,0));
  // #29 is a forward beam: even its charged shot starts at the weapon, not
  // at an unrelated remote ground-circle centre.
  // Sword cracks begin from the hand, not a distant ground-target position.
  const areaLocked=!!event.ultimate&&!event.channel&&![20,29,31,33,38,43].includes(spec.number)&&Array.isArray(event.area?.visualCenter);
  const target=areaLocked?vector(event.area.visualCenter,origin):origin.clone();
  const entry={
   spec,fx,group:fx.group,root,item,direction,origin,target,options,
   worldScale:ultimateWorldScale(spec.number,event,options),
   range:Math.max(.5,Number(event.range)||12),
   key,channel:!!event.channel,areaLocked,age:0,
   duration:event.channel?Infinity:(spec.number===31?2.5:spec.number===20?4.5:spec.number===33?3.3:spec.number===43?2.25:spec.number===48?6.5:spec.number===53?7:5),
   lastPulse:performance.now(),stopping:false,
   heading:root?.rotation.y||0,
   // These original assets are one-shot. Each next copy begins before the
   // previous fades: no reset-to-zero flash, no pause between server pulses.
   cycleTimer:0,cycles:null,waves:null,waveTimer:0,
   singleTravel:!event.channel&&TRAVELLING_NATIVE.has(spec.number)
  };
  this.active.push(entry);
  if(this.active.length>24)this.remove(this.active[0]);
  this.align(entry);
  if(entry.worldScale!=null)fx.group.scale.setScalar(entry.worldScale);
  // The vendor clamps 'size' at 2. Double the physical world-space group.
  if(spec.number===26)fx.group.scale.setScalar(entry.worldScale||2*quality);
  if(spec.number===31){
   // Three independently authored ORIGINAL #31 crown instances, not a
   // synthetic thorn mesh; aligned vertically and moved as one projectile.
   entry.palmLayers=[fx,this.acquire(spec,options),this.acquire(spec,options)];
   entry.palmStart=this.muzzleAt(entry);
   entry.palmDirection=direction.clone();
   this.updatePalm(entry,0);
  }else if(spec.number===33){
   // Dedicated long-running #33 tide: staggered, overlapping ORIGINAL
   // Breaking Tidal Surge modules, progressing out from the shell.
   entry.waves=[];
   this.spawnClamWave(entry,fx);
  }else if(key&&CYCLE_INTERVAL[spec.number]) {
   entry.cycles=[this.makeCycle(entry,fx)];
  }
  // Only the server's projectile/sector collision applies any damage.
  return true;
 }
 muzzleAt(entry) {
  if(entry.root&&(entry.channel||entry.spec.number===31||entry.spec.number===33||entry.spec.number===38)) {
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
  if(spec.number===38){
   // The exact original #38 has an authored local +X crack spanning
   // -2.25..+2.43. Its former position at the muzzle put half the crack
   // behind the player. Move its LEFT tip to the hand, not the centre.
   // Its local Z is lateral: reduce that scale to one-third of the old 2.
   const horizontal=dir.clone().setY(0);
   if(horizontal.lengthSq()<.001)horizontal.set(0,0,1);
   horizontal.normalize();
   const authoredLength=4.68;
   fx.group.scale.set(range/authoredLength,2*(entry.options.quality||1),(2/3)*(entry.options.quality||1));
   fx.group.position.copy(origin).addScaledVector(horizontal,range*(2.25/authoredLength));
   fx.group.position.y=Math.max(.12,origin.y-1.15);
   fx.group.quaternion.setFromUnitVectors(X_FORWARD,horizontal);
   fx.group.userData.fissureRange=range;
   fx.group.userData.fissureLateralScale=2/3;
   return;
  }
  // Original ice #70 resets group.scale in every update(), which silently
  // cancelled the previous attempt at a longer ice-shard journey.
  // #70 copies now move from the staff tip to the FULL hit range instead.
  if(entry.areaLocked){
   fx.group.quaternion.setFromAxisAngle(UP,Math.atan2(dir.x,dir.z));
  }else{
   // Original #33 and #70 are authored facing +X; rotating from +Z
   // made the released wave and ice spear travel sideways.
   fx.group.quaternion.setFromUnitVectors(
    spec.number===70||spec.number===38?X_FORWARD:FORWARD,dir);
  }
  if(typeof fx.setDirection==='function')fx.setDirection(dir,0);
  if(typeof fx.setAim==='function'){
   fx.group.updateWorldMatrix(true,false);
   fx.setAim(origin.clone().addScaledVector(dir,Math.min(range,10)));
  }
 }
 spawnClamWave(entry,existing=null) {
  if(!entry.waves)return;
  const fx=existing||this.acquire(entry.spec,entry.options);
  const dir=entry.direction.clone();
  if(entry.root)dir.applyAxisAngle(UP,entry.root.rotation.y-entry.heading).normalize();
  const start=this.muzzleAt(entry);
  const wave={fx,age:0,start,direction:dir,reach:entry.range};
  fx.group.position.copy(start);
  // #33 wave is authored facing +Z. Rotating local +X to the player's
  // +Z made it erupt at the player's RIGHT instead of travelling forward.
  fx.group.quaternion.setFromUnitVectors(FORWARD,dir);
  fx.group.scale.setScalar(.001);
  entry.waves.push(wave);
  if(entry.waves.length>6)this.disposeWave(entry.waves.shift());
  entry.fx=entry.waves[0].fx;
 }
 disposeWave(wave) {
  if(!wave)return;
  this.recycle({asset:wave.fx.group.userData.vfxId},wave.fx);
 }
 updateClamWaves(entry,dt){
  entry.waveTimer+=dt;
  while(entry.waveTimer>=CLAM_WAVE_INTERVAL){
   entry.waveTimer-=CLAM_WAVE_INTERVAL;
   if(entry.channel||entry.age<1.55)this.spawnClamWave(entry);
  }
  for(const wave of [...entry.waves]){
   wave.age+=dt;
   // The emerging crest follows the real moving shell for 0.2s. After
   // detaching it travels independently instead of snapping to the avatar.
   if(wave.age<=.2&&entry.root)wave.start.copy(this.muzzleAt(entry));
   const t=Math.min(1,Math.max(0,wave.age-.2)/(CLAM_WAVE_LIFETIME-.2));
   // Move the old crest gently outwards and let the next crest grow behind.
   // Reserve ~5 original scene metres for the source module's own front.
   const travel=Math.max(0,wave.reach-5*entry.options.size);
   const eased=t*t*(3-2*t);
   wave.fx.group.position.copy(wave.start).addScaledVector(wave.direction,travel*eased);
   const appearing=Math.min(1,wave.age/.28);
   const leaving=Math.max(0,Math.min(1,(CLAM_WAVE_LIFETIME-wave.age)/.55));
   const envelope=Math.max(.001,Math.min(appearing,leaving));
   const lateral=Math.max(1,Math.min(6,entry.range/Math.max(6,entry.options.size*5)));
   wave.fx.update(dt);
   // The native wave may reset scale inside its update.
   wave.fx.group.scale.set(lateral*envelope,envelope,envelope);
   if(wave.age>=CLAM_WAVE_LIFETIME||wave.fx.finished){
    entry.waves.splice(entry.waves.indexOf(wave),1);
    this.disposeWave(wave);
   }
  }
  if(!entry.waves.length&&entry.channel)this.spawnClamWave(entry);
 }
 currentDirection(entry){
  const dir=entry.direction.clone();
  if(entry.channel&&entry.root)
   dir.applyAxisAngle(UP,entry.root.rotation.y-entry.heading);
  return dir.normalize();
 }
 makeCycle(entry,fx){
  const moving=TRAVELLING_NATIVE.has(entry.spec.number);
  const start=this.muzzleAt(entry),direction=this.currentDirection(entry);
  if(moving){
   // The original #43 bloom and #20 conch vortex copy detaches from the
   // muzzle and moves independently. New copies start at the CURRENT tip.
   fx.group.position.copy(start);
   fx.group.quaternion.setFromUnitVectors(entry.spec.number===70?X_FORWARD:FORWARD,direction);
  }else this.align(entry,fx);
  return {fx,age:0,start,direction,stopping:false};
 }
 discardCycle(entry,copy){
  const index=entry.cycles.indexOf(copy);
  if(index>=0)entry.cycles.splice(index,1);
  this.recycle(entry.spec,copy.fx);
 }
 updateNativeCycles(entry,dt){
  const number=entry.spec.number,moving=TRAVELLING_NATIVE.has(number);
  entry.cycleTimer+=dt;
  while(entry.cycleTimer>=CYCLE_INTERVAL[number]){
   entry.cycleTimer-=CYCLE_INTERVAL[number];
   const fx=this.acquire(entry.spec,entry.options);
   entry.cycles.push(this.makeCycle(entry,fx));
  }
  for(const copy of [...entry.cycles]){
   copy.age+=dt;
   if(moving){
    const duration=travelLifetime(number);
    const t=Math.min(1,copy.age/duration);
    const progress=t*t*(3-2*t);
    const advance=number===70?entry.range*progress:Math.min(entry.range,Math.max(4,entry.range*.72))*progress;
    copy.fx.group.position.copy(copy.start).addScaledVector(copy.direction,advance);
    if(number===20&&copy.age>=duration-.9&&!copy.stopping){
     copy.stopping=true;
     copy.fx.stop?.();
    }
   }else this.align(entry,copy.fx);
   copy.fx.update(dt);
   if(number===70&&moving){
    // Position after the source update as well: its internal animation must
    // never rewind the world-space forward travel of the ice fragments.
    copy.fx.group.position.copy(copy.start).addScaledVector(copy.direction,
      entry.range*Math.min(1,copy.age/travelLifetime(number)));
   }
   if(copy.fx.finished||(moving&&copy.age>travelLifetime(number)+.55))
    this.discardCycle(entry,copy);
  }
  while(entry.cycles.length>(moving?4:3))this.discardCycle(entry,entry.cycles[0]);
  if(!entry.cycles.length){
   const fx=this.acquire(entry.spec,entry.options);
   entry.cycles.push(this.makeCycle(entry,fx));
  }
  entry.fx=entry.cycles[0].fx;
 }
 updatePalm(entry,dt){
  const t=Math.min(1,entry.age/1.65);
  const center=entry.palmStart.clone().addScaledVector(entry.palmDirection,entry.range*t);
  for(let i=0;i<entry.palmLayers.length;i++){
   const fx=entry.palmLayers[i];
   fx.group.position.copy(center);
   fx.group.position.y+=i*2.15*entry.options.size;
   fx.group.rotation.y=entry.age*15.5+i*Math.PI*2/3;
   if(entry.age>=1.88&&!entry.stopping)fx.stop?.();
   fx.update(dt);
  }
  if(entry.age>=1.88)entry.stopping=true;
 }
 update(dt){
  const now=performance.now();
  for(const e of [...this.active]){
   e.age+=dt;
   if(e.key&&now-e.lastPulse>Math.max(CHANNEL_GRACE_MS,Number(e.item.cooldown||700)*2+650)){
    this.remove(e);continue;
   }
   if(e.palmLayers){
    this.updatePalm(e,dt);
    if(e.age>=e.duration)this.remove(e);
    continue;
   }
   if(e.waves){
    this.updateClamWaves(e,dt);
    if(!e.channel&&e.age>=e.duration)this.remove(e);
    continue;
   }
   if(e.cycles){this.updateNativeCycles(e,dt);continue;}
   if(e.singleTravel){
    const t=Math.min(1,e.age/travelLifetime(e.spec.number));
    const ease=t*t*(3-2*t);
    // The travelling #20/#43/#70 original must traverse the ENTIRE warned
    // ray; the former 72% cap stopped visibly short of the blue #59 footprint.
    const delta=e.range*ease;
    e.fx.group.position.copy(e.origin).addScaledVector(e.direction,delta);
    if(e.spec.number===20&&e.age>3.45&&!e.stopping){
     e.stopping=true;e.fx.stop?.();
    }
   }else this.align(e);
   if(!e.key&&e.age>3&&!e.stopping&&typeof e.fx.stop==='function'){
    e.stopping=true;e.fx.stop();
   }
   e.fx.update(dt);
   if(e.worldScale!=null)e.fx.group.scale.setScalar(e.worldScale);
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
  if(e.palmLayers){
   for(const fx of e.palmLayers)this.recycle(e.spec,fx);
   e.palmLayers.length=0;return;
  }
  if(e.waves){
   for(const wave of [...e.waves])this.disposeWave(wave);
   e.waves.length=0;return;
  }
  if(e.cycles){
   for(const c of [...e.cycles])this.recycle(e.spec,c.fx);
   e.cycles.length=0;return;
  }
  this.recycle(e.spec,e.fx);
 }
 dispose(){for(const e of [...this.active])this.remove(e);for(const list of this.prewarmed.values())for(const fx of list){fx.group.removeFromParent();fx.dispose();}this.prewarmed.clear();}
}
