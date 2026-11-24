import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CITY_LOTS,CITY_MAX_HP,cityCollapsePosition,cityRoofHeightAtHp,
 cityRoofHeightAtPoint,cityAngularCornerCut} from '../src/shared/city-layout.js';
import {CityFireField,cityFirePower} from '../src/city-fire-field.js';
import {CitySplinterField} from '../src/city-splinter-field.js';
import {OuterCity} from '../src/outer-city.js';
import {readFileSync} from 'node:fs';

const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const lot=CITY_LOTS.find(x=>x.floors===4);
const textures=()=>({flame:new THREE.Texture(),smoke:new THREE.Texture()});

test('single two-draw-call fire field drives all city buildings, without per-house Points',()=>{
 const root=new THREE.Group(),tex=textures();
 const fire=new CityFireField(root,CITY_LOTS,tex,false);
 assert.equal(root.children.length,2);
 assert.equal(fire.layers.length,2);
 assert.equal(fire.layers[0].points.isPoints,true);
 assert.equal(fire.layers[1].points.isPoints,true);
 assert.equal(fire.layers[0].geometry.attributes.position.count,CITY_LOTS.length*18);
 assert.equal(fire.layers[1].geometry.attributes.position.count,CITY_LOTS.length*26);
 assert.equal(fire.layers[0].material.depthWrite,false);
 assert.ok(fire.layers[1].material.vertexShader.includes('aBurn'));
 fire.dispose();tex.flame.dispose();tex.smoke.dispose();
 assert.equal(root.children.length,0);
});

test('fire and embers persist indefinitely at 10% HP, with smoke becoming maximally dense',()=>{
 const root=new THREE.Group(),tex=textures();
 const fire=new CityFireField(root,CITY_LOTS,tex,true);
 assert.equal(cityFirePower(CITY_MAX_HP),0);
 assert.ok(cityFirePower(CITY_MAX_HP*.7)<cityFirePower(CITY_MAX_HP*.3));
 assert.equal(cityFirePower(CITY_MAX_HP*.1),1);
 fire.update(15);
 fire.setLot(lot,CITY_MAX_HP*.7);
 const offset=lot.index*fire.layers[0].count*3;
 assert.ok(fire.layers[0].burn[offset]>0);
 fire.setLot(lot,CITY_MAX_HP*.1);
 assert.equal(fire.layers[0].burn[offset],1);
 assert.equal(fire.layers[1].burn[lot.index*fire.layers[1].count*3],1);
 fire.update(1015); // No automatic expiration for a still-living house.
 assert.equal(fire.layers[0].burn[offset+2],0);
 assert.equal(fire.layers[0].burn[offset],1);
 assert.equal(root.children.length,2,'no new per-house smoke meshes may be spawned');
 fire.dispose();tex.flame.dispose();tex.smoke.dispose();
});

test('the lethal hit fades flame in 4.6s and smoke in 8s without reigniting on snapshots',()=>{
 const root=new THREE.Group(),tex=textures();
 const fire=new CityFireField(root,CITY_LOTS,tex,false);
 fire.update(10);
 fire.setLot(lot,CITY_MAX_HP*.1);
 fire.update(22);
 fire.setLot(lot,0);
 const layer=fire.layers[0],offset=lot.index*layer.count*3;
 assert.equal(layer.burn[offset],1);
 assert.equal(layer.burn[offset+1],22);
 assert.equal(layer.burn[offset+2],1);
 fire.update(23);
 fire.setLot(lot,0,CITY_MAX_HP,{snapshot:true});
 assert.equal(layer.burn[offset+1],22);
 assert.match(layer.material.vertexShader,/4\.6,8\./);
 fire.dispose();tex.flame.dispose();tex.smoke.dispose();
});

test('already-destroyed houses never re-ignite simply by joining the game',()=>{
 const root=new THREE.Group(),tex=textures();
 const fire=new CityFireField(root,CITY_LOTS,tex,true);
 fire.update(30);
 fire.setLot(lot,0,CITY_MAX_HP,{snapshot:true});
 const offset=lot.index*fire.layers[0].count*3;
 assert.equal(fire.layers[0].burn[offset],0);
 assert.equal(fire.layers[0].burn[offset+2],0);
 fire.dispose();tex.flame.dispose();tex.smoke.dispose();
});

test('late lethal combat event after an already-dead snapshot still fades from a full blaze',()=>{
 const root=new THREE.Group(),tex=textures();
 const fire=new CityFireField(root,CITY_LOTS,tex,true);
 fire.update(100);
 fire.setLot(lot,0,CITY_MAX_HP,{snapshot:true});
 fire.setLot(lot,0,CITY_MAX_HP,{live:true});
 const at=lot.index*fire.layers[0].count*3;
 assert.equal(fire.layers[0].burn[at],1);
 assert.equal(fire.layers[0].burn[at+1],100);
 assert.equal(fire.layers[0].burn[at+2],1);
 fire.dispose();tex.flame.dispose();tex.smoke.dispose();
});

test('five recognizable fragment types share five bounded InstancedMeshes, no new draws on hit',()=>{
 const root=new THREE.Group(),shards=new CitySplinterField(root,false);
 const before=root.children.slice();
 assert.equal(root.children.length,5);
 assert.deepEqual(before.map(x=>x.count),[92,92,92,92,92]);
 assert.ok(before.every(mesh=>mesh.isInstancedMesh&&mesh.geometry.attributes.color));
 shards.burst(lot,4,[lot.x,4,lot.z],1124,35);
 assert.equal(root.children.length,5);
 assert.ok([...shards.items.values()].reduce((n,p)=>n+p.records.filter(Boolean).length,0)>=35);
 shards.update(1/60);
 assert.equal(root.children.length,5);
 shards.reset();
 assert.ok([...shards.items.values()].every(p=>p.records.every(x=>x===null)));
 shards.dispose();
 assert.equal(root.children.length,0);
});

test('diagonal roof corners visibly shear meters without moving the physical roof center',()=>{
 const tier=1,corner=(lot.index&3);
 const sx=corner&1?-1:1,sz=corner&2?-1:1,cs=Math.cos(lot.yaw),sn=Math.sin(lot.yaw);
 const lx=sx*lot.width*.5,lz=sz*lot.depth*.5;
 const wx=lot.x+cs*lx+sn*lz,wz=lot.z-sn*lx+cs*lz;
 const cut=cityAngularCornerCut(lot,wx,lot.height+.13,wz,tier,true);
 assert.ok(Math.hypot(cut[0],cut[2])>1,'one corner moves substantially sideways');
 assert.ok(cut[1]<-.6,'one corner visibly drops to create diagonal rooftop loss');
 const roof=cityCollapsePosition(lot,lot.x,lot.height+.13,lot.z,tier,true);
 assert.ok(Math.abs(roof[1]-cityRoofHeightAtHp(lot,CITY_MAX_HP*.9))<1e-6);
 const edge=cityRoofHeightAtPoint(lot,wx,wz,CITY_MAX_HP*.9);
 assert.ok(edge<roof[1],'Worker collision tracks lowered oblique corner');
});

test('a late final blow never moves a building from the fully ruined tier back to tier nine',()=>{
 const city=Object.create(OuterCity.prototype),called=[];
 city.renderedTiers=new Map([[lot.index,10]]);
 city.collapseAnimations=new Map();
 city.prepareChunks=()=>{throw new Error('already-visible ruin must not prepare a replay');};
 city.createChunks=(...args)=>called.push(args);
 city.beginCollapse(lot,9,10,{id:'delayed-hit'});
 assert.equal(city.collapseAnimations.size,0,'must not animate backwards');
 assert.equal(called.length,1,'ensure low rubble exists without a full-height replay');
 assert.deepEqual(called[0],[lot,3,false]);
});

test('the fatal hit only reveals low grounded rubble and never respawns original-height floors',()=>{
 const city=Object.create(OuterCity.prototype),root=new THREE.Group();
 city.root=root;city.chunks=new Map();city.preparedChunks=new Map();city.preparingChunks=new Map();city.chunkBuildQueue=[];
 const mock=()=>new THREE.Group();
 const pieces=[0,1,2].map(i=>({index:i,mesh:mock(),home:new THREE.Vector3(0,lot.height*(i+.5)/3,0),
  h:lot.height/3,velocity:new THREE.Vector3(),moving:false,settled:true}));
 const effect={root:new THREE.Group(),pieces,stage:3,age:0};
 for(const p of pieces)effect.root.add(p.mesh);
 city.activatePreparedChunks(lot,effect);
 assert.equal(city.chunks.get(lot.index),effect);
 assert.ok(pieces.every(p=>p.settled&&!p.moving));
 assert.ok(pieces.every(p=>p.mesh.scale.y===.17));
 assert.ok(pieces.every(p=>p.mesh.position.y<lot.height*.2));
 city.createChunks(lot,3,true);
 assert.ok(pieces.every(p=>p.mesh.position.y<lot.height*.2),'second notification never regrows the house');
 assert.ok(pieces.every(p=>p.settled));
});
