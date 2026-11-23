import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ODD_WEAPONS} from '../src/reletter/odd-weapons.js';
import {SHOP_ITEMS,itemById,RARITIES} from '../src/shared/catalog.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';

const originalIds=['giraffe','goldfish','clam','white-cat','black-cat','calico-cat','accordion','fan','telephone','jellybrella'];
const textFile=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('all ten authored specialty weapons have 4 purchasable tiers and keep legacy T3 IDs',()=>{
 for(const base of originalIds){
  const items=ODD_WEAPONS.filter(item=>(item.baseId||item.id)===base);
  assert.deepEqual(items.map(item=>item.tier),[1,2,3,4],base);
  assert.equal(items[2].id,base,'legacy inventory ID must not change');
  assert.deepEqual(items.map(item=>item.rarity),[undefined,undefined,undefined,undefined],
   'source catalog leaves price/rarity normalization to shared catalog');
  const sale=items.map(item=>itemById(item.id));
  assert.ok(sale.every(item=>SHOP_ITEMS.includes(item)),base+' all tiers sold');
  assert.deepEqual(sale.map(item=>item.rarity),RARITIES.slice(0,4).map(tier=>tier.id));
  assert.ok(sale.every(item=>Number.isSafeInteger(item.price)&&item.price>0));
  for(let i=1;i<sale.length;i++)assert.ok(sale[i].price>sale[i-1].price,base+' prices increase');
  assert.ok(sale.every(item=>item.slot==='weapon'&&(item.baseId||item.id)===base));
  assert.ok(sale.every(item=>item.pattern===sale[2].pattern),'same native VFX family');
 }
 assert.equal(itemById('giraffe').price,19999);
});

test('server accepts transactions for every tier including telephone and jellyfish',()=>{
 const time=30000000,who={key:'seller-test',name:'S',role:'fighter',position:[75,0,0],color:'#fff'};
 const world=createInitialWorld(time),profile=ensureProfile(world,who.key,who.name,who.color,time);
 profile.wallet=1000000;
 for(const base of ['telephone','jellybrella','black-cat']){
  for(const suffix of ['-q1','-q2','','-q4']){
   const item=itemById(base+suffix);
   const result=applyAction(world,who,{action:'buy',itemId:item.id,quantity:1},{now:time+3000});
   assert.equal(result.error,undefined,item.id);
   assert.ok(profile.inventory.includes(item.id),item.id);
  }
 }
});

test('single touch can only orbit; joystick-held consumables use immediate pointerdown',()=>{
 const controller=textFile('src/player-controller.js'),ui=textFile('src/ui.js'),gun=textFile('src/gun-controller.js');
 assert.match(controller,/this\.pointers\.size===2/);
 assert.match(controller,/a\.type==='touch'&&b\.type==='touch'/);
 assert.match(controller,/lostpointercapture/);
 assert.match(controller,/this\.pinch=null;this\.drag=null/);
 assert.match(ui,/quickBar\?\.addEventListener\('pointerdown',useQuickSlot/);
 assert.match(ui,/this\.emit\('quick-use',\{slot\}\)/);
 assert.match(gun,/aimMode|gun-fire/);
});
