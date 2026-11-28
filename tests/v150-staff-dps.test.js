import test from 'node:test';
import assert from 'node:assert/strict';
import {itemById} from '../src/shared/catalog.js';
import {staffBaseDamage,staffBaseDps,weaponQuality,channelInterval} from '../src/shared/weapon-abilities.js';
import {tuningFields,tuningVariant,equipmentTuning,weaponManaQuote,bloomHealRate,migrateStaffBalance} from '../src/shared/equipment-tuning.js';
import {createInitialWorld,ensureProfile,applyAction,tickBloomChannelHeal,advanceCombatContacts} from '../src/shared/temple-rules.js';
import {playerStats} from '../src/shared/player-stats.js';
import {pvpShotDamage} from '../src/shared/combat-balance.js';
const families=['ember','storm','prism','nova','tide','bloom'],expected=[30,28,26,24,22,20],interval=[1000,1500,250,500,200,1650];
const near=(a,b,t=.005)=>assert.ok(Math.abs(a-b)<t,a+' != '+b);
test('blue native staffs produce ordered direct DPS across actual contact and normal cooldowns',()=>{
 for(let i=0;i<families.length;i++){
  const item=itemById(families[i]+'-3'),q=weaponQuality(item);
  near(staffBaseDps(item),expected[i]);
  near(staffBaseDamage(item,false)*1000/item.cooldown,expected[i]);
  near(staffBaseDamage(item,true)*1000/interval[i],expected[i]);
  near(pvpShotDamage(item,{ultimate:false},q)*1000/item.cooldown,expected[i]);
  near(pvpShotDamage(item,{ultimate:true},q)*1000/interval[i],expected[i]);
  for(let grade=2;grade<=5;grade++)assert.ok(staffBaseDps(itemById(families[i]+'-'+grade))>staffBaseDps(itemById(families[i]+'-'+(grade-1))));
 }
});
test('authoritative combat, linked GM damage and mana tuning, healing at five grades',()=>{
 const T=90000000,world=createInitialWorld(T),gm={key:'gm',name:'GM',role:'fighter',admin:true,color:'#ffffff',position:[75,0,0]};
 const p=ensureProfile(world,gm.key,gm.name,gm.color,T,true);
 const action=(now,body)=>applyAction(world,gm,body,{now,actors:[gm],rng:()=>.5});
 const item=tuningVariant('ember-3',3);
 p.equipment.weapon=item.id;p.inventory.push(item.id);
 const fire=now=>action(now,{action:'attack',direction:[0,0,1],charge:0}).attackEvent;
 const first=fire(T+1000);assert.ok(first);
 near(first.damage,staffBaseDamage(item)*playerStats(world,p,T+1000).attack);
 const fields=tuningFields(item);
 assert.ok(!action(T+2000,{action:'gm-equipment-tuning',itemId:item.id,qualityTier:3,values:{damage:fields.find(x=>x.key==='damage').value*2,ultimateDamage:60,channelManaPerSecond:11}}).error);
 near(fire(T+4000).damage,first.damage*2);
 near(equipmentTuning(world,tuningVariant('ember-5',5)).ultimateDamage,staffBaseDps(itemById('ember-5'))*2);
 near(weaponManaQuote(world,item).pulse,11*channelInterval(item)/1000);
 const charge=T+6000;assert.ok(action(charge,{action:'attack',phase:'charge'}).charging);
 const at=charge+item.chargeMs+100;
 const pulse=action(at,{action:'attack',phase:'channel',startChannelV089:true,direction:[0,0,1],charge:1});
 assert.ok(pulse.attackEvent,pulse.error);near(pulse.attackEvent.damage,60*playerStats(world,p,at).attack);
 assert.equal(action(at+1,{action:'attack',phase:'channel-stop'}).channeling,false);
 for(let grade=1;grade<=5;grade++){
  const id='bloom-'+grade;p.equipment.weapon=id;p.channelWeapon=id;p.channelStartedAt=at;p.lastChannelPulseAt=at+1000;p.lastBloomHealAt=at;p.hp=50;p.deadUntil=0;
  near(tickBloomChannelHeal(p,at+1000,world),grade);near(p.hp,50+grade);
 }
 p.equipment.weapon='bloom-3';p.channelWeapon='bloom-3';
 assert.ok(!action(at+2000,{action:'gm-equipment-tuning',itemId:'bloom-3',qualityTier:3,values:{healPerSecond:6}}).error);
 near(bloomHealRate(world,itemById('bloom-5')),10);
});
test('one-time migration resets only staff damage/mana/heal, preserves later edits',()=>{
 const w={equipmentTuning:{'bloom-3:3':{damage:99,ultimateDamage:99,manaCost:88,healPerSecond:1,radiusScale:.8},'saber-3:3':{damage:99}}};
 migrateStaffBalance(w);assert.deepEqual(w.equipmentTuning,{'bloom-3:3':{radiusScale:.8},'saber-3:3':{damage:99}});
 w.equipmentTuning['bloom-3:3'].healPerSecond=9;migrateStaffBalance(w);assert.equal(w.equipmentTuning['bloom-3:3'].healPerSecond,9);
});

test('ordinary staff projectiles debit server monster HP and GM zero disables the next attack',()=>{
 const T=100000000,world=createInitialWorld(T),actor={key:'gm',name:'GM',role:'fighter',admin:true,color:'#ffffff',position:[75,0,0]};
 const p=ensureProfile(world,actor.key,actor.name,actor.color,T,true);
 world.monster={id:'target',active:true,position:[75,0,3],hp:10000,maxHp:10000,bodyRadius:1,bodyHeight:2.5,skills:[],nextAttackAt:T+100000};
 p.equipment.weapon='ember-3';p.inventory.push('ember-3');const item=itemById('ember-3');
 const act=(now,body)=>applyAction(world,actor,body,{now,actors:[actor],rng:()=>.99});
 const shot=act(T+1000,{action:'attack',direction:[0,0,1],charge:0});assert.ok(shot.attackEvent,shot.error);
 advanceCombatContacts(world,[actor],T+1240,()=>.99);
 assert.ok(world.monster.hp<10000);
 const previous=world.monster.hp;
 assert.ok(!act(T+2000,{action:'gm-equipment-tuning',itemId:item.id,qualityTier:3,values:{damage:0}}).error);
 const zero=act(T+3000,{action:'attack',direction:[0,0,1],charge:0});assert.ok(zero.attackEvent);assert.equal(zero.attackEvent.damage,0);
 advanceCombatContacts(world,[actor],T+3240,()=>.99);assert.equal(world.monster.hp,previous);
});
