import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WeaponVFX} from '../src/weapon-vfx.js';
import {itemById} from '../src/shared/catalog.js';

test('moving the caster moves an existing channel emitter to the held weapon tip, never behind the avatar',()=>{
 const scene=new THREE.Scene(),fx=new WeaponVFX(scene),root=new THREE.Group();
 const blade=new THREE.Group();blade.position.set(0,1,0);root.add(blade);root.userData.blade=blade;
 scene.add(root);
 const item=itemById('ember-1'),event={origin:[0,1,0],direction:[0,0,1],weapon:item.id,ultimate:true,channel:true,range:12,qualityScale:1};
 fx.play(event,item,root);
 assert.equal(fx.numberedEffects.active.length,1);
 const first=fx.numberedEffects.active[0];
 const before=first.group.position.clone();
 root.position.set(0,0,6);
 fx.update(.08);
 assert.ok(first.group.position.z>before.z+5,'moving caster must move live emitter source');
 assert.ok(first.group.position.distanceTo(fx.channelMuzzle(root,item))<.01);
 fx.play({...event,origin:[0,1,6],time:1100},item,root);
 assert.equal(fx.numberedEffects.active.length,1,'repeated pulses reuse a single moving emitter');
 fx.stopChannel(root);assert.equal(fx.numberedEffects.active.length,0);
 fx.dispose();scene.remove(root);assert.equal(scene.children.length,0);
});
