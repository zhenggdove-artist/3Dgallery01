import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,worldView} from '../src/shared/temple-rules.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';
import {fusionEchoAnchor,scaleUltimateFootprint} from '../src/shared/charge-area.js';

const T=80_000_000;
const actor={key:'fusion-geometry',name:'fusion-geometry',role:'fighter',color:'#ffffff',
 position:[75,0,0],seat:0};
function cast(primary,borrowed){
 const world=createInitialWorld(T),profile=ensureProfile(world,actor.key,actor.name,actor.color,T);
 profile.inventory.push(primary);profile.equipment.weapon=primary;
 if(borrowed)profile.fusion[primary]={layer:0,effects:[borrowed]};
 const ctx=now=>({now,actors:[actor],rng:()=>.5});
 assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},ctx(T+1500)).charging,true);
 const release=applyAction(world,actor,{action:'attack',direction:[0,0,1],charge:1},ctx(T+4500));
 assert.equal(release.error,undefined);
 return {world,profile,event:release.attackEvent};
}
test('swatter primary: borrowed saber ray stops at the centre of the warned swatter circle',()=>{
 const {event}=cast('swatter-1','saber-5');
 assert.equal(event.area.mode,'area');
 const echo=event.fusionEchoes[0],target=fusionEchoAnchor(echo.parentFootprint,event.origin);
 assert.equal(echo.weapon,'saber-5');
 assert.equal(echo.area.mode,'corridor');
 assert.ok(Math.abs(echo.range-target.distance)<.002);
 assert.ok(Math.hypot(target.x-event.area.center[0],target.z-event.area.center[2])<.002);
 assert.ok(echo.range<attackStats(itemById('saber-5'),1).range,
  'longer source blade is shortened to the main circle');
});
test('saber primary: borrowed swatter circle detonates at the blade endpoint without rectangle clipping',()=>{
 const {event}=cast('saber-3','swatter-3');
 const echo=event.fusionEchoes[0],box=echo.parentFootprint;
 assert.equal(box.shape,'rectangle');
 assert.equal(echo.area.mode,'area');
 const target=fusionEchoAnchor(box,event.origin);
 assert.ok(Math.hypot(target.x-echo.area.center[0],target.z-echo.area.center[2])<.002);
 assert.ok(Math.abs(echo.range-target.distance)<.002);
 assert.ok(echo.area.radius>box.width*.5,
  'the borrowed circular blast extends laterally beyond the sword ray');
});
test('older fused reach modifiers cannot override the original weapon footprint',()=>{
 const blade=itemById('saber-2');
 const inflated={fusion:{[blade.id]:{templeStats:{
  range:999,chargeRange:999,radius:999,damage:blade.damage+5}}}};
 const resolved=equippedItem(inflated,blade);
 assert.equal(resolved.range,blade.range);
 assert.equal(resolved.chargeRange,blade.chargeRange);
 assert.equal(resolved.radius,blade.radius);
 assert.ok(resolved.damage>blade.damage);
});
test('saber charged travel is halved in both authoritative VFX and hit geometry; normal equals whip reach',()=>{
 for(let tier=1;tier<=5;tier++){
  const blade=itemById('saber-'+tier),normal=attackStats(blade,0);
  const whipReach=(4.7+(tier-1)*1.5)/3;
  assert.ok(normal.range<=whipReach+.001);
  assert.ok(normal.radius<=.16);
  const full=attackStats(blade,1),shrunken=scaleUltimateFootprint({...full},blade);
  assert.ok(Math.abs(shrunken.range-full.range*.6*.5)<.002);
  assert.ok(Math.abs(shrunken.radius-full.radius*.6)<.002);
 }
});
test('the server exposes consumed goldfish indices for per-fish instanced visibility',()=>{
 const {world,event}=cast('goldfish');
 const school=world.persistentAttacks.find(fx=>fx.id===event.persistentAttackId);
 assert.ok(school);
 school.fishConsumed=[1,8,14];
 const track=worldView(world,actor.key,T+4500).goldfishFlights.find(v=>v.id===school.id);
 assert.deepEqual(track.consumed,[1,8,14]);
 const render=readFileSync(new URL('../src/weapon-signature-effects.js',import.meta.url),'utf8');
 assert.match(render,/consumedFish\.has\(i\)\?0/);
 assert.match(render,/track\.consumed\|\|\[\]/);
});
