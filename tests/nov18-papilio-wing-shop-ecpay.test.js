import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SWALLOWTAIL_WINGS,WINGS} from '../src/reletter/wing-catalog.js';
import {SHOP_ITEMS,groundDropRoll,monsterDropRoll,itemById} from '../src/shared/catalog.js';
import {createInitialWorld,ensureProfile,applyAction,migrateWorld} from '../src/shared/temple-rules.js';
import {PRODUCTION_GATEWAY,STAGE_GATEWAY,wingPaymentStatus} from '../cloudflare/ecpay-wing-payments.js';
const T=18500000,actor=(key,role='fighter')=>({key,name:key,color:'#abcdef',role,position:[15,0,0]});
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('exactly fourteen curated BLUE/GOLD/PURPLE wing designs retain collectible IDs',()=>{
 const wings=SWALLOWTAIL_WINGS;
 assert.equal(WINGS.length,17);
 assert.equal(SWALLOWTAIL_WINGS.length,14);
 assert.equal(wings.length,14);
 assert.equal(new Set(wings.map(w=>w.id)).size,14);
 assert.deepEqual(wings.filter(w=>w.tier===3).map(w=>w.motif),['wood','balloon','rag','tin','tape']);
 assert.deepEqual(wings.filter(w=>w.tier===4).map(w=>w.motif),['peacock','swan','cyberpunk','steampunk','monster']);
 assert.deepEqual(wings.filter(w=>w.tier===5).map(w=>w.motif),['chicken','plastic','fur','koinobori']);
 assert.ok(wings.filter(w=>w.tier===4).every(w=>w.visualComplexity>10));
 assert.ok(wings.every(w=>w.design==='crafted-wing'&&w.shopWing&&!w.notForSale&&w.slot==='wings'));
 for(const id of ['wings-1','wings-18','wings-21','wings-27']){
  assert.equal(itemById(id),null,'retired wing '+id+' must no longer exist');
  assert.ok(!SHOP_ITEMS.some(w=>w.id===id));
 }
});
test('all seventeen wings can be purchased in ordinary shop using coins; no random draws exist',()=>{
 const shop=SHOP_ITEMS.filter(i=>i.slot==='wings');
 assert.equal(shop.length,17);
 const world=createInitialWorld(T),profile=ensureProfile(world,'player','Player','#abcdef',T,false);
 profile.wallet=100000;
 for(const item of shop){
  const oldWallet=profile.wallet;
  const purchase=applyAction(world,actor('player'),{action:'buy',itemId:item.id},{now:T});
  assert.equal(purchase.error,undefined,JSON.stringify(purchase));
  assert.equal(profile.wallet,oldWallet-item.price);
  assert.ok(profile.inventory.includes(item.id));
 }
 for(const oldAction of ['wing-draw','gm-wing-draw'])
  assert.match(applyAction(world,actor('player'),{action:oldAction},{now:T}).error,/removed/);
});
test('monster and ground drops never contain any wings; outdated inventories are migrated cleanly',()=>{
 for(let i=0;i<1000;i++){
  const r=()=>i/1000;
  for(const drop of [groundDropRoll(r),monsterDropRoll(r)])assert.notEqual(itemById(drop.itemId)?.slot,'wings');
 }
 const world=createInitialWorld(T),profile=ensureProfile(world,'legacy','Legacy','#abcdef',T,false);
 profile.inventory.push('wings-18');
 profile.equipment.wings='wings-18';
 migrateWorld(world,T+10);
 ensureProfile(world,'legacy','Legacy','#abcdef',T+20,false);
 assert.ok(!world.profiles.legacy.inventory.includes('wings-18'));
 assert.equal(world.profiles.legacy.equipment.wings,null);
});
test('SUPPORT is one personal design payment; shop wings show material previews',()=>{
 const ui=read('src/ui.js'),index=read('index.html'),art=read('src/reletter/swallowtail-art.js');
 assert.match(ui,/wings:'Wings'/);
 assert.match(ui,/previewMarkup\(item\)/,'wings use actual pre-rendered models in shop');
 assert.match(ui,/data-wing-checkout/);
 assert.match(ui,/data-open-gift/);
 const section=ui.slice(ui.indexOf('  renderWingShop(profile){'),ui.indexOf('  hydrateWingGalleryImages(){'));
 assert.doesNotMatch(section,/gacha-machine|data-draw-wing|CAPSULE|LUCKY DRAW/);
 assert.match(index,/id="wing-gift-button"/);
 assert.match(art,/craftedWingCanvas/);
});
test('production payment is strictly fail-closed without merchant keys, and stage remains isolated',()=>{
 assert.equal(STAGE_GATEWAY,'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5');
 assert.equal(PRODUCTION_GATEWAY,'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5');
 assert.equal(wingPaymentStatus().checkoutEnabled,false);
 assert.equal(wingPaymentStatus({ECPAY_WING_STAGE_ENABLED:'true'},false).checkoutEnabled,false);
 assert.equal(wingPaymentStatus({ECPAY_WING_STAGE_ENABLED:'true'},true).checkoutMode,'stage-only');
});
