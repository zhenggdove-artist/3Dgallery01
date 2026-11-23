import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {COMFORT_ITEMS,itemById} from '../src/shared/catalog.js';
import {groupInventoryStacks} from '../src/shared/inventory-stacks.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('English comfort metadata',()=>{
 assert.deepEqual(COMFORT_ITEMS.map(v=>v.healFraction),[.3,.5,1]);
 assert.ok(COMFORT_ITEMS.every(v=>v.name.startsWith('Comfort Cash')&&v.category==='Comfort for the Soul'&&v.description==='Give me more!'));
 const text=[read('src/ui.js'),read('src/bag-view.js'),read('index.html'),read('src/shared/catalog.js')].join('\n');
 assert.doesNotMatch(text,/撫慰心靈的物品|撫慰美金|再給我來多一點吧/);
});
test('different affix values and fusion stats stay in separate stacks',()=>{
 const w=itemById('tide-1'),cash=itemById('comfort-dollar-20');
 const rows=[w,w,w,w,w,cash,cash].map((item,index)=>({item,index}));
 const props=[{weaponAffixes:[{id:'brutal',percent:10}]},
 {weaponAffixes:[{id:'brutal',percent:10}],attempts:7},
 {weaponAffixes:[{id:'brutal',percent:15}]},
 {weaponAffixes:[{id:'brutal',percent:10}],layer:1,templeStats:{damage:9}},
 {weaponAffixes:[{id:'brutal',percent:10}],layer:1,templeStats:{damage:10}},{},{}];
 const groups=groupInventoryStacks(rows,(_,index)=>props[index]);
 assert.deepEqual(groups.map(g=>g.count),[2,1,1,1,2]);
 assert.deepEqual(groups[0].indices,[0,1]);
});
test('slot picker is explicit and badges render upper-left',()=>{
 const bag=read('src/bag-view.js'),css=read('fidelity-ui.css');
 assert.match(bag,/if\(comfort\)showConsumableSlotPicker\(ui,i,profile\)/);
 assert.match(bag,/dialog\.showModal\(\)/);
 assert.match(bag,/data-assign-comfort-slot/);
 assert.match(bag,/\[0,1,2\]\.map\(slot=>/);
 assert.match(bag,/action:'assign-consumable',slot,itemId:item\.id/);
 assert.doesNotMatch(bag,/const free=assigned\.findIndex/);
 assert.match(css,/\.bag-cell>\.bag-stack-count\{[\s\S]*?top:1px;left:1px/);
});
test('purchase success is authoritative',()=>{
 assert.match(read('src/shared/temple-rules.js'),/notice:`PURCHASE SUCCESSFUL ·/);
 assert.match(read('src/main.js'),/if\(result\.purchased\)/);
});
