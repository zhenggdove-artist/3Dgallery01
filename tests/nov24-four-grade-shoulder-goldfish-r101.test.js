import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHOP_ITEMS,SHOP_EXOTIC_TIERS,shopWeaponVariant,itemById,shopWeaponGroups} from '../src/shared/catalog.js';
import {advanceGoldfishSchool} from '../src/shared/goldfish-school.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('shop presents one weapon family with five colored qualities and rising prices',()=>{
 assert.deepEqual(SHOP_EXOTIC_TIERS,[1,2,3,4,5]);
 const groups=shopWeaponGroups(SHOP_ITEMS);
 for(const group of groups.filter(g=>g.base.slot==='weapon')){
  const variants=group.variants;
  assert.equal(variants.length,5,group.key);
  assert.deepEqual(variants.map(v=>v.shopTier),[1,2,3,4,5]);
  assert.ok(variants.every((v,i)=>i===0||v.price>variants[i-1].price),group.key);
  assert.ok(variants.every(v=>Number.isFinite(v.damage)&&Number.isFinite(v.cooldown)),group.key);
 }
 assert.deepEqual(groups.find(g=>g.key==='weapon:tide').variants.map(v=>v.id),
  ['tide-1','tide-2','tide-3','tide-4','tide-5']);
});
test('server persists each non-exotic shop grade and applies its combat stats',()=>{
 const now=4_200_000,actor={key:'shop-grade',name:'Shop Grade',role:'fighter',color:'#ffffff',position:[75,0,0]};
 const world=createInitialWorld(now),p=ensureProfile(world,actor.key,actor.name,actor.color,now);
 p.wallet=300_000;
 const low=shopWeaponVariant(itemById('tide-1'),1),high=shopWeaponVariant(itemById('tide-4'),4);
 const buy=(tier,time)=>applyAction(world,actor,{action:'buy',itemId:'tide-'+tier,qualityTier:tier},{now:time,actors:[actor],rng:()=>.5});
 assert.equal(buy(1,now+10).purchased.total,low.price);
 assert.equal(buy(4,now+20).purchased.total,high.price);
 const copies=p.inventoryInstances.map((row,index)=>({...row,index})).filter(row=>['tide-1','tide-4'].includes(row.itemId));
 assert.deepEqual(copies.map(row=>row.shopTier),[1,4]);
 applyAction(world,actor,{action:'equip',itemId:high.id,inventoryIndex:copies[1].index},{now:now+30,actors:[actor],rng:()=>.5});
 assert.equal(equippedItem(p,itemById(high.id)).shopTier,4);
 assert.equal(equippedItem(p,itemById(high.id)).damage,high.damage);
});
test('goldfish can turn toward a valid target behind it without extending travel budget',()=>{
 const fx={origin:[0,2,0],launchDirection:[0,0,1],direction:[0,0,1],position:[0,2,5],range:25,travelled:5};
 for(let i=0;i<14;i++)advanceGoldfishSchool(fx,{position:[0,0,-20]},160,2400);
 assert.ok(fx.direction[2]<-.95);
 assert.ok(fx.position[2]<5);
 assert.ok(fx.travelled<=fx.range+1e-9);
});
test('mobile simultaneous healing and shoulder desktop charging route separately',()=>{
 const ui=read('src/ui.js'),gun=read('src/gun-controller.js');
 const controller=read('src/player-controller.js'),main=read('src/main.js');
 assert.match(ui,/hotbar\?\.addEventListener\('touchstart'/);
 assert.match(controller,/reconcileTouches/);
 assert.doesNotMatch(gun,/shoulderPress/);
 assert.match(gun,/this\.mode=w\.id==='black-cat'\?2:1/);
 assert.doesNotMatch(main,/shoulderMouse/);
});
