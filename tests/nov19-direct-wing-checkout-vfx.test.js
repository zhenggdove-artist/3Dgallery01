import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ForwardChannelBeam} from '../src/forward-channel-beam.js';
import {WeaponVFX} from '../src/weapon-vfx.js';
import {createInitialWorld,createProfile,applyAction} from '../src/shared/temple-rules.js';
import {SHOP_ITEMS} from '../src/shared/catalog.js';

test('prism ray visibly extends full 100m warning tube and follows yaw/forward steering',()=>{
 const scene=new THREE.Scene(),beam=new ForwardChannelBeam(scene,false);
 const origin=new THREE.Vector3(2,3,4);
 beam.update(origin,new THREE.Vector3(0,0,1),100,.4,.66);
 assert.equal(scene.children.includes(beam.group),true);
 assert.ok(Math.abs(beam.shell.scale.y-100)<.01);
 assert.ok(beam.shell.scale.x>.5);
 assert.ok(beam.core.scale.x>.2);
 assert.ok(beam.paths[0].geometry.attributes.position.getZ(32)>100);
 beam.update(origin,new THREE.Vector3(1,0,0),100,.65,.66);
 assert.ok(beam.paths[0].geometry.attributes.position.getX(32)>101);
 beam.dispose();
 assert.equal(scene.children.includes(beam.group),false);
});
test('lightning channel creates separate animated long emitter with bounded geometry',()=>{
 const scene=new THREE.Scene(),beam=new ForwardChannelBeam(scene,true);
 beam.update(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-1),65,.36,.75);
 assert.equal(beam.paths.length,3);
 assert.ok(beam.paths[0].geometry.attributes.position.getZ(32)<-64);
 assert.ok(beam.shell.material.depthTest===false);
 assert.ok(beam.paths.every(line=>line.frustumCulled===false));
 beam.dispose();
});
test('WeaponVFX creates independent beam even if numbered vendor modules render nothing',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();root.position.set(3,2,-4);scene.add(root);
 const vfx=new WeaponVFX(scene);
 const item={id:'prism-3',family:'beam',cooldown:700,radius:.5};
 const data={channel:true,origin:[3,3,-4],direction:[0,0,-1],range:78,radius:.5};
 vfx.refreshForwardBeam(data,item,root);
 assert.equal(vfx.forwardBeams.size,1);
 const entry=[...vfx.forwardBeams.values()][0];
 assert.ok(Math.abs(entry.visual.shell.scale.y-78)<.01);
 assert.equal(entry.visual.scene,scene);
 root.userData.staffAimDirection=[1,0,0];
 vfx.update(.1);
 assert.ok(entry.direction.x>0);
 vfx.stopChannel(root);
 assert.equal(vfx.forwardBeams.size,0);
 vfx.dispose();
});
test('ordinary shop includes exactly fourteen purchasable material wings',()=>{
 const wings=SHOP_ITEMS.filter(item=>item.slot==='wings');
 assert.equal(wings.length,14);
 assert.equal(new Set(wings.map(x=>x.motif)).size,14);
 assert.ok(wings.every(x=>x.price>0));
});
