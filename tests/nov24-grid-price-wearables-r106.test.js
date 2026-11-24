import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,itemById,shopPrice,shopPurchaseVariant,SHOP_ITEMS} from '../src/shared/catalog.js';
import {createInitialWorld,ensureProfile,applyAction,worldView,migrateWorld} from '../src/shared/temple-rules.js';
import {appendInventoryInstance} from '../src/shared/fusion-instances.js';
import * as T from 'three';
import {createHeadgear,animateHeadgear,disposeHeadgear} from '../src/reletter/headgear-model.js';
const now=130000000,gm={key:'gm',name:'GM',admin:true,role:'fighter',position:[75,0,0]},p={...gm,key:'p',admin:false};
test('price override is GM-only, per quality, persistent and authoritative for player purchases',()=>{
 const w=createInitialWorld(now);ensureProfile(w,gm.key,gm.name,'#ffffff',now,true);const player=ensureProfile(w,p.key,p.name,'#ffffff',now,false);player.wallet=100000;
 const body={action:'gm-shop-price',itemId:'jellybrella',qualityTier:5,price:3210};
 assert.equal(applyAction(w,p,body,{now}).error,'GM only');assert.equal(applyAction(w,gm,body,{now}).error,undefined);
 assert.equal(shopPrice(shopPurchaseVariant('jellybrella',5),worldView(w,p.key,now).shopPrices),3210);
 assert.notEqual(shopPrice(shopPurchaseVariant('jellybrella',4),w.shopPrices),3210);
 const restored=migrateWorld(JSON.parse(JSON.stringify(w)),now);
 const buy=applyAction(restored,p,{action:'buy',itemId:'jellybrella',qualityTier:5,quantity:2,price:1},{now:now+1});
 assert.equal(buy.purchased.total,6420);assert.equal(restored.profiles[p.key].wallet,93580);
 const gmBuy=applyAction(restored,gm,{action:'buy',itemId:'jellybrella',qualityTier:5},{now:now+2});assert.equal(gmBuy.purchased.total,0);assert.equal(gmBuy.purchased.listTotal,3210);
 assert.equal(applyAction(restored,gm,{...body,price:null},{now:now+3}).error,undefined);assert.equal(Object.keys(restored.shopPrices).length,0);
});
test('new gear has twelve unique definitions, real head models and persistent acquisition order',()=>{
 const gear=ITEMS.filter(i=>i.r106Wearable);assert.equal(gear.length,12);assert.equal(new Set(gear.map(i=>i.id)).size,12);
 assert.ok(gear.every(i=>SHOP_ITEMS.includes(i)&&i.price>0&&Object.keys(i.bonuses).length>=2));
 for(const item of gear.filter(i=>i.slot==='head')){const mesh=createHeadgear(T,item);assert.ok(mesh.children.length>5);if(item.design==='hydra-dragon'){assert.equal(mesh.userData.hydraNecks.length,3);const j=mesh.userData.hydraNecks[0].joints[0];animateHeadgear(mesh,1,true);assert.notEqual(j.rotation.z,0);}disposeHeadgear(mesh);}
 const w=createInitialWorld(now),profile=ensureProfile(w,p.key,p.name,'#ffffff',now,false);appendInventoryInstance(profile,'hat-hydra-dragon','shop');const row=profile.inventoryInstances.at(-1);assert.ok(row.acquiredAt>0);ensureProfile(w,p.key,p.name,'#ffffff',now+1,false);assert.equal(profile.inventoryInstances.at(-1).acquiredAt,row.acquiredAt);
});
