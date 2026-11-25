import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction,worldView,migrateWorld} from '../src/shared/temple-rules.js';
import {tuningVariant,tuningFields,tuningDamageRatio,tunedEquipment} from '../src/shared/equipment-tuning.js';
import {itemById} from '../src/shared/catalog.js';
import {playerStats} from '../src/shared/player-stats.js';
import {shotgunDistanceScale} from '../src/shared/calico-pellets.js';
const now=Date.now(),gm={key:'gm',name:'GM',color:'#abcdef',admin:true,role:'fighter',position:[75,0,0]},user={key:'u',name:'User',color:'#abcdef',admin:false,role:'fighter',position:[75,0,10]};
test('GM-only tuning persists per grade, validates fields and resets independently',()=>{
 const w=createInitialWorld(now);ensureProfile(w,gm.key,gm.name,gm.color,now,true);ensureProfile(w,user.key,user.name,user.color,now,false);
 const act=(actor,body)=>applyAction(w,actor,{action:'gm-equipment-tuning',...body},{now:now+1000,actors:[gm,user]});
 const base=tuningVariant('calico-cat',3),d=tuningFields(base).find(f=>f.key==='damage').value;
 const payload={itemId:base.id,qualityTier:3,values:{damage:d*2,cooldown:500,effectPower:2}};
 assert.ok(act(user,payload).error);assert.ok(!act(gm,payload).error);
 assert.equal(tuningDamageRatio(w,base,false),2);assert.equal(tunedEquipment(w,base).cooldown,500);
 assert.equal(tuningDamageRatio(w,tuningVariant('calico-cat',2),false),1);
 assert.equal(tuningDamageRatio(w,base,true),1);
 assert.ok(act(gm,{...payload,values:{damage:-1}}).error);
 const restored=migrateWorld(JSON.parse(JSON.stringify(w)),now+2000);
 assert.equal(tuningDamageRatio(restored,base,false),2);
 assert.equal(worldView(restored,user.key,now+2000).equipmentTuning['calico-cat:3'].damage,d*2);
 assert.ok(!act(gm,{...payload,values:null}).error);assert.equal(tuningDamageRatio(w,base,false),1);
});
test('tuned ordinary attack is actually launched at changed damage on the server',()=>{
 const w=createInitialWorld(now);const p=ensureProfile(w,gm.key,gm.name,gm.color,now,true);
 const id='saber-2',item=tuningVariant(id,2);p.equipment.weapon=id;p.lastAttackAt=0;
 const fire=at=>applyAction(w,gm,{action:'attack',direction:[0,0,1],charge:0},{now:at,actors:[gm],rng:()=>.5});
 const first=fire(now+1000);assert.ok(first.attackEvent,first.error);
 const before=first.attackEvent.damage;
 const d=tuningFields(item).find(f=>f.key==='damage').value;
 const result=applyAction(w,gm,{action:'gm-equipment-tuning',itemId:id,qualityTier:2,values:{damage:d*2}},{now:now+3000,actors:[gm]});assert.ok(!result.error,result.error);
 const second=fire(now+5000);assert.ok(second.attackEvent,second.error);
 assert.ok(Math.abs(second.attackEvent.damage-before*2)<.02,[before,second.attackEvent.damage].join(' / '));
});
test('shotgun attenuation has constant exponential ratio and no negative damage',()=>{
 const a=shotgunDistanceScale(0,20),b=shotgunDistanceScale(10,20),c=shotgunDistanceScale(20,20);
 assert.equal(a,.49);assert.ok(Math.abs(c-.14)<1e-10);assert.ok(Math.abs(b/a-c/b)<1e-10);
});
