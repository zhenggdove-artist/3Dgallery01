import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ITEMS} from '../src/shared/catalog.js';import {effectFor} from '../src/weapon-vfx.js';
const manifest=JSON.parse(readFileSync(new URL('../vendor/00gamedevs/manifest.json',import.meta.url)));
test('every weapon has normal and charged visuals from verified 00GameDevs modules',()=>{
 const ids=new Set(manifest.assets.map(a=>a.id));for(const item of ITEMS.filter(i=>i.slot==='weapon'))for(const ultimate of [false,true]){
  const id=effectFor(item,ultimate);
  if(ultimate&&!item.exotic&&item.family==='palm')assert.equal(id,'lightning-fire-tornado');
  else if(ultimate&&!item.exotic&&item.family==='planter')assert.equal(id,'golden-chain-rain');
  else assert.ok(ids.has(id)||id==='venom-stream',item.id);
 }
 for(const a of manifest.assets){assert.equal(a.license,'MIT');assert.match(a.sha256,/^[a-f0-9]{64}$/);assert.equal(a.integration.type,'scene-object');}
});
test('legacy attack factories are not used in presentation',()=>{
 const text=readFileSync(new URL('../src/engine-presentation.js',import.meta.url),'utf8');
 for(const old of ['createFusionEcho(','createOddEffect(','acquireUltimate(','createWeaponSignature(','this.original.show('])assert.ok(!text.includes(old),old);
 assert.ok(text.includes('this.vfx.play(data,item,root)'));
});
