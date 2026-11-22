import test from 'node:test';
import assert from 'node:assert/strict';
import {PLATFORMS} from '../src/shared/arena.js';
import {readFileSync} from 'node:fs';
import {recoverMisplacedArtworkPosition} from '../src/shared/artwork-recovery.js';

function example(){
 const platform=PLATFORMS[0];
 const id=platform.id;
 const layout={position:[-100,12,6],scale:[2,1,1],rotation:[0,.5,0],
  appearance:{brightness:.6,tint:'#aabbcc'},platformRadius:7,revision:5};
 const world={revision:7,artworkLayout:{[id]:structuredClone(layout)},customArtworks:[]};
 return {platform,id,world,layout};
}
test('GM recovers only mistaken -100 coordinate of a hidden artwork and preserves all other edits',()=>{
 const {platform,id,world,layout}=example();
 const r=recoverMisplacedArtworkPosition(world,true,'',5000);
 assert.equal(r.ok,true);
 assert.equal(r.exact,false);
 assert.deepEqual(world.artworkLayout[id].position,[platform.artPosition[0],12,6]);
 assert.deepEqual(world.artworkLayout[id].scale,layout.scale);
 assert.deepEqual(world.artworkLayout[id].rotation,layout.rotation);
 assert.deepEqual(world.artworkLayout[id].appearance,layout.appearance);
 assert.equal(world.artworkLayout[id].platformRadius,7);
 assert.equal(world.artworkLayout[id].revision,6);
 assert.equal(world.revision,8);
 assert.equal(r.platformId,id);
});
test('GM can restore precise previous position if server has a prior layout snapshot',()=>{
 const {id,world}=example();
 world.artworkLayoutHistory={[id]:[{position:[18,7,9],rotation:[0,.3,0],revision:4}]};
 const r=recoverMisplacedArtworkPosition(world,true,'',5000);
 assert.equal(r.exact,true);
 assert.deepEqual(world.artworkLayout[id].position,[18,7,9]);
 assert.equal(world.artworkLayoutHistory[id].length,0);
});
test('GM recovery refuses multiple candidates, no candidate and non-GM actors',()=>{
 const {id,world}=example();
 assert.equal(recoverMisplacedArtworkPosition(world,false).error,'GM only');
 assert.equal(world.artworkLayout[id].position[0],-100);
 const other=PLATFORMS[1].id;
 world.artworkLayout[other]={position:[0,-100,5],revision:1};
 assert.match(recoverMisplacedArtworkPosition(world,true).error,/多件/);
 assert.equal(world.artworkLayout[id].position[0],-100);
 assert.equal(recoverMisplacedArtworkPosition(world,true,id).platformId,id);
 assert.match(recoverMisplacedArtworkPosition(world,true,id).error,/沒有 -100/);
});
test('custom user-uploaded artwork uses the creation position, never another artwork position',()=>{
 const world={revision:1,artworkLayout:{'art-custom':{
  position:[3,0,-100],scale:[1,1,1],rotation:[0,0,0],revision:1}},
  customArtworks:[{id:'art-custom',position:[11,2,-7]}]};
 const r=recoverMisplacedArtworkPosition(world,true);
 assert.equal(r.ok,true);
 assert.deepEqual(world.artworkLayout['art-custom'].position,[3,0,-7]);
});

test('GM panel and chat provide a server-authoritative lost-artwork recovery action',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const rules=readFileSync(new URL('../src/shared/temple-rules.js',import.meta.url),'utf8');
 assert.match(ui,/data-gm-action="recover-misplaced-artwork"/);
 assert.match(ui,/this\.emit\('server-action',\{action:'recover-misplaced-artwork'\}\)/);
 assert.match(main,/recoverposition/);
 assert.match(rules,/if\(body\.action==='recover-misplaced-artwork'\)/);
 assert.match(rules,/world\.artworkLayoutHistory\[platform\.id\]/);
});
