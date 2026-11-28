import test from 'node:test';
import assert from 'node:assert/strict';
import {sustainedSpellBalance,channelInterval,weaponQuality} from '../src/shared/weapon-abilities.js';
import {weaponManaQuote} from '../src/shared/equipment-tuning.js';
import {itemById} from '../src/shared/catalog.js';
import {refreshMana} from '../src/shared/player-stats.js';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';

test('native sustained elements have ordered base hits and mana budgets at all five grades',()=>{
 for(let tier=1;tier<=5;tier++){
  const items=['ember','storm','prism','nova','tide'].map(id=>itemById(id+'-'+tier));
  const balance=items.map(sustainedSpellBalance);
  for(const [i,b] of balance.entries())assert.ok(Math.abs(b.hit*weaponQuality(items[i]).damage*1000/[1000,1500,250,500,200][i]-[30,28,26,24,22][i]*weaponQuality(items[i]).damage/1.26)<.00001);
  assert.deepEqual(balance.map(b=>b.mpPerSecond),[20,13,10,13,7]);
  for(const [i,item] of items.entries()){
   const q=weaponManaQuote(null,item);
   assert.equal(q.initial,20);
   assert.equal(q.pulse,+(balance[i].mpPerSecond*channelInterval(item)/1000).toFixed(2));
  }
 }
 assert.equal(sustainedSpellBalance(itemById('frost-1')),null);
 assert.equal(sustainedSpellBalance(itemById('black-cat')),null);
});
test('channel mana does not regenerate while paid; normal recovery resumes on release',()=>{
 const p={level:1,hp:100,mana:40,manaAt:1000,channelWeapon:'ember-1',manaChannelPaid:true,equipment:{weapon:'ember-1'}};
 refreshMana(p,2000,null);assert.equal(p.mana,40);
 p.channelWeapon=null;p.manaChannelPaid=false;refreshMana(p,3000,null);assert.equal(p.mana,43);
});
test('last paid fire pulse can deal damage before exhaustion, with no damage after stop',()=>{
 const start=200000,world=createInitialWorld(start);
 const actor={key:'caster',name:'Caster',color:'#ffffff',role:'fighter',position:[75,0,0]};
 const profile=ensureProfile(world,actor.key,actor.name,actor.color,start);
 const item=itemById('ember-1');profile.inventory.push(item.id);profile.equipment.weapon=item.id;
 world.monster={id:'boss',active:true,variant:'uncle',model:'uncle',position:[75,0,4],hp:12000,maxHp:12000,skills:[],nextAttackAt:start+200000};
 const act=(now,extra)=>applyAction(world,actor,{action:'attack',direction:[0,0,1],...extra},{now,actors:[actor],rng:()=>.5});
 const at=start+6000;
 assert.equal(act(start+1000,{phase:'charge'}).charging,true);
 profile.mana=20;profile.manaAt=at;
 assert.equal(act(at,{phase:'channel-start'}).channeling,true);
 assert.ok(act(at+10,{phase:'channel'}).attackEvent);
 assert.ok(profile.mana<1);
 tickWorld(world,{now:at+110,activeFighters:1,actors:[actor],rng:()=>.5});
 assert.ok(world.monster.hp<12000);
 tickWorld(world,{now:at+10+channelInterval(item),activeFighters:1,actors:[actor],rng:()=>.5});
 assert.equal(profile.channelWeapon,null);
 assert.equal(world.persistentAttacks.some(fx=>fx.owner===actor.key&&fx.channel),false);
});
