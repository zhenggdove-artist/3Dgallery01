import test from 'node:test';
import assert from 'node:assert/strict';
import {itemById,SHOP_ITEMS,shopPurchaseVariant} from '../src/shared/catalog.js';
import {tuningVariant,equipmentTuning,linkedEquipmentTuning,bloomHealRate,applySkillAreaScale,migrateSkillQuality} from '../src/shared/equipment-tuning.js';
import {teaSloshStep} from '../src/engine/outfit-model.js';
test('all five quality defaults, flower healing and linked changes preserve purple baseline',()=>{
 const w={equipmentTuning:{}};
 for(let tier=1;tier<=5;tier++){
 const item=tuningVariant('bloom-'+tier,tier),factor=[.6,.7,.8,.9,1][tier-1],t=equipmentTuning(w,item);
 assert.equal(t.radiusScale,factor);assert.equal(t.effectPower,factor);assert.equal(t.effectDuration,factor);assert.ok(Math.abs(bloomHealRate(w,item)-factor)<1e-8);
 const stats={ultimate:true,range:20,radius:10};applySkillAreaScale(stats,item,t);assert.equal(stats.radius,10*factor);
 }
 const change=linkedEquipmentTuning(w,tuningVariant('bloom-5',5),{healPerSecond:2,effectDuration:2});w.equipmentTuning=change.overrides;
 assert.ok(Math.abs(bloomHealRate(w,tuningVariant('bloom-1',1))-1.2)<1e-8);
 assert.equal(equipmentTuning(w,tuningVariant('bloom-3',3)).effectDuration,1.6);
});
test('migration respects current highest override and leaves unrelated stats intact',()=>{
 const w={equipmentTuning:{'bloom-5:5':{radiusScale:2},'bloom-1:1':{damage:99,radiusScale:2}}};migrateSkillQuality(w);
 assert.equal(w.equipmentTuning['bloom-1:1'].radiusScale,1.2);assert.equal(w.equipmentTuning['bloom-1:1'].damage,99);
 assert.equal(w.equipmentTuning['bloom-5:5'].radiusScale,2);
});
test('mutton lightbox is server purchasable and has an exposed head',()=>{
 const item=itemById('outfit-mutton-sign-disguise');assert.ok(SHOP_ITEMS.includes(item));assert.ok(shopPurchaseVariant(item.id).price>0);assert.equal(item.disguiseHeight,2.5);assert.equal(item.exposedHead,true);
});
test('tea acceleration causes bounded sloshing which settles at rest',()=>{
 const tilt={x:0,y:0},velocity={x:0,y:0};for(let i=0;i<60;i++)teaSloshStep(tilt,velocity,12,0,1/60);
 assert.ok(tilt.x<-.25&&tilt.x>=-.52);for(let i=0;i<180;i++)teaSloshStep(tilt,velocity,0,0,1/60);assert.ok(Math.abs(tilt.x)<.001);
});
