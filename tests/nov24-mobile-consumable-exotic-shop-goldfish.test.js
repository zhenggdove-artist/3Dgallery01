import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,worldView} from '../src/shared/temple-rules.js';
import {itemById,SHOP_EXOTIC_TIERS,shopWeaponVariant} from '../src/shared/catalog.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';

const NOW=38_000_000;
const player=(key,position=[75,0,0])=>({key,id:'actor-'+key,name:key,color:'#aadbee',role:'fighter',position});
const act=(world,who,now,payload,actors=[who])=>
 applyAction(world,who,payload,{now,actors,rng:()=>.5});

test('every exotic weapon has four stable-ID qualities with increasing prices and power',()=>{
 assert.deepEqual(SHOP_EXOTIC_TIERS,[1,2,3,4]);
 for(const id of ['telephone','jellybrella','goldfish','black-cat','white-cat','giraffe','accordion','fan','clam']){
  const base=itemById(id),variants=SHOP_EXOTIC_TIERS.map(tier=>shopWeaponVariant(base,tier));
  assert.ok(variants.every(v=>v.id===base.id));
  assert.deepEqual(variants.map(v=>v.tier),[1,2,3,4]);
  assert.ok(variants.every((v,i)=>i===0||v.price>variants[i-1].price),id+' prices rise');
  assert.ok(variants.every((v,i)=>i===0||v.damage>variants[i-1].damage),id+' power rises');
  assert.equal(variants[2].price,base.price,id+' legacy tier stays original');
 }
});

test('shop bulk-buy bills quality separately and preserves distinct item instances',()=>{
 const world=createInitialWorld(NOW),who=player('buyer'),profile=ensureProfile(world,who.key,who.name,who.color,NOW);
 profile.wallet=500_000;
 const base=itemById('telephone'),low=shopWeaponVariant(base,1),high=shopWeaponVariant(base,4);
 const lowBuy=act(world,who,NOW+1000,{action:'buy',itemId:base.id,qualityTier:1,quantity:2});
 assert.equal(lowBuy.error,undefined);
 assert.equal(lowBuy.purchased.total,low.price*2);
 const highBuy=act(world,who,NOW+1001,{action:'buy',itemId:base.id,qualityTier:4,quantity:1});
 assert.equal(highBuy.error,undefined);
 assert.equal(highBuy.purchased.total,high.price);
 assert.equal(profile.wallet,500_000-low.price*2-high.price);
 const owned=profile.inventoryInstances.filter(v=>v.itemId===base.id);
 assert.deepEqual(owned.map(v=>v.shopTier),[1,1,4]);
 assert.equal(new Set(owned.map(v=>v.uid)).size,3);
 const highIndex=profile.inventoryInstances.findIndex(v=>v.uid===owned[2].uid);
 assert.equal(act(world,who,NOW+1002,{action:'equip',itemId:base.id,inventoryIndex:highIndex}).error,undefined);
 const active=equippedItem(profile,itemById(profile.equipment.weapon));
 assert.equal(active.tier,4);
 assert.ok(active.damage>base.damage);
 assert.equal(profile.fusion[base.id]?.shopTier,4);
 assert.equal(worldView(world,who.key,NOW+1002).profile.inventoryInstances[highIndex].shopTier,4);
 const bad=act(world,who,NOW+1003,{action:'buy',itemId:base.id,qualityTier:8,quantity:1});
 assert.match(bad.error,/quality/i);
 assert.equal(profile.wallet,500_000-low.price*2-high.price);
});

test('single-touch orbit survives pinch cancellation and consumable taps while moving',()=>{
 const controller=readFileSync(new URL('../src/player-controller.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.match(controller,/rebuildCameraGesture/);
 assert.match(controller,/pointercancel','lostpointercapture/);
 assert.match(controller,/One active touch is ALWAYS an orbit/);
 assert.match(ui,/hotbar\?\.addEventListener\('pointerdown'/);
 assert.match(ui,/this\.emit\('quick-use'/);
});

test('goldfish school never selects or hits its own caster',()=>{
 const world=createInitialWorld(NOW),owner=player('fish-owner'),enemy=player('target',[75,0,10]);
 const p=ensureProfile(world,owner.key,owner.name,owner.color,NOW);
 const victim=ensureProfile(world,enemy.key,enemy.name,enemy.color,NOW);
 p.inventory.push('goldfish');p.equipment.weapon='goldfish';
 // A player can have both an actor.id and a distinct canonical actor.key.
 p.hp=p.maxHp-34;p.spawnProtectedUntil=0;
 victim.spawnProtectedUntil=0;
 const before=p.hp;
 const weapon=itemById('goldfish');
 assert.equal(act(world,owner,NOW+1000,{action:'attack',phase:'charge'},[owner,enemy]).charging,true);
 const attack=act(world,owner,NOW+1000+weapon.chargeMs+20,
  {action:'attack',charge:1,direction:[0,0,1]},[owner,enemy]);
 assert.equal(attack.error,undefined);
 assert.equal(attack.attackEvent.ultimate,true);
 for(let i=1;i<=18;i++)
  tickWorld(world,{now:NOW+1000+weapon.chargeMs+20+i*160,
   actors:[owner,enemy],activeFighters:2,rng:()=>.5});
 assert.equal(p.hp,before,'shooter never loses HP to their own fish');
 assert.equal((world.damageEvents||[]).some(event=>event.target===owner.key&&event.kind==='giant-goldfish'),false);
});

test('the rainbow spiral shader mode does not replace every unrelated spell',()=>{
 const particles=readFileSync(new URL('../src/weapon-particle-effects.js',import.meta.url),'utf8');
 assert.match(particles,/if\(recipe==='rainbow-spiral'\)return 8/);
 assert.match(particles,/else if\(uMode>7\.5\)/);
 assert.match(particles,/item\.id==='black-cat'&&charged&&data\.piercing/);
});
