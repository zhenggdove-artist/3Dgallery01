import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EQUIPMENT} from '../src/reletter/equipment-catalog.js';
import {RELETTER_ITEMS,SHOP_ITEMS,WEAPONS,isMysteryWeapon} from '../src/shared/catalog.js';
import {createInitialWorld,applyAction,ensureProfile} from '../src/shared/temple-rules.js';

const ranks=[240,620,1450,3300,7600];
const premiumIds=new Set([
 ...['whip','pan','swatter'].flatMap(family=>Array.from({length:5},(_,i)=>family+'-'+(i+1))),
 'black-cat'
]);

test('every specified colour/rank is exactly five times its former shop price',()=>{
 assert.equal(premiumIds.size,16);
 for(const original of EQUIPMENT.filter(i=>premiumIds.has(i.id))){
  const item=RELETTER_ITEMS.find(i=>i.id===original.id);
  const originalPrice=ranks[Math.max(1,Math.min(5,original.tier||1))-1]+Math.min(180,original.price||0);
  assert.equal(item.price,originalPrice*5,item.id);
  assert.equal(item.mysteryWeapon,true,item.id);
  assert.equal(item.sell,Math.floor(item.price*.25),item.id);
  assert.equal(isMysteryWeapon(item),true,item.id);
  assert.ok(SHOP_ITEMS.includes(item),item.id+' available to buy');
 }
 const actual=SHOP_ITEMS.filter(item=>item.mysteryWeapon).map(item=>item.id);
 assert.deepEqual(new Set(actual),premiumIds);
 // Exotic weapons may share 'whip', 'swatter' or 'pan' families but
 // should not inherit a 5x price multiplier.
 for(const id of ['goldfish','telephone','fan','accordion','clam','white-cat','planter-1']){
  const original=EQUIPMENT.find(i=>i.id===id),item=WEAPONS.find(i=>i.id===id);
  assert.equal(item.mysteryWeapon,false,id);
  assert.equal(item.price,ranks[Math.max(1,Math.min(5,original.tier||1))-1]+Math.min(180,original.price||0),id);
 }
});

test('buying Mystery weapons is rechecked against 5x server catalog price',()=>{
 const now=2_000_000,world=createInitialWorld(now);
 const p=ensureProfile(world,'collector','collector','#abcdef',now);
 const item=SHOP_ITEMS.find(i=>i.id==='black-cat');
 p.wallet=item.price-1;
 const actor={key:'collector',name:'collector',color:'#abcdef',role:'fighter',position:[15,0,0],admin:false};
 const body={action:'buy',itemId:item.id};
 const rejected=applyAction(world,actor,body,{now:now+1});
 assert.match(rejected.error,/Not enough coins/);
 p.wallet=item.price;
 const bought=applyAction(world,actor,body,{now:now+2});
 assert.equal(bought.error,undefined);
 assert.equal(p.wallet,0);
 assert.ok(p.inventory.includes('black-cat'));
});

test('shop places premium weapons only in the exclusive Mystery tab',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.match(ui,/mystery:'神秘武器'/);
 assert.match(ui,/tab==='mystery'&&i\.mysteryWeapon/);
 assert.match(ui,/!i\.mysteryWeapon&&weaponRangeClass\(i\)===tab/);
});

test('Collector retains native skinned player model and transparent purple name',()=>{
 const view=readFileSync(new URL('../src/collector-view.js',import.meta.url),'utf8');
 const outfit=readFileSync(new URL('../src/reletter/outfit-model.js',import.meta.url),'utf8');
 assert.match(view,/this\.arena\.createPlayer\(/);
 assert.match(view,/attachOutfit\(THREE,root\.userData\.model,tailoredSuit,\{hood:false\}\)/);
 assert.match(view,/design:'suit'/);
 assert.doesNotMatch(view,/BoxGeometry/);
 assert.match(outfit,/if\(d==='suit'\)/);
 assert.match(outfit,/if\(item\.design==='suit'\)/);
 assert.match(view,/ctx\.clearRect\(0,0,320,84\)/);
 assert.match(view,/ctx\.fillStyle='#a74cff'/);
 assert.doesNotMatch(view,/ctx\.fillRect\(/);
});
