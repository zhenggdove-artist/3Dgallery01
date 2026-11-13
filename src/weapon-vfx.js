import * as THREE from 'three';
import {weaponMuzzle} from './weapon-muzzle.js';
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
 water:['plasma-bolt','tidal-surge'],ice:['ice-shard','ice-shatter'],fire:['flame-surge','burning-ground'],lightning:['arc-ray','energy-burst'],beam:['pulse-beam','charged-beam'],petal:['arcane-missile','thorn-crown'],wave:['tidal-surge','spiral-gale'],
 saber:['azure-sweep','azure-sweep'],whip:['azure-sweep','arc-ray'],swatter:['azure-sweep','spiral-gale'],pan:['shockwave','energy-burst'],planter:['thorn-crown','thorn-crown'],palm:['shockwave','astral-convergence'],
 'white-cat':['plasma-bolt','pulse-beam'],'black-cat':['pulse-beam','charged-beam'],'calico-cat':['plasma-bolt','energy-burst'],giraffe:['azure-sweep','arc-ray'],goldfish:['tidal-surge','tidal-surge'],clam:['shockwave','ice-shatter'],accordion:['shockwave','spiral-gale'],fan:['azure-sweep','spiral-gale'],telephone:['arc-ray','energy-burst'],jellybrella:['arcane-missile','magic-barrier'],'chiang-token':['arcane-missile','astral-convergence']
});
export function effectFor(item,ultimate=false){const pair=WEAPON_VFX[item.id]||WEAPON_VFX[item.family];if(!pair)throw Error('Unmapped weapon: '+item.id);return pair[ultimate?1:0];}
export class WeaponVFX{
 constructor(scene){this.scene=scene;this.active=[];this.pools=new Map();this.charger=null;this.created=0;this.replayed=0;}
 create(id){this.created++;const fx=factories[id]();fx.group.userData.vfxSource='00GameDevs';fx.group.userData.vfxId=id;return fx;}
 async warm(renderer,camera){
  const warmScene=new THREE.Scene(),fxs=[];
  for(const id of Object.keys(factories)){const fx=this.create(id);fx.update(.18);warmScene.add(fx.group);fxs.push([id,fx]);}
  await renderer.compileAsync(warmScene,camera);
  for(const [id,fx]of fxs){fx.group.removeFromParent();fx.reset();fx.group.visible=false;this.pools.set(id,[fx]);}
  return {source:'00GameDevs',effects:fxs.length};
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
 play(data,item,root){
  const id=effectFor(item,data.ultimate),direction=new THREE.Vector3(...(data.direction||[0,0,1])).normalize(),origin=new THREE.Vector3(...data.origin),range=Math.max(1,data.range||4),end=data.impactPoint?new THREE.Vector3(...data.impactPoint):origin.clone().addScaledVector(direction,range);
  const muzzle=weaponMuzzle(root,item);if(muzzle){origin.copy(muzzle);direction.copy(end).sub(origin).normalize();}
  const entry=this.acquire(id,{color:item.color,size:data.ultimate?1:.5,speed:data.ultimate?1:1.8}),fx=entry.fx;
  fx.group.position.copy(origin);fx.group.rotation.y=Math.atan2(direction.x,direction.z)-Math.PI/2;
  if(beams.has(id)){fx.group.position.set(0,0,0);fx.group.quaternion.identity();fx.setEndpoints(origin,end);fx.update(fx.lifecycle.start||0);entry.stopAt=data.ultimate?.65:.12;}
  else if(projectiles.has(id)){fx.setDirection(direction,0);fx.update(fx.lifecycle.start||0);entry.start=origin;entry.end=end;entry.travel=Math.min(.45,Math.max(.12,origin.distanceTo(end)/45));entry.stopAt=entry.travel;entry.hit=!!data.impactPoint;}
  else {fx.group.position.y=item.firstPerson?origin.y:Math.max(0,origin.y-1)+.06;if(id==='azure-sweep')fx.group.position.y=origin.y-.1;if(continuous.has(id))fx.update(fx.lifecycle.start||0);entry.stopAt=data.ultimate?1.1:.35;}
  if(root?.userData.blade&&!beams.has(id)&&!projectiles.has(id)){
   let trail=this.active.find(e=>e.id==='weapon-smear'&&e.weapon===root.userData.blade&&!e.stopped);
   if(!trail){trail=this.acquire('weapon-smear',{color:item.color,size:.8});trail.fx.attachWeapon(root.userData.blade,{base:[0,0,0],tip:[0,1.1,0]});trail.weapon=root.userData.blade;}
   trail.stopAt=trail.age+(root.userData.attack?.duration||.5);
  }
  for(const effect of (data.fusionEffects||[]).slice(0,2)){const family=typeof effect==='string'?effect:effect.family||effect.type,id2=WEAPON_VFX[family]?.[1]||'energy-burst',echo=this.acquire(id2,{size:.35,color:item.color});echo.fx.group.position.copy(end);echo.fx.group.position.y=Math.max(.06,origin.y-1);echo.stopAt=.35;}
  if(data.impactPoint&&!projectiles.has(id)){const impact=this.acquire(item.family==='ice'?'ice-shatter':'energy-burst',{size:.3,color:item.color,speed:2});impact.fx.group.position.copy(end);}
 }
 charging(root,progress,item){
  if(!root||!item||progress<=.06){if(this.charger){this.charger.fx.stop();this.charger.stopped=true;this.charger=null;}return;}
  if(!this.charger){this.charger=this.acquire('arcane-missile',{color:item.color,size:.3});this.charger.fx.setDirection(new THREE.Vector3(0,1,0),0);}
  const e=this.charger;e.fx.group.position.copy(root.position);e.fx.group.position.y+=1;e.fx.group.scale.setScalar(.5+progress*.5);
 }
 update(dt){for(const e of [...this.active]){e.age+=dt;if(e.weapon)e.weapon.updateWorldMatrix(true,false);
   if(e.start&&!e.stopped)e.fx.group.position.lerpVectors(e.start,e.end,Math.min(1,e.age/e.travel));
   if(!e.stopped&&e.age>=e.stopAt){if(e.hit)e.fx.hit(e.end);else if(continuous.has(e.id)||e.id==='weapon-smear')e.fx.stop();e.stopped=true;}
   e.fx.update(dt);if(e.fx.finished||e.age>12)this.release(e);
  }}
 dispose(){for(const e of [...this.active]){e.fx.dispose();e.fx.group.removeFromParent();}this.active=[];for(const pool of this.pools.values())for(const fx of pool)fx.dispose();this.pools.clear();}
}
