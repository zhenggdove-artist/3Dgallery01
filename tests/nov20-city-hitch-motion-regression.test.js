import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
// Node tests do not have the browser's media-query global.
globalThis.matchMedia??=()=>({matches:false});
const {TempleArena}=await import('../src/arena-view.js');
import {OuterCity} from '../src/outer-city.js';
import {CITY_LOTS,CITY_MAX_HP} from '../src/shared/city-layout.js';
import {keepPredictedMoveOnLatencyReject} from '../src/shared/state-reconciliation.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('late but legal server rejections never step walking avatar backwards during combat load',()=>{
 const accepted=[0,0,0],submitted=[5,0,0],current=[14,0,0];
 assert.equal(keepPredictedMoveOnLatencyReject('Movement rejected',accepted,submitted,current,
  ()=>false,{sampleAgeMs:1200,authorityAgeMs:2400}),true,
  '9 metres of movement over 1.2 seconds is valid during an overloaded render frame');
 assert.equal(keepPredictedMoveOnLatencyReject('Movement rejected',accepted,submitted,current,
  ()=>true,{sampleAgeMs:1200,authorityAgeMs:2400}),false,
  'building collision remains authoritative');
 assert.equal(keepPredictedMoveOnLatencyReject('Movement rejected',accepted,submitted,[200,0,0],
  ()=>false,{sampleAgeMs:1200,authorityAgeMs:2400}),false,
  'server rejection still corrects unsupported teleports');
 assert.equal(keepPredictedMoveOnLatencyReject('Invalid position',accepted,submitted,current,
  ()=>false,{sampleAgeMs:1200,authorityAgeMs:2400}),false);
 assert.match(read('src/main.js'),/authorityAgeMs:performance\.now\(\)-\(network\.lastAuthorityAt\|\|sent\.sentAt\)/);
});

test('damage-only built structure HP changes preserve existing GPU objects and original shape',()=>{
 const arena=Object.create(TempleArena.prototype);
 arena.structureGroup=new THREE.Group();
 const shapes=[
  {id:'hit-house',kind:'house',position:[7,0,4],rotation:.2,hp:220,maxHp:220,variant:1},
  {id:'hit-tree',kind:'tree',position:[17,0,6],rotation:0,hp:90,maxHp:90,variant:2}
 ];
 arena.world={structures:shapes};
 arena.syncStructures();
 const meshes=[...arena.structureGroup.children];
 assert.ok(meshes.length>=5);
 const geometries=meshes.map(m=>m.geometry),materials=meshes.map(m=>m.material);
 let disposal=0;for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposal++);
 const house=meshes.find(m=>m.userData.records.some(v=>v.id==='hit-house'));
 assert.ok(house);
 const pristine=house.userData.pristineMatrices[0].clone();
 const initial=new THREE.Matrix4();house.getMatrixAt(0,initial);
 for(let hp=210;hp>=60;hp-=10){
  arena.world={structures:[{...shapes[0],hp},shapes[1]]};
  arena.syncStructures();
  assert.ok(meshes.every((m,i)=>arena.structureGroup.children[i]===m),
   'HP damage must update instance buffers, not recreate meshes');
 }
 const after=new THREE.Matrix4();house.getMatrixAt(0,after);
 assert.notDeepEqual(after.elements,initial.elements,'building still visibly collapses with damage');
 assert.deepEqual(house.userData.pristineMatrices[0].elements,pristine.elements,
  'damage transforms never accumulate onto their own already-worn mesh');
 assert.ok(meshes.every((m,i)=>m.geometry===geometries[i]&&m.material===materials[i]));
 assert.equal(disposal,0,'no resource re-upload/compilation triggered by combat HP');
 for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}
});

test('unchanged cloned city snapshots skip expensive damage reapplication',()=>{
 const city=Object.create(OuterCity.prototype),lot=CITY_LOTS[0];
 city.lots=[lot];city.damage={};city.lastDamage=null;city.collapseAnimations=new Map();
 let facade=0,smoke=0,collapse=0;
 city.facade={set:()=>facade++};
 city.fireField={setLot:()=>smoke++};
 city.collapseLot=()=>collapse++;
 city.hidePart=()=>{};city.hideRange=()=>{};city.signs={userData:{lotRanges:new Map()}};
 const damaged={[lot.id]:{hp:CITY_MAX_HP*.75,maxHp:CITY_MAX_HP,parts:{masonry:60}}};
 city.syncDamage(damaged);
 assert.equal(facade,1);assert.equal(smoke,1);
 for(let i=0;i<500;i++)city.syncDamage(structuredClone(damaged));
 assert.equal(facade,1);assert.equal(smoke,1);
 const newer=structuredClone(damaged);newer[lot.id].hp-=20;
 city.syncDamage(newer);
 assert.equal(facade,2);assert.equal(smoke,2);
 assert.ok(collapse>=1,'full structural damage presentation remains available');
});

test('Worker decouples combat tick rate from heavy full-world broadcasts',()=>{
 const worker=read('cloudflare/worker.js');
 assert.match(worker,/now-\(this\.lastCombatWorldAt\|\|0\)>=180/);
 assert.match(worker,/this\.save\(world\);\s*\/\/ Full world views/);
 assert.match(worker,/for\(const impact of artworkVisualEvents\)/,'all architecture events must still be broadcast');
});

test('a new module release also updates CSS and startup diagnostics to avoid stale control code',()=>{
 const html=read('index.html'),newRelease='20261120-motion-city-hitch-r30';
 assert.ok(html.includes(newRelease));
 assert.ok(!html.includes('20261120-soft-giraffe-contact-r29'));
 assert.ok((html.split(newRelease).length-1)>=5);
});

test('many simultaneous city collapses pin high-detail deformation caches until completion',()=>{
 const city=Object.create(OuterCity.prototype);
 city.mobile=true;city.deformationBasis=new Map();
 city.collapseAnimations=new Map();city.shakes=new Map();
 for(let i=0;i<26;i++){
  city.collapseAnimations.set(i,{tier:0,target:7,elapsed:0});
  city.deformationBasis.set(i,[new Float32Array(2500)]);
 }
 city.pruneDeformationBasis();
 assert.equal(city.deformationBasis.size,26,
  'active houses cannot evict one another and rebuild their geometry every frame');
 city.collapseAnimations.clear();
 city.pruneDeformationBasis();
 assert.equal(city.deformationBasis.size,12,
  'stale cache entries are reclaimed after effects end');
});
