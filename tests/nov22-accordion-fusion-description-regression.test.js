import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {weaponQuality,forwardCastRadius} from '../src/shared/weapon-abilities.js';
import {chargedArea,spellFootprint,scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {contactDamageIntervalMs,projectileFlightMs,visibleCollisionLifetimeMs} from '../src/shared/combat-balance.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {fuseTemple} from '../src/shared/temple-fusion.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';
import {playerStats} from '../src/shared/player-stats.js';
import {explainEquipment,explainWeapon} from '../src/shared/weapon-info.js';
import {weaponPresentation} from '../src/shared/weapon-presentation.js';
import {weaponAffixTotals} from '../src/shared/weapon-affixes.js';

const NOW=99000000;
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,'expected '+a+' to equal '+b);
function makeAdmin(){
 const world=createInitialWorld(NOW);
 const profile=ensureProfile(world,'gm-fusion-test','gm-fusion-test','#abcdef',NOW,true);
 return {world,profile};
}

test('accordion ultimate warning matches full moving collision corridor',()=>{
 const item=itemById('accordion'),quality=weaponQuality(item);
 const stats=attackStats(item,1);
 assert.equal(stats.range,30,'catalog charged reach unchanged');
 assert.ok(stats.radius>=4.5);
 stats.range*=quality.range;
 stats.radius=forwardCastRadius(item,quality,stats.radius,false);
 scaleUltimateFootprint(stats,item,quality);
 const area=chargedArea(item,[0,1.16,0],[0,0,1],stats);
 const preview=spellFootprint(item,[0,1.16,0],[0,0,1],stats,area);
 assert.equal(area.mode,'corridor');
 assert.equal(preview.shape,'rectangle');
 approx(preview.length,stats.range);
 approx(preview.width,stats.radius*2);
 assert.ok(preview.width>9,'large, readable score cyclone');
 assert.equal(contactDamageIntervalMs(item),1000);
 assert.equal(projectileFlightMs(item,true),2300);
 assert.equal(visibleCollisionLifetimeMs(item,true),3300);
});

test('accordion charge server dispatch uses the same warned collision dimensions',()=>{
 const {world,profile}=makeAdmin(),item=itemById('accordion');
 profile.equipment.weapon=item.id;
 const actor={key:profile.key,name:profile.key,role:'fighter',seat:0,
  color:'#abcdef',position:[75,0,0]};
 assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},{
  now:NOW+1000,actors:[actor],rng:()=>.5}).charging,true);
 const result=applyAction(world,actor,{action:'attack',charge:1,direction:[0,0,1]},{
  now:NOW+4500,actors:[actor],rng:()=>.5});
 assert.equal(result.error,undefined);
 assert.equal(result.attackEvent.area.mode,'corridor');
 const live=world.persistentAttacks.find(entry=>entry.weapon===item.id&&entry.kind==='projectile');
 assert.ok(live);
 approx(live.radius,result.attackEvent.radius);
 assert.equal(live.flightMs,2300);
 assert.equal(live.expiresAt-live.createdAt,3300);
});

test('headwear fusion grants 30% of ingredient attack to effective character stats',()=>{
 const {world,profile}=makeAdmin();
 profile.equipment.head='hat-dinosaur';
 const before=playerStats(world,profile).attack;
 const target=itemById('hat-dinosaur'),material=itemById('hat-shark');
 const result=fuseTemple(world,profile,{
  sourceId:material.id,targetId:target.id,requestId:'nov22-head-fusion-success'
 },()=>0);
 assert.equal(result.fusion?.success,true);
 approx(equippedItem(profile,target).bonuses.attack,.12+.14*.3);
 assert.ok(playerStats(world,profile).attack>before+.04);
 assert.match(weaponPresentation(target,profile.fusion[target.id]).bonuses.join(','),/Attack Power/);
});

test('outfit fusion grants 30% of source HP and attack to actual playerStats',()=>{
 const {world,profile}=makeAdmin();
 profile.equipment.outfit='outfit-pig-1';
 const before=playerStats(world,profile);
 const target=itemById('outfit-pig-1'),material=itemById('outfit-pig-2');
 const result=fuseTemple(world,profile,{
  sourceId:material.id,targetId:target.id,requestId:'nov22-outfit-fusion-success'
 },()=>0);
 assert.equal(result.fusion?.success,true);
 const final=equippedItem(profile,target);
 approx(final.bonuses.hp,2+4*.3);
 approx(final.bonuses.attack,.025+.05*.3);
 const after=playerStats(world,profile);
 const hpEnchant=weaponAffixTotals(profile.fusion?.[profile.equipment.weapon]).hp;
 approx(after.maxHp-before.maxHp,12*(1+hpEnchant/100));
 assert.ok(after.attack>before.attack);
 assert.match(explainEquipment(target,profile.fusion[target.id]),/Maximum HP/);
});

test('descriptions and visual implementation correspond to updated mechanics',()=>{
 assert.match(explainWeapon(itemById('accordion')),/once per second/);
 assert.match(explainWeapon(itemById('black-cat')),/sniper scope/);
 assert.match(explainWeapon(itemById('bloom-1')),/restores 1 HP per second/);
 assert.match(explainEquipment(itemById('hat-hockey')),/Maximum HP/);
 assert.match(explainEquipment(itemById('shield-1')),/absorbs/);
 const vfx=readFileSync(new URL('../src/weapon-vfx.js',import.meta.url),'utf8');
 assert.match(vfx,/\(item.baseId\|\|item.id\)==='accordion'\|\|item.family==='petal'/);
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/healNow-lastHealVisualAt>=1000/);
 assert.doesNotMatch(main,/hp>previousHealHp/);
 const particles=readFileSync(new URL('../src/weapon-particle-effects.js',import.meta.url),'utf8');
 assert.match(particles,/spin\*3\.45/);
 assert.match(particles,/chosen==='music'\?5200/);
});