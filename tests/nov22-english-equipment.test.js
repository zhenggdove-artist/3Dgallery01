import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ITEMS,itemById} from '../src/shared/catalog.js';
import {weaponPresentation} from '../src/shared/weapon-presentation.js';
import {explainEquipment} from '../src/shared/weapon-info.js';
import {WEAPON_AFFIXES,weaponAffixLabel} from '../src/shared/weapon-affixes.js';

test('equipment names, descriptions, affixes and comfort consumables stay English',()=>{
 assert.ok(ITEMS.length>100);
 for(const item of ITEMS){
  if(item.slot==='consumable'){
   assert.equal(item.category,'Comfort for the Soul');
   assert.equal(item.description,'Give me more!');
   assert.doesNotMatch(item.name,/[\u3400-\u9fff]/,'consumable name '+item.id);
   assert.doesNotMatch(explainEquipment(item),/[\u3400-\u9fff]/,'consumable details '+item.id);
   continue;
  }
  const explicitName={'outfit-naughty-snack-disguise':'不乖餅乾袋','outfit-taiwan-beer-disguise':'台灣啤酒'}[item.id];
  if(explicitName)assert.equal(item.name,explicitName);else assert.doesNotMatch(item.name,/[\u3400-\u9fff]/,'name '+item.id);
  assert.doesNotMatch(String(item.description||''),/[\u3400-\u9fff]/,'catalog description '+item.id);
  assert.doesNotMatch(explainEquipment(item),/[\u3400-\u9fff]/,'details '+item.id);
  const visual=weaponPresentation(item);
  if(!explicitName)assert.doesNotMatch(visual.title,/[\u3400-\u9fff]/,'title '+item.id);
  assert.doesNotMatch(visual.traits.map(t=>t.name+' '+t.details).join(' '),/[\u3400-\u9fff]/,'traits '+item.id);
 }
 for(const affix of WEAPON_AFFIXES){
  assert.doesNotMatch(affix.name+affix.label,/[\u3400-\u9fff]/,affix.id);
  assert.match(weaponAffixLabel({id:affix.id,percent:10}),/10%/);
 }
});
test('affix fusion title remains ordered and preserves duplicate prefixes',()=>{
 const record={layer:2,weaponAffixes:[
  {id:'brutal',percent:10},{id:'stalwart',percent:4.5},{id:'brutal',percent:3}
 ]};
 assert.equal(weaponPresentation(itemById('accordion'),record).title,
  'Brutal Stalwart Brutal Red Accordion (+2)');
 const details=explainEquipment(itemById('accordion'),record);
 assert.match(details,/Brutal: Critical Chance \+10%/);
 assert.match(details,/Stalwart: Damage Reduction \+4.5%/);
});
test('BAG weapon labels and comfort consumable category remain English',()=>{
 const bag=readFileSync(new URL('../src/bag-view.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.match(bag,/Comfort for the Soul/);
 assert.doesNotMatch(bag,/撫慰心靈的物品|再給我來多一點吧|撫慰美金/);
 assert.match(bag,/Success Chance:/);
 assert.match(bag,/Close Range/);
 assert.match(ui,/Fixed shop stats\. Random 3–15% affixes are exclusive to ground loot/);
});
