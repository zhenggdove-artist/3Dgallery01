import test from 'node:test';
import assert from 'node:assert/strict';
import {ECONOMY,itemById} from '../src/shared/catalog.js';
import {PLATFORMS} from '../src/shared/arena.js';
import {applyAction,createInitialWorld,ensureProfile,releasePlayerWorldState,tickWorld,validateState,worldView} from '../src/shared/temple-rules.js';

const actor=(key='p1',position=[...PLATFORMS[0].coinPosition],role='fighter')=>({key,name:key,color:'#abcdef',role,position,admin:false});

test('network player state accepts a valid position object and rejects teleports',()=>{
  const first=validateState(null,{position:[0,0,0],rotation:0,animation:'idle'},100,'fighter',[0,0,0]);
  assert.equal(first.error,undefined);assert.deepEqual(first.state.position,[0,0,0]);
  assert.equal(validateState(null,{position:[20,0,0],rotation:0,animation:'idle'},100,'fighter',[0,0,0]).error,'Spawn position rejected');
  const teleport=validateState(first.state,{position:[10,0,0],rotation:0,animation:'run'},100,'fighter');
  assert.equal(teleport.error,'Movement rejected');
});

test('platform coin is meaningful, global, and cannot be claimed twice',()=>{
  const now=1_000_000,world=createInitialWorld(now),player=actor();
  const first=applyAction(world,player,{action:'pickup-coin',platformId:PLATFORMS[0].id},{now});
  assert.equal(first.error,undefined);assert.equal(world.profiles.p1.wallet,80+ECONOMY.platformCoinValue);
  const second=applyAction(world,actor('p2'),{action:'pickup-coin',platformId:PLATFORMS[0].id},{now});
  assert.equal(second.error,'Coin is unavailable');assert.equal(world.profiles.p2.wallet,80);
  assert.equal(worldView(world,'p1',now).coins[PLATFORMS[0].id].available,false);
  assert.equal(worldView(world,'p1',now+ECONOMY.platformCoinRespawnMs).coins[PLATFORMS[0].id].available,true);
});

test('spectators cannot mutate economy',()=>{
  const now=2_000_000,world=createInitialWorld(now),spectator=actor('watcher',PLATFORMS[0].coinPosition,'spectator');
  const result=applyAction(world,spectator,{action:'pickup-coin',platformId:PLATFORMS[0].id},{now});
  assert.match(result.error,/Spectators/);assert.equal(world.profiles.watcher.wallet,80);
});

test('ground equipment is removed atomically before a second pickup',()=>{
  const now=3_000_000,world=createInitialWorld(now);world.groundDrops.push({id:'drop-1',kind:'equipment',itemId:'frost-1',position:[0,.35,0],createdAt:now,expiresAt:now+60_000});
  const first=applyAction(world,actor('p1',[0,.35,0]),{action:'pickup-drop',dropId:'drop-1'},{now});
  const second=applyAction(world,actor('p2',[0,.35,0]),{action:'pickup-drop',dropId:'drop-1'},{now});
  assert.equal(first.error,undefined);assert.ok(world.profiles.p1.inventory.includes('frost-1'));assert.equal(second.error,'Drop is gone');
});

test('prices require several platform coins and purchases are server checked',()=>{
  const world=createInitialWorld(4_000_000),profile=ensureProfile(world,'p1','p1','#fff',4_000_000);const item=itemById('tide-2');
  assert.ok(item.price>ECONOMY.platformCoinValue*10);profile.wallet=item.price-1;
  assert.equal(applyAction(world,actor(),{action:'buy',itemId:item.id},{now:4_000_001}).error,'Not enough coins');
  profile.wallet=item.price;assert.equal(applyAction(world,actor(),{action:'buy',itemId:item.id},{now:4_000_002}).error,undefined);assert.equal(profile.wallet,0);
});

test('fusion request receipt is idempotent',()=>{
  const world=createInitialWorld(5_000_000),profile=ensureProfile(world,'p1','p1','#fff',5_000_000);profile.wallet=2_000;profile.inventory.push('frost-1','ember-1');
  const body={action:'fuse',sourceId:'frost-1',targetId:'ember-1',requestId:'fusion-unique-1'};
  const first=applyAction(world,actor(),body,{now:5_000_001,rng:()=>0});const wallet=profile.wallet,inventory=[...profile.inventory];
  const second=applyAction(world,actor(),body,{now:5_000_002,rng:()=>1});
  assert.deepEqual(second.fusion,first.fusion);assert.equal(profile.wallet,wallet);assert.deepEqual(profile.inventory,inventory);
});

test('PvP death drops exactly twenty percent of carried coins',()=>{
  const now=6_000_000,world=createInitialWorld(now),attacker=ensureProfile(world,'p1','p1','#fff',now),target=ensureProfile(world,'p2','p2','#fff',now);
  attacker.equipment.weapon='ember-5';attacker.inventory.push('ember-5');target.wallet=1_003;target.hp=1;
  const result=applyAction(world,actor('p1',[10,0,0]),{action:'attack',direction:[1,0,0]},{now,actors:[actor('p1',[10,0,0]),actor('p2',[12,0,0])]});
  assert.equal(result.hit.defeated,true);assert.equal(result.hit.lostCoins,Math.floor(1003*.2));assert.equal(target.wallet,1003-Math.floor(1003*.2));
  assert.equal(world.groundDrops.at(-1).amount,Math.floor(1003*.2));
});

test('timed ground loot stays capped and one monster spawns for active fighters',()=>{
  const now=7_000_000,world=createInitialWorld(now);world.nextGroundDropAt=now;world.monster.nextSpawnAt=now;
  const changed=tickWorld(world,{now,activeFighters:2,actors:[actor('p1',[0,0,0])],rng:()=>0});
  assert.equal(changed,true);assert.equal(world.groundDrops.filter(d=>d.kind!=='heart').length,1);assert.ok(world.groundDrops.some(d=>d.kind==='heart'));assert.equal(world.monster.active,true);
  for(let i=0;i<20;i++){world.nextGroundDropAt=now+i+1;tickWorld(world,{now:now+i+1,activeFighters:1,rng:()=>0});}
  assert.ok(world.groundDrops.length<=ECONOMY.maxGroundDrops);
});

test('GM is immune to PvP damage and held artwork is recovered on departure',()=>{
  const now=9_000_000,world=createInitialWorld(now),source=actor('fighter',[10,0,0]),target=actor('gm',[10,0,-2]);
  ensureProfile(world,'fighter','fighter','#abcdef',now);const gm=ensureProfile(world,'gm','Ely','#abcdef',now,true);world.artworks['platform-01'].holder='gm';
  const hit=applyAction(world,source,{action:'attack',direction:[0,0,-1]},{now,actors:[source,target]});
  assert.equal(hit.hit.immune,true);assert.equal(gm.hp,gm.maxHp);
  assert.equal(releasePlayerWorldState(world,'gm',now),true);assert.equal(world.artworks['platform-01'].holder,null);assert.equal(world.artworks['platform-01'].availableAt,now+30_000);
});

test('building cannot block spawns or artwork platforms and receives a server variant',()=>{
  const now=10_000_000,world=createInitialWorld(now),builder=actor('builder',[10,0,0]);ensureProfile(world,'builder','builder','#abcdef',now).wallet=1_000;
  const spawnBlock=applyAction(world,{...builder,position:[-5,0,10]},{action:'build',kind:'wall',position:[-5,0,6],rotation:0},{now,rng:()=>.2});
  assert.equal(spawnBlock.error,'Invalid build position');
  const platformBlock=applyAction(world,{...builder,position:PLATFORMS[1].position},{action:'build',kind:'tree',position:PLATFORMS[1].position,rotation:0},{now,rng:()=>.2});
  assert.equal(platformBlock.error,'Invalid build position');
  const valid=applyAction(world,builder,{action:'build',kind:'house',position:[15,0,0],rotation:.5},{now,rng:()=>.9});
  assert.equal(valid.error,undefined);assert.equal(valid.structure.variant,3);
});

test('ground materials keep duplicate value and can strengthen a weapon',()=>{
  const now=11_000_000,world=createInitialWorld(now),profile=ensureProfile(world,'p1','p1','#abcdef',now);profile.wallet=2_000;profile.inventory.push('temple-resin','temple-resin');
  ensureProfile(world,'p1',null,null,now+1);assert.equal(profile.inventory.filter(id=>id==='temple-resin').length,2);
  const result=applyAction(world,actor('p1',[10,0,0]),{action:'fuse',sourceId:'temple-resin',targetId:'tide-1',requestId:'material-fusion-1'},{now:now+2,rng:()=>0});
  assert.equal(result.fusion.success,true);assert.equal(profile.fusion['tide-1'].bonus,10);assert.equal(profile.inventory.filter(id=>id==='temple-resin').length,1);
});

test('destroyed structures produce an authoritative synchronized debris event',()=>{
  const now=12_000_000,world=createInitialWorld(now),fighter=actor('p1',[10,0,0]),profile=ensureProfile(world,'p1','p1','#abcdef',now);profile.inventory.push('ember-5');profile.equipment.weapon='ember-5';world.structures.push({id:'fragile',kind:'wall',variant:2,position:[10,0,2],rotation:0,owner:'p1',hp:1,createdAt:now});
  const result=applyAction(world,fighter,{action:'destroy',structureId:'fragile',direction:[0,0,1]},{now});
  assert.equal(result.structureDestroyed.id,'fragile');assert.deepEqual(result.structureDestroyed.position,[10,0,2]);assert.equal(world.structures.some(entry=>entry.id==='fragile'),false);
});

test('plant replies form persistent branches and monsters respect the central safe zone',()=>{
  const now=13_000_000,world=createInitialWorld(now),writer=actor('p1',[0,0,0]);
  const root=applyAction(world,writer,{action:'plant',text:'root',position:[2,0,0]},{now});
  const reply=applyAction(world,writer,{action:'plant',text:'reply',position:[2,0,0],parentId:root.plant.id},{now:now+1});
  assert.equal(reply.plant.parentId,root.plant.id);assert.notDeepEqual(reply.plant.position,root.plant.position);
  const profile=world.profiles.p1;world.monster={active:true,id:'monster',variant:'warden',position:[6.5,0,0],hp:420,maxHp:420,generation:1,nextAttackAt:now};const before=[...world.monster.position],hp=profile.hp;
  tickWorld(world,{now:now+2,activeFighters:1,actors:[writer]});assert.ok(Math.hypot(world.monster.position[0],world.monster.position[2])>=49);assert.equal(profile.hp,hp);
});
