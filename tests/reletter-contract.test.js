import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInitialWorld,createProfile,setArtworkLayout,migrateWorld} from '../src/shared/temple-rules.js';
import {EQUIPMENT} from '../src/reletter/equipment-catalog.js';
import {itemById} from '../src/shared/catalog.js';
import {playerStats,refreshStats} from '../src/shared/player-stats.js';
test('Golden Girdle is the exact original font binary',()=>{
 const hash=createHash('sha256').update(readFileSync(new URL('../src/reletter/FONTS/Golden Girdle.otf',import.meta.url))).digest('hex');
 assert.equal(hash,'46e61e171acb970eabd7cc9918c349b851c25d448563e4613b229f1b34ffa523');
});
test('Every original equipment ID is available without a renamed substitute',()=>{for(const item of EQUIPMENT){assert.equal(itemById(item.id)?.name,item.name);assert.equal(itemById(item.id)?.family,item.family);}});
test('GM layout validates permission, revision and finite transforms and survives serialization',()=>{
 const w=createInitialWorld(),p=createProfile('gm','Ely',null,Date.now(),true),body={platformId:'platform-01',expectedRevision:0,layout:{position:[2,3,4],rotation:[0,.2,0],scale:[2,1,1]}};
 assert.ok(setArtworkLayout(w,{...p,admin:false},body).error);
 assert.ok(setArtworkLayout(w,p,{...body,layout:{...body.layout,scale:[Infinity,1,1]}}).error);
 assert.ok(!setArtworkLayout(w,p,body).error);assert.ok(setArtworkLayout(w,p,body).error);
 assert.deepEqual(migrateWorld(JSON.parse(JSON.stringify(w))).artworkLayout['platform-01'].scale,[2,1,1]);
});
test('Original equipment affects stats and shields recharge',()=>{
 const w=createInitialWorld(),p=createProfile('p','Test');p.equipment.weapon=EQUIPMENT.find(i=>i.family==='petal').id;p.equipment.shield='shield-1';
 assert.ok(playerStats(w,p).speed>1);refreshStats(w,p,10000);assert.equal(p.shield.hp,20);
 p.shield.hp=0;p.shield.lastHit=10000;refreshStats(w,p,11000);assert.equal(p.shield.hp,0);refreshStats(w,p,30000);assert.equal(p.shield.hp,20);
});
