import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {itemById} from '../src/shared/catalog.js';
import {explainWeapon} from '../src/shared/weapon-info.js';
import {WeaponVFX,effectFor} from '../src/weapon-vfx.js';
import {PlantUltimateEffects} from '../src/plant-ultimate-effects.js';
import {requestedEffect} from '../src/numbered-weapon-effects.js';

const event=(weapon)=>({
 id:'botanical-'+weapon,weapon,origin:[0,1,0],direction:[0,0,1],
 range:20,radius:4,charge:1,ultimate:true,qualityScale:1,
 area:{mode:'area',center:[2,.12,10],visualCenter:[2,.16,10],radius:4}
});

test('both green botanical ultimates replace their old VFX for all five equipment tiers',()=>{
 for(let tier=1;tier<=5;tier++){
  const palm=itemById('palm-'+tier),planter=itemById('planter-'+tier);
  assert.equal(effectFor(palm,true),'lightning-fire-tornado');
  assert.equal(effectFor(planter,true),'golden-chain-rain');
  assert.equal(effectFor(palm,false),'shockwave');
  assert.equal(effectFor(planter,false),'thorn-crown');
  assert.equal(requestedEffect(palm,event(palm.id)),null);
  assert.equal(requestedEffect(planter,event(planter.id)),null);
 }
 assert.match(explainWeapon(itemById('palm-1')),/green lightning-fire tornado/i);
 assert.match(explainWeapon(itemById('planter-1')),/green chains/i);
});

for(const [id,name] of [
 ['palm-1','Green lightning-fire tornado'],
 ['planter-1','Three waves of eight green falling chains']
]){
 test(id+' plays new green effect without layering any retired spell',()=>{
  const scene=new THREE.Scene(),vfx=new WeaponVFX(scene),item=itemById(id);
  vfx.play(event(id),item);
  assert.equal(vfx.plantUltimates.active.length,1);
  const effect=vfx.plantUltimates.active[0];
  assert.equal(effect.group.name,name);
  assert.equal(effect.group.position.x,2);
  assert.equal(effect.group.position.z,10);
  assert.equal(vfx.numberedEffects.active.length,0,'no legacy crown');
  assert.equal(vfx.signatureEffects.active.length,0,'no legacy thorn field');
  assert.equal(vfx.active.length,0,'no fallback explosion');
  vfx.plantUltimates.update(.12);
  assert.ok(effect.group.visible);
  assert.ok(scene.children.includes(effect.group));
  vfx.dispose();
  assert.equal(scene.children.length,0);
 });
}

test('green chain rain renders three sets of eight independently falling linked chains',()=>{
 const scene=new THREE.Scene(),system=new PlantUltimateEffects(scene);
 assert.equal(system.play(event('planter-2'),itemById('planter-2')),true);
 const effect=system.active[0];
 assert.equal(effect.fx.group.userData.vfxSource,'00GameDevs');
 assert.equal(effect.fx.group.userData.vfxId,'golden-chain-rain');
 assert.equal(effect.fx.group.parent,effect.group);
 const original=effect.group;
 system.update(.12);
 assert.ok(effect.age>0,'native source is advanced with delta-time updates');
 system.recycle(effect);
 assert.equal(system.play(event('planter-2'),itemById('planter-2')),true);
 assert.equal(system.active[0].group,original,'effect must be reused from pool');
 system.dispose();
 assert.equal(scene.children.length,0);
});

test('the botanical VFX prewarms each 3D emitter before the loading screen closes',async()=>{
 const scene=new THREE.Scene(),system=new PlantUltimateEffects(scene);
 let compiled=0,rendered=0;
 const renderer={
  compileAsync:async stage=>{compiled++;assert.equal(stage.children.length,2);},
  getRenderTarget:()=>null,setRenderTarget:()=>{},
  render:()=>{rendered++;}
 };
 await system.warm(renderer,new THREE.PerspectiveCamera());
 assert.equal(compiled,1);assert.equal(rendered,1);
 assert.equal(system.pools.palm.length,1);
 assert.equal(system.pools.planter.length,1);
 assert.equal(scene.children.length,0);
 system.dispose();
});
