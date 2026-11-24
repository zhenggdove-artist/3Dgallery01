import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMoonlitSky,nebulaBand,nebulaParticleGeometry,SKY_PARTICLE_COUNTS} from '../src/night-sky.js';
test('celestial ocean is a dense world-oriented GPU particle field on desktop and mobile',()=>{
 for(const mobile of [true,false]){
  const scene=new THREE.Scene(),sky=createMoonlitSky(scene,null,{mobile});
  const attr=sky.particles.geometry.attributes.position,version=attr.version;
  assert.equal(attr.count,SKY_PARTICLE_COUNTS[mobile?'mobile':'desktop']);
  assert.ok(attr.count>=36000);assert.equal(sky.root.children.length,2);
  const camera=new THREE.PerspectiveCamera();camera.position.set(30,5,-45);camera.rotation.y=2;
  sky.update(camera,1);sky.update(camera,42);
  assert.deepEqual(sky.root.position.toArray(),[30,5,-45]);assert.equal(sky.root.rotation.y,0);
  assert.equal(sky.particles.material.uniforms.uTime.value,42);assert.equal(attr.version,version);
  assert.equal(sky.dome.material.depthWrite,false);assert.equal(sky.particles.material.depthTest,true);
  assert.match(sky.particles.material.vertexShader,/radius\+swell/);
  sky.dispose();assert.equal(scene.children.length,0);
 }
});
test('dense stars cluster along nebula currents instead of uniform dots',()=>{
 const g=nebulaParticleGeometry(5000),p=g.attributes.position,l=g.attributes.aLayer;
 const sums=[0,0,0],counts=[0,0,0];
 for(let j=0;j<p.count;j++){
  const v=new THREE.Vector3().fromBufferAttribute(p,j).normalize(),layer=l.getX(j);
  sums[layer]+=nebulaBand(v.x,v.y,v.z);counts[layer]++;
 }
 assert.ok(sums[1]/counts[1]>sums[0]/counts[0]+.1);g.dispose();
});
