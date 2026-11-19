import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CITY_LOTS,cityCollapsePosition} from '../src/shared/city-layout.js';
import {buildCityDeformationBasis,applyCityDeformationBasis,OuterCity} from '../src/outer-city.js';
import {CityFireField} from '../src/city-fire-field.js';
import {CitySplinterField} from '../src/city-splinter-field.js';

const lot=CITY_LOTS.find(x=>x.floors===4);
function originalPoints(lot){
 const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
 const arr=[];
 for(let y of [.15,lot.height*.2,lot.height*.47,lot.height*.73,lot.height+.13]){
  for(let x of [-lot.width*.5,-lot.width*.22,0,lot.width*.31,lot.width*.5]){
   for(let z of [-lot.depth*.5,-lot.depth*.19,0,lot.depth*.25,lot.depth*.5]){
    arr.push(lot.x+x*c+z*s,y,lot.z-x*s+z*c);
   }
  }
 }
 return new Float32Array(arr);
}

test('cached angular deformation exactly matches existing direct city geometry through all damage tiers',()=>{
 const original=originalPoints(lot),count=original.length/3;
 const half=original.length/3-25;
 const ranges=[[0,12],[18,half]];
 const basis=buildCityDeformationBasis(lot,original,0,count,ranges);
 for(const tier of [0,.1,.3,.85,1,1.14,2.2,3.5,4,5.31,7.7,9.48,10]){
  const result=original.slice();
  applyCityDeformationBasis(original,result,0,count,basis,tier,.035,-.015);
  for(let i=0;i<count;i++){
   const n=i*3,isRoof=ranges.some(([start,end])=>i>=start&&i<end);
   const direct=cityCollapsePosition(lot,original[n],original[n+1],original[n+2],tier,isRoof);
   for(let axis=0;axis<3;axis++){
    const offset=axis===0?.035:axis===2?-.015:0;
    assert.ok(Math.abs(result[n+axis]-direct[axis]-offset)<.00014,
     `tier=${tier} vertex=${i} axis=${axis} diff=${result[n+axis]-direct[axis]-offset}`);
   }
  }
 }
});

test('hidden fixtures never respawn while remaining wall vertices deform',()=>{
 const original=originalPoints(lot),count=original.length/3,positions=original.slice();
 const hidden=8*3;
 positions[hidden+1]=-120;
 const basis=buildCityDeformationBasis(lot,original,0,count,[]);
 applyCityDeformationBasis(original,positions,0,count,basis,4.5);
 assert.equal(positions[hidden+1],-120);
 assert.notEqual(positions[12*3+1],original[12*3+1]);
});

test('fivefold smoke and flame envelope uses shader early culling and keeps only two shared draws',()=>{
 const root=new THREE.Group(),textures={flame:new THREE.Texture(),smoke:new THREE.Texture()};
 const field=new CityFireField(root,CITY_LOTS,textures,false);
 assert.equal(root.children.length,2);
 const v=field.layers[0].material.vertexShader;
 assert.match(v,/float spread=1\.\+4\.\*power/);
 assert.match(v,/power<=\.0001 \|\| power<aFlow\.z \|\| ending<=\.0001/);
 assert.match(v,/gl_PointSize=0\./);
 assert.match(v,/size\*spread/);
 const fragment=field.layers[1].material.fragmentShader;
 assert.match(fragment,/1\.7,uSmoke/);
 field.update(24);field.setLot(lot,24);
 assert.equal(field.current.get(lot.index).dying,false);
 field.update(100);assert.equal(field.current.get(lot.index).dying,false);
 field.setLot(lot,0);
 assert.equal(field.current.get(lot.index).dying,true);
 assert.equal(root.children.length,2,'no per-damaged-house smoke meshes');
 field.dispose();textures.flame.dispose();textures.smoke.dispose();
});

test('retain high-density detailed parts, low-ground final wreck and 77cb8c5 per-frame allocation budget',()=>{
 const root=new THREE.Group(),shards=new CitySplinterField(root,false);
 assert.equal(root.children.length,5);
 shards.burst(lot,3,[lot.x,4,lot.z],77,20);
 assert.equal(root.children.length,5);
 shards.dispose();
 const city=Object.create(OuterCity.prototype),seen=[];
 city.pendingEjections=[];city.spawnEjection=(...args)=>seen.push(args);
 for(let i=0;i<18;i++)city.eject(lot,'windows-0-0',[lot.x,2,lot.z],true);
 city.processEjections();
 assert.equal(seen.length,1);
 assert.equal(city.pendingEjections.length,17);
 city.renderedTiers=new Map([[lot.index,10]]);
 city.collapseAnimations=new Map();
 city.createChunks=(...args)=>seen.push(args);
 city.prepareChunks=()=>{throw Error('Never rebuild upper floors');};
 city.beginCollapse(lot,9,10);
 assert.equal(city.collapseAnimations.size,0);
 assert.deepEqual(seen.at(-1),[lot,3,false]);
});
