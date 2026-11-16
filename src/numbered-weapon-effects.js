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
import animeFlame from '../vendor/00gamedevs/source/anime-flame-shield.js';

export const REQUESTED_VFX=Object.freeze({
 'clam:channel':{number:33,asset:'tidal-surge',original:true},
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
 'ice-lance-study':iceLance,'anime-flame-shield':animeFlame
};
const UP=new THREE.Vector3(0,1,0);
const FORWARD=new THREE.Vector3(0,0,1);
const vector=(value,fallback)=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)?
 new THREE.Vector3(...value):fallback.clone();
const channelColors=Object.freeze({
 'arc-ray':'#2878ff','tidal-surge':'#66cddd','revival-bloom':'#ff8fbd',
 'anime-flame-shield':'#ff761f','ice-lance-study':'#d4e8ed',
 'energy-vortex':'#66d7ff'
});
export function requestedEffect(item,event){
 if(!item||!event)return null;
 // Preserve signature ultimates for other exotic weapons.
 if(item.exotic&&!['clam','jellybrella'].includes(item.id))return null;
 const key=event.channel?(item.id==='clam'?'clam':item.family)+':channel':
  event.ultimate?(item.id==='jellybrella'?'jellybrella':item.family)+':ultimate':
  item.family==='saber'&&(Number(event.qualityTier)||Number(item.tier))===4&&
   Number(event.combo)===5?'saber:combo':'';
 return REQUESTED_VFX[key]||null;
}

export class NumberedWeaponEffects{
 constructor(scene,muzzle=()=>null){
  this.scene=scene;this.muzzle=muzzle;this.active=[];
 }
 play(event,item,root){
  const spec=requestedEffect(item,event);
  if(!spec)return false;
  const factory=FACTORIES[spec.asset];
  if(!factory)throw Error('Missing exact 00GameDevs factory #'+spec.number);
  const key=event.channel&&root?root.uuid+':'+spec.number:null;
  const live=key?this.active.find(e=>e.key===key):null;
  const direction=vector(event.direction,FORWARD).normalize();
  if(live){
   // Re-aim a continuous original without restarting its entire shader.
   live.direction.copy(direction);
   live.range=Math.max(.5,Number(event.range)||live.range);
   live.lastPulse=performance.now();
   this.align(live);
   if(live.fx.finished)live.fx.reset();
   return true;
  }
  const scale=Math.max(.5,Math.min(2.5,Number(event.qualityScale)||1));
  const size=(spec.number===26?4.2:spec.number===38?2:spec.number===48?2:1.2)*scale;
  const options={size,speed:1,color:channelColors[spec.asset]||undefined};
  if(options.color===undefined)delete options.color;
  // Exactly the original function from the MIT module; no custom stand-ins.
  const fx=factory(options);
  if(!fx?.group?.isObject3D||typeof fx.update!=='function'||typeof fx.dispose!=='function')
   throw Error('Invalid official VFX scene object #'+spec.number);
  fx.group.name='00GameDevs original VFX #'+String(spec.number).padStart(2,'0')+' '+spec.asset;
  fx.group.userData.vfxSource='00GameDevs';
  fx.group.userData.vfxId=spec.asset;
  fx.group.userData.vfxNumber=spec.number;
  this.scene.add(fx.group);
  const origin=vector(event.origin,new THREE.Vector3(0,1,0));
  // Server-owned area visualCenter is the exact same world-space ground
  // anchor drawn by ChargeTargetPreview. Never replace it with a hit point.
  const target=event.ultimate&&Array.isArray(event.area?.visualCenter)?
   vector(event.area.visualCenter,origin):origin.clone();
  const entry={spec,fx,group:fx.group,root,item,direction,origin,target,
   range:Math.max(.5,Number(event.range)||12),key,channel:!!event.channel,
   areaLocked:!!event.ultimate&&Array.isArray(event.area?.visualCenter),
   age:0,duration:event.channel?Infinity:(spec.number===48?6.5:spec.number===53?7:5),
   lastPulse:performance.now(),stopping:false};
  this.active.push(entry);
  if(this.active.length>24)this.remove(this.active[0]);
  this.align(entry);
  // A finished cast cannot apply gameplay damage: only the server does that.
  return true;
 }
 align(entry){
  const {fx,spec,direction,range}=entry;
  let origin=entry.areaLocked?entry.target:entry.origin;
  if(entry.channel&&entry.root){
   const muzzle=this.muzzle(entry.root,entry.item,entry.origin.clone());
   if(muzzle?.isVector3)origin=muzzle;
  }
  if(typeof fx.setEndpoints==='function'&&spec.number===8){
   // The original lightning API expects WORLD coordinates with a root at 0.
   fx.group.position.set(0,0,0);
   fx.group.quaternion.identity();
   fx.setEndpoints(origin,origin.clone().addScaledVector(direction,range));
  }else{
   fx.group.position.copy(origin);
   if(entry.areaLocked){
    // Ground-space originals stand upright; only rotate their horizontal yaw.
    fx.group.quaternion.setFromAxisAngle(UP,Math.atan2(direction.x,direction.z));
   }else{
    fx.group.quaternion.setFromUnitVectors(FORWARD,direction);
   }
   if(typeof fx.setDirection==='function')fx.setDirection(direction,0);
   if(typeof fx.setAim==='function'){
    // Anime Flame Flow's documented API requires a world-space target.
    fx.group.updateWorldMatrix(true,false);
    fx.setAim(origin.clone().addScaledVector(direction,Math.min(range,10)));
   }
  }
 }
 update(dt){
  const now=performance.now();
  for(const e of [...this.active]){
   e.age+=dt;
   if(e.key&&now-e.lastPulse>Math.max(1350,Number(e.item.cooldown||700)+480)){
    this.remove(e);continue;
   }
   this.align(e);
   if(!e.key&&e.age>3&&!e.stopping&&typeof e.fx.stop==='function'){
    e.stopping=true;e.fx.stop();
   }
   e.fx.update(dt);
   if((!e.key&&e.fx.finished)||e.age>=e.duration){this.remove(e);continue;}
   if(e.key&&e.fx.finished)e.fx.reset();
  }
 }
 stop(root){for(const e of [...this.active])if(e.channel&&e.root===root)this.remove(e);}
 remove(e){
  const index=this.active.indexOf(e);if(index<0)return;
  this.active.splice(index,1);
  e.fx.group.removeFromParent();
  e.fx.dispose();
 }
 dispose(){for(const entry of [...this.active])this.remove(entry);}
}
