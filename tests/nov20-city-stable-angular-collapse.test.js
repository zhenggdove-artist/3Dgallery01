import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CITY_LOTS,CITY_MAX_HP,cityAngularCornerCut,
 cityCollapsePosition,cityRoofHeightAtHp,cityDamageTier} from '../src/shared/city-layout.js';
import {OuterCity} from '../src/outer-city.js';

const lot=CITY_LOTS.find(l=>l.floors===4);

function corner(lot,id,y=lot.height+.13){
 const sx=(id&1)?-1:1,sz=(id&2)?-1:1;
 const lx=sx*lot.width*.5,lz=sz*lot.depth*.5;
 const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
 return [lot.x+c*lx+s*lz,y,lot.z-s*lx+c*lz];
}

test('reverted GPU smoke, polyhedral debris, and 4,320 extra fracture shells',()=>{
 const city=readFileSync(new URL('../src/outer-city.js',import.meta.url),'utf8');
 const vfx=readFileSync(new URL('../src/city-ruins-vfx.js',import.meta.url),'utf8');
 assert.doesNotMatch(city,/livingFires|buildIrregularFractureChunk|category='fracture-'\+step/);
 assert.doesNotMatch(vfx,/createPersistentBuildingFire|buildingFireIntensity|livingFireVertex/);
 assert.match(city,/this\.plumePool/,'stable pooled smoke and fire remain');
 assert.match(city,/this\.scrapPrefabs/,'stable shared detailed fragments remain');
});

test('each new 10% tier bevels a different diagonal corner without making meshes',()=>{
 const offset=lot.index&3;
 const results=[];
 for(let tier=1;tier<=4;tier++){
  const changed=[];
  for(let id=0;id<4;id++){
   const point=corner(lot,id);
   const before=cityAngularCornerCut(lot,...point,tier-1,true);
   const after=cityAngularCornerCut(lot,...point,tier,true);
   const delta=Math.hypot(...after.map((v,i)=>v-before[i]));
   if(delta>.0001)changed.push(id);
  }
  assert.deepEqual(changed,[(offset+tier-1)&3],'only one diagonal corner fractures per tier');
  results.push(changed[0]);
 }
 assert.equal(new Set(results).size,4);
 assert.deepEqual(cityAngularCornerCut(lot,...corner(lot,offset),0,true),[0,0,0]);
});

test('the diagonal cut stays cumulative and original solid roof center matches Worker collision',()=>{
 const target=corner(lot,lot.index&3);
 const drops=[];
 for(let tier=0;tier<=10;tier++){
  const cut=cityAngularCornerCut(lot,...target,tier,true);
  drops.push(Math.hypot(...cut));
  const roof=cityCollapsePosition(lot,lot.x,lot.height+.13,lot.z,tier,true);
  const hp=CITY_MAX_HP*(1-tier/10);
  assert.ok(Math.abs(roof[1]-cityRoofHeightAtHp(lot,hp))<1e-5);
 }
 for(let i=1;i<drops.length;i++)assert.ok(drops[i]>=drops[i-1]-1e-6);
 assert.ok(drops[1]>.02);
 assert.ok(drops[9]>drops[1]);
});

test('empty placeholder then authoritative damaged snapshot never replays old debris',()=>{
 const city=Object.create(OuterCity.prototype),calls=[];
 city.lots=[lot];city.damage={};city.lastDamage=null;
 city.collapseAnimations=new Map();
 city.facade={set:()=>{}};
 city.signs={userData:{lotRanges:new Map()}};
 city.collapseLot=(...args)=>calls.push(['pose',...args]);
 city.createChunks=(...args)=>calls.push(['chunks',...args]);
 city.hideRange=(...args)=>calls.push(['hideRange',...args]);
 city.hidePart=(...args)=>calls.push(['hidePart',...args]);
 city.beginCollapse=()=>{throw new Error('never replay a snapshot as historical impacts');};
 city.resetBuildings=()=>{throw new Error('no reset expected');};
 city.syncDamage({});
 city.syncDamage({[lot.id]:{hp:0,maxHp:CITY_MAX_HP}});
 assert.ok(calls.some(x=>x[0]==='pose'&&x[2]===10));
 assert.ok(calls.some(x=>x[0]==='chunks'&&x[2]===3&&x[3]===false));
});

test('live damage events still animate only newly crossed thresholds',()=>{
 const city=Object.create(OuterCity.prototype),calls=[];
 city.lots=CITY_LOTS;city.damage={};city.seenCityEvents=new Set();
 city.facade={set:()=>{}};
 city.flash=()=>calls.push('flash');
 city.beginCollapse=(...args)=>calls.push(args);
 city.applyDamageEvent({cityLotIndex:lot.index,id:'live-impact-1',
  previousHp:CITY_MAX_HP,previousTier:0,hp:CITY_MAX_HP*.7,
  maxHp:CITY_MAX_HP,damage:CITY_MAX_HP*.3});
 assert.ok(calls.includes('flash'));
 assert.equal(calls.filter(x=>Array.isArray(x)).length,1);
 assert.equal(calls.find(x=>Array.isArray(x))[2],cityDamageTier(CITY_MAX_HP*.7));
});
