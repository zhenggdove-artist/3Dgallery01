import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction,tickWorld} from '../src/shared/temple-rules.js';
import {ARTWORK_DISCS,discGroundHeight} from '../src/shared/artwork-discs.js';
import {insideArtSanctuary,MONSTER_SPAWNS} from '../src/shared/arena.js';
import {advanceIslandEnemy} from '../src/shared/island-combat.js';
test('discs support feet only from above, never catch from underneath or outside',()=>{
 const d=ARTWORK_DISCS.at(-1),[x,,z]=d.position;
 assert.equal(discGroundHeight(x,z,d.top),d.top);
 assert.ok(discGroundHeight(x,z,d.top-1)<d.top);
 assert.equal(discGroundHeight(75,75,d.top),0);
});
test('hearts clamp health; full-health players cannot consume them; empty gear slots auto-equip',()=>{
 const now=10000,w=createInitialWorld(now),a={key:'p',name:'Test',role:'fighter',position:[0,0,0]},p=ensureProfile(w,'p','Test',null,now);
 const drop=(id,kind,itemId)=>w.groundDrops.push({id,kind,itemId,amount:25,position:[0,0,0],expiresAt:now+50000});
 drop('h','heart');assert.match(applyAction(w,a,{action:'pickup-drop',dropId:'h'},{now}).error,/full/);assert.equal(w.groundDrops.length,1);
 p.hp=90;assert.ok(!applyAction(w,a,{action:'pickup-drop',dropId:'h'},{now}).error);assert.equal(p.hp,p.maxHp);
 p.equipment.weapon=null;drop('g','equipment','frost-1');assert.ok(!applyAction(w,a,{action:'pickup-drop',dropId:'g'},{now}).error);assert.equal(p.equipment.weapon,'frost-1');
 drop('g2','equipment','tide-1');applyAction(w,a,{action:'pickup-drop',dropId:'g2'},{now});assert.equal(p.equipment.weapon,'frost-1');
});
test('monsters spawn outside art perimeter, relocate legacy enemies, and cancel casts for viewers',()=>{
 assert.ok(MONSTER_SPAWNS.every(p=>!insideArtSanctuary(p)));const now=10000,w=createInitialWorld(now),a={key:'p',role:'fighter',position:[35,4,0]},p=ensureProfile(w,'p','Test',null,now);
 w.monster={id:'m',active:true,hp:100,position:[35,0,0],generation:1,skills:[]};tickWorld(w,{now,actors:[a],activeFighters:1});assert.ok(!insideArtSanctuary(w.monster.position));assert.equal(p.hp,p.maxHp);assert.equal(w.monster.skills.length,0);
});
test('requested attack cycle uses swipe, roar and charge and never kicks',()=>{
 const m={position:[60,0,0],attackStyles:true},target={key:'p',position:[61,0,0]},moves=[];
 for(const [i,motion]of ['swipe','roar','charge'].entries()){m.skills=[];m.nextAttackAt=0;advanceIslandEnemy(m,[target],10000+i*6000,{move:(p,d)=>moves.push(d),hit:()=>{}});assert.equal(m.skills[0].motion,motion);}
 advanceIslandEnemy(m,[],30000,{move:()=>assert.fail(),hit:()=>assert.fail()});assert.deepEqual(m.skills,[]);
});
