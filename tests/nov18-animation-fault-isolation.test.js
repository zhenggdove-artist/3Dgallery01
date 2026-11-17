import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WeaponVFX} from '../src/weapon-vfx.js';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import {WeaponParticleEffects} from '../src/weapon-particle-effects.js';

test('a broken native animation is quarantined and healthy native animations still advance',()=>{
 const scene=new THREE.Scene(),fx=new WeaponVFX(scene);
 let goodFrames=0,brokenDisposals=0;
 const native=(id,update,dispose)=>({
  id,age:0,stopAt:Infinity,stopped:false,
  fx:{group:new THREE.Group(),finished:false,update,dispose}
 });
 const broken=native('shockwave',()=>{throw Error('simulated shader update failure');},
  ()=>{brokenDisposals++;});
 const healthy=native('azure-sweep',()=>{goodFrames++;},()=>{});
 scene.add(broken.fx.group,healthy.fx.group);fx.active.push(broken,healthy);
 const original=console.error;console.error=()=>{};
 try{assert.doesNotThrow(()=>fx.update(.016));}finally{console.error=original;}
 assert.equal(brokenDisposals,1);
 assert.equal(goodFrames,1);
 assert.deepEqual(fx.active,[healthy]);
 assert.equal(broken.fx.group.parent,null);
 assert.equal(fx.pools.get('shockwave')?.length||0,0,'never reuse invalid GPU instance');
 fx.dispose();
});

test('one broken weapon signature does not halt simultaneous healthy signature',()=>{
 const scene=new THREE.Scene(),fx=new WeaponSignatureEffects(scene);
 let good=0;
 const bad=fx.add(new THREE.Group(),1,()=>{throw Error('bad signature');},'broken');
 const healthy=fx.add(new THREE.Group(),1,()=>{good++;},'healthy');
 const original=console.error;console.error=()=>{};
 try{assert.doesNotThrow(()=>fx.update(.02));}finally{console.error=original;}
 assert.equal(good,1);
 assert.deepEqual(fx.active,[healthy]);
 assert.equal(bad.obj.parent,null);
 fx.dispose();
});

test('bad particle emitter does not prevent good emitter update',()=>{
 const scene=new THREE.Scene(),fx=new WeaponParticleEffects(scene);
 const healthy=fx.make('tidal',{id:'tide-1',color:'#88ddff'},{amount:36,range:10});
 const bad=fx.make('prism',{id:'prism-1',color:'#ffffff'},{amount:36,range:10});
 fx.add(bad);fx.add(healthy);
 bad.material=null;
 const original=console.error;console.error=()=>{};
 try{assert.doesNotThrow(()=>fx.update(.016));}finally{console.error=original;}
 assert.deepEqual(fx.active,[healthy]);
 assert.ok(healthy.material.uniforms.uAge.value>0);
 assert.equal(bad.root.parent,null);
 fx.dispose();
});
