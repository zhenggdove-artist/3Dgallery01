import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createHeadgear,disposeHeadgear,animateHeadgear} from '../src/reletter/headgear-model.js';
import {attachOutfit,disposeOutfit} from '../src/reletter/outfit-model.js';
import {disposeGardenModel} from '../src/reletter/garden-art.js';
import {wearableResourceSnapshot,outfitTextureResources} from '../src/shared-render-resources.js';
import {RenderMemoryManager} from '../src/render-residency.js';
import {itemById} from '../src/shared/catalog.js';
test('equipped, preview and loot headwear share one owner lifecycle with idempotent disposal',()=>{
 const start=wearableResourceSnapshot().head.active,hat=createHeadgear(T,itemById('hat-elephant')),loot=new T.Group();loot.add(hat);
 let geometry,disposes=0;hat.traverse(o=>{if(!geometry&&o.geometry)geometry=o.geometry;});
 geometry.addEventListener('dispose',()=>disposes++);
 assert.equal(wearableResourceSnapshot().head.active,start+1);
 animateHeadgear(hat,1,true);disposeGardenModel(loot);assert.equal(disposes,1);
 assert.equal(disposeHeadgear(hat),false);assert.equal(disposes,1);
 assert.equal(wearableResourceSnapshot().head.active,start);
});
test('outfits restore owner counts and share immutable fabric until the last release',()=>{
 const saved=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})})};
 try{
  const item=itemById('outfit-pajamas-1'),before=wearableResourceSnapshot().outfit.active,refs=outfitTextureResources.snapshot().references;
  const rig=()=>{const model=new T.Group();for(const [name,y] of [['Head',1.5],['HeadTop_End',1.78],['Hips',.7],['Spine2',1.1]]){const b=new T.Bone();b.name=name;b.position.y=y;model.add(b);}return model;};
  const a=attachOutfit(T,rig(),item),b=attachOutfit(T,rig(),item);
  assert.ok(a&&b);assert.equal(a.texture,b.texture);assert.equal(wearableResourceSnapshot().outfit.active,before+2);
  let disposed=0;a.texture.addEventListener('dispose',()=>disposed++);
  assert.ok(disposeOutfit(a));assert.equal(disposeOutfit(a),false);assert.equal(disposed,0);
  assert.ok(disposeOutfit(b));assert.equal(disposed,1);assert.equal(outfitTextureResources.snapshot().references,refs);
  assert.equal(new RenderMemoryManager().snapshot().wearables.outfit.active,before);
 }finally{globalThis.document=saved;}
});
test('persistent repository contract and all production wearable paths use the central lifecycle',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 assert.match(read('AGENTS.md'),/Mandatory common wearable production pipeline/);
 assert.match(read('src/reletter/headgear-model.js'),/registerWearable\(root,'head'\)/);
 assert.match(read('src/reletter/outfit-model.js'),/registerWearable\(record,'outfit'\)/);
 assert.match(read('src/item-preview.js'),/disposeHeadgear\(model\)/);
 assert.match(read('src/reletter/garden-art.js'),/disposeHeadgear\(o\)/);
});
