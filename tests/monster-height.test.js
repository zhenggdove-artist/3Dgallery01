import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,tickWorld,applyAction,worldView} from '../src/shared/temple-rules.js';
import {advanceIslandEnemy,ISLAND_ENEMIES} from '../src/shared/island-combat.js';
test('monster cannot damage a player twenty metres above it',()=>{
 const world=createInitialWorld(1000),actor={key:'height-test',name:'Height',role:'fighter',position:[20,20,20]},p=ensureProfile(world,actor.key,actor.name,null,1000);
 world.monster={active:true,id:'ground-enemy',variant:'warden',position:[20,0,20],hp:100,maxHp:100,nextAttackAt:0};
 for(let i=0;i<8;i++)tickWorld(world,{now:5000+i*500,activeFighters:1,actors:[actor],rng:()=>.5});
 assert.equal(p.hp,100);
});
test('directional hits emit original critical damage events; direct-hit bypass is rejected',()=>{
 const w=createInitialWorld(1000),actor={key:'fighter',name:'Tester',role:'fighter',position:[20,0,20]},p=ensureProfile(w,actor.key,actor.name,null,1000);
 w.monster={id:'enemy',active:true,position:[20,0,22],hp:1000,maxHp:1000};
 const result=applyAction(w,actor,{action:'attack',direction:[0,0,1]},{now:5000,rng:()=>0});
 assert.ok(result.monsterHit?.damage>0);const event=worldView(w,p.key,5000).damageEvents[0];assert.equal(event.kind,'critical');assert.equal(event.amount,result.monsterHit.damage);assert.equal(event.target,'enemy');
 const hp=w.monster.hp;assert.ok(applyAction(w,actor,{action:'monster-hit'},{now:8000}).error);assert.equal(w.monster.hp,hp);
});
test('Nangan cast warns, expands on ground, hits once and can be jumped',()=>{
 const monster={position:[0,0,0],skills:[],nextAttackAt:0},targets=[{key:'ground',position:[1.1,0,0]},{key:'air',position:[1.1,2,0]}],hits=[];
 const context={move(){},hit(t){hits.push(t.key);}};
 advanceIslandEnemy(monster,targets,1000,context);
 assert.equal(monster.skills[0].phase,'warning');assert.deepEqual(hits,[]);
 advanceIslandEnemy(monster,targets,2199,context);assert.deepEqual(hits,[]);
 advanceIslandEnemy(monster,targets,2200,context);assert.deepEqual(hits,[]);
 advanceIslandEnemy(monster,targets,2800,context);assert.deepEqual(hits,['ground']);
 advanceIslandEnemy(monster,targets,2850,context);assert.deepEqual(hits,['ground']);
 assert.ok(!ISLAND_ENEMIES.includes('foreman'));
});
