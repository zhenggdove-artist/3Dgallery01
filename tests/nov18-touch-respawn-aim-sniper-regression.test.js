import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {bindBagDrag} from '../src/bag-drag.js';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,validateState,worldView,RESPAWN_SHIELD_MS} from '../src/shared/temple-rules.js';
import {PLAYER_SPAWNS,insideArena,insideSafeZone} from '../src/shared/arena.js';
import {attackStats,itemById} from '../src/shared/catalog.js';
import {scaleUltimateFootprint,chargedArea} from '../src/shared/charge-area.js';
import {weaponQuality,forwardCastRadius} from '../src/shared/weapon-abilities.js';
import {fusionSniperEchoDamage,sniperMaterialStat} from '../src/shared/fusion-balance.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';
import {NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';

const NOW=20_000_000,actor=(key='tester',position=[75,0,0],admin=false)=>({key,name:key,color:'#abcdef',role:'fighter',position,admin});

test('swap-inventory validates indexes and persists exact slot order, even with identical IDs',()=>{
 const world=createInitialWorld(NOW),user=actor(),p=ensureProfile(world,user.key,user.name,user.color,NOW);
 p.inventory.push('ember-1','frost-1','ember-1','pan-1');
 const before=[...p.inventory],equipped=p.equipment.weapon;
 const result=applyAction(world,user,{action:'swap-inventory',fromIndex:1,toIndex:3},{now:NOW+5});
 assert.equal(result.inventoryReordered,true);
 assert.equal(p.inventory[1],before[3]);assert.equal(p.inventory[3],before[1]);
 assert.equal(p.equipment.weapon,equipped);
 assert.deepEqual(worldView(world,user.key,NOW+5).profile.inventory,p.inventory);
 const keep=[...p.inventory];
 for(const [fromIndex,toIndex] of [[-1,2],[0,999],[1.4,2],[2,'1'],[null,0]]){
  assert.equal(applyAction(world,user,{action:'swap-inventory',fromIndex,toIndex},{now:NOW+7}).error,'Invalid inventory slot');
  assert.deepEqual(p.inventory,keep);
 }
});

test('mobile BAG scrolls naturally before long press; after hold drag auto-scrolls both directions and swaps',async()=>{
 const oldDoc=globalThis.document,oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
 const callbacks={},docHandlers={};let frame=null;
 const cell=(index,id)=>({dataset:{inventoryIndex:String(index),bagItem:id},
  getBoundingClientRect:()=>({left:20,top:100,width:56,height:56}),
  cloneNode:()=>({style:{},removeAttribute(){},remove(){}}),
  closest(){return this;}});
 const a=cell(5,'ember-1'),b=cell(49,'frost-1');
 const grid={scrollTop:300,contains:()=>true,
  getBoundingClientRect:()=>({left:10,right:220,top:80,bottom:350,height:270})};
 const area={addEventListener(name,fn){callbacks[name]=fn;},
  querySelector(selector){return selector==='#bag-items:not(.equipment-view)'?grid:null;}};
 const calls=[];
 const ui={content:area,panelName:'bag',bagFusionMode:false,
  emit(name,data){calls.push({name,data});}};
 try{
  globalThis.document={body:{append(){}},elementFromPoint:()=>b,addEventListener(name,fn){docHandlers[name]=fn;}};
  globalThis.requestAnimationFrame=fn=>{frame=fn;return 1;};
  globalThis.cancelAnimationFrame=()=>{frame=null;};
  bindBagDrag(ui);
  const evt=(touch,p)=>({target:a,touches:[touch],changedTouches:[touch],preventDefault:()=>{p.prevented=true;}});
  let pointer={identifier:11,clientX:40,clientY:130},prevented={};
  callbacks.touchstart(evt(pointer,prevented));
  pointer={...pointer,clientY:170};
  docHandlers.touchmove(evt(pointer,prevented));
  assert.equal(prevented.prevented,undefined,'scroll gesture must not be cancelled before hold activation');
  await new Promise(resolve=>setTimeout(resolve,290));
  assert.equal(calls.length,0,'scroll must not trigger a drop');
  // Long press a second time and drag to the bottom edge.
  pointer={identifier:12,clientX:40,clientY:130};
  callbacks.touchstart(evt(pointer,{}));
  await new Promise(resolve=>setTimeout(resolve,315));
  pointer={...pointer,clientY:345};
  prevented={};docHandlers.touchmove(evt(pointer,prevented));
  assert.equal(prevented.prevented,true,'active drag blocks native scroll');
  const prior=grid.scrollTop;for(let n=0;n<10;n++)frame?.();
  assert.ok(grid.scrollTop>prior+50,'holding near lower boundary auto-scrolls actual grid');
  pointer={...pointer,clientY:82};docHandlers.touchmove(evt(pointer,prevented));
  const top=grid.scrollTop;for(let n=0;n<10;n++)frame?.();
  assert.ok(grid.scrollTop<top-50,'holding near upper boundary auto-scrolls upward');
  docHandlers.touchend(evt(pointer,prevented));
  assert.equal(calls.length,1);
  assert.equal(calls[0].data.action,'swap-inventory');
  assert.equal(calls[0].data.fromIndex,5);
  assert.equal(calls[0].data.toIndex,49);
  ui.bagFusionMode=true;
  pointer={identifier:13,clientX:40,clientY:130};
  callbacks.touchstart(evt(pointer,{}));
  await new Promise(resolve=>setTimeout(resolve,315));
  docHandlers.touchend(evt(pointer,{}));
  assert.equal(calls[1].data.action,'fuse');
  assert.equal(calls[1].data.sourceId,'ember-1');
  assert.equal(calls[1].data.targetId,'frost-1');
 }finally{
  globalThis.document=oldDoc;
  globalThis.requestAnimationFrame=oldRaf;
  globalThis.cancelAnimationFrame=oldCancel;
 }
});

test('all fighter spawns are near central writing tree, 64m roof is legal and higher Y is rejected',()=>{
 for(const spawn of PLAYER_SPAWNS){
  assert.ok(insideSafeZone(spawn),'spawn stays inside protected central writing garden');
  assert.ok(Math.hypot(spawn[0],spawn[2])>3,'spawn must not intersect tree trunk');
 }
 assert.equal(RESPAWN_SHIELD_MS,3000);
 assert.equal(insideArena([6,64,0]),true);
 assert.equal(insideArena([6,64.01,0]),false);
 assert.equal(validateState(null,{position:[6,64,0],rotation:0,animation:'jump'},90,'fighter').error,undefined);
 const controller=readFileSync(new URL('../src/player-controller.js',import.meta.url),'utf8');
 assert.match(controller,/if\(this\.root\.position\.y>64\)/);
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.doesNotMatch(main,/return ui\.showPlantList\(\)/);
});

test('all automatic, login-time and explicit respawns grant 3s immunity that cannot be reused while alive',()=>{
 const world=createInitialWorld(NOW),p=ensureProfile(world,'f','fighter','#abcdef',NOW);
 p.hp=0;p.deadUntil=NOW+100;
 tickWorld(world,{now:NOW+100,activeFighters:0,actors:[],rng:()=>.5});
 assert.equal(p.hp,p.maxHp);
 assert.equal(p.spawnProtectedUntil,NOW+100+3000);
 assert.equal(worldView(world,'f',NOW+100).profile.spawnProtectedUntil,NOW+3100);
 assert.equal(applyAction(world,actor('f'),{action:'respawn'},{now:NOW+150}).error,'Respawn unavailable while alive');
 assert.equal(p.spawnProtectedUntil,NOW+3100);
 const other=ensureProfile(world,'g','g','#abcdef',NOW);
 other.hp=0;other.deadUntil=NOW+200;
 ensureProfile(world,'g','g','#abcdef',NOW+201);
 assert.equal(other.spawnProtectedUntil,NOW+201+3000);
});

test('monster collision cannot damage a freshly respawned player until protection expires',()=>{
 const world=createInitialWorld(NOW),a=actor('fighter',[75,0,1]),p=ensureProfile(world,a.key,a.name,a.color,NOW);
 p.spawnProtectedUntil=NOW+3000;
 const swipe=(id,now)=>({id,motion:'swipe',phase:'active',origin:[75,0,0],aim:[75,0,3],radius:4.2,
  start:now-50,end:now+550,hit:[],damage:12});
 world.monster={id:'m',active:true,model:'uncle',hp:100,maxHp:100,position:[75,0,0],
  skills:[swipe('s1',NOW+200)],updatedAt:NOW,nextAttackAt:NOW+100000};
 tickWorld(world,{now:NOW+200,actors:[a],activeFighters:0,rng:()=>.5});
 assert.equal(p.hp,p.maxHp);
 assert.equal(p.effects?.stun,undefined);
 world.monster.skills=[swipe('s2',NOW+3100)];
 tickWorld(world,{now:NOW+3100,actors:[a],activeFighters:0,rng:()=>.5});
 assert.ok(p.hp<p.maxHp,'normal damage resumes after exactly three seconds');
});

test('telephone ultimate warning radius matches the equivalent tier-3 frying-pan ultimate',()=>{
 const phone=itemById('telephone'),pan=itemById('pan-3');
 const measured=item=>{
  const stats=attackStats(item,1),q=weaponQuality(item);
  stats.range=+(stats.range*q.range).toFixed(2);
  stats.radius=forwardCastRadius(item,q,stats.radius,false);
  return scaleUltimateFootprint(stats,item,q);
 };
 const a=measured(phone),b=measured(pan);
 assert.equal(a.radius,b.radius);
 assert.equal(chargedArea(phone,[0,1,0],[0,0,1],a).radius,b.radius);
});

test('borrowed sniper echo falls within ordinary same-tier spell budget and clamps legacy saves',()=>{
 const sniper=itemById('black-cat'),cap=fusionSniperEchoDamage(sniper);
 assert.ok(cap.damage>0&&cap.pvpDamage>0);
 assert.ok(cap.pvpDamage<6);
 assert.ok(cap.damage<attackStats(sniper,1).damage*.2);
 assert.ok(sniperMaterialStat(sniper,'damage')<sniper.damage);
 const world=createInitialWorld(NOW),p=ensureProfile(world,'legacy','legacy','#abcdef',NOW);
 p.inventory.push('ember-1');
 p.fusion['ember-1']={templeStats:{damage:9999,chargeDamage:9999},
  sources:[{id:'black-cat',echo:false},{id:'frost-1',echo:false}]};
 const fused=equippedItem(p,itemById('ember-1'));
 assert.ok(fused.damage<itemById('ember-1').damage+40);
 assert.ok(fused.chargeDamage<itemById('ember-1').chargeDamage+40);
});

test('native sustained beam follows full-resolution camera direction smoothly every frame',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const fx={group:new THREE.Group(),finished:false,update(){},setEndpoints(start,end){this.direction=end.clone().sub(start).normalize();}};
 scene.add(fx.group);
 const renderer=new NumberedWeaponEffects(scene,()=>new THREE.Vector3(0,1,0));
 const entry={spec:{number:8,asset:'arc-ray'},fx,root,item:{cooldown:700},
  direction:new THREE.Vector3(0,0,1),visualDirection:new THREE.Vector3(0,0,1),
  origin:new THREE.Vector3(0,1,0),target:new THREE.Vector3(0,1,0),
  range:12,channel:true,key:'beam-test',lastPulse:performance.now(),age:0,duration:Infinity};
 renderer.active=[entry];
 root.userData.staffAimDirection=[1,0,0];
 renderer.update(.016);
 assert.ok(entry.visualDirection.x>.2&&entry.visualDirection.x<.6);
 assert.ok(entry.visualDirection.z>.2);
 assert.ok(fx.direction.x>0&&fx.direction.z>0);
 for(let i=0;i<16;i++)renderer.update(.016);
 assert.ok(entry.visualDirection.x>.99,'camera can steer across intermediate angles without steps');
});
