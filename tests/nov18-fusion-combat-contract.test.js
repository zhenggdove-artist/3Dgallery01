import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {chargedArea,scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {pvpShotDamage} from '../src/shared/combat-balance.js';
import {weaponQuality,forwardCastRadius} from '../src/shared/weapon-abilities.js';

test('all swatter ultimate warning radii and reaches are 1.7x pan of the same tier',()=>{
 for(let tier=1;tier<=5;tier++){
  const pan=itemById('pan-'+tier),swatter=itemById('swatter-'+tier);
  const footprint=item=>{const stats=attackStats(item,1),q=weaponQuality(item);stats.range=+(stats.range*q.range).toFixed(2);stats.radius=forwardCastRadius(item,q,stats.radius,false);return scaleUltimateFootprint(stats,item);};
  const p=footprint(pan),s=footprint(swatter);
  assert.ok(Math.abs(s.range-p.range*1.7)<.002,'reach, tier '+tier);
  assert.ok(Math.abs(s.radius-p.radius*1.7)<.002,'radius, tier '+tier);
  assert.equal(chargedArea(swatter,[0,1.16,0],[0,0,1],s).mode,'area');
  if(tier>1)assert.ok(s.radius>footprint(itemById('swatter-'+(tier-1))).radius);
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
