import * as THREE from 'three';
import {installNativeCurve,updateNativeCurve,targetOnBeam} from './native-beam-curve.js';
// The authoritative forward ray is now owned by WeaponVFX, not this vendor module.
// These are byte-for-byte official 00GameDevs downloads. Their SHA-256 hashes,
// source URLs and licenses are verified in vendor/00gamedevs/numbered-manifest.json.
// Do not substitute hand-built primitives, screenshots or similar-looking shaders.
import arcRay from '../vendor/00gamedevs/source/arc-ray.js';
import energyVortex from '../vendor/00gamedevs/source/energy-vortex.js';
import frostWheel from '../vendor/00gamedevs/source/frost-wheel.js';
import tidalSurge from '../vendor/00gamedevs/source/tidal-surge.js';
import energySwordWave,{EnergySwordWaveVFX} from '../vendor/00gamedevs/source/energy-sword-wave.js';
import {SABER_WAVE_COUNT,SABER_WAVE_FAN_ANGLE_DEG} from './shared/saber-wave.js';
import revivalBloom from '../vendor/00gamedevs/source/revival-bloom.js';
import dimensionalRend from '../vendor/00gamedevs/source/dimensional-rend.js';
import blackHole from '../vendor/00gamedevs/source/black-hole.js';
import darkchain from '../vendor/00gamedevs/source/darkchain-detonation.js';
import rollingFireburst from '../vendor/00gamedevs/source/rolling-fireburst.js';
import iceLance from '../vendor/00gamedevs/source/ice-lance-study.js';
import radiantBeam from '../vendor/00gamedevs/source/radiant-beam.js';
import chargedBeam from '../vendor/00gamedevs/charged-beam.js';
import animeFlame from '../vendor/00gamedevs/source/anime-flame-shield.js';

export const REQUESTED_VFX=Object.freeze({
 'clam:channel':{number:33,asset:'tidal-surge',original:true},
 'clam:ultimate':{number:33,asset:'tidal-surge',original:true},
 'beam:channel':{number:29,asset:'charged-beam',original:true},
 'saber:ultimate':{number:0,asset:'energy-sword-wave',original:true},
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
// Performance root cause: the native five-wave fan simulates multiple CPU
// particle pools per crescent, even after their GPU instance count is halved.
// All five crescent meshes are still drawn with the ORIGINAL vendor shaders.
// Suppress non-essential debris particle simulations entirely, reducing both
// per-frame setMatrixAt loops and GPU draw calls without changing combat logic.
const nativeSaberPrototype=EnergySwordWaveVFX.prototype;
if(!nativeSaberPrototype.__templeLightweightFan){
 nativeSaberPrototype._updateDeterministicParticles=function(){}; // no debris or smoke matrix uploads
 nativeSaberPrototype.__templeLightweightFan=true;
}
function lightweightNativeSaber(options){
 const fx=energySwordWave(options); // exact original signed vendor source
 fx.group.traverse(node=>{
  if(node.isInstancedMesh){node.count=0;node.visible=false;}
  if(node.isLight)node.visible=false; // avoid five extra live point lights
 });
 fx.group.userData.saberPerfMode='native-crescents-only';
 return fx;
}
const FACTORIES={
 'arc-ray':arcRay,'energy-vortex':energyVortex,'frost-wheel':frostWheel,
 'tidal-surge':tidalSurge,'energy-sword-wave':lightweightNativeSaber,'revival-bloom':revivalBloom,
 'dimensional-rend':dimensionalRend,'black-hole':blackHole,
 'darkchain-detonation':darkchain,'rolling-fireburst':rollingFireburst,
 'ice-lance-study':iceLance,'anime-flame-shield':animeFlame,'radiant-beam':radiantBeam,
  'charged-beam':chargedBeam,
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
 'arc-ray':'#2878ff','tidal-surge':'#66cddd','revival-bloom':'#ff1493',
 'anime-flame-shield':'#ff761f','ice-lance-study':'#d4e8ed',
 'energy-vortex':'#66d7ff','radiant-beam':'#b874ff','charged-beam':'#f6c76c'
});
// Scale the ORIGINAL authored effect, rather than replacing its artwork.
// #68 and #48 retain their pre-change vendor size and apply the exact same
// post-quality reduction as their server-owned circle: 50% pan, 80% whip (a further 50% reduction).
export function ultimateWorldScale(number,event,options={}){
 if(!event?.ultimate||event.channel)return null;
 const radius=Math.max(.1,Number(event.area?.radius)||Number(event.radius)||.1);
 if(number===68)return .5*Math.max(7.5,(radius/.5)/Math.max(.2,Number(options.size)||1));
 if(number===26)return Math.max(2*(Number(options.quality)||1),Math.min(12,radius/2));
 // The widened whip warning must not enlarge the original #48 animation.
 if(number===48)return .2*Math.max(2,Math.min(12,(radius/1.5/.2)/Math.max(.25,(Number(options.size)||1)*.8)));
 if(number===53){
   // Native radius ~4.5 local metres: match the warning exactly instead
   // of halving it with the previous /9 world-scale correction.
   const nativeSize=Math.min(2,Math.max(.2,Number(options.size)||1));
   return Math.max(.08,radius/(4.5*nativeSize));
  }
 return null; // directional originals already follow the server-approved ray
}
export function requestedEffect(item,event){
 if(!item||!event)return null;
 // Preserve signature ultimates for other exotic weapons.
 if(item.exotic&&!['clam','jellybrella'].includes(item.id))return null;
 const key=event.channel?(item.id==='clam'?'clam':item.family)+':channel':
  event.ultimate?(item.id==='clam'?'clam':item.id==='jellybrella'?'jellybrella':item.family)+':ultimate':
  item.family==='saber'&&Number(event.combo)===5?'saber:combo':'';
 return REQUESTED_VFX[key]||null;
}

// #47 is the official dimensional-rend export. Its transmission panels cause
// an additional full-scene GPU sampling pass and can stall WebGL when stacked.
// Preserve the authored slash mesh, glow and particles with fewer slashes and
// disable only the costly refraction panels. Prewarm exactly these settings.
export function budgetedNativeOptions(spec,options){
 if(spec.number!==47)return options;
 return {...options,size:Math.min(1.7,Number(options.size)||1.2),
  quantity:8,density:.18,detail:.7,panelCount:0,spread:1.5};
}
export class NumberedWeaponEffects {
 constructor(scene,muzzle=()=>null) {
  this.scene=scene;
  this.muzzle=muzzle;
  this.active=[];this.prewarmed=new Map();
  }
 acquire(spec,options){
  const pool=this.prewarmed.get(spec.asset),cached=pool?.pop();
  options=budgetedNativeOptions(spec,options);
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
  if(pool.length<(spec.number===47?1:4))pool.push(fx);else fx.dispose();
 }
 create(spec,options) {
  const factory=FACTORIES[spec.asset];
  if(!factory)throw Error('Missing exact 00GameDevs factory #'+spec.number);
  const fx=factory(budgetedNativeOptions(spec,options));
  if(!fx?.group?.isObject3D||typeof fx.update!=='function'||typeof fx.dispose!=='function')
   throw Error('Invalid original 00GameDevs VFX #'+spec.number);
  fx.group.name=!spec.number?'00GameDevs original VFX '+spec.asset:spec.asset==='charged-beam'?'00GameDevs original VFX charged-beam':'00GameDevs original VFX #'+String(spec.number).padStart(2,'0')+' '+spec.asset;
  fx.group.userData.vfxSource='00GameDevs';
  fx.group.userData.vfxId=spec.asset;
  fx.group.userData.vfxNumber=spec.number;
  if(spec.number===8||spec.number===29)installNativeCurve(fx);
  if(spec.number===73) {
   // Official #73 ships two neutral demo collision props as part of its
   // source. Retain the official VFX code and conceal only the unnecessary
   // sphere/cube layers and their surface heat/soot overlays.
   fx.setLayerVisible(4,false);
   fx.setLayerVisible(5,false);
   fx.setLayerVisible(14,false);
  }
  if(spec.number===73){
   // Opacity is shader-authored, so material.opacity alone has no effect.
   // Reduce ALL visible flame pass alpha to exactly 60% without modifying the
   // signed source module, its geometry, timing, or gameplay collision.
   fx.group.traverse(node=>{
    const layer=node.userData?.animeFlameLayer;
    if(layer===undefined||[4,5,14].includes(layer))return;
    const m=node.material;
    if(!m?.isShaderMaterial||m.userData.templeFireOpacity)return;
    if(!m.fragmentShader.includes('gl_FragColor'))return;
    m.fragmentShader=m.fragmentShader.replace(/}\s*$/, '  gl_FragColor.a *= 0.6;\n}');
    m.transparent=true;m.depthWrite=false;m.needsUpdate=true;
    m.userData.templeFireOpacity=.6;
   });
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
    // Reserve simultaneous native pan/whip bursts and their GPU buffers up
    // front; no geometric or particle simplification occurs at cast time.
    const copiesByNumber={33:4,20:2,43:2,70:2,68:3,48:3};
    let warmed=0;
    const target=new THREE.WebGLRenderTarget(32,32,{depthBuffer:true});
    const view=camera.clone();view.position.set(10,8,16);view.lookAt(0,1,0);
    const previousTarget=renderer.getRenderTarget();
    try{for(const spec of unique.values()){
      const copies=copiesByNumber[spec.number]||1;
      for(let i=0;i<copies;i++){
        let fx=null;
        try{
          fx=this.create(spec,{size:1,detail:1,density:.5});
          const stage=new THREE.Scene();stage.add(fx.group);fx.group.visible=true;
          fx.update(spec.number===47?.68:.016);
          await renderer.compileAsync(stage,view);
          // Force one real GPU draw while the loading overlay is visible;
          // shader compilation alone does not upload first-use buffers.
          renderer.setRenderTarget(target);
          try{
           // Exercise native #70/#73 full-screen postprocess passes too;
           // the first cast must not allocate or compile them in combat.
           // Avoid unsupported nested vendor full-screen render targets.
           renderer.render(stage,view);
          }finally{renderer.setRenderTarget(previousTarget);}
          this.recycle(spec,fx);fx=null;warmed++;
        }catch(error){
          if(fx){fx.group.removeFromParent();fx.dispose();}
          console.warn('Cannot prewarm 00GameDevs #'+spec.number,error);
          break;
        }
      }
    }
    }finally{renderer.setRenderTarget(previousTarget);target.dispose();}
    return warmed;
  }
  play(event,item,root) {
  const spec=requestedEffect(item,event);
  if(!spec)return false;
  const key=event.channel&&root?root.uuid+':'+spec.number+':'+(event.fusionEcho?'fusion'+(event.fusionSlot||0):'main'):null;
  const live=key?this.active.find(e=>e.key===key):null;
  const direction=vector(event.direction,FORWARD).normalize();
  if(live) {
   live.direction.copy(direction);
   live.range=Math.max(.5,Number(event.range)||live.range);
   live.heading=root?.rotation.y||0;
   live.lastPulse=performance.now();
   if(event.persistentAttackId)live.attackId=event.persistentAttackId;
   if(event.owner)live.owner=event.owner;
   if(!live.waves&&!live.cycles)this.align(live);
   return true;
  }
  const quality=Math.max(.25,Math.min(4,Number(event.qualityScale)||1));
  const normalSize=(spec.number===26?84:spec.number===38?2:spec.number===48?2:1.2)*quality;
  // The Ice Lance / erupting pillar #70 must be exactly half the previous
  // display dimensions, irrespective of rarity/fusion quality.
  let size=spec.number===70?normalSize*.5*(event.ultimate?1.5:1):normalSize;
  // The nozzle and authored free flame have a 10-local-metre reach.
  // Scale its world container to the server's range, not its actual props.
  if(spec.number===73||spec.asset==='energy-sword-wave')size=1;
  if(spec.number===31)size=Math.max(.25,Math.min(3.5,quality));
  if(event.ultimate&&!event.channel&&Number.isFinite(event.area?.radius)&&![26,29,31,38,70].includes(spec.number)){
   // Reconstruct the old vendor size first. Applying only the matching
   // outer world scale ensures identical proportional shrink at all tiers.
   const cosmeticRadius=spec.number===48?event.area.radius/1.5:event.area.radius;
   const originalRadius=cosmeticRadius/(spec.number===68?.5:spec.number===48?.2:1);
   size=Math.max(.25,Math.min(3.5,originalRadius/4.5));
  }
  const options={size,quality,detail:event.fusionEcho?.55:1,density:event.fusionEcho?.3:.5,speed:spec.number===70?2:spec.number===33?.78:1,color:channelColors[spec.asset]||undefined,
    ...(spec.asset==='energy-sword-wave'?{theme:'solar',quantity:SABER_WAVE_COUNT,spread:SABER_WAVE_FAN_ANGLE_DEG/60,speed:1}: {})};
  if(!options.color)delete options.color;
  if(spec.number===47)for(const old of [...this.active])if(old.spec.number===47)this.remove(old);
  const fx=this.acquire(spec,options);
  // Sword fans use GPU-driven native yellow blades with ALL heavy CPU
  // debris pools suppressed at factory construction, including warmup.
  const origin=vector(event.origin,new THREE.Vector3(0,1,0));
  // The official charged-beam ray starts at the weapon muzzle, not
  // at an unrelated remote ground-circle centre.
  // Sword cracks begin from the hand, not a distant ground-target position.
  const areaLocked=!!event.ultimate&&!event.channel&&spec.asset!=='energy-sword-wave'&&![20,29,31,33,38,43].includes(spec.number)&&Array.isArray(event.area?.visualCenter);
  const target=areaLocked?vector(event.area.visualCenter,origin):origin.clone();
  const entry={
   spec,fx,group:fx.group,root,item,direction,visualDirection:direction.clone(),origin,target,options,
   curveBend:0,visualEnd:null,attackId:event.persistentAttackId||null,
   owner:event.owner||null,lockedPoint:null,
   worldScale:ultimateWorldScale(spec.number,event,options),
   range:Math.max(.5,Number(event.range)||12),
   key,channel:!!event.channel,fusionEcho:!!event.fusionEcho,areaLocked,age:0,
   duration:event.channel?Infinity:(spec.asset==='energy-sword-wave'?1.55:spec.number===31?2.5:spec.number===20?4.5:spec.number===33?3.3:spec.number===43?2.25:spec.number===48?6.5:spec.number===53?7:5),
   lastPulse:performance.now(),stopping:false,
   heading:root?.rotation.y||0,
   // These original assets are one-shot. Each next copy begins before the
   // previous fades: no reset-to-zero flash, no pause between server pulses.
   cycleTimer:0,cycles:null,waves:null,waveTimer:0,
   singleTravel:!event.channel&&TRAVELLING_NATIVE.has(spec.number)
  };
  this.active.push(entry);
  if(this.active.length>14)this.remove(this.active.find(e=>!e.channel)||this.active[0]);
  this.align(entry);
  // #08 Arc Ray and #29 Charged Beam both contain a SECOND native startup
  // charge (0.4s / 1.6s) before any full-length ray is drawn. GGTEMPLE has
  // already held A until the authoritative staff charge reached 100%; running
  // the vendor's charge again leaves only muzzle sparks visible, especially on
  // slow mobile GPU frames. Advance the ORIGINAL vendor animation to its
  // active phase ONCE when its validated channel starts. Keep its geometry,
  // shader, endpoint logic and all subsequent updates untouched.
  if(entry.channel&&(spec.number===8||spec.number===29)&&fx.phase==='starting'){
   const nativeStart=Math.max(0,Number(fx.lifecycle?.start)||0);
   fx.update(nativeStart+1/60);
  }
  // A sustained conch vortex must reach steady state ONCE; restarting its
  // 1.1-second reveal for each damage pulse caused repeated visible flashes.
  if(entry.channel&&spec.number===20)fx.update((fx.lifecycle?.start||1.1)+.02);
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
  }else if(key&&spec.number!==20&&CYCLE_INTERVAL[spec.number]) {
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
  let dir=(entry.channel?entry.visualDirection:entry.direction).clone().normalize();
  // Steer natively without quantisation to the character's walk rotation.
  const origin=this.muzzleAt(entry);
  if((spec.number===8||spec.number===29)&&typeof fx.setEndpoints==='function'){
   fx.group.position.set(0,0,0);
   fx.group.quaternion.identity();
   const targeted=entry.channel&&!entry.fusionEcho&&entry.root?.userData?.staffTargetPoint;
   // The single native prism beam ends on the Worker-selected living target.
   // It follows off-axis enemies, not four independent XY cardinal arcs.
   const end=entry.item?.family==='beam'&&entry.lockedPoint?
    entry.lockedPoint.clone():
    (targeted&&targetOnBeam(origin,dir,range,[targeted],1.6))||
    origin.clone().addScaledVector(dir,range);
   fx.setEndpoints(origin,end);
   entry.visualEnd=end.clone();
   // Modulate the ACTUAL original vertex shader, not a separate imitation
   // laser. Zero curvature at both physical endpoints, peak left/right at
   // the midpoint according to the player's lateral movement.
   updateNativeCurve(fx,origin,end,entry.curveBend||0,this.camera,entry.item?.family==='beam'?'s':'bow');
   if(spec.number===8&&entry.item?.family==='lightning'){fx.group.scale.y=2.4;fx.group.scale.z=2.4;}
   if(spec.number===29&&entry.item?.id?.startsWith('prism-')){fx.group.scale.y=5;fx.group.scale.z=5;}
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
  if(spec.asset==='energy-sword-wave'){
   // The unchanged 00GameDevs geometry emits five solar-yellow crescents on XZ,
   // facing +Z in a symmetrical 60-degree spread. Match actual server range.
   const forward=dir.clone().setY(0);
   if(forward.lengthSq()<.001)forward.set(0,0,1);
   forward.normalize();
   fx.group.position.y=Math.max(.12,origin.y-1.16);
   fx.group.quaternion.setFromUnitVectors(FORWARD,forward);
   fx.group.scale.setScalar(range/17.5);
   return;
  }
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
  return (entry.channel?entry.visualDirection:entry.direction).clone().normalize();
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
    if(entry.channel){
     copy.direction.lerp(entry.visualDirection,1-Math.exp(-dt*18)).normalize();
     copy.fx.group.quaternion.setFromUnitVectors(
      number===70?X_FORWARD:FORWARD,copy.direction);
    }
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
  // Two pooled sub-effect instances per borrowed channel cap draw calls and
   // GPU allocations without suppressing either of the two fusion layers.
   while(entry.cycles.length>(entry.fusionEcho?2:moving?4:3))this.discardCycle(entry,entry.cycles[0]);
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
 update(dt,camera=null,world=null){
  if(camera)this.camera=camera;
  const now=performance.now();
  for(const e of [...this.active]){
   try{
   e.age+=dt;
   if(e.channel){
    const prism=e.item?.family==='beam'&&e.spec.number===29&&!e.fusionEcho;
    const locked=prism&&e.owner?world?.prismLocks?.[e.owner]:null;
    e.lockedPoint=locked&&Array.isArray(locked.position)&&locked.position.length===3&&
      locked.position.every(Number.isFinite)?new THREE.Vector3(...locked.position):null;
    const ray=e.root?.userData?.staffAimDirection;
    const aim=Array.isArray(ray)&&ray.length===3&&ray.every(Number.isFinite)&&!e.fusionEcho?
     new THREE.Vector3(...ray).normalize():e.direction;
    const source=this.muzzleAt(e);
    const target=e.lockedPoint?e.lockedPoint.clone().sub(source).normalize():aim;
    e.visualDirection.lerp(target,1-Math.exp(-dt*28)).normalize();
    if(e.spec.number===8||e.spec.number===29){
     const strafe=Number(e.root?.userData?.staffStrafe)||0;
     // Guided native shader: maintain a smooth curve while the lock persists.
     const bend=prism?(e.lockedPoint?.62:0):(e.fusionEcho?0:THREE.MathUtils.clamp(strafe,-1,1));
     e.curveBend=THREE.MathUtils.damp(e.curveBend||0,bend,11,dt);
    }
   }
   // Keep a server-confirmed continuous channel visible while its caster
   // still holds the same staff. Slow WebGL frames and packet jitter must
   // never erase an already active beam between authoritative hit pulses.
   // This extends visuals only; combat/damage remains server-authoritative.
   const casterHoldingChannel=e.channel&&e.root?.userData?.staffCasting===true&&
    e.root?.userData?.equipment?.weapon===e.item?.id;
   if(e.key&&!casterHoldingChannel&&
      now-e.lastPulse>Math.max(CHANNEL_GRACE_MS,Number(e.item.cooldown||700)*2+650)){
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
   if(e.cycles){
    this.updateNativeCycles(e,dt);
    if(e.spec.number===20&&e.attackId){
     const synced=world?.vortexes?.find(v=>v.id===e.attackId);
     if(synced?.position)for(const copy of e.cycles)
      copy.fx.group.position.lerp(new THREE.Vector3(...synced.position),Math.min(1,dt*18));
    }
    continue;
   }

   if(e.channel&&e.spec.number===20){
    // The native vortex is an indefinitely active non-burst effect. One
    // instance follows the authoritative projectile until key release;
    // repeated pulses must NEVER recycle / reconstruct its shader or phase.
    const synced=e.attackId?world?.vortexes?.find(v=>v.id===e.attackId):null;
    const destination=synced?.position?
     new THREE.Vector3(...synced.position):
     e.origin.clone().addScaledVector(e.visualDirection,
      e.range*Math.min(1,e.age/travelLifetime(20)));
    e.fx.group.position.lerp(destination,Math.min(1,dt*14));
    e.fx.group.quaternion.setFromUnitVectors(FORWARD,e.visualDirection);
    e.fx.update(dt);
    continue;
   }
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
   e.fx.update(dt); // native yellow blades now animate smoothly without CPU particle loops
   if(e.spec.number===20&&e.attackId){
    const synced=world?.vortexes?.find(v=>v.id===e.attackId);
    if(synced?.position)e.fx.group.position.lerp(new THREE.Vector3(...synced.position),Math.min(1,dt*18));
   }
   if(e.spec.number===8&&e.item?.family==='lightning'){e.fx.group.scale.y=2.4;e.fx.group.scale.z=2.4;}
   if(e.spec.number===29&&e.item?.id?.startsWith('prism-')){e.fx.group.scale.y=5;e.fx.group.scale.z=5;}
   if(e.worldScale!=null)e.fx.group.scale.setScalar(e.worldScale);
   if((!e.key&&e.fx.finished)||e.age>=e.duration){
    this.remove(e);continue;
   }
   // Continuous originals (#08, charged-beam, #20, #73) sustain without being reset
   // by individual server pulses. There is no animation reset on impact.
   if(e.key&&e.fx.finished)e.fx.reset();
   }catch(error){
    // A bad native effect must not stop the entire gameplay frame.
    this.remove(e);this.failedEffects??=new Set();
    if(!this.failedEffects.has(e.spec.asset)){
     this.failedEffects.add(e.spec.asset);
     console.error('00GameDevs VFX update failure',e.spec.asset,error);
    }
   }
  }
 }
 hasFullScreenPostprocess(){
  return this.active.some(e=>(e.spec.number===70||e.spec.number===73)&&typeof e.fx.render==='function');
 }
 render(renderer,world,camera){
  const post=this.active.find(e=>e.spec.number===73&&typeof e.fx.render==='function')||
   this.active.find(e=>e.spec.number===70&&typeof e.fx.render==='function');
  // VHS always renders into an offscreen framebuffer. The vendor's #70/#73
  // custom pass resets that framebuffer and has caused browser stalls.
  if(post&&typeof renderer.getRenderTarget==='function'&&renderer.getRenderTarget()===null)
   post.fx.render(renderer,world,camera);
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
