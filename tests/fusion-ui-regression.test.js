import test from 'node:test';
import assert from 'node:assert/strict';
import {itemById} from '../src/shared/catalog.js';
import {weaponPresentation} from '../src/shared/weapon-presentation.js';
import {explainWeapon} from '../src/shared/weapon-info.js';
test('successful fusion level and actual stats show in the weapon title and traits',()=>{
 const weapon=itemById('saber-1');
 const out=weaponPresentation(weapon,{layer:2,bonus:5,original:{fusionCount:2,affixId:'brutal',stats:{damage:weapon.damage/10+1,cooldown:weapon.cooldown*.8}}});
 assert.match(out.title,/\(\+2\)$/);
 assert.ok(out.traits.some(t=>t.name.includes('Brutal')));
 assert.ok(out.bonuses.some(s=>s.includes('Fusion damage')));
 assert.ok(out.bonuses.some(s=>s.includes('Attack Cooldown')));
});
test('weapon details contain player-facing explanations rather than server implementation',()=>{
 const text=explainWeapon(itemById('saber-1'));
 for(const word of ['伺服器','藍色魔法陣預覽','server-authoritative','client-side'])assert.ok(!text.includes(word),word);
});
