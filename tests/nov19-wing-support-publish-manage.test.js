import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,worldView,migrateWorld} from '../src/shared/temple-rules.js';
import {drawWing,drawGmWing,WING_QUALITY_WEIGHTS} from '../src/shared/wing-shop.js';
import {registerCustomWings,itemById} from '../src/shared/catalog.js';
import {normalizePaintedWing,totalCustomWingRates} from '../src/shared/custom-wings.js';

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
const publish=(world,name,rate,time=TIME)=>applyAction(world,actor(gm),
 {action:'gm-wing-publish',wing:draft(name,rate)},{now:time});

test('GM publishes a custom freehand wing, adds it to BAG, and equips the exact new physical instance atomically',()=>{
 const {world,profile}=setup();
 const before=profile.inventory.length;
 const result=publish(world,'My First Painted Wing',1.75);
 assert.equal(result.error,undefined);
 assert.match(result.publishedWingId,/^gm-wing-/);
 assert.equal(result.equippedWingId,result.publishedWingId);
 assert.equal(profile.inventory.length,before+1);
 assert.equal(profile.inventory.at(-1),result.publishedWingId);
 assert.equal(profile.equipment.wings,result.publishedWingId);
 assert.equal(profile.equippedInstanceIds.wings,profile.inventoryInstances.at(-1).uid);
 assert.equal(worldView(world,gm,TIME).profile.equipment.wings,result.publishedWingId);
 assert.equal(world.customWings[0].drawRatePct,1.75);
 assert.equal(itemById(result.publishedWingId)?.name,'My First Painted Wing');
 const after=migrateWorld(structuredClone(world),TIME+100);
 registerCustomWings(after.customWings);
 assert.equal(after.profiles[gm].equipment.wings,result.publishedWingId);
 assert.equal(after.profiles[gm].inventory.filter(id=>id===result.publishedWingId).length,1);
});

test('independent percentage per custom wing is exact; rest uses the original rarity mix',()=>{
 const a=normalizePaintedWing(draft('A',1.5),'gm-wing-11111111-1111-4111-8111-111111111111');
 const b=normalizePaintedWing(draft('B',2.5),'gm-wing-22222222-2222-4222-8222-222222222222');
 const user={inventory:[]};
 assert.equal(totalCustomWingRates([a,b]),4);
 assert.equal(drawWing(user,()=>.005,[a,b]).item.id,a.id);
 assert.equal(drawWing(user,()=>.014999,[a,b]).item.id,a.id);
 assert.equal(drawWing(user,()=>.015,[a,b]).item.id,b.id);
 assert.equal(drawWing(user,()=>.039999,[a,b]).item.id,b.id);
 const fallback=drawWing(user,()=>.04,[a,b]);
 assert.match(fallback.item.id,/^wings-/);
 assert.equal(fallback.quality,'common');
 assert.equal(drawWing(user,()=>.94).quality,'epic');
 assert.equal(WING_QUALITY_WEIGHTS.epic,5);
 assert.equal(drawGmWing({admin:true,inventory:[]},()=>.005,[a,b]).item.id,a.id);
 const zero={...a,drawRatePct:0};
 assert.notEqual(drawWing(user,()=>0,[zero]).item.id,a.id);
});

test('GM management sets absolute percentages and checks total budget and authorization',()=>{
 const {world}=setup();
 const first=publish(world,'First',1);
 const second=publish(world,'Second',2,TIME+1);
 assert.equal(second.error,undefined);
 assert.equal(publish(world,'Too Much',100).error,'所有上架翅膀的個別中獎率合計不可超過 100%');
 const changed=applyAction(world,actor(gm),
  {action:'gm-wing-set-rate',wingId:first.publishedWingId,drawRatePct:98},{now:TIME+2});
 assert.equal(changed.error,undefined);
 assert.equal(totalCustomWingRates(world.customWings),100);
 const failed=applyAction(world,actor(gm),
  {action:'gm-wing-set-rate',wingId:second.publishedWingId,drawRatePct:3},{now:TIME+3});
 assert.match(failed.error,/100%/);
 const outOfRange=applyAction(world,actor(gm),
  {action:'gm-wing-set-rate',wingId:first.publishedWingId,drawRatePct:100.0009},{now:TIME+4});
 assert.match(outOfRange.error,/0–100%/);
 const fake=actor('stranger');
 ensureProfile(world,'stranger','stranger','#aabbcc',TIME,false);
 const stolen=applyAction(world,{...fake,admin:true},
  {action:'gm-wing-set-rate',wingId:first.publishedWingId,drawRatePct:0},{now:TIME+5});
 assert.equal(stolen.error,'GM only');
});

test('removing an uploaded wing retires it from draws but preserves already owned equipment',()=>{
 const {world,profile}=setup();
 const first=publish(world,'Transient',100);
 const itemId=first.publishedWingId;
 assert.equal(drawWing({inventory:[]},()=>0,world.customWings).item.id,itemId);
 const result=applyAction(world,actor(gm),{action:'gm-wing-remove',wingId:itemId},{now:TIME+1});
 assert.equal(result.unpublishedWingId,itemId);
 assert.equal(world.customWings[0].retired,true);
 assert.equal(totalCustomWingRates(world.customWings),0);
 assert.ok(world.profiles[gm].inventory.includes(itemId));
 assert.equal(profile.equipment.wings,itemId);
 assert.equal(itemById(itemId)?.name,'Transient');
 assert.notEqual(drawWing({inventory:[]},()=>0,world.customWings).item.id,itemId);
 const after=migrateWorld(structuredClone(world),TIME+3);
 registerCustomWings(after.customWings);
 assert.equal(after.profiles[gm].equipment.wings,itemId);
 assert.equal(itemById(itemId)?.name,'Transient');
 assert.match(applyAction(after,actor(gm),{action:'gm-wing-remove',wingId:itemId},{now:TIME+5}).error,/已下架/);
 const other=ensureProfile(after,'non-admin','Other','#aabbcc',TIME+10,false);
 const forbidden=applyAction(after,actor('non-admin'),{action:'gm-wing-remove',wingId:itemId},{now:TIME+11});
 assert.equal(forbidden.error,'GM only');
 assert.equal(other.admin,false);
});

test('Win98 SUPPORT gacha, GM management, draw callback and network timeout are all wired',()=>{
 const ui=read('src/ui.js'),painter=read('src/gm-wing-painter.js'),main=read('src/main.js'),
  worker=read('cloudflare/worker.js'),network=read('src/network.js'),css=read('wing-atelier.css');
 assert.match(ui,/renderWingShop\(profile\)/);
 assert.match(ui,/wing-support-machine/);
 assert.match(ui,/wing-gacha-machine/);
 assert.match(ui,/renderWingManage\(profile\)/);
 assert.match(ui,/data-wing-rate-save/);
 assert.match(ui,/data-wing-remove/);
 assert.match(ui,/hydrateWingGalleryImages\(\)/);
 assert.match(css,/body\.panel-wing-shop #panel\{/);
 assert.match(painter,/ui\.emit\('wing-publish-request'/);
 assert.match(painter,/上架失敗：/);
 assert.match(painter,/drawRatePct/);
 assert.match(main,/ui\.addEventListener\('wing-publish-request'/);
 assert.match(main,/throwOnError:true/);
 assert.match(main,/ui\.openPanel\('bag'\)/);
 assert.match(network,/timeoutMs:action==='gm-wing-publish'\?30000:0/);
 assert.match(worker,/result\.unpublishedWingId\|\|result\.updatedWingId/);
});
