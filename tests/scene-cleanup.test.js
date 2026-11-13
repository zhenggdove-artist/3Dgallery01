import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanLegacyScene} from '../src/shared/scene-cleanup.js';
import {createInitialWorld,worldView} from '../src/shared/temple-rules.js';
test('new scene has no preset buildings, trees or fishing hole',()=>{const w=createInitialWorld();assert.deepEqual(w.structures,[]);assert.deepEqual(worldView(w,'none').reletter.fishing.holes,[]);});
test('legacy scenery is archived once without touching art or messages',()=>{const w={structures:[{id:'tree',kind:'tree'},{id:'house',kind:'house'},{id:'column',kind:'column',owner:'temple'},{id:'custom',kind:'cube',owner:'player'}],plants:[{id:'message'}],artworkLayout:{custom:true},reletter:{fishing:{holes:[{id:'old'}],ponds:[{id:'tank'}],sessions:{}}}};cleanLegacyScene(w);assert.deepEqual(w.structures.map(s=>s.id),['custom']);assert.equal(w.sceneArchive.structures.length,3);assert.equal(w.sceneArchive.holes.length,1);assert.equal(w.plants[0].id,'message');assert.equal(w.artworkLayout.custom,true);const before=JSON.stringify(w);cleanLegacyScene(w);assert.equal(JSON.stringify(w),before);});
