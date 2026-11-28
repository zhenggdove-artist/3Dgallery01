import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {acquireRootTexture,releaseRootTextures,outfitTextureResources,wingRenderKey,runtimeResource} from '../src/shared-render-resources.js';
import {disposeGardenModel,createWings} from '../src/reletter/garden-art.js';
import {readFileSync} from 'node:fs';
test('shared wing and loot texture leases balance over repeated creation and disposal',()=>{
 const before=outfitTextureResources.snapshot().references;
 for(let i=0;i<100;i++){
  const a=new T.Group(),b=new T.Group();let released=0,created=0;
  const create=()=>{created++;return new T.Texture();},drop=t=>{released++;t.dispose();};
  const t=acquireRootTexture(a,'test:lease',create,drop),same=acquireRootTexture(b,'test:lease',create,drop);
  assert.equal(t,same);assert.equal(created,1);
  a.add(new T.Sprite(new T.SpriteMaterial({map:t})));b.add(new T.Sprite(new T.SpriteMaterial({map:same})));
  disposeGardenModel(a);assert.equal(released,0);assert.equal(releaseRootTextures(a),false);
  disposeGardenModel(b);assert.equal(released,1);
 }
 assert.equal(outfitTextureResources.snapshot().references,before);
});
test('wing content changes cannot reuse an old texture',()=>{
 const item={id:'wing-x',design:'painted-wing',updatedAt:1,outline:[[0,0]]};
 assert.notEqual(wingRenderKey(item),wingRenderKey({...item,updatedAt:2}));
 assert.notEqual(wingRenderKey(item),wingRenderKey({...item,outline:[[1,0]]}));
});
test('actual authored wing canvases are shared only while owned and cleared on final release',()=>{
 const saved=globalThis.document;let canvases=0;
 const ctx=new Proxy({},{get:(o,k)=>o[k]??(k==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 globalThis.document={createElement:()=>{canvases++;return {width:0,height:0,getContext:()=>ctx};}};
 try{
  const item={id:'wing-1',color:'#ffffff',tier:1,style:0,design:'legacy'};
  const a=createWings(T,item),b=createWings(T,item),texture=a.userData.texture,canvas=texture.image;
  assert.equal(texture,b.userData.texture);assert.equal(canvases,1);assert.equal(canvas.width,512);
  disposeGardenModel(a);assert.equal(canvas.width,512);disposeGardenModel(b);assert.equal(canvas.width,0);assert.equal(canvas.height,0);
 }finally{globalThis.document=saved;}
});
test('warm previews and ground loot use the same disposal route, not a permanent bitmap cache',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 assert.match(read('src/item-preview.js'),/item.slot==='wings'\)\{disposeGardenModel\(model\)/);
 assert.match(read('src/reletter/swallowtail-art.js'),/swallowtailCanvas\(item,false\)/);
 assert.doesNotMatch(read('src/reletter/world-visuals.js'),/const lootTextures=new Map/);
 assert.match(read('src/reletter/world-visuals.js'),/retiredLootTextures.has\(t\)/);
 assert.match(read('src/build-style.js'),/manager.retire\('buildTexture'/);
});

test('cloning portrait nodes does not serialize live texture or material resources',()=>{
 const group=new T.Group();group.userData.wingId='test';const texture=new T.Texture();
 texture.toJSON=()=>assert.fail('Runtime texture must never be serialized');
 runtimeResource(group,'texture',texture);
 assert.equal(group.userData.texture,texture);
 const clone=group.clone();assert.equal(clone.userData.wingId,'test');assert.equal(clone.userData.texture,undefined);
 const item={id:'wing-x',design:'painted-wing',updatedAt:1,scaleX:1};
 assert.notEqual(wingRenderKey(item),wingRenderKey({...item,scaleX:1.5}));
});
