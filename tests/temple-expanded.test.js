import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,applyAction} from '../src/shared/temple-rules.js';
import {chargedArea,insideChargedArea} from '../src/shared/charge-area.js';
import {artBombDamage,projectileHitsActor} from '../src/shared/art-bomb.js';
import {WEAPONS,attackStats} from '../src/shared/catalog.js';
import {ARTWORK_DISCS,discGroundHeight} from '../src/shared/artwork-discs.js';

const actor=(key,position=[75,0,0])=>({key,name:key,color:'#123456',position,role:'fighter',admin:false});
test('every weapon has finite charge distance and a target rune outside the caster',()=>{
 assert.ok(WEAPONS.length>40);
 for(const weapon of WEAPONS){
  const stats=attackStats(weapon,1),area=chargedArea(weapon,[0,1,0],[0,0,1],stats);
  assert.ok(area.radius>=1&&Number.isFinite(area.radius),weapon.id);
  assert.ok(area.travel>=1&&area.travel<=area.range,weapon.id);
  assert.ok(area.center.every(Number.isFinite),weapon.id);
  assert.ok(area.center[2]>0,weapon.id);
 }
 const w=WEAPONS.find(w=>w.family==='ice'),area=chargedArea(w,[0,1,0],[0,0,1],attackStats(w,1));
 assert.equal(area.mode,'area');
 assert.equal(insideChargedArea(area,[area.center[0]+1,1,area.center[2]]),true);
 assert.equal(insideChargedArea(area,[999,1,999]),false);
});
test('all authored art-route discs have double visual/collision radii',()=>{
 assert.equal(ARTWORK_DISCS.length,75);
 assert.ok(ARTWORK_DISCS.every(d=>d.radius>=4.8));
 const p=ARTWORK_DISCS[0];
 assert.equal(discGroundHeight(p.position[0],p.position[2],p.top),p.top);
});
test('players own their uploaded artworks; ownership, size, and limits are enforced',()=>{
 const world=createInitialWorld(1000),owner=actor('owner'),other=actor('other');
 const original={action:'publish-art-bomb',artwork:{title:'My Art',position:[77,3,0],appearance:{depth:.1}},verifiedArtMedia:{id:'secure-id',type:'image/png'},size:2};
 const created=applyAction(world,owner,original,{now:2000});
 assert.ok(created.artwork?.bomb,created.error);
 const id=created.artwork.id,layout=world.artworkLayout[id];
 assert.deepEqual(layout.scale,[2,2,2]);assert.equal(created.artwork.owner,'owner');
 assert.equal(applyAction(world,other,{action:'resize-art-bomb',id,size:4},{now:2010}).error?.includes('Only'),true);
 assert.ok(applyAction(world,owner,{action:'resize-art-bomb',id,size:4},{now:2020}).artworkLayout);
 assert.deepEqual(world.artworkLayout[id].scale,[4,4,4]);
 assert.equal(applyAction(world,owner,{action:'resize-art-bomb',id,size:8},{now:2030}).error?.includes('0.5'),true);
 for(let i=0;i<3;i++)assert.ok(applyAction(world,owner,original,{now:2100+i}).artwork);
 assert.match(applyAction(world,owner,original,{now:3000}).error,/four art bombs/);
});
test('ballistic artwork bomb damage is 30–100% of maximum health before protection',()=>{
 assert.equal(artBombDamage(100,()=>0),30);
 assert.equal(artBombDamage(100,()=>1),100);
 const event={origin:[0,1.4,0],direction:[0,0,1],power:1};
 assert.equal(projectileHitsActor(event,[0,0,11],1.5,1),true);
 assert.equal(projectileHitsActor(event,[20,0,11],1.5,1),false);
});
