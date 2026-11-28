import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CityVisibleIndices} from '../src/city-visible-indices.js';
test('city culls only fully out-of-view lots, restores exact indices and preserves static props',()=>{
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-20,1,0,-20,0,1,-20,0,0,-200,1,0,-200,0,1,-200,0,0,-250,1,0,-250,0,1,-250],3));
 g.setAttribute('cityLotId',new THREE.Float32BufferAttribute([0,0,0,1,1,1,-1,-1,-1],1));g.setIndex([0,1,2,3,4,5,6,7,8]);
 const b=new CityVisibleIndices(g),c=new THREE.PerspectiveCamera(55,1,.1,100),f=new THREE.Frustum(),m=new THREE.Matrix4();
 const update=()=>{c.updateMatrixWorld(true);f.setFromProjectionMatrix(m.multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));b.prepare(f);};
 update();assert.equal(g.drawRange.count,6);assert.deepEqual([...g.index.array.slice(0,6)],[0,1,2,6,7,8]);
 const version=g.index.version;update();assert.equal(g.index.version,version);
 c.far=300;c.updateProjectionMatrix();update();assert.equal(g.drawRange.count,9);assert.deepEqual([...g.index.array],[0,1,2,3,4,5,6,7,8]);g.dispose();
});

test('render-only compaction does not modify raycast index or draw range',()=>{
 const g=new THREE.BufferGeometry(),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());
 g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,-20,1,0,-20,0,1,-20,0,0,-200,1,0,-200,0,1,-200],3));
 g.setAttribute('cityLotId',new THREE.Float32BufferAttribute([0,0,0,1,1,1],1));g.setIndex([0,1,2,3,4,5]);
 let checked=false;mesh.raycast=()=>{checked=true;assert.deepEqual([...g.index.array],[0,1,2,3,4,5]);assert.equal(g.drawRange.count,6);};
 const b=new CityVisibleIndices(g,mesh),c=new THREE.PerspectiveCamera(55,1,.1,100),f=new THREE.Frustum();
 c.updateMatrixWorld(true);f.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse));b.prepare(f);
 const renderIndex=g.index;assert.equal(g.drawRange.count,3);mesh.raycast({},[]);assert.equal(checked,true);assert.equal(g.index,renderIndex);assert.equal(g.drawRange.count,3);g.dispose();mesh.material.dispose();
});
