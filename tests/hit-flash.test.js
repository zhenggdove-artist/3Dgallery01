import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {updateHitFlash} from '../src/hit-flash.js';
test('shared equipment materials restore after repeated hit frames',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0x123456});
  root.add(new THREE.Mesh(new THREE.BoxGeometry(),material),new THREE.Mesh(new THREE.BoxGeometry(),material));
  root.userData.hitFlashUntil=250;
  for(const time of [0,16,32,100]){updateHitFlash(root,time);assert.equal(material.color.getHex(),0xff182d);}
  updateHitFlash(root,251);assert.equal(material.color.getHex(),0x123456);
  root.userData.hitFlashUntil=600;updateHitFlash(root,300);updateHitFlash(root,601);assert.equal(material.color.getHex(),0x123456);
});
