import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {setHealthBar,faceHealthBar} from '../src/health-bars.js';import {updateHitFlash} from '../src/hit-flash.js';
test('pink bars show HP ratios, face camera, and are not tinted by hit flash',()=>{
 const root=new THREE.Group(),camera=new THREE.PerspectiveCamera();root.rotation.y=1.4;camera.rotation.y=.3;
 setHealthBar(root,25,100);const bar=root.userData.healthBar;assert.equal(bar.children[1].scale.x,1.46*.25);assert.equal(bar.position.y,2.15);
 root.updateMatrixWorld(true);faceHealthBar(root,camera);root.updateMatrixWorld(true);assert.ok(bar.getWorldQuaternion(new THREE.Quaternion()).angleTo(camera.quaternion)<1e-6);
 root.userData.hitFlashUntil=100;updateHitFlash(root,0);assert.equal(bar.children[1].material.color.getHex(),0xff72b5);
 setHealthBar(root,0,100);assert.equal(bar.visible,false);
});
