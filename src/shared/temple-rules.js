import {journeyPose,journeyAction} from './write-journey.js';
import {recoverArtworks} from './artwork-recovery.js';
import {chargedArea,insideChargedArea,spellGroundHeight,scaleUltimateFootprint} from './charge-area.js';
import {discGroundHeight} from './artwork-discs.js';
import {artworkLanding} from './artwork-flight.js';
import {publishArtBomb,resizeArtBomb,updateArtBombAppearance,resetPlayerArtworks,projectileHitsActor,artBombDamage,artworkBlastHits,ARTWORK_BLAST_RADIUS} from './art-bomb.js';
import {addArtwork,artworkDefinitions,validateAppearance} from './artwork-library.js';
import {ECONOMY,ITEMS,SHOP_ITEMS,STARTER_LOADOUT,EQUIPPABLE_SLOTS,attackStats,itemById,registerCustomWings,groundDropRoll,monsterDropRoll} from './catalog.js';
import {ARENA_RADIUS,GROUND_DROP_POINTS,MONSTER_SPAWNS,PLATFORMS,PLAYER_SPAWNS,SAFE_ZONE,distance2d,insideArena,insideSafeZone} from './arena.js';
import layoutDefaults from '../../temple-artwork-layout.json' with {type:'json'};
import {ORIGINAL_ACTIONS,originalAction,originalView} from './reletter-actions.js';
import {applyStatus,tickStatus,effectActive,applyElementalHit} from './combat-status.js';
import {playerStats,refreshStats} from './player-stats.js';
import {fuseOriginal,equippedItem} from './fusion-adapter.js';
import {fuseTemple} from './temple-fusion.js';
import {ensureFusionIdentity,appendInventoryInstance,removeInventoryInstance,selectEquipmentInstance,swapInventoryInstances} from './fusion-instances.js';
import {fusionSniperEchoDamage} from './fusion-balance.js';
import {advanceIslandEnemy,ISLAND_ENEMIES,ENEMY_HEIGHT,ENEMY_RADIUS} from './island-combat.js';
import {spawnMonsterPack,MONSTER_PACK_SIZE} from './monster-pack.js';
import {patrolMonster} from './monster-patrol.js';
import {calicoPellets} from './calico-pellets.js';
import {pvpShotDamage,projectileFlightMs,sniperHitsHead,contactDamageIntervalMs,visibleCollisionLifetimeMs,SNIPER_RANGE} from './combat-balance.js';
import {normalMeleeFootprint} from './melee-contact.js';
import {isChannelStaff,weaponQuality,channelVisualRadius,forwardCastRadius,channelReachMultiplier,GOLDFISH_SWIM_MS,GOLDFISH_SWIM_RADIUS,WHIP_PULL_SPEED,whipPullDurationMs} from './weapon-abilities.js';
import {recordTempleDamage} from './damage-events.js';
import {directHitModifiers} from '../reletter/combat-hit-rules.js';
import {insideArtSanctuary} from './arena.js';
import {replenishHearts} from './heart-pickups.js';
import {cleanLegacyScene} from './scene-cleanup.js';
import {samplePanBlastPosition,PAN_BLAST_DETONATION_ADVANCE_MS} from './pan-blast-flight.js';
import {initialCollector,tickCollector} from './collector.js';
import {drawGmWing,drawWing,FREE_WING_TRIAL_LIMIT} from './wing-shop.js';
import {MAX_PAINTED_WINGS,normalizePaintedWing,validWingDrawRate,totalCustomWingRates} from './custom-wings.js';

export const WORLD_VERSION=1;
export const ARTWORK_RESPAWN_MS=30_000;
export const MAX_FIGHTERS=4;
export const MAX_SPECTATORS=100;
export const RESPAWN_SHIELD_MS=3000;

const clone=value=>structuredClone(value);
const id=()=>crypto.randomUUID();
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const integer=n=>Number.isInteger(n)&&Number.isFinite(n);
const initialStructures=now=>[
  ['tree',[-20,0,-15],.2,90],['tree',[22,0,-17],-.5,90],['tree',[25,0,18],.9,90],['tree',[-24,0,18],-.8,90],
  ['tree',[-8,0,29],.35,90],['tree',[11,0,-29],-.2,90],['house',[17,0,20],.4,220],['house',[-18,0,-23],-2.2,220],
  ['column',[28,0,3],0,140],['column',[-29,0,-1],0,140]
 ].map(([kind,position,rotation,hp],index)=>({id:`temple-seed-${index+1}`,kind,position,rotation,owner:'temple',hp,createdAt:now}));

export function createInitialWorld(now=Date.now()){
  return {
    version:WORLD_VERSION,revision:1,createdAt:now,
    profiles:{},customWings:[],
    coins:Object.fromEntries(PLATFORMS.map(p=>[p.id,{availableAt:0}])),
    artworks:Object.fromEntries(PLATFORMS.map(p=>[p.id,{availableAt:0,holder:null,throwEvent:null}])),
    artworkLayout:clone(layoutDefaults.artworkLayout||{}),floatingPlatforms:clone(layoutDefaults.floatingPlatforms||[]),removedPlatformIds:[],persistentAttacks:[],groundDrops:[],structures:[],plants:[],sceneCleanupVersion:1,
    monster:{active:false,nextSpawnAt:now+ECONOMY.monsterIntervalMs,generation:0},monsters:[],audioSettings:{},musicVersion:0,
    collector:initialCollector(now),lastCollectorSale:null,
    nextGroundDropAt:now+ECONOMY.groundSpawnMinMs,
    activity:{coinMinted:0,coinBurned:0,itemsSpawned:0,itemsClaimed:0}
  };
}

export function migrateWorld(raw,now=Date.now()){
  const world=raw&&typeof raw==='object'?raw:createInitialWorld(now);
  if(!world.version)world.version=1;
  world.profiles??={};world.customWings??=[];registerCustomWings(world.customWings);
  world.coins??={};world.artworks??={};world.artworkLayout??={};world.floatingPlatforms??=clone(layoutDefaults.floatingPlatforms||[]);world.removedPlatformIds??=[];world.persistentAttacks??=[];world.groundDrops??=[];world.structures??=[];world.plants??=[];
  world.activity??={coinMinted:0,coinBurned:0,itemsSpawned:0,itemsClaimed:0};
  for(const p of PLATFORMS){world.coins[p.id]??={availableAt:0};world.artworks[p.id]??={availableAt:0,holder:null,throwEvent:null};if(!world.artworkLayout[p.id]&&layoutDefaults.artworkLayout?.[p.id])world.artworkLayout[p.id]=clone(layoutDefaults.artworkLayout[p.id]);}
  // Old RELETTER farming data must not survive the removal of the Garden game mode.
  if(world.reletter?.garden)delete world.reletter.garden;
  world.monster??={active:false,nextSpawnAt:now+ECONOMY.monsterIntervalMs,generation:0};world.monsters??=[];world.audioSettings??={};world.musicVersion??=0;
  world.collector??=initialCollector(now);world.lastCollectorSale??=null;
  // Earlier releases retained only the last transaction; honor that
  // receipt when upgrading a pre-existing persistent room.
  const oldSale=world.lastCollectorSale;
  if(oldSale?.buyer&&oldSale.artworkId&&world.profiles[oldSale.buyer]){
   const owner=world.profiles[oldSale.buyer];
   owner.collectorSoldArtworks??={};
   owner.collectorSoldArtworks[oldSale.artworkId]??=oldSale.time||now;
  }
  world.nextGroundDropAt??=now+ECONOMY.groundSpawnMinMs;
  // Purge persisted deprecated material loot immediately, even if its
  // original drop lifetime has not expired.
  world.groundDrops=world.groundDrops.filter(drop=>
   drop.kind!=='material'&&(!drop.itemId||
    (itemById(drop.itemId)&&!['material','wings'].includes(itemById(drop.itemId).slot))));
  return cleanLegacyScene(world);
}

export function createProfile(key,name,color,now=Date.now(),admin=false){
  return {key,name:String(name||'Pilgrim').slice(0,24),color:validColor(color)?color:'#43b59a',admin:!!admin,
    wallet:80,level:1,xp:0,hp:100,maxHp:100,deadUntil:0,inventory:admin?ITEMS.map(item=>item.id):[STARTER_LOADOUT.weapon],equipment:{...STARTER_LOADOUT,wings:admin?'wings-18':null},gmWingsInitialized:!!admin,gmInvincible:admin?true:undefined,
    gmAllItemsGranted:!!admin,gmKnownCustomWingIds:[],collectorSoldArtworks:{},
    fusion:{},wingTrialDraws:0,wingPaidDraws:0,createdAt:now,updatedAt:now,lastAttackAt:0};
}

// Rebuild the authoritative safe-zone spawn on every revival, including
// automatic death countdown expiry (no client-triggered respawn required).
function reviveProfile(profile,now,seatIndex=0){
 const seat=Number.isInteger(seatIndex)&&seatIndex>=0?seatIndex:0;
 profile.hp=profile.maxHp||100;
 profile.deadUntil=0;
 profile.lastRespawnAt=now;
 profile.respawnPosition=[...PLAYER_SPAWNS[seat%PLAYER_SPAWNS.length]];
 profile.spawnProtectedUntil=now+RESPAWN_SHIELD_MS;
 return profile.respawnPosition;
}

export function ensureProfile(world,key,name,color,now=Date.now(),admin=false){
  const current=world.profiles[key]??=createProfile(key,name,color,now,admin);
  if(name)current.name=String(name).slice(0,24);if(validColor(color))current.color=color;current.admin=!!admin;current.updatedAt=now;
  current.wallet=Number.isFinite(current.wallet)?Math.max(0,Math.floor(current.wallet)):0;
  current.level=Math.max(1,Math.floor(current.level||1));current.xp=Math.max(0,Math.floor(current.xp||0));
  current.wingTrialDraws=Number.isFinite(current.wingTrialDraws)?Math.max(0,Math.min(FREE_WING_TRIAL_LIMIT,Math.floor(current.wingTrialDraws))):0;
  if(!current.collectorSoldArtworks||typeof current.collectorSoldArtworks!=='object'||Array.isArray(current.collectorSoldArtworks))
   current.collectorSoldArtworks={};
  current.inventory=Array.isArray(current.inventory)?current.inventory.filter(itemById).slice(0,600):[STARTER_LOADOUT.weapon];
  // One-time migration supplies every base item, including all premium wings.
  // Never replenish items removed later as fusion materials. Newly published
  // custom wings are separately granted once, even to established GM accounts.
  if(current.admin){
   if(!current.gmAllItemsGranted){
    const owned=new Set(current.inventory);
    for(const item of ITEMS){
     if(current.inventory.length>=600)break;
     if(!owned.has(item.id)){current.inventory.push(item.id);owned.add(item.id);}
    }
    current.gmAllItemsGranted=true;
   }
   current.gmInventoryGranted=true;
   const known=new Set(Array.isArray(current.gmKnownCustomWingIds)?current.gmKnownCustomWingIds:[]);
   const owned=new Set(current.inventory);
   for(const wing of world.customWings||[]){
    if(known.has(wing.id))continue;
    if(!owned.has(wing.id)&&current.inventory.length<600){
     current.inventory.push(wing.id);owned.add(wing.id);
    }
    known.add(wing.id);
   }
   current.gmKnownCustomWingIds=[...known];
  }
  // Keep migrating old profiles to the SMG baseline, except after deliberate
  // fusion consumption. This also repairs older missing/corrupt inventories.
  if(!current.inventory.includes(STARTER_LOADOUT.weapon)&&!current.spentStarterWeapon)
   current.inventory.unshift(STARTER_LOADOUT.weapon);
  current.equipment??={...STARTER_LOADOUT};
   if(current.admin&&!current.gmWingsInitialized){
    if(!current.equipment.wings)current.equipment.wings='wings-18';
    current.gmWingsInitialized=true;
   }
   if(current.admin&&typeof current.gmInvincible!=='boolean')current.gmInvincible=true;
   // Preserve legacy selected weapons while the inventory migration runs.
   // Fusion itself clears the equipped material when the final copy is spent.
   if(current.equipment.weapon&&!itemById(current.equipment.weapon))current.equipment.weapon=STARTER_LOADOUT.weapon;
   delete current.equipment.rod;delete current.equipment.tool;current.fusion??={};delete current.fish;delete current.lastFishAt;
  ensureFusionIdentity(current);
  refreshStats(world,current,now);
  if(current.deadUntil>0&&current.deadUntil<=now&&current.hp<=0)
   reviveProfile(current,now);
  return current;
}

export function validColor(value){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);}
export function validName(value){return typeof value==='string'&&value.trim().length>=1&&value.trim().length<=24&&!/[<>\u0000-\u001f]/.test(value);}

export function publicProfile(profile){
  return {key:profile.key,name:profile.name,color:profile.color,wallet:profile.admin?'∞':profile.wallet,hp:profile.hp,maxHp:profile.maxHp,
    level:profile.level,xp:profile.xp,wingTrialDraws:profile.wingTrialDraws||0,wingPaidDraws:Math.max(0,Number(profile.wingPaidDraws)||0),deadUntil:profile.deadUntil,lastRespawnAt:profile.lastRespawnAt||0,
    respawnPosition:clone(profile.respawnPosition||null),
    spawnProtectedUntil:profile.spawnProtectedUntil||0,lastKilledBy:profile.lastKilledBy||null,equipment:clone(profile.equipment),hitReaction:profile.hitReaction||null,whipPull:profile.whipPull||null,effects:clone(profile.effects||{}),admin:profile.admin,gmInvincible:profile.admin&&profile.gmInvincible!==false,gmFusionChance:profile.admin?(Number.isFinite(profile.gmFusionChance)?profile.gmFusionChance:1):undefined};
}

export function worldView(world,actorKey,now=Date.now(),includeCustomWings=true){
  const profile=world.profiles[actorKey];
  return {version:world.version,revision:world.revision,serverTime:now,
    coins:Object.fromEntries(PLATFORMS.map(p=>[p.id,{available:now>=(world.coins[p.id]?.availableAt||0),availableAt:world.coins[p.id]?.availableAt||0}])),
    artworks:clone(world.artworks),artworkLayout:clone(world.artworkLayout||{}),customArtworks:clone(world.customArtworks||[]),customWings:includeCustomWings?clone(world.customWings||[]):undefined,floatingPlatforms:clone(world.floatingPlatforms||[]),removedPlatformIds:clone(world.removedPlatformIds||[]),groundDrops:clone(world.groundDrops),structures:clone(world.structures),plants:clone(world.plants),monster:clone(world.monster),monsters:clone(world.monsters||[]),audioSettings:clone(world.audioSettings||{}),musicVersion:world.musicVersion||0,
    collector:clone(world.collector),collectorSale:clone(world.lastCollectorSale),
    profile:profile?{...publicProfile(profile),stats:playerStats(world,profile,now),inventory:clone(profile.inventory),inventoryInstances:clone(profile.inventoryInstances||[]),fusionByInstance:clone(profile.fusionByInstance||{}),equippedInstanceIds:clone(profile.equippedInstanceIds||{}),fusionIdentityMigrated:!!profile.fusionIdentityMigrated,fusionSuccessOnlyMigrated:!!profile.fusionSuccessOnlyMigrated,fusion:clone(profile.fusion),impulse:profile.impulse||null}:null,
    reletter:originalView(world),economy:ECONOMY,damageEvents:clone((world.damageEvents||[]).filter(e=>now-e.time<8000)),killEvents:clone((world.killEvents||[]).filter(e=>now-e.time<8000)),monsterDeathEvents:clone((world.monsterDeathEvents||[]).filter(e=>now-e.time>=0&&now-e.time<8000))};
}

function requireFighter(actor){return actor.role==='fighter'?null:{error:'Spectators cannot perform this action'};}
function requireAlive(profile,now){return profile.hp>0&&profile.deadUntil<=now?null:{error:'Wait for respawn'};}
function near(actor,position,radius){return distance2d(actor.position,position)<=radius&&Math.abs((actor.position?.[1]||0)-position[1])<=8;}
function spend(profile,amount,world){if(profile.admin)return true;if(profile.wallet<amount)return false;profile.wallet-=amount;world.activity.coinBurned+=amount;return true;}
function earn(profile,amount,world){if(!profile.admin)profile.wallet+=amount;world.activity.coinMinted+=amount;}
function addItem(profile,itemId){if(!itemById(itemId)||profile.inventory.length>=600)return false;appendInventoryInstance(profile,itemId);return true;}

export function validateState(previous,next,elapsedMs,role='fighter',spawn=null,journey=null,now=Date.now(),mobility=null){
  const pose=journeyPose(journey,now);
  if(pose&&role==='fighter')return {state:{position:pose.position,rotation:Math.PI,animation:pose.animation,visible:true}};
  // Pan recoil can lift someone standing on a 30m GM deck above the
  // ordinary 32m arena ceiling. Grant only the short, server-authorized
  // explosion arc the extra vertical headroom.
  const authorizedPanFlight=role==='fighter'&&mobility?.hitReaction?.panBlast&&
   now-(mobility.hitReaction.time||0)>=0&&now-(mobility.hitReaction.time||0)<3200;
  const validPanHeight=authorizedPanFlight&&Array.isArray(next?.position)&&
   next.position.length===3&&next.position.every(Number.isFinite)&&
   Math.hypot(next.position[0],next.position[2])<=ARENA_RADIUS+2&&
   next.position[1]>=-4&&next.position[1]<=72;
  if(!next||!Array.isArray(next.position)||next.position.length!==3||!next.position.every(Number.isFinite)||
     !(insideArena(next.position,role==='spectator'?28:2)||validPanHeight)||!Number.isFinite(next.rotation))
    return {error:'Invalid position',state:previous||null};
  const distanceTo=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const nearSpawn=spawn&&distanceTo(next.position,spawn)<=6;
  if(!previous&&spawn&&!nearSpawn)return {error:'Spawn position rejected',state:{position:spawn,rotation:0,animation:'idle',visible:true}};
  if(previous&&role==='fighter'){
    const freeze=effectActive(mobility||{},'freeze',now)||effectActive(mobility||{},'stun',now),root=effectActive(mobility||{},'root',now);
    if((freeze||root)&&!authorizedPanFlight)return {state:{...previous,position:[...previous.position],
      rotation:freeze?previous.rotation:+next.rotation.toFixed(4),
      animation:'idle',visible:true}};
    const elapsed=clamp(elapsedMs/1000,.05,12);
    // Horizontal movement and vertical free-fall are different physical
    // quantities. The prior Euclidean distance budget incorrectly rejected
    // legitimate accelerations under 25m/s² gravity when stepping off high
    // circular platforms, snapping players back against an invisible rim.
    const horizontal=Math.hypot(next.position[0]-previous.position[0],
      next.position[2]-previous.position[2]);
    const deltaY=next.position[1]-previous.position[1];
    const boostedSpeed=clamp(Number(mobility?.stats?.speed)||1,.5,6);
    const hasWings=!!mobility?.stats?.impulse;
    const recentHit=now-(mobility?.hitReaction?.time||0)<1800;
    const recentImpulse=now-(mobility?.impulse?.time||0)<1800;
    const justRespawned=now-(mobility?.lastRespawnAt||0)<5000&&nearSpawn;
    const landedFromWrite=now-(mobility?.lastWriteLandingAt||0)<5000&&
      Array.isArray(mobility?.lastWriteLanding)&&distanceTo(next.position,mobility.lastWriteLanding)<=9;
    // Normal run speed is 8.64m/s; airborne wings, delayed packets, and
    // server-authorized knockback need more headroom without allowing teleports.
    const maxSpeed=(hasWings?28:14)*boostedSpeed*(mobility?.channeling ? .05 : 1)+(recentHit?18:0)+(recentImpulse?18:0);
    const allowance=maxSpeed*elapsed+(mobility?.channeling ? 1.5 : 5.5)+(recentHit?6:0);
    // Descending from a 30m platform reaches ~39m/s before landing,
    // while ordinary upward jumps start at 10m/s. Validate both axes
    // without turning gravity into a forbidden lateral wall.
    const verticalSpeed=deltaY<0?42:(hasWings?32:18);
    const verticalAllowance=(verticalSpeed+(recentHit||recentImpulse?14:0))*elapsed+
      (mobility?.channeling?1.5:5.5);
    if((horizontal>allowance||Math.abs(deltaY)>verticalAllowance)&&
      !justRespawned&&!landedFromWrite)
      return {error:'Movement rejected',state:previous};
  }
  return {state:{position:next.position.map(n=>+n.toFixed(3)),rotation:+next.rotation.toFixed(4),animation:String(next.animation||'idle').slice(0,12),visible:next.visible!==false}};
}

export function applyAction(world,actor,body,context={}){
  const now=context.now??Date.now(),rng=context.rng??Math.random,
   // The premium draw checks PERSISTED admin status before any ensureProfile
   // mutation. Existing game/GM actions retain their original role semantics.
   wingDrawAdmin=['gm-wing-draw','gm-wing-publish','gm-wing-remove','gm-wing-set-rate'].includes(body.action)?world.profiles?.[actor.key]?.admin===true:null,
   profile=ensureProfile(world,actor.key,actor.name,actor.color,now,
    ['gm-wing-draw','gm-wing-publish','gm-wing-remove','gm-wing-set-rate'].includes(body.action)?wingDrawAdmin:actor.admin);
  if(body.action==='wing-draw'){
   // Public draws require a verified Firebase/Google profile key supplied by
   // the server session, never a client-supplied admin or payment flag.
   if(typeof actor.key!=='string'||!actor.key.startsWith('firebase:'))return {error:'Google account required for wing trial'};
   if(profile.admin)return {error:'GM must use the preview draw'};
   const freeRemaining=Math.max(0,FREE_WING_TRIAL_LIMIT-(profile.wingTrialDraws||0));
   const paidRemaining=Math.max(0,Number(profile.wingPaidDraws)||0);
   if(!freeRemaining&&!paidRemaining)return {error:'No wing draws remaining.'};
   const drawn=drawWing(profile,rng,world.customWings||[]);
   if(drawn.error)return drawn;
   appendInventoryInstance(profile,drawn.item.id);
   profile.itemOrigins??={};profile.itemOrigins[drawn.item.id]=freeRemaining?'wing-free-trial':'wing-paid-draw';
   if(freeRemaining)profile.wingTrialDraws++;else profile.wingPaidDraws=paidRemaining-1;
   profile.updatedAt=now;refreshStats(world,profile,now);
   world.revision=(world.revision||0)+1;
   return {wingDraw:{
    itemId:drawn.item.id,name:drawn.item.name,quality:drawn.quality,
    remaining:drawn.remaining,drawsLeft:Math.max(0,FREE_WING_TRIAL_LIMIT-profile.wingTrialDraws)+Math.max(0,profile.wingPaidDraws||0),mode:freeRemaining?'free-trial':'paid-draw'
   },notice:'FREE WING DRAW · '+drawn.item.name,profile:publicProfile(profile)};
  }
  if(body.action==='gm-wing-draw'){
   if(!wingDrawAdmin||!profile.admin)return {error:'GM only'};
   const drawn=drawGmWing(profile,rng,world.customWings||[]);
   if(drawn.error)return drawn;
   appendInventoryInstance(profile,drawn.item.id);
   profile.itemOrigins??={};profile.itemOrigins[drawn.item.id]='gm-wing-draw';
   profile.updatedAt=now;refreshStats(world,profile,now);
   world.revision=(world.revision||0)+1;
   return {wingDraw:{
    itemId:drawn.item.id,name:drawn.item.name,quality:drawn.quality,
    remaining:drawn.remaining,mode:drawn.mode
   },notice:'GM WING DRAW · '+drawn.item.name,profile:publicProfile(profile)};
  }
  if(body.action==='gm-wing-publish'){
   if(!wingDrawAdmin||!profile.admin)return {error:'GM only'};
   world.customWings??=[];
   if(world.customWings.filter(wing=>wing.retired!==true).length>=MAX_PAINTED_WINGS)return {error:'Wing gallery is full'};
   if(world.customWings.length>=160)return {error:'Wing archive is full (160 records)'};
   if(profile.inventory.length>=600)return {error:'Inventory full'};
   let wing;try{wing=normalizePaintedWing(body.wing,'gm-wing-'+crypto.randomUUID());}
   catch(error){return {error:error.message};}
   if(world.customWings.some(entry=>entry.retired!==true&&entry.name.toLowerCase()===wing.name.toLowerCase()))
    return {error:'Wing name already exists'};
   if(totalCustomWingRates(world.customWings)+wing.drawRatePct>100+1e-8)
    return {error:'所有上架翅膀的個別中獎率合計不可超過 100%'};
   world.customWings.push(wing);registerCustomWings(world.customWings);
   appendInventoryInstance(profile,wing.id);
   // Grant AND equip in the same authoritative state transaction: no
   // intermediate inventory state that the client could lose on disconnect.
   selectEquipmentInstance(profile,'wings',profile.inventory.length-1);
   profile.itemOrigins??={};profile.itemOrigins[wing.id]='gm-created';
   profile.gmKnownCustomWingIds??=[];
   if(!profile.gmKnownCustomWingIds.includes(wing.id))profile.gmKnownCustomWingIds.push(wing.id);
   profile.updatedAt=now;refreshStats(world,profile,now);world.revision++;
   return {publishedWingId:wing.id,equippedWingId:wing.id,
    notice:'已上架並自動裝備翅膀：'+wing.name};
  }
  if(body.action==='gm-wing-remove'){
   if(!wingDrawAdmin||!profile.admin)return {error:'GM only'};
   const target=(world.customWings||[]).find(wing=>wing.id===body.wingId&&wing.retired!==true);
   if(!target)return {error:'翅膀不存在或已下架'};
   target.retired=true;target.retiredAt=now;registerCustomWings(world.customWings);
   world.revision=(world.revision||0)+1;
   // A published wing may already belong to a collector. Retire from the
   // draw pool, but preserve catalog identity and existing equipment.
   return {unpublishedWingId:target.id,notice:'已下架：'+target.name+'（不再參與抽獎）'};
  }
  if(body.action==='gm-wing-set-rate'){
   if(!wingDrawAdmin||!profile.admin)return {error:'GM only'};
   const target=(world.customWings||[]).find(wing=>wing.id===body.wingId&&wing.retired!==true);
   if(!target)return {error:'翅膀不存在或已下架'};
   const drawRatePct=body.drawRatePct;
   if(!validWingDrawRate(drawRatePct))return {error:'中獎率必須為 0–100%，最多 3 位小數'};
   const sum=totalCustomWingRates(world.customWings)-Number(target.drawRatePct??1)+drawRatePct;
   if(sum>100+1e-8)return {error:'所有上架翅膀的個別中獎率合計不可超過 100%'};
   target.drawRatePct=drawRatePct;registerCustomWings(world.customWings);
   world.revision=(world.revision||0)+1;
   return {updatedWingId:target.id,notice:'已更新「'+target.name+'」中獎率為 '+drawRatePct+'%'};
  }
  if(body.action==='recover-artworks')return recoverArtworks(world,profile.admin);
  if(body.action==='reset-player-artworks')return resetPlayerArtworks(world,profile.admin,now);
   if(body.action==='gm-audio-setting'){
    if(!profile.admin)return {error:'GM only'};
    const key=String(body.key||'');const value=Number(body.value);
    if(!/^[a-z][a-z0-9-]{0,60}$/.test(key)||!Number.isFinite(value)||value<0||value>2)return {error:'Invalid sound channel or volume'};
    world.audioSettings??={};world.audioSettings[key]=Math.round(value*100)/100;
    world.revision=(world.revision||0)+1;
    return {notice:'全服音量已同步',audioSettings:clone(world.audioSettings)};
   }
  if(body.action==='gm-invincible'){
    if(!profile.admin)return {error:'GM only'};
    if(typeof body.enabled!=='boolean')return {error:'Invalid invincibility toggle'};
    profile.gmInvincible=body.enabled;
    if(body.enabled){profile.hp=profile.maxHp;profile.effects={};}
    world.revision=(world.revision||0)+1;
    return {notice:body.enabled?'GM 無敵已開啟':'GM 無敵已關閉',gmInvincible:body.enabled};
   }
   if(body.action==='gm-fusion-chance'){
    if(!profile.admin)return {error:'GM only'};
    if(typeof body.percent!=='number'||!Number.isFinite(body.percent)||body.percent<0||body.percent>100)return {error:'Invalid GM fusion chance (0–100)'};
    profile.gmFusionChance=body.percent/100;
    world.revision=(world.revision||0)+1;
    return {notice:'GM 個人融合成功率 '+body.percent.toFixed(1)+'%',gmFusionChance:profile.gmFusionChance};
   }
   if(body.action==='create-platform'){if(!profile.admin)return {error:'僅限 GM'};const p=body.position,r=Number(body.radius);if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||Math.hypot(p[0],p[2])>88||p[1]<0||p[1]>30||!Number.isFinite(r)||r<.6||r>8)return {error:'圓盤位置或半徑無效'};world.floatingPlatforms??=[];if(world.floatingPlatforms.length>=128)return {error:'已達 128 個圓盤上限'};const platform={id:id(),position:[...p],radius:r};world.floatingPlatforms.push(platform);world.revision++;return {platform,notice:'已建立漂浮圓盤，所有玩家皆可使用'};}
  if(body.action==='delete-platform'){
    if(!profile.admin)return {error:'僅限 GM 刪除圓盤'};
    const key=String(body.platformId||'');
    if(key.startsWith('floating:')){
      const uid=key.slice(9),index=(world.floatingPlatforms||[]).findIndex(p=>p.id===uid);
      if(index<0)return {error:'圓盤不存在或已遭刪除'};
      world.floatingPlatforms.splice(index,1);
    }else{
      const match=/^(display|stair):(platform-\d{2})(?::(\d{1,2}))?$/.exec(key);
      const valid=match&&PLATFORMS.some(p=>p.id===match[2])&&(match[1]==='stair'?match[3]!==undefined&&+match[3]<=63:match[3]===undefined);
      if(!valid)return {error:'無效的作品展示圓盤'};
      world.removedPlatformIds??=[];
      if(world.removedPlatformIds.includes(key))return {error:'圓盤已被刪除'};
      world.removedPlatformIds.push(key);
    }
    world.revision++;
    return {notice:'圓盤已刪除 · 所有玩家同步',platformId:key};
  }
  if(body.action==='add-artwork')return addArtwork(world,profile,actor,body,now);
  if(body.action==='set-artwork-layout')return setArtworkLayout(world,profile,body,now);
  const denied=requireFighter(actor);if(denied)return denied;const dead=requireAlive(profile,now);if(dead&&!['respawn'].includes(body.action))return dead;
  if(body.action.startsWith('write-')){const result=journeyAction(world,profile,actor,body,now);if(!result.error)world.revision++;return result;}
  // WebGL-heavy clients may not have sent their final landing pose when WRITE
  // finishes. Trust the server's own timed journey, not stale socket coords.
  if(body.action==='plant'&&profile.writeJourney){
    const journey=profile.writeJourney;
    if(!journey.drinkAt||!Array.isArray(journey.landing))return {error:'Finish WRITE before planting'};
    // Client and Durable Object clocks/packets can disagree by several frames.
    // Require the server-side fall to finish (with a small sync grace period),
    // then use the authoritative landing point, never a stale 201m socket pose.
    const landingAt=journey.drinkAt+journey.drinkDuration*1000+600+3000;
    if(now<landingAt-250)return {error:'WRITE landing still in progress'};
    actor={...actor,position:[...journey.landing]};
  }
  if(!insideArena(actor.position,2))return {error:'Invalid actor position'};
  if(ORIGINAL_ACTIONS.has(body.action)){const result=originalAction(world,profile,actor,body,now,rng);if(!result.error)world.revision++;return result;}
  let result;
  switch(body.action){
    case 'pickup-coin':result=pickupCoin(world,profile,actor,body,now);break;
    case 'pickup-drop':result=pickupDrop(world,profile,actor,body,now);break;
    case 'publish-art-bomb':if(!canPlaceArtworkAt(world,actor.position,body.artwork?.position))return {error:'Move outside the central WRITE zone and place artwork within 12 metres'};result=publishArtBomb(world,profile,actor,body,now);break;
    case 'resize-art-bomb':result=resizeArtBomb(world,actor,body,now);break;
    case 'update-art-bomb-appearance':result=updateArtBombAppearance(world,actor,body,now);break;
    case 'pickup-artwork':result=pickupArtwork(world,actor,body,now);break;
    case 'throw-artwork':result=throwArtwork(world,profile,actor,body,context,now);break;
    case 'buy':result=buy(world,profile,body);break;
    case 'sell':result=sell(world,profile,body);break;
    case 'equip':result=equip(profile,body);break;
    case 'unequip':if(!EQUIPPABLE_SLOTS.includes(body.slot))return {error:'Invalid slot'};profile.equipment[body.slot]=null;delete profile.equippedInstanceIds[body.slot];result={notice:'Unequipped'};break;
    case 'fuse':result=fuse(world,profile,body,rng);break;
     case 'swap-inventory':{
      const from=body.fromIndex,to=body.toIndex;
      if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||
         from>=profile.inventory.length||to>=profile.inventory.length)
       return {error:'Invalid inventory slot'};
      if(from===to)return {notice:'Inventory unchanged'};
      swapInventoryInstances(profile,from,to);
      result={inventoryReordered:true,fromIndex:from,toIndex:to};
      break;
     }
    case 'attack':result=attack(world,profile,actor,body,context,now);break;
    case 'monster-hit':return {error:'Use a directional weapon attack'};
    case 'build':result=build(world,profile,actor,body,now,rng);break;
    case 'destroy':result=destroy(world,profile,actor,body,now);break;
    case 'remove-structure':result=removeStructure(world,profile,actor,body,now);break;
    case 'plant':result=plant(world,profile,actor,body,now);break;
    case 'respawn':
      if(profile.hp>0&&profile.deadUntil<=now)return {error:'Respawn unavailable while alive'};
      if(profile.deadUntil>now)return {error:'Wait for respawn'};
      result={spawn:reviveProfile(profile,now,context.seatIndex)};break;
    default:return {error:'Unknown action'};
  }
  if(result?.error)return result;refreshStats(world,profile,now);profile.updatedAt=now;world.revision=(world.revision||0)+1;return {...result,profile:publicProfile(profile)};
}

function pickupCoin(world,profile,actor,body,now){
  const platform=PLATFORMS.find(p=>p.id===body.platformId);if(!platform)return {error:'Unknown coin'};
  const coin=world.coins[platform.id];if(now<coin.availableAt)return {error:'Coin is unavailable'};
  if(!near(actor,platform.coinPosition,3.3))return {error:'Move closer to the coin'};
  coin.availableAt=now+ECONOMY.platformCoinRespawnMs;earn(profile,ECONOMY.platformCoinValue,world);
  return {notice:`+${ECONOMY.platformCoinValue} coins`};
}

function pickupDrop(world,profile,actor,body,now){
  const index=world.groundDrops.findIndex(drop=>drop.id===body.dropId);if(index<0)return {error:'Drop is gone'};
  const drop=world.groundDrops[index];if(drop.expiresAt<=now)return {error:'Drop expired'};
   if(drop.kind==='material'||drop.itemId&&!itemById(drop.itemId))
    return {error:'Obsolete material drops can no longer be collected'};
   if(drop.itemId&&itemById(drop.itemId)?.slot==='wings')
    return {error:'Wings are exclusive to premium shop; ground pickup disabled'};
   if(!near(actor,drop.position,3.2))return {error:'Move closer to the drop'};
  if(drop.owner===actor.key&&now<drop.ownerLockedUntil)return {error:'Drop is still settling'};
  world.groundDrops.splice(index,1);if(drop.kind==='coin')earn(profile,drop.amount,world);else if(drop.kind==='heart'){if(profile.hp>=profile.maxHp){world.groundDrops.splice(index,0,drop);return {error:'Health is full'};}profile.hp=Math.min(profile.maxHp,profile.hp+(drop.amount||25));}else{addItem(profile,drop.itemId);const item=itemById(drop.itemId);if(item&&EQUIPPABLE_SLOTS.includes(item.slot)&&!profile.equipment[item.slot])selectEquipmentInstance(profile,item.slot,profile.inventory.length-1);}
  if(drop.itemId){profile.itemOrigins??={};profile.itemOrigins[drop.itemId]='monster';}world.activity.itemsClaimed++;return {notice:drop.kind==='coin'?`+${drop.amount} coins`:drop.kind==='heart'?'Health restored':`Picked up ${itemById(drop.itemId)?.name}`};
}

function pickupArtwork(world,actor,body,now){
  const platform=artworkDefinitions(world).find(p=>p.id===body.platformId),art=world.artworks[body.platformId];if(!platform||!art)return {error:'Unknown artwork'};
  if(art.holder||now<art.availableAt)return {error:'Artwork is unavailable'};if(!near(actor,world.artworkLayout?.[platform.id]?.position||platform.artPosition,4.2))return {error:'Move closer to the artwork'};
  for(const other of Object.values(world.artworks))if(other.holder===actor.key)other.holder=null;
  art.holder=actor.key;art.throwEvent=null;return {notice:'Artwork ready to throw'};
}

function throwArtwork(world,profile,actor,body,context,now){
  const entry=Object.entries(world.artworks).find(([,art])=>art.holder===actor.key);if(!entry)return {error:'Pick up an artwork first'};
  const direction=normalDirection(body.direction);if(!direction)return {error:'Invalid throw direction'};
  const [platformId,art]=entry,record=(world.customArtworks||[]).find(a=>a.id===platformId),bomb=!!record?.bomb;
  const origin=[actor.position[0],actor.position[1]+1.4,actor.position[2]],event={id:id(),platformId,origin,direction,time:now,power:clamp(Number(body.power)||1,.4,1.4),owner:actor.key,bomb};
  art.holder=null;art.availableAt=now+ARTWORK_RESPAWN_MS;art.throwEvent=event;
  const ground=(x,z,y)=>{let h=discGroundHeight(x,z,y);for(const p of world.floatingPlatforms||[])if(y>=p.position[1]-.5&&Math.hypot(x-p.position[0],z-p.position[2])<p.radius*2)h=Math.max(h,p.position[1]);return h;};
  // Both original models and user-uploaded artwork explode on the shared
  // ballistic landing, with the same radius as the purple frying pan.
  const landing=artworkLanding(event,ground),bombSize=world.artworkLayout?.[platformId]?.scale?.[0]||1;
  event.blastRadius=ARTWORK_BLAST_RADIUS;
  const rng=context.rng??Math.random,blastTouches=position=>artworkBlastHits(landing.position,position);
  let hit=null;const hits=[];
  for(const target of context.actors||[]){
   if(target.key===actor.key||target.role!=='fighter'||insideSafeZone(target.position))continue;
   const collision=projectileHitsActor(event,target.position,landing.time,bombSize)||
    blastTouches([target.position[0],target.position[1]+1,target.position[2]]);
   if(!collision)continue;
   const maxHp=world.profiles?.[target.key]?.maxHp||100,damage=artBombDamage(maxHp,rng);
   const result=damagePlayer(world,profile,target,damage,now,bomb?'art-bomb':'artwork',
    actor.position,'art-explosion',[target.position[0],target.position[1]+1,target.position[2]],damage>=maxHp);
   if(result){hit??=result;hits.push(result);}
  }
  let monsterHit=null;const monsterHits=[];
  for(const mob of [world.monster,...(world.monsters||[])]){
   if(!mob?.active)continue;
   const collision=projectileHitsActor(event,mob.position,landing.time,Math.max(bombSize,ENEMY_RADIUS))||
    blastTouches([mob.position[0],mob.position[1]+1.25,mob.position[2]]);
   if(!collision)continue;
   const damage=rng()<.5?mob.hp:68*event.power;
   const result=damageMonster(world,profile,damage,now,rng,'artwork',mob);
   if(result){monsterHit??=result;monsterHits.push(result);}
  }
  let structureDestroyed=null,structureHit=null;const structureHits=[],structureDestroyedEvents=[];
  for(const structure of [...(world.structures||[])]){
   if(structure.owner==='temple')continue;
   const along=project(origin,direction,structure.position);
   const direct=along>0&&along<90*event.power&&
    perpendicular(origin,direction,structure.position,along)<structureRadius(structure);
   const splash=artworkBlastHits(landing.position,structure.position,ARTWORK_BLAST_RADIUS,structureRadius(structure));
   if(!direct&&!splash)continue;
   structure.maxHp??=structure.kind==='house'?220:structure.kind==='tree'?90:140;
   const damage=Math.round(70*event.power);
   structure.hp=Math.max(0,structure.hp-damage);
   const record={id:id(),structureId:structure.id,kind:structure.kind,position:[...structure.position],hp:structure.hp,maxHp:structure.maxHp,damage,time:now};
   structureHit??=record;structureHits.push(record);
   if(structure.hp<=0){
    const destroyed=structureEvent(structure,now);structureDestroyed??=destroyed;
    structureDestroyedEvents.push(destroyed);world.structures.splice(world.structures.indexOf(structure),1);
   }
  }
  return {throwEvent:event,hit,hits,monsterHit,monsterHits,structureHit,structureHits,structureDestroyed,structureDestroyedEvents,notice:monsterHit?.defeated?'Monster defeated · loot dropped':structureDestroyed?'Artwork shattered a structure':undefined};
}

function buy(world,profile,body){const item=SHOP_ITEMS.find(entry=>entry.id===body.itemId);if(!item)return {error:'Item is not sold'};if(profile.inventory.includes(item.id)&&item.slot!=='seed')return {error:'Already owned'};if(profile.inventory.length>=600)return {error:'Inventory full'};if(!spend(profile,item.price,world))return {error:'Not enough coins'};appendInventoryInstance(profile,item.id);profile.itemOrigins??={};profile.itemOrigins[item.id]='shop';return {notice:`Purchased ${item.name}`};}
function sell(world,profile,body){const item=itemById(body.itemId),index=profile.inventory.indexOf(body.itemId);if(!item||index<0)return {error:'Item is not owned'};if(item.id===STARTER_LOADOUT.weapon||Object.values(profile.equipment).includes(item.id))return {error:'Unequip this item before selling'};removeInventoryInstance(profile,index);earn(profile,item.sell||Math.floor((item.price||0)*.25),world);return {notice:`Sold ${item.name} · +${item.sell||0} coins`};}
function equip(profile,body){const item=itemById(body.itemId);if(!item||!profile.inventory.includes(item.id)||!EQUIPPABLE_SLOTS.includes(item.slot))return {error:'Item is not owned'};const index=Number.isInteger(body.inventoryIndex)?body.inventoryIndex:profile.inventory.indexOf(item.id);if(profile.inventory[index]!==item.id)return {error:'Inventory changed: choose the equipment again'};selectEquipmentInstance(profile,item.slot,index);return {notice:`Equipped ${item.name}`};}

export function setArtworkLayout(world,profile,body,now=Date.now()){
  if(!profile.admin)return {error:'GM only'};
  const platform=artworkDefinitions(world).find(p=>p.id===body.platformId);if(!platform)return {error:'Unknown artwork'};
  const art=world.artworks[platform.id];if(art.holder||art.availableAt>now)return {error:'Wait until the artwork returns'};
  const current=world.artworkLayout?.[platform.id];if(body.expectedRevision!==(current?.revision||0))return {error:'Layout changed by another GM. Reload and retry.'};
  const layout=body.layout,vec=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
  if(!layout||!vec(layout.position)||!vec(layout.rotation)||!vec(layout.scale))return {error:'Invalid transform'};
  if(Math.hypot(layout.position[0],layout.position[2])>ARENA_RADIUS+5||layout.position[1]<-2||layout.position[1]>60||layout.scale.some(v=>v<.05||v>20)||layout.rotation.some(v=>Math.abs(v)>Math.PI*8))return {error:'Transform exceeds bounds'};
  if((world.customArtworks||[]).some(a=>a.id===platform.id&&a.bomb)&&layout.scale.some(v=>v<1||v>3))return {error:'Player artwork scale must remain within 1–3×, even in GM editor'};
  const appearance=validateAppearance(layout.appearance||current?.appearance);if(!appearance)return {error:'Invalid appearance settings'};
  const original=PLATFORMS.some(p=>p.id===platform.id);
  const proposedRadius=layout.platformRadius??current?.platformRadius;
  if(proposedRadius!==undefined&&proposedRadius!==null&&(!original||!Number.isFinite(proposedRadius)||proposedRadius<1.5||proposedRadius>14))
   return {error:'Platform radius must be 1.5–14, available for original artworks only'};
  world.artworkLayout??={};
  world.artworkLayout[platform.id]={position:[...layout.position],rotation:[...layout.rotation],scale:[...layout.scale],
   ...(original&&proposedRadius!=null?{platformRadius:proposedRadius}:{}),
   appearance,revision:(current?.revision||0)+1,updatedAt:now};world.revision++;
  return {notice:'ARTWORK DEFAULT SAVED · ALL PLAYERS',artworkLayout:clone(world.artworkLayout[platform.id])};
}

function fuse(world,profile,body,rng){return fuseTemple(world,profile,body,rng);}

function attack(world,profile,actor,body,context,now){
  // A release must clear server collision objects even while stunned, frozen,
  // or inside the previous hit-reaction recovery window.
  if(body.phase==='channel-stop'){
   profile.channelWeapon=null;profile.channelStartedAt=0;profile.chargeStartedAt=0;
   profile.lastChannelPulseAt=0;profile.lastBloomHealAt=0;
   world.persistentAttacks=(world.persistentAttacks||[]).filter(
    fx=>!(fx.owner===actor.key&&fx.channel));
   return {channeling:false,channelStopped:{owner:actor.key,time:now}};
  }
  if(body.phase!=='channel-stop'&&(effectActive(profile,'freeze',now)||effectActive(profile,'paralysis',now)))
   return {error:'Paralysed: attacks disabled'};

  if(profile.hitReaction&&now-profile.hitReaction.time<profile.hitReaction.stunMs)return {error:'Recovering from hit'};
  const weapon=equippedItem(profile,itemById(profile.equipment.weapon)||itemById(STARTER_LOADOUT.weapon)),bonus=profile.fusion[weapon.id]?.bonus||0;
  // The equipped PRIMARY Black Cat must be scoped, regardless of fusion stats
  // or added weapon effects. Reject before charge state/cooldown/damage mutate.
  if(weapon.id==='black-cat'&&body.scoped!==true){
    profile.chargeStartedAt=0;
    return {error:'Black Cat sniper requires scope'};
  }
  if(body.phase==='channel-start'){
    if(!isChannelStaff(weapon))return {error:'Only staffs support continuous casting'};
    // A staff is silent during a hold. Continuous magic only becomes legal
    // once the ORIGINAL charge request has reached the weapon's full time.
    if(!profile.chargeStartedAt||now-profile.chargeStartedAt<(weapon.chargeMs||1500))
      return {error:'Charge must reach 100% before channeling'};
    profile.channelWeapon=weapon.id;
    profile.channelStartedAt=profile.chargeStartedAt;
    profile.lastChannelPulseAt=now;
    profile.lastBloomHealAt=weapon.family==='petal'?now:0;
    return {channeling:true};
  }

  const channel=body.phase==='channel';
  if(channel&&(!isChannelStaff(weapon)||profile.channelWeapon!==weapon.id||
     !profile.channelStartedAt||now-(profile.lastChannelPulseAt||profile.channelStartedAt)>6000))
    return {error:'Staff channel is not active'};
  if(body.phase==='charge'){profile.chargeStartedAt=now;return {charging:true};}
  if(now-profile.lastAttackAt<weapon.cooldown)return {error:'Weapon is recovering'};const direction=normalDirection(body.direction);if(!direction)return {error:'Invalid attack direction'};profile.lastAttackAt=now;if(channel)profile.lastChannelPulseAt=now;
  const charge=channel?1:Math.min(clamp(Number(body.charge)||0,0,1),profile.chargeStartedAt?clamp((now-profile.chargeStartedAt)/(weapon.chargeMs||1500),0,1):0);
  if(!channel)profile.chargeStartedAt=0;
  const stats=attackStats(weapon,charge),quality=weaponQuality(weapon,profile.fusion?.[weapon.id]);
  stats.damage=+(stats.damage*quality.damage).toFixed(2);
  // A held staff actually projects forward. Its visual spray and authoritative
  // collision must use exactly the same range; no 11m decorative overshoot.
  if(channel)stats.range=Math.max(stats.range,weapon.id==='clam'?10:Math.min(18,weapon.range))*channelReachMultiplier(weapon);
  stats.range=+(stats.range*quality.range).toFixed(2);
  if(weapon.id==='black-cat')stats.range=SNIPER_RANGE; // Match the centre-camera ray at every rarity.
  // The narrow server collision tube must agree with the visible spray and
  // the original blue #59 rectangle. Non-channel charged AoEs stay intact.
  stats.radius=forwardCastRadius(weapon,quality,stats.radius,channel);
   // Restrict ordinary whip contacts to the visible, narrow forward-moving lash.
   if(weapon.family==='whip'&&!weapon.exotic&&!stats.ultimate){stats.range=+(Math.min(stats.range,4.7+(Math.max(1,weapon.tier||1)-1)*1.5)/3).toFixed(3);stats.radius=.16;}
    if(weapon.family==='swatter'&&!weapon.exotic&&!stats.ultimate){stats.range=Math.min(stats.range,1.55+(Math.max(1,weapon.tier||1)-1)*.2);stats.radius=.18;}
   // Keep basic contact within each visible swing (+10px). Do not change
   // saber range or charged area ultimates.
   if(!stats.ultimate){
    const contact=normalMeleeFootprint(weapon);
    if(contact){stats.range=Math.min(stats.range,contact.range);stats.radius=Math.min(stats.radius,contact.radius);}
   }
  // Jellybrella's giant spinning wheel is an area hazard, not a .3m point.
  // Scale the original authoritative area and its warning with the doubled wheel.
  if(weapon.id==='jellybrella'&&stats.ultimate)stats.radius=Math.max(10,stats.radius*2);
   if(weapon.id==='goldfish'&&stats.ultimate)stats.radius=GOLDFISH_SWIM_RADIUS*quality.visual;
   scaleUltimateFootprint(stats,weapon,quality);
  const origin=[actor.position[0],actor.position[1]+1.16,actor.position[2]],combo=stats.ultimate?6:now-(profile.lastComboAt||0)<1200?((profile.combo||0)+1)%6:0;if((weapon.firstPerson||weapon.id==='calico-cat'||isChannelStaff(weapon)||weapon.family==='saber')&&Array.isArray(body.origin)&&body.origin.length===3&&body.origin.every(Number.isFinite)&&Math.hypot(...body.origin.map((v,i)=>v-actor.position[i]))<=3)origin.splice(0,3,...body.origin);stats.damage=+(stats.damage*playerStats(world,profile,now).attack*.1).toFixed(3);profile.combo=combo;profile.lastComboAt=now;
  const groundForSpell=(x,z,y)=>spellGroundHeight(world,x,z,y);
  // The goldfish ultimate is an actual travelling creature, not a splash at a distant ground marker.
  const area=stats.ultimate&&weapon.id!=='goldfish'?chargedArea(weapon,origin,direction,stats,groundForSpell,channel):null;
  const pellets=weapon.pattern==='scatter'?calicoPellets(direction,stats.ultimate,now):null;
  const fusionEchoes=[];
  const pvpDamage=pvpShotDamage(weapon,stats,quality);
  const returningGiraffe=weapon.id==='giraffe'&&stats.ultimate;
  const roamingFan=weapon.id==='fan'&&stats.ultimate;
  const swimmingFish=weapon.id==='goldfish'&&stats.ultimate;
  if(returningGiraffe||roamingFan||swimmingFish){
    world.persistentAttacks??=[];
    const duration=swimmingFish?Math.round(GOLDFISH_SWIM_MS*quality.duration):returningGiraffe?2300:Math.round((1400+quality.tier*850)*quality.duration);
    world.persistentAttacks.push({
      id:id(),kind:swimmingFish?'goldfish':returningGiraffe?'giraffe':'fan',owner:actor.key,
      origin:[...origin],direction:[...direction],range:stats.range,
      damage:stats.damage+bonus*.1,pvpDamage,radius:stats.radius,tier:quality.tier, // already quality-adjusted and 60%-sized, exactly as the warning
      createdAt:now,lastAt:now,expiresAt:now+duration,
      outHits:[],backHits:[],fanHits:{},fishHits:[]
    });
    if(world.persistentAttacks.length>32)world.persistentAttacks.splice(0,world.persistentAttacks.length-32);
  }
  const persistentOnly=returningGiraffe||roamingFan||swimmingFish;
  // Attack requests only launch server-owned trajectories. Health, statuses,
  // and damage-number events are produced by tickPersistentAttacks when the
  // travelling VFX volume actually touches a target (never on key release).
  if(!persistentOnly){
    const duration=projectileFlightMs(weapon,stats.ultimate,stats.range);
    const visualLifetime=channel?duration:visibleCollisionLifetimeMs(weapon,stats.ultimate);
    world.persistentAttacks??=[];
    world.persistentAttacks.push({
      id:id(),kind:'projectile',owner:actor.key,weapon:weapon.id,
      origin:[...origin],direction:[...direction],range:stats.range,
      radius:stats.radius,area,damage:stats.damage+bonus*.1,pvpDamage,charge,
      qualityDuration:quality.duration,qualityScale:quality.visual,tier:quality.tier,channel,
      flightMs:duration,hitTimes:{},pellets:pellets?.map(p=>({...p,radius:p.radius*quality.visual}))||null,
      hits:[],pelletHits:{},areaResolved:false,
      createdAt:now,lastAt:now,expiresAt:now+Math.max(duration,visualLifetime)
    });
    if(world.persistentAttacks.length>40)world.persistentAttacks.splice(0,world.persistentAttacks.length-40);
  }
  if(stats.ultimate){
    for(const [fusionSlot,sourceId] of (profile.fusion?.[weapon.id]?.effects||[]).slice(0,2).entries()){
      const source=itemById(sourceId);if(source?.slot!=='weapon')continue;
      const sourceQuality=weaponQuality(source),full=attackStats(source,1);
      const radius=Math.max(.5,full.radius*sourceQuality.radius*.5);
      const range=Math.max(1,Math.min(stats.range,full.range*sourceQuality.range)*.5);
      const echoChannel=channel&&isChannelStaff(source);
       const secondary={...full,range,radius:echoChannel?Math.max(.3,forwardCastRadius(source,sourceQuality,full.radius,true)*.5):radius};
      // A fused pan/whip retains its 20% echo budget but inherits the
      // same per-weapon footprint shrink as a separately equipped one.
      const echoFactor=/^pan-[1-5]$/.test(source.id)?.5:/^whip-[1-5]$/.test(source.id)?.2:1;
      secondary.range=+(secondary.range*echoFactor).toFixed(3);
      secondary.radius=+(secondary.radius*echoFactor*(/^whip-[1-5]$/.test(source.id)?1.5:1)).toFixed(3);
      const echoArea=source.id==='goldfish'?null:chargedArea(source,origin,direction,secondary,groundForSpell,echoChannel);
      if(echoArea?.mode==='area'&&area?.visualCenter&&source.family!=='whip'){
        echoArea.center=[...area.center];echoArea.visualCenter=[...area.visualCenter];
      }
      const exotic=source.id==='fan'?'fan':source.id==='giraffe'?'giraffe':source.id==='goldfish'?'goldfish':null;
      const flight=projectileFlightMs(source,true);
      const duration=exotic==='goldfish'?Math.round(GOLDFISH_SWIM_MS*sourceQuality.duration):
        exotic==='giraffe'?2300:exotic==='fan'?Math.round((1400+sourceQuality.tier*850)*sourceQuality.duration):
        Math.max(flight,visibleCollisionLifetimeMs(source,true));
      // Sniper fusion echo must not exceed 30% of the original sniper
       // ultimate's damage; it also cannot cause instant-lethal headshots.
       const balancedSniper=source.id==='black-cat'?fusionSniperEchoDamage(source):null;
       const echoId=id(),echoDamage=balancedSniper?.damage??+(full.damage*.2).toFixed(3);
      const echoPvP=balancedSniper?.pvpDamage??+(pvpShotDamage(source,full,sourceQuality)*.2).toFixed(3);
      const secondaryPellets=source.pattern==='scatter'?calicoPellets(direction,true,now):null;
      world.persistentAttacks.push({id:echoId,kind:exotic||'projectile',echo:true,fusionSlot,channel:echoChannel,owner:actor.key,weapon:source.id,
        origin:[...origin],direction:[...direction],range:secondary.range,radius:secondary.radius,area:echoArea,
        damage:echoDamage,pvpDamage:echoPvP,charge:1,qualityDuration:sourceQuality.duration*.2,
        tier:sourceQuality.tier,flightMs:flight,hitTimes:{},hits:[],pelletHits:{},areaResolved:false,
        pellets:secondaryPellets?.map(v=>({...v,radius:v.radius*sourceQuality.visual*.5}))||null,
        outHits:[],backHits:[],fanHits:{},fishHits:[],
        createdAt:now,lastAt:now,expiresAt:now+duration});
      fusionEchoes.push({id:echoId,owner:actor.key,fusionSlot,origin:[...origin],direction:[...direction],
        weapon:source.id,family:source.family,color:source.color,charge:1,ultimate:true,channel:echoChannel,
        range:secondary.range,radius:secondary.radius,area:echoArea,qualityTier:sourceQuality.tier,
        qualityScale:sourceQuality.visual*.5,qualityDuration:sourceQuality.duration,
        pellets:secondaryPellets?.map(v=>v.direction)||null,
        fusionEcho:true,echoPower:.2,time:now});
    }
    if(world.persistentAttacks.length>44)world.persistentAttacks.splice(0,world.persistentAttacks.length-44);
  }
  const hit=null,hits=[],monsterHit=null,monsterHits=[];
  let structureHit=null,structureDestroyed=null;
  const structureHits=[],structureDestroyedEvents=[];
  // Evaluate builds regardless of hits on characters/monsters. Area attacks
  // reach every matching structure; directional attacks hit the nearest one.
  const candidates=(world.structures||[]).filter(v=>v.owner!=='temple').map(v=>{
   const point=[v.position[0],v.position[1]+structureHeight(v)*.5,v.position[2]],along=project(origin,direction,point);
   const inside=area&&['area','sector'].includes(area.mode)?insideChargedArea(area,point,structureRadius(v)):along>0&&along<stats.range&&perpendicular(origin,direction,point,along)<(weapon.pattern==='scatter'?.65+along*(stats.ultimate?.56:.32):stats.radius)+structureRadius(v);
   return {v,along,inside};
  }).filter(v=>v.inside).sort((a,b)=>a.along-b.along);
  for(const {v:structure} of (area&&['area','sector'].includes(area.mode)?candidates:candidates.slice(0,1))){
   const damage=Math.max(8,Math.round((stats.damage+bonus*.1)*.7));
   structure.maxHp??=structure.kind==='house'?220:structure.kind==='tree'?90:140;
   structure.hp=Math.max(0,structure.hp-damage);
   const event={id:id(),structureId:structure.id,kind:structure.kind,position:[...structure.position],hp:structure.hp,maxHp:structure.maxHp,damage,time:now};
   structureHit??=event;structureHits.push(event);
   if(structure.hp===0){const destroyed=structureEvent(structure,now);structureDestroyed??=destroyed;structureDestroyedEvents.push(destroyed);world.structures.splice(world.structures.indexOf(structure),1);}
  }
  return {structureHit,structureDestroyed,structureHits,structureDestroyedEvents,attackEvent:{id:id(),owner:actor.key,origin,direction,aimPoint:weapon.firstPerson?origin.map((v,i)=>v+direction[i]*stats.range):null,impactPoint:monsterHit?.position||(hit?.target?(()=>{const p=(context.actors||[]).find(a=>a.key===hit.target)?.position;return p?[p[0],p[1]+1,p[2]]:null;})():null),weapon:weapon.id,family:weapon.family,color:weapon.color,charge,combo,area,qualityTier:quality.tier,qualityScale:quality.visual,qualityDuration:quality.duration,channel,pellets:pellets?.map(p=>p.direction)||null,fusionEffects:profile.fusion[weapon.id]?.effects||[],fusionEchoes,flightMs:projectileFlightMs(weapon,stats.ultimate,stats.range),...stats,time:now},hit,hits,monsterHit,monsterHits:monsterHits.map(x=>x.result)};
}

function applyMonsterImpactReaction(player,target,skill,now){
 if(!player||(player.admin&&player.gmInvincible!==false)||(player.spawnProtectedUntil||0)>now||player.hp<=0)return;
  if(skill?.motion==='freeze'){
   // Apply an authoritative 80% movement slow for precisely two seconds.
   // Never use the full immobilising "freeze" status for this ability.
   player.effects??={};
   player.effects.slow={owner:'monster',power:.8,until:now+2000,next:now+1000};
   return;
  }
  if(skill?.motion!=='stomp')return;
 if(!player.hitReaction||player.hitReaction.time!==now)player.hitReaction={id:id(),time:now,stunMs:100,vector:[0,0,0]};
 const origin=skill.aim;
 let dx=target.position[0]-origin[0],dz=target.position[2]-origin[2];
 if(Math.hypot(dx,dz)<.01){dx=skill.aim[0]-skill.origin[0];dz=skill.aim[2]-skill.origin[2];}
 const length=Math.hypot(dx,dz)||1;
 player.effects??={};
 player.effects.stun={owner:'monster',power:0,until:now+1000,next:now+1000};
 Object.assign(player.hitReaction,{motion:skill.motion,stunMs:800,
  knockbackDistance:2.2,knockbackDurationMs:undefined,
  vector:[dx/length,.08,dz/length]});
}
function damagePlayer(world,sourceProfile,targetActor,amount,now,cause,dropPosition,kind='normal',hitPosition=null,forceKill=false,shotgunPellet=false,fixedDamage=false){
  const target=world.profiles[targetActor.key];if(!target||target.hp<=0||target.deadUntil>now)return null;
   if((target.spawnProtectedUntil||0)>now)return {target:targetActor.key,damage:0,defeated:false,immune:true};
  const stats=refreshStats(world,target,now);if(target.admin&&target.gmInvincible!==false){target.hp=target.maxHp;return {target:targetActor.key,damage:0,defeated:false,immune:true};}
  const armor=itemById(target.equipment.armor),reduction=Math.min(.65,(armor?.defense||0)/100);
  // The frying pan's self-damage is exactly 15 HP, not armour/shield
  // adjusted; it remains a genuine self-inflicted hazard even for the GM.
  let damage=fixedDamage?Math.max(0,+Number(amount).toFixed(1)):
    Math.max(1,+((amount)*(forceKill?1:1-reduction)*(forceKill?1:stats.defense)*(1+(effectActive(target,'soaked',now)?.power||0))).toFixed(1));
  if(forceKill)damage=Math.max(damage,target.hp); // A verified sniper headshot ignores armour and shields.
  if(shotgunPellet)damage=+Math.max(5,Math.min(20,damage)).toFixed(1); // Per pellet after armour; shields still absorb.
   if(target.shield&&!forceKill&&!fixedDamage){const absorbed=Math.min(target.shield.hp,damage);target.shield.hp-=absorbed;target.shield.lastHit=now;damage-=absorbed;}
  const hpLost=Math.min(target.hp,damage);target.hp=Math.max(0,target.hp-hpLost);if(hpLost>0){const from=dropPosition||targetActor.position,dx=targetActor.position[0]-from[0],dz=targetActor.position[2]-from[2],length=Math.hypot(dx,dz)||1;target.hitReaction={id:id(),time:now,stunMs:100,vector:[dx/length,0,dz/length]};}
  recordTempleDamage(world,{amount:damage,kind,position:hitPosition||[targetActor.position[0],targetActor.position[1]+1,targetActor.position[2]],owner:sourceProfile?.key,target:targetActor.key},now);
  if(target.hp>0)return {target:targetActor.key,damage,defeated:false};
  target.deadUntil=now+5_000;target.lastKilledBy={key:sourceProfile?.key||null,name:cause==='monster'?'Art Master':sourceProfile?.name||(cause==='collector'?'COLLECTOR':'ENVIRONMENT'),time:now};
  world.killEvents??=[];world.killEvents.push({id:id(),time:now,killerKey:sourceProfile?.key||null,killerName:target.lastKilledBy.name,victimKey:target.key,victimName:target.name||targetActor.name||'PLAYER',cause});if(world.killEvents.length>24)world.killEvents.splice(0,world.killEvents.length-24);
  releasePlayerWorldState(world,targetActor.key,now);if(sourceProfile&&sourceProfile.key!==target.key)addXp(sourceProfile,60);const lost=Math.floor(target.wallet*ECONOMY.deathCoinFraction);target.wallet-=lost;
  if(lost>0)world.groundDrops.push({id:id(),kind:'coin',amount:lost,position:[...dropPosition],owner:targetActor.key,ownerLockedUntil:now+2_000,createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs});
  return {target:targetActor.key,damage,defeated:true,lostCoins:lost,cause};
}

function monsterHit(world,profile,actor,body,now,rng){
  const monster=world.monster;if(!monster.active)return {error:'No monster is active'};if(distance2d(actor.position,monster.position)>20)return {error:'Move closer to the monster'};
  const weapon=itemById(profile.equipment.weapon)||itemById(STARTER_LOADOUT.weapon);if(now-profile.lastAttackAt<weapon.cooldown)return {error:'Weapon is recovering'};profile.lastAttackAt=now;const result=damageMonster(world,profile,weapon.damage+(profile.fusion[weapon.id]?.bonus||0),now,rng);return result.defeated?{notice:'Monster defeated · loot dropped',monsterHit:result}:{notice:`${Math.ceil(monster.hp)} HP remaining`,monsterHit:result};
}

function build(world,profile,actor,body,now,rng){
  const kind=String(body.kind||''),cost=ECONOMY.buildCosts[kind];if(!cost)return {error:'Unknown structure'};if(world.structures.length>=80)return {error:'Temple build limit reached'};
  if(world.structures.filter(entry=>entry.owner===actor.key).length>=12)return {error:'Personal build limit reached'};
  const position=body.position;if(!validBuildPosition(world,actor,position))return {error:'Invalid build position'};
  if(!spend(profile,cost,world))return {error:'Not enough coins'};const structure={id:id(),kind,surface:typeof body.surface==='string'?body.surface:null,variant:Math.floor(rng()*4),position:position.map(n=>+n.toFixed(2)),rotation:+(Number(body.rotation)||0).toFixed(3),owner:actor.key,hp:kind==='house'?220:kind==='tree'?90:140,maxHp:kind==='house'?220:kind==='tree'?90:140,createdAt:now};world.structures.push(structure);return {notice:`Built ${kind}`,structure};
}
function destroy(world,profile,actor,body,now){const structure=world.structures.find(entry=>entry.id===body.structureId);if(!structure)return {error:'Structure is gone'};if(distance2d(actor.position,structure.position)>12)return {error:'Move closer to the structure'};const weapon=itemById(profile.equipment.weapon)||itemById(STARTER_LOADOUT.weapon);if(now-profile.lastAttackAt<weapon.cooldown)return {error:'Weapon is recovering'};profile.lastAttackAt=now;const damage=Math.max(8,weapon.damage+(profile.fusion[weapon.id]?.bonus||0));structure.maxHp??=structure.kind==='house'?220:structure.kind==='tree'?90:140;structure.hp=Math.max(0,structure.hp-damage);const structureHit={id:id(),structureId:structure.id,kind:structure.kind,position:[...structure.position],hp:structure.hp,maxHp:structure.maxHp,damage,time:now};let structureDestroyed=null;if(structure.hp<=0){structureDestroyed=structureEvent(structure,now);world.structures.splice(world.structures.indexOf(structure),1);}return {notice:structureDestroyed?'Structure destroyed':`${Math.ceil(structure.hp)} structure HP`,structureDestroyed,structureHit,attackEvent:{id:id(),owner:actor.key,origin:actor.position,direction:normalDirection(body.direction)||[0,0,-1],weapon:weapon.id,time:now}};}

function removeStructure(world,profile,actor,body,now){
  const structure=(world.structures||[]).find(s=>s.id===body.structureId);
  if(!structure)return {error:'Structure is gone'};
  if(structure.owner!==actor.key&&!profile.admin)return {error:'Only the creator or GM can remove this structure'};
  world.structures.splice(world.structures.indexOf(structure),1);
  return {notice:'Structure removed',structureDestroyed:structureEvent(structure,now)};
}

function plant(world,profile,actor,body,now){const text=String(body.text||'').trim();if((!text&&!body.media)||text.length>500)return {error:'Plant message must contain 1–500 characters'};if(distance2d(actor.position,[0,0,0])>SAFE_ZONE.radius+3)return {error:'Write beside the central plant'};const parent=typeof body.parentId==='string'?world.plants.find(entry=>entry.id===body.parentId):null;if(body.parentId&&!parent)return {error:'Parent plant no longer exists'};const seed=hashString(`${profile.key}:${now}`),angle=(seed%628)/100,radius=parent ? .7 : Math.min(5,Math.max(1.4,distance2d(body.position,[0,0,0]))),base=parent?.position||body.position||actor.position,position=parent?[clamp(base[0]+Math.cos(angle)*radius,-5,5),0,clamp(base[2]+Math.sin(angle)*radius,-5,5)]:[clamp(Number(base?.[0])||0,-5,5),0,clamp(Number(base?.[2])||0,-5,5)];const entry={id:id(),author:profile.name,text,media:body.media||null,position,parentId:parent?.id||null,createdAt:now};world.plants.push(entry);if(Array.isArray(profile.writeJourney?.landing)){profile.lastWriteLanding=[...profile.writeJourney.landing];profile.lastWriteLandingAt=now;}profile.writeJourney=null;if(world.plants.length>500)world.plants.shift();return {notice:parent?'Reply branch planted':'Message planted',plant:entry};}

export function releasePlayerWorldState(world,playerKey,now=Date.now()){
  let changed=false;if(world.profiles?.[playerKey]?.writeJourney){world.profiles[playerKey].writeJourney=null;changed=true;}for(const art of Object.values(world.artworks||{}))if(art.holder===playerKey){art.holder=null;art.throwEvent=null;art.availableAt=now+ARTWORK_RESPAWN_MS;changed=true;}return changed;
}

function addXp(profile,amount){
  profile.xp=(profile.xp||0)+amount;let needed=profile.level*100;while(profile.xp>=needed){profile.xp-=needed;profile.level++;profile.maxHp=100+(profile.level-1)*4;profile.hp=Math.min(profile.maxHp,profile.hp+12);needed=profile.level*100;}
}

export function canPlaceArtworkAt(world,actorPosition,position){
  // Unlike buildings, movable artworks can stand near art display discs.
  if(!insideArena(position,-2)||insideSafeZone(position)||distance2d(actorPosition,position)>12)return false;
  return true;
}

export function canBuildAt(world,actorPosition,position){
  if(!insideArena(position,-3)||insideSafeZone(position)||distance2d(actorPosition,position)>12)return false;
  // The removed black pond no longer reserves a build-exclusion area.
  if(PLAYER_SPAWNS.some(spawn=>distance2d(position,spawn)<5.5))return false;
  if(PLATFORMS.some(platform=>distance2d(position,platform.position)<Math.max(platform.size[0],platform.size[2])*.5+3.2))return false;
  if((world.structures||[]).some(structure=>distance2d(position,structure.position)<(structure.kind==='house'?5.5:structure.kind==='tree'?2.4:3.5)))return false;
  return true;
}

function validBuildPosition(world,actor,position){return canBuildAt(world,actor.position,position);}

// Authoritative 1 HP/s while flower-crown's authenticated sustained cast
// is active. No free HP from ordinary attacks, inactive/expired channels,
// repeated network packets, or from visuals and client-side clocks.
export function tickBloomChannelHeal(profile,now){
 const item=itemById(profile?.channelWeapon);
 if(!item||item.family!=='petal'||!isChannelStaff(item)||
    profile.equipment?.weapon!==item.id||
    !profile.channelStartedAt||now-(profile.lastChannelPulseAt||0)>Math.max(2100,item.cooldown*2+200)||
    profile.hp<=0||profile.deadUntil>now)return 0;
 const since=Number(profile.lastBloomHealAt)||now;
 const pulses=Math.max(0,Math.floor((now-since)/1000));
 if(!pulses)return 0;
 profile.lastBloomHealAt=since+pulses*1000;
 const restored=Math.min(pulses,Math.max(0,profile.maxHp-profile.hp));
 profile.hp+=restored;
 return restored;
}
export function tickWorld(world,{now=Date.now(),rng=Math.random,activeFighters=0,actors=[]}={}){
  migrateWorld(world,now);
  // The same authoritative damage/death/shield pipeline used by combat
  // processes Collector bullets. Fixed 50 HP ignores armour and shields,
  // but respects respawn protection and GM invincibility.
  let changed=tickCollector(world,actors,now,rng,(actor,from,damage)=>
   damagePlayer(world,null,actor,damage,now,'collector',from,'collector-shot',
    [actor.position[0],actor.position[1]+1.15,actor.position[2]],false,false,true)
  );
  for(const profile of Object.values(world.profiles||{}))
   changed=tickBloomChannelHeal(profile,now)>0||changed;
  changed=tickPersistentAttacks(world,actors,now,rng)||changed;
  if(world.channelContactLocks)for(const [key,expiry] of Object.entries(world.channelContactLocks))
   if(expiry<now-2000)delete world.channelContactLocks[key];
  if(world.monster?.active)changed=tickStatus(world.monster,now,(owner,amount)=>damageMonster(world,world.profiles[owner],amount,now,rng))||changed;
  for(const mob of world.monsters||[])if(mob?.active)changed=tickStatus(mob,now,(owner,amount)=>damageMonster(world,world.profiles[owner],amount,now,rng,'status',mob))||changed;
  for(const target of actors){const p=world.profiles[target.key];if(p&&!(p.admin&&p.gmInvincible!==false)&&(p.spawnProtectedUntil||0)<=now&&p.hp>0)changed=tickStatus(p,now,(owner,amount)=>damagePlayer(world,world.profiles[owner],target,Math.min(amount,2),now,
    (owner==='monster'||world.monster?.id===owner||(world.monsters||[]).some(m=>m.id===owner))?'monster':'status',target.position))||changed;}
  world.groundDrops=world.groundDrops.filter(drop=>drop.expiresAt>now);if(world.groundDrops.length>ECONOMY.maxGroundDrops)world.groundDrops.splice(0,world.groundDrops.length-ECONOMY.maxGroundDrops);
  if(activeFighters>0){changed=replenishHearts(world,now)||changed;changed=spawnMonsterPack(world,now,rng)||changed;}
  if(activeFighters>0&&now>=world.nextGroundDropAt&&world.groundDrops.length<ECONOMY.maxGroundDrops){const point=GROUND_DROP_POINTS[Math.floor(rng()*GROUND_DROP_POINTS.length)],rolled=groundDropRoll(rng);world.groundDrops.push({id:id(),...rolled,position:[...point],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs});world.nextGroundDropAt=now+ECONOMY.groundSpawnMinMs+rng()*(ECONOMY.groundSpawnMaxMs-ECONOMY.groundSpawnMinMs);world.activity.itemsSpawned++;changed=true;}
  if(activeFighters>0&&!world.monster.active&&now>=world.monster.nextSpawnAt){const spawn=MONSTER_SPAWNS[Math.floor(rng()*MONSTER_SPAWNS.length)],variant=['warden','drowned','signal'][Math.floor(rng()*3)],maxHp={warden:420,drowned:520,signal:360}[variant];world.monster={active:true,id:id(),variant,position:[...spawn],hp:maxHp,maxHp,generation:(world.monster.generation||0)+1,spawnedAt:now,nextAttackAt:now+2_000,nextSpawnAt:now+ECONOMY.monsterIntervalMs};changed=true;}
  if(world.monster.active){const monster=world.monster;monster.model=ISLAND_ENEMIES.includes(monster.model)?monster.model:ISLAND_ENEMIES[(monster.generation||0)%ISLAND_ENEMIES.length];if(insideArtSanctuary(monster.position)){monster.position=[...MONSTER_SPAWNS[(monster.generation||0)%MONSTER_SPAWNS.length]];monster.skills=[];}monster.attackStyles=true;monster.level??=1+(monster.generation||0)%12;monster.damage=12+monster.level*2;monster.bodyHeight=ENEMY_HEIGHT;monster.bodyRadius=ENEMY_RADIUS;monster.position[1]=0;const fighters=actors.filter(a=>a.role==='fighter'&&world.profiles[a.key]?.hp>0&&!insideArtSanctuary(a.position));monster.lastPosition=[...monster.position];advanceIslandEnemy(monster,fighters,now,{disabled:!!monster.panBlastFlight||!!monster.whipPull||!!effectActive(monster,'stun',now)||!!effectActive(monster,'root',now)||!!effectActive(monster,'freeze',now),silenced:!!effectActive(monster,'paralysis',now),slow:effectActive(monster,'root',now)?1:effectActive(monster,'slow',now)?.power||0,move:(target,distance)=>{
 const confused=effectActive(monster,'confuse',now);
 if(confused){
  const angle=(now/210+(monster.generation||0)*2.4)%(Math.PI*2);
  return moveMonster(world,monster,[monster.position[0]+Math.cos(angle)*8,monster.position[1],monster.position[2]+Math.sin(angle)*8],distance);
 }
 return moveMonster(world,monster,target,distance);
},hit:(target,amount,skill)=>{const result=damagePlayer(world,null,target,skill?.motion==='venom'?5:amount*(1-(effectActive(monster,'weak',now)?.power||0)),now,'monster',target.position,'normal',null,false,false,skill?.motion==='venom');applyMonsterImpactReaction(world.profiles[target.key],target,skill,now);return result;}});if(!monster.panBlastFlight&&!monster.whipPull&&effectActive(monster,'confuse',now)){
 const angle=(now/217+(monster.generation||0)*1.73)%(Math.PI*2);
 moveMonster(world,monster,[monster.position[0]+Math.cos(angle)*8,monster.position[1],monster.position[2]+Math.sin(angle)*8],.21);
}else if(!monster.panBlastFlight&&!monster.whipPull&&!effectActive(monster,'root',now)&&!effectActive(monster,'freeze',now)&&
 !monster.aggroTarget&&!fighters.some(a=>distance2d(a.position,monster.position)<18))
 patrolMonster(monster,now,rng,(target,distance)=>moveMonster(world,monster,target,distance));
 advancePanBlastMonster(monster,now);advanceWhipPullMonster(world,monster,now);changed=true;}
  if(activeFighters>0){
   for(const mob of world.monsters||[]){
    if(!mob?.active)continue;
    if(insideArtSanctuary(mob.position)){mob.position=[...MONSTER_SPAWNS[(mob.slot||0)%MONSTER_SPAWNS.length]];}
    mob.bodyHeight=ENEMY_HEIGHT;mob.bodyRadius=ENEMY_RADIUS;
    const fighters=actors.filter(a=>a.role==='fighter'&&world.profiles[a.key]?.hp>0&&!insideArtSanctuary(a.position));
    mob.lastPosition=[...mob.position];advanceIslandEnemy(mob,fighters,now,{disabled:!!mob.panBlastFlight||!!mob.whipPull||!!effectActive(mob,'stun',now)||!!effectActive(mob,'root',now)||!!effectActive(mob,'freeze',now),silenced:!!effectActive(mob,'paralysis',now),slow:effectActive(mob,'root',now)?1:effectActive(mob,'slow',now)?.power||0,
     move:(target,distance)=>{
       const confused=effectActive(mob,'confuse',now);
       if(confused){
        const angle=(now/210+(mob.generation||0)*2.4+(mob.id?.length||0))%(Math.PI*2);
        return moveMonster(world,mob,[mob.position[0]+Math.cos(angle)*8,mob.position[1],mob.position[2]+Math.sin(angle)*8],distance);
       }
       return moveMonster(world,mob,target,distance);
      },hit:(target,amount,skill)=>{const result=damagePlayer(world,null,target,skill?.motion==='venom'?5:amount*(1-(effectActive(mob,'weak',now)?.power||0)),now,'monster',mob.position,'normal',null,false,false,skill?.motion==='venom');applyMonsterImpactReaction(world.profiles[target.key],target,skill,now);return result;}});
    if(!mob.panBlastFlight&&!mob.whipPull&&effectActive(mob,'confuse',now)){
 const angle=(now/217+(mob.slot||0)*1.73)%(Math.PI*2);
 moveMonster(world,mob,[mob.position[0]+Math.cos(angle)*8,mob.position[1],mob.position[2]+Math.sin(angle)*8],.21);
}else if(!mob.panBlastFlight&&!mob.whipPull&&!effectActive(mob,'root',now)&&!effectActive(mob,'freeze',now)&&
 !mob.aggroTarget&&!fighters.some(a=>distance2d(a.position,mob.position)<18))
 patrolMonster(mob,now,rng,(target,distance)=>moveMonster(world,mob,target,distance));
    advancePanBlastMonster(mob,now);advanceWhipPullMonster(world,mob,now);changed=true;
   }
  }
  for(const profile of Object.values(world.profiles))if(profile.hp<=0&&profile.deadUntil<=now){
   const seat=actors.find(actor=>actor.key===profile.key)?.seat;
   reviveProfile(profile,now,seat);changed=true;
  }
  if(changed)world.revision=(world.revision||0)+1;return changed;
}

// Server-authoritative tall hit volumes cover the fully scaled avatar, not
// the original 1.575m model. Old/current positions bridge 2Hz interpolation.
function rayCylinderDistance(origin,direction,range,position,radius,height){
 const dx=origin[0]-position[0],dz=origin[2]-position[2];
 const a=direction[0]**2+direction[2]**2;
 let enter=0,exit=range;
 const c=dx*dx+dz*dz-radius*radius;
 if(a>1e-8){
  const b=2*(dx*direction[0]+dz*direction[2]),disc=b*b-4*a*c;
  if(disc<0)return null;
  const root=Math.sqrt(disc);
  enter=Math.max(0,(-b-root)/(2*a));exit=Math.min(range,(-b+root)/(2*a));
  if(enter>exit)return null;
 }else if(c>0)return null;
 const lo=position[1]-.4,hi=position[1]+height+.4;
 if(Math.abs(direction[1])<1e-6)return origin[1]>=lo&&origin[1]<=hi?enter:null;
 const y0=(lo-origin[1])/direction[1],y1=(hi-origin[1])/direction[1];
 enter=Math.max(enter,Math.min(y0,y1));exit=Math.min(exit,Math.max(y0,y1));
 return enter<=exit?enter:null;
}
function monsterRayDistance(origin,direction,range,monster,bulletRadius=0){
 const r=(monster.bodyRadius||ENEMY_RADIUS)+bulletRadius+.24;
 let first=rayCylinderDistance(origin,direction,range,monster.position,r,monster.bodyHeight||ENEMY_HEIGHT);
 if(Array.isArray(monster.lastPosition)&&Math.hypot(monster.lastPosition[0]-monster.position[0],monster.lastPosition[2]-monster.position[2])<7){
  const old=rayCylinderDistance(origin,direction,range,monster.lastPosition,r,monster.bodyHeight||ENEMY_HEIGHT);
  if(old!==null)first=first===null?old:Math.min(first,old);
 }
 return first;
}
function rayHitsMonster(origin,direction,range,monster,radius){
 return monsterRayDistance(origin,direction,range,monster,Math.max(0,radius-(monster.bodyRadius||ENEMY_RADIUS)))!==null;
}
function normalDirection(value){if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))return null;const length=Math.hypot(...value);if(length<.5||length>1.5)return null;return value.map(n=>n/length);}
function project(origin,direction,point){return (point[0]-origin[0])*direction[0]+(point[1]-origin[1])*direction[1]+(point[2]-origin[2])*direction[2];}
function perpendicular(origin,direction,point,along){return Math.hypot(point[0]-origin[0]-direction[0]*along,point[1]-origin[1]-direction[1]*along,point[2]-origin[2]-direction[2]*along);}
function structureRadius(structure){return structure.kind==='house'?3.4:structure.kind==='tree'?1.4:['wall','bar'].includes(structure.kind)?3.3:1.7;}
function structureHeight(structure){return structure.kind==='house'?3.8:structure.kind==='tree'?4:structure.kind==='column'?4:structure.kind==='platform'?.7:2;}
function structureEvent(structure,now){return {id:structure.id,kind:structure.kind,variant:structure.variant||0,position:[...structure.position],rotation:structure.rotation||0,surface:structure.surface||null,time:now};}

// No horizontal side collider exists on a disc or stair. An impact impulse
// is measured from the actual ground explosion centre, not from the caster.
function advancePanBlastMonster(mob,now){
 const flight=mob?.panBlastFlight;
 if(!flight||!mob.active)return false;
 const sample=samplePanBlastPosition(flight,now);
 mob.lastPosition=[...mob.position];
 mob.position=sample.position;
 if(sample.completed)delete mob.panBlastFlight;
 return true;
}

// A caught monster is moved by the same half-walk-speed vortex as players.
// Use server elapsed time rather than render frames; never let AI overwrite it.
function advanceWhipPullMonster(world,mob,now){
 const pull=mob?.whipPull;
 if(!pull||!mob.active)return false;
 const until=pull.time+pull.durationMs;
 const from=Math.max(pull.time,pull.updatedAt||pull.time);
 const to=Math.min(now,until);
 if(to>from){
  const center=[pull.center[0],mob.position[1],pull.center[1]];
  const distance=Math.hypot(center[0]-mob.position[0],center[2]-mob.position[2]);
  if(distance>.0001)moveMonster(world,mob,center,
   Math.min(distance,WHIP_PULL_SPEED*(to-from)/1000));
 }
 pull.updatedAt=to;
 if(now>=until)delete mob.whipPull;
 return true;
}

function blastDirection(center,position,fallback=[0,0,1]){
 const dx=position[0]-center[0],dz=position[2]-center[2],length=Math.hypot(dx,dz);
 if(length>.0001)return [dx/length,0,dz/length];
 const fallbackLength=Math.hypot(fallback[0],fallback[2])||1;
 return [-fallback[0]/fallbackLength,0,-fallback[2]/fallbackLength];
}

// Timed server-owned abilities: a returning giraffe can hit each target once
// on the outward leg AND once on its return. Four independent fan vortices
// wander for longer at higher qualities. Never trust a client hit report.
function tickPersistentAttacks(world,actors,now,rng){
 const attacks=world.persistentAttacks||[];
 if(!attacks.length)return false;
 let changed=false;
 const targets=[...(world.monster?.active?[{kind:'monster',value:world.monster}]:[]),
  ...(world.monsters||[]).filter(v=>v.active).map(value=>({kind:'monster',value})),
  ...actors.filter(v=>v.role==='fighter'&&!insideSafeZone(v.position)).map(value=>({kind:'player',value}))];
 for(const fx of attacks){
  // Persistent hazards must not cause a final phantom hit AFTER the visual
  // has vanished. Ordinary short projectiles still sweep on a late tick.
  if(fx.kind==='projectile'&&fx.flightMs&&
     fx.expiresAt>fx.createdAt+fx.flightMs&&now>=fx.expiresAt){
    fx.lastAt=now;continue;
  }
  const flight=fx.kind==='projectile'&&(Number(fx.flightMs)||0)>0?fx.flightMs:fx.expiresAt-fx.createdAt;
  const prev=Math.max(0,Math.min(1,(fx.lastAt-fx.createdAt)/flight));
  const next=Math.max(0,Math.min(1,(now-fx.createdAt)/flight));
  const owner=world.profiles[fx.owner];
  if(!owner){fx.lastAt=now;continue;}
  if(fx.kind==='projectile'){
   const weapon=itemById(fx.weapon);
   if(!weapon){fx.lastAt=now;continue;}
   const panBlast=!fx.echo&&/^pan-[1-5]$/.test(weapon.id)&&fx.charge>=1;
   const alreadyHit=new Set(fx.hits||[]);
   const outcome=(target,position,impact,pellet=null,along=0)=>{
    const enemy=target.value,key=(enemy.id||enemy.key),isPlayer=target.kind==='player';
    if(enemy.key===fx.owner||(isPlayer&&insideSafeZone(enemy.position)))return false;
    const hitKey=pellet===null?key:pellet+':'+key;
    const interval=contactDamageIntervalMs(weapon);
    fx.hitTimes??={}; // Per visible projectile, not just the first contact.
    const channelKey=fx.owner+':'+weapon.id+':'+(fx.echo?'echo'+(fx.fusionSlot??0):'main')+':'+hitKey;
    const due=fx.channel?(world.channelContactLocks?.[channelKey]||0):(fx.hitTimes[hitKey]||0);
    if(now<due)return false;
    const modifiers=directHitModifiers(weapon,{origin:fx.origin,direction:pellet===null?fx.direction:fx.pellets[pellet].direction,range:fx.range},
      {...enemy,island:true,visualScale:isPlayer?1:ENEMY_HEIGHT/1.575},position,now,rng);
    const power=isPlayer?fx.pvpDamage:fx.damage;
    const critical=isPlayer?Math.min(1.14,modifiers.multiplier):modifiers.multiplier;
    const proximity=clamp(1-along/Math.max(1,fx.range),0,1);
    const spread=pellet===null?1:(isPlayer?(.76+.48*proximity)*(.28+1.12*rng()):1.35*(1+1.7*proximity)*(.55+2.45*rng()));
    const rawDamage=power*critical*spread/(pellet===null?1:fx.pellets.length);
    // No uncharged weapon may bypass the 8-hit baseline through a lucky
    // crit or a ten-ball shotgun burst. The pellets remain individually
    // damaging, with a full 5x+ per-pellet random damage window.
    const pvpCap=weapon.id==='black-cat'?(fx.charge>=1?150:96):
      fx.charge>=1?(pellet===null?29.5:2.95):(pellet===null?13.9:1.39);
    const shotgunPellet=!fx.echo&&isPlayer&&weapon.pattern==='scatter'&&pellet!==null;
    const damage=shotgunPellet?5+15*rng():isPlayer?Math.min(rawDamage,pvpCap):rawDamage;
    const lethalHeadshot=!fx.echo&&isPlayer&&weapon.id==='black-cat'&&sniperHitsHead(
     fx.origin,fx.direction,fx.range,enemy.position);
    const hitKind=lethalHeadshot?(modifiers.critical?'critical-headshot':'headshot'):modifiers.kind;
    let applied;
    if(isPlayer)applied=damagePlayer(world,owner,enemy,damage,now,'pvp',fx.origin,hitKind,position,lethalHeadshot,shotgunPellet);
    else applied=damageMonster(world,owner,damage,now,rng,modifiers.kind,enemy,position);
    if(applied&&!applied.immune){
     if(fx.channel){
      world.channelContactLocks??={};world.channelContactLocks[channelKey]=now+interval;
     }else fx.hitTimes[hitKey]=now+interval;
     if(pellet===null&&!alreadyHit.has(key)){alreadyHit.add(key);fx.hits.push(key);}
     else if(pellet!==null){const history=fx.pelletHits[pellet]??=[];if(!history.includes(key))history.push(key);}
    }
    if(applied&&!applied.immune&&!applied.defeated&&fx.charge>=1){
     // Elemental debuffs and elemental damage occur only on charged impact.
     const statusKey=enemy.id||enemy.key;
     if(!(fx.statusHits||[]).includes(statusKey)){
      fx.statusHits??=[];fx.statusHits.push(statusKey);
      const targetStatus=isPlayer?world.profiles[enemy.key]:enemy;
      if(fx.echo)applyElementalHit(targetStatus,owner,weapon,now,.2);
      else applyStatus(world,owner,targetStatus,weapon,{
       direction:fx.direction,charge:fx.charge,
       damage:isPlayer?Math.min(12,fx.pvpDamage):fx.damage,
       qualityDuration:fx.qualityDuration
      },now);
     }
    }
    if(applied&&!applied.immune&&!applied.defeated&&!fx.echo&&fx.charge>=1&&
       /^whip-[1-5]$/.test(weapon.id)&&fx.area?.mode==='area'&&
       !(fx.pullHits||[]).includes(key)){
      const victim=isPlayer?world.profiles[enemy.key]:enemy;
      if(victim){
       // Exactly one tier-timed pull per player OR monster per cast; later
       // damage-over-time contacts cannot refresh the suction window.
       fx.pullHits??=[];fx.pullHits.push(key);
       const whipPull={id:id(),time:now,center:[fx.area.center[0],fx.area.center[2]],
        durationMs:whipPullDurationMs(fx.tier||weapon.tier),speed:WHIP_PULL_SPEED};
       victim.whipPull=whipPull;
       // Preserve roots cast by OTHER players while clearing the whip's
       // own root; monsters are pulled server-side despite their AI status.
       if(victim.effects?.root?.owner===fx.owner){
        delete victim.effects.root;
        if(victim.effectLocks?.root)delete victim.effectLocks.root;
       }
       if(isPlayer){
        if(victim.hitReaction?.time===now)
         Object.assign(victim.hitReaction,{whipPull,stunMs:0});
        else victim.hitReaction={id:id(),time:now,stunMs:0,vector:[0,0,0],whipPull};
       }
      }
    }
    return !!applied;
   };
   // Each travelling sphere uses its own independent ray. The server sweeps
   // all travelled segments, so no damage can occur before contact.
   const lanes=fx.pellets||[{direction:fx.direction,radius:fx.radius}];
   const segmentLength=Math.max(0,(next-prev)*fx.range);
   if(segmentLength>.00001&&fx.area?.mode!=='sector'&&!panBlast){
    lanes.forEach((pellet,index)=>{
     const start=fx.origin.map((v,j)=>v+pellet.direction[j]*prev*fx.range);
     for(const target of targets){
      const enemy=target.value;
      if(enemy.key===fx.owner)continue;
      const radius=pellet.radius;
      const t=target.kind==='player'
       ?rayCylinderDistance(start,pellet.direction,segmentLength,enemy.position,1.02+radius,2.35)
       :monsterRayDistance(start,pellet.direction,segmentLength,enemy,radius);
      if(t===null)continue;
      const impact=start.map((v,j)=>v+pellet.direction[j]*t);
      const pos=target.kind==='player'?[enemy.position[0],enemy.position[1]+1,enemy.position[2]]:
        [enemy.position[0],enemy.position[1]+ENEMY_HEIGHT*.5,enemy.position[2]];
      if(outcome(target,pos,impact,fx.pellets?index:null,prev*fx.range+t))changed=true;
     }
    });
   }
   // The original tidal wave #33 takes 200ms to grow and 2.18s to advance.
   // Sweep the warned 90-degree sector only when its crest reaches each
   // enemy's physical body. Never grant an instantaneous cone-wide hit.
   if(fx.area?.mode==='sector'){
    const crest=f=>{
     const t=clamp((f*2.18-.2)/1.98,0,1);
     return t*t*(3-2*t)*fx.range;
    };
    const from=crest(prev),to=crest(next);
    if(to>from+.00001){
     for(const target of targets){
      const enemy=target.value,key=enemy.id||enemy.key;
      if(enemy.key===fx.owner)continue;
      const radius=target.kind==='player'?1.02:ENEMY_RADIUS;
      const center=target.kind==='player'
       ?[enemy.position[0],enemy.position[1]+1,enemy.position[2]]
       :[enemy.position[0],enemy.position[1]+ENEMY_HEIGHT*.5,enemy.position[2]];
      // A 6x human enemy is ~9.45m tall. An on-ground wave strikes
      // its legs first; checking the model's centre (4.7m above ground)
      // would incorrectly make a visibly touching crest miss entirely.
      const contactY=enemy.position[1]+(target.kind==='monster'?1.25:1);
      if(!insideChargedArea(fx.area,[center[0],contactY,center[2]],radius))continue;
      const along=(center[0]-fx.area.apex[0])*fx.area.forward[0]+
       (center[2]-fx.area.apex[2])*fx.area.forward[1];
      if(along+radius<from||along-radius>to)continue;
      if(outcome(target,center,center,null,along))changed=true;
     }
    }
   }
   // Ground-targeted charged area explosions are evaluated only once their
   // visible travel has completed; targets that have moved away evade damage.
   // Begin pan launch 200ms earlier than the former halfway detonation.
   // Damage and the authoritative flight impulse share that exact contact.
   if(fx.area?.mode==='area'&&next>=(panBlast?Math.max(0,.5-PAN_BLAST_DETONATION_ADVANCE_MS/flight):1)&&
      (!panBlast||!fx.areaResolved)){
     // The pan's explosion physically strikes midway through its expansion,
     // not after the entire travelling animation. It resolves exactly once.
     fx.areaResolved=true;
     const caster=panBlast?actors.find(a=>a.key===fx.owner&&a.role==='fighter'):null;
     const blastTargets=caster&&!targets.some(t=>t.value.key===caster.key)
      ?[...targets,{kind:'player',value:caster}]:targets;
    for(const target of blastTargets){
     const enemy=target.value,key=enemy.id||enemy.key;
     const self=panBlast&&enemy.key===fx.owner;
     if(enemy.key===fx.owner&&!self)continue;
     const pos=target.kind==='player'
      ?[enemy.position[0],enemy.position[1]+1,enemy.position[2]]:
       [enemy.position[0],enemy.position[1]+ENEMY_HEIGHT*.5,enemy.position[2]];
     // A ground-borne AoE physically touches a sixfold human model at
     // its legs first; testing only the torso centre at y=4.725 wrongly
     // rejects valid visible contact. Display digits on the torso instead.
     const groundContact=[pos[0],enemy.position[1]+(target.kind==='player'?1:1.25),pos[2]];
     if(!self&&!insideChargedArea(fx.area,groundContact,target.kind==='player'?1.02:ENEMY_RADIUS))continue;
     if(self){
      // Detonation always recoils back onto the caster, even when the
      // forward-placed explosion circle is beyond their current feet.
      // This bypasses armour and shields, but an enabled GM god-mode remains immune.
      const hit=damagePlayer(world,owner,enemy,15,now,'pan-self-blast',enemy.position,
       'pan-self-blast',pos,false,false,true);
      if(hit){
       const reaction=world.profiles[enemy.key]?.hitReaction;
       if(reaction)Object.assign(reaction,{vector:blastDirection(fx.area.center,enemy.position,fx.direction),
        knockbackDistance:fx.area.radius,panBlast:true,stunMs:100});
       changed=true;
      }
     }else if(outcome(target,pos,groundContact,null,fx.area.travel)){
      changed=true;
      if(panBlast&&target.kind==='player'){
       const reaction=world.profiles[enemy.key]?.hitReaction;
       if(reaction)Object.assign(reaction,{vector:blastDirection(fx.area.center,enemy.position,fx.direction),
        knockbackDistance:fx.area.radius,panBlast:true,stunMs:100});
      }else if(panBlast&&target.kind==='monster'&&enemy.active){
       const [x,,z]=blastDirection(fx.area.center,enemy.position,fx.direction);
       const nextPosition=[enemy.position[0]+x*fx.area.radius,enemy.position[1],
        enemy.position[2]+z*fx.area.radius];
       // Damage is authoritative at detonation; physical motion is animated
       // over the same original launch + three-bounce timeline as players.
       // Never teleport the monster to its landing point in one server tick.
       const safe=insideArena(nextPosition,-1)&&!insideArtSanctuary(nextPosition);
       delete enemy.whipPull;
       enemy.panBlastFlight={
        origin:[...enemy.position],vector:[x,0,z],
        distance:safe?fx.area.radius:0,startAt:now
       };
      }
     }
    }
   }
   // A persistent forward corridor remains dangerous only while its authored
   // ultimate effect is visible. Check actual target volumes on every tick.
   if(fx.area?.mode==='corridor'&&fx.charge>=1&&next>=1&&
      now<fx.expiresAt&&fx.expiresAt>fx.createdAt+flight){
    for(const target of targets){
     const enemy=target.value,key=enemy.id||enemy.key;
     if(enemy.key===fx.owner||(target.kind==='player'&&insideSafeZone(enemy.position)))continue;
     const dist=target.kind==='player'
      ?rayCylinderDistance(fx.origin,fx.direction,fx.range,enemy.position,1.02+fx.radius,2.35)
      :monsterRayDistance(fx.origin,fx.direction,fx.range,enemy,fx.radius);
     if(dist===null)continue;
     const center=[enemy.position[0],enemy.position[1]+(target.kind==='monster'?ENEMY_HEIGHT*.5:1),enemy.position[2]];
     if(outcome(target,center,center,null,dist))changed=true;
    }
   }
  }else if(fx.kind==='giraffe'){
   for(const [leg,lo,hi] of [['out',0,.5],['back',.5,1]]){
    const from=Math.max(prev,lo),to=Math.min(next,hi);
    if(to<=from)continue;
    const travel=p=>Math.sin(Math.PI*p)*fx.range; // same continuous path as the displayed giraffe
    const a=fx.origin.map((v,j)=>v+fx.direction[j]*travel(from));
    const b=fx.origin.map((v,j)=>v+fx.direction[j]*travel(to));
    const ray=b.map((v,j)=>v-a[j]),length=Math.hypot(...ray);
    if(length<.001)continue;
    const direction=ray.map(v=>v/length),seen=leg==='out'?fx.outHits:fx.backHits;
    for(const target of targets){
     const value=target.value;if(value.key===fx.owner||seen.includes(value.id||value.key))continue;
     if(target.kind==='player'&&insideArtSanctuary(value.position))continue;
     if(now<(fx.hitTimes?.[value.id||value.key]||0))continue;
     const contact=target.kind==='monster'?monsterRayDistance(a,direction,length,value,1.35*fx.radius):
      rayCylinderDistance(a,direction,length,value.position,1+fx.radius,2.35);
     if(contact===null)continue;
     seen.push(value.id||value.key);
     fx.hitTimes??={};fx.hitTimes[value.id||value.key]=now+contactDamageIntervalMs({id:'giraffe'});
     const center=[value.position[0],value.position[1]+(target.kind==='monster'?ENEMY_HEIGHT*.5:1),value.position[2]];
     const hit=target.kind==='monster'
      ?damageMonster(world,owner,fx.damage*.53,now,rng,leg==='out'?'boomerang-out':'boomerang-return',value,center)
      :damagePlayer(world,owner,value,(fx.pvpDamage||12)*.62,now,'boomerang',fx.origin,leg==='out'?'boomerang-out':'boomerang-return',center);
     if(hit&&!hit.immune&&!hit.defeated)applyElementalHit(
      target.kind==='monster'?value:world.profiles[value.key],owner,
      {family:'lightning',element:'electric'},now,fx.echo?.2:1);
     changed=true;
    }
   }
  }else if(fx.kind==='goldfish'){
   // The fish's swept server collider follows precisely the same straight
   // route, scale, and duration as its visible Three.js body.
   const length=(next-prev)*fx.range;
   if(length>.001){
    const origin=fx.origin.map((v,j)=>v+fx.direction[j]*prev*fx.range);
    for(const target of targets){
     const value=target.value,key=value.id||value.key;
     if(key===fx.owner||now<(fx.hitTimes?.[key]||0))continue;
     if(target.kind==='player'&&insideArtSanctuary(value.position))continue;
     const contact=target.kind==='monster'
      ?monsterRayDistance(origin,fx.direction,length,value,fx.radius)
      :rayCylinderDistance(origin,fx.direction,length,value.position,1.02+fx.radius,2.35);
     if(contact===null)continue;
     fx.hitTimes??={};fx.hitTimes[key]=now+contactDamageIntervalMs({id:'goldfish'});
     const center=[value.position[0],value.position[1]+(target.kind==='monster'?ENEMY_HEIGHT*.5:1),value.position[2]];
     if(target.kind==='monster'){
      const result=damageMonster(world,owner,fx.damage*1.25,now,rng,'giant-goldfish',value,center);
      if(result&&!result.defeated){
       if(fx.echo)applyElementalHit(value,owner,itemById('goldfish'),now,.2);
       else applyStatus(world,owner,value,itemById('goldfish'),{
        direction:fx.direction,charge:1,damage:fx.damage,qualityDuration:1
       },now);
       const moved=[value.position[0]+fx.direction[0]*(3+fx.tier*.7)*(fx.echo?.2:1),value.position[1],value.position[2]+fx.direction[2]*(3+fx.tier*.7)*(fx.echo?.2:1)];
       if(insideArena(moved,-2)&&!insideArtSanctuary(moved))value.position=moved;
       value.effects??={};value.effects.stun={owner:fx.owner,power:fx.echo?.2:1,until:now+(fx.echo?160:800),next:now+1000};
      }
     }else{
      const hit=damagePlayer(world,owner,value,(fx.pvpDamage||12)*1.08,now,'goldfish',fx.origin,'giant-goldfish',center);
      if(hit&&!hit.immune){const profile=world.profiles[value.key];
       if(profile?.hp>0){
        if(fx.echo)applyElementalHit(profile,owner,itemById('goldfish'),now,.2);
        else applyStatus(world,owner,profile,itemById('goldfish'),{
         direction:fx.direction,charge:1,damage:fx.pvpDamage,qualityDuration:1
        },now);
       }
       if(profile?.hitReaction){profile.hitReaction.stunMs=fx.echo?100:300;profile.hitReaction.knockback=fx.echo?2.8:14;}}
     }
     changed=true;
    }
   }
  }else if(fx.kind==='fan'){
   // Each of the four tornado tracks has a deterministic, independently
   // wandering trajectory; collision and client animation use the same seed.
   for(let i=0;i<4;i++){
    const progress=Math.max(0,Math.min(1,next));
    const seed=i*1.618+fx.createdAt*.0003;
    const travel=fx.range*progress;
    const side=Math.sin(seed+progress*12)*2.8+Math.sin(seed*2.7+progress*27)*1.5;
    const right=[fx.direction[2],0,-fx.direction[0]];
    const p=fx.origin.map((v,j)=>v+fx.direction[j]*travel+right[j]*side);
    for(const target of targets){
     const value=target.value;if(value.key===fx.owner)continue;
     if(target.kind==='player'&&insideArtSanctuary(value.position))continue;
     const pos=value.position,dist=Math.hypot(pos[0]-p[0],pos[2]-p[2]),id2=value.id||value.key,key=id2; // All four tornadoes share a per-victim cooldown.
     // The rendered tornado is a finite 3-D column, not an infinite 2-D
     // hazard: a fighter flying above the visible vortex cannot be struck.
     const tornadoTop=p[1]+10*(1+(fx.tier-1)*.19),victimHeight=target.kind==='monster'?(value.bodyHeight||ENEMY_HEIGHT):2.35;
     if(pos[1]>tornadoTop||pos[1]+victimHeight<p[1]-1)continue;
     if(dist>(fx.echo?1.2:2.4)+fx.radius*.48||now-(fx.fanHits[key]||0)<contactDamageIntervalMs({id:'fan'}))continue;
     fx.fanHits[key]=now;
     const center=[value.position[0],value.position[1]+(target.kind==='monster'?ENEMY_HEIGHT*.5:1),value.position[2]];
     if(target.kind==='monster')damageMonster(world,owner,fx.damage*.18,now,rng,'tornado',value,center);
     else damagePlayer(world,owner,value,(fx.pvpDamage||10)*.10,now,'tornado',fx.origin,'tornado',center);
     const victim=target.kind==='monster'?value:world.profiles[value.key];
     if(victim){
      victim.effects??={};
      victim.effects.slow={owner:fx.owner,power:fx.echo?.08:.4,until:now+Math.round(1300*(1+(fx.tier-1)*.3)*(fx.echo?.2:1)),next:now+1000};
     }
     changed=true;
    }
   }
  }
  fx.lastAt=now;
 }
 const old=attacks.length;
 world.persistentAttacks=attacks.filter(v=>now<v.expiresAt);
 return changed||world.persistentAttacks.length!==old;
}

function damageMonster(world,profile,amount,now,rng,kind='normal',monster=world.monster,hitPosition=null){if(!monster?.active)return null;amount*=1+(effectActive(monster,'expose',now)?.power||0);amount*=1+(effectActive(monster,'soaked',now)?.power||0);const hpLost=Math.min(monster.hp,amount);monster.hp=Math.max(0,monster.hp-hpLost);recordTempleDamage(world,{amount,kind,position:hitPosition||[monster.position[0],monster.position[1]+ENEMY_HEIGHT*.6,monster.position[2]],owner:profile?.key,target:monster.id},now);monster.lastHitAt=now;if(profile?.key){monster.aggroTarget=profile.key;monster.aggroUntil=now+26000;}if(monster.hp>0)return {monsterId:monster.id,position:[monster.position[0],monster.position[1]+ENEMY_HEIGHT*.5,monster.position[2]],damage:+amount.toFixed(1),hp:monster.hp,defeated:false};const coin=Math.floor(ECONOMY.monsterCoinMin+rng()*(ECONOMY.monsterCoinMax-ECONOMY.monsterCoinMin+1)),gear=monsterDropRoll(rng);world.groundDrops.push({id:id(),kind:'coin',amount:coin,position:[monster.position[0]-1,.4,monster.position[2]],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs},{id:id(),...gear,position:[monster.position[0]+1,.4,monster.position[2]],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs});monster.active=false;monster.defeatedAt=now;monster.nextSpawnAt=now+ECONOMY.monsterIntervalMs;world.activity.itemsSpawned+=2;
 world.monsterDeathEvents??=[];
 world.monsterDeathEvents.push({id:id(),monsterId:monster.id,time:now,position:[monster.position[0],monster.position[1]+ENEMY_HEIGHT*.5,monster.position[2]]});
 if(world.monsterDeathEvents.length>48)world.monsterDeathEvents.splice(0,world.monsterDeathEvents.length-48);
 if(profile)addXp(profile,120);return {monsterId:monster.id,position:[monster.position[0],monster.position[1]+ENEMY_HEIGHT*.5,monster.position[2]],damage:+amount.toFixed(1),hp:0,defeated:true};}
function moveMonster(world,monster,target,distance){const dx=target[0]-monster.position[0],dz=target[2]-monster.position[2],angle=Math.atan2(dz,dx);for(const offset of [0,.68,-.68,1.2,-1.2]){const next=[monster.position[0]+Math.cos(angle+offset)*distance,monster.position[1],monster.position[2]+Math.sin(angle+offset)*distance];if(!insideArena(next,-2)||insideArtSanctuary(next)||(world.structures||[]).some(s=>distance2d(next,s.position)<structureRadius(s)+1.1))continue;monster.position[0]=next[0];monster.position[2]=next[2];return;}}
function hashString(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;}

export const CATALOG_VIEW=Object.freeze(ITEMS.map(item=>Object.freeze({...item})));
export const SHOP_VIEW=Object.freeze(SHOP_ITEMS.map(item=>Object.freeze({...item})));
