import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {CityWallPaint} from '../src/city-wall-paint.js';
import {addEpicDust,animateEpicDust} from '../src/engine/epic-specimens.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('finished paint remains pending across snapshots until acknowledgement',()=>{
 const p=Object.create(CityWallPaint.prototype),stroke={lotId:'lot',wall:'front',clientId:'a',points:[[.1,.2]]},slot={strokes:[],pending:[],preview:stroke,stamp:''};
 p.surfaces=new Map([['lot/front',slot]]);p.revision=-1;p.slot=()=>slot;p.draw=()=>{};p.disposeSlot=()=>assert.fail('pending paint removed');
 p.queuePreview(stroke);assert.equal(slot.preview,null);assert.equal(slot.pending.length,1);
 p.sync({},1);assert.equal(slot.pending.length,1);assert.equal(p.surfaces.size,1);
 p.ackPreview(stroke,{...stroke,id:'paint-1'});assert.equal(slot.pending.length,0);assert.equal(slot.strokes[0].id,'paint-1');
});
test('fine dust uses 1440 GPU animated points at one tenth diameter',()=>{
 const root=new T.Group();addEpicDust(T,root);const dust=root.userData.epicDust;assert.equal(dust.geometry.attributes.position.count,1440);assert.equal(dust.material.size,.0035);
 animateEpicDust(root,4);assert.equal(dust.userData.clock.value,4);
});
test('login retries reuse verified account; old music never plays',()=>{
 assert.match(read('src/main.js'),/ui\.firebaseIdToken\|\|await signInWithGoogle\(\)/);
 assert.doesNotMatch(read('src/game-audio.js'),/backgroundmusic\.MP3/);
 assert.match(read('src/main.js'),/syncWorld\(\);audio\.startMusic\(\)/);
 assert.doesNotMatch(read('src/gm-wing-painter.js'),/data-wing-material/);
 assert.match(read('src/gm-wing-painter.js'),/移動翅膀輪廓圖/);
});
