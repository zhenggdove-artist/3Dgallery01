import test from 'node:test';
import assert from 'node:assert/strict';
import {wingBounds,wingHandles,wingScaleFromDrag} from '../src/gm-wing-painter.js';
import {normalizePaintedWing} from '../src/shared/custom-wings.js';
const art={name:'Wing',tier:3,color:'#aabbcc',ability:'glide',abilities:['glide','swift','sparkle'],outline:[[.2,.3],[.6,.3],[.6,.7],[.2,.7]],strokes:[],scaleX:1,scaleY:1,impulse:10,gravity:.5,flapMs:300};
test('eight handles; corner proportional and opposite corner fixed; edge single-axis',()=>{const b=wingBounds(art),h=wingHandles(b);assert.equal(h.length,8);const corner=h.find(q=>q.hx===1&&q.hy===1),scaled=wingScaleFromDrag(art,b,corner,[.6,.7],[.7,.8]);assert.ok(Math.abs(scaled.scaleX-scaled.scaleY)<1e-9);const r=wingBounds({...art,...scaled});assert.ok(Math.abs(r.left-b.left)<1e-9&&Math.abs(r.top-b.top)<1e-9);const edge=h.find(q=>q.hx===1&&q.hy===0),single=wingScaleFromDrag(art,b,edge,[.6,.5],[.7,.7]);assert.equal(single.scaleY,1);assert.equal(single.offsetY,0);assert.ok(single.scaleX>1);});
test('GM multiple abilities and legacy single ability persist; invalid abilities rejected',()=>{assert.deepEqual(normalizePaintedWing(art,'wing').abilities,art.abilities);assert.deepEqual(normalizePaintedWing({...art,abilities:undefined},'wing').abilities,['glide']);assert.throws(()=>normalizePaintedWing({...art,abilities:['hack']},'wing'));});
