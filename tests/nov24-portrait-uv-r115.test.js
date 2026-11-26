import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {itemById} from '../src/shared/catalog.js';
import {createHeadgear,disposeHeadgear} from '../src/engine/headgear-model.js';
test('every named human mask has dense 3D geometry and UV attributes',()=>{for(const d of ['huang','xi','putin','kim','musk','trump']){const root=createHeadgear(T,itemById('hat-'+d+'-mask'));let face;root.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count>5000)face=o.geometry});assert.ok(face,d);assert.equal(face.attributes.uv.count,face.attributes.position.count);assert.ok(face.attributes.uv.array.every(Number.isFinite));disposeHeadgear(root);}});
