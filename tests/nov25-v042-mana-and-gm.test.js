import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction,worldProfileView} from '../src/shared/temple-rules.js';
import {manaCapacity,manaRegen,refreshMana,ultimateManaCost} from '../src/shared/player-stats.js';
import {itemById,attackStats,groundDropRoll} from '../src/shared/catalog.js';
const T=100000,gm={key:'gm',name:'GM',color:'#ffffff',admin:true,role:'fighter',position:[75,0,0]},player={key:'p',name:'Player',color:'#ffffff',admin:false,role:'fighter',position:[80,0,0]};
test('only GM can edit level or grant a canvas',()=>{
 const w=createInitialWorld(T);
 ensureProfile(w,gm.key,gm.name,gm.color,T,true);
 const p=ensureProfile(w,player.key,player.name,player.color,T);
 const action=(actor,body)=>applyAction(w,actor,body,{now:T+1000,actors:[gm,player]});
 assert.ok(action(player,{action:'gm-player-level',targetKey:player.key,level:20}).error);
 assert.ok(action(gm,{action:'gm-player-level',targetKey:player.key,level:0}).error);
 assert.ok(!action(gm,{action:'gm-player-level',targetKey:player.key,level:20}).error);
 assert.equal(p.level,20);assert.equal(p.maxMana,176);
 assert.ok(action(player,{action:'gm-wing-canvas',targetKey:player.key}).error);
 assert.ok(!action(gm,{action:'gm-wing-canvas',targetKey:player.key}).error);
 assert.equal(worldProfileView(w,player.key,T).wingDesignCredits,1);
 assert.equal(p.lastWingCanvasGrant.source,'gm');
});
test('mana regenerates by level, water adds 50%, normal guns are free',()=>{
 const p={level:1,hp:100,equipment:{weapon:'saber-2'},mana:0,manaAt:T};
 assert.equal(manaCapacity(1),100);refreshMana(p,T+1000);assert.equal(p.mana,3);
 p.equipment.weapon='tide-1';assert.equal(manaRegen(p),4.5);
 p.level=5;assert.equal(manaRegen(p),6);
 for(const id of ['white-cat','calico-cat','black-cat','tide-1']){
  const w=itemById(id);assert.equal(ultimateManaCost(w,attackStats(w,0),{tier:1}),0);
 }
 const w=itemById('tide-1');assert.ok(ultimateManaCost(w,attackStats(w,1),{tier:1})>=30);
 assert.ok(ultimateManaCost(w,{ultimate:true,damage:80,range:60,radius:20},{tier:5})>50);
});
test('restorative loot includes all three cash colours',()=>{
 for(const r of [.1,.6,.99]){let i=0;const roll=groundDropRoll(()=>i++===0?.95:r);assert.equal(roll.kind,'consumable');assert.ok(itemById(roll.itemId).slot==='consumable');}
});

import {shotgunDistanceScale} from '../src/shared/calico-pellets.js';
test('shotgun muzzle midpoint and final damage fractions',()=>{assert.equal(shotgunDistanceScale(0,20),.49);assert.ok(Math.abs(shotgunDistanceScale(10,20)-Math.sqrt(.49*.14))<1e-9);assert.ok(Math.abs(shotgunDistanceScale(20,20)-.14)<1e-9);});
