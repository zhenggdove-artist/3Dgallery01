import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {tuningVariant,weaponManaQuote,linkedEquipmentTuning,equipmentTuning} from '../src/shared/equipment-tuning.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';
import {itemById} from '../src/shared/catalog.js';
test('linked native weapon grades preserve current ratios and other families',()=>{
 const world={equipmentTuning:{}},a=tuningVariant('saber-2',2),b=tuningVariant('saber-4',4);
 const first=weaponManaQuote(world,a).initial,second=weaponManaQuote(world,b).initial;
 const change=linkedEquipmentTuning(world,a,{manaCost:first*2});world.equipmentTuning=change.overrides;
 assert.equal(change.variants.length,5);assert.equal(weaponManaQuote(world,a).initial,first*2);assert.equal(weaponManaQuote(world,b).initial,second*2);
 assert.deepEqual(equipmentTuning(world,tuningVariant('tide-2',2)),{radiusScale:.7,effectPower:.7,effectDuration:.7});
 const reset=linkedEquipmentTuning(world,b,null);assert.equal(Object.keys(reset.overrides).length,0);
});
test('GM set ultimate cost actually debits exact quoted MP, ordinary attack stays free',()=>{
 const T=19000000,world=createInitialWorld(T),gm={key:'gm',name:'GM',role:'fighter',admin:true,position:[75,0,0],color:'#ffffff'};
 const p=ensureProfile(world,gm.key,gm.name,gm.color,T,true);p.equipment.weapon='saber-2';
 const act=(body,now)=>applyAction(world,gm,body,{now,actors:[gm],rng:()=>.5});
 assert.ok(!act({action:'gm-equipment-tuning',itemId:'saber-2',qualityTier:2,values:{manaCost:17}},T+1000).error);
 p.mana=100;p.manaAt=T+2000;
 assert.ok(act({action:'attack',direction:[0,0,1],charge:0},T+2000).attackEvent);
 assert.equal(p.mana,100);
 assert.ok(act({action:'attack',phase:'charge'},T+3000).charging);
 const at=T+10000;p.manaAt=at;p.mana=100;
 const r=act({action:'attack',direction:[0,0,1],charge:1},at);
 assert.ok(r.attackEvent,r.error);assert.equal(r.attackEvent.manaCost,17);assert.equal(p.mana,83);
 assert.equal(weaponManaQuote(world,equippedItem(p,itemById('saber-2')),p.fusion?.['saber-2']).initial,17);
});
test('chat focus hides hotbar without disabling chat and restores on blur',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8'),css=readFileSync(new URL('../fidelity-ui.css',import.meta.url),'utf8');
 assert.match(ui,/chatInput.addEventListener\('focus',\(\)=>chatFocus\(true\)\)/);
 assert.match(ui,/chatInput.addEventListener\('blur',\(\)=>chatFocus\(false\)\)/);
 assert.match(css,/body\.chat-typing #comfort-hotbar\{visibility:hidden!important;pointer-events:none!important\}/);
});
