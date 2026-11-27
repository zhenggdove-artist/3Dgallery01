import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createInitialWorld,ensureProfile,applyAction,migrateWorld} from '../src/shared/temple-rules.js';
import {SHOP_ITEMS,itemById,shopWeaponGroups} from '../src/shared/catalog.js';
import {shopQualityIds,activePreviewItems} from '../src/shared/shop-retirement.js';
import {buildSoftCardboard,addSwayingPoleWires,buildTreeDisguise,attachStreetMotion,animateExtraStreet,createColaStream,updateColaStream} from '../src/reletter/street-outfit-motion.js';
import {streetMotionStep} from '../src/reletter/street-outfits.js';
const mat=color=>new T.MeshStandardMaterial({color});
test('permanent removal matches all shop-card variants, including outfit collections, even after partial legacy removal',()=>{
 const now=1000000,w=createInitialWorld(now),gm={key:'gm',name:'GM',color:'#fff',admin:true,role:'fighter',position:[75,0,0]},a={...gm,key:'p',admin:false};ensureProfile(w,gm.key,gm.name,gm.color,now,true);const p=ensureProfile(w,a.key,a.name,a.color,now,false);p.wallet=1e7;
 for(const group of shopWeaponGroups(SHOP_ITEMS)){const ids=[...new Set(group.variants.map(v=>v.id))].sort();assert.deepEqual(shopQualityIds(group.base.id).sort(),ids,group.key);}
 const ids=shopQualityIds('outfit-pajamas-3');assert.equal(ids.length,5);for(const id of ids){assert.ok(!applyAction(w,a,{action:'buy',itemId:id},{now}).error);w.groundDrops.push({id:'drop-'+id,itemId:id,kind:'equipment'});}
 w.removedShopAssets[ids[0]]=now;w.delistedShopItems[ids[0]]=now;
 assert.ok(!applyAction(w,gm,{action:'gm-shop-remove-asset',itemId:ids[2]},{now}).error);
 const saved=migrateWorld(JSON.parse(JSON.stringify(w)));for(const id of ids){assert.ok(Object.hasOwn(saved.removedShopAssets,id));assert.ok(!p.inventory.includes(id));assert.ok(!saved.groundDrops.some(d=>d.itemId===id));}
 assert.equal(activePreviewItems(SHOP_ITEMS,saved.removedShopAssets).length,SHOP_ITEMS.length-5);assert.ok(!Object.hasOwn(saved.removedShopAssets,'outfit-silk-1'));
});
function drive(r,g,root,n=40){animateExtraStreet(r,0,root,.1,streetMotionStep);for(let i=1;i<=n;i++){root.position.x+=.12;animateExtraStreet(r,i*.1,root,.1,streetMotionStep);}}
test('tree and rock exactly request triple avatar height; tree crown and leaf rain respond to motion',()=>{
 for(const name of ['rock','tree'])assert.equal(itemById('outfit-'+name+'-disguise').disguiseHeight,3);
 const root=new T.Group(),g=new T.Group(),r={materials:[]};root.add(g);const t=buildTreeDisguise(T,g,r,mat);assert.ok(t.crown.children[0].count>4000);attachStreetMotion(T,g,'tree-disguise',r,mat);drive(r,g,root);assert.ok(r.treeMotion.motion.energy.value>.9);assert.ok(r.extraStreetMotion.batches[0].mesh.count>20);
});
test('cardboard has hollow moving walls and hinged flaps; cables deform and sparks remain cosmetic',()=>{
 for(const kind of ['cardboard-disguise','utility-pole-disguise']){const root=new T.Group(),g=new T.Group(),r={materials:[]};root.add(g);if(kind.startsWith('cardboard'))buildSoftCardboard(T,g,r,mat);else addSwayingPoleWires(T,g,r,mat,mat('#444'));attachStreetMotion(T,g,kind,r,mat);drive(r,g,root,12);if(r.cardboard){assert.equal(r.cardboard.flaps.length,4);assert.ok(r.cardboard.flaps[0].hinge.rotation.x<-1);assert.notDeepEqual(r.cardboard.walls[0].mesh.geometry.attributes.position.array,r.cardboard.walls[0].base);}else assert.notDeepEqual(r.poleWires.cables[0].mesh.geometry.attributes.position.array,r.poleWires.cables[0].base);}
});
test('cola has three continuous fine spray sheets and reaches double prior crest height',()=>{const g=new T.Group(),r={colaMotion:{open:1}};createColaStream(T,g,r,mat);updateColaStream(r.colaMotion,1);assert.equal(r.colaMotion.jet.sheets.length,3);let top=0;for(const mesh of r.colaMotion.jet.sheets){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++)top=Math.max(top,a.getY(i));}assert.ok(top-1.98>1.78);});
