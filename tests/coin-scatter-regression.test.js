import test from 'node:test';
import assert from 'node:assert/strict';
import {PLATFORMS} from '../src/shared/arena.js';
import {itemById,SHOP_ITEMS,STARTER_LOADOUT} from '../src/shared/catalog.js';
import {createInitialWorld,createProfile,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {oddVolley,oddAttackStats} from '../src/reletter/odd-weapons.js';
import {recipeFor} from '../src/weapon-particle-effects.js';
test('display coins are walkable and outside all artwork decks',()=>{
 for(const p of PLATFORMS){
  const reach=Math.hypot(p.position[0]-p.coinPosition[0],p.position[2]-p.coinPosition[2]);
  assert.ok(reach>14,p.id);
  assert.equal(p.coinPosition[1],1.05);
  assert.ok(Math.hypot(p.coinPosition[0],p.coinPosition[2])<92,p.id);
 }
});
test('all 13 relocated coins can be picked up at ground height',()=>{
 const now=9000,world=createInitialWorld(now);
 for(let i=0;i<PLATFORMS.length;i++){
  const p=PLATFORMS[i],actor={key:'player',role:'fighter',position:[p.coinPosition[0],0,p.coinPosition[2]]};
  const result=applyAction(world,actor,{action:'pickup-coin',platformId:p.id},{now:now+i});
  assert.ok(!result.error,p.id+': '+result.error);
 }
});
test('chiang token is no longer a Temple weapon, including old accounts',()=>{
 assert.equal(itemById('chiang-token'),null);
 assert.ok(!SHOP_ITEMS.some(p=>p.id==='chiang-token'));
 const world=createInitialWorld(1000),user=createProfile('p','p');
 user.inventory.push('chiang-token');user.equipment.weapon='chiang-token';world.profiles.p=user;
 ensureProfile(world,'p','p','#ffffff',2000);
 assert.ok(!user.inventory.includes('chiang-token'));
 assert.equal(user.equipment.weapon,STARTER_LOADOUT.weapon);
 assert.equal(itemById(STARTER_LOADOUT.weapon).family,'saber');
});
test('calico shot spread is wider when charged and particles use a 3D cone',()=>{
 const weapon=itemById('calico-cat'),shot={direction:[0,0,1],charge:0,damage:50},charged={...shot,charge:1};
 assert.equal(recipeFor(weapon),'rainbow-scatter');
 assert.equal(oddVolley(weapon,shot).length,5);
 assert.equal(oddVolley(weapon,charged).length,8);
 assert.ok(Math.abs(oddVolley(weapon,charged)[0].direction[0])>.6);
 assert.ok(oddAttackStats(weapon,1).radius>oddAttackStats(weapon,0).radius);
});
