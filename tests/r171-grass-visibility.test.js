import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GrassField} from '../src/grass-field.js';

test('grass visibility retains seed order and refreshes a newly visible tile before drawing',()=>{
 const scene=new THREE.Scene(),grass=new GrassField(scene,{mobile:true,count:1800});
 const view=new THREE.PerspectiveCamera(54,4/3,.1,575),point=new THREE.Vector3();
 view.position.set(102,4,-50);
 try{
  const sources=[grass.mesh,grass.outerMesh].map(mesh=>{
   const geo=mesh.geometry,p=geo.getAttribute('aOffset'),h=geo.getAttribute('aHeight'),offsets=Array.from({length:h.count*2},(_,i)=>i%2?p.getY(i>>1):p.getX(i>>1)),heights=Array.from({length:h.count},(_,i)=>h.getX(i));
   const ids=new Map();for(let i=0;i<heights.length;i++)ids.set(offsets[i*2]+':'+offsets[i*2+1],i);
   return {geo,offsets,heights,ids};
  });
  for(const target of [[125,1,-24],[77,2,-77],[125,1,-24]]){
   view.lookAt(...target);grass.prepareVisibility(view);
   for(const {geo,offsets,heights,ids} of sources){
    const attr=geo.getAttribute('aOffset'),h=geo.getAttribute('aHeight'),seen=new Set();let previous=-1;
    for(let i=0;i<geo.instanceCount;i++){
     const original=ids.get(attr.getX(i)+':'+attr.getY(i));
     assert.ok(original>previous,'the upload is a subsequence, never a reordered batch');
     assert.equal(h.getX(i),heights[original]);seen.add(original);previous=original;
    }
    assert.ok(geo.instanceCount<heights.length);
    for(let i=0;i<heights.length;i++){
     point.set(offsets[i*2],.014,offsets[i*2+1]).project(view);
     if(Math.abs(point.x)<.995&&Math.abs(point.y)<.995&&Math.abs(point.z)<.9999)
      assert.ok(seen.has(i),'a blade rooted in the view is already resident in this frame');
    }
    const version=attr.data.version;grass.prepareVisibility(view);assert.equal(attr.data.version,version,'a repeated view uploads nothing');
   }
  }
 }finally{grass.dispose();}
});
