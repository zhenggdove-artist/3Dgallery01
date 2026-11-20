import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyWorldPatch,createWorldPatch} from '../src/shared/world-patch.js';
import {CITY_LOTS,cityCollapseProgress} from '../src/shared/city-layout.js';
import {cityDeformationTexture} from '../src/outer-city.js';
import {buildBrokenStructure,packRubble,packedRubbleMaterial} from '../src/city-ruins-vfx.js';
import {validateState} from '../src/shared/temple-rules.js';

test('432-lot snapshots send only changed records and reset them without stale geometry',()=>{
 const cityDamage=Object.fromEntries(CITY_LOTS.map(l=>[l.id,{hp:200,parts:{masonry:200}}]));
 const prev={revision:10,serverTime:1000,cityDamage,plants:[{id:'plant',text:'persistent'}],profile:{hp:100}};
 const id=CITY_LOTS[10].id,next={...prev,revision:13,serverTime:1180,cityDamage:{...cityDamage,[id]:{hp:130,parts:{masonry:130}}}};
 const patch=createWorldPatch(prev,next);assert.deepEqual(Object.keys(patch.city),[id]);
 assert.deepEqual(applyWorldPatch(prev,patch),next);assert.equal(applyWorldPatch(next,patch),null);
 assert.ok(JSON.stringify(patch).length<JSON.stringify(next).length/100);
 const clean={...next,cityDamage:{},revision:14};assert.deepEqual(applyWorldPatch(next,createWorldPatch(next,clean)),clean);
});
test('server labels immobilized and WRITE authority, but legal movement is not a position override',()=>{
 const previous={position:[0,0,0],rotation:0},next={position:[.76,0,0],rotation:0};
 assert.equal(validateState(previous,next,100,'fighter',null,null,1000).authority,undefined);
 const rooted=validateState(previous,next,100,'fighter',null,null,1000,{effects:{root:{until:1400}}});
 assert.deepEqual(rooted.state.position,previous.position);assert.deepEqual(rooted.authority,{kind:'immobilized',until:1400});
 const write=validateState(previous,next,100,'fighter',null,{origin:[0,0,0],start:500,expires:5000},1000);
 assert.equal(write.authority.kind,'write');assert.ok(write.state.position[1]>0);
 assert.equal(validateState(previous,{...next,position:[50,0,0]},100,'fighter',null,null,1000).error,'Movement rejected');
});
test('the city pose upload has fixed size, independent of vertex count or number of affected lots',()=>{
 const pose=cityDeformationTexture(CITY_LOTS),{data}=pose.texture.image;
 for(const lot of CITY_LOTS)pose.set(lot.index,5,.04,-.05);
 assert.equal(data.byteLength,24576);assert.ok(Math.abs(data[3]-cityCollapseProgress(5))<1e-6);
 const definition=data.slice(2048);pose.reset();assert.ok(data.slice(0,2048).every(x=>x===0));assert.deepEqual(data.slice(2048),definition);pose.texture.dispose();
});
test('packed debris preserves all triangles and their original appearance inputs in one mesh',()=>{
 const lot=CITY_LOTS[0],r=buildBrokenStructure(lot,18,.6,.9,.2,lot.color),mat=packedRubbleMaterial();let triangles=0;
 r.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
 const baked=packRubble(r,mat),g=baked.geometry;assert.equal(g.attributes.position.count/3,triangles);
 assert.equal(g.attributes.rubbleLocal.count,g.attributes.position.count);assert.ok(g.attributes.rubbleSurface.array.some(v=>v>1));
 let meshes=0;r.traverse(o=>{if(o.isMesh)meshes++;});assert.equal(meshes,1);
 assert.ok(new THREE.Box3().setFromObject(r).getSize(new THREE.Vector3()).length()>0);g.dispose();mat.dispose();
});
