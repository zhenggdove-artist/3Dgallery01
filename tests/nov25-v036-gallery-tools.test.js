import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {readFileSync} from 'node:fs';
import {createInitialWorld,migrateWorld,worldView,setSkyBaseColor,removeSelectedArtworks} from '../src/shared/temple-rules.js';
import {PLATFORMS} from '../src/shared/arena.js';
import {artworkDefinitions} from '../src/shared/artwork-library.js';
import {createMoonlitSky} from '../src/night-sky.js';
test('sky color is GM-only, persisted in world snapshots and applied by uniform without new geometry',()=>{
 const w=createInitialWorld(1000);assert.ok(setSkyBaseColor(w,false,'#aa9988').error);assert.ok(setSkyBaseColor(w,true,'red').error);assert.equal(setSkyBaseColor(w,true,'#AA9988').environment.skyBaseColor,'#aa9988');assert.equal(worldView(migrateWorld(w),null).environment.skyBaseColor,'#aa9988');
 const scene=new THREE.Scene(),sky=createMoonlitSky(scene,null,{mobile:true});const geo=sky.particles.geometry;sky.setBaseColor('#aa9988');assert.equal(sky.dome.material.uniforms.uBaseColor.value.getHexString(),'aa9988');assert.equal(sky.particles.geometry,geo);sky.dispose();
});
test('GM can delete selected original and uploaded works only; shared media and coin stay',()=>{
 const w=createInitialWorld(1000),id=PLATFORMS[0].id;w.customArtworks=[{id:'a',mediaId:'shared',position:[1,2,3]},{id:'b',mediaId:'shared',position:[1,2,4]},{id:'c',mediaId:'unique',position:[1,2,5]}];for(const a of w.customArtworks)w.artworks[a.id]={holder:null,availableAt:0};
 assert.ok(removeSelectedArtworks(w,false,[id]).error);assert.ok(removeSelectedArtworks(w,true,[id,'invalid']).error);assert.ok(w.artworks[id]);
 const result=removeSelectedArtworks(w,true,[id,'a','c']);assert.deepEqual(result.removedArtworkMediaIds,['unique']);assert.equal(w.customArtworks[0].id,'b');assert.ok(w.coins[id]);assert.equal(w.artworks[id],undefined);migrateWorld(w);assert.equal(w.artworks[id],undefined);assert.ok(!artworkDefinitions(w).some(p=>p.id===id));assert.ok(worldView(w,null).removedArtworkIds.includes(id));
});
test('all BUILD tools remain mounted and accessible via persistent tabs',()=>{const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');for(const tab of ['upload','structures','manage']){assert.ok(ui.includes('data-build-tab="'+tab+'"'));assert.ok(ui.includes('data-build-page="'+tab+'"'));}assert.match(ui,/this\.applyBuildTab\(\)/);});
