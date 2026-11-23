import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {itemById} from '../src/shared/catalog.js';
import {chargedArea,insideChargedArea,spellFootprint,insideSpellFootprint} from '../src/shared/charge-area.js';
import {projectileFlightMs,visibleCollisionLifetimeMs} from '../src/shared/combat-balance.js';
import {saberWaveCrest,SABER_WAVE_COUNT,SABER_WAVE_FAN_ANGLE_DEG,SABER_WAVE_DURATION_MS} from '../src/shared/saber-wave.js';
import {NumberedWeaponEffects,requestedEffect} from '../src/numbered-weapon-effects.js';

test('native Energy Sword Wave retains exactly five golden-yellow blades',()=>{
 const item=itemById('saber-1');
 assert.ok(item);
 const event={weapon:item.id,origin:[0,1.16,0],direction:[0,0,1],range:12,
  radius:1,ultimate:true,qualityScale:1,area:{mode:'sector',angleDeg:60}};
 const spec=requestedEffect(item,event);
 assert.equal(spec.asset,'energy-sword-wave');
 assert.equal(SABER_WAVE_COUNT,5);
 assert.equal(SABER_WAVE_FAN_ANGLE_DEG,60);
 const scene=new THREE.Scene(),effects=new NumberedWeaponEffects(scene);
 assert.equal(effects.play(event,item,null),true);
 const live=effects.active[0];
 assert.equal(live.fx.settings.theme,'solar');
 assert.equal(live.fx.settings.quantity,5);
 assert.equal(live.fx.settings.spread,1);
 assert.equal(live.group.userData.vfxId,'energy-sword-wave');
 assert.ok(Math.abs(live.group.scale.x-12/17.5)<1e-6);
 effects.dispose();
});

test('saber ultimate warning, server damage and authored crest share 60 degrees and 1.55s',()=>{
 const item=itemById('saber-1'),origin=[0,1.16,0],direction=[0,0,1];
 const stats={range:12,radius:2,ultimate:true};
 const area=chargedArea(item,origin,direction,stats,()=>0);
 const footprint=spellFootprint(item,origin,direction,stats,area,()=>0);
 assert.equal(area.mode,'sector');assert.equal(area.angleDeg,60);
 assert.equal(footprint.shape,'sector');assert.equal(footprint.angleDeg,60);
 assert.equal(insideChargedArea(area,[0,.5,8]),true);
 assert.equal(insideSpellFootprint(footprint,[0,0,8]),true);
 assert.equal(insideChargedArea(area,[10,.5,2],0),false);
 assert.equal(insideSpellFootprint(footprint,[10,0,2]),false);
 assert.equal(projectileFlightMs(item,true),SABER_WAVE_DURATION_MS);
 assert.equal(visibleCollisionLifetimeMs(item,true),SABER_WAVE_DURATION_MS);
 assert.equal(saberWaveCrest(12,0),0);
 assert.ok(saberWaveCrest(12,.3)>0);
 assert.ok(saberWaveCrest(12,.65)>saberWaveCrest(12,.3));
 assert.equal(saberWaveCrest(12,1),12);
});
