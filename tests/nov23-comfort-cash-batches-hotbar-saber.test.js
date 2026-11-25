import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {SHOP_ITEMS,itemById,COMFORT_ITEMS} from '../src/shared/catalog.js';
import {createInitialWorld,ensureProfile,applyAction,worldProfileView} from '../src/shared/temple-rules.js';
import {NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';
import {comfortCashImage} from '../src/comfort-cash-art.js';

const T=19000000,actor={key:'comfort-tester',name:'Tester',role:'fighter',
 color:'#ffffff',position:[75,0,0],seat:0};
const execute=(world,action,data={},now=T+100)=>
 applyAction(world,actor,{action,...data},{now,actors:[actor],rng:()=>.5});
function setup(){
 const world=createInitialWorld(T),p=ensureProfile(world,actor.key,actor.name,actor.color,T);
 p.wallet=250000;return {world,p};
}
test('three locally drawn dollar stacks have exact prices, denominations and healing fractions',()=>{
 assert.deepEqual(COMFORT_ITEMS.map(v=>v.price),[300,300,700]);
 assert.deepEqual(COMFORT_ITEMS.map(v=>v.healFraction||v.manaFraction),[.3,.5,1]);
 assert.deepEqual(COMFORT_ITEMS.map(v=>v.denomination),[20,50,100]);
 assert.ok(COMFORT_ITEMS.every(v=>v.slot==='consumable'&&v.category==='Comfort for the Soul'&&v.description==='Give me more!'));
 assert.ok(COMFORT_ITEMS.every(v=>SHOP_ITEMS.includes(v)));
 const art=COMFORT_ITEMS.map(v=>decodeURIComponent(comfortCashImage(v).split(',')[1]));
 assert.ok(art.every(svg=>svg.includes('<svg')&&svg.includes('UNITED STATES OF AMERICA')));
 assert.equal(new Set(art).size,3,'every denomination must have its own colored money stack');
});
test('owned items stay purchasable; batch purchases are atomic and priced by quantity',()=>{
 const {world,p}=setup(),weapon='tide-1',price=itemById(weapon).price;
 p.inventory.push(weapon); // previously blocked as Already owned
 const before=p.wallet;
 const r=execute(world,'buy',{itemId:weapon,quantity:4});
 assert.equal(r.error,undefined);
 assert.equal(p.wallet,before-price*4);
 assert.equal(p.inventory.filter(id=>id===weapon).length,5);
 assert.equal(new Set(p.inventoryInstances.map(v=>v.uid)).size,p.inventoryInstances.length);
 const check=p.inventory.length,wallet=p.wallet;
 for(const quantity of [0,-3,1.5,100,Infinity,'10',null]){
  assert.ok(execute(world,'buy',{itemId:weapon,quantity}).error);
  assert.equal(p.wallet,wallet);
  assert.equal(p.inventory.length,check);
 }
});
test('quantity orders reject unaffordable or overflowing purchases without losing any money',()=>{
 const {world,p}=setup();p.wallet=500;
 assert.ok(execute(world,'buy',{itemId:'comfort-dollar-20',quantity:2}).error);
 assert.equal(p.wallet,500);
 assert.equal(p.inventory.filter(id=>id==='comfort-dollar-20').length,0);
 p.wallet=1000000;
 while(p.inventory.length<2999)p.inventory.push('tide-1'); // capacity check occurs before allocation
 const first=p.wallet;
 assert.match(execute(world,'buy',{itemId:'comfort-dollar-20',quantity:2}).error,/Inventory full.*3000/);
 assert.equal(p.wallet,first);
});
test('server protects 1/2/3 slots: correct heal, exact stock consumption, red slot persistence and restock',()=>{
 const {world,p}=setup();
 const offers=[
  {id:'comfort-dollar-20',fraction:.30,expected:30},
  {id:'comfort-dollar-50',fraction:.50,expected:50},
  {id:'comfort-dollar-100',fraction:1,expected:100}
 ];
 for(const [slot,o] of offers.entries()){
  const result=execute(world,'buy',{itemId:o.id});
  assert.equal(result.error,undefined);
  assert.equal(execute(world,'assign-consumable',{itemId:o.id,slot}).error,undefined);
  assert.equal(p.quickSlots[slot],o.id);
  assert.equal(worldProfileView(world,actor.key).quickSlots[slot],o.id);
 }
 for(const [slot,o] of offers.entries()){
  const at=T+1000+slot*4000;
  p.hp=10;p.mana=0;p.manaAt=at;
  const result=execute(world,'use-consumable',{slot},at);
  assert.equal(result.error,undefined);
  if(slot===1){assert.equal(p.hp,10);assert.equal(result.restoredMana,50);}
  else{assert.equal(p.hp,Math.min(p.maxHp,10+Math.ceil(p.maxHp*o.fraction)));assert.ok(result.healed>0);}
  assert.equal(p.restorativeCooldowns[slot===1?'mana':'health'],at+(slot===2?3000:2000));
  assert.equal(p.inventory.filter(id=>id===o.id).length,0);
  assert.equal(p.quickSlots[slot],o.id);
  assert.match(execute(world,'use-consumable',{slot},at+500).error,/Out of stock/);
 }
 const at=T+13000;
 assert.equal(execute(world,'buy',{itemId:'comfort-dollar-100',quantity:2},at).error,undefined);
 p.hp=1;
 assert.equal(execute(world,'use-consumable',{slot:2},at).healed,99);
 const count=p.inventory.length;
 assert.match(execute(world,'use-consumable',{slot:2},at+1000).error,/cooling down/);
 assert.match(execute(world,'use-consumable',{slot:2},at+3000).error,/already full/);
 assert.equal(p.inventory.length,count);
});
test('server validates consumable quick slots and keeps the remaining inventory unchanged',()=>{
 const {world,p}=setup();
 const before=p.inventory.length;
 assert.ok(execute(world,'assign-consumable',{itemId:'tide-1',slot:0}).error);
 assert.ok(execute(world,'assign-consumable',{itemId:'comfort-dollar-20',slot:0}).error);
 assert.ok(execute(world,'assign-consumable',{itemId:'comfort-dollar-20',slot:8}).error);
 assert.ok(execute(world,'use-consumable',{slot:1}).error);
 assert.equal(p.inventory.length,before);
});
test('desktop and touch quickbar, grouped money stacks and shop quantity emit their server payloads',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const html=read('index.html'),ui=read('src/ui.js'),bag=read('src/bag-view.js'),
  main=read('src/main.js'),css=read('fidelity-ui.css');
 assert.match(html,/id="comfort-hotbar"/);
 assert.match(ui,/\/\^Digit\[123\]\$\//); // digit shortcut dispatch
 assert.match(ui,/data-shop-quantity/);
 assert.match(ui,/action:'buy',itemId:button\.dataset\.buy,quantity/);
 assert.match(ui,/comfort:'Comfort for the Soul'/);
 assert.match(bag,/action:'assign-consumable'/);
 assert.match(bag,/groupInventoryStacks\(list,recordAt\)/);
 assert.match(main,/sendAction\('use-consumable',\{slot\}\)/);
 assert.match(css,/\.comfort-quick-slot\.depleted/);
});
test('five original native sword crescents use gold-yellow theme, no expensive debris simulation',()=>{
 const scene=new THREE.Scene(),vfx=new NumberedWeaponEffects(scene);
 const event={origin:[0,1,0],direction:[0,0,1],ultimate:true,channel:false,
  qualityScale:1,qualityTier:3,range:12,area:{mode:'sector',radius:12,visualCenter:[0,.1,5]}};
 assert.equal(vfx.play(event,itemById('saber-1')),true);
 const entry=vfx.active[0];
 assert.equal(entry.fx.settings.theme,'solar');
 assert.equal(entry.fx.settings.quantity,5);
 assert.equal(entry.group.userData.saberPerfMode,'native-crescents-only');
 const instanced=[];
 entry.group.traverse(node=>{if(node.isInstancedMesh)instanced.push(node);});
 assert.ok(instanced.length>0);
 assert.ok(instanced.every(node=>node.count===0&&!node.visible));
 for(let i=0;i<10;i++)vfx.update(1/60);
 assert.equal(vfx.active.length,1);
 vfx.dispose();assert.equal(scene.children.length,0);
});
