import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {COMFORT_ITEMS,groundDropRoll,groundDropVisualKind,itemById} from '../src/shared/catalog.js';
import {createInitialWorld,migrateWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {createCashDropGeometry,drawCashDropAtlas,comfortCashImage} from '../src/comfort-cash-art.js';
import {itemIcon} from '../src/reletter/item-art.js';
test('all three restorative drops use cash exclusively; fallback cannot display a staff',()=>{
 for(const item of COMFORT_ITEMS){
  for(const kind of ['consumable','equipment','weapon'])assert.equal(groundDropVisualKind({kind,itemId:item.id}),'cash');
  assert.equal(itemIcon(item),comfortCashImage(item));
 }
 assert.equal(groundDropVisualKind({kind:'consumable',itemId:'tide-1'}),null);
 assert.equal(groundDropVisualKind({kind:'weapon',itemId:'tide-1'}),'equipment');
 assert.equal(groundDropVisualKind({kind:'coin'}),'coin');
 const a=readFileSync(new URL('../src/adventure-view.js',import.meta.url),'utf8'),b=readFileSync(new URL('../src/arena-view.js',import.meta.url),'utf8');
 assert.match(a,/groundDropVisualKind\(d\)==='equipment'/);assert.match(b,/cash\?createCashDropGeometry\(THREE\)/);
});
test('persisted misclassified restorative loot is corrected, invalid legacy entry removed, pickup preserves actual denomination',()=>{
 const now=19000000,world=createInitialWorld(now),actor={key:'cash',name:'Cash',role:'fighter',color:'#fff',position:[75,0,0]};
 const p=ensureProfile(world,actor.key,actor.name,actor.color,now);
 world.groundDrops=COMFORT_ITEMS.map((item,i)=>({id:'cash-'+i,kind:'equipment',itemId:item.id,position:[75,0,0],expiresAt:now+10000}));
 world.groundDrops.push({id:'bad',kind:'consumable',itemId:'tide-1',position:[75,0,0],expiresAt:now+10000});
 migrateWorld(world,now);assert.equal(world.groundDrops.length,3);assert.ok(world.groundDrops.every(d=>d.kind==='consumable'));
 for(let i=0;i<3;i++){const r=applyAction(world,actor,{action:'pickup',dropId:'cash-'+i},{now:now+100+i,actors:[actor],rng:()=>.5});assert.equal(r.error,undefined);assert.ok(p.inventory.includes(COMFORT_ITEMS[i].id));}
});
test('cash geometry contains layered bills and wrap with finite atlas UVs',()=>{
 const geo=createCashDropGeometry(THREE),p=geo.attributes.position,u=geo.attributes.uv;
 assert.equal(p.count,16*36);assert.equal(u.count,p.count);assert.ok([...p.array,...u.array].every(Number.isFinite));assert.ok([...u.array].every(v=>v>=0&&v<=1));assert.ok(geo.boundingBox.max.y-geo.boundingBox.min.y>.26);geo.dispose();
});
test('each denomination atlas has its actual effect label and engraved face',()=>{
 for(const item of COMFORT_ITEMS){const labels=[];const gradient={addColorStop(){}};const ctx=new Proxy({},{get:(o,k)=>k==='createLinearGradient'?()=>gradient:k==='fillText'?(v)=>labels.push(v):()=>{},set:()=>true});drawCashDropAtlas(ctx,item.denomination);
 assert.ok(labels.includes('UNITED STATES OF AMERICA'));assert.ok(labels.includes(item.denomination===50?'MP +50%':item.denomination===20?'HP +30%':'HP +100%'));
 }
});
