import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {normalizePaintedWing,wingContours} from '../src/shared/custom-wings.js';
import {wingBounds,reflectWingArtwork} from '../src/gm-wing-painter.js';
import {addEpicDust,animateEpicDust} from '../src/engine/epic-specimens.js';
const contours=[{points:[[.1,.1],[.25,.1],[.2,.25]],color:'#f00000',size:4},{points:[[.6,.6],[.9,.6],[.7,.9]],color:'#00f000',size:14},{points:[[.4,.1],[.5,.1],[.45,.2]],color:'#0000f0',size:7}];
const raw={name:'Three contours',tier:3,color:'#ffffff',abilities:['sparkle'],shape:'freehand',contours,strokes:[],scaleX:1,scaleY:1,impulse:10,gravity:.58,flapMs:300,drawRatePct:0};
test('all independent contours and per-contour ink survive authoritative round trip',()=>{
 const item=normalizePaintedWing(raw,'test');
 assert.deepEqual(item.contours,contours);
 assert.deepEqual(item.outline,contours[0].points);
 assert.deepEqual(normalizePaintedWing(JSON.parse(JSON.stringify(item)),'test').contours,contours);
 const legacy=normalizePaintedWing({...raw,contours:undefined,outline:contours[0].points},'old');
 assert.equal(wingContours(legacy)[0].size,8);
 assert.throws(()=>normalizePaintedWing({...raw,contours:[{...contours[0],size:91}]},'bad'));
 assert.throws(()=>normalizePaintedWing({...raw,contours:Array(25).fill(contours[0])},'bad'));
});
test('mirror and handles include every independent contour',()=>{
 const b=wingBounds(raw);assert.ok(Math.abs(b.left-.1)<1e-9&&Math.abs(b.right-.9)<1e-9);
 const r=reflectWingArtwork(raw);assert.deepEqual(r.contours.map(c=>c.color),contours.map(c=>c.color));
 assert.equal(r.contours[0].points[0][0],.9);assert.equal(r.contours.length,3);
});
test('dust birth batches remain at original world position as player moves',()=>{
 const root=new T.Group();addEpicDust(T,root);animateEpicDust(root,1,0);
 const d=root.userData.epicDust.userData,old=d.left.value[0].clone();
 root.position.x=10;animateEpicDust(root,1.1,.1);assert.equal(d.next,1);
 animateEpicDust(root,1.4,Math.PI);assert.equal(d.next,2);
 assert.deepEqual(d.left.value[0].toArray(),old.toArray());assert.ok(d.left.value[1].x>9);
 assert.equal(d.births.value[1],1.4);
});
