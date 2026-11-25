import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,createProfile,applyAction,worldView,migrateWorld} from '../src/shared/temple-rules.js';
import {itemById} from '../src/shared/catalog.js';
const T=Date.UTC(2026,10,19);
const key='firebase:gg:buyer';
const actor=(id=key)=>({key:id,name:'buyer',color:'#aabbcc',admin:false,role:'fighter',position:[0,0,0]});
const wing=(name='My only wing')=>({
 name,drawRatePct:0,tier:5,color:'#e4a0c0',ability:'guardian',shape:'freehand',
 scaleX:1,scaleY:1,impulse:18,gravity:.2,flapMs:180,
 outline:[[.1,.3],[.2,.1],[.9,.2],[.85,.8],[.15,.75]],strokes:[]
});
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('old random gacha actions are permanently disabled for all players, including GM',()=>{
 const world=createInitialWorld(T);
 world.profiles[key]=createProfile(key,'buyer','#aabbcc',T,false);
 world.profiles[key].wingDesignCredits=2;
 for(const action of ['wing-draw','gm-wing-draw']){
  const before=world.profiles[key].wingDesignCredits;
  assert.match(applyAction(world,actor(),{action},{now:T}).error,/removed/);
  assert.equal(world.profiles[key].wingDesignCredits,before);
 }
});
test('one paid entitlement creates one original in BAG, auto-equips it, and disappears after use',()=>{
 const world=createInitialWorld(T),profile=world.profiles[key]=createProfile(key,'buyer','#aabbcc',T,false);
 profile.wingDesignCredits=1;
 const before=profile.inventory.length;
 const result=applyAction(world,actor(),{action:'redeem-wing-design',wing:wing()},{now:T+1});
 assert.equal(result.error,undefined);
 assert.match(result.personalWingId,/^gm-wing-/);
 assert.equal(result.equippedWingId,result.personalWingId);
 assert.equal(profile.inventory.length,before+1);
 assert.equal(profile.equipment.wings,result.personalWingId);
 assert.equal(profile.inventory.at(-1),result.personalWingId);
 assert.equal(profile.wingDesignCredits,0);
 assert.equal(result.profile.wingDesignCredits,0);
 assert.equal(itemById(result.personalWingId)?.personalWing,true);
 assert.equal(itemById(result.personalWingId)?.tier,3,'server must cap paid cosmetics to balanced tier');
 assert.equal(itemById(result.personalWingId)?.ability,'glide');
 assert.equal(itemById(result.personalWingId)?.ownerKey,key);
 assert.equal(world.customWings[0].personalWing,true);
 assert.equal(applyAction(world,actor(),{action:'redeem-wing-design',wing:wing('Second')},{now:T+2}).error,'No paid wing design credit remains');
 const again=migrateWorld(structuredClone(world),T+3);
 assert.equal(worldView(again,key,T+3).profile.equipment.wings,result.personalWingId);
});
test('no verified entitlement, guest account, or forged fields can grant a wing',()=>{
 const world=createInitialWorld(T);
 const account=world.profiles[key]=createProfile(key,'buyer','#aabbcc',T,false);
 account.wingDesignCredits=0;
 const before=account.inventory.length;
 assert.match(applyAction(world,actor(),{action:'redeem-wing-design',wing:wing(),wingDesignCredits:1000},{now:T}).error,/No paid/);
 assert.equal(account.inventory.length,before);
 const guest='guest:impostor';
 world.profiles[guest]=createProfile(guest,'Guest','#aabbcc',T,false);
 world.profiles[guest].wingDesignCredits=1;
 assert.match(applyAction(world,actor(guest),{action:'redeem-wing-design',wing:wing()},{now:T}).error,/Google/);
});
test('SUPPORT is a direct commission, not a lottery, with a left gift button and editor',()=>{
 const html=read('index.html'),ui=read('src/ui.js'),main=read('src/main.js'),css=read('wing-atelier.css'),painter=read('src/gm-wing-painter.js');
 assert.match(html,/id="wing-shop-button" data-panel="wing-shop"/);
 assert.match(html,/id="wing-gift-button"/);
 assert.match(css,/#wing-gift-button\[hidden\]/);
 assert.match(ui,/wingDesignCredits/);
 assert.match(ui,/data-wing-checkout/);
 const section=ui.slice(ui.indexOf('  renderWingShop(profile){'),ui.indexOf('  hydrateWingGalleryImages(){'));
 assert.doesNotMatch(section,/data-draw-wing|wing-gacha-machine|LOTTERY|CAPSULE/);
 assert.match(main,/redeem-wing-design/);
 assert.match(painter,/個人翅膀固定使用平衡的裝飾數值/);
});

test('only a server-recorded GM gift enables a guest canvas, and each gift redeems once',()=>{
 const world=createInitialWorld(T),guest='guest:gifted',gm='firebase:gg:gm';
 world.profiles[guest]=createProfile(guest,'Guest','#aabbcc',T,false);
 world.profiles[gm]=createProfile(gm,'GM','#aabbcc',T,true);
 const administrator={...actor(gm),admin:true};
 assert.ok(applyAction(world,actor(guest),{action:'gm-wing-canvas',targetKey:guest},{now:T}).error);
 assert.ok(applyAction(world,actor(guest),{action:'redeem-wing-design',wing:wing(),gmGuestWingCredits:99},{now:T}).error);
 assert.equal(applyAction(world,administrator,{action:'gm-wing-canvas',targetKey:guest},{now:T}).error,undefined);
 const result=applyAction(world,actor(guest),{action:'redeem-wing-design',wing:wing()},{now:T+1});
 assert.ok(result.personalWingId);
 assert.equal(world.profiles[guest].wingDesignCredits,0);
 assert.equal(world.profiles[guest].gmGuestWingCredits,0);
 assert.ok(applyAction(world,actor(guest),{action:'redeem-wing-design',wing:wing()},{now:T+2}).error);
});
