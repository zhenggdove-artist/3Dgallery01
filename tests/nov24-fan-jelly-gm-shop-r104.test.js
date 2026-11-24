import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,WEAPONS,SHOP_ITEMS,itemById,attackStats,shopWeaponVariant,inventoryCapacity} from '../src/shared/catalog.js';
import {pvpShotDamage,JELLYBRELLA_ULTIMATE_DAMAGE_SCALE} from '../src/shared/combat-balance.js';
import {oddAttackStats} from '../src/reletter/odd-weapons.js';
import {createInitialWorld,ensureProfile,applyAction,migrateWorld} from '../src/shared/temple-rules.js';
const now=100_000_000;
const gm={key:'gm-r104',name:'GM',color:'#ffffff',role:'fighter',admin:true,position:[75,0,0]};
const user={...gm,key:'user-r104',admin:false};
test('fan is retired, cannot be purchased, and old fan gear and echoes are removed',()=>{
 assert.equal(itemById('fan'),null);
 for(const pool of [ITEMS,WEAPONS,SHOP_ITEMS])assert.ok(!pool.some(i=>i.id==='fan'));
 const w=createInitialWorld(now),p=ensureProfile(w,user.key,user.name,user.color,now,false);
 p.inventory.push('fan');p.equipment.weapon='fan';p.fusion['saber-2']={effects:['fan','jellybrella']};
 w.persistentAttacks.push({weapon:'fan',kind:'fan'});
 migrateWorld(w,now);
 ensureProfile(w,user.key,user.name,user.color,now+1,false);
 assert.ok(!p.inventory.includes('fan'));
 assert.notEqual(p.equipment.weapon,'fan');
 assert.ok(!p.fusion['saber-2']?.effects?.includes('fan'));
 assert.equal(w.persistentAttacks.length,0);
 assert.equal(applyAction(w,user,{action:'buy',itemId:'fan',qualityTier:3},{now:now+2}).error,'Item is not sold');
});
test('all five jellyfish qualities deal exactly 70% of previous monster and PvP ultimate damage; normals unchanged',()=>{
 assert.equal(JELLYBRELLA_ULTIMATE_DAMAGE_SCALE,.7);
 const original=itemById('jellybrella');
 for(let tier=1;tier<=5;tier++){
  const w=shopWeaponVariant(original,tier),normal=attackStats(w,0),full=attackStats(w,1);
  assert.equal(normal.damage,oddAttackStats(w,0).damage);
  assert.ok(Math.abs(full.damage-oddAttackStats(w,1).damage*.7)<1e-8);
  const reference={...w,id:'jelly-reference'};
  assert.equal(pvpShotDamage(w,normal,{tier}),pvpShotDamage(reference,normal,{tier}));
  assert.ok(Math.abs(pvpShotDamage(w,full,{tier})-pvpShotDamage(reference,full,{tier})*.7)<.001);
 }
});
test('authenticated GM can bulk buy above 600 with no wallet debit and keeps instances on rejoin; normal player has the same 3000 cap',()=>{
 const w=createInitialWorld(now),p=ensureProfile(w,gm.key,gm.name,gm.color,now,true);
 p.wallet=0;p.inventory=Array(600).fill('saber-2');
 ensureProfile(w,gm.key,gm.name,gm.color,now+1,true);
 const count=p.inventory.length;
 assert.equal(inventoryCapacity(p),3000);
 const result=applyAction(w,gm,{action:'buy',itemId:'jellybrella',qualityTier:5,quantity:3},{now:now+2});
 assert.equal(result.error,undefined);
 assert.equal(result.purchased.total,0);
 assert.equal(p.wallet,0);
 assert.equal(p.inventory.length,count+3);
 const uids=p.inventoryInstances.slice(-3).map(row=>row.uid);
 ensureProfile(w,gm.key,gm.name,gm.color,now+3,true);
 assert.equal(p.inventory.length,count+3);
 assert.deepEqual(p.inventoryInstances.slice(-3).map(row=>row.uid),uids);
 const normal=ensureProfile(w,user.key,user.name,user.color,now,false);
 normal.wallet=100000;normal.inventory=Array(3000).fill('saber-2');
 assert.equal(inventoryCapacity(normal),3000);
 assert.match(applyAction(w,user,{action:'buy',itemId:'jellybrella',quantity:1},{now:now+4}).error,/Inventory full/);
 assert.equal(normal.wallet,100000);
});
