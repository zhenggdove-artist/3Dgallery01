import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ITEMS,MATERIALS,itemById,groundDropRoll,monsterDropRoll,ECONOMY} from '../src/shared/catalog.js';
import {PLAYER_SPAWNS,insideSafeZone} from '../src/shared/arena.js';
import {createInitialWorld,createProfile,ensureProfile,migrateWorld,tickWorld,worldView,applyAction,validateState,RESPAWN_SHIELD_MS} from '../src/shared/temple-rules.js';

const T=18_110_000;
const old=['wet-stone','signal-wire','temple-resin'];
const fighter=(key,position=[73,0,20],seat=2)=>({key,name:key,color:'#abcdef',role:'fighter',position,seat});

test('material items are no longer registered, shoppable or included in any monster/ground loot',()=>{
 assert.deepEqual(MATERIALS,[]);
 assert.equal(ITEMS.some(item=>item.slot==='material'),false);
 for(const id of old)assert.equal(itemById(id),null,id+' must be inaccessible');
 // Cover boundaries and interior of each weighted random interval.
 for(let i=0;i<=1000;i++){
  const rng=()=>i===1000?.999999:i/1000;
  for(const roll of [groundDropRoll(rng),monsterDropRoll(rng)]){
   assert.notEqual(roll.kind,'material');
   if(roll.itemId)assert.ok(itemById(roll.itemId)&&itemById(roll.itemId).slot!=='material',roll.itemId);
   else assert.equal(roll.kind,'coin');
  }
 }
 assert.equal(ECONOMY.maxGroundDrops>0,true);
});

test('old ground material drops disappear on persisted-world migration without deleting valid loot',()=>{
 const world=createInitialWorld(T);
 for(const [index,id] of old.entries())world.groundDrops.push({
  id:'old-'+index,kind:'material',itemId:id,position:[0,0,0],expiresAt:T+100_000
 });
 world.groundDrops.push({id:'old-unknown',kind:'equipment',itemId:'signal-wire',
  position:[0,0,0],expiresAt:T+100_000});
 world.groundDrops.push({id:'coin',kind:'coin',amount:33,position:[0,0,0],expiresAt:T+100_000});
 world.groundDrops.push({id:'sword',kind:'equipment',itemId:'frost-1',
  position:[0,0,0],expiresAt:T+100_000});
 migrateWorld(world,T);
 assert.deepEqual(world.groundDrops.map(d=>d.id),['coin','sword']);
 tickWorld(world,{now:T+100,actors:[],rng:()=>.4});
 assert.deepEqual(worldView(world,'absent',T+100).groundDrops.map(d=>d.id),['coin','sword']);
});

test('old material inventory copies are purged on login, including GM inventory',()=>{
 const world=createInitialWorld(T),p=createProfile('recovered','Recovered','#abcdef',T);
 p.inventory.push(...old,...old);
 world.profiles[p.key]=p;
 ensureProfile(world,p.key,p.name,p.color,T+1);
 for(const id of old)assert.equal(p.inventory.includes(id),false);
 const gm=ensureProfile(world,'gm','Ely','#abcdef',T,true);
 for(const id of old)assert.equal(gm.inventory.includes(id),false);
 assert.equal(gm.inventory.some(id=>itemById(id)?.slot==='material'),false);
});

test('monster fatal hit is credited to Art Master, never ENVIRONMENT or a generic NPC',()=>{
 const world=createInitialWorld(T),a=fighter('victim',[72,0,20]);
 const p=ensureProfile(world,'victim','victim','#abcdef',T);
 p.hp=1;
 const now=T+300;
 const swipe={
  id:'monster-finish',motion:'swipe',phase:'active',origin:[72,0,19],aim:[72,0,22],
  start:now-50,end:now+500,hit:[],radius:4.2,damage:25
 };
 world.monster={id:'real-monster',model:'uncle',active:true,hp:500,maxHp:500,
  position:[72,0,19],skills:[swipe],updatedAt:T,nextAttackAt:T+100000};
 tickWorld(world,{now,actors:[a],activeFighters:0,rng:()=>.5});
 assert.equal(p.hp,0);
 assert.equal(p.lastKilledBy.name,'Art Master');
 assert.equal(world.killEvents.at(-1).killerName,'Art Master');
 assert.equal(world.killEvents.at(-1).cause,'monster');
 assert.equal(worldView(world,'victim',now).profile.lastKilledBy.name,'Art Master');
});

test('automatic revive returns each seat to central WRITE hub and grants same respawn immunity',()=>{
 const world=createInitialWorld(T),a=fighter('victim',[75,0,20],3);
 const p=ensureProfile(world,'victim','victim','#abcdef',T);
 p.hp=0;p.deadUntil=T+5000;
 tickWorld(world,{now:T+5000,actors:[a],activeFighters:0,rng:()=>.5});
 const center=PLAYER_SPAWNS[3];
 assert.equal(p.hp,p.maxHp);
 assert.equal(p.deadUntil,0);
 assert.equal(p.lastRespawnAt,T+5000);
 assert.deepEqual(p.respawnPosition,center);
 assert.ok(insideSafeZone(p.respawnPosition));
 assert.equal(p.spawnProtectedUntil,T+5000+RESPAWN_SHIELD_MS);
 const publicProfile=worldView(world,'victim',T+5000).profile;
 assert.deepEqual(publicProfile.respawnPosition,center);
 assert.equal(publicProfile.lastRespawnAt,T+5000);
 // The server must let a player move from their old distant death location
 // directly to the newly authorized hub location, without an anti-cheat snap.
 const accepted=validateState({position:[75,0,20],rotation:0,animation:'idle'},
  {position:center,rotation:0,animation:'idle'},100,'fighter',center,null,T+5100,
  {lastRespawnAt:p.lastRespawnAt,stats:{speed:1}});
 assert.equal(accepted.error,undefined);
 const rejected=validateState({position:[75,0,20],rotation:0,animation:'idle'},
  {position:[-60,0,0],rotation:0,animation:'idle'},100,'fighter',center,null,T+5100,
  {lastRespawnAt:p.lastRespawnAt,stats:{speed:1}});
 assert.equal(rejected.error,'Movement rejected');
});

test('login-time revive and explicit server respawn assign safe hub coordinates',()=>{
 const world=createInitialWorld(T),p=createProfile('login','Login','#abcdef',T);
 p.hp=0;p.deadUntil=T+50;world.profiles[p.key]=p;
 ensureProfile(world,'login','Login','#abcdef',T+60);
 assert.ok(insideSafeZone(p.respawnPosition));
 assert.equal(p.lastRespawnAt,T+60);
 const other=ensureProfile(world,'manual','Manual','#abcdef',T);
 other.hp=0;other.deadUntil=T+100;
 const attempt=applyAction(world,fighter('manual',[70,0,0],2),
  {action:'respawn'},{now:T+100,seatIndex:2});
 // The existing API can be called at the exact timeout, when ensureProfile
 // has already auto-revived. No second revive or immunity reset is permitted.
 assert.equal(attempt.error,'Respawn unavailable while alive');
 assert.deepEqual(other.respawnPosition,PLAYER_SPAWNS[0]);
});

test('UI labels are English and server/session respawns synchronize hub location',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../cloudflare/worker.js',import.meta.url),'utf8');
 assert.match(ui,/mystery:'Mystery Weapons'/);
 assert.doesNotMatch(ui,/mystery:'神秘武器'/);
 assert.match(ui,/KILLED BY/);
 assert.match(main,/profile\.respawnPosition/);
 assert.match(main,/lastAppliedRespawnAt/);
 assert.match(main,/controller\.teleport\(spawn\)/);
 assert.match(worker,/previousRespawns/);
 assert.match(worker,/profile\.respawnPosition/);
 assert.match(worker,/UPDATE sessions SET state=\?/);
});
