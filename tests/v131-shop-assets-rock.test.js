import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createInitialWorld,ensureProfile,applyAction,migrateWorld,worldView} from '../src/shared/temple-rules.js';
import {SHOP_ITEMS,ITEMS,groundDropRoll,monsterDropRoll,itemById} from '../src/shared/catalog.js';
import {shopQualityIds,activePreviewItems} from '../src/shared/shop-retirement.js';
import {createRockDisguiseGeometry} from '../src/reletter/outfit-model.js';
const now=1000000,gm={key:'gm',name:'GM',color:'#ffffff',admin:true,role:'fighter',position:[75,0,0]},user={...gm,key:'p',name:'P',admin:false};
function setup(){const w=createInitialWorld(now);ensureProfile(w,gm.key,gm.name,gm.color,now,true);const p=ensureProfile(w,user.key,user.name,user.color,now,false);p.wallet=1e7;return {w,p};}
test('one native weapon recall covers five IDs; exotic grades are one ID; shop outfit variants share the same group',()=>{
 const {w,p}=setup(),ids=shopQualityIds('tide-3');assert.equal(ids.length,5);assert.deepEqual(shopQualityIds('giraffe'),['giraffe']);assert.deepEqual(shopQualityIds('outfit-pajamas-1'),[1,2,3,4,5].map(n=>'outfit-pajamas-'+n));
 for(const id of ids){assert.ok(!applyAction(w,user,{action:'buy',itemId:id},{now}).error);w.groundDrops.push({id:'drop-'+id,itemId:id,kind:'equipment'});}
 assert.equal(applyAction(w,user,{action:'gm-shop-delist',itemId:'tide-3'},{now}).error,'GM only');
 assert.ok(!applyAction(w,gm,{action:'gm-shop-delist',itemId:'tide-3'},{now}).error);
 for(const id of ids){assert.ok(Object.hasOwn(w.delistedShopItems,id));assert.ok(!p.inventory.includes(id));assert.ok(!w.groundDrops.some(d=>d.itemId===id));assert.ok(applyAction(w,user,{action:'buy',itemId:id},{now}).error);}
 assert.ok(!Object.hasOwn(w.delistedShopItems,'frost-3'));assert.ok(!applyAction(w,gm,{action:'gm-shop-relist',itemId:'tide-2'},{now}).error);
 assert.ok(ids.every(id=>!Object.hasOwn(w.delistedShopItems,id)));
});
test('permanent asset tombstones survive migration and cannot be relisted; boot skips removed IDs',()=>{
 const {w,p}=setup(),id='outfit-rock-disguise';
 assert.ok(!applyAction(w,user,{action:'buy',itemId:id},{now}).error);
 assert.equal(applyAction(w,user,{action:'gm-shop-remove-asset',itemId:id},{now}).error,'GM only');
 assert.ok(!applyAction(w,gm,{action:'gm-shop-delist',itemId:id},{now}).error);
 assert.ok(!applyAction(w,gm,{action:'gm-shop-remove-asset',itemId:id},{now}).error);
 const saved=migrateWorld(JSON.parse(JSON.stringify(w)));assert.ok(Object.hasOwn(saved.removedShopAssets,id));assert.equal(applyAction(saved,gm,{action:'gm-shop-relist',itemId:id},{now}).error,'Asset permanently removed');
 assert.ok(applyAction(saved,user,{action:'buy',itemId:id},{now}).error);
 assert.ok(!ensureProfile(saved,user.key,user.name,user.color,now+1,false).inventory.includes(id));assert.ok(!p.inventory.includes(id));assert.ok(Object.hasOwn(worldView(saved,user.key,now).removedShopAssets,id));
 const filtered=activePreviewItems(ITEMS,saved.removedShopAssets);assert.equal(filtered.length,ITEMS.length-1);assert.ok(!filtered.some(i=>i.id===id));assert.ok(itemById(id));assert.ok(SHOP_ITEMS.some(i=>i.id===id));
 for(let i=0;i<100;i++){assert.notEqual(groundDropRoll(()=>i/100,saved.delistedShopItems,saved.relistedShopItems).itemId,id);assert.notEqual(monsterDropRoll(()=>i/100,saved.delistedShopItems,saved.relistedShopItems).itemId,id);}
});
test('rock is one layered textured geometry, not low-poly primitives; stats unchanged',()=>{
 const g=createRockDisguiseGeometry(T),a=g.attributes.position;assert.ok(a.count>10000);assert.equal(g.attributes.color.count,a.count);assert.equal(g.attributes.normal.count,a.count);assert.ok(g.boundingBox.getSize(new T.Vector3()).length()>1);assert.ok(a.array.every(Number.isFinite));assert.equal(itemById('outfit-rock-disguise').templePrice,4800);assert.deepEqual(itemById('outfit-rock-disguise').bonuses,{hp:2.4,defense:.18,speed:-.08});g.dispose();
});
