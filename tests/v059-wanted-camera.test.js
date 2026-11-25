import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerController} from '../src/player-controller.js';

test('Wanted jump camera is behind the fighter and fits both complete objects in portrait and landscape',()=>{
 for(const aspect of [.45,1.7]){
  const camera=new THREE.PerspectiveCamera(50,aspect,.1,500);
  const root=new THREE.Group();root.position.set(0,0,0);const body=new THREE.Mesh(new THREE.BoxGeometry(2,3,1));body.position.y=1.5;root.add(body);root.updateMatrixWorld(true);
  const art=new THREE.Box3(new THREE.Vector3(-5,0,5),new THREE.Vector3(5,10,6));
  const controller={camera,root,enabled:false,role:'fighter'};
  PlayerController.prototype.frameWantedArtwork.call(controller,art,0);
  PlayerController.prototype.updateCamera.call(controller,1,true);
  camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
  assert.ok(camera.position.z<root.position.z,'camera is behind player, not between player and artwork');
  const all=art.clone().union(new THREE.Box3().setFromObject(root));
  for(const x of [all.min.x,all.max.x])for(const y of [all.min.y,all.max.y])for(const z of [all.min.z,all.max.z]){
   const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&Math.abs(p.z)<=1,JSON.stringify(p));
  }
  controller.enabled=true;PlayerController.prototype.updateCamera.call(controller,1,true);
  assert.ok(controller.wantedArtworkView,'closing panel does not reset the framing until player moves');
 }
});
