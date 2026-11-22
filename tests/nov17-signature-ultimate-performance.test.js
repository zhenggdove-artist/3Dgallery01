import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import {itemById} from '../src/shared/catalog.js';

const event={id:'ultimate-1',origin:[0,1,0],direction:[0,0,1],range:20,
 ultimate:true,qualityScale:1,qualityTier:2,qualityDuration:1,time:1400,
 area:{mode:'area',center:[0,.1,12],visualCenter:[0,.1,12],radius:4}};
for(const id of ['calico-cat','goldfish','fan','bloom-1','giraffe']){
 test('signature ultimate replays the same GPU model without a synchronous geometry rebuild: '+id,()=>{
  const scene=new THREE.Scene(),effects=new WeaponSignatureEffects(scene);
  const item=itemById(id);
  assert.ok(item,id);
  assert.equal(effects.play(event,item),true);
  const first=effects.active[0],model=first.obj;
  const firstMesh=model.getObjectByProperty('isMesh',true)||model.children[0];
  effects.remove(first);
  assert.equal(scene.children.length,0);
  assert.equal(effects.play({...event,id:'ultimate-2'},item),true);
  assert.equal(effects.active[0].obj,model,'pool must reuse the precise original 3D group');
  const nextMesh=model.getObjectByProperty('isMesh',true)||model.children[0];
  assert.equal(nextMesh,firstMesh,'mesh identity and geometry must be preserved');
  if(id==='calico-cat')assert.equal(model.children[0].material.opacity,1,'rainbow sphere opacity must be reset');
  effects.dispose();
  assert.equal(scene.children.length,0);
  assert.equal(effects.recycledCount,0);
 });
}

test('every signature VFX shader and model is prepared before gameplay',async()=>{
 const scene=new THREE.Scene(),effects=new WeaponSignatureEffects(scene);
 let compiled=0,visible=0;
 const renderer={compileAsync:async stage=>{
  compiled++;visible=[...stage.children].filter(e=>e.visible).length;
  assert.ok(visible>=7,'all seven signature examples must be staged for compilation');
 }};
 await effects.warm(renderer,new THREE.PerspectiveCamera());
 assert.equal(compiled,1,'all signatures are prepared in a single pre-entry shader pass');
 assert.ok(effects.recycledCount>=6,'native signature models must be retained');
 assert.equal(scene.children.length,0);
 effects.dispose();
});
