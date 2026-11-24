import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {shopWeaponGroups,SHOP_ITEMS,inventoryCapacity} from '../src/shared/catalog.js';
const actor={key:'r111-trade',name:'Trade',color:'#fff',role:'fighter',position:[75,0,0]};
test('ordinary player buys every displayed variant and sells its exact instance, with persistence',()=>{
 const world=createInitialWorld(1000),profile=ensureProfile(world,actor.key,actor.name,actor.color,1000);profile.wallet=100000000;
 const action=body=>applyAction(world,actor,body,{now:1001,rng:()=>.5});
 for(const {variants} of shopWeaponGroups(SHOP_ITEMS))for(const item of variants){
  const before=profile.inventory.length,wallet=profile.wallet;
  const buy=action({action:'buy',itemId:item.id,quantity:1,...(item.shopTier?{qualityTier:item.shopTier}:{})});
  assert.equal(buy.error,undefined,item.id+' buy '+buy.error);assert.equal(profile.inventory.length,before+1);
  const row=profile.inventoryInstances.at(-1);assert.equal(row.itemId,item.id);assert(profile.wallet<wallet);
  const sell=action({action:'sell',itemId:item.id,uid:row.uid});assert.equal(sell.error,undefined,item.id+' sell '+sell.error);assert.equal(profile.inventory.length,before);assert(!profile.inventoryInstances.some(r=>r.uid===row.uid));
 }
 assert.equal(inventoryCapacity(profile),3000);
});
test('shop tabs keep exactly two ordered rows and high-resolution outfit output',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8'),preview=readFileSync(new URL('../src/item-preview.js',import.meta.url),'utf8');
 assert(ui.includes("[['near','mid','far','mystery'],['head','outfit','wings','shield','comfort']]"));assert(preview.includes('creatureSuit?768'));assert(preview.includes("portrait.toBlob(resolve,'image/png')"));
});
