
import test from 'node:test';import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {SHOP_ITEMS,groundDropRoll,monsterDropRoll} from '../src/shared/catalog.js';
const now=1e6,gm={key:'gm',name:'GM',color:'#ffffff',admin:true,role:'fighter',position:[75,0,0]},p={...gm,key:'p',name:'P',admin:false};
function setup(){const w=createInitialWorld(now);ensureProfile(w,gm.key,gm.name,gm.color,now,true);const user=ensureProfile(w,p.key,p.name,p.color,now,false);user.wallet=1e7;return {w,user};}
function findRoll(id,roll,excluded,relisted){for(let i=0;i<5000;i++){const r=i/5000;if(roll===groundDropRoll){for(const kind of [.4,.7,.9]){let calls=0;if(roll(()=>calls++===0?kind:r,excluded,relisted).itemId===id)return true;}}else if(roll(()=>r,excluded,relisted).itemId===id)return true;}return false;}
test('relist is GM-only, restores purchase, never restores recalled copies, and allows repeat retirement',()=>{
 const {w,user}=setup(),id='outfit-pooh-plush-disguise',act=(a,action)=>applyAction(w,a,{action,itemId:id},{now});
 assert.ok(!act(p,'buy').error);assert.ok(!act(gm,'gm-shop-delist').error);assert.ok(!user.inventory.includes(id));
 assert.equal(act(p,'gm-shop-relist').error,'GM only');assert.ok(act(p,'buy').error);
 const wallet=user.wallet;assert.ok(!act(gm,'gm-shop-relist').error);assert.equal(user.wallet,wallet);assert.ok(!user.inventory.includes(id));
 assert.ok(!ensureProfile(w,p.key,p.name,p.color,now+1,false).inventory.includes(id));assert.ok(!ensureProfile(w,gm.key,gm.name,gm.color,now+1,true).inventory.includes(id));
 assert.ok(findRoll(id,groundDropRoll,w.delistedShopItems,w.relistedShopItems));assert.ok(findRoll(id,monsterDropRoll,w.delistedShopItems,w.relistedShopItems));
 assert.ok(!act(p,'buy').error);assert.ok(user.inventory.includes(id));assert.ok(!act(gm,'gm-shop-delist').error);assert.ok(!user.inventory.includes(id));
 assert.ok(!findRoll(id,groundDropRoll,w.delistedShopItems,w.relistedShopItems));assert.ok(!findRoll(id,monsterDropRoll,w.delistedShopItems,w.relistedShopItems));
});
test('explicitly relisted high grade, wing, and consumable can drop in both pools',()=>{
 const {w,user}=setup();
 for(const item of [SHOP_ITEMS.find(i=>i.slot==='weapon'&&i.tier===5),SHOP_ITEMS.find(i=>i.slot==='wings'),SHOP_ITEMS.find(i=>i.slot==='consumable')]){
  assert.ok(item);const id=item.id;
  assert.ok(!applyAction(w,gm,{action:'gm-shop-delist',itemId:id},{now}).error);
  assert.ok(!applyAction(w,gm,{action:'gm-shop-relist',itemId:id},{now}).error);
  assert.ok(findRoll(id,groundDropRoll,w.delistedShopItems,w.relistedShopItems),id+' ground');assert.ok(findRoll(id,monsterDropRoll,w.delistedShopItems,w.relistedShopItems),id+' monster');
  w.groundDrops.push({id:'new-'+id,itemId:id,kind:item.slot==='consumable'?'consumable':'equipment',position:[75,0,0],expiresAt:now+1000});
  assert.ok(!applyAction(w,p,{action:'pickup-drop',dropId:'new-'+id},{now}).error);assert.ok(user.inventory.includes(id));
 }
});
test('relisting starter does not silently reissue a recalled starter to returning players',()=>{
 const {w,user}=setup(),id='saber-2';assert.ok(!applyAction(w,gm,{action:'gm-shop-delist',itemId:id},{now}).error);assert.ok(user.spentStarterWeapon);assert.ok(!applyAction(w,gm,{action:'gm-shop-relist',itemId:id},{now}).error);assert.ok(!ensureProfile(w,p.key,p.name,p.color,now+1,false).inventory.includes(id));
});
