import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEMS,itemById} from '../src/shared/catalog.js';
import {applyAction,createInitialWorld,ensureProfile,worldProfileView} from '../src/shared/temple-rules.js';
import {ensureFusionIdentity} from '../src/shared/fusion-instances.js';

const now=8_800_000;
const actor=(key='buyer',role='fighter')=>({
 key,name:key,color:'#abcdef',role,position:[0,0,0],admin:false
});
const action=(world,key,verb,extra={},role='fighter',at=now)=>applyAction(
 world,actor(key,role),{action:verb,...extra},{now:at});

test('the new creature hats and suits can be bought and equipped together',()=>{
 const world=createInitialWorld(now),profile=ensureProfile(world,'buyer','buyer','#abcdef',now);
 profile.wallet=1_000_000;
 for(const id of ['hat-elephant','outfit-creature-elephant']){
  const item=itemById(id);
  assert.ok(item,'missing catalog item '+id);
  const result=action(world,'buyer','buy',{itemId:id,quantity:2});
  assert.equal(result.error,undefined,'buy '+id);
  assert.equal(profile.inventory.filter(entry=>entry===id).length,2);
  const rows=profile.inventoryInstances.filter(row=>row.itemId===id);
  assert.equal(rows.length,2);
  assert.equal(rows.every(row=>row.viewed===false),true,'NEW initially unread');
  const index=profile.inventory.findIndex(entry=>entry===id);
  const equipped=action(world,'buyer','equip',{itemId:id,inventoryIndex:index});
  assert.equal(equipped.error,undefined,'equip '+id);
  assert.equal(profile.equipment[item.slot],id);
  assert.equal(profile.inventoryInstances[index].viewed,false,'equipping does not inspect');
 }
 assert.equal(profile.equipment.head,'hat-elephant');
 assert.equal(profile.equipment.outfit,'outfit-creature-elephant');
 const view=worldProfileView(world,'buyer',now);
 assert.ok(view.inventoryInstances.some(row=>row.itemId==='hat-elephant'&&!row.viewed));
});

test('NEW persists across world saves and clears only when inspected',()=>{
 const world=createInitialWorld(now),profile=ensureProfile(world,'buyer','buyer','#abcdef',now);
 profile.wallet=1_000_000;
 action(world,'buyer','buy',{itemId:'hat-rooster',quantity:3});
 ensureFusionIdentity(profile);
 assert.equal(profile.inventoryInstances.filter(row=>row.itemId==='hat-rooster').every(row=>row.viewed===false),true);
 const viewed=action(world,'buyer','inspect-item',{itemId:'hat-rooster'});
 assert.equal(viewed.error,undefined);
 assert.equal(viewed.cleared,3,'inspection clears the whole stack');
 ensureProfile(world,'buyer','buyer','#abcdef',now+1000);
 assert.equal(profile.inventoryInstances.filter(row=>row.itemId==='hat-rooster').every(row=>row.viewed===true),true);
 action(world,'buyer','buy',{itemId:'hat-rooster'});
 assert.equal(profile.inventoryInstances.filter(row=>row.itemId==='hat-rooster'&&row.viewed===false).length,1,'restocking makes the new copy NEW again');
 assert.equal(action(world,'buyer','inspect-item',{itemId:'not-a-real-item'}).error,'Item is not owned');
});

test('legacy-owned items are not marked NEW on first migration',()=>{
 const world=createInitialWorld(now),profile=ensureProfile(world,'buyer','buyer','#abcdef',now);
 profile.inventory.push('hat-bear');ensureFusionIdentity(profile);
 assert.equal(profile.inventoryInstances.find(row=>row.itemId==='hat-bear').viewed,true);
});

test('spectators can shop and equip but cannot collect world loot',()=>{
 const world=createInitialWorld(now),profile=ensureProfile(world,'spectator','spectator','#abcdef',now);
 profile.wallet=1_000_000;
 assert.equal(action(world,'spectator','buy',{itemId:'outfit-creature-lion'},'spectator').error,undefined);
 assert.equal(action(world,'spectator','equip',{itemId:'outfit-creature-lion'},'spectator').error,undefined);
 assert.equal(profile.equipment.outfit,'outfit-creature-lion');
 assert.equal(action(world,'spectator','inspect-item',{itemId:'outfit-creature-lion'},'spectator').error,undefined);
 assert.match(action(world,'spectator','pickup-coin',{platformId:'platform-01'},'spectator').error,/Spectators/);
});

test('existing GM profiles receive new creature items once without duplicating purchases',()=>{
 const world=createInitialWorld(now),gm=ensureProfile(world,'gm','gm','#abcdef',now,true);
 gm.inventory=gm.inventory.filter(id=>id!=='hat-elephant'&&id!=='outfit-creature-elephant');
 gm.gmAllItemsGranted=true;gm.gmCreatureGearGrantedV2=false;
 ensureProfile(world,'gm','gm','#abcdef',now+1000,true);
 assert.ok(gm.inventory.includes('hat-elephant'));
 assert.ok(gm.inventory.includes('outfit-creature-elephant'));
 assert.equal(gm.inventoryInstances.find(row=>row.itemId==='hat-elephant').viewed,false);
 const count=gm.inventory.length;
 ensureProfile(world,'gm','gm','#abcdef',now+2000,true);
 assert.equal(gm.inventory.length,count);
});

test('all new animal and food items remain in the authoritative catalog',()=>{
 const design=['elephant','rooster','anteater','guinea-pig','penguin','polar-bear','jellyfish',
 'crab-claw','lion','banana-bunch','eggplant'];
 for(const kind of design)for(const id of ['hat-'+kind,'outfit-creature-'+kind])
  assert.equal(ITEMS.some(item=>item.id===id),true,id);
});
