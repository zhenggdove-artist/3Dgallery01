import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,worldView,migrateWorld} from '../src/shared/temple-rules.js';
import {registerCustomWings,itemById,SHOP_ITEMS} from '../src/shared/catalog.js';
import {normalizePaintedWing} from '../src/shared/custom-wings.js';
const TIME=Date.UTC(2026,10,19,3,0);
const actor=key=>({key,name:key,color:'#aabbcc',role:'fighter',admin:false,position:[0,0,10]});
const gm='authorized-gm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const draft=(name,drawRatePct=1)=>({
 name,tier:4,color:'#aabbcc',ability:'glide',drawRatePct,
 shape:'freehand',scaleX:1,scaleY:1,impulse:11,gravity:.53,flapMs:300,
 outline:[[.1,.1],[.8,.1],[.93,.45],[.7,.9],[.2,.85]],strokes:[]
});
const setup=()=>{
 const world=createInitialWorld(TIME);
 const profile=ensureProfile(world,gm,'GM','#aabbcc',TIME,true);
 return {world,profile};
};
const publish=(world,name,rate=1,time=TIME)=>applyAction(world,actor(gm),
 {action:'gm-wing-publish',wing:draft(name,rate)},{now:time});
test('GM wing publishing remains transactional and custom collectibles never enter regular shop',()=>{
 const {world,profile}=setup();
 const before=profile.inventory.length;
 const result=publish(world,'Artist Original',1.75);
 assert.equal(result.error,undefined);
 assert.match(result.publishedWingId,/^gm-wing-/);
 assert.equal(result.equippedWingId,result.publishedWingId);
 assert.equal(profile.inventory.length,before+1);
 assert.equal(profile.equipment.wings,result.publishedWingId);
 assert.equal(profile.equippedInstanceIds.wings,profile.inventoryInstances.at(-1).uid);
 assert.equal(worldView(world,gm,TIME).profile.equipment.wings,result.publishedWingId);
 assert.equal(itemById(result.publishedWingId).name,'Artist Original');
 assert.ok(!SHOP_ITEMS.some(entry=>entry.id===result.publishedWingId));
 const restored=migrateWorld(structuredClone(world),TIME+100);
 registerCustomWings(restored.customWings);
 assert.equal(restored.profiles[gm].equipment.wings,result.publishedWingId);
});
test('GM may update original wing without duplication and cannot forge admin authority',()=>{
 const {world,profile}=setup();
 const first=publish(world,'Original',2);
 const before=profile.inventory.length;
 const edited=applyAction(world,actor(gm),{action:'gm-wing-update',wingId:first.publishedWingId,
  wing:draft('New design',3)},{now:TIME+1});
 assert.equal(edited.updatedWingId,first.publishedWingId);
 assert.equal(profile.inventory.length,before);
 assert.equal(itemById(first.publishedWingId).name,'New design');
 ensureProfile(world,'stranger','Stranger','#aabbcc',TIME,false);
 assert.equal(applyAction(world,actor('stranger'),{action:'gm-wing-update',
  wingId:first.publishedWingId,wing:draft('Stolen')},{now:TIME+2}).error,'GM only');
});
test('GM removing a custom wing preserves owner possession, but the normal shop remains curated',()=>{
 const {world,profile}=setup();
 const first=publish(world,'Archived wing',2);
 const result=applyAction(world,actor(gm),{action:'gm-wing-remove',
  wingId:first.publishedWingId},{now:TIME+1});
 assert.equal(result.unpublishedWingId,first.publishedWingId);
 assert.equal(world.customWings[0].retired,true);
 assert.equal(profile.equipment.wings,first.publishedWingId);
 assert.ok(profile.inventory.includes(first.publishedWingId));
 assert.ok(!SHOP_ITEMS.some(entry=>entry.id===first.publishedWingId));
});
test('wing painter, management and paid entitlement UI remain separate from the regular shop',()=>{
 const ui=read('src/ui.js'),painter=read('src/gm-wing-painter.js'),
  main=read('src/main.js'),worker=read('cloudflare/worker.js');
 assert.match(ui,/renderWingManage\(profile\)/);
 assert.match(ui,/data-wing-edit/);
 assert.match(ui,/data-wing-remove/);
 assert.match(ui,/data-wing-checkout/);
 assert.match(painter,/ui\.emit\('wing-publish-request'/);
 assert.match(main,/redeem-wing-design/);
 assert.match(worker,/result\.personalWingId/);
 const shop=ui.slice(ui.indexOf('  renderShop(profile){'),ui.indexOf('  renderWingShop(profile){'));
 assert.doesNotMatch(shop,/wing-shop-link/);
});
