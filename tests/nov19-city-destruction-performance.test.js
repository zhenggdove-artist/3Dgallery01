import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CITY_LOTS} from '../src/shared/city-layout.js';
import {OuterCity,markPositionRangeDirty} from '../src/outer-city.js';
import {buildBrokenStructure,emitFireSmoke,updateFireSmoke,disposePlume} from '../src/city-ruins-vfx.js';

test('one damaged lot invalidates only its own vertex buffer interval',()=>{
 const attr=new THREE.Float32BufferAttribute(new Float32Array(120),3);
 markPositionRangeDirty(attr,7,11);
 assert.deepEqual(attr.updateRanges,[{start:21,count:12}]);
 assert.ok(attr.version>0);
 attr.clearUpdateRanges();
 assert.deepEqual(attr.updateRanges,[]);
 markPositionRangeDirty(attr,0,0);
 assert.deepEqual(attr.updateRanges,[]);
});

test('fire and smoke are fully re-seeded without new geometry or particle materials',()=>{
 const root=new THREE.Group(),resources={flame:new THREE.Texture(),smoke:new THREE.Texture()};
 const first=emitFireSmoke(root,[1,2,3],resources,false,23);
 const geometry=first.clouds.map(layer=>layer.pts.geometry);
 const materials=first.clouds.map(layer=>layer.pts.material);
 const start=first.clouds[0].pts.geometry.attributes.position.array.slice();
 const counts=first.clouds.map(layer=>layer.data.length);
 assert.deepEqual(counts,[Math.ceil(35*.63),35]);
 assert.equal(root.children.length,1);
 updateFireSmoke(first,.5);
 first.root.removeFromParent(); // expiry returns it to the city pool
 const second=emitFireSmoke(root,[10,4,-8],resources,false,29,first);
 assert.equal(second,first);
 assert.equal(second.age,0);
 assert.deepEqual(second.root.position.toArray(),[10,4,-8]);
 assert.equal(root.children.length,1);
 assert.deepEqual(second.clouds.map(layer=>layer.data.length),counts);
 assert.deepEqual(second.clouds.map(layer=>layer.pts.geometry),geometry);
 assert.deepEqual(second.clouds.map(layer=>layer.pts.material),materials);
 assert.notDeepEqual(second.clouds[0].pts.geometry.attributes.position.array,start);
 assert.equal(second.clouds[0].pts.material.opacity,.95);
 assert.equal(second.clouds[1].pts.material.opacity,.6);
 disposePlume(second);
 resources.flame.dispose();resources.smoke.dispose();
});

test('complex rubble clones preserve every mesh but share expensive shader and geometry allocations',()=>{
 const lot=CITY_LOTS[0];
 const template=buildBrokenStructure(lot,18,.35,.46,.18,lot.detail);
 const clone=template.clone(true);
 const meshes=root=>{const out=[];root.traverse(o=>{if(o.isMesh)out.push(o);});return out;};
 const original=meshes(template),copy=meshes(clone);
 assert.ok(original.length>=10,'fragment keeps sculpted masonry, cut glass and metal details');
 assert.equal(original.length,copy.length);
 for(let i=0;i<original.length;i++){
  assert.equal(original[i].geometry,copy[i].geometry);
  assert.equal(original[i].material,copy[i].material);
 }
 clone.removeFromParent();
 template.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('debris cleanup preserves shared prefabs while disposing detached one-off fixtures',()=>{
 const city=Object.create(OuterCity.prototype);
 const root=new THREE.Group();
 const sharedGeo=new THREE.BoxGeometry(),sharedMat=new THREE.MeshBasicMaterial();
 const shared=new THREE.Mesh(sharedGeo,sharedMat);shared.userData.sharedCityScrap=true;root.add(shared);
 let sharedDisposals=0;sharedGeo.addEventListener('dispose',()=>sharedDisposals++);
 const ownedGeo=new THREE.BoxGeometry(),ownedMat=new THREE.MeshBasicMaterial();
 const owned=new THREE.Mesh(ownedGeo,ownedMat);root.add(owned);
 let ownedDisposals=0;ownedGeo.addEventListener('dispose',()=>ownedDisposals++);
 city.removeDebris({root,pieces:[{mesh:shared},{mesh:owned}]});
 assert.equal(sharedDisposals,0);
 assert.equal(ownedDisposals,1);
 sharedGeo.dispose();sharedMat.dispose();
});

test('full detailed collapse is preassembled a piece per frame and activated only after the final tier',()=>{
 const city=Object.create(OuterCity.prototype);
 city.chunks=new Map();city.preparedChunks=new Map();city.preparingChunks=new Map();
 city.chunkBuildQueue=[];city.root=new THREE.Group();city.mobile=false;
 const lot=CITY_LOTS[1];
 city.prepareChunks(lot);
 const job=city.preparingChunks.get(lot.index);
 assert.ok(job);
 assert.equal(job.pieces.length,0);
 city.stepChunkPreparation();
 assert.equal(job.pieces.length,1);
 assert.equal(job.root.parent,null,'hidden preassembly cannot leak into the current city');
 const expected=lot.floors+5;
 for(let i=1;i<expected;i++)city.stepChunkPreparation();
 assert.equal(city.chunkBuildQueue.length,0);
 assert.equal(city.preparingChunks.size,0);
 assert.equal(city.preparedChunks.get(lot.index)?.pieces.length,expected);
 city.createChunks(lot,3,true);
 const animated=city.chunks.get(lot.index);
 assert.equal(animated.pieces.length,expected);
 assert.equal(animated.root.parent,city.root);
 assert.ok(animated.pieces.every(piece=>piece.moving&&!piece.settled));
 city.disposePreparedChunks(animated);
});

test('one-hit destruction schedules complete sculptural detail without blocking its event',()=>{
 const city=Object.create(OuterCity.prototype);
 city.chunks=new Map();city.preparedChunks=new Map();city.preparingChunks=new Map();
 city.chunkBuildQueue=[];city.root=new THREE.Group();city.mobile=true;
 const lot=CITY_LOTS[2];
 city.createChunks(lot,3,true);
 assert.equal(city.chunks.size,0,'do not synchronously extrude every heavy piece on impact');
 const job=city.preparingChunks.get(lot.index);
 assert.equal(job.activate,true);
 const expected=lot.floors+5;
 for(let i=0;i<expected;i++)city.stepChunkPreparation();
 assert.equal(city.chunks.get(lot.index)?.pieces.length,expected);
 assert.equal(city.chunks.get(lot.index).root.parent,city.root);
 city.disposePreparedChunks(city.chunks.get(lot.index));
});
