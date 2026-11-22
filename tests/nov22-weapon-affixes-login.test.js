import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {itemById} from '../src/shared/catalog.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {rollWeaponAffixes,mergeWeaponAffixes,weaponAffixTotals} from '../src/shared/weapon-affixes.js';
import {appendInventoryInstance,ensureWeaponAffixes,selectEquipmentInstance,fusionRecordAt} from '../src/shared/fusion-instances.js';
import {fuseTemple} from '../src/shared/temple-fusion.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';
import {playerStats} from '../src/shared/player-stats.js';
import {weaponPresentation} from '../src/shared/weapon-presentation.js';

const NOW=7200000,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,JSON.stringify({a,b}));
const prepare=()=>{const world=createInitialWorld(NOW);const p=ensureProfile(world,'affix-gm','AffixGM','#abcdef',NOW,true);return {world,p};};

test('all weapons roll stable single-instance random properties from 3% to 15%',()=>{
 const item=itemById('accordion');
 const weak=rollWeaponAffixes(item,()=>0),strong=rollWeaponAffixes(item,()=>.9999);
 assert.deepEqual(weak,[{id:'brutal',percent:3}]);
 assert.deepEqual(strong,[{id:'aerial',percent:15}]);
 assert.deepEqual(rollWeaponAffixes(itemById('hat-dinosaur'),()=>.2),[]);
 const {p}=prepare();
 for(const [i,id]of p.inventory.entries()){
  if(itemById(id)?.slot!=='weapon')continue;
  const record=fusionRecordAt(p,i);
  assert.equal(record.weaponAffixes.length,1,'every owned weapon '+id+' has an independent roll');
  assert.ok(record.weaponAffixes[0].percent>=3&&record.weaponAffixes[0].percent<=15);
 }
 const first=p.inventory.indexOf('accordion'),firstUid=p.inventoryInstances[first].uid;
 const firstRoll=fusionRecordAt(p,first).weaponAffixes;
 appendInventoryInstance(p,'accordion');
 const second=p.inventory.length-1,secondUid=p.inventoryInstances[second].uid;
 assert.notEqual(firstUid,secondUid);
 assert.deepEqual(fusionRecordAt(p,first).weaponAffixes,firstRoll,'existing enchant must not reroll');
 ensureWeaponAffixes(p,()=>0);
 assert.deepEqual(fusionRecordAt(p,first).weaponAffixes,firstRoll,'join must not reroll');
 assert.equal(fusionRecordAt(p,second).weaponAffixes.length,1);
});

test('weapons gain effective crit, damage reduction, HP and haste from owned enchant',()=>{
 const {world,p}=prepare(),index=p.inventory.indexOf('accordion');
 selectEquipmentInstance(p,'weapon',index);
 const record=fusionRecordAt(p,index);
 const weapon=itemById('accordion'),baseCrit=weapon.critChance;
 record.weaponAffixes=[{id:'brutal',percent:10},{id:'stalwart',percent:9},
  {id:'vital',percent:7},{id:'swift',percent:15}];
 const current=equippedItem(p,weapon);
 near(current.critChance,baseCrit+.1);
 near(current.cooldown,Math.round(weapon.cooldown*.85));
 const augmented=playerStats(world,p),totals=weaponAffixTotals(record);
 near(totals.crit,10);
 near(augmented.maxHp,107);
 assert.ok(augmented.defense<1);
 assert.match(weaponPresentation(weapon,record).title,/殘暴堅韌豐沛迅捷的紅色手風琴/);
});

test('fusion preserves each prefix in acquisition order and inherits 30 percent of source value',()=>{
 const {world,p}=prepare(),target=itemById('accordion'),source=itemById('fan');
 const tIndex=p.inventory.indexOf(target.id),sIndex=p.inventory.indexOf(source.id);
 selectEquipmentInstance(p,'weapon',tIndex);
 const t=fusionRecordAt(p,tIndex),s=fusionRecordAt(p,sIndex);
 t.weaponAffixes=[{id:'brutal',percent:10}];
 s.weaponAffixes=[{id:'stalwart',percent:15}];
 const result=fuseTemple(world,p,{sourceId:source.id,targetId:target.id,
  sourceIndex:sIndex,targetIndex:tIndex,requestId:'affix-fusion-1'},()=>0);
 assert.equal(result.fusion.success,true);
 const record=p.fusionByInstance[p.equippedInstanceIds.weapon];
 assert.deepEqual(record.weaponAffixes,[{id:'brutal',percent:10},{id:'stalwart',percent:4.5}]);
 assert.equal(weaponPresentation(target,record).title,'殘暴堅韌的紅色手風琴（+1）');
 assert.ok(playerStats(world,p).defense<1);
 const same=mergeWeaponAffixes(record,{weaponAffixes:[{id:'brutal',percent:11}]});
 assert.equal(same.length,3,'repeated prefixes are not collapsed');
 assert.equal(same.at(-1).percent,3.3);
});

test('login completion no longer references the deleted previousHealHp variable',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/joined=true;lastHealVisualAt=0;ui\.enter\(data\)/);
 assert.doesNotMatch(main,/previousHealHp/);
 assert.match(main,/catch\(error\)\{ui\.joinError\(error\.message\);\}/);
});