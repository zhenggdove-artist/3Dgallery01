import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 CITY_LOTS,CITY_MAX_HP,cityFractureProfile,cityFractureProfiles,
 cityCollapsePosition,cityRoofHeightAtHp
} from '../src/shared/city-layout.js';
import {
 buildIrregularFractureChunk,buildingFireIntensity,createPersistentBuildingFire,
 setPersistentBuildingFire,updatePersistentBuildingFire,disposePersistentBuildingFire
} from '../src/city-ruins-vfx.js';
import {OuterCity} from '../src/outer-city.js';

const lot=CITY_LOTS.find(l=>l.floors===4);
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('each house has ten different reproducible angular fracture regions',()=>{
 const profiles=cityFractureProfiles(lot);
 assert.equal(profiles.length,10);
 assert.equal(cityFractureProfiles(lot),profiles,'cache should prevent per-vertex allocations');
 assert.equal(new Set(profiles.map(p=>p.tier)).size,10);
 assert.ok(new Set(profiles.map(p=>p.wall)).size>=3);
 assert.ok(new Set(profiles.map(p=>p.localY.toFixed(3))).size>=6);
 assert.ok(profiles.every(p=>p.width>0&&p.height>0&&p.depth>0));
 for(let tier=1;tier<=10;tier++)
  assert.equal(cityFractureProfile(lot,tier),profiles[tier-1]);
});

test('each detached structural loss is an irregular 3D polyhedron, not an untextured box',()=>{
 const group=buildIrregularFractureChunk(lot,5);
 const mass=group.children.find(x=>x.isMesh&&x.geometry.attributes.color);
 assert.ok(mass);
 assert.ok(mass.geometry.attributes.position.count>=70);
 assert.ok(mass.geometry.attributes.normal.count>=70);
 assert.equal(mass.geometry.type,'BufferGeometry');
 assert.ok(group.children.length>=4,'polyhedron includes exposed steel reinforcement');
 assert.ok(mass.material.onBeforeCompile,'native surface fracture shader');
 group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});

test('damage modifies nonuniform corners, while roofs stay aligned with physical floor center',()=>{
 const p1=cityCollapsePosition(lot,lot.x+lot.width*.15,lot.height*.62,lot.z+lot.depth*.37,5);
 const p2=cityCollapsePosition(lot,lot.x-lot.width*.15,lot.height*.62,lot.z-lot.depth*.37,5);
 assert.notDeepEqual(p1,p2);
 const equalOriginalY=lot.height*.62;
 const displacement1=equalOriginalY-p1[1],displacement2=equalOriginalY-p2[1];
 assert.ok(Math.abs(displacement1-displacement2)>1e-4);
 const roof=cityCollapsePosition(lot,lot.x,lot.height+.13,lot.z,7,true);
 assert.ok(Math.abs(roof[1]-cityRoofHeightAtHp(lot,CITY_MAX_HP*.3))<1e-6);
});

test('continuous flames and dense smoke peak at 10% HP instead of only spawning on hit',()=>{
 const root=new THREE.Group(),resources={flame:new THREE.Texture(),smoke:new THREE.Texture()};
 const fire=createPersistentBuildingFire(root,lot,resources,false);
 assert.equal(root.children.length,1);
 assert.deepEqual(fire.layers.map(x=>x.count),[72,122]);
 assert.equal(buildingFireIntensity(CITY_MAX_HP),0);
 assert.ok(buildingFireIntensity(CITY_MAX_HP*.8)<buildingFireIntensity(CITY_MAX_HP*.4));
 assert.equal(buildingFireIntensity(CITY_MAX_HP*.1),1);
 setPersistentBuildingFire(fire,CITY_MAX_HP*.8);
 updatePersistentBuildingFire(fire,1,1);
 const low=fire.power;
 setPersistentBuildingFire(fire,CITY_MAX_HP*.1);
 updatePersistentBuildingFire(fire,1,2);
 assert.ok(fire.power>low);
 assert.equal(fire.power,1);
 assert.ok(fire.layers[0].uniforms.uOpacity.value>0);
 assert.ok(fire.layers[1].uniforms.uOpacity.value>0);
 assert.equal(fire.layers[0].points.material.depthWrite,false);
 disposePersistentBuildingFire(fire);
 resources.flame.dispose();resources.smoke.dispose();
 assert.equal(root.children.length,0);
});

test('0 HP begins one eight-second extinction with fire vanishing before smoke',()=>{
 const root=new THREE.Group(),resources={flame:new THREE.Texture(),smoke:new THREE.Texture()};
 const fire=createPersistentBuildingFire(root,lot,resources,true);
 setPersistentBuildingFire(fire,0);
 assert.equal(updatePersistentBuildingFire(fire,3,3),false);
 const flame=fire.layers[0].uniforms.uOpacity.value;
 const smoke=fire.layers[1].uniforms.uOpacity.value;
 assert.ok(smoke>flame,'smoke hangs after flames diminish');
 setPersistentBuildingFire(fire,0);
 assert.equal(updatePersistentBuildingFire(fire,2,5),false,'repeated world snapshot cannot reset extinction timer');
 assert.equal(fire.layers[0].uniforms.uOpacity.value,0);
 assert.ok(fire.layers[1].uniforms.uOpacity.value>0);
 assert.equal(updatePersistentBuildingFire(fire,3.05,8.05),true);
 assert.equal(fire.layers[1].uniforms.uOpacity.value,0);
 disposePersistentBuildingFire(fire);resources.flame.dispose();resources.smoke.dispose();
});

test('the live city queues exactly one sculpted polyhedron per 10%-HP crossing',()=>{
 const city=Object.create(OuterCity.prototype),seen=[];
 city.pendingEjections=[];city.partsHidden=new Set();
 city.walls={userData:{partRanges:new Map()}};
 city.signs={userData:{lotRanges:new Map()}};
 city.hideRange=()=>{};
 city.hidePart=(i,part)=>seen.push(['hide',i,part]);
 city.spawnPlume=()=>{};
 city.eject=(...args)=>seen.push(['eject',...args]);
 for(let tier=1;tier<=10;tier++)city.emitCollapseStep(lot,tier);
 assert.equal(seen.filter(x=>x[0]==='eject').length,10);
 assert.equal(seen.filter(x=>x[0]==='hide'&&x[2].startsWith('fracture-')).length,10);
 for(let tier=1;tier<=10;tier++){
  assert.ok(seen.some(x=>x[0]==='eject'&&x[5]===tier));
  assert.ok(seen.some(x=>x[0]==='hide'&&x[2]==='fracture-'+tier));
 }
 assert.match(source('src/outer-city.js'),/category='fracture-'\+step/);
 assert.match(source('src/outer-city.js'),/this\.livingFires\.set\(lot\.index,fire\)/);
});
