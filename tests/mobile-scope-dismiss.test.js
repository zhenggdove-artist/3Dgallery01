import test from 'node:test';
import assert from 'node:assert/strict';
import {outsideScopeCircle} from '../src/gun-controller.js';

test('sniper's opaque 35vmin mask is an exit target on portrait phones',()=>{
 // 390×844: 35vmin means 136.5 CSS pixels from the viewport centre.
 assert.equal(outsideScopeCircle(8,422,390,844),true);
 assert.equal(outsideScopeCircle(335,390,390,844),true);
 assert.equal(outsideScopeCircle(275,390,390,844),false);
 assert.equal(outsideScopeCircle(195,422,390,844),false);
 assert.equal(outsideScopeCircle(195+136.5,422,390,844),false);
});

test('scope exit hit test follows vmin on landscape devices',()=>{
 // 844×390: same radius but viewport centre moves with orientation.
 assert.equal(outsideScopeCircle(422,195,844,390),false);
 assert.equal(outsideScopeCircle(600,195,844,390),true);
 assert.equal(outsideScopeCircle(490,195,844,390),false);
});
