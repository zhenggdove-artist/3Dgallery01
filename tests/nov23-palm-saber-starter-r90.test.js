import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itemById,STARTER_LOADOUT,attackStats} from '../src/shared/catalog.js';
import {weaponQuality,forwardCastRadius} from '../src/shared/weapon-abilities.js';
import {PALM_ULTIMATE_RADIUS_MULTIPLIER,ULTIMATE_FOOTPRINT_SCALE,scaleUltimateFootprint,chargedArea} from '../src/shared/charge-area.js';
import {createInitialWorld,createProfile,ensureProfile,applyAction} from '../src/shared/temple-rules.js';

const NOW=7_770_000;
function palmRadius(tier){
 const item=itemById('palm-'+tier),quality=weaponQuality(item),stats=attackStats(item,1);
 stats.range=+(stats.range*quality.range).toFixed(2);
 stats.radius=forwardCastRadius(item,quality,stats.radius,false);
 scaleUltimateFootprint(stats,item,quality);
 return {item,quality,stats,radius:stats.radius};
}
test('purple Coconut Palm AoE equals precisely the previous green quality circle',()=>{
 const green=palmRadius(2),purple=palmRadius(4);
 assert.equal(green.item.rarity,'uncommon');
 assert.equal(purple.item.rarity,'epic');
 const previousGreen=+(forwardCastRadius(green.item,green.quality,attackStats(green.item,1).radius,false)*
  ULTIMATE_FOOTPRINT_SCALE*10).toFixed(3);
 assert.equal(previousGreen,11.34);
 assert.equal(purple.radius,previousGreen);
 assert.equal(PALM_ULTIMATE_RADIUS_MULTIPLIER,10*(1.4/2.4));
});
test('lower Coconut Palm quality radii scale down proportionally without affecting range or duration',()=>{
 const grades=[1,2,3,4,5].map(palmRadius);
 for(let tier=1;tier<5;tier++){
  const lower=grades[tier-1],higher=grades[tier];
  assert.ok(higher.radius>lower.radius,'higher grade circle must remain larger than lower grade');
  assert.ok(Math.abs(higher.radius/lower.radius-higher.quality.visual/lower.quality.visual)<.001);
 }
 for(const {item,stats} of grades){
  const full=attackStats(item,1);
  const expectedRange=+(Math.max(.5,full.range*weaponQuality(item).range)*ULTIMATE_FOOTPRINT_SCALE).toFixed(3);
  assert.ok(Math.abs(stats.range-expectedRange)<.005,'cast reach stays unchanged');
  const area=chargedArea(item,[75,1,0],[0,0,1],stats);
  assert.equal(area.radius,stats.radius,'client warning and authoritative server use one radius');
 }
 const vfx=readFileSync(new URL('../src/plant-ultimate-effects.js',import.meta.url),'utf8');
 assert.match(vfx,/kind==='palm'\?radius\/4\.3/);
});
test('fresh players own and equip green uncommon Starlight saber, not White Cat',()=>{
 const green=itemById('saber-2');
 assert.equal(green.rarity,'uncommon');
 assert.equal(green.slot,'weapon');
 assert.equal(STARTER_LOADOUT.weapon,green.id);
 const world=createInitialWorld(NOW),player=ensureProfile(world,'fresh','Fresh','#43b59a',NOW);
 assert.equal(player.equipment.weapon,'saber-2');
 assert.deepEqual(player.inventory,['saber-2']);
 assert.equal(player.starterWeaponId,'saber-2');
 ensureProfile(world,'fresh','Fresh','#43b59a',NOW+100);
 assert.equal(player.inventory.filter(id=>id==='saber-2').length,1,'no extra starter on reconnect');
});
test('saved player loadouts retain old ownership and choices, without a free new sword',()=>{
 const world=createInitialWorld(NOW),saved=createProfile('old','Old','#43b59a',NOW-100);
 delete saved.starterWeaponId;
 saved.inventory=['white-cat','saber-3'];
 saved.equipment.weapon='saber-3';
 world.profiles.old=saved;
 const player=ensureProfile(world,'old','Old','#43b59a',NOW);
 assert.equal(player.starterWeaponId,'white-cat');
 assert.equal(player.equipment.weapon,'saber-3');
 assert.deepEqual(player.inventory,['white-cat','saber-3']);
 const returned=ensureProfile(world,'old','Old','#43b59a',NOW+100);
 assert.equal(returned.equipment.weapon,'saber-3');
 assert.equal(returned.inventory.includes('saber-2'),false);
});
test('old starter already consumed by fusion does not respawn',()=>{
 const world=createInitialWorld(NOW),saved=createProfile('spent','Spent','#43b59a',NOW-500);
 delete saved.starterWeaponId;
 saved.inventory=['saber-3'];
 saved.equipment.weapon='saber-3';
 saved.spentStarterWeapon=true;
 world.profiles.spent=saved;
 const profile=ensureProfile(world,'spent','Spent','#43b59a',NOW);
 assert.deepEqual(profile.inventory,['saber-3']);
 assert.equal(profile.starterWeaponId,'white-cat');
});
