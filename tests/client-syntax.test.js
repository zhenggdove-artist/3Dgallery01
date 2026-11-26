import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
// These entry points are not imported by server-only tests; parse them
// independently so a single malformed regex cannot brick the entire game.
test('browser entry points and visual modules always parse as JavaScript',()=>{
 for(const file of [
  'src/main.js','src/equipment-portrait.js','src/weapon-vfx.js',
  'src/weapon-particle-effects.js','src/weapon-signature-effects.js',
  'src/engine-presentation.js','src/ui.js','src/arena-view.js',
  'src/shared/weapon-abilities.js','src/shared/temple-rules.js'
 ]){
  const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(run.status,0,file+': '+run.stderr);
 }
});
