import test from 'node:test';
import assert from 'node:assert/strict';
import {reuseHttpSceneFields} from '../src/shared/world-patch.js';
import {fusionRecordAt} from '../src/shared/fusion-instances.js';
import {readFileSync} from 'node:fs';
test('HTTP snapshot reuses equal scene objects without mutating incoming state or retaining changed data',()=>{
 const previous={revision:1,cityDamage:{a:{hp:50}},structures:[{id:'x'}],groundDrops:[{id:'a'}],profile:{hp:100}};
 const next=structuredClone(previous);next.revision=2;next.cityDamage.a.hp=0;next.profile.hp=80;
 const result=reuseHttpSceneFields(previous,next);
 assert.deepEqual(result,next);assert.equal(result.structures,previous.structures);assert.equal(result.groundDrops,previous.groundDrops);
 assert.equal(result.cityDamage,next.cityDamage);assert.equal(result.profile,next.profile);assert.notEqual(next.structures,previous.structures);
});
test('ordinary unfused UID lookup does not traverse unrelated inventory',()=>{
 const direct={weaponAffixes:[]};const profile={inventory:['saber-2'],inventoryInstances:[{uid:'one',itemId:'saber-2'}],fusion:{},fusionByInstance:{one:direct},fusionIdentityMigrated:true};
 profile.inventoryInstances.filter=()=>{throw Error('unnecessary full inventory scan');};
 assert.equal(fusionRecordAt(profile,0),direct);
});
test('receipt expiry index and response reuse preserve the full transaction',()=>{
 const worker=readFileSync(new URL('../cloudflare/worker.js',import.meta.url),'utf8');
 assert.match(worker,/CREATE INDEX IF NOT EXISTS request_receipts_created_at_idx ON request_receipts\(created_at\)/);
 assert.match(worker,/requestId,responseText,Date.now\(\)/);assert.match(worker,/return new Response\(responseText/);
});
