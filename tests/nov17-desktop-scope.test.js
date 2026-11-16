import test from 'node:test';
import assert from 'node:assert/strict';
import {outsideScopeCircle,shouldDismissScopePointer} from '../src/gun-controller.js';
test('desktop pointer lock mouse fire must NEVER dismiss scoped sniper even at (0,0)',()=>{
 assert.equal(outsideScopeCircle(0,0,1280,800),true);
 assert.equal(shouldDismissScopePointer('mouse',0,0,1280,800),false);
 assert.equal(shouldDismissScopePointer('mouse',640,400,1280,800),false);
 assert.equal(shouldDismissScopePointer('pen',0,0,1280,800),false);
});
test('mobile touch retains black-mask exit while center taps fire',()=>{
 assert.equal(shouldDismissScopePointer('touch',0,0,1280,800),true);
 assert.equal(shouldDismissScopePointer('touch',640,400,1280,800),false);
});
