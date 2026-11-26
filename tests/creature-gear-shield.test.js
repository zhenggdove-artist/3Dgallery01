import test from 'node:test';
import assert from 'node:assert/strict';
import {HEADGEAR} from '../src/engine/headgear-catalog.js';
import {OUTFITS} from '../src/engine/outfit-catalog.js';
import {EQUIPMENT} from '../src/engine/equipment-catalog.js';
import {ITEMS,SHOP_ITEMS} from '../src/shared/catalog.js';

const creatures=['elephant','rooster','anteater','guinea-pig','penguin','polar-bear',
 'jellyfish','crab-claw','lion','banana-bunch','eggplant'];

test('every requested creature or food has an actual head piece and outfit',()=>{
 for(const creature of creatures){
  const hat=HEADGEAR.find(x=>x.id==='hat-'+creature);
  const suit=OUTFITS.find(x=>x.id==='outfit-creature-'+creature);
  assert.ok(hat,creature+' head missing');
  assert.ok(suit,creature+' suit missing');
  assert.equal(hat.design,creature);
  assert.equal(suit.creature,creature);
  for(const item of [hat,suit]){
   assert.ok(Object.values(item.bonuses).some(v=>v>0),item.id+' lacks an effect');
   assert.ok(ITEMS.some(x=>x.id===item.id),item.id+' missing client/server catalog');
   assert.ok(SHOP_ITEMS.some(x=>x.id===item.id),item.id+' missing shop');
  }
 }
});

test('every shield restores 20 seconds later than its original recharge',()=>{
 const shields=EQUIPMENT.filter(x=>x.slot==='shield');
 assert.equal(shields.length,10);
 shields.forEach((shield,i)=>assert.equal(shield.recharge,Math.max(7,16-i)+20));
});

test('creature gear IDs are unique and bonuses use the supported server stat vocabulary',()=>{
 const all=[...HEADGEAR,...OUTFITS],ids=all.map(x=>x.id);
 assert.equal(ids.length,new Set(ids).size);
 for(const item of all.filter(x=>creatures.some(c=>x.id.endsWith(c)))){
  for(const key of Object.keys(item.bonuses)){
   assert.ok(['attack','defense','hp','speed','jump','fusion'].includes(key),
    item.id+' contains unsupported stat '+key);
  }
 }
});
