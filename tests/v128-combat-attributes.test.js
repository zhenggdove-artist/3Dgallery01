import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,worldProfileView} from '../src/shared/temple-rules.js';
import {appendInventoryInstance} from '../src/shared/fusion-instances.js';
import {playerStats,levelAttributeScale} from '../src/shared/player-stats.js';
const T=800000,actor=(key,position)=>({key,name:key,color:'#abcdef',role:'fighter',position,admin:false});
function scenario(level=1,gear=false,defense=false,fused=false){
 const w=createInitialWorld(T),a=actor('caster',[75,0,0]),b=actor('victim',[75,0,2.2]);
 const p=ensureProfile(w,a.key,a.name,a.color,T),v=ensureProfile(w,b.key,b.name,b.color,T);
 const equip=(who,p,id)=>{appendInventoryInstance(p,id,'shop');const result=applyAction(w,who,{action:'equip',itemId:id,inventoryIndex:p.inventory.length-1},{now:T+1,actors:[a,b]});assert.ok(!result.error,result.error);};
 equip(a,p,'clam');p.level=level;
 if(gear){equip(a,p,'hat-dragon');equip(a,p,'outfit-creature-rooster');}
 if(defense)equip(b,v,'hat-knight');
 if(fused){
  appendInventoryInstance(p,'pan-1','shop');
  const fused=applyAction(w,a,{action:'fuse',sourceId:'pan-1',targetId:'clam',requestId:'v128-real-fusion-01'},{now:T+2,actors:[a,b],rng:()=>0});
  assert.equal(fused.fusion?.success,true,JSON.stringify(fused));assert.ok(p.fusion.clam.templeStats.damage>0);
 }
 const hp=v.hp,stats=playerStats(w,p,T+2000),shot=applyAction(w,a,{action:'attack',direction:[0,0,1]},{now:T+2000,rng:()=>.94,actors:[a,b]});
 assert.ok(!shot.error,shot.error);assert.equal(v.hp,hp,'damage still waits for contact');
 const fx=w.persistentAttacks.find(f=>f.owner===a.key);
 tickWorld(w,{now:T+2420,actors:[a,b],activeFighters:0,rng:()=>.94});
 assert.ok(v.hp<hp,'real contact damages victim');
 return {loss:hp-v.hp,stats,pvp:fx.pvpDamage,pve:fx.damage,view:worldProfileView(w,a.key,T+2421)};
}
test('actual contact damage uses level, equipment and defense, not just displayed stats',()=>{
 const base=scenario(),level=scenario(100),gear=scenario(100,true),armored=scenario(100,true,true);
 assert.ok(Math.abs(level.stats.attack/base.stats.attack-levelAttributeScale(100))<1e-9);
 assert.ok(level.loss>base.loss);assert.ok(gear.loss>level.loss);assert.ok(armored.loss<gear.loss);
 assert.ok(gear.pve>level.pve);assert.ok(gear.stats.speed>level.stats.speed);
 assert.equal(gear.view.stats.attack,gear.stats.attack);
});
test('a successful weapon fusion damage field actually increases PvP launch and hit power',()=>{
 const base=scenario(),fused=scenario(1,false,false,true);
 assert.ok(fused.pvp>base.pvp);assert.ok(fused.pve>base.pve);assert.ok(fused.loss>base.loss);
});
