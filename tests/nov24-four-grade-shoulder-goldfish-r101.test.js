import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHOP_ITEMS,SHOP_EXOTIC_TIERS,shopWeaponVariant,itemById} from '../src/shared/catalog.js';
import {advanceGoldfishSchool} from '../src/shared/goldfish-school.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('all sold weapons have four distinct priced qualities and valid numeric stats',()=>{
 for(const base of SHOP_ITEMS.filter(item=>item.slot==='weapon')){
  const variants=SHOP_EXOTIC_TIERS.map(tier=>shopWeaponVariant(base,tier));
  assert.deepEqual(variants.map(v=>v.shopTier),[1,2,3,4],base.id);
  assert.ok(variants.every(v=>v.id===base.id),base.id);
  assert.ok(variants.every((v,i)=>i===0||v.price>variants[i-1].price),base.id);
  assert.ok(variants.every((v,i)=>i===0||v.damage>variants[i-1].damage),base.id);
  assert.ok(variants.every(v=>Number.isFinite(v.damage)&&Number.isFinite(v.cooldown)),base.id);
  assert.equal(variants[2].price,base.price,base.id);
  if(!base.exotic)assert.ok(variants.every(v=>v.tier===base.tier),base.id);
 }
});
test('server persists each non-exotic shop grade and applies its combat stats',()=>{
 const now=4_200_000,actor={key:'shop-grade',name:'Shop Grade',role:'fighter',color:'#ffffff',position:[75,0,0]};
 const world=createInitialWorld(now),p=ensureProfile(world,actor.key,actor.name,actor.color,now);
 p.wallet=300_000;
 const base=itemById('tide-2'),low=shopWeaponVariant(base,1),high=shopWeaponVariant(base,4);
 const buy=(tier,time)=>applyAction(world,actor,{action:'buy',itemId:base.id,qualityTier:tier},{now:time,actors:[actor],rng:()=>.5});
 assert.equal(buy(1,now+10).purchased.total,low.price);
 assert.equal(buy(4,now+20).purchased.total,high.price);
 const copies=p.inventoryInstances.map((row,index)=>({...row,index})).filter(row=>row.itemId===base.id);
 assert.deepEqual(copies.map(row=>row.shopTier),[1,4]);
 applyAction(world,actor,{action:'equip',itemId:base.id,inventoryIndex:copies[1].index},{now:now+30,actors:[actor],rng:()=>.5});
 assert.equal(equippedItem(p,base).shopTier,4);
 assert.equal(equippedItem(p,base).damage,high.damage);
});
test('goldfish pursuit cannot reverse back toward its own player',()=>{
 const fx={origin:[0,2,0],launchDirection:[0,0,1],direction:[0,0,1],position:[0,2,5],range:25,travelled:5};
 for(let i=0;i<14;i++){
  const previous=fx.position[2];
  advanceGoldfishSchool(fx,{position:[0,0,-20]},160,4800);
  assert.ok(fx.position[2]>=previous);
  assert.ok(fx.direction[2]>=.70-1e-9);
 }
 assert.ok(fx.travelled<=fx.range);
});
test('mobile simultaneous healing and shoulder desktop charging route separately',()=>{
 const ui=read('src/ui.js'),gun=read('src/gun-controller.js');
 const controller=read('src/player-controller.js'),main=read('src/main.js');
 assert.match(ui,/hotbar\?\.addEventListener\('touchstart'/);
 assert.match(controller,/reconcileTouches/);
 assert.match(gun,/shoulderPress/);
 assert.match(gun,/canShoulderCharge/);
 assert.match(main,/shoulderMouse\)startHeldCharge\(\)/);
});
