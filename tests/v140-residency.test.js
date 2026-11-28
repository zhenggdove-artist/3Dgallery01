import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {packTile,packAtlas,unpackAtlas,updateResidency,residencyView,farMesh} from '../src/render-residency.js';
import {forEachMaskEdge} from '../src/artwork-surface.js';
import {reuseHttpSceneFields} from '../src/shared/world-patch.js';
test('atlas packing retains every RGBA byte and supports edits while dormant',()=>{
 const pixels=new Uint8Array(16*16*4),words=new Uint32Array(pixels.buffer);words.fill(0x12345678);words[15]=0xaabbccdd;
 const packed=packAtlas(pixels,16,8);assert.equal(packed.filter(p=>typeof p==='number').length,3);assert.deepEqual(unpackAtlas(packed,16,8),pixels);
 const tile=new Uint8Array(8*8*4).fill(73);tile[12]=255;packed[2]=packTile(tile,8,8,0,0);
 for(let row=0;row<8;row++)pixels.set(tile.subarray(row*32,(row+1)*32),(8+row)*64);
 assert.deepEqual(unpackAtlas(packed,16,8),pixels);
});
test('retire only fully distant bounds, restore immediately before visibility',()=>{
 const camera=new THREE.PerspectiveCamera(55,1,.1,100),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2)),state={};
 mesh.position.z=-200;let sleeps=0,wakes=0;
 const update=now=>updateResidency(state,farMesh(mesh,residencyView(camera)),now,()=>sleeps++,()=>wakes++);
 update(0);update(14999);assert.equal(sleeps,0);update(15000);update(16000);assert.equal(sleeps,1);
 camera.position.z=-120;update(16001);assert.equal(wakes,1);assert.equal(state.dormant,false);mesh.geometry.dispose();
});
test('merged artwork boundary equals every original oriented unit edge',()=>{
 for(const mask of [[1,1,1,1,1,1,1,1,1],[1,1,0,1,0,1,0,1,1]]){
 const size=3,solid=(x,y)=>x>=0&&y>=0&&x<size&&y<size&&!!mask[y*size+x],old=[],fresh=[];
 const e=(x,y,X,Y)=>old.push([x,y,X,Y].join(','));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(solid(x,y)){if(!solid(x-1,y))e(x,y+1,x,y);if(!solid(x+1,y))e(x+1,y,x+1,y+1);if(!solid(x,y-1))e(x,y,x+1,y);if(!solid(x,y+1))e(x+1,y+1,x,y+1);}
 forEachMaskEdge(size,solid,(x,y,X,Y)=>{const dx=Math.sign(X-x),dy=Math.sign(Y-y);while(x!==X||y!==Y){fresh.push([x,y,x+dx,y+dy].join(','));x+=dx;y+=dy;}});
 assert.deepEqual(fresh.sort(),old.sort());
 }
});
test('same authoritative paint revision reuses archive identity',()=>{
 const old={spacePaintRevision:9,spacePaint:[{id:'a'}]},next={spacePaintRevision:9,spacePaint:[{id:'a'}]};
 assert.equal(reuseHttpSceneFields(old,next).spacePaint,old.spacePaint);
 const changed={spacePaintRevision:10,spacePaint:[{id:'b'}]};assert.equal(reuseHttpSceneFields(old,changed).spacePaint,changed.spacePaint);
});
