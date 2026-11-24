import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOP_ITEMS,ITEMS,EQUIPPABLE_SLOTS,shopWeaponGroups,shopPurchaseVariant,shopPrice,itemById} from '../src/shared/catalog.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
const actor={key:'shop-regression',name:'Shop Test',color:'#abcdef',role:'fighter',admin:false,position:[0,0,0]};
const create=()=>{const world=createInitialWorld(1000);const profile=ensureProfile(world,actor.key,actor.name,actor.color,1000,false);profile.wallet=100000000;return {world,profile};};
const act=(world,body)=>applyAction(world,actor,body,{now:1000,rng:()=>.5});
test('armor is not offered or equippable; all displayed variants resolve on server',()=>{
 assert(!EQUIPPABLE_SLOTS.includes('armor'));
 assert(!ITEMS.some(i=>i.slot==='armor'));
 assert(!SHOP_ITEMS.some(i=>i.slot==='armor'));
 for(const {variants} of shopWeaponGroups(SHOP_ITEMS))for(const v of variants){
  const resolved=shopPurchaseVariant(v.id,v.shopTier);
  assert(resolved,`Unpurchasable variant: ${v.id} / ${v.shopTier}`);
  assert.equal(shopPrice(resolved),shopPrice(v));
 }
});
test('every catalog wearable is purchasable and equippable by an ordinary player',()=>{
 const {world,profile}=create();
 for(const item of SHOP_ITEMS.filter(i=>['head','outfit'].includes(i.slot))){
  const purchase=act(world,{action:'buy',itemId:item.id,quantity:1});
  assert(!purchase.error,item.id+': '+purchase.error);
  const i=profile.inventory.lastIndexOf(item.id);
  assert(i>=0,item.id);
  const equip=act(world,{action:'equip',itemId:item.id,inventoryIndex:i});
  assert(!equip.error,item.id+': '+equip.error);
  assert.equal(profile.equipment[item.slot],item.id);
 }
});
test('bulk sale matches actual rarity and UID, preserves equipped and other grades',()=>{
 const {world,profile}=create();
 const buy=(id,qualityTier,quantity)=>act(world,{action:'buy',itemId:id,qualityTier,quantity});
 assert(!buy('white-cat',1,3).error);
 assert(!buy('white-cat',2,1).error);
 const whites=profile.inventoryInstances.filter(r=>r.itemId==='white-cat'&&r.shopTier===1);
 const green=profile.inventoryInstances.find(r=>r.itemId==='white-cat'&&r.shopTier===2);
 const index=profile.inventoryInstances.findIndex(r=>r.uid===whites[0].uid);
 assert(!act(world,{action:'equip',itemId:'white-cat',inventoryIndex:index}).error);
 const request={action:'sell-bulk',slot:'weapon',rarity:'common'};
 assert(act(world,{...request,uids:[whites[0].uid]}).error);
 assert(act(world,{...request,uids:[green.uid]}).error);
 const before=profile.wallet;
 assert(!act(world,{...request,uids:whites.slice(1).map(r=>r.uid)}).error);
 assert(profile.wallet>before);
 assert(profile.inventoryInstances.some(r=>r.uid===whites[0].uid));
 assert(profile.inventoryInstances.some(r=>r.uid===green.uid));
 assert(whites.slice(1).every(r=>!profile.inventoryInstances.some(v=>v.uid===r.uid)));
});
test('single sale selects the specific duplicate instead of equipped first copy',()=>{
 const {world,profile}=create();
 assert(!act(world,{action:'buy',itemId:'hat-trump-mask',quantity:2}).error);
 const rows=profile.inventoryInstances.filter(r=>r.itemId==='hat-trump-mask');
 assert.equal(rows.length,2);
 assert(!act(world,{action:'equip',itemId:'hat-trump-mask',inventoryIndex:profile.inventoryInstances.indexOf(rows[0])}).error);
 assert(!act(world,{action:'sell',itemId:'hat-trump-mask',uid:rows[1].uid}).error);
 assert.equal(profile.equipment.head,'hat-trump-mask');
 assert(profile.inventoryInstances.some(r=>r.uid===rows[0].uid));
 assert(!profile.inventoryInstances.some(r=>r.uid===rows[1].uid));
});
