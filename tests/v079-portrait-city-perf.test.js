import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {portraitVariant,signPortraitSeed} from '../src/sign-art.js';
import {CITY_LOTS,citySignArtOptions,citySignSpecs,cityShopSignSpec} from '../src/shared/city-layout.js';
import {GM_HOUSE_DEFAULT} from '../src/shared/arena.js';
globalThis.matchMedia??=()=>({matches:false});
const {TempleArena}=await import('../src/arena-view.js');
test('automatic city portraits cover all ten actual illustrations',()=>{
 const seen=new Set();for(const lot of CITY_LOTS){
  const signs=citySignSpecs(lot);
  for(const [variant,exists] of [[0,cityShopSignSpec(lot)],[1,signs.some(s=>s.blade)],[2,signs.some(s=>!s.blade)]]){
   const options=citySignArtOptions(lot,variant);
   if(exists&&options.style==='portrait')seen.add(portraitVariant(options.seed));
  }
 }
 assert.equal(seen.size,10);
 const bytes=readFileSync(new URL('../art/sign-portraits.webp',import.meta.url));
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.length,140170);
 assert.equal(signPortraitSeed('house-1'),signPortraitSeed('house-1'));
 assert.notEqual(signPortraitSeed('house-1'),signPortraitSeed('house-2'));
});
test('adding a different GM house retains existing geometry and materials',()=>{
 const arena=Object.create(TempleArena.prototype);arena.structureGroup=new THREE.Group();
 const a={id:'a',kind:'house',gmHouse:true,house:{...GM_HOUSE_DEFAULT},position:[80,0,0],rotation:0,hp:240,maxHp:240};
 const b={...a,id:'b',position:[90,0,0]};
 arena.world={structures:[a]};arena.syncStructures();
 const old=arena.structureGroup.children[0],geo=old.children[0].geometry;
 let disposed=0;geo.addEventListener('dispose',()=>disposed++);
 arena.world={structures:[a,b]};arena.syncStructures();
 assert.equal(arena.structureGroup.children[0],old);assert.equal(disposed,0);
 arena.world={structures:[{...a,position:[81,0,0]},b]};arena.syncStructures();
 assert.equal(arena.structureGroup.children[0],old);assert.equal(old.position.x,81);assert.equal(disposed,0);
 arena.world={structures:[b]};arena.syncStructures();assert.equal(disposed,1);
 arena.world={structures:[]};arena.syncStructures();
});