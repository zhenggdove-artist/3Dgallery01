import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,applyAction,tickWorld,ensureProfile,worldView} from '../src/shared/temple-rules.js';
import {attackStats,WEAPONS} from '../src/shared/catalog.js';
import {attackStats as originalStats} from '../src/reletter/equipment-catalog.js';
import {PNG_APPEARANCE_DEFAULTS,APPEARANCE_DEFAULTS,validateAppearance,artworkAppearanceDefaults} from '../src/shared/artwork-library.js';
import {MONSTER_PACK_SIZE,spawnMonsterPack,monsterPosition} from '../src/shared/monster-pack.js';
import {ENEMY_HEIGHT,ENEMY_RADIUS} from '../src/shared/island-combat.js';
import {grassPositions} from '../src/grass-field.js';

const actor=(key,admin=false)=>({key,name:key,role:'fighter',admin,position:[70,0,0],color:'#33bbaa'});
test('every elemental staff spell uses exactly one third of RELETTER effective range',()=>{
 const ids=['water','ice','fire','lightning','beam','petal','wave'];
 const spells=WEAPONS.filter(w=>ids.includes(w.family));
 assert.ok(spells.length>=35);
 for(const spell of spells)for(const charge of [0,.5,1]){
  const original=originalStats(spell,charge),reduced=attackStats(spell,charge);
  assert.ok(Math.abs(reduced.range-original.range/3)<.002,spell.id+' at '+charge);
  assert.equal(reduced.damage,original.damage*(spell.id==='water'?10:1));
 }
 const melee=WEAPONS.find(w=>w.family==='pan');
 assert.equal(attackStats(melee,1).range,originalStats(melee,1).range);
});
test('PNG-specific authored artwork defaults are exact, with non-PNG unaffected',()=>{
 const expected={depth:0,brightness:.4,contrast:1,saturation:1.43,blackPoint:.1,tint:'#ffffff'};
 assert.deepEqual(PNG_APPEARANCE_DEFAULTS,expected);
 assert.deepEqual(validateAppearance({}, {type:'image/png'}),expected);
 assert.deepEqual(artworkAppearanceDefaults({format:'png'}),expected);
 assert.deepEqual(artworkAppearanceDefaults({mime:'image/png'}),expected);
 assert.deepEqual(validateAppearance({}, {type:'image/jpeg'}),APPEARANCE_DEFAULTS);
 assert.equal(validateAppearance({contrast:1.6},{type:'image/png'}).contrast,1.6);
});
test('five outer-arena monster spawns avoid the art sanctuary and are sixfold large',()=>{
 const world=createInitialWorld(1000);
 assert.equal(MONSTER_PACK_SIZE,5);
 const rng=(()=>{let seed=291;return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)})();
 assert.equal(spawnMonsterPack(world,2000,rng),true);
 assert.equal(world.monsters.length,5);
 assert.ok(world.monsters.every(m=>m.active&&m.hp>0&&Math.hypot(m.position[0],m.position[2])>=60));
 assert.equal(ENEMY_HEIGHT,1.575*6);
 assert.equal(ENEMY_RADIUS,.32*6);
 assert.equal(new Set(world.monsters.map(m=>m.id)).size,5);
 assert.equal(spawnMonsterPack(world,2001,rng),false);
 world.monsters[3].active=false;
 assert.equal(spawnMonsterPack(world,2002,rng),true);
 assert.equal(world.monsters.filter(m=>m.active).length,5);
 assert.equal(worldView(world,'visitor').monsters.length,5);
});
test('creator or GM can remove built structure immediately but strangers cannot',()=>{
 const world=createInitialWorld(1000),owner=actor('builder'),stranger=actor('visitor');
 world.structures=[{id:'wall-of-art',owner:'builder',kind:'wall',position:[70,0,3],hp:140,createdAt:1000}];
 assert.match(applyAction(world,stranger,{action:'remove-structure',structureId:'wall-of-art'},{now:2000}).error,/Only/);
 assert.equal(world.structures.length,1);
 const removed=applyAction(world,owner,{action:'remove-structure',structureId:'wall-of-art'},{now:2001});
 assert.ok(removed.structureDestroyed?.id==='wall-of-art');
 assert.equal(world.structures.length,0);
});
test('excavated holes and aquariums can be removed without discarding fish',()=>{
 const world=createInitialWorld(1000),owner=actor('owner'),visitor=actor('visitor');
 world.reletter={fishing:{
  holes:[{id:'user-hole',owner:'owner',position:[70,0,3],depth:2,fish:[]}],
  ponds:[{id:'user-pond',owner:'owner',position:[74,0,2],fish:[{id:'fish-a',owner:'visitor',species:'minnow'}]}],
  sessions:{owner:{hole:'user-hole'}},bags:{visitor:[]},revision:0
 }};
 assert.match(applyAction(world,visitor,{action:'remove-water-feature',id:'user-hole'},{now:2000}).error,/Only/);
 assert.equal(world.reletter.fishing.holes.length,1);
 const hole=applyAction(world,owner,{action:'remove-water-feature',id:'user-hole'},{now:2000});
 assert.equal(hole.waterFeatureRemoved?.id,'user-hole');
 assert.equal(world.reletter.fishing.holes.length,0);
 assert.equal(world.reletter.fishing.sessions.owner,undefined);
 const pond=applyAction(world,owner,{action:'remove-water-feature',id:'user-pond'},{now:2001});
 assert.equal(pond.waterFeatureRemoved?.id,'user-pond');
 assert.equal(world.reletter.fishing.ponds.length,0);
 assert.equal(world.reletter.fishing.bags.visitor.length,1);
 assert.ok(world.sceneArchive.removedWaterFeatures.length===2);
});
test('procedural grass distribution is deterministic, slender, and excludes central writing tree',()=>{
 const a=grassPositions(256,17456),b=grassPositions(256,17456);
 assert.deepEqual(a.points,b.points);
 assert.equal(a.heights.length,256);
 assert.ok(a.heights.every(h=>h>=.32&&h<=1.17));
 for(let i=0;i<256;i++)assert.ok(Math.hypot(a.points[i*2],a.points[i*2+1])>=10.99);
 const src=readFileSync(new URL('../src/grass-field.js',import.meta.url),'utf8');
 assert.match(src,/uPlayers\[6\]/);
 assert.match(src,/trample/);
 assert.match(src,/wind/);
});
