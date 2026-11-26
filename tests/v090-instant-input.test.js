import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STAFF_TAP_MAX_MS,chargeProgress} from '../src/shared/weapon-abilities.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('precharge is 250ms; authored charge durations remain unchanged',()=>{assert.equal(STAFF_TAP_MAX_MS,250);assert.equal(chargeProgress(250,1000),0);assert.equal(chargeProgress(1250,1000),1);});
test('press starts ordinary action, release does not duplicate it and receipt does not replay VFX',()=>{const main=read('src/main.js'),p=read('src/reletter-presentation.js');assert.match(main,/normalOnPress=true;void performAttack\(0\)/);assert.match(main,/if\(pressedNormal\)/);assert.match(p,/this\.vfx\.play\(\{\.\.\.item,\.\.\.data\}/);assert.match(p,/if\(predictedNormal\)\{this\.normalPreviews\.delete/);assert.doesNotMatch(main,/liftRemaining/);});
test('normal slash uses held weapon world grip rather than impact point',()=>assert.match(read('src/weapon-vfx.js'),/blade\?\.getWorldPosition\(new THREE\.Vector3\(\)\)/));
