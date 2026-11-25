import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {advanceGoldfishSchool} from '../src/shared/goldfish-school.js';
import {GOLDFISH_SWIM_MS,TIDE_PUSH_INTERVAL_MS,TIDE_PUSH_DURATION_MS,TIDE_PUSH_DISTANCE} from '../src/shared/weapon-abilities.js';
import {createInitialWorld,ensureProfile,tickTidalChannels,worldView} from '../src/shared/temple-rules.js';
test('goldfish acquires a player behind launch, changes elevation and travels twice as fast at unchanged range',()=>{
 const fx={origin:[0,3.5,0],direction:[0,0,1],launchDirection:[0,0,1],range:24,travelled:0};
 advanceGoldfishSchool(fx,{position:[0,0,-10]},500,GOLDFISH_SWIM_MS);
 assert.equal(GOLDFISH_SWIM_MS,2400);assert.ok(fx.position[2]<-4.9);assert.ok(fx.position[1]<3.5);assert.equal(fx.travelled,5);
});
test('tide uses an independent one-second push every three seconds',()=>{
 assert.equal(TIDE_PUSH_INTERVAL_MS,3000);assert.equal(TIDE_PUSH_DURATION_MS,1000);assert.equal(TIDE_PUSH_DISTANCE,1.5);
 const code=readFileSync(new URL('../src/shared/temple-rules.js',import.meta.url),'utf8');
 assert.match(code,/victim\.tidePush=\{id:id\(\),time:now,durationMs:TIDE_PUSH_DURATION_MS/);
 assert.match(code,/nextPushAt:pushNow\?now\+TIDE_PUSH_INTERVAL_MS:nextPushAt/);
 assert.match(code,/tidePush:profile\.tidePush\|\|null/);
});
test('shop opens on headwear and weapon filters only appear inside weapons',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.match(ui,/if\(name==='shop'&&this\.panelName!=='shop'\)\{this\.shopTab='head'/);
 assert.match(ui,/\['weapons','shield','comfort'\],\.\.\.\(weaponActive\?\[weaponTabs\]:\[\]\)/);
});
