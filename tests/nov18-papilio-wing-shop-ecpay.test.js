import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SWALLOWTAIL_WINGS,WINGS} from '../src/reletter/wing-catalog.js';
import {SHOP_ITEMS,groundDropRoll,monsterDropRoll,itemById} from '../src/shared/catalog.js';
import {drawGmWing,wingRarity,WING_QUALITY_WEIGHTS,WING_QUALITY_NAMES} from '../src/shared/wing-shop.js';
import {createInitialWorld,ensureProfile,applyAction,migrateWorld} from '../src/shared/temple-rules.js';
import {STAGE_GATEWAY,wingPaymentStatus,stageCheckoutFields} from '../cloudflare/ecpay-wing-payments.js';
const T=18_500_000,actor=(key,role='fighter')=>({key,name:key,color:'#abcdef',role,position:[15,0,0]});

test('twenty-one swallowtail wings, five Epic specimens and rarity-independent natural colors',()=>{
 assert.equal(SWALLOWTAIL_WINGS.length,21);
 assert.equal(WINGS.length,41);
 assert.equal(new Set(WINGS.map(w=>w.id)).size,41);
 for(let i=0;i<21;i++){
  const wing=SWALLOWTAIL_WINGS[i];
  assert.equal(wing.id,'wings-'+(i===16?41:i>16?i+20:i+21));
  assert.equal(wing.slot,'wings');
  assert.equal(wing.design,i<7?'swallowtail':'crafted-wing');
  assert.equal(wing.premiumWing,true);
  assert.equal(wing.notForSale,true);
  assert.ok(wing.impulse>0);
  assert.equal(wingRarity(wing),i<4?'common':i<7?'uncommon':i<12?'rare':i<17?'epic':'relic');
  assert.equal(itemById(wing.id).name,wing.name);
 }
 assert.deepEqual(Object.entries(WING_QUALITY_WEIGHTS).map(x=>x[1]),[45,30,18,5,2]);
 assert.ok(WING_QUALITY_NAMES.epic.includes('PURPLE'));
 assert.ok(SWALLOWTAIL_WINGS[12].visualComplexity>SWALLOWTAIL_WINGS[17].visualComplexity);
 assert.equal(SWALLOWTAIL_WINGS.filter(w=>wingRarity(w)==='epic').length,5);
 assert.deepEqual(SWALLOWTAIL_WINGS.slice(12,17).map(w=>w.motif),['peacock','swan','cyberpunk','steampunk','monster']);
  assert.deepEqual(SWALLOWTAIL_WINGS.slice(7,12).map(w=>w.motif),['wood','balloon','rag','tin','tape']);
  assert.deepEqual(SWALLOWTAIL_WINGS.slice(17,21).map(w=>w.motif),['chicken','plastic','fur','koinobori']);
 assert.ok(SWALLOWTAIL_WINGS[12].visualComplexity>SWALLOWTAIL_WINGS[4].visualComplexity);
 assert.ok(!SHOP_ITEMS.some(i=>i.slot==='wings'),'no paid wings can be purchased with earned coins');
});

test('no original or premium wing can spawn from ground or monster loot',()=>{
 for(let i=0;i<1000;i++){
  const r=()=>i===999?.999999:i/1000;
  const drops=[groundDropRoll(r),monsterDropRoll(r)];
  for(const drop of drops)
   assert.notEqual(itemById(drop.itemId)?.slot,'wings',JSON.stringify(drop));
 }
 const world=createInitialWorld(T),p=ensureProfile(world,'player','Player','#abcdef',T);
 world.groundDrops.push({id:'oldwing',kind:'equipment',itemId:'wings-9',
   position:[15,0,0],expiresAt:T+60_000});
 migrateWorld(world,T);
 assert.equal(world.groundDrops.find(d=>d.id==='oldwing'),undefined);
 world.groundDrops.push({id:'forgedwing',kind:'equipment',itemId:'wings-21',
  position:[15,0,0],expiresAt:T+60_000});
 const response=applyAction(world,actor('player'),{action:'pickup-drop',dropId:'forgedwing'},{now:T+10});
 assert.match(response.error,/Wings.*ground pickup disabled/);
 assert.ok(!p.inventory.includes('wings-21'));
});

test('GM draws use weighted qualities with replacement and grant one copy per draw',()=>{
 const world=createInitialWorld(T),gm=ensureProfile(world,'gm','Ely','#abcdef',T,true);
 assert.equal(gm.inventory.filter(id=>/^wings-(2[1-9]|3[0-9]|40)$/.test(id)).length,20);
 const initialWallet=gm.wallet,initialInventory=gm.inventory.length;
 const result=applyAction(world,actor('gm'),{action:'gm-wing-draw'},{now:T,rng:()=>0});
 assert.equal(result.error,undefined);
 assert.equal(result.wingDraw.itemId,'wings-21');
 assert.equal(result.wingDraw.quality,'common');
 assert.equal(result.wingDraw.remaining,0);
 assert.equal(result.wingDraw.mode,'gm-preview');
 assert.equal(gm.wallet,initialWallet);
 assert.equal(gm.inventory.length,initialInventory+1);
 assert.equal(gm.inventory.filter(id=>id==='wings-21').length,2);
 assert.equal(gm.itemOrigins['wings-21'],'gm-wing-draw');
 const next=applyAction(world,actor('gm'),{action:'gm-wing-draw'},{now:T+1,rng:()=>0});
 assert.equal(next.wingDraw.itemId,'wings-21');
 const big=applyAction(world,actor('gm'),{action:'gm-wing-draw'},{now:T+2,rng:(()=>{let i=0;return ()=>++i%2? .9999999:.9999999;})()});
 assert.equal(big.wingDraw.itemId,'wings-40');
 assert.equal(big.wingDraw.quality,'relic');
});

test('unauthenticated gamers cannot request GM wing draws, even with forged admin payload',()=>{
 const world=createInitialWorld(T),profile=ensureProfile(world,'attacker','Attacker','#abcdef',T);
 const start=[...profile.inventory],beforeWallet=profile.wallet;
 for(const role of ['fighter','spectator']){
  const response=applyAction(world,{...actor('attacker',role),admin:true},
   {action:'gm-wing-draw',admin:true,price:0,rarity:'epic'},{now:T,rng:()=>.99});
  assert.equal(response.error,'GM only');
 }
 assert.deepEqual(profile.inventory,start);
 assert.equal(profile.wallet,beforeWallet);
});

test('browser generates animated 3-D Papilio geometry and protected shop link',()=>{
 const art=readFileSync(new URL('../src/reletter/swallowtail-art.js',import.meta.url),'utf8');
 const garden=readFileSync(new URL('../src/reletter/garden-art.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../sketch-hud.css',import.meta.url),'utf8');
 assert.match(art,/swallowtailCanvas\(item\)/);
 assert.match(art,/swallowtailModel\(T,item\)/);
 assert.match(art,/new T\.MeshPhysicalMaterial/);
 assert.match(art,/if\(purple\)/);
 assert.match(art,/addEpicDust/);
 assert.match(garden,/painted-wing/);
 assert.match(ui,/renderWingShop\(profile\)/);
 assert.match(ui,/WINDOWS 98 · CAPSULE.EXE · SUPPORT/);
 assert.match(ui,/data-open-wing-painter/);
 assert.match(ui,/wing-gacha-machine/);
 assert.match(ui,/data-draw-wing/);
 assert.match(ui,/if\(\['gm','wing-painter','wing-manage'\]\.includes\(name\)&&!this\.self\.profile\?\.admin\)return/);
 assert.match(index,/id="wing-shop-button" data-panel="wing-shop"/);
 assert.match(css,/#dock #wing-shop-button\[hidden\]\{display:none!important\}/);
 assert.match(index,/src\/reletter\/swallowtail-art\.js/);
 assert.match(index,/src\/shared\/wing-shop\.js/);
 assert.match(index,/<span>SUPPORT<\/span>/);
});

test('ECPay is GM-only stage checkout and fails closed without stage Worker flag',async()=>{
 assert.equal(STAGE_GATEWAY,'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5');
 assert.equal(wingPaymentStatus().checkoutEnabled,false);
 assert.equal(wingPaymentStatus({ECPAY_WING_STAGE_ENABLED:'true'},false).checkoutEnabled,false);
 assert.equal(wingPaymentStatus({ECPAY_WING_STAGE_ENABLED:'true'},true).checkoutMode,'stage-only');
 const fields=await stageCheckoutFields('GW261119123456789012',
  'https://example.org/api/wing-pay/notify','https://example.org/');
 assert.equal(fields.TotalAmount,'30');
 assert.equal(fields.ChoosePayment,'Credit');
 assert.ok(fields.CheckMacValue);
 const worker=readFileSync(new URL('../cloudflare/worker.js',import.meta.url),'utf8');
 assert.match(worker,/initializeWingOrders/);
 assert.match(worker,/wingCheckoutApi/);
 assert.match(worker,/wingNotifyApi/);
 assert.match(worker,/url\.pathname\.startsWith\('\/api\/wing-pay\/'\)/);
});
