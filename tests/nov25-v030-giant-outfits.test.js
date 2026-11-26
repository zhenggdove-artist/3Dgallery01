import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {itemById,SHOP_ITEMS,shopPurchaseVariant,SHOP_CATALOG_REVISION} from '../src/shared/catalog.js';
import {orientPortraitModel} from '../src/equipment-portrait.js';
import {cutDisguiseOpening} from '../src/engine/outfit-model.js';
test('giant props retain explicit sizes and all three new items are sold',()=>{
 assert.match(SHOP_CATALOG_REVISION,/^r\d+$/);
 for(const [name,size] of [['cardboard',2],['chimney',3],['water-tower',2],['utility-pole',3],['tin-pipe',3],['bubble-tea',2],['luroufan-sign',2],['luroufan-bowl',2],['notok-sign',2],['987-sign',2]]){
  const id='outfit-'+name+'-disguise',i=itemById(id);assert.equal(i.disguiseHeight,size,id);assert.equal(i.exposedHead,true,id);assert.ok(SHOP_ITEMS.includes(i));assert.ok(shopPurchaseVariant(id).price>0);
 }
});
test('wide accessories cannot rotate an authored upright model',()=>{
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(12,1,1),new T.MeshBasicMaterial()));
 assert.equal(orientPortraitModel(root),'authored');assert.equal(root.quaternion.angleTo(new T.Quaternion()),0);
});
test('tiny rig anatomy, not giant mesh dimensions, defines upright portrait',()=>{
 const root=new T.Group();root.rotation.z=Math.PI/2;
 for(const [name,x,y] of [['Hips',0,0],['Head',0,.00001],['LeftArm',.000003,.000006],['RightArm',-.000003,.000006]]){
  const bone=new T.Bone();bone.name=name;bone.position.set(x,y,0);root.add(bone);
 }
 root.add(new T.Mesh(new T.BoxGeometry(20,1,1),new T.MeshBasicMaterial()));
 assert.equal(orientPortraitModel(root),'anatomical');assert.ok(new T.Vector3(0,1,0).applyQuaternion(root.quaternion).distanceTo(new T.Vector3(0,1,0))<1e-6);
});
test('head opening coordinates follow the original prop and survive a shared portrait geometry',()=>{
 const root=new T.Group(),mat=new T.MeshStandardMaterial(),mesh=new T.Mesh(new T.BoxGeometry(1,1,1),mat);mesh.position.y=.5;root.add(mesh);
 cutDisguiseOpening(T,root,0,.5,.2,.3,.5);
 assert.equal(mesh.geometry.attributes.disguisePosition.count,mesh.geometry.attributes.position.count);
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};mat.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/discard/);assert.equal(shader.uniforms.disguiseOpening.value.y,.5);
});
