import {manageNativeEffect} from './shared-render-resources.js';
import * as THREE from 'three';
import {PALM_STORM_DURATION_MS} from './shared/combat-balance.js';
// Unmodified MIT-licensed 00GameDevs source modules. Do not substitute a drawn
// approximation: the shader geometry, chain links, cracks and lightning are
// all authored in these two official exports.
import lightningFireTornado from '../vendor/00gamedevs/source/lightning-fire-tornado.js';
import goldenChainRain from '../vendor/00gamedevs/source/golden-chain-rain.js';

const SOURCES=Object.freeze({
 palm:{id:'lightning-fire-tornado',name:'Green lightning-fire tornado',factory:lightningFireTornado,
  color:'#42ff78',speed:2.5,duration:15,density:1},
 planter:{id:'golden-chain-rain',name:'Three waves of eight green falling chains',factory:goldenChainRain,
  color:'#62ff79',speed:1.6,duration:7.5,density:.5}
});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

function makeNative(kind){
 const definition=SOURCES[kind];
 const fx=definition.factory({
  color:definition.color,size:1,density:definition.density,
  speed:definition.speed,detail:1,
  ...(kind==='planter'?{quantity:8,spread:1,spriteChains:true}: {})
 });
 if(!fx?.group?.isObject3D||typeof fx.update!=='function'||typeof fx.dispose!=='function')
  throw Error('Invalid official botanical scene-object: '+definition.id);
 manageNativeEffect(fx);
 const group=new THREE.Group();
 group.name=definition.name;
 group.userData.vfxSource='00GameDevs';
 group.userData.vfxId=definition.id;
 fx.group.userData.vfxSource='00GameDevs';
 fx.group.userData.vfxId=definition.id;
 group.add(fx.group);
 return {kind,fx,group,age:0,duration:kind==='palm'?PALM_STORM_DURATION_MS/1000:definition.duration/definition.speed+.15};
}

export class PlantUltimateEffects{
 constructor(scene){
  this.scene=scene;
  this.active=[];
  this.pools={palm:[],planter:[]};
  this.limit=6;
 }
 create(kind){return makeNative(kind);}
 async warm(renderer,camera){
  const stage=new THREE.Scene(),entries=[];
  const view=camera.clone();
  view.position.set(12,11,18);view.lookAt(0,3,0);
  const target=new THREE.WebGLRenderTarget(32,32,{depthBuffer:true});
  const previous=renderer.getRenderTarget();
  try{
   // Keep one genuine compiled GPU instance of each large effect for the
   // first cast. Exercise non-zero stages, then reset before storing.
   for(const kind of ['palm','planter']){
    const entry=this.create(kind);
    entry.group.position.x=kind==='palm'?-5:5;
    if(kind==='palm'&&typeof entry.fx.seek==='function')entry.fx.seek(2.4);
    else entry.fx.update(.5);
    stage.add(entry.group);entries.push(entry);
   }
   await renderer.compileAsync(stage,view);
   renderer.setRenderTarget(target);
   renderer.render(stage,view);
  }finally{
   renderer.setRenderTarget(previous);target.dispose();
   for(const entry of entries){
    entry.group.removeFromParent();
    entry.fx.reset?.();
    entry.fx.group.visible=false;
    entry.idleSince=performance.now();this.pools[entry.kind].push(entry);
   }
  }
 }
 play(event,item){
  if(!event?.ultimate||item?.exotic||!SOURCES[item?.family])return false;
  const kind=item.family,pool=this.pools[kind];
  if(this.active.length>=this.limit)this.recycle(this.active[0]);
  const entry=pool.pop()||this.create(kind),definition=SOURCES[kind];
  entry.fx.setOptions?.({
   color:definition.color,size:1,density:definition.density,
   speed:definition.speed,detail:1,
   ...(kind==='planter'?{quantity:8,spread:1,spriteChains:true}:{})
  });
  entry.fx.reset?.();
  entry.fx.group.visible=true;
  entry.age=0;entry.duration=kind==='palm'?PALM_STORM_DURATION_MS/1000:definition.duration/definition.speed+.15;
  const origin=Array.isArray(event.origin)?event.origin:[0,1,0];
  const direction=Array.isArray(event.direction)?event.direction:[0,0,1];
  const range=Math.max(1,Number(event.range)||12);
  const center=event.area?.visualCenter||event.area?.center||event.impactPoint||
    [origin[0]+direction[0]*range*.65,0,origin[2]+direction[2]*range*.65];
  entry.group.position.set(Number(center[0])||0,Math.max(.08,Number(center[1])||0),Number(center[2])||0);
  // Server-owned impact radius determines visual world scale. The original
  // tornado's ground ring is 8.6m across (4.3m radius), so fit it exactly
  // to the warning circle without the old 3.5x scale cap. Planter is unchanged.
  const radius=Math.max(.1,Number(event.area?.radius)||Number(event.radius)||4);
  const scale=kind==='palm'?radius/4.3:clamp(radius/4,.35,3.5);
  entry.group.scale.setScalar(scale);
  entry.group.rotation.set(0,0,0);
  this.scene.add(entry.group);this.active.push(entry);
  return true;
 }
 recycle(entry){
  const idx=this.active.indexOf(entry);if(idx<0)return;this.active.splice(idx,1);
  entry.group.removeFromParent();entry.fx.group.visible=false;
  entry.fx.reset?.();
  const pool=this.pools[entry.kind];
  if(pool.length<1){entry.idleSince=performance.now();pool.push(entry);}else entry.fx.dispose();
 }
 update(dt){
  const delta=Number.isFinite(dt)?clamp(dt,0,.12):0;
  for(const entry of [...this.active]){
   try{
    entry.age+=delta;entry.fx.update(delta);
    if(entry.age>=entry.duration||entry.fx.finished===true)this.recycle(entry);
   }catch(error){
    console.warn('Official botanical VFX playback failed',entry.kind,error);
    this.recycle(entry);
   }
  }
 }
 idlePoolGroups(){return Object.values(this.pools).map(list=>({kind:'plantVfx',list,keep:1,idleMs:60000,root:e=>e.group,since:e=>e.idleSince,dispose:e=>e.fx.dispose()}));}
 dispose(){
  for(const entry of [...this.active]){
   this.active.splice(this.active.indexOf(entry),1);
   entry.group.removeFromParent();entry.fx.dispose();
  }
  for(const pool of Object.values(this.pools)){
   for(const entry of pool){entry.group.removeFromParent();entry.fx.dispose();}
   pool.length=0;
  }
 }
}
