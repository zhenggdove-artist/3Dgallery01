import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {placeRigidPortraitPart,placeWingPortraitPart,EquipmentPortraitViewport} from '../src/equipment-portrait-view.js';
import {createFlightVehicle} from '../src/reletter/flight-vehicle.js';
import {itemById} from '../src/shared/catalog.js';
const near=(a,b)=>assert.ok(a.distanceTo(b)<1e-6,JSON.stringify([a.toArray(),b.toArray()]));
test('sign preserves face +Z, height +Y and head aperture through live yaw, tilt and model scale',()=>{
 const player=new T.Group();player.position.set(32,1,9);player.rotation.y=1.8;
 const live=new T.Group();live.scale.setScalar(100);player.add(live);
 const head=new T.Bone();head.position.set(0,.016,0);live.add(head);
 const prop=new T.Group();prop.scale.setScalar(.025);prop.rotation.set(.45,-1.2,.6);live.add(prop);
 const aperture=new T.Vector3(0,.3,.05);prop.position.copy(head.position).sub(aperture.clone().multiplyScalar(.025).applyQuaternion(prop.quaternion));
 const portrait=new T.Group(),target=new T.Bone();target.position.set(0,1.8,0);portrait.add(target);const node=new T.Group();
 placeRigidPortraitPart(node,prop,player,portrait,head,target);
 near(new T.Vector3(0,0,1).applyQuaternion(node.quaternion),new T.Vector3(0,0,1));
 near(new T.Vector3(0,1,0).applyQuaternion(node.quaternion),new T.Vector3(0,1,0));
 near(node.localToWorld(aperture.clone()),target.getWorldPosition(new T.Vector3()));
 near(node.scale,new T.Vector3(2.5,2.5,2.5));
});
test('all three flight vehicle rotors stay above their mount and keep actual scale',()=>{
 const player=new T.Group();player.rotation.y=-2.2;const live=new T.Group();live.scale.setScalar(100);player.add(live);
 const portrait=new T.Group(),hips=new T.Bone(),target=new T.Bone();hips.position.y=.01;live.add(hips);target.position.y=1;portrait.add(target);
 for(const id of ['wings-42','wings-43','wings-44']){
  const source=createFlightVehicle(T,itemById(id));source.scale.setScalar(.013);source.rotation.set(Math.PI/2,.7,Math.PI);live.add(source);
  const node=source.clone();placeRigidPortraitPart(node,source,player,portrait,hips,target);
  const rotor=node.getObjectByName('vehicle-rotor')||node.getObjectByName('vehicle-propeller');
  assert.ok(rotor);assert.ok(rotor.getWorldPosition(new T.Vector3()).y>node.position.y,id);
  near(node.scale,new T.Vector3(1.3,1.3,1.3));assert.equal(node.quaternion.angleTo(new T.Quaternion()),0);
 }
});
test('normal wings keep canonical upright XY plane and sit behind torso',()=>{
 const player=new T.Group(),source=new T.Group(),portrait=new T.Group(),spine=new T.Bone();
 player.rotation.y=2;source.rotation.set(Math.PI/2,Math.PI,.4);player.add(source);
 source.scale.setScalar(1.7);spine.position.set(0,1.2,0);portrait.add(spine);player.updateMatrixWorld(true);portrait.updateMatrixWorld(true);
 const node=new T.Group(),box=new T.Box3(new T.Vector3(-.5,0,-.3),new T.Vector3(.5,2,.3));
 placeWingPortraitPart(node,source,player,portrait,spine,box);
 assert.equal(node.quaternion.angleTo(new T.Quaternion()),0);assert.ok(node.position.z<0);assert.equal(node.position.y,1.2);
 near(node.scale,new T.Vector3(1.7,1.7,1.7));
});
test('EQUIP body and all canonical equipment share one front frame, with no bind reset',()=>{
 const root=new T.Group(),body=new T.Group();root.add(body);
 for(const [name,y] of [['Head',1.6],['Hips',.9],['Spine2',1.3]]){const b=new T.Bone();b.name=name;b.position.y=y;body.add(b);}
 body.add(new T.Mesh(new T.BoxGeometry(.5,1.8,.4),new T.MeshBasicMaterial()));
 const prop=new T.Group();prop.userData.outfit='sign';prop.add(new T.Mesh(new T.BoxGeometry(5,2,.2),new T.MeshBasicMaterial()));prop.position.y=1.6;body.add(prop);
 const wing=createFlightVehicle(T,itemById('wings-42'));body.add(wing);
 root.userData={model:body,outfit:{parts:[prop]},wings:wing};root.rotation.y=2;
 const view=new EquipmentPortraitViewport();view.scene=new T.Scene();view.build(root);
 const a=view.attachments.get('outfit').parts[0],b=view.attachments.get('wings').parts[0];
 assert.equal(a.quaternion.angleTo(new T.Quaternion()),0);assert.equal(b.quaternion.angleTo(new T.Quaternion()),0);assert.ok(view.focus.size.x>=5);
 assert.equal(view.model.children[0].quaternion.angleTo(new T.Quaternion()),0);
});
