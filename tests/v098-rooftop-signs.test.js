import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {rooftopSignMode,installRooftopSignLighting,updateRooftopSignClock,drawRooftopSignArtwork} from '../src/sign-art.js';
test('rooftop modes include steady, pulse, faulty, neon and inactive signs',()=>{assert.deepEqual(Array.from({length:5},(_,i)=>rooftopSignMode(i)),[0,1,2,3,4]);});
test('lighting preserves earlier shader hooks and uses a shared clock',()=>{
 const m=new THREE.MeshBasicMaterial();let called=false;m.onBeforeCompile=()=>{called=true;};installRooftopSignLighting(m,{batched:true});
 const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <color_fragment>'};m.onBeforeCompile(shader);
 assert.ok(called);assert.match(shader.vertexShader,/attribute vec3 roofSignLight/);assert.match(shader.fragmentShader,/vRoofLight.x>.5/);assert.match(shader.fragmentShader,/#include <color_fragment>/);updateRooftopSignClock(4);assert.equal(shader.uniforms.uRoofClock.value,4);
 const gm=new THREE.MeshStandardMaterial();installRooftopSignLighting(gm,{seed:2});const other={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <emissivemap_fragment>'};gm.onBeforeCompile(other);assert.equal(other.uniforms.uRoofClock,shader.uniforms.uRoofClock);assert.match(other.fragmentShader,/totalEmissiveRadiance/);
});
test('rooftop atlas artwork keeps a dominant Chinese title and uses no external images',()=>{
 const text=[];const noop=()=>{};const ctx=new Proxy({fillText:(...args)=>text.push(args),strokeText:noop},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});drawRooftopSignArtwork(ctx,0,0,96,96,{title:'台灣銀行',subtitle:'BANK',aspect:3,seed:2});assert.equal(text[0][0],'台灣銀行');assert.equal(text[1][0],'BANK');
});
