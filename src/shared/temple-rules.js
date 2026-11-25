import {journeyPose,journeyAction} from './write-journey.js';
import {recoverArtworks,recoverMisplacedArtworkPosition} from './artwork-recovery.js';
import {chargedArea,insideChargedArea,insideSpellFootprint,spellFootprint,spellGroundHeight,scaleUltimateFootprint,fusionEchoAnchor,iceEruptionContact,ICE_ERUPTION_TRAVEL_MS,ICE_ERUPTION_VISIBLE_MS} from './charge-area.js';
import {GOLDFISH_TRAVEL_SCALE,GOLDFISH_SCHOOL_COUNT,GOLDFISH_DAMAGE_PER_FISH,GOLDFISH_SCHOOL_RADIUS,GOLDFISH_CONTACT_RADIUS,GOLDFISH_T1_DAMAGE_PER_FISH,goldfishDirectHitBudget,goldfishSchoolPosition,advanceGoldfishSchool} from './goldfish-school.js';
import {discGroundHeight} from './artwork-discs.js';
import {saberWaveCrest} from './saber-wave.js';
import {artworkLanding,artworkPosition} from './artwork-flight.js';
import {publishArtBomb,resizeArtBomb,updateArtBombAppearance,resetPlayerArtworks,projectileHitsActor,artBombDamage,artworkBlastHits,ARTWORK_BLAST_RADIUS} from './art-bomb.js';
import {addArtwork,artworkDefinitions,artworkPickupReach,validateAppearance,isArtwork22,labelStyleOnly,LABEL_STYLE_BATCH_FIELDS} from './artwork-library.js';
import {ECONOMY,ITEMS,SHOP_ITEMS,STARTER_LOADOUT,EQUIPPABLE_SLOTS,attackStats,itemById,shopWeaponVariant,inventoryCapacity,isRetiredHeadgear,shopPrice,shopPriceKey,shopPurchaseVariant,shopResalePrice,registerCustomWings,groundDropRoll,monsterDropRoll} from './catalog.js';
import {ARENA_RADIUS,GROUND_DROP_POINTS,MONSTER_SPAWNS,PLATFORMS,PLAYER_SPAWNS,SAFE_ZONE,distance2d,insideArena,insideSafeZone} from './arena.js';
import {CITY_LOTS,CITY_MAX_HP,cityRaycast,cityStage,cityDamageTier,cityBlocked,cityWallPoint,CITY_PAINT_WALLS,cityCollisionCandidates,cityLocal,cityRoofHeightAtHp} from './city-layout.js';
import layoutDefaults from '../../temple-artwork-layout.json' with {type:'json'};
import {ORIGINAL_ACTIONS,originalAction,originalView} from './reletter-actions.js';
import {applyStatus,tickStatus,effectActive,applyElementalHit} from './combat-status.js';
import {playerStats,refreshStats} from './player-stats.js';
import {fuseOriginal,equippedItem} from './fusion-adapter.js';
import {fuseTemple} from './temple-fusion.js';
import {ensureFusionIdentity,ensureWeaponAffixes,appendInventoryInstance,removeInventoryInstance,selectEquipmentInstance,swapInventoryInstances,removeInventoryInstances} from './fusion-instances.js';
import {fusionSniperEchoDamage} from './fusion-balance.js';
import {advanceIslandEnemy,ISLAND_ENEMIES,ENEMY_HEIGHT,ENEMY_RADIUS} from './island-combat.js';
import {spawnMonsterPack,MONSTER_PACK_SIZE} from './monster-pack.js';
import {patrolMonster} from './monster-patrol.js';
import {calicoPellets} from './calico-pellets.js';
import {pvpShotDamage,projectileFlightMs,sniperHitsHead,contactDamageIntervalMs,visibleCollisionLifetimeMs,SNIPER_RANGE,shoulderSniperSpread,PALM_STORM_DURATION_MS,PALM_STORM_TICK_MS} from './combat-balance.js';
import {normalMeleeFootprint} from './melee-contact.js';
import {weaponAffixTotals} from './weapon-affixes.js';
import {isChannelStaff,weaponQuality,channelVisualRadius,forwardCastRadius,channelReachMultiplier,ICE_FREEZE_INTERVAL_MS,GOLDFISH_SWIM_MS,GOLDFISH_SWIM_RADIUS,TIDE_PUSH_INTERVAL_MS,TIDE_PUSH_DURATION_MS,TIDE_PUSH_DISTANCE,TIDE_DAMAGE_TICK_MS,WHIP_PULL_SPEED,whipPullDurationMs} from './weapon-abilities.js';
import {recordTempleDamage} from './damage-events.js';
import {advanceHomingVortex,vortexSpinPoint,VORTEX_FLIGHT_MS,VORTEX_DAMAGE_INTERVAL_MS,VORTEX_SPIN_MS,VORTEX_SPIN_LOCK_MS} from './vortex-flight.js';
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
    profiles:{},customWings:[],shopPrices:{},environment:{skyBaseColor:'#101b36'},removedArtworkIds:[],
    coins:Object.fromEntries(PLATFORMS.map(p=>[p.id,{availableAt:0}])),
    artworks:Object.fromEntries(PLATFORMS.map(p=>[p.id,{availableAt:0,holder:null,throwEvent:null}])),
    artworkLayout:clone(layoutDefaults.artworkLayout||{}),floatingPlatforms:clone(layoutDefaults.floatingPlatforms||[]),customPedestals:[],platformOverrides:{},removedPlatformIds:[],persistentAttacks:[],prismLocks:{},tidalLocks:{},pendingArtworkFlights:[],groundDrops:[],structures:[],cityDamage:{},wallPaint:{},wallPaintRevision:0,plants:[],sceneCleanupVersion:1,
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
  world.environment??={skyBaseColor:'#101b36'};world.removedArtworkIds??=[];world.coins??={};world.artworks??={};world.artworkLayout??={};world.floatingPlatforms??=clone(layoutDefaults.floatingPlatforms||[]);world.customPedestals??=[];world.platformOverrides??={};world.removedPlatformIds??=[];world.persistentAttacks??=[];world.prismLocks??={};world.pendingArtworkFlights??=[];world.groundDrops??=[];world.structures??=[];world.cityDamage??={};world.wallPaint??={};world.wallPaintRevision??=0;world.plants??=[];
  world.activity??={coinMinted:0,coinBurned:0,itemsSpawned:0,itemsClaimed:0};
  for(const p of PLATFORMS){world.coins[p.id]??={availableAt:0};if(world.removedArtworkIds.includes(p.id)){delete world.artworks[p.id];delete world.artworkLayout[p.id];continue;}world.artworks[p.id]??={availableAt:0,holder:null,throwEvent:null};if(!world.artworkLayout[p.id]&&layoutDefaults.artworkLayout?.[p.id])world.artworkLayout[p.id]=clone(layoutDefaults.artworkLayout[p.id]);}
  // Older uploaded artworks can have a surviving catalog record but no
  // interactive world state. The renderer loads them, yet pickup and GM save
  // both fail. Repair that state without disturbing existing ownership.
  for(const record of world.customArtworks||[]){
    world.artworks[record.id]??={availableAt:0,holder:null,throwEvent:null};
    const art=world.artworks[record.id];
    if(art?.holder&&!world.profiles[art.holder]){art.holder=null;art.throwEvent=null;art.availableAt=0;}
    if(isArtwork22(record)){
      // v1 used a single room-wide boolean keyed on display title '22'.
      // A subsequent upload or an original filename '22.png' could bypass it.
      // Restore each matching record exactly once, then keep normal pickup
      // ownership intact until another GM explicitly changes its layout.
      world.artwork22RecoveryV2??={};
      if(!world.artwork22RecoveryV2[record.id]){
        Object.assign(art,{holder:null,throwEvent:null,availableAt:0});
        world.pendingArtworkFlights=(world.pendingArtworkFlights||[])
          .filter(f=>f.event?.platformId!==record.id);
        world.artwork22RecoveryV2[record.id]=true;
        world.revision=(world.revision||0)+1;
      }
      if(!Number.isFinite(art.availableAt)||art.availableAt>now+3600000)art.availableAt=0;
      const layout=world.artworkLayout[record.id],pos=layout?.position;
      const invalid=!Array.isArray(pos)||pos.length!==3||!pos.every(Number.isFinite)||
        pos.some(v=>Math.abs(v+100)<1e-6)||
        Math.hypot(pos[0],pos[2])>ARENA_RADIUS+5||pos[1]<-2||pos[1]>60;
      if(invalid&&Array.isArray(record.position)&&record.position.every(Number.isFinite)){
        world.artworkLayout[record.id]={...layout,position:[...record.position],
          rotation:layout?.rotation||[0,0,0],scale:layout?.scale||[1,1,1],
          appearance:validateAppearance(layout?.appearance||{}),
          revision:(layout?.revision||0)+1,updatedAt:now};
        world.revision++;
      }
    }
  }
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
  world.persistentAttacks=world.persistentAttacks.filter(fx=>fx.weapon!=='fan'&&fx.kind!=='fan');
  return cleanLegacyScene(world);
}

export function createProfile(key,name,color,now=Date.now(),admin=false){
  return {key,name:String(name||'Pilgrim').slice(0,24),color:validColor(color)?color:'#43b59a',admin:!!admin,
    wallet:80,level:1,xp:0,hp:100,maxHp:100,deadUntil:0,starterWeaponId:STARTER_LOADOUT.weapon,inventory:admin?ITEMS.filter(item=>item.slot!=='armor'&&!isRetiredHeadgear(item)).map(item=>item.id):[STARTER_LOADOUT.weapon],quickSlots:[null,null,null],equipment:{...STARTER_LOADOUT,wings:null},gmWingsInitialized:!!admin,gmInvincible:admin?true:undefined,
    gmAllItemsGranted:!!admin,gmKnownCustomWingIds:[],collectorSoldArtworks:{},
    fusion:{},wingTrialDraws:0,wingPaidDraws:0,wingDesignCredits:0,createdAt:now,updatedAt:now,lastAttackAt:0};
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
  // Existing players retain their previous White Cat starter identity and
  // any personally chosen weapon. Only NEW profiles begin with green saber-2.
  // The per-profile starter ID prevents a free saber from being repeatedly
  // inserted into old inventories on every join.
  current.starterWeaponId??='white-cat';
  if(name)current.name=String(name).slice(0,24);if(validColor(color))current.color=color;current.admin=!!admin;current.updatedAt=now;
  current.wallet=Number.isFinite(current.wallet)?Math.max(0,Math.floor(current.wallet)):0;
  current.level=Math.max(1,Math.floor(current.level||1));current.xp=Math.max(0,Math.floor(current.xp||0));
  current.wingTrialDraws=Number.isFinite(current.wingTrialDraws)?Math.max(0,Math.min(FREE_WING_TRIAL_LIMIT,Math.floor(current.wingTrialDraws))):0;
  current.wingPaidDraws=Number.isSafeInteger(current.wingPaidDraws)?Math.max(0,Math.min(100000,Math.floor(current.wingPaidDraws))):0;
  current.wingDesignCredits=Number.isSafeInteger(current.wingDesignCredits)?Math.max(0,current.wingDesignCredits):0;
  if(!current.collectorSoldArtworks||typeof current.collectorSoldArtworks!=='object'||Array.isArray(current.collectorSoldArtworks))
   current.collectorSoldArtworks={};
  current.inventory=Array.isArray(current.inventory)?current.inventory.filter(itemById):[current.starterWeaponId];
  // Existing saves above the cap remain intact; only new additions are blocked.
  // Login must NEVER discard inventory or its per-instance records.
  if(current.starterWeaponId==='fan')current.starterWeaponId=STARTER_LOADOUT.weapon;
  // Preserve chosen item even when its stack is empty: it will be shown
  // with a red depleted overlay and automatically reactivate after restock.
  const savedQuickSlots=Array.isArray(current.quickSlots)?current.quickSlots:[];
  current.quickSlots=Array.from({length:3},(_,i)=>{
   const item=itemById(savedQuickSlots[i]);return item?.slot==='consumable'?item.id:null;
  });
  // One-time migration supplies every base item, including all premium wings.
  // Never replenish items removed later as fusion materials. Newly published
  // custom wings are separately granted once, even to established GM accounts.
  if(current.admin){
   if(!current.gmAllItemsGranted){
    const owned=new Set(current.inventory);
    for(const item of ITEMS){
     if(current.inventory.length>=inventoryCapacity(current))break;
     if(item.slot!=='armor'&&!isRetiredHeadgear(item)&&!owned.has(item.id)){current.inventory.push(item.id);owned.add(item.id);}
    }
    current.gmAllItemsGranted=true;
   }
   current.gmInventoryGranted=true;
   const known=new Set(Array.isArray(current.gmKnownCustomWingIds)?current.gmKnownCustomWingIds:[]);
   const owned=new Set(current.inventory);
   for(const wing of world.customWings||[]){
    if(wing.personalWing||wing.ownerKey&&wing.ownerKey!==key)continue;
    if(known.has(wing.id))continue;
    if(!owned.has(wing.id)&&current.inventory.length<inventoryCapacity(current)){
     appendInventoryInstance(current,wing.id,'grant');owned.add(wing.id);
    }
    known.add(wing.id);
   }
   current.gmKnownCustomWingIds=[...known];
  }
  // Repair a player's own original starter weapon unless it was deliberately
  // fused away. Never convert or overwrite a returning player's saved choice.
  if(!current.inventory.includes(current.starterWeaponId)&&!current.spentStarterWeapon)
   current.inventory.unshift(current.starterWeaponId);
  current.equipment??={...STARTER_LOADOUT,weapon:current.starterWeaponId};
   if(current.admin&&!current.gmWingsInitialized)current.gmWingsInitialized=true;
   if(current.admin&&typeof current.gmInvincible!=='boolean')current.gmInvincible=true;
   // Preserve legacy selected weapons while the inventory migration runs.
   // Fusion itself clears the equipped material when the final copy is spent.
   if(current.equipment.weapon&&!itemById(current.equipment.weapon))current.equipment.weapon=current.starterWeaponId;
   // Remove all old wing IDs from BAG and clear obsolete equipped slots.
   if(current.equipment.wings&&!itemById(current.equipment.wings))
    current.equipment.wings=null;
   delete current.equipment.armor;if(current.equippedInstanceIds)delete current.equippedInstanceIds.armor;delete current.equipment.rod;delete current.equipment.tool;current.fusion??={};delete current.fish;delete current.lastFishAt;
  // Remove retired fan echoes from both legacy and UID-owned fusion records;
  // keep historical bonuses and all other physical equipment identities.
  for(const record of [...Object.values(current.fusion||{}),...Object.values(current.fusionByInstance||{})]){
   if(Array.isArray(record?.effects)&&record.effects.includes('fan'))record.effects=record.effects.filter(id=>id!=='fan');
   if(Array.isArray(record?.original?.fusionEffects)&&record.original.fusionEffects.includes('fan'))record.original.fusionEffects=record.original.fusionEffects.filter(id=>id!=='fan');
  }
  ensureFusionIdentity(current);
  // Retire armor without losing historical instance data or occupying BAG slots.
  for(let i=current.inventory.length-1;i>=0;i--){
   if(itemById(current.inventory[i])?.slot!=='armor')continue;
   const row=current.inventoryInstances[i];current.retiredArmorInventory??=[];
   current.retiredArmorInventory.push({itemId:current.inventory[i],instance:clone(row),fusion:clone(current.fusionByInstance?.[row?.uid]||null)});
   removeInventoryInstance(current,i);
  }
  // The old one-time GM grant excluded later catalog releases. Add only the
  // new wearable family for existing GM profiles, without replenishing sold
  // items or discarding prior equipment / instance identities.
  if(current.admin&&!current.gmCreatureGearGrantedV2){
   const additions=ITEMS.filter(item=>item.id.startsWith('hat-')&&
     ['elephant','rooster','anteater','guinea-pig','penguin','polar-bear','jellyfish',
      'crab-claw','lion','banana-bunch','eggplant'].includes(item.design)||
     item.id.startsWith('outfit-creature-'));
   for(const item of additions){
    if(current.inventory.length>=inventoryCapacity(current))break;
    if(!current.inventory.includes(item.id))appendInventoryInstance(current,item.id,'grant');
   }
   current.gmCreatureGearGrantedV2=additions.every(item=>current.inventory.includes(item.id));
  }
  if(current.admin&&!current.gmR106WearablesGranted){
   for(const item of ITEMS.filter(i=>i.r106Wearable)){
    if(current.inventory.length>=inventoryCapacity(current))break;
    if(!current.inventory.includes(item.id))appendInventoryInstance(current,item.id,'grant');
   }
   current.gmR106WearablesGranted=ITEMS.filter(i=>i.r106Wearable).every(i=>current.inventory.includes(i.id));
  }
  ensureWeaponAffixes(current); // Server-owned one-time roll, persisted on join.
  refreshStats(world,current,now);
  if(current.deadUntil>0&&current.deadUntil<=now&&current.hp<=0)
   reviveProfile(current,now);
  return current;
}

export function validColor(value){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);}
export function validName(value){return typeof value==='string'&&value.trim().length>=1&&value.trim().length<=24&&!/[<>\u0000-\u001f]/.test(value);}

export function publicProfile(profile){
  return {key:profile.key,name:profile.name,color:profile.color,wallet:profile.admin?'∞':profile.wallet,hp:profile.hp,maxHp:profile.maxHp,
    level:profile.level,xp:profile.xp,wingTrialDraws:profile.wingTrialDraws||0,wingPaidDraws:Math.max(0,Number(profile.wingPaidDraws)||0),wingDesignCredits:Math.max(0,Number(profile.wingDesignCredits)||0),deadUntil:profile.deadUntil,lastRespawnAt:profile.lastRespawnAt||0,
    respawnPosition:clone(profile.respawnPosition||null),
    spawnProtectedUntil:profile.spawnProtectedUntil||0,lastKilledBy:profile.lastKilledBy||null,equipment:clone(profile.equipment),shield:clone(profile.shield||null),hitReaction:profile.hitReaction||null,whipPull:profile.whipPull||null,tidePush:profile.tidePush||null,vortexSpin:profile.vortexSpin||null,effects:clone(profile.effects||{}),admin:profile.admin,gmInvincible:profile.admin&&profile.gmInvincible!==false,gmFusionChance:profile.admin?(Number.isFinite(profile.gmFusionChance)?profile.gmFusionChance:1):undefined};
}

export function worldProfileView(world,actorKey,now){
 const profile=world.profiles[actorKey];
 return profile?{...publicProfile(profile),stats:playerStats(world,profile,now),starterWeaponId:profile.starterWeaponId,inventoryCapacity:inventoryCapacity(profile),inventoryCount:profile.inventory.length,inventory:clone(profile.inventory),quickSlots:clone(profile.quickSlots||[null,null,null]),inventoryInstances:clone(profile.inventoryInstances||[]),fusionByInstance:clone(profile.fusionByInstance||{}),equippedInstanceIds:clone(profile.equippedInstanceIds||{}),fusionIdentityMigrated:!!profile.fusionIdentityMigrated,fusionSuccessOnlyMigrated:!!profile.fusionSuccessOnlyMigrated,fusion:clone(profile.fusion),impulse:profile.impulse||null}:null;
}

export function worldView(world,actorKey,now=Date.now(),includeCustomWings=true){
  return {version:world.version,revision:world.revision,serverTime:now,
    coins:Object.fromEntries(PLATFORMS.map(p=>[p.id,{available:now>=(world.coins[p.id]?.availableAt||0),availableAt:world.coins[p.id]?.availableAt||0}])),
    environment:clone(world.environment||{skyBaseColor:'#101b36'}),removedArtworkIds:clone(world.removedArtworkIds||[]),artworks:clone(world.artworks),artworkLayout:clone(world.artworkLayout||{}),customArtworks:clone(world.customArtworks||[]),customWings:includeCustomWings?clone(world.customWings||[]):undefined,floatingPlatforms:clone(world.floatingPlatforms||[]),customPedestals:clone(world.customPedestals||[]),platformOverrides:clone(world.platformOverrides||{}),removedPlatformIds:clone(world.removedPlatformIds||[]),groundDrops:clone(world.groundDrops),structures:clone(world.structures),cityDamage:clone(world.cityDamage||{}),wallPaint:clone(world.wallPaint||{}),wallPaintRevision:world.wallPaintRevision||0,plants:clone(world.plants),monster:clone(world.monster),monsters:clone(world.monsters||[]),audioSettings:clone(world.audioSettings||{}),musicVersion:world.musicVersion||0,
    prismLocks:Object.fromEntries(Object.entries(world.prismLocks||{}).map(([key,lock])=>[
      key,{targetKey:lock.targetKey,kind:lock.kind,position:clone(lock.position),since:lock.since,
        multiplier:prismDamageMultiplier(now-lock.since),range:lock.range}
    ])),
    vortexes:(world.persistentAttacks||[]).filter(v=>v.kind==='vortex').map(v=>({id:v.id,position:clone(v.position||v.origin),owner:v.owner})),
    tidalLocks:Object.fromEntries(Object.entries(world.tidalLocks||{}).map(([key,lock])=>[
      key,{targets:(lock.targets||[]).map(t=>({targetKey:t.targetKey,kind:t.kind,position:clone(t.position)}))}
    ])),
    // Short-lived impact records survive even when the final fish consumes
    // the entire flight during this very server tick.
    goldfishImpactEvents:clone((world.goldfishImpactEvents||[]).filter(v=>now-v.time<950)),
    goldfishFlights:(world.persistentAttacks||[]).filter(v=>v.kind==='goldfish').map(v=>({
      id:v.id,position:clone(v.position||v.origin),direction:clone(v.direction),owner:v.owner,
       consumed:clone(v.fishConsumed||[])
    })),
    collector:clone(world.collector),collectorSale:clone(world.lastCollectorSale),
    shopPrices:clone(world.shopPrices||{}),profile:worldProfileView(world,actorKey,now),
    reletter:originalView(world),economy:ECONOMY,damageEvents:clone((world.damageEvents||[]).filter(e=>now-e.time<8000)),killEvents:clone((world.killEvents||[]).filter(e=>now-e.time<8000)),monsterDeathEvents:clone((world.monsterDeathEvents||[]).filter(e=>now-e.time>=0&&now-e.time<8000))};
}

function requireFighter(actor){return actor.role==='fighter'?null:{error:'Spectators cannot perform this action'};}
function requireAlive(profile,now){return profile.hp>0&&profile.deadUntil<=now?null:{error:'Wait for respawn'};}
function near(actor,position,radius){return distance2d(actor.position,position)<=radius&&Math.abs((actor.position?.[1]||0)-position[1])<=8;}
function spend(profile,amount,world){if(profile.admin)return true;if(profile.wallet<amount)return false;profile.wallet-=amount;world.activity.coinBurned+=amount;return true;}
function earn(profile,amount,world){if(!profile.admin)profile.wallet+=amount;world.activity.coinMinted+=amount;}
function addItem(profile,itemId){if(!itemById(itemId)||profile.inventory.length>=inventoryCapacity(profile))return false;appendInventoryInstance(profile,itemId,'ground');return true;}

// A channel interrupted by a lost stop packet MUST NOT impose 5%-speed
// validation forever. Movement and attack ticks use the same expiry window.
export function isLiveStaffChannel(profile,now=Date.now()){
 const staff=profile?.channelWeapon&&itemById(profile.channelWeapon);
 if(!staff||!isChannelStaff(staff))return false;
 const latest=Number(profile.lastChannelPulseAt||profile.channelStartedAt)||0;
 const grace=staff.family==='ice'?8500:Math.max(1900,Math.min(4500,(staff.cooldown||700)*2+500));
 return latest>0&&now-latest<=grace;
}
export function validateState(previous,next,elapsedMs,role='fighter',spawn=null,journey=null,now=Date.now(),mobility=null){
  const pose=journeyPose(journey,now);
  if(pose&&role==='fighter')return {state:{position:pose.position,rotation:Math.PI,animation:pose.animation,visible:true},authority:{kind:'write'}};
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
      animation:'idle',visible:true},authority:{kind:'immobilized',until:Math.max(freeze?.until||0,root?.until||0)}};
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
    // Root cause of periodic walking rubberband: the server validated against
    // 5% casting speed while the client had already released its staff, because
    // the channel-stop HTTP response and 90ms position WebSocket are NOT atomic.
    // Keep local cast slow via PlayerController.castMoveFactor, but validate all
    // ordinary movement against the normal antiteleport budget. The server
    // still enforces stun/root, arena bounds, roofs and building collision.
    const maxSpeed=(hasWings?28:14)*boostedSpeed+(recentHit?18:0)+(recentImpulse?18:0);
    const allowance=maxSpeed*elapsed+5.5+(recentHit?6:0);
    // Descending from a 30m platform reaches ~39m/s before landing,
    // while ordinary upward jumps start at 10m/s. Validate both axes
    // without turning gravity into a forbidden lateral wall.
    const verticalSpeed=deltaY<0?42:(hasWings?32:18);
    const verticalAllowance=(verticalSpeed+(recentHit||recentImpulse?14:0))*elapsed+
      5.5;
    if((horizontal>allowance||Math.abs(deltaY)>verticalAllowance)&&
      !justRespawned&&!landedFromWrite)
      return {error:'Movement rejected',state:previous};
  }
  // Authoritative solid city collision. Allow a fighter already inside a
  // building after a physics impulse to exit, but never permit entry.
  if(role==='fighter'&&mobility?.cityDamage&&
   cityBlocked(next.position[0],next.position[2],next.position[1]+.002,mobility.cityDamage,.218)&&
   !cityBlocked(previous?.position?.[0]??1e6,previous?.position?.[2]??1e6,
     (previous?.position?.[1]??0)+.002,mobility.cityDamage,.218))
   return {error:'Building collision',state:previous||null};
  return {state:{position:next.position.map(n=>+n.toFixed(3)),rotation:+next.rotation.toFixed(4),animation:String(next.animation||'idle').slice(0,12),visible:next.visible!==false}};
}

export function applyAction(world,actor,body,context={}){
  const now=context.now??Date.now(),rng=context.rng??Math.random,
   // The premium draw checks PERSISTED admin status before any ensureProfile
   // mutation. Existing game/GM actions retain their original role semantics.
   wingDrawAdmin=['gm-wing-draw','gm-wing-publish','gm-wing-update','gm-wing-remove','gm-wing-set-rate'].includes(body.action)?world.profiles?.[actor.key]?.admin===true:null,
   profile=ensureProfile(world,actor.key,actor.name,actor.color,now,
    ['gm-wing-draw','gm-wing-publish','gm-wing-update','gm-wing-remove','gm-wing-set-rate'].includes(body.action)?wingDrawAdmin:actor.admin);
  if(body.action==='gm-shop-price'){
   // Role is obtained from the authenticated server session, not the request payload.
   if(!profile.admin||actor.admin!==true)return {error:'GM only'};
   const item=shopPurchaseVariant(body.itemId,body.qualityTier);
   if(!item)return {error:'Invalid shop item or quality'};
   const price=body.price;
   if(price!==null&&(!Number.isSafeInteger(price)||price<1||price>100000000))return {error:'Price must be 1–100,000,000 coins'};
   world.shopPrices??={};
   const key=shopPriceKey(item);
   if(price===null)delete world.shopPrices[key];else world.shopPrices[key]=price;
   world.revision=(world.revision||0)+1;
   return {notice:'PRICE UPDATED · '+item.name+' · '+shopPrice(item,world.shopPrices)+' coins',shopPriceKey:key};
  }
  // Public gacha has been permanently retired; old clients cannot draw.
  if(['wing-draw','gm-wing-draw'].includes(body.action))return {error:'Wing gacha has been removed'};
  if(body.action==='redeem-wing-design'){
   if(typeof actor.key!=='string'||!actor.key.startsWith('firebase:'))return {error:'Google sign-in required'};
   if(actor.role==='spectator')return {error:'Enter the arena to equip your wing'};
   if(!Number.isInteger(profile.wingDesignCredits)||profile.wingDesignCredits<1)return {error:'No paid wing design credit remains'};
   if(profile.inventory.length>=inventoryCapacity(profile))return {error:'Inventory full'};
   world.customWings??=[];
   if(world.customWings.length>=1000)return {error:'Wing archive is full'};
   let wing;
   try{wing=normalizePaintedWing(body.wing,'gm-wing-'+crypto.randomUUID());}
   catch(error){return {error:error.message};}
   // Player paint is cosmetic; server fixes movement and power, preventing
   // tampered client fields from awarding extra stats.
   Object.assign(wing,{
    tier:3,ability:'glide',abilities:['glide','sparkle'],impulse:10.15,gravity:.585,flapMs:300,
    personalWing:true,ownerKey:actor.key,drawRatePct:0,
    gmWingExclusive:false,description:'Private commissioned wing · not listed for sale'
   });
   world.customWings.push(wing);
   registerCustomWings(world.customWings);
   appendInventoryInstance(profile,wing.id);
   selectEquipmentInstance(profile,'wings',profile.inventory.length-1);
   profile.wingDesignCredits--;
   profile.itemOrigins??={};profile.itemOrigins[wing.id]='paid-personal-design';
   profile.updatedAt=now;refreshStats(world,profile,now);world.revision=(world.revision||0)+1;
   return {personalWingId:wing.id,equippedWingId:wing.id,
    notice:'自製翅膀已存入背包並自動裝備：'+wing.name,profile:publicProfile(profile)};
  }
  if(body.action==='gm-wing-publish'){
   if(!wingDrawAdmin||!profile.admin)return {error:'GM only'};
   world.customWings??=[];
   if(world.customWings.filter(wing=>wing.retired!==true).length>=MAX_PAINTED_WINGS)return {error:'Wing gallery is full'};
   if(world.customWings.length>=160)return {error:'Wing archive is full (160 records)'};
   if(profile.inventory.length>=inventoryCapacity(profile))return {error:'Inventory full'};
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
  if(body.action==='gm-wing-update'){
   if(!wingDrawAdmin||!profile.admin)return {error:'GM only'};
   const target=(world.customWings||[]).find(entry=>entry.id===body.wingId&&entry.retired!==true);
   if(!target)return {error:'翅膀不存在或已下架'};
   let updated;
   try{updated=normalizePaintedWing(body.wing,target.id);}catch(error){return {error:error.message};}
   if(world.customWings.some(entry=>entry.id!==target.id&&entry.retired!==true&&entry.name.toLowerCase()===updated.name.toLowerCase()))
    return {error:'Wing name already exists'};
   if(totalCustomWingRates(world.customWings)-Number(target.drawRatePct??1)+updated.drawRatePct>100+1e-8)
    return {error:'所有上架翅膀的個別中獎率合計不可超過 100%'};
   Object.assign(target,updated,{id:target.id,retired:false,updatedAt:now});
   registerCustomWings(world.customWings);
   profile.updatedAt=now;world.revision=(world.revision||0)+1;
   return {updatedWingId:target.id,notice:'翅膀已修改並重新上架：'+target.name};
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
  // Drawings persist independently of the structural reset. Only the GM
  // clean command removes a mural, including its stored eraser strokes.
  if(body.action==='clean-graffiti'){
   if(!profile.admin)return {error:'GM only'};
   const count=Object.values(world.wallPaint||{}).reduce((total,walls)=>
    total+Object.values(walls||{}).reduce((n,strokes)=>n+(Array.isArray(strokes)?strokes.length:0),0),0);
   world.wallPaint={};world.wallPaintRevision=(world.wallPaintRevision||0)+1;
   world.revision=(world.revision||0)+1;
   return {notice:'已清除全部 '+count+' 筆建築塗鴉',cleanGraffiti:true,removedStrokes:count};
  }
  if(body.action==='paint-building'){
   if(actor.role!=='fighter')return {error:'Spectators cannot paint'};
   if(profile.hp<=0||profile.deadUntil>now)return {error:'Cannot paint while defeated'};
   const bodyStroke=body.stroke||{};
   const lot=CITY_LOTS.find(item=>item.id===bodyStroke.lotId);
   if(!lot||!CITY_PAINT_WALLS.includes(bodyStroke.wall))return {error:'Invalid building wall'};
   if(cityStage(world.cityDamage?.[lot.id]?.hp??CITY_MAX_HP)===3)
    return {error:'Restore the damaged building before painting again'};
   if(!['brush','eraser'].includes(bodyStroke.tool))return {error:'Invalid painting tool'};
   const color=bodyStroke.tool==='eraser'?'#000000':bodyStroke.color;
   if(!validColor(color))return {error:'Invalid painting colour'};
   const size=Number(bodyStroke.size);
   if(!Number.isFinite(size)||size<.04||size>.95)return {error:'Invalid brush size'};
   const points=bodyStroke.points;
   if(!Array.isArray(points)||points.length<1||points.length>130)return {error:'Invalid stroke length'};
   const verified=[];
   for(const p of points){
    if(!Array.isArray(p)||p.length!==2||!p.every(x=>Number.isFinite(x)&&x>=0&&x<=1))
     return {error:'Invalid paint coordinates'};
    const u=+p[0].toFixed(4),v=+p[1].toFixed(4);
    const location=cityWallPoint(lot,bodyStroke.wall,u,v);
    if(!location||Math.hypot(location[0]-actor.position[0],
      location[1]-(actor.position[1]+1.4),location[2]-actor.position[2])>19)
     return {error:'Paint within reach of your character'};
    verified.push([u,v]);
   }
   world.wallPaint??={};
   const total=Object.values(world.wallPaint).reduce((n,walls)=>
    n+Object.values(walls||{}).reduce((m,strokes)=>m+(strokes?.length||0),0),0);
   if(total>=2000)return {error:'City mural archive is full; GM must clean graffiti'};
   const walls=world.wallPaint[lot.id]??={};
   const strokes=walls[bodyStroke.wall]??=[];
   if(strokes.length>=100)return {error:'This wall has reached the mural limit'};
   const stroke={id:'paint-'+id(),owner:actor.key,lotId:lot.id,wall:bodyStroke.wall,
    tool:bodyStroke.tool,color,size,points:verified,time:now,
    ...(typeof bodyStroke.clientId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(bodyStroke.clientId)?{clientId:bodyStroke.clientId}:{})};
   strokes.push(stroke);
   world.wallPaintRevision=(world.wallPaintRevision||0)+1;
   world.revision=(world.revision||0)+1;
   return {paintStroke:stroke};
  }
  if(body.action==='reset-buildings'){
   if(!profile.admin)return {error:'GM only'};
   const count=Object.keys(world.cityDamage||{}).length;
   world.cityDamage={};world.revision=(world.revision||0)+1;
   return {notice:'已修復全部 '+count+' 棟受損房屋',resetBuildings:true,restoredBuildings:count};
  }
  if(body.action==='reset-messages'){
   if(!profile.admin)return {error:'GM only'};
   const count=(world.plants||[]).length;
   const clearedMediaIds=(world.plants||[]).map(p=>p.media?.id).filter(Boolean);
   world.plants=[];world.revision=(world.revision||0)+1;
   return {notice:'已清空中央留言區與聊天室（'+count+' 則永久留言）',
    resetMessages:true,clearedMediaIds};
  }
  if(body.action==='recover-artworks')return recoverArtworks(world,profile.admin);
  if(body.action==='recover-misplaced-artwork')return recoverMisplacedArtworkPosition(world,profile.admin,body.platformId,now);
  if(body.action==='gm-sky-color')return setSkyBaseColor(world,profile.admin&&actor.admin===true,body.color);
  if(body.action==='gm-remove-artworks')return removeSelectedArtworks(world,profile.admin&&actor.admin===true,body.ids);
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
  if(body.action==='create-platform'){
    if(!profile.admin)return {error:'僅限 GM'};
    const position=body.position,radius=Number(body.radius),height=Number(body.height??.62),kind=body.kind==='pedestal'?'pedestal':'disc';
    if(!validPlatformTransform(position,radius,kind==='pedestal'?height:undefined))return {error:'檯座或圓盤位置／尺寸無效'};
    const key=id();
    if(kind==='pedestal'){
      world.customPedestals??=[];
      if(world.customPedestals.length>=128)return {error:'已達 128 個檯座上限'};
      const platform={id:key,position:[...position],radius,height};
      world.customPedestals.push(platform);world.revision++;
      return {platformId:'pedestal:custom:'+key,platform,notice:'灰色三角檯座已放置'};
    }
    world.floatingPlatforms??=[];
    if(world.floatingPlatforms.length>=128)return {error:'已達 128 個圓盤上限'};
    // Legacy floating radius was stored at half its visible radius.
    const platform={id:key,position:[...position],radius:radius/2};
    world.floatingPlatforms.push(platform);world.revision++;
    return {platformId:'floating:'+key,platform,notice:'桃紅色圓盤已放置'};
  }
  if(body.action==='update-platform'){
    if(!profile.admin)return {error:'僅限 GM'};
    const key=String(body.platformId||''),position=body.position,radius=Number(body.radius);
    const pedestal=key.startsWith('pedestal:');
    const height=pedestal?Number(body.height):undefined;
    if(!validPlatformTransform(position,radius,height))return {error:'檯座或圓盤位置／尺寸無效'};
    if(key.startsWith('floating:')){
      const record=(world.floatingPlatforms||[]).find(p=>p.id===key.slice(9));
      if(!record)return {error:'圓盤不存在'};
      record.position=[...position];record.radius=radius/2;
    }else if(key.startsWith('pedestal:custom:')){
      const record=(world.customPedestals||[]).find(p=>p.id===key.slice(16));
      if(!record)return {error:'檯座不存在'};
      record.position=[...position];record.radius=radius;record.height=height;
    }else{
      if(!validOriginalPlatformKey(key)||world.removedPlatformIds?.includes(key))return {error:'無效或已刪除的展示物件'};
      world.platformOverrides??={};
      world.platformOverrides[key]={position:[...position],radius,...(pedestal?{height}:{})};
    }
    world.revision++;return {platformId:key,notice:'展示物件位置與尺寸已同步儲存'};
  }
  if(body.action==='repair-artwork'){
    if(!profile.admin)return {error:'GM only'};
    const record=artworkDefinitions(world).find(p=>p.id===body.platformId);
    if(!record)return {error:'Unknown artwork'};
    const p=body.position;
    if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||
       Math.hypot(p[0],p[2])>ARENA_RADIUS||p[1]<0||p[1]>60)return {error:'Invalid recovery position'};
    world.artworks[record.id]??={availableAt:0,holder:null,throwEvent:null};
    Object.assign(world.artworks[record.id],{availableAt:0,holder:null,throwEvent:null});
    world.pendingArtworkFlights=(world.pendingArtworkFlights||[]).filter(f=>f.event?.platformId!==record.id);
    const current=world.artworkLayout[record.id],existing=current||{position:record.artPosition,rotation:[0,record.artYaw,0],scale:[1,1,1],appearance:validateAppearance({})};
    world.artworkLayoutHistory??={};(world.artworkLayoutHistory[record.id]??=[]).push(clone(existing));
    world.artworkLayoutHistory[record.id]=world.artworkLayoutHistory[record.id].slice(-8);
    world.artworkLayout[record.id]={...existing,position:[...p],revision:(current?.revision||0)+1,updatedAt:now};
    world.revision++;return {platformId:record.id,artworkLayout:clone(world.artworkLayout[record.id]),notice:'作品已解鎖並移到 GM 前方 · 可以拾取與編輯'};
  }
  if(body.action==='delete-platform'){
    if(!profile.admin)return {error:'僅限 GM 刪除圓盤'};
    const key=String(body.platformId||'');
    if(key.startsWith('floating:')){
      const uid=key.slice(9),index=(world.floatingPlatforms||[]).findIndex(p=>p.id===uid);
      if(index<0)return {error:'圓盤不存在或已遭刪除'};
      world.floatingPlatforms.splice(index,1);
    }else if(key.startsWith('pedestal:custom:')){
      const index=(world.customPedestals||[]).findIndex(p=>p.id===key.slice(16));
      if(index<0)return {error:'檯座不存在'};
      world.customPedestals.splice(index,1);
    }else{
      const valid=validOriginalPlatformKey(key);
      if(!valid)return {error:'無效的作品展示圓盤'};
      world.removedPlatformIds??=[];
      if(world.removedPlatformIds.includes(key))return {error:'圓盤已被刪除'};
      world.removedPlatformIds.push(key);
    }
    if(world.platformOverrides)delete world.platformOverrides[key];
    world.revision++;
    return {notice:'圓盤已刪除 · 所有玩家同步',platformId:key};
  }
  if(body.action==='add-artwork')return addArtwork(world,profile,actor,body,now);
  if(body.action==='set-artwork-layout')return setArtworkLayout(world,profile,body,now,actor);
  if(body.action==='apply-my-artwork-label-style')return applyMyArtworkLabelStyle(world,actor,body,now);
  // Inventory bookkeeping does not involve combat or world-space actions.
  // Allow purchasing, inspecting and equipping while a room is full and the
  // account is spectating. Combat/building still requires an active fighter.
  const inventoryAction=['buy','equip','unequip','sell','sell-bulk','inspect-item','assign-consumable','swap-inventory'].includes(body.action);
   // Viewers can write and reply at the central tree, but cannot fight/build.
   const spectatorWrite=actor.role==='spectator'&&body.action==='plant';
   const denied=inventoryAction||spectatorWrite?null:requireFighter(actor);if(denied)return denied;
   const dead=inventoryAction||spectatorWrite?null:requireAlive(profile,now);if(dead&&!['respawn'].includes(body.action))return dead;
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
  if(!inventoryAction&&!insideArena(actor.position,2))return {error:'Invalid actor position'};
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
    case 'inspect-item':{
     // Clicking BAG details is the only way to acknowledge NEW gear.
     // Ignore untrusted instance UIDs; the server checks owned item IDs.
     const inspected=String(body.itemId||'');
     if(!itemById(inspected)||!profile.inventory.includes(inspected))
      return {error:'Item is not owned'};
     ensureFusionIdentity(profile);
     let cleared=0;
     for(const entry of profile.inventoryInstances){
      if(entry.itemId===inspected&&entry.viewed===false){
       entry.viewed=true;cleared++;
      }
     }
     result={inspectedItemId:inspected,cleared};
     break;
    }
    case 'assign-consumable':result=assignConsumable(profile,body);break;
    case 'use-consumable':result=useConsumable(world,profile,actor,body,now);break;
    case 'sell':result=sell(world,profile,body);break;
    case 'sell-bulk':result=sellBulk(world,profile,body);break;
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
  const platform=artworkDefinitions(world).find(p=>p.id===body.platformId);
  if(!platform)return {error:'Unknown artwork'};
  // An imported GM artwork can exist without the old pickup-state entry.
  const art=world.artworks[body.platformId]??=( {availableAt:0,holder:null,throwEvent:null} );
  if(art.holder||now<art.availableAt)return {error:'Artwork is unavailable'};
  const layout=world.artworkLayout?.[platform.id],position=layout?.position||platform.artPosition;
  const reach=artworkPickupReach(layout);
  if(distance2d(actor.position,position)>reach.horizontal+1||
     Math.abs((actor.position?.[1]||0)-position[1])>reach.vertical)
    return {error:'Move closer to the artwork'};
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
  // Throw validation is immediate, collision consequences are NOT. The
  // authoritative Worker samples the visible ballistic flight during ticks;
  // no player/monster/house loses HP merely because A was released.
  world.pendingArtworkFlights??=[];
  world.pendingArtworkFlights.push({
   event,landing:{time:landing.time,position:[...landing.position]},bombSize,
   lastAt:now,hitActors:[],hitMonsters:[],hitStructures:[],hitCity:[]
  });
  if(world.pendingArtworkFlights.length>20)world.pendingArtworkFlights.splice(0,world.pendingArtworkFlights.length-20);
  return {throwEvent:event};

}

function buy(world,profile,body){
 const base=SHOP_ITEMS.find(entry=>entry.id===body.itemId);
 if(!base)return {error:'Item is not sold'};
 const weaponChoice=base.slot==='weapon';
  const qualityTier=body.qualityTier;
  const item=shopPurchaseVariant(base.id,qualityTier);
  if(!item||(!weaponChoice&&body.qualityTier!==undefined))
  return {error:'Invalid weapon quality'};
 const quantity=body.quantity===undefined?1:body.quantity;
 // The server chooses both PRICE and COMBAT tier from its catalog; a client
 // cannot forge a cheap high-quality weapon or use another player's stack.
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>99)
  return {error:'Quantity must be an integer from 1 to 99'};
 if(profile.inventory.length+quantity>inventoryCapacity(profile))return {error:`Inventory full (${inventoryCapacity(profile)} items maximum)`};
 const unitPrice=shopPrice(item,world.shopPrices),total=unitPrice*quantity;
 if(!Number.isSafeInteger(total)||total<0)return {error:'Invalid purchase amount'};
 if(!spend(profile,total,world))return {error:'Not enough coins'};
 for(let i=0;i<quantity;i++)
  appendInventoryInstance(profile,base.id,'shop',weaponChoice?item.shopTier:null,profile.admin?unitPrice:unitPrice);
 profile.itemOrigins??={};profile.itemOrigins[base.id]='shop';
 const charged=profile.admin?0:total;
 return {notice:`PURCHASE SUCCESSFUL · ${item.name} ×${quantity} · ${charged} coins`,
  purchased:{itemId:base.id,qualityTier:weaponChoice?item.shopTier:null,quantity,total:charged,listTotal:total}};
}
function assignConsumable(profile,body){
 const index=body.slot;
 if(!Number.isInteger(index)||index<0||index>=3)return {error:'Invalid consumable slot'};
 const itemId=body.itemId??null;
 if(itemId!==null){
  const item=itemById(itemId);
  if(item?.slot!=='consumable')return {error:'Not a restorative consumable'};
  if(!profile.inventory.includes(itemId))return {error:'You do not own this consumable'};
 }
 profile.quickSlots??=[null,null,null];
 profile.quickSlots[index]=itemId;
 return {notice:itemId?`Quick slot ${index+1}: ${itemById(itemId).name}`:`Quick slot ${index+1} cleared`};
}
function useConsumable(world,profile,actor,body,now){
 const index=body.slot,itemId=profile.quickSlots?.[index];
 if(!Number.isInteger(index)||index<0||index>=3)return {error:'Invalid consumable slot'};
 const item=itemById(itemId);
 if(item?.slot!=='consumable')return {error:'No restorative consumable assigned'};
 const inventoryIndex=profile.inventory.indexOf(itemId);
 if(inventoryIndex<0)return {error:'Out of stock · Restock this consumable at SHOP'};
 if(profile.hp>=profile.maxHp)return {error:'Health is already full'};
 const hpBefore=profile.hp;
 // A healing percentage is measured against CURRENT maximum HP, not coins
 // or the untrusted client-provided HP value.
 const restored=Math.min(profile.maxHp-hpBefore,Math.ceil(profile.maxHp*item.healFraction));
 if(restored<=0)return {error:'Health is already full'};
 removeInventoryInstance(profile,inventoryIndex);
 profile.hp=Math.min(profile.maxHp,hpBefore+restored);
 recordTempleDamage(world,{amount:restored,kind:'heal',
  position:[actor.position[0],actor.position[1]+1.5,actor.position[2]],
  owner:profile.key,target:profile.key},now);
 return {notice:`Restored ${restored} HP · ${item.name}`,
  healed:restored,remaining:profile.inventory.filter(v=>v===itemId).length,slot:index};
}
// Sell physical instances, not the first item with a matching canonical ID.
function sellableInstance(profile,index){
 const item=itemById(profile.inventory[index]),row=profile.inventoryInstances[index];
 if(!item||!row||item.slot==='armor')return false;
 if(Object.values(profile.equippedInstanceIds||{}).includes(row.uid))return false;
 if(!profile.equippedInstanceIds?.[item.slot]&&profile.equipment?.[item.slot]===item.id)return false;
 const starter=profile.starterWeaponId||STARTER_LOADOUT.weapon;
 if(item.id===starter&&profile.inventory.indexOf(starter)===index)return false;
 return true;
}
function sell(world,profile,body){
 ensureFusionIdentity(profile);
 const index=body.uid?profile.inventoryInstances.findIndex(row=>row.uid===body.uid&&row.itemId===body.itemId):profile.inventory.findIndex((id,i)=>id===body.itemId&&sellableInstance(profile,i));
 if(index<0||!sellableInstance(profile,index))return {error:'Item cannot be sold (equipped, starter or inventory changed)'};
 const item=itemById(profile.inventory[index]),resale=shopResalePrice(item,profile.inventoryInstances[index],world.shopPrices);
 const row=removeInventoryInstance(profile,index);earn(profile,resale,world);return {notice:`Sold ${item.name} · +${resale} coins`,sold:{count:1,coins:profile.admin?0:resale,uids:[row.uid],remaining:profile.inventory.length,capacity:inventoryCapacity(profile)}};
}
function sellBulk(world,profile,body){
 ensureFusionIdentity(profile);
 if(!['weapon','outfit','head','shield','wings','consumable'].includes(body.slot)||!['common','uncommon','rare','relic','epic'].includes(body.rarity)||!Array.isArray(body.uids)||!body.uids.length||body.uids.length>inventoryCapacity(profile))return {error:'Invalid sale selection'};
 const ids=new Set(body.uids),indices=[];let total=0;
 for(let i=0;i<profile.inventory.length;i++){
  const row=profile.inventoryInstances[i],base=itemById(profile.inventory[i]);
  if(!ids.has(row?.uid)||base?.slot!==body.slot||!sellableInstance(profile,i))continue;
  const grade=profile.fusionByInstance?.[row.uid]?.shopTier??row.shopTier??base.tier;
  const item=base.slot==='weapon'?shopWeaponVariant(base,grade)||base:base;
  if(item.rarity!==body.rarity)continue;
  indices.push(i);total+=shopResalePrice(base,row,world.shopPrices);
 }
 if(indices.length!==ids.size||!Number.isSafeInteger(total))return {error:'Inventory changed; review the sale again'};
 const removed=removeInventoryInstances(profile,indices);
 earn(profile,total,world);return {notice:`Sold ${removed.length} items · +${total} coins`,sold:{count:removed.length,coins:profile.admin?0:total,uids:removed.map(row=>row.uid),remaining:profile.inventory.length,capacity:inventoryCapacity(profile)}};
}
function equip(profile,body){const item=itemById(body.itemId);if(!item||!profile.inventory.includes(item.id)||!EQUIPPABLE_SLOTS.includes(item.slot))return {error:'Item is not owned'};const index=Number.isInteger(body.inventoryIndex)?body.inventoryIndex:profile.inventory.indexOf(item.id);if(profile.inventory[index]!==item.id)return {error:'Inventory changed: choose the equipment again'};selectEquipmentInstance(profile,item.slot,index);return {notice:`Equipped ${item.name}`};}

function validPlatformTransform(position,radius,height){
  return Array.isArray(position)&&position.length===3&&position.every(Number.isFinite)&&
    Math.hypot(position[0],position[2])<=ARENA_RADIUS&&position[1]>=0&&position[1]<=60&&
    Number.isFinite(radius)&&radius>=.6&&radius<=16&&
    (height===undefined||(Number.isFinite(height)&&height>=.2&&height<=16));
}
function validOriginalPlatformKey(key){
  const match=/^(display|stair|pedestal):(platform-\d{2})(?::(\d{1,2}))?$/.exec(key);
  return !!match&&PLATFORMS.some(p=>p.id===match[2])&&
    (match[1]==='stair'?match[3]!==undefined&&+match[3]<=63:match[3]===undefined);
}

// Atomic, strictly owner-scoped bulk nameplate style update. In particular
// GM permission does NOT widen the target scope to other players' artworks.
export function applyMyArtworkLabelStyle(world,actor,body,now=Date.now()){
 const style=body?.style;
 if(!style||typeof style!=='object'||Array.isArray(style)||
    LABEL_STYLE_BATCH_FIELDS.some(key=>!Object.hasOwn(style,key)))
  return {error:'Provide all nameplate style fields'};
 const validated=validateAppearance(style);
 if(!validated)return {error:'Invalid nameplate colour, font size or bounds'};
 const patch=labelStyleOnly(validated);
 const owned=(world.customArtworks||[]).filter(record=>record.owner===actor.key);
 if(!owned.length)return {error:'You have not uploaded any artworks'};
 const updates=[];
 for(const record of owned){
  const layout=world.artworkLayout?.[record.id];
  if(!layout)continue;
  const next=validateAppearance({...layout.appearance,...patch},record);
  if(!next)return {error:'Invalid appearance for artwork '+record.id};
  updates.push({record,layout,appearance:next});
 }
 if(!updates.length)return {error:'No owned artwork layouts found'};
 for(const {layout,appearance} of updates){
  layout.appearance=appearance;
  layout.revision=(layout.revision||0)+1;
  layout.updatedAt=now;
 }
 world.revision=(world.revision||0)+1;
 return {notice:'Nameplate style saved to '+updates.length+' of your artworks',
  updatedCount:updates.length,appliedIds:updates.map(({record})=>record.id),
  revisions:Object.fromEntries(updates.map(({record,layout})=>[record.id,layout.revision]))};
}

export function setArtworkLayout(world,profile,body,now=Date.now(),actor=null){
  const ownerRecord=(world.customArtworks||[]).find(a=>a.id===body.platformId);
  const gm=!!profile.admin;
  if(!gm){
   if(!actor||!ownerRecord||ownerRecord.owner!==actor.key)return {error:'GM only or artwork owner'};
   const denied=requireFighter(actor)||requireAlive(profile,now);if(denied)return denied;
   if(body.layout?.platformRadius!==undefined)return {error:'GM only'};
  }
  const platform=artworkDefinitions(world).find(p=>p.id===body.platformId);if(!platform)return {error:'Unknown artwork'};
  const art=world.artworks[platform.id]??=( {availableAt:0,holder:null,throwEvent:null} );
  const isLockedExhibit=gm&&(world.customArtworks||[]).some(a=>a.id===platform.id&&isArtwork22(a));
  // Preserve ordinary players' held or airborne artworks; only the reported
  // stuck exhibit can be force-released by a GM layout save.
  if((art.holder||art.availableAt>now)&&!isLockedExhibit)return {error:'Wait until the artwork returns'};
  const current=world.artworkLayout?.[platform.id];if(body.expectedRevision!==(current?.revision||0)&&!isLockedExhibit)return {error:'Layout changed by another editor. Reload and retry.'};
  const layout=body.layout,vec=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
  if(!layout||!vec(layout.position)||!vec(layout.rotation)||!vec(layout.scale))return {error:'Invalid transform'};
  if(Math.hypot(layout.position[0],layout.position[2])>ARENA_RADIUS+5||layout.position[1]<-2||layout.position[1]>60||layout.scale.some(v=>v<.05||v>20)||layout.rotation.some(v=>Math.abs(v)>Math.PI*8))return {error:'Transform exceeds bounds'};
  if((world.customArtworks||[]).some(a=>a.id===platform.id&&a.bomb)&&layout.scale.some(v=>v<1||v>3))return {error:'Player artwork scale must remain within 1–3×, even in GM editor'};
  const appearance=validateAppearance(layout.appearance||current?.appearance);if(!appearance)return {error:'Invalid appearance settings'};
  const original=PLATFORMS.some(p=>p.id===platform.id);
  const uploadedRecord=(world.customArtworks||[]).find(a=>a.id===platform.id);
  // GM can name both original gallery works and later uploads. Existing
  // untitled original layouts stay unchanged until the GM explicitly saves.
  const proposedTitle=layout.title===undefined?
   (current?.title??uploadedRecord?.title):String(layout.title).trim();
  if(proposedTitle!==undefined&&(!proposedTitle||proposedTitle.length>120))
   return {error:'Artwork name must be 1–120 characters'};
  const proposedAuthor=layout.author===undefined?(current?.author??uploadedRecord?.author??''):String(layout.author).trim();
  if(proposedAuthor.length>100)return {error:'Artist name must be at most 100 characters'};
  const proposedRadius=layout.platformRadius??current?.platformRadius;
  if(proposedRadius!==undefined&&proposedRadius!==null&&(!original||!Number.isFinite(proposedRadius)||proposedRadius<1.5||proposedRadius>14))
   return {error:'Platform radius must be 1.5–14, available for original artworks only'};
  world.artworkLayout??={};
  // Retain a bounded server-side undo snapshot for exact future recoveries.
  // The previous (pre-history) edit cannot be reconstructed retrospectively.
  if(current){
   world.artworkLayoutHistory??={};
   const history=world.artworkLayoutHistory[platform.id]??=[];
   history.push(clone(current));
   if(history.length>8)history.splice(0,history.length-8);
  }
  if(isLockedExhibit){
    Object.assign(art,{availableAt:0,holder:null,throwEvent:null});
    world.pendingArtworkFlights=(world.pendingArtworkFlights||[]).filter(f=>f.event?.platformId!==platform.id);
  }
  world.artworkLayout[platform.id]={position:[...layout.position],rotation:[...layout.rotation],scale:[...layout.scale],
   ...(original&&proposedRadius!=null?{platformRadius:proposedRadius}:{}),
   appearance,...(proposedTitle!==undefined?{title:proposedTitle}:{}),author:proposedAuthor,revision:(current?.revision||0)+1,updatedAt:now};
  if(uploadedRecord){uploadedRecord.title=proposedTitle;uploadedRecord.author=proposedAuthor;}
  world.revision++;
  return {notice:'ARTWORK DEFAULT SAVED · ALL PLAYERS',artworkLayout:clone(world.artworkLayout[platform.id])};
}

function fuse(world,profile,body,rng){return fuseTemple(world,profile,body,rng);}

function attack(world,profile,actor,body,context,now){
  // A release must clear server collision objects even while stunned, frozen,
  // or inside the previous hit-reaction recovery window.
  if(body.phase==='channel-stop'){
   profile.channelWeapon=null;profile.channelStartedAt=0;profile.chargeStartedAt=0;
   profile.lastChannelPulseAt=0;profile.lastBloomHealAt=0;
   delete profile.prismChannelStats;
   delete profile.tidalChannelStats;
   if(world.prismLocks)delete world.prismLocks[actor.key];
   if(world.tidalLocks)delete world.tidalLocks[actor.key];
   world.persistentAttacks=(world.persistentAttacks||[]).filter(
    fx=>!(fx.owner===actor.key&&fx.channel));
   return {channeling:false,channelStopped:{owner:actor.key,time:now}};
  }
  if(body.phase!=='channel-stop'&&(effectActive(profile,'freeze',now)||effectActive(profile,'paralysis',now)))
   return {error:'Paralysed: attacks disabled'};

  if(profile.hitReaction&&now-profile.hitReaction.time<profile.hitReaction.stunMs)return {error:'Recovering from hit'};
  const weapon=equippedItem(profile,itemById(profile.equipment.weapon)||itemById(STARTER_LOADOUT.weapon)),bonus=profile.fusion[weapon.id]?.bonus||0;
  // Shoulder shots have deliberately poor server-owned accuracy; an A-hold
  // charged blast is legal there only with a fused chargeable weapon.
  const shoulderSniper=weapon.id==='black-cat'&&body.aimMode==='shoulder';
  const blackCatFused=(profile.fusion?.['black-cat']?.effects||[]).some(sourceId=>{
    const source=itemById(sourceId);
    return source?.slot==='weapon'&&source.id!=='black-cat'&&Number(source.chargeMs)>0;
  });
  if(weapon.id==='black-cat'&&body.scoped!==true&&!shoulderSniper){
    profile.chargeStartedAt=0;
    return {error:'Black Cat sniper requires scope or shoulder aim'};
  }
  if(shoulderSniper&&body.phase==='charge'&&!blackCatFused){
    profile.chargeStartedAt=0;
    return {error:'Fuse a chargeable weapon to unlock the shoulder ultimate'};
  }
  if(body.phase==='channel-start'){
    if(!isChannelStaff(weapon)||weapon.family==='ice')return {error:'This staff casts its ultimate on release'};
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
  if(channel&&(!isChannelStaff(weapon)||weapon.family==='ice'||profile.channelWeapon!==weapon.id||
     !profile.channelStartedAt||now-(profile.lastChannelPulseAt||profile.channelStartedAt)>(weapon.family==='ice'?8500:6000)))
    return {error:'Staff channel is not active'};
  if(body.phase==='charge'){profile.chargeStartedAt=now;return {charging:true};}
  if(now-profile.lastAttackAt<weapon.cooldown)return {error:'Weapon is recovering'};
  let direction=normalDirection(body.direction);
  if(!direction)return {error:'Invalid attack direction'};
  const charge=channel?1:Math.min(clamp(Number(body.charge)||0,0,1),profile.chargeStartedAt?clamp((now-profile.chargeStartedAt)/(weapon.chargeMs||1500),0,1):0);
  if(shoulderSniper&&charge>=1&&!blackCatFused){
    profile.chargeStartedAt=0;
    return {error:'Shoulder ultimate requires a fused chargeable weapon'};
  }
  profile.lastAttackAt=now;if(channel)profile.lastChannelPulseAt=now;
  if(!channel)profile.chargeStartedAt=0;
  if(shoulderSniper){
     // Server-owned drift stays inside the actual doubled 132px crosshair.
     const random=typeof context?.rng==='function'?context.rng:Math.random;
     direction=shoulderSniperSpread(direction,body.viewportHeight,random)||direction;
   }
  const stats=attackStats(weapon,charge),quality=weaponQuality(weapon,profile.fusion?.[weapon.id]);
  const enchants=weaponAffixTotals(weapon);
  stats.damage=+(stats.damage*quality.damage*(1+enchants.damage/100)*
   (stats.ultimate?1+enchants.charge/100:1)).toFixed(3);
  // A held staff actually projects forward. Its visual spray and authoritative
  // collision must use exactly the same range; no 11m decorative overshoot.
  if(channel||(weapon.family==='ice'&&stats.ultimate))stats.range=Math.max(stats.range,weapon.id==='clam'?10:Math.min(18,weapon.range))*channelReachMultiplier(weapon);
  stats.range=+(stats.range*quality.range).toFixed(2);
  if(weapon.id==='black-cat'){
    stats.range=SNIPER_RANGE; // Long-range ray for both shoulder and scope.
    if(shoulderSniper&&stats.ultimate)stats.radius=Math.max(1.1,stats.radius);
  }
  // The narrow server collision tube must agree with the visible spray and
  // the original blue #59 rectangle. Non-channel charged AoEs stay intact.
  stats.radius=forwardCastRadius(weapon,quality,stats.radius,channel||(weapon.family==='ice'&&stats.ultimate));
   // Restrict ordinary whip contacts to the visible, narrow forward-moving lash.
   if(weapon.family==='whip'&&!weapon.exotic&&!stats.ultimate){stats.range=+(Math.min(stats.range,4.7+(Math.max(1,weapon.tier||1)-1)*1.5)/3).toFixed(3);stats.radius=.16;}
    if(weapon.family==='swatter'&&!weapon.exotic&&!stats.ultimate){stats.range=Math.min(stats.range,1.55+(Math.max(1,weapon.tier||1)-1)*.2);stats.radius=.18;}
    if(weapon.family==='saber'&&!stats.ultimate){
     stats.range=Math.min(stats.range,(4.7+(Math.max(1,weapon.tier||1)-1)*1.5)/3);
     stats.radius=Math.min(stats.radius,.16);
    }
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
   // Keep the travelling school, server sweep collider and client VFX on
   // one identical 50%-shorter trajectory; do not shorten ordinary bubbles.
   if(weapon.id==='goldfish'&&stats.ultimate)stats.range=+(stats.range*GOLDFISH_TRAVEL_SCALE).toFixed(3);
   if(weapon.id==='goldfish'&&stats.ultimate)stats.radius=GOLDFISH_SCHOOL_RADIUS*quality.visual;
   if(weapon.id==='giraffe'&&stats.ultimate){
    // Preserve the explicitly doubled 56m boomerang reach: the generic
    // ultimate footprint shrink must not undo the item's charged range.
    stats.range=+(weapon.chargedRange*quality.range).toFixed(2);
    // Three times the previous ultimate power. The skinned, spinning rod
    // sweeps a 5.9m-per-quality collision radius while tumbling.
    stats.damage=+(stats.damage*3).toFixed(3);
    stats.radius=Math.max(stats.radius,5.9*quality.visual);
   }
  const origin=[actor.position[0],actor.position[1]+1.16,actor.position[2]],combo=stats.ultimate?6:now-(profile.lastComboAt||0)<1200?((profile.combo||0)+1)%6:0;if((weapon.firstPerson||weapon.id==='calico-cat'||isChannelStaff(weapon)||weapon.family==='saber')&&Array.isArray(body.origin)&&body.origin.length===3&&body.origin.every(Number.isFinite)&&Math.hypot(...body.origin.map((v,i)=>v-actor.position[i]))<=3)origin.splice(0,3,...body.origin);stats.damage=+(stats.damage*playerStats(world,profile,now).attack*.1).toFixed(3);profile.combo=combo;profile.lastComboAt=now;
  const groundForSpell=(x,z,y)=>spellGroundHeight(world,x,z,y);
  // The goldfish ultimate is an actual travelling creature, not a splash at a distant ground marker.
  const prismChannel=channel&&weapon.family==='beam'&&!weapon.exotic;
  const tidalChannel=channel&&/^tide-[1-5]$/.test(weapon.id);
  const waveVortex=weapon.family==='wave'&&stats.ultimate;
  const area=stats.ultimate&&weapon.id!=='goldfish'&&!waveVortex?chargedArea(weapon,origin,direction,stats,groundForSpell,channel||(weapon.family==='ice'&&stats.ultimate)):null;
  const pellets=weapon.pattern==='scatter'?calicoPellets(direction,stats.ultimate,now):null;
  const fusionEchoes=[];
  const pvpDamage=pvpShotDamage(weapon,stats,quality);
  if(tidalChannel){
   // Three authenticated homing streams, each intentionally weaker than the
   // single-target prism; regular water taps still use their original ray.
   profile.tidalChannelStats={range:stats.range,
    monsterDps:stats.damage*.30,pvpDps:pvpDamage*.35,direction:[...direction]};
  }
  if(prismChannel){
   // Damage and direction are server-owned; each channel pulse renews
   // this source without restarting the current target's power ramp.
   profile.prismChannelStats={range:stats.range,monsterDps:stats.damage,pvpDps:pvpDamage,
    direction:[...direction]};
  }
  const returningGiraffe=weapon.id==='giraffe'&&stats.ultimate;
  const roamingFan=weapon.id==='fan'&&stats.ultimate;
  const swimmingFish=weapon.id==='goldfish'&&stats.ultimate;
  // Lift the whole creature above ground/water while retaining the muzzle
  // position for ordinary bubbles. Server collision and render share this.
  const goldfishOrigin=swimmingFish?[origin[0],origin[1]+2.0,origin[2]]:origin;
  const horizontalLength=Math.hypot(direction[0],direction[2])||1;
  const goldfishDirection=swimmingFish?[direction[0]/horizontalLength,0,direction[2]/horizontalLength]:direction;
  let persistentAttackId=null;
  if(returningGiraffe||roamingFan||swimmingFish||waveVortex){
    world.persistentAttacks??=[];
    const duration=waveVortex?VORTEX_FLIGHT_MS:swimmingFish?Math.round(GOLDFISH_SWIM_MS*quality.duration):returningGiraffe?2300:Math.round((1400+quality.tier*850)*quality.duration);
    const attackId=id();persistentAttackId=attackId;
    world.persistentAttacks.push({
      id:attackId,kind:waveVortex?'vortex':swimmingFish?'goldfish':returningGiraffe?'giraffe':'fan',owner:actor.key,
      origin:[...goldfishOrigin],direction:[...goldfishDirection],launchDirection:[...goldfishDirection],range:stats.range,position:[...goldfishOrigin],travelled:0,hitTimes:{},
      damage:stats.damage+bonus*.1,pvpDamage,radius:stats.radius,tier:quality.tier, // already quality-adjusted and 60%-sized, exactly as the warning
      createdAt:now,lastAt:now,expiresAt:now+duration,
      outHits:[],backHits:[],fanHits:{},fishHits:[],fishConsumed:[]
    });
    if(world.persistentAttacks.length>32)world.persistentAttacks.splice(0,world.persistentAttacks.length-32);
  }
  const persistentOnly=returningGiraffe||roamingFan||swimmingFish||waveVortex||prismChannel||tidalChannel;
  // Attack requests only launch server-owned trajectories. Health, statuses,
  // and damage-number events are produced by tickPersistentAttacks when the
  // travelling VFX volume actually touches a target (never on key release).
  if(!persistentOnly){
    const duration=projectileFlightMs(weapon,stats.ultimate,stats.range);
    const iceGround=weapon.family==='ice'&&stats.ultimate&&area?.mode==='area';
    const visualLifetime=iceGround?ICE_ERUPTION_TRAVEL_MS+ICE_ERUPTION_VISIBLE_MS:channel?duration:visibleCollisionLifetimeMs(weapon,stats.ultimate);
    world.persistentAttacks??=[];
    world.persistentAttacks.push({
      id:id(),kind:'projectile',owner:actor.key,weapon:weapon.id,
      origin:[...origin],direction:[...direction],range:stats.range,
      radius:stats.radius,area,damage:stats.damage+bonus*.1,pvpDamage,charge,critChance:weapon.critChance,
      qualityDuration:quality.duration,qualityScale:quality.visual,tier:quality.tier,channel,iceGround,
      shoulderSpread:shoulderSniper,
      flightMs:duration,hitTimes:{},pellets:pellets?.map(p=>({...p,radius:p.radius*quality.visual}))||null,
      hits:[],pelletHits:{},areaResolved:false,
      createdAt:now,lastAt:now,expiresAt:now+Math.max(duration,visualLifetime)
    });
    if(world.persistentAttacks.length>40)world.persistentAttacks.splice(0,world.persistentAttacks.length-40);
  }
  if(stats.ultimate){
    const primaryFootprint=spellFootprint(weapon,origin,direction,stats,area,groundForSpell);
    for(const [fusionSlot,sourceId] of (profile.fusion?.[weapon.id]?.effects||[]).slice(0,2).entries()){
      const source=itemById(sourceId);if(source?.slot!=='weapon')continue;
      const sourceQuality=weaponQuality(source),full=attackStats(source,1);
      // All borrowed skills terminate at the primary weapon's warned target.
      const anchor=fusionEchoAnchor(primaryFootprint,origin);
      const echoChannel=channel&&isChannelStaff(source);
      const native={...full,range:full.range*sourceQuality.range,
       radius:forwardCastRadius(source,sourceQuality,full.radius,echoChannel)};
      scaleUltimateFootprint(native,source,sourceQuality);
      const secondary={...native,range:source.id==='goldfish'?anchor.distance*GOLDFISH_TRAVEL_SCALE:anchor.distance};
      const echoArea=source.id==='goldfish'||source.family==='wave'?null:
       chargedArea(source,origin,direction,secondary,groundForSpell,echoChannel,true);
      if(echoArea?.mode==='area'&&echoArea.shape!=='ice-line'){
       const y=Math.max(0,groundForSpell(anchor.x,anchor.z,origin[1]));
       echoArea.center=[anchor.x,y+.12,anchor.z];
       echoArea.visualCenter=[anchor.x,y+.16,anchor.z];
       echoArea.travel=anchor.distance;echoArea.range=anchor.distance;
       // A round echo keeps its own source radius, even under a narrow beam.
       echoArea.radius=secondary.radius;
      }
      const exotic=source.family==='wave'?'vortex':source.id==='fan'?'fan':source.id==='giraffe'?'giraffe':source.id==='goldfish'?'goldfish':null;
      const flight=projectileFlightMs(source,true);
      const duration=exotic==='vortex'?VORTEX_FLIGHT_MS:exotic==='goldfish'?Math.round(GOLDFISH_SWIM_MS*sourceQuality.duration):
        exotic==='giraffe'?2300:exotic==='fan'?Math.round((1400+sourceQuality.tier*850)*sourceQuality.duration):
        source.family==='ice'?ICE_ERUPTION_TRAVEL_MS+ICE_ERUPTION_VISIBLE_MS:Math.max(flight,visibleCollisionLifetimeMs(source,true));
      // Borrowed sniper fusion deals only a small, per-target echo. It
       // cannot transfer the original one-shot power to another weapon.
       const balancedSniper=source.id==='black-cat'?fusionSniperEchoDamage(source):null;
       // Sniper-as-primary borrows at most 8% of each fused ultimate: both
       // echoes together must remain less powerful than a direct charged hit.
       const echoScale=weapon.id==='black-cat'?.08:.2;
       const echoId=id(),echoDamage=balancedSniper?.damage??+Math.min(full.damage*echoScale,weapon.id==='black-cat'?32:Infinity).toFixed(3);
      const echoPvP=balancedSniper?.pvpDamage??+Math.min(pvpShotDamage(source,full,sourceQuality)*echoScale,weapon.id==='black-cat'?3.5:Infinity).toFixed(3);
      const secondaryPellets=source.pattern==='scatter'?calicoPellets(direction,true,now):null;
      world.persistentAttacks.push({id:echoId,kind:exotic||'projectile',echo:true,fusionSlot,channel:echoChannel,owner:actor.key,weapon:source.id,
        origin:[...origin],direction:[...direction],launchDirection:[...direction],position:[...origin],travelled:0,range:secondary.range,radius:secondary.radius,area:echoArea,parentFootprint:primaryFootprint,
        damage:echoDamage,pvpDamage:echoPvP,charge:1,qualityDuration:sourceQuality.duration*echoScale,
        tier:sourceQuality.tier,flightMs:flight,iceGround:source.family==='ice',hitTimes:{},hits:[],pelletHits:{},areaResolved:false,
        pellets:secondaryPellets?.map(v=>({...v,radius:v.radius*sourceQuality.visual*.5}))||null,
        outHits:[],backHits:[],fanHits:{},fishHits:[],fishConsumed:[],
        createdAt:now,lastAt:now,expiresAt:now+duration});
      fusionEchoes.push({id:echoId,persistentAttackId:echoId,owner:actor.key,fusionSlot,origin:[...origin],direction:[...direction],
        weapon:source.id,family:source.family,color:source.color,charge:1,ultimate:true,channel:echoChannel,
        range:secondary.range,radius:secondary.radius,area:echoArea,parentFootprint:primaryFootprint,qualityTier:sourceQuality.tier,
        qualityScale:sourceQuality.visual*.5,qualityDuration:sourceQuality.duration,
        pellets:secondaryPellets?.map(v=>v.direction)||null,
        fusionEcho:true,echoPower:echoScale,time:now});
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
  for(const {v:structure} of (returningGiraffe||waveVortex?[]:area&&['area','sector'].includes(area.mode)?candidates:candidates.slice(0,1))){
   const damage=Math.max(8,Math.round((stats.damage+bonus*.1)*.7));
   structure.maxHp??=structure.kind==='house'?220:structure.kind==='tree'?90:140;
   structure.hp=Math.max(0,structure.hp-damage);
   const event={id:id(),structureId:structure.id,kind:structure.kind,position:[...structure.position],hp:structure.hp,maxHp:structure.maxHp,damage,time:now};
   structureHit??=event;structureHits.push(event);
   if(structure.hp===0){const destroyed=structureEvent(structure,now);structureDestroyed??=destroyed;structureDestroyedEvents.push(destroyed);world.structures.splice(world.structures.indexOf(structure),1);}
  }
  // The city's structural impact follows weapon damage and charged strength,
  // without changing PvP damage or displaying health numbers on the building.
  const structuralDamage=Math.max(8,Math.round((stats.damage+bonus*.1)*(charge>=1?1.5:1.1)));
  const city=returningGiraffe||waveVortex?{hits:[],destroyed:[]}:cityWeaponHits(world,origin,direction,stats.range,area,structuralDamage,now);
 for(const impact of city.hits){structureHit??=impact;structureHits.push(impact);}
 for(const fallen of city.destroyed){structureDestroyed??=fallen;structureDestroyedEvents.push(fallen);}
 return {structureHit,structureDestroyed,structureHits,structureDestroyedEvents,attackEvent:{id:id(),persistentAttackId,owner:actor.key,origin:goldfishOrigin,direction:goldfishDirection,aimPoint:weapon.firstPerson?origin.map((v,i)=>v+direction[i]*stats.range):null,impactPoint:monsterHit?.position||(hit?.target?(()=>{const p=(context.actors||[]).find(a=>a.key===hit.target)?.position;return p?[p[0],p[1]+1,p[2]]:null;})():null),weapon:weapon.id,family:weapon.family,color:weapon.color,charge,combo,area,
    aimMode:shoulderSniper?'shoulder':body.aimMode==='scope'?'scope':null,
    piercing:shoulderSniper&&charge>=1,qualityTier:quality.tier,qualityScale:quality.visual,qualityDuration:quality.duration,channel,pellets:pellets?.map(p=>p.direction)||null,fusionEffects:profile.fusion[weapon.id]?.effects||[],fusionEchoes,flightMs:projectileFlightMs(weapon,stats.ultimate,stats.range),...stats,time:now},hit,hits,monsterHit,monsterHits:monsterHits.map(x=>x.result)};
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
  // Explicit last-line guard: the goldfish school cannot damage its caster,
  // even if an actor is represented by both an id and a player key.
  if(kind==='giant-goldfish'&&(sourceProfile?.key===targetActor.key||sourceProfile===world.profiles?.[targetActor.key]))
    return {target:targetActor.key,damage:0,defeated:false,immune:true};
  const target=world.profiles[targetActor.key];if(!target||target.hp<=0||target.deadUntil>now)return null;
   if((target.spawnProtectedUntil||0)>now)return {target:targetActor.key,damage:0,defeated:false,immune:true};
  const stats=refreshStats(world,target,now);if(target.admin&&target.gmInvincible!==false){target.hp=target.maxHp;return {target:targetActor.key,damage:0,defeated:false,immune:true};}
  const reduction=0;
  // The frying pan's self-damage is exactly 15 HP, not armour/shield
  // adjusted; it remains a genuine self-inflicted hazard even for the GM.
  let damage=fixedDamage?Math.max(0,+Number(amount).toFixed(1)):
    Math.max(1,+((amount)*(forceKill?1:1-reduction)*(forceKill?1:stats.defense)*(1+(effectActive(target,'soaked',now)?.power||0))).toFixed(1));
  if(forceKill)damage=Math.max(damage,target.hp); // A verified sniper headshot ignores armour and shields.
  if(shotgunPellet)damage=+Math.max(5,Math.min(20,damage)).toFixed(1); // Per pellet after armour; shields still absorb.
   if(target.shield&&!forceKill&&!fixedDamage){const absorbed=Math.min(Math.max(0,target.shield.hp),damage);if(absorbed>0){target.shield.hp=Math.max(0,target.shield.hp-absorbed);target.shield.lastHit=now;target.shield.lastAbsorbed=+absorbed.toFixed(2);target.shield.hitId=id();recordTempleDamage(world,{amount:absorbed,kind:'shield',position:hitPosition||[targetActor.position[0],targetActor.position[1]+1.3,targetActor.position[2]],owner:sourceProfile?.key,target:targetActor.key},now);}damage-=absorbed;}
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

/**
 * Swept, server-authoritative artwork impacts. A flight's visible event.time
 * is identical to this simulation epoch. Every 45ms segment is checked
 * before applying HP, knockback, city damage, shake and destroyed events.
 * Each distinct target is affected only once per physical throw.
 */
export function tickArtworkFlights(world,actors=[],now=Date.now(),rng=Math.random){
 const flights=world.pendingArtworkFlights||[];
 if(!flights.length)return false;
 let changed=false;
 world.pendingArtworkVisualEvents??=[];
 for(const flight of [...flights]){
  const {event,landing}=flight,elapsed=Math.max(0,(now-event.time)/1000);
  const until=Math.min(landing.time,elapsed);
  const from=Math.min(until,Math.max(0,((flight.lastAt||event.time)-event.time)/1000));
  const owner=world.profiles?.[event.owner]||null,bomb=!!event.bomb;
  const size=Math.max(1,Math.min(3,Number(flight.bombSize)||1));
  // A sphere fitted to the thrown art meets real upright player/monster
  // capsules. Never use the previous generous 2.5m centre-to-centre
  // proximity sphere, which displayed HP damage before visible contact.
  const artRadius=.65+size*.20;
  const tracked=(field,key)=>flight[field]?.includes(key);
  const mark=(field,key)=>{flight[field]??=[];flight[field].push(key);};
  const hitPlayer=(target)=>{
   if(tracked('hitActors',target.key)||target.key===event.owner||
      target.role!=='fighter'||insideSafeZone(target.position))return;
   const maxHp=world.profiles?.[target.key]?.maxHp||100;
   const damage=artBombDamage(maxHp,rng);
   const hit=damagePlayer(world,owner,target,damage,now,bomb?'art-bomb':'artwork',
    event.origin,'art-explosion',[target.position[0],target.position[1]+1,target.position[2]],damage>=maxHp);
   mark('hitActors',target.key);if(hit)changed=true;
  };
  const hitMonster=(mob)=>{
   if(!mob?.active||tracked('hitMonsters',mob.id))return;
   const damage=rng()<.5?mob.hp:68*event.power;
   const hit=damageMonster(world,owner,damage,now,rng,'artwork',mob);
   mark('hitMonsters',mob.id);if(hit)changed=true;
  };
  const hitStructure=(structure)=>{
   if(structure.owner==='temple'||tracked('hitStructures',structure.id))return;
   mark('hitStructures',structure.id);
   structure.maxHp??=structure.kind==='house'?220:structure.kind==='tree'?90:140;
   const damage=Math.round(70*event.power);
   structure.hp=Math.max(0,structure.hp-damage);
   const hit={id:id(),structureId:structure.id,kind:structure.kind,
    position:[...structure.position],hp:structure.hp,maxHp:structure.maxHp,damage,time:now};
   world.pendingArtworkVisualEvents.push({kind:'structure-hit',event:hit});changed=true;
   if(structure.hp<=0){const destroyed=structureEvent(structure,now);
    world.pendingArtworkVisualEvents.push({kind:'structure-destroyed',event:destroyed});
    world.structures.splice(world.structures.indexOf(structure),1);}
  };
  const hitCity=(lot,point)=>{
   if(tracked('hitCity',lot.id)||(world.cityDamage?.[lot.id]?.hp??CITY_MAX_HP)<=0)return;
   mark('hitCity',lot.id);
   const result=damageCityLot(world,lot,'masonry',Math.round(70*event.power),now,point);
   if(!result)return;
   world.pendingArtworkVisualEvents.push({kind:'structure-hit',event:result.event});
   if(result.destroyed)world.pendingArtworkVisualEvents.push({kind:'structure-destroyed',event:result.destroyed});
   changed=true;
  };
  const check=(p,blast=false)=>{
   const point=Array.isArray(p)?p:[...p];
   for(const target of actors){
    if(tracked('hitActors',target.key)||target.key===event.owner||target.role!=='fighter')continue;
    const centre=[target.position[0],target.position[1]+1,target.position[2]];
    const horizontal=Math.max(0,Math.hypot(point[0]-target.position[0],
      point[2]-target.position[2])-1.02);
    const vertical=Math.max(0,target.position[1]-point[1],
      point[1]-(target.position[1]+2.35));
    const touching=blast?artworkBlastHits(point,centre):
     Math.hypot(horizontal,vertical)<=artRadius;
    if(touching)hitPlayer(target);
   }
   for(const mob of [world.monster,...(world.monsters||[])]){
    if(!mob?.active||tracked('hitMonsters',mob.id))continue;
    const centre=[mob.position[0],mob.position[1]+1.25,mob.position[2]];
    const monsterRadius=Math.max(.5,Number(mob.bodyRadius)||ENEMY_RADIUS);
    const monsterHeight=Math.max(1,Number(mob.bodyHeight)||ENEMY_HEIGHT);
    const horizontal=Math.max(0,Math.hypot(point[0]-mob.position[0],
      point[2]-mob.position[2])-monsterRadius);
    const vertical=Math.max(0,mob.position[1]-point[1],
      point[1]-(mob.position[1]+monsterHeight));
    const touching=blast?artworkBlastHits(point,centre):
     Math.hypot(horizontal,vertical)<=artRadius;
    if(touching)hitMonster(mob);
   }
   for(const structure of [...(world.structures||[])]){
    if(structure.owner==='temple'||tracked('hitStructures',structure.id))continue;
    const vertical=point[1]>=structure.position[1]-artRadius&&
     point[1]<=structure.position[1]+structureHeight(structure)+artRadius;
    const touching=blast?artworkBlastHits(point,structure.position,ARTWORK_BLAST_RADIUS,structureRadius(structure)):
     vertical&&Math.hypot(point[0]-structure.position[0],point[2]-structure.position[2])<=
       structureRadius(structure)+artRadius;
    if(touching)hitStructure(structure);
   }
   const lots=blast?CITY_LOTS:cityCollisionCandidates(point[0],point[2],artRadius);
   for(const lot of lots){
    if(tracked('hitCity',lot.id)||(world.cityDamage?.[lot.id]?.hp??CITY_MAX_HP)<=0)continue;
    const hp=world.cityDamage?.[lot.id]?.hp??CITY_MAX_HP,roof=cityRoofHeightAtHp(lot,hp);
    const [u,v]=cityLocal(lot,point[0],point[2]);
    const touching=blast?artworkBlastHits(point,
      [lot.x,Math.min(1.5,lot.height/3),lot.z],ARTWORK_BLAST_RADIUS,Math.max(lot.width,lot.depth)*.5):
      Math.abs(u)<=lot.width*.5+artRadius&&Math.abs(v)<=lot.depth*.5+artRadius&&
      point[1]>=-artRadius&&point[1]<=roof+artRadius;
    if(touching)hitCity(lot,[point[0],Math.max(.1,Math.min(roof,point[1])),point[2]]);
   }
  };
  // Catch up through the interval if the DO alarm or a WebGL client stalls.
  if(until>from){
   const steps=Math.max(1,Math.ceil((until-from)/.045));
   for(let i=1;i<=steps;i++)check(artworkPosition(event,from+(until-from)*i/steps));
  }
  if(elapsed>=landing.time){
   check(landing.position,true); // blast begins only AFTER visible landing
   flights.splice(flights.indexOf(flight),1);changed=true;
  }else{
   flight.lastAt=event.time+until*1000;
   changed=true; // persist collision progress and per-target de-duplication
  }
 }
 return changed;
}

export function tickWorld(world,{now=Date.now(),rng=Math.random,activeFighters=0,actors=[]}={}){
  // Apply damage strictly when the server-observed artwork touches a collider.
  const artworkChanged=tickArtworkFlights(world,actors,now,rng);
  migrateWorld(world,now);
  // The same authoritative damage/death/shield pipeline used by combat
  // processes Collector bullets. Fixed 50 HP ignores armour and shields,
  // but respects respawn protection and GM invincibility.
  let changed=tickCollector(world,actors,now,rng,(actor,from,damage)=>
   damagePlayer(world,null,actor,damage,now,'collector',from,'collector-shot',
    [actor.position[0],actor.position[1]+1.15,actor.position[2]],false,false,true)
  )||artworkChanged;
  for(const profile of Object.values(world.profiles||{})){
   if(profile.channelWeapon&&!isLiveStaffChannel(profile,now)){
    // Clear orphaned continuous-cast state before validating later movement.
    profile.channelWeapon=null;profile.channelStartedAt=0;
    profile.lastChannelPulseAt=0;profile.lastBloomHealAt=0;
    delete profile.prismChannelStats;
    delete profile.tidalChannelStats;
    if(world.prismLocks?.[profile.key])delete world.prismLocks[profile.key];
    if(world.tidalLocks?.[profile.key])delete world.tidalLocks[profile.key];
    world.persistentAttacks=(world.persistentAttacks||[]).filter(fx=>
     !(fx.owner===profile.key&&fx.channel));
    changed=true;
   }
   changed=tickBloomChannelHeal(profile,now)>0||changed;
  }
  changed=tickPersistentAttacks(world,actors,now,rng)||changed;
  changed=tickPrismChannels(world,actors,now,rng)||changed;
  changed=tickTidalChannels(world,actors,now,rng)||changed;
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
  if(world.monster.active){const monster=world.monster;monster.model=ISLAND_ENEMIES.includes(monster.model)?monster.model:ISLAND_ENEMIES[(monster.generation||0)%ISLAND_ENEMIES.length];if(insideArtSanctuary(monster.position)){monster.position=[...MONSTER_SPAWNS[(monster.generation||0)%MONSTER_SPAWNS.length]];monster.skills=[];}monster.attackStyles=true;monster.level??=1+(monster.generation||0)%12;monster.damage=12+monster.level*2;monster.bodyHeight=ENEMY_HEIGHT;monster.bodyRadius=ENEMY_RADIUS;monster.position[1]=0;const fighters=actors.filter(a=>a.role==='fighter'&&world.profiles[a.key]?.hp>0&&!insideArtSanctuary(a.position));monster.lastPosition=[...monster.position];advanceIslandEnemy(monster,fighters,now,{disabled:!!monster.panBlastFlight||!!monster.whipPull||!!monster.vortexSpin&&now<monster.vortexSpin.time+VORTEX_SPIN_MS||!!effectActive(monster,'stun',now)||!!effectActive(monster,'root',now)||!!effectActive(monster,'freeze',now),silenced:!!effectActive(monster,'paralysis',now),slow:effectActive(monster,'root',now)?1:effectActive(monster,'slow',now)?.power||0,move:(target,distance)=>{
 const confused=effectActive(monster,'confuse',now);
 if(confused){
  const angle=(now/210+(monster.generation||0)*2.4)%(Math.PI*2);
  return moveMonster(world,monster,[monster.position[0]+Math.cos(angle)*8,monster.position[1],monster.position[2]+Math.sin(angle)*8],distance);
 }
 return moveMonster(world,monster,target,distance);
},hit:(target,amount,skill)=>{const result=damagePlayer(world,null,target,skill?.motion==='venom'?5:amount*(1-(effectActive(monster,'weak',now)?.power||0)),now,'monster',target.position,'normal',null,false,false,skill?.motion==='venom');applyMonsterImpactReaction(world.profiles[target.key],target,skill,now);return result;}});if(!monster.panBlastFlight&&!monster.whipPull&&!monster.vortexSpin&&effectActive(monster,'confuse',now)){
 const angle=(now/217+(monster.generation||0)*1.73)%(Math.PI*2);
 moveMonster(world,monster,[monster.position[0]+Math.cos(angle)*8,monster.position[1],monster.position[2]+Math.sin(angle)*8],.21);
}else if(!monster.panBlastFlight&&!monster.whipPull&&!monster.vortexSpin&&!effectActive(monster,'root',now)&&!effectActive(monster,'freeze',now)&&
 !monster.aggroTarget&&!fighters.some(a=>distance2d(a.position,monster.position)<18))
 patrolMonster(monster,now,rng,(target,distance)=>moveMonster(world,monster,target,distance));
 advancePanBlastMonster(monster,now);advanceWhipPullMonster(world,monster,now);advanceVortexMonster(world,monster,now);changed=true;}
  if(activeFighters>0){
   for(const mob of world.monsters||[]){
    if(!mob?.active)continue;
    if(insideArtSanctuary(mob.position)){mob.position=[...MONSTER_SPAWNS[(mob.slot||0)%MONSTER_SPAWNS.length]];}
    mob.bodyHeight=ENEMY_HEIGHT;mob.bodyRadius=ENEMY_RADIUS;
    const fighters=actors.filter(a=>a.role==='fighter'&&world.profiles[a.key]?.hp>0&&!insideArtSanctuary(a.position));
    mob.lastPosition=[...mob.position];advanceIslandEnemy(mob,fighters,now,{disabled:!!mob.panBlastFlight||!!mob.whipPull||!!mob.vortexSpin&&now<mob.vortexSpin.time+VORTEX_SPIN_MS||!!effectActive(mob,'stun',now)||!!effectActive(mob,'root',now)||!!effectActive(mob,'freeze',now),silenced:!!effectActive(mob,'paralysis',now),slow:effectActive(mob,'root',now)?1:effectActive(mob,'slow',now)?.power||0,
     move:(target,distance)=>{
       const confused=effectActive(mob,'confuse',now);
       if(confused){
        const angle=(now/210+(mob.generation||0)*2.4+(mob.id?.length||0))%(Math.PI*2);
        return moveMonster(world,mob,[mob.position[0]+Math.cos(angle)*8,mob.position[1],mob.position[2]+Math.sin(angle)*8],distance);
       }
       return moveMonster(world,mob,target,distance);
      },hit:(target,amount,skill)=>{const result=damagePlayer(world,null,target,skill?.motion==='venom'?5:amount*(1-(effectActive(mob,'weak',now)?.power||0)),now,'monster',mob.position,'normal',null,false,false,skill?.motion==='venom');applyMonsterImpactReaction(world.profiles[target.key],target,skill,now);return result;}});
    if(!mob.panBlastFlight&&!mob.whipPull&&!mob.vortexSpin&&effectActive(mob,'confuse',now)){
 const angle=(now/217+(mob.slot||0)*1.73)%(Math.PI*2);
 moveMonster(world,mob,[mob.position[0]+Math.cos(angle)*8,mob.position[1],mob.position[2]+Math.sin(angle)*8],.21);
}else if(!mob.panBlastFlight&&!mob.whipPull&&!mob.vortexSpin&&!effectActive(mob,'root',now)&&!effectActive(mob,'freeze',now)&&
 !mob.aggroTarget&&!fighters.some(a=>distance2d(a.position,mob.position)<18))
 patrolMonster(mob,now,rng,(target,distance)=>moveMonster(world,mob,target,distance));
    advancePanBlastMonster(mob,now);advanceWhipPullMonster(world,mob,now);advanceVortexMonster(world,mob,now);changed=true;
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
// The Worker owns every city's health and four independent component pools.
const CITY_PART_HEALTH=Object.freeze({windows:36,pillars:74,sheets:48,masonry:105});
function damageCityLot(world,lot,part,damage,now,position=null){
 world.cityDamage??={};
 const previous=world.cityDamage[lot.id];
 if(previous?.hp===0)return null;
 const state=previous||{hp:CITY_MAX_HP,maxHp:CITY_MAX_HP,parts:{}};
 const previousHp=state.hp;
 const previousStage=cityStage(state.hp,CITY_MAX_HP);
 const previousTier=cityDamageTier(state.hp,CITY_MAX_HP);
 const base=String(part||'masonry').split('-')[0];
 const kind=Object.hasOwn(CITY_PART_HEALTH,base)?String(part):'masonry';
 const hp=state.parts[kind]??CITY_PART_HEALTH[base in CITY_PART_HEALTH?base:'masonry'];
 const partDestroyed=hp>0&&hp<=damage;
 state.parts[kind]=Math.max(0,hp-damage);
 state.hp=Math.max(0,state.hp-damage);
 world.cityDamage[lot.id]=state;
 const stage=cityStage(state.hp,CITY_MAX_HP);
 const tier=cityDamageTier(state.hp,CITY_MAX_HP);
 const event={id:id(),structureId:lot.id,cityLotIndex:lot.index,kind:'city-house',part:kind,
  partDestroyed,stage,previousStage,previousHp,previousTier,tier,
  position:position||[lot.x,Math.min(2,lot.height*.5),lot.z],
  hp:state.hp,maxHp:CITY_MAX_HP,damage,time:now};
 return {event,destroyed:stage===3?{...event,id:lot.id,rotation:lot.yaw}:null};
}
function cityWeaponHits(world,origin,direction,range,area,damage,now){
 const hits=[],destroyed=[];
 if(area&&['area','sector'].includes(area.mode)){
  for(const lot of CITY_LOTS){
   if((world.cityDamage?.[lot.id]?.hp??CITY_MAX_HP)<=0)continue;
   const point=[lot.x,Math.min(lot.height*.4,1.4),lot.z];
   if(!insideChargedArea(area,point,Math.hypot(lot.width,lot.depth)*.43))continue;
   const result=damageCityLot(world,lot,'masonry',damage,now,point);
   if(result){hits.push(result.event);if(result.destroyed)destroyed.push(result.destroyed);}
   if(hits.length>=24)break;
  }
 }else{
  const target=cityRaycast(origin,direction,range,world.cityDamage);
  if(target){
   const result=damageCityLot(world,target.lot,target.part,damage,now,target.position);
   if(result){hits.push(result.event);if(result.destroyed)destroyed.push(result.destroyed);}
  }
 }
 return {hits,destroyed};
}


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

function advanceVortexMonster(world,mob,now){
 const spin=mob?.vortexSpin;
 if(!spin||!mob.active)return false;
 const point=vortexSpinPoint(spin,now);
 if(point&&now<spin.time+VORTEX_SPIN_MS)
  moveMonster(world,mob,point,Math.hypot(point[0]-mob.position[0],point[2]-mob.position[2]));
 else delete mob.vortexSpin;
 return true;
}

function blastDirection(center,position,fallback=[0,0,1]){
 const dx=position[0]-center[0],dz=position[2]-center[2],length=Math.hypot(dx,dz);
 if(length>.0001)return [dx/length,0,dz/length];
 const fallbackLength=Math.hypot(fallback[0],fallback[2])||1;
 return [-fallback[0]/fallbackLength,0,-fallback[2]/fallbackLength];
}


export const PRISM_DAMAGE_TICK_MS=250;
export function prismDamageMultiplier(durationMs){
 // Each complete second permanently adds 20% to the LOCKED victim's DPS,
 // compounded as requested, with an absolute 5x ceiling.
 return Math.min(5,1.2**Math.max(0,Math.floor((Number(durationMs)||0)/1000)));
}
export function tickPrismChannels(world,actors,now=Date.now(),rng=Math.random){
 const locks=world.prismLocks??={};
 let changed=false;
 // Every live caster has one channel and at most one locked target.
 const active=new Set();
 for(const caster of actors){
  const profile=world.profiles[caster.key],weapon=itemById(profile?.channelWeapon);
  if(caster.role!=='fighter'||!profile||profile.hp<=0||profile.deadUntil>now||
     !weapon||weapon.family!=='beam'||weapon.exotic||
     profile.equipment.weapon!==weapon.id||!isLiveStaffChannel(profile,now))continue;
  active.add(caster.key);
  const params=profile.prismChannelStats;
  if(!params)continue; // A charged channel must emit its first authenticated pulse.
  const range=Math.max(2,Number(params.range)||12);
  const living=[...(world.monster?.active?[{kind:'monster',value:world.monster}]:[]),
    ...(world.monsters||[]).filter(m=>m.active&&m.hp>0).map(value=>({kind:'monster',value})),
    ...actors.filter(a=>a.role==='fighter'&&a.key!==caster.key&&
     world.profiles[a.key]?.hp>0&&world.profiles[a.key]?.deadUntil<=now&&
     !insideSafeZone(a.position)&&!insideArtSanctuary(a.position))
     .map(value=>({kind:'player',value}))];
  const targets=living.map(t=>{
   const v=t.value,point=[v.position[0],v.position[1]+(t.kind==='monster'?(v.bodyHeight||ENEMY_HEIGHT)*.54:1.13),v.position[2]];
   const dx=point[0]-caster.position[0],dy=point[1]-(caster.position[1]+1.16),dz=point[2]-caster.position[2];
   return {...t,key:v.id||v.key,point,distance:Math.hypot(dx,dy,dz)};
  }).filter(t=>t.distance<=range);
  const prior=locks[caster.key];
  const target=targets.find(t=>prior?.targetKey===t.key&&prior?.kind===t.kind)||
    targets.sort((a,b)=>a.distance-b.distance)[0];
  if(!target){
   if(prior){delete locks[caster.key];changed=true;}
   continue;
  }
  let lock=prior;
  if(!lock||lock.targetKey!==target.key||lock.kind!==target.kind){
   lock={targetKey:target.key,kind:target.kind,since:now,lastHitAt:now,
    range,position:[...target.point]};
   locks[caster.key]=lock;changed=true;
  }
  const drift=Math.hypot(...lock.position.map((v,i)=>v-target.point[i]));
  if(drift>.02){lock.position=[...target.point];changed=true;}
  lock.range=range;
  const elapsed=now-lock.lastHitAt;
  if(elapsed<PRISM_DAMAGE_TICK_MS)continue;
  // Limit the backlog from a suspended tab: the beam cannot cause multiple
  // seconds of invisible retroactive damage on a single frame.
  const sample=Math.min(elapsed,500);
  lock.lastHitAt=now;
  const multiplier=prismDamageMultiplier(now-lock.since);
  const base=target.kind==='monster'?params.monsterDps:params.pvpDps;
  const dps=Math.max(0,Number(base)||0)*multiplier;
  if(dps<=0)continue;
  const amount=dps*sample/1000;
  if(target.kind==='monster'){
   damageMonster(world,profile,amount,now,rng,'prism-lock',target.value,target.point);
  }else{
   damagePlayer(world,profile,target.value,amount,now,'prism',caster.position,
    'prism-lock',target.point,false,false,true);
  }
  changed=true;
 }
 for(const key of Object.keys(locks))if(!active.has(key)){
  delete locks[key];changed=true;
 }
 return changed;
}

// Dedicated triple-target tide channels: server decides every target and
// applies DPS on a bounded 250ms cadence. Never trust client-side VFX hits.
export function tickTidalChannels(world,actors,now=Date.now(),rng=Math.random){
 const locks=world.tidalLocks??={};
 let changed=false;
 const active=new Set();
 const monsterTargets=[
  ...(world.monster?.active&&world.monster.hp>0?[{kind:'monster',value:world.monster}]:[]),
  ...(world.monsters||[]).filter(m=>m.active&&m.hp>0).map(value=>({kind:'monster',value}))
 ];
 for(const {value} of monsterTargets){
  const push=value.tidePush;if(!push)continue;
  const progress=Math.min(1,Math.max(0,(now-push.time)/push.durationMs)),delta=Math.max(0,progress-(push.progress||0));
  if(delta>0){const moved=[value.position[0]+push.vector[0]*push.distance*delta,value.position[1],value.position[2]+push.vector[2]*push.distance*delta];if(insideArena(moved,-2)&&!insideArtSanctuary(moved)&&!cityBlocked(moved[0],moved[2],moved[1],world.cityDamage||{},.5))value.position=moved;push.progress=progress;changed=true;}
  if(progress>=1)delete value.tidePush;
 }
 for(const caster of actors){
  const profile=world.profiles[caster.key],weapon=itemById(profile?.channelWeapon);
  if(caster.role!=='fighter'||!profile||profile.hp<=0||profile.deadUntil>now||
     !weapon||!/^tide-[1-5]$/.test(weapon.id)||
     profile.equipment.weapon!==weapon.id||!isLiveStaffChannel(profile,now))continue;
  active.add(caster.key);
  const stats=profile.tidalChannelStats;
  if(!stats)continue;
  const range=Math.max(2,Number(stats.range)||12);
  const candidates=[...monsterTargets,
   ...actors.filter(a=>a.role==='fighter'&&a.key!==caster.key&&
    world.profiles[a.key]?.hp>0&&world.profiles[a.key]?.deadUntil<=now&&
    !insideSafeZone(a.position)&&!insideArtSanctuary(a.position))
   .map(value=>({kind:'player',value}))]
   .map(t=>{
    const v=t.value,point=[v.position[0],v.position[1]+
     (t.kind==='monster'?(v.bodyHeight||ENEMY_HEIGHT)*.54:1.13),v.position[2]];
    const distance=Math.hypot(point[0]-caster.position[0],
     point[1]-(caster.position[1]+1.16),point[2]-caster.position[2]);
    return {...t,key:v.id||v.key,point,distance};
   }).filter(t=>t.distance<=range).sort((a,b)=>a.distance-b.distance);
  const prior=locks[caster.key]?.targets||[];
  const selected=[];
  // Preserve valid locks first so target order doesn't flicker when monsters move.
  for(const old of prior){
   const live=candidates.find(t=>t.kind===old.kind&&t.key===old.targetKey);
   if(live&&!selected.includes(live))selected.push(live);
  }
  for(const candidate of candidates){
   if(selected.length>=3)break;
   if(!selected.some(t=>t.key===candidate.key&&t.kind===candidate.kind))
    selected.push(candidate);
  }
  if(!selected.length){
   if(locks[caster.key]){delete locks[caster.key];changed=true;}
   continue;
  }
  const targets=selected.slice(0,3).map(t=>{
   const previous=prior.find(p=>p.targetKey===t.key&&p.kind===t.kind);
   const lastHitAt=previous?.lastHitAt??now;
   return {targetKey:t.key,kind:t.kind,position:[...t.point],lastHitAt};
  });
  if(prior.length!==targets.length||targets.some((t,i)=>
   t.targetKey!==prior[i]?.targetKey||t.position.some((v,j)=>Math.abs(v-(prior[i]?.position?.[j]??v))>.02)))changed=true;
  const nextPushAt=locks[caster.key]?.nextPushAt??now+TIDE_PUSH_INTERVAL_MS;
  const pushNow=now>=nextPushAt;
  locks[caster.key]={targets,nextPushAt:pushNow?now+TIDE_PUSH_INTERVAL_MS:nextPushAt};
  if(pushNow){
   for(const t of selected.slice(0,3)){
    const victim=t.kind==='player'?world.profiles[t.value.key]:t.value;
    if(!victim||victim.hp<=0||(t.kind==='player'&&(victim.spawnProtectedUntil>now||(victim.admin&&victim.gmInvincible!==false))))continue;
    const dx=t.value.position[0]-caster.position[0],dz=t.value.position[2]-caster.position[2],len=Math.hypot(dx,dz);if(len<.001)continue;
    victim.tidePush={id:id(),time:now,durationMs:TIDE_PUSH_DURATION_MS,distance:TIDE_PUSH_DISTANCE,vector:[dx/len,0,dz/len]};changed=true;
   }
  }
  for(let i=0;i<targets.length;i++){
   const target=selected[i],lock=targets[i];
   const elapsed=now-lock.lastHitAt;
   if(elapsed<TIDE_DAMAGE_TICK_MS)continue;
   const count=Math.min(2,Math.floor(elapsed/TIDE_DAMAGE_TICK_MS));
   // Advance by exact 200ms increments instead of accumulating packet jitter.
   lock.lastHitAt=elapsed>400?now-(elapsed%TIDE_DAMAGE_TICK_MS):lock.lastHitAt+count*TIDE_DAMAGE_TICK_MS;
   const dps=Math.max(0,Number(target.kind==='monster'?stats.monsterDps:stats.pvpDps)||0);
   const amount=dps*TIDE_DAMAGE_TICK_MS/1000;
   if(amount<=0)continue;
   for(let pulse=0;pulse<count;pulse++){
    if(target.kind==='monster'){
     if(!target.value.active||target.value.hp<=0)break;
     damageMonster(world,profile,amount,now,rng,'tidal-lock',target.value,target.point);
    }else{
     if(world.profiles[target.value.key]?.hp<=0)break;
     damagePlayer(world,profile,target.value,amount,now,'tide',caster.position,
      'tidal-lock',target.point,false,false,true);
    }
    changed=true;
   }
  }
 }
 for(const key of Object.keys(locks))if(!active.has(key)){
  delete locks[key];changed=true;
 }
 return changed;
}

// Health is applied once per contact bundle, but every actual fish must
// display its own floating damage number. Split the single server event
// after damage resolution; do not create additional damage or HP changes.
function splitGoldfishDamageNumbers(world,originalEventCount,contacts,center){
 if(contacts<2||!Array.isArray(world.damageEvents)||world.damageEvents.length<=originalEventCount)return;
 const event=world.damageEvents[world.damageEvents.length-1];
 if(!event||!(event.amount>0))return;
 const total=Number(event.amount);
 const share=Math.floor(total*100/contacts)/100;
 const amounts=Array(contacts).fill(share);
 // Exactly preserve authoritative total after decimal rounding.
 amounts[contacts-1]=+(total-share*(contacts-1)).toFixed(2);
 event.amount=amounts[0];
 for(let i=1;i<contacts;i++){
  world.damageSequence=(world.damageSequence||0)+1;
  world.damageEvents.push({...event,id:world.damageSequence,
   amount:amounts[i],position:[
    center[0]+Math.sin(i*2.39996)*(.12+Math.sqrt(i)*.12),
    center[1]+(.08*(i%6)),center[2]+Math.cos(i*2.39996)*(.12+Math.sqrt(i)*.12)
   ]});
 }
 if(world.damageEvents.length>128)world.damageEvents.splice(0,world.damageEvents.length-128);
}

// Timed server-owned abilities: a returning giraffe can hit each target once
// on the outward leg AND once on its return. Four independent fan vortices
// wander for longer at higher qualities. Never trust a client hit report.
function tickPersistentAttacks(world,actors,now,rng){
 const attacks=world.persistentAttacks||[];
 if(!attacks.length)return false;
 let changed=false;
 const potentialTargets=[...(world.monster?.active?[{kind:'monster',value:world.monster}]:[]),
  ...(world.monsters||[]).filter(v=>v.active).map(value=>({kind:'monster',value})),
  ...actors.filter(v=>v.role==='fighter'&&!insideSafeZone(v.position)).map(value=>({kind:'player',value}))];
 for(const fx of attacks){
  // The primary cast owns the endpoint; each borrowed skill retains its own
  // area, directional collider, and independently applied damage rules.
  const targets=potentialTargets;
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
   const palmStorm=/^palm-[1-5]$/.test(weapon.id)&&fx.charge>=1&&fx.area?.mode==='area';
   const alreadyHit=new Set(fx.hits||[]);
   const outcome=(target,position,impact,pellet=null,along=0)=>{
    const enemy=target.value,key=(enemy.id||enemy.key),isPlayer=target.kind==='player';
    if(enemy.key===fx.owner||(isPlayer&&insideSafeZone(enemy.position)))return false;
    // Each echo collider decides eligibility; the primary supplies only its endpoint.
    const hitKey=pellet===null?key:pellet+':'+key;
    const interval=palmStorm?PALM_STORM_TICK_MS:contactDamageIntervalMs(weapon);
    fx.hitTimes??={}; // Per visible projectile, not just the first contact.
    const channelKey=fx.owner+':'+weapon.id+':'+(fx.echo?'echo'+(fx.fusionSlot??0):'main')+':'+hitKey;
    const due=fx.channel?(world.channelContactLocks?.[channelKey]||0):(fx.hitTimes[hitKey]||0);
    if(now<due)return false;
    const modifiers=directHitModifiers(Number.isFinite(fx.critChance)?{...weapon,critChance:fx.critChance}:weapon,{origin:fx.origin,direction:pellet===null?fx.direction:fx.pellets[pellet].direction,range:fx.range},
      {...enemy,island:true,visualScale:isPlayer?1:ENEMY_HEIGHT/1.575},position,now,rng);
    const power=isPlayer?fx.pvpDamage:fx.damage;
    const critical=isPlayer?Math.min(1.14,modifiers.multiplier):modifiers.multiplier;
    const proximity=clamp(1-along/Math.max(1,fx.range),0,1);
    const spread=pellet===null?1:(isPlayer?(.76+.48*proximity)*(.28+1.12*rng()):1.35*(1+1.7*proximity)*(.55+2.45*rng()));
    // The first eligible frost strike freezes for 3s and hits 1.5x.
    // Subsequent ice circles during the target's 6s freeze immunity
    // still deal normal damage and apply a 30% locomotion slow.
    const statusTarget=isPlayer?world.profiles[enemy.key]:enemy;
    const frostProc=weapon.family==='ice'&&fx.charge>=1&&
      !(statusTarget?.effectLocks?.freeze>now);
    const rawDamage=power*critical*spread/(pellet===null?1:fx.pellets.length);
    // No uncharged weapon may bypass the 8-hit baseline through a lucky
    // crit or a ten-ball shotgun burst. The pellets remain individually
    // damaging, with a full 5x+ per-pellet random damage window.
    const pvpCap=weapon.id==='black-cat'?(fx.charge>=1?42:96):
      fx.charge>=1?(pellet===null?29.5:2.95):(pellet===null?13.9:1.39);
    const shotgunPellet=!fx.echo&&isPlayer&&weapon.pattern==='scatter'&&pellet!==null;
    const damage=(shotgunPellet?5+15*rng():isPlayer?Math.min(rawDamage,pvpCap):rawDamage)*(frostProc?1.5:1);
    const lethalHeadshot=!fx.echo&&fx.charge<1&&!fx.shoulderSpread&&isPlayer&&weapon.id==='black-cat'&&sniperHitsHead(
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
       direction:fx.direction,charge:fx.charge,ultimate:fx.charge>=1,
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
   // Fixed three-second Coconut Palm hazard: one server-owned collision pulse
   // at cast/2s, no late hit after 3s. Inherited fusion palm echoes use
   // their existing reduced damage. Skip moving ray and one-shot detonation.
   if(palmStorm){
    fx.pulseCount??=0;
    if(now>=fx.createdAt&&now<fx.expiresAt&&fx.pulseCount<Math.ceil(PALM_STORM_DURATION_MS/PALM_STORM_TICK_MS)&&
       now>=(fx.nextPulseAt??fx.createdAt)){
     fx.pulseCount++;
     fx.nextPulseAt=now+PALM_STORM_TICK_MS;
     for(const target of targets){
      const enemy=target.value;
      if(enemy.key===fx.owner||(target.kind==='player'&&insideSafeZone(enemy.position)))continue;
      const point=[enemy.position[0],enemy.position[1]+(target.kind==='player'?1:1.25),enemy.position[2]];
      if(!insideChargedArea(fx.area,point,target.kind==='player'?1.02:ENEMY_RADIUS))continue;
      if(fx.echo&&fx.parentFootprint&&!insideSpellFootprint(fx.parentFootprint,point))continue;
      const center=[enemy.position[0],enemy.position[1]+(target.kind==='player'?1:ENEMY_HEIGHT*.5),enemy.position[2]];
      if(outcome(target,center,point,null,fx.area.travel))changed=true;
     }
    }
    fx.lastAt=now;
    continue;
   }
   // Charged music-note cyclone sweeps its visible travelling volume each tick.
   // Each touched target has its own 1-second authoritative cooldown.
   const accordionTornado=weapon.id==='accordion'&&fx.charge>=1;
   if(accordionTornado&&now<fx.expiresAt){
    const tip=fx.range*next;
    const tail=Math.max(0,tip-Math.max(5,fx.radius*1.15));
    const start=fx.origin.map((v,i)=>v+fx.direction[i]*tail);
    const length=tip-tail;
    if(length>.001)for(const target of targets){
     const enemy=target.value;
     if(enemy.key===fx.owner||(target.kind==='player'&&insideSafeZone(enemy.position)))continue;
     const distance=target.kind==='player'
      ?rayCylinderDistance(start,fx.direction,length,enemy.position,1.02+fx.radius,2.35)
      :monsterRayDistance(start,fx.direction,length,enemy,fx.radius);
     if(distance===null)continue;
     const center=target.kind==='player'
      ?[enemy.position[0],enemy.position[1]+1,enemy.position[2]]
      :[enemy.position[0],enemy.position[1]+ENEMY_HEIGHT*.5,enemy.position[2]];
     if(fx.echo&&fx.parentFootprint&&!insideSpellFootprint(fx.parentFootprint,center))continue;
     const impact=start.map((v,i)=>v+fx.direction[i]*distance);
     if(outcome(target,center,impact,null,tail+distance))changed=true;
    }
   }
   // Each travelling sphere uses its own independent ray. The server sweeps
   // all travelled segments, so no damage can occur before contact.
   const lanes=fx.pellets||[{direction:fx.direction,radius:fx.radius}];
   const segmentLength=Math.max(0,(next-prev)*fx.range);
   if(segmentLength>.00001&&!accordionTornado&&fx.area?.mode!=='sector'&&!panBlast&&
       !(fx.echo&&fx.area?.mode==='area')&&
       !(weapon.family==='ice'&&fx.charge>=1&&fx.area?.mode==='area')){
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
     if(weapon.family==='saber')return saberWaveCrest(fx.range,f);
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
   if(fx.area?.mode==='area'&&
      (fx.iceGround?now>=fx.createdAt+280&&now<fx.expiresAt:
       next>=(panBlast?Math.max(0,.5-PAN_BLAST_DETONATION_ADVANCE_MS/flight):1))&&
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
     const contactRadius=target.kind==='player'?1.02:ENEMY_RADIUS;
     if(!self&&!(fx.area.shape==='ice-line'?iceEruptionContact(fx.area,groundContact,contactRadius,now-fx.createdAt):insideChargedArea(fx.area,groundContact,contactRadius)))continue;
     if(fx.echo&&fx.parentFootprint&&!insideSpellFootprint(fx.parentFootprint,groundContact))continue;
     if(fx.iceGround&&(fx.iceHits||[]).includes(key))continue;
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
      if(fx.iceGround)(fx.iceHits??=[]).push(key);
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
   if(!accordionTornado&&fx.area?.mode==='corridor'&&fx.charge>=1&&next>=1&&
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
  }else if(fx.kind==='vortex'){
   // Continuous server-owned homing trajectory: target seeking, radius and
   // each 500ms hit always use this single physical vortex center.
   const candidates=targets.filter(t=>t.value.key!==fx.owner&&t.value.hp!==0&&
    !(t.kind==='player'&&insideSafeZone(t.value.position)));
   const viable=candidates.filter(t=>Math.hypot(t.value.position[0]-fx.position[0],
    t.value.position[2]-fx.position[2])<fx.range*.85+6);
   const aim=viable.find(t=>(t.value.id||t.value.key)===fx.targetId)||
    viable.sort((a,b)=>Math.hypot(a.value.position[0]-fx.position[0],a.value.position[2]-fx.position[2])-
      Math.hypot(b.value.position[0]-fx.position[0],b.value.position[2]-fx.position[2]))[0];
   if(aim)fx.targetId=aim.value.id||aim.value.key;
   const start=[...fx.position],elapsed=Math.max(0,now-fx.lastAt);
   advanceHomingVortex(fx,aim?.value,elapsed);
   if(Math.hypot(fx.position[0]-start[0],fx.position[2]-start[2])>.001)changed=true;
   const radius=Math.max(2.1,Math.min(7,fx.radius*.5));
   for(const target of candidates){
    const victim=target.value,key=victim.id||victim.key;
    const victimRadius=target.kind==='monster'?(victim.bodyRadius||ENEMY_RADIUS):1.02;
    if(Math.hypot(victim.position[0]-fx.position[0],victim.position[2]-fx.position[2])>radius+victimRadius||
     Math.abs(victim.position[1]-fx.position[1])>8||(fx.hitTimes?.[key]||0)>now)continue;
    const point=[victim.position[0],victim.position[1]+(target.kind==='monster'?ENEMY_HEIGHT*.5:1),victim.position[2]];
    const hit=target.kind==='monster'?
     damageMonster(world,owner,fx.damage*.12,now,rng,'vortex',victim,point):
     damagePlayer(world,owner,victim,(fx.pvpDamage||12)*.18,now,'vortex',fx.origin,'vortex',point);
    if(!hit||hit.immune)continue;
    fx.hitTimes??={};fx.hitTimes[key]=now+VORTEX_DAMAGE_INTERVAL_MS;
    changed=true;
    if(hit.defeated)continue;
    const status=target.kind==='monster'?victim:world.profiles[victim.key];
    if(status&&now>=(status.vortexSpinCooldownUntil||0)){
     status.vortexSpin={id:id(),time:now,durationMs:VORTEX_SPIN_MS,
      center:[fx.position[0],fx.position[2]],start:[...victim.position]};
     status.vortexSpinCooldownUntil=now+VORTEX_SPIN_LOCK_MS;
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
     if(target.kind==='player'&&insideSafeZone(value.position))continue; // only the protected 9m WRITE hub is immune
     // A distinct outbound or returning physical contact gets one hit per pass.
     const contact=target.kind==='monster'?monsterRayDistance(a,direction,length,value,1.35*fx.radius):
      rayCylinderDistance(a,direction,length,value.position,1+fx.radius,2.35);
     if(contact===null)continue;
     seen.push(value.id||value.key);
     // Each leg has its own seen set, preventing repeated hits while allowing both passes.
     const center=[value.position[0],value.position[1]+(target.kind==='monster'?ENEMY_HEIGHT*.5:1),value.position[2]];
     const hit=target.kind==='monster'
      ?damageMonster(world,owner,fx.damage*.53,now,rng,leg==='out'?'boomerang-out':'boomerang-return',value,center)
      :damagePlayer(world,owner,value,(fx.pvpDamage||12)*.62,now,'boomerang',fx.origin,leg==='out'?'boomerang-out':'boomerang-return',center);
     if(hit&&!hit.immune&&!hit.defeated)applyElementalHit(
      target.kind==='monster'?value:world.profiles[value.key],owner,
      {family:'lightning',element:'electric'},now,fx.echo?.2:1);
     changed=true;
    }
    // The revolving soft rod can also strike the real building footprint.
    // Check along the identical sine-wave outbound/return path, rather
    // than damaging houses at the instant the player presses A.
    const stepCount=Math.max(1,Math.ceil(length/.75));
    // One real building contact per outward and RETURN pass; not one for both.
    const structureSeen=leg==='out'?(fx.structureOutHitIds??=[]):(fx.structureBackHitIds??=[]);
    const citySeen=leg==='out'?(fx.cityOutHitIds??=[]):(fx.cityBackHitIds??=[]);
    for(let j=0;j<=stepCount;j++){
     const t=j/stepCount,point=a.map((v,i)=>v+(b[i]-v)*t);
     for(const structure of [...(world.structures||[])]){
      if(structure.owner==='temple'||structureSeen.includes(structure.id))continue;
      if(Math.abs(point[1]-(structure.position[1]+structureHeight(structure)*.5))>
        structureHeight(structure)*.5+fx.radius)continue;
      if(Math.hypot(point[0]-structure.position[0],point[2]-structure.position[2])>
        fx.radius+structureRadius(structure))continue;
      structureSeen.push(structure.id);
      structure.maxHp??=structure.kind==='house'?220:structure.kind==='tree'?90:140;
      const damage=Math.max(8,Math.round(fx.damage*.5));
      structure.hp=Math.max(0,structure.hp-damage);
      const hit={id:id(),structureId:structure.id,kind:structure.kind,position:[...structure.position],
       hp:structure.hp,maxHp:structure.maxHp,damage,time:now};
      world.pendingArtworkVisualEvents??=[];
      world.pendingArtworkVisualEvents.push({kind:'structure-hit',event:hit});
      if(structure.hp<=0){
       const destroyed=structureEvent(structure,now);
       world.pendingArtworkVisualEvents.push({kind:'structure-destroyed',event:destroyed});
       world.structures.splice(world.structures.indexOf(structure),1);
      }
      changed=true;
     }
     // Broadphase prevents a 432-house scan during each boomerang step.
     for(const lot of cityCollisionCandidates(point[0],point[2],fx.radius)){
      if(citySeen.includes(lot.id)||(world.cityDamage?.[lot.id]?.hp??CITY_MAX_HP)<=0)continue;
      const [u,v]=cityLocal(lot,point[0],point[2]);
      const hp=world.cityDamage?.[lot.id]?.hp??CITY_MAX_HP;
      if(Math.abs(u)>lot.width*.5+fx.radius||Math.abs(v)>lot.depth*.5+fx.radius||
       point[1]<-fx.radius||point[1]>cityRoofHeightAtHp(lot,hp)+fx.radius)continue;
      citySeen.push(lot.id);
      const hitPoint=[point[0],Math.max(.1,Math.min(point[1],lot.height)),point[2]];
      const impact=damageCityLot(world,lot,'masonry',Math.max(8,Math.round(fx.damage*.5)),now,hitPoint);
      if(impact){
       world.pendingArtworkVisualEvents??=[];
       world.pendingArtworkVisualEvents.push({kind:'structure-hit',event:impact.event});
       if(impact.destroyed)
        world.pendingArtworkVisualEvents.push({kind:'structure-destroyed',event:impact.destroyed});
       changed=true;
      }
     }
    }
   }
  }else if(fx.kind==='goldfish'){
   // Prioritize real living players, not the shooter, even off-axis/behind.
   // Once acquired, keep a valid target until it dies or leaves homing reach.
   const nearby=targets.filter(t=>{
    const value=t.value,p=t.kind==='player'?world.profiles[value.key]:null;
    if(value.key===fx.owner||value.id===fx.owner)return false;
    if(t.kind==='player'&&(!p||p===owner||p.hp<=0||p.deadUntil>now||p.spawnProtectedUntil>now||
      (p.admin&&p.gmInvincible!==false)||insideArtSanctuary(value.position)))return false;
    if(t.kind==='monster'&&(!value.active||value.hp<=0))return false;
    return Math.hypot(value.position[0]-fx.position[0],value.position[2]-fx.position[2])<=fx.range+GOLDFISH_SCHOOL_RADIUS*2;
   });
   const players=nearby.filter(t=>t.kind==='player'),pool=players.length?players:nearby;
   const aim=pool.find(t=>(t.value.key||t.value.id)===fx.targetId)||
    pool.sort((a,b)=>Math.hypot(a.value.position[0]-fx.position[0],a.value.position[2]-fx.position[2])-
     Math.hypot(b.value.position[0]-fx.position[0],b.value.position[2]-fx.position[2]))[0];
   if(aim)fx.targetId=aim.value.key||aim.value.id;else delete fx.targetId;
   const previous=[...fx.position],heading=[...fx.direction];
   advanceGoldfishSchool(fx,aim?.value,Math.max(0,Math.min(now,fx.expiresAt)-fx.lastAt),flight);
   const travelled=Math.hypot(fx.position[0]-previous[0],fx.position[1]-previous[1],fx.position[2]-previous[2]);
   if(travelled>.001)changed=true;
   // One authoritative flight; thirty swept fish bodies with independent,
   // once-per-victim hit histories. Each body deals exactly 20% of the old
   // fish's hit damage. One knockback/status per victim avoids 30 teleports.
   if(travelled>.001){
    fx.fishConsumed??=[];
    for(const target of targets){
     const value=target.value,key=value.key||value.id;
     if(value.key===fx.owner||value.id===fx.owner||value.hp===0||
         (target.kind==='player'&&(!world.profiles[value.key]||world.profiles[value.key]===owner||world.profiles[value.key].hp<=0||world.profiles[value.key].deadUntil>now||world.profiles[value.key].spawnProtectedUntil>now||(world.profiles[value.key].admin&&world.profiles[value.key].gmInvincible!==false)||insideArtSanctuary(value.position))))continue;
     let contacts=0;
     for(let i=0;i<GOLDFISH_SCHOOL_COUNT;i++){
      if(fx.fishConsumed.includes(i))continue;
      const a=goldfishSchoolPosition(previous,heading,i);
      const b=goldfishSchoolPosition(fx.position,fx.direction,i);
      const delta=b.map((v,j)=>v-a[j]),length=Math.hypot(...delta);
      if(length<.0001)continue;
      const direction=delta.map(v=>v/length),radius=GOLDFISH_CONTACT_RADIUS*Math.max(.7,fx.tier*.15+.6);
      const collision=target.kind==='monster'
       ?monsterRayDistance(a,direction,length,value,radius)
       :rayCylinderDistance(a,direction,length,value.position,1.02+radius,2.35+radius);
      if(collision===null)continue;
      fx.fishConsumed.push(i);contacts++;
      world.goldfishImpactEvents??=[];
      world.goldfishImpactEvents.push({
       attackId:fx.id,fishIndex:i,time:now,position:a.map((v,j)=>v+direction[j]*collision)
      });
      if(world.goldfishImpactEvents.length>128)
       world.goldfishImpactEvents.splice(0,world.goldfishImpactEvents.length-128);
     }
     if(!contacts)continue;
     const center=[value.position[0],value.position[1]+(target.kind==='monster'?ENEMY_HEIGHT*.5:1),value.position[2]];
     const first=!(fx.hitTimes?.[key]);
     fx.hitTimes??={};fx.hitTimes[key]=now;
     // T1 normal direct damage = at most 3 per fish, 90 for all 30.
     // Persistent hit tracking already grants each fish ONE hit per target.
     // Preserve the 20%-strength rule for an inherited fusion echo.
     fx.damageSpent??={};
     const totalBudget=goldfishDirectHitBudget(fx.tier,fx.echo);
     const remaining=Math.max(0,totalBudget-(fx.damageSpent[key]||0));
     const perFishCap=GOLDFISH_T1_DAMAGE_PER_FISH*Math.max(1,Math.min(5,fx.tier||1))*(fx.echo?.2:1);
     const baseFish=fx.damage*1.25*GOLDFISH_DAMAGE_PER_FISH;
     const direct=Math.min(remaining,contacts*Math.min(perFishCap,baseFish));
     if(direct<=0)continue;
     const damageEventStart=world.damageEvents?.length||0;
     if(target.kind==='monster'){
      // Soaked/exposed damage multipliers cannot bypass the new budget.
      const amplification=(1+(effectActive(value,'expose',now)?.power||0))*
       (1+(effectActive(value,'soaked',now)?.power||0));
      const raw=Math.min(direct,remaining/Math.max(.001,amplification));
      const result=damageMonster(world,owner,raw,now,rng,'giant-goldfish',value,center);
      fx.damageSpent[key]=(fx.damageSpent[key]||0)+raw*amplification;
      if(result&&!result.defeated&&first){
       if(fx.echo)applyElementalHit(value,owner,itemById('goldfish'),now,.2);
       else applyStatus(world,owner,value,itemById('goldfish'),{
        direction:fx.direction,charge:1,damage:fx.damage,qualityDuration:1
       },now);
       const moved=[value.position[0]+fx.direction[0]*(3+fx.tier*.7)*(fx.echo?.2:1),value.position[1],value.position[2]+fx.direction[2]*(3+fx.tier*.7)*(fx.echo?.2:1)];
       if(insideArena(moved,-2)&&!insideArtSanctuary(moved))value.position=moved;
       value.effects??={};value.effects.stun={owner:fx.owner,power:fx.echo?.2:1,until:now+(fx.echo?160:800),next:now+1000};
      }
     }else{
      const pvpDirect=Math.min(direct,contacts*(fx.pvpDamage||12)*1.08*GOLDFISH_DAMAGE_PER_FISH);
      const hit=damagePlayer(world,owner,value,pvpDirect,now,'goldfish',fx.origin,'giant-goldfish',center);
      fx.damageSpent[key]=(fx.damageSpent[key]||0)+pvpDirect;
      if(hit&&!hit.immune&&first){
       const profile=world.profiles[value.key];
       if(profile?.hp>0){
        if(fx.echo)applyElementalHit(profile,owner,itemById('goldfish'),now,.2);
        else applyStatus(world,owner,profile,itemById('goldfish'),{
         direction:fx.direction,charge:1,damage:fx.pvpDamage,qualityDuration:1
        },now);
       }
       if(profile?.hitReaction){profile.hitReaction.stunMs=fx.echo?100:300;profile.hitReaction.knockback=fx.echo?2.8:14;}
      }
     }
     splitGoldfishDamageNumbers(world,damageEventStart,contacts,center);
     changed=true;
    }
    if(fx.fishConsumed.length>=GOLDFISH_SCHOOL_COUNT)fx.expiresAt=now;
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
// Both ambient patrol and combat pathfinding share these server-owned solid
// house colliders. Sweep each stride to prevent tunnelling across thin walls;
// deterministic sliding preserves movement without entering a facade.
export function moveMonster(world,monster,target,distance){
 const position=monster.position,dx=target[0]-position[0],dz=target[2]-position[2];
 if(Math.hypot(dx,dz)<1e-6||distance<=0)return false;
 const angle=Math.atan2(dz,dx),radius=Math.max(.35,Math.min(1.2,(monster.bodyRadius||.65)*.8));
 const valid=(x,z)=>{
  const p=[x,position[1]||0,z];
  if(!insideArena(p,-2)||insideArtSanctuary(p)||
   cityBlocked(x,z,p[1],world.cityDamage||{},radius))return false;
  return !(world.structures||[]).some(s=>distance2d(p,s.position)<structureRadius(s)+1.1);
 };
 const startX=position[0],startZ=position[2];
 // Historical saves/spawn locations may already sit inside a house. Move
 // an embedded monster to the nearest reachable exterior before pathing.
 if(!valid(startX,startZ)){
  for(let r=1;r<=18;r+=.75){
   let recovered=false;
   for(let a=0;a<16;a++){
    const theta=a*Math.PI/8,ex=startX+Math.cos(theta)*r,ez=startZ+Math.sin(theta)*r;
    if(valid(ex,ez)){position[0]=ex;position[2]=ez;recovered=true;break;}
   }
   if(recovered)break;
  }
  if(!valid(position[0],position[2]))return false;
 }
 for(const offset of [0,.68,-.68,1.2,-1.2,Math.PI]){
  const dirX=Math.cos(angle+offset),dirZ=Math.sin(angle+offset);
  const steps=Math.max(1,Math.ceil(distance/.5));
  let safe=true;
  for(let j=1;j<=steps;j++)if(!valid(position[0]+dirX*distance*j/steps,
    position[2]+dirZ*distance*j/steps)){safe=false;break;}
  if(!safe)continue;
  position[0]+=dirX*distance;position[2]+=dirZ*distance;return true;
 }
 return false;
}
function hashString(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;}

export const CATALOG_VIEW=Object.freeze(ITEMS.map(item=>Object.freeze({...item})));
export const SHOP_VIEW=Object.freeze(SHOP_ITEMS.map(item=>Object.freeze({...item})));

export function setSkyBaseColor(world,isGM,color){
 if(!isGM)return {error:'GM only'};
 if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))return {error:'Invalid sky color'};
 world.environment={...world.environment,skyBaseColor:color.toLowerCase()};
 world.revision=(world.revision||0)+1;
 return {notice:'Sky color saved for all players',environment:clone(world.environment)};
}
export function removeSelectedArtworks(world,isGM,ids){
 if(!isGM)return {error:'GM only'};
 if(!Array.isArray(ids)||!ids.length||ids.length>128||ids.some(id=>typeof id!=='string'))return {error:'Select artwork to delete'};
 const selected=new Set(ids),records=world.customArtworks||[],originals=new Set(PLATFORMS.map(p=>p.id)),available=new Set(artworkDefinitions(world).map(p=>p.id));
 if([...selected].some(id=>!available.has(id)))return {error:'Artwork list changed. Reload and retry.'};
 // Original packaged media stays in the repository; tombstones suppress only
 // its display/interaction, not its platform or coin. Uploaded media may be
 // deleted only when no other retained artwork references it.
 world.removedArtworkIds=[...new Set([...(world.removedArtworkIds||[]),...[...selected].filter(id=>originals.has(id))])];
 world.customArtworks=records.filter(a=>!selected.has(a.id));
 const retained=new Set(world.customArtworks.map(a=>a.mediaId));
 const media=[...new Set(records.filter(a=>selected.has(a.id)).map(a=>a.mediaId).filter(id=>id&&!retained.has(id)))];
 for(const id of selected){delete world.artworks?.[id];delete world.artworkLayout?.[id];delete world.artworkLayoutHistory?.[id];}
 world.pendingArtworkFlights=(world.pendingArtworkFlights||[]).filter(f=>!selected.has(f.event?.platformId));
 world.revision=(world.revision||0)+1;
 return {notice:selected.size+' artwork(s) removed',removedArtworks:selected.size,removedArtworkIds:[...selected],removedArtworkMediaIds:media};
}
