import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction,worldView} from '../src/shared/temple-rules.js';
import {inventoryCapacity} from '../src/shared/catalog.js';
const now=123000000;
function setup(){
 const w=createInitialWorld(now),gm={key:'gm',name:'GM',color:'#ffffff',role:'spectator',admin:true},user={key:'firebase:offline',name:'Same',color:'#ffffff',admin:false};
 const g=ensureProfile(w,gm.key,gm.name,gm.color,now,true),p=ensureProfile(w,user.key,user.name,user.color,now,false);
 return {w,gm,user,g,p,act:(body,actor=gm,context={})=>applyAction(w,actor,body,{now,...context})};
}
test('GM gifts exact shop quality and quantity to offline persistent account without charging either wallet',()=>{
 const {w,g,p,act}=setup(),coins=p.wallet,gmCoins=g.wallet,rev=w.revision;
 const result=act({action:'gm-gift-item',targetKey:p.key,itemId:'giraffe',qualityTier:5,quantity:2});
 assert.equal(result.error,undefined);assert.equal(result.gift.quantity,2);assert.equal(result.gift.qualityTier,5);
 const instances=p.inventoryInstances.filter(i=>i.itemId==='giraffe');
 assert.equal(instances.length,2);assert.equal(new Set(instances.map(i=>i.uid)).size,2);
 assert.ok(instances.every(i=>i.shopTier===5&&!i.viewed&&p.fusionByInstance[i.uid].weaponAffixes.length===0));
 assert.equal(p.wallet,coins);assert.equal(g.wallet,gmCoins);assert.equal(w.revision,rev+1);
 assert.equal(worldView(w,p.key,now).profile.inventory.filter(x=>x==='giraffe').length,2);
 const cash=act({action:'gm-gift-coins',targetKey:p.key,amount:54321});
 assert.equal(cash.gift.amount,54321);assert.equal(p.wallet,coins+54321);assert.equal(g.wallet,gmCoins);
});
test('reject non-admin, forged GM, missing player, invalid quantities, wrong quality, delisted stock and full bag',()=>{
 const {w,user,p,act}=setup(),base=p.inventory.length,coins=p.wallet;
 const item={action:'gm-gift-item',targetKey:p.key,itemId:'ember-3',qualityTier:3,quantity:1};
 assert.equal(act(item,user).error,'GM only');assert.equal(act(item,{...user,admin:true}).error,'GM only');
 assert.ok(act({...item,targetKey:'missing'}).error);assert.ok(act({...item,quantity:0}).error);assert.ok(act({...item,quantity:100}).error);assert.ok(act({...item,qualityTier:5}).error);
 w.delistedShopItems['ember-3']=now;assert.ok(act(item).error);delete w.delistedShopItems['ember-3'];
 assert.equal(p.inventory.length,base);
 for(const amount of [0,-1,1.5,Number.MAX_SAFE_INTEGER])assert.ok(act({action:'gm-gift-coins',targetKey:p.key,amount}).error);
 assert.equal(p.wallet,coins);
 p.inventory=Array(inventoryCapacity(p)).fill('saber-2');assert.match(act(item).error,/full/);
});
test('online guest including spectator may receive, offline guest cannot',()=>{
 const {w,act}=setup(),p=ensureProfile(w,'guest:123','Guest','#ffffff',now,false),body={action:'gm-gift-coins',targetKey:p.key,amount:100};
 assert.equal(act(body).error,'Guest is offline');assert.equal(act(body,undefined,{activeProfileKeys:new Set([p.key])}).gift.amount,100);
});

test('shop uses the same explicit, searchable row recipient picker as GM, without a duplicate product dropdown',async()=>{
 const {readFileSync}=await import('node:fs'),s=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.match(s,/data-shop-gift=/);assert.match(s,/data-gm-recipient=/);assert.match(s,/gmRosterMarkup/);
 assert.doesNotMatch(s,/<select[^>]*data-gm-player(?:\s|>)/);
 assert.doesNotMatch(s,/data-gm-gift-item/);
 assert.match(s,/Number\(b\.online\)-Number\(a\.online\)/);
 assert.match(s,/itemId:gift\.itemId/);
});
