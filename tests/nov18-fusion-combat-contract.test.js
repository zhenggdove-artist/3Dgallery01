import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {chargedArea,scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {pvpShotDamage} from '../src/shared/combat-balance.js';

test('all swatter ultimate warning radii and reaches match pan of the same tier',()=>{
 for(let tier=1;tier<=5;tier++){
  const pan=itemById('pan-'+tier),swatter=itemById('swatter-'+tier);
  const p=scaleUltimateFootprint(attackStats(pan,1),pan);
  const s=scaleUltimateFootprint(attackStats(swatter,1),swatter);
  assert.equal(s.range,p.range,'reach, tier '+tier);
  assert.equal(s.radius,p.radius,'radius, tier '+tier);
  assert.equal(chargedArea(swatter,[0,1.16,0],[0,0,1],s).mode,'area');
  if(tier>1)assert.ok(s.radius>scaleUltimateFootprint(attackStats(itemById('swatter-'+(tier-1)),1),itemById('swatter-'+(tier-1))).radius);
 }
});
test('SMG baseline damage halved, cadence doubled, and PvP damage uses same factor',()=>{
 const gun=itemById('white-cat');
 assert.equal(gun.damage,10);
 assert.equal(gun.chargeDamage,90);
 assert.equal(gun.cooldown,110);
 const stats=attackStats(gun,0);
 const baseline=pvpShotDamage({...gun,id:'unmodified-gun'},stats,{tier:gun.tier});
 assert.equal(pvpShotDamage(gun,stats,{tier:gun.tier}),+(baseline*.5).toFixed(3));
});
test('server-authoritative channel fusion echoes are emitted with separate hit locks',()=>{
 const source=readFileSync(new URL('../src/shared/temple-rules.js',import.meta.url),'utf8');
 assert.match(source,/if\(stats\.ultimate\)\{/);
 assert.match(source,/channel:echoChannel/);
 assert.match(source,/fusionSlot,channel:echoChannel/);
 assert.match(source,/fx\.echo\?'echo'/);
});
test('native VFX always passes through VHS instead of returning early',()=>{
 const source=readFileSync(new URL('../src/reletter-vhs.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fullScreenNative&&!material\.uniforms\.dizzy\.value/);
 assert.match(source,/if\(renderWorld\)renderWorld\(renderer,world,view\)/);
});
