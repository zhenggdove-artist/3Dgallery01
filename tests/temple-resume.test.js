import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceIslandEnemy,ISLAND_ENEMIES} from '../src/shared/island-combat.js';
import {createInitialWorld,setArtworkLayout} from '../src/shared/temple-rules.js';
import {spawnMonsterPack} from '../src/shared/monster-pack.js';

test('no auntie or cute animal models remain in monster pool',()=>{
 for(const kind of ['auntie','cow','deer','fox'])assert.ok(!ISLAND_ENEMIES.includes(kind),kind);
 assert.ok(ISLAND_ENEMIES.length>=5);
 const world=createInitialWorld(1000);
 spawnMonsterPack(world,1000,()=>.65);
 assert.ok(world.monsters.every(m=>ISLAND_ENEMIES.includes(m.model)));
});
test('a monster patrols without players instead of idling on the arena boundary',()=>{
 const mob={position:[78,0,0],skills:[],nextAttackAt:0},start=[...mob.position];
 let calls=0;
 const move=(goal,step)=>{
  assert.ok(Math.hypot(goal[0],goal[2])>=14-1e-5);
  assert.ok(Math.hypot(goal[0],goal[2])<=83+1e-5);
  const d=Math.hypot(goal[0]-mob.position[0],goal[2]-mob.position[2]);
  const f=Math.min(1,step/Math.max(d,.00001));
  mob.position[0]+=(goal[0]-mob.position[0])*f;mob.position[2]+=(goal[2]-mob.position[2])*f;
  calls++;return true;
 };
 for(let time=1000;time<12000;time+=500)advanceIslandEnemy(mob,[],time,{move,hit:()=>{},rng:()=>.35});
 assert.ok(calls>=15);
 assert.ok(Math.hypot(mob.position[0]-start[0],mob.position[2]-start[2])>5);
});
test('GM can persist radius 2–24 on original artwork only',()=>{
 const world=createInitialWorld(1000),gm={admin:true};
 const layout={position:[-12,2,-12],rotation:[0,0,0],scale:[1,1,1],discRadius:12};
 const success=setArtworkLayout(world,gm,{platformId:'platform-01',expectedRevision:0,layout},2000);
 assert.equal(success.artworkLayout.discRadius,12);
 const rejected=setArtworkLayout(world,gm,{platformId:'platform-01',expectedRevision:1,layout:{...layout,discRadius:25}},2100);
 assert.match(rejected.error,/radius/);
});
