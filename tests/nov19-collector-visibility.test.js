import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COLLECTOR_RADIUS} from '../src/shared/collector.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Collector skinned body and world-space floating title are exactly doubled',()=>{
 const view=source('src/collector-view.js');
 assert.match(view,/const COLLECTOR_VISUAL_SCALE=2;/);
 assert.match(view,/root\.scale\.setScalar\(COLLECTOR_VISUAL_SCALE\)/);
 assert.match(view,/root\.add\(label\)/,'floating label must inherit root 2x scale');
 assert.match(view,/root\.userData\.model/,'original skinned avatar must be retained');
 assert.match(view,/this\.root\.position\.fromArray\(state\.position\)/,'authoritative spawn position unchanged');
});

test('Interaction-zone ring keeps the server radius despite 2x character scale',()=>{
 const view=source('src/collector-view.js');
 assert.equal(COLLECTOR_RADIUS,2.8);
 assert.match(view,/ring\.scale\.setScalar\(1\/COLLECTOR_VISUAL_SCALE\)/);
 assert.match(view,/ring\.position\.y=\.08\/COLLECTOR_VISUAL_SCALE/);
});

test('Collector taunt doubles typography and follows the enlarged animated head',()=>{
 const view=source('src/collector-view.js');
 const css=source('fidelity-ui.css');
 assert.match(view,/chatHeadY\|\|2\.8\)\*COLLECTOR_VISUAL_SCALE\+1\.25/);
 assert.match(css,/font:600 clamp\(22px,5\.4vw,28px\)\/1\.4 Arial,sans-serif/);
 assert.match(view,/this\.gunBone\.getWorldPosition\(new THREE\.Vector3\(\)\)/,
  'muzzle tracer should originate at enlarged hand rather than old height');
});
