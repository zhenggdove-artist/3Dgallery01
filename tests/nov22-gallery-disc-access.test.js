import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ARTWORK_DISCS,ART_DISPLAY_DISCS} from '../src/shared/artwork-discs.js';
import {PLATFORMS} from '../src/shared/arena.js';
import {DisplayPlatforms} from '../src/display-platforms.js';

test('three access routes keep all original art anchors, at approximately half altitude',()=>{
 assert.equal(ARTWORK_DISCS.length,39);
 assert.equal(ART_DISPLAY_DISCS.length,12);
 assert.equal(PLATFORMS.length,13);
 assert.ok(ARTWORK_DISCS.every(d=>d.step>=0&&d.step<=12&&d.radius>=9.6&&d.radius<=16));
 assert.ok(PLATFORMS.slice(1).every(p=>p.size[1]>0&&p.size[1]<14));
 assert.equal(new Set(PLATFORMS.map(p=>p.id)).size,13);
});

test('access decks have fewer, twice-as-wide stairs and gentle visual-only floating',()=>{
 const arena={scene:new THREE.Scene(),artworks:new Map(),defaultLayout:{},world:null,clock:0};
 for(const d of PLATFORMS){
  const root=new THREE.Object3D();
  root.userData.displayBounds=new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));
  arena.artworks.set(d.id,root);
 }
 const display=new DisplayPlatforms(arena);
 display.sync();
 const decks=display.discs.filter(d=>d.display),stairs=display.discs.filter(d=>d.stair);
 assert.equal(decks.length,13);
 assert.equal(stairs.length,PLATFORMS.slice(1).reduce((n,p)=>n+Math.max(5,Math.ceil(p.size[1]/1.7)),0));
 assert.ok(stairs.every(d=>d.radius===5.4));
 assert.ok(decks.every(d=>d.radius>=4.8&&d.radius<=14));
 const step=stairs[0],idx=display.discs.indexOf(step);
 const ground=display.ground(step.position[0],step.position[2],step.top);
 const a=new THREE.Matrix4(),b=new THREE.Matrix4();
 display.mesh.getMatrixAt(idx,a);
 display.update(4.2);
 display.mesh.getMatrixAt(idx,b);
 assert.notEqual(a.elements[13],b.elements[13]);
 assert.ok(Math.abs(b.elements[13]-step.position[1])<=.076);
 assert.equal(display.ground(step.position[0],step.position[2],step.top),ground,'collisions remain authoritative and steady');
 assert.equal(display.pedestals.count,13);
});
