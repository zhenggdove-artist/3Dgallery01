import test from 'node:test';import assert from 'node:assert/strict';import {dragBackgroundCrop} from '../src/wanted-list.js';
test('cover cropping follows the pointer in actual pixels on wide and tall images',()=>{
 const center={x:50,y:50};
 assert.deepEqual(dragBackgroundCrop(center,0,15,108,48,108,108),{x:50,y:25});
 assert.deepEqual(dragBackgroundCrop(center,27,0,108,48,216,48),{x:25,y:50});
 assert.deepEqual(dragBackgroundCrop(center,1000,-1000,108,48,108,108),{x:50,y:100});
 assert.deepEqual(dragBackgroundCrop(center,10,10,108,48,432,192),center);
 assert.deepEqual(dragBackgroundCrop(center,10,10,0,48,100,100),center);
});

test('V060 zoomed image uses the enlarged cover overflow for crop dragging',()=>{assert.deepEqual(dragBackgroundCrop({x:50,y:50},54,84,108,48,108,108,2),{x:0,y:0});assert.deepEqual(dragBackgroundCrop({x:50,y:50},27,42,108,48,108,108,2),{x:25,y:25});});
