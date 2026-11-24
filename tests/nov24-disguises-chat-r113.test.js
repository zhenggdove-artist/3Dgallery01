
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {itemById,SHOP_ITEMS} from '../src/shared/catalog.js';
import {createHeadgear,disposeHeadgear} from '../src/reletter/headgear-model.js';
test('all nine new wearables have unique stable shop IDs and correct slots',()=>{
 const ids=['hat-xi-mask','hat-putin-mask','hat-kim-mask','outfit-chimney-disguise','outfit-cardboard-disguise','outfit-garbage-bag-disguise','outfit-trash-can-disguise','outfit-postbox-disguise','outfit-wooden-horse-disguise'];
 for(const id of ids){const item=itemById(id);assert.ok(item,id);assert.equal(item.slot,id.startsWith('hat-')?'head':'outfit');assert.equal(SHOP_ITEMS.filter(v=>v.id===id).length,1);assert.ok(item.price>0);}
 assert.equal(itemById('outfit-chimney-disguise').disguiseHeight,3);
 assert.equal(itemById('outfit-wooden-horse-disguise').disguiseHeight,2);
});
test('portrait sculpts have individual geometry and full facial surfaces',()=>{
 const shapes=new Set();
 for(const id of ['hat-huang-mask','hat-xi-mask','hat-putin-mask','hat-kim-mask']){
  const root=createHeadgear(T,itemById(id));let face=null;
  root.traverse(o=>{if(o.isMesh&&o.geometry.getAttribute('position').count>10000)face=o.geometry;});
  assert.ok(face,id);shapes.add(Array.from(face.getAttribute('position').array.slice(1000,1020)).join(','));disposeHeadgear(root);
 }
 assert.equal(shapes.size,4);
});
test('minimized button owns a captured pointer, persists drag and suppresses click',()=>{
 const s=readFileSync(new URL('../src/chat-layout.js',import.meta.url),'utf8');
 assert.match(s,/let miniDrag=null/);assert.match(s,/toggle\.setPointerCapture\(e\.pointerId\)/);
 assert.match(s,/if\(mode!=='pending'\)ignoreClickUntil/);assert.match(s,/if\(mode==='move'\)save\(\)/);
});
