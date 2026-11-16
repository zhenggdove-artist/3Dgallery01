import test from 'node:test';
import assert from 'node:assert/strict';
import {SOUND_PROFILES} from '../src/game-audio.js';
test('jump and attack cues use distinct timbres and last long enough to hear',()=>{
 assert.ok(SOUND_PROFILES.jump.duration>=.3);
 for(const s of ['saber','fire','ice','scatter','ultimate','land','fusion-success']){
  assert.ok(SOUND_PROFILES[s].duration>.20,s);
 }
 assert.notEqual(SOUND_PROFILES.fire.shape,SOUND_PROFILES.ice.shape);
 assert.notEqual(SOUND_PROFILES.scatter.freq,SOUND_PROFILES.ice.freq);
});
