import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {advanceHomingVortex,VORTEX_FLIGHT_MS,VORTEX_VISUAL_SPIN_RATE,vortexSegmentDistance} from '../src/shared/vortex-flight.js';
test('vortex travels twice as fast and swept contact retains the intermediate target',()=>{
 const fx={origin:[0,1,0],position:[0,1,0],direction:[0,0,1],range:21,travelled:0};
 advanceHomingVortex(fx,null,500);
 assert.equal(VORTEX_FLIGHT_MS,2100);assert.equal(VORTEX_VISUAL_SPIN_RATE,4);
 assert.equal(fx.position[2],5);assert.equal(vortexSegmentDistance([0,1,0],fx.position,[0,0,2.5]),0);
});
test('chat storage key is stable and only explicit drags persist position',()=>{
 const src=readFileSync(new URL('../src/chat-layout.js',import.meta.url),'utf8');
 assert.match(src,/STORAGE_KEY='temple-chat-position-v3'/);
 assert.match(src,/if\(!manualPosition\)return;try/);
 assert.match(src,/window\.visualViewport\?\.addEventListener\('resize'/);
});
