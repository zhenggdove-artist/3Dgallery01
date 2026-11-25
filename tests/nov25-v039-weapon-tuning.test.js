import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {TIDE_DAMAGE_TICK_MS,TIDE_PUSH_DISTANCE} from '../src/shared/weapon-abilities.js';
import {scaleUltimateFootprint,PALM_ULTIMATE_RADIUS_MULTIPLIER} from '../src/shared/charge-area.js';
import {PALM_STORM_DURATION_MS,projectileFlightMs} from '../src/shared/combat-balance.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {WeaponVFX} from '../src/weapon-vfx.js';
test('tide pulse and displacement, palm and bloom tuning',()=>{
 assert.equal(TIDE_DAMAGE_TICK_MS,200);assert.equal(TIDE_PUSH_DISTANCE,3);assert.equal(PALM_STORM_DURATION_MS,3000);
 assert.equal(PALM_ULTIMATE_RADIUS_MULTIPLIER,5*(1.4/2.4));
 const bloom=itemById('bloom-1'),stats=attackStats(bloom,1),scaled=scaleUltimateFootprint({...stats},bloom);
 assert.ok(Math.abs(scaled.range-stats.range*.6*2)<.002);assert.equal(projectileFlightMs(bloom,true),2200);
});
test('water stream is world-up aligned for every horizontal direction, including the old antipodal rotation',()=>{
 const vfx=new WeaponVFX(new THREE.Scene()),entry={fx:{group:new THREE.Group()},waterSmooth:{x:new THREE.Vector3(),y:new THREE.Vector3(),z:new THREE.Vector3(),heading:new THREE.Vector3(-1,0,0),basis:new THREE.Matrix4()}};
 const source=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 for(const dir of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]){
  vfx.orientWaterStream(entry,source,dir);
  assert.ok(new THREE.Vector3(1,0,0).applyQuaternion(entry.fx.group.quaternion).distanceTo(dir)<1e-6);
  assert.ok(up.clone().applyQuaternion(entry.fx.group.quaternion).distanceTo(up)<1e-6);
 }
 vfx.dispose();
});
