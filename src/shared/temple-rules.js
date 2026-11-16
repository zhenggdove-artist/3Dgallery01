import {journeyPose,journeyAction} from './write-journey.js';
import {recoverArtworks} from './artwork-recovery.js';
import {chargedArea,insideChargedArea,spellGroundHeight} from './charge-area.js';
import {discGroundHeight} from './artwork-discs.js';
import {artworkLanding} from './artwork-flight.js';
import {publishArtBomb,resizeArtBomb,updateArtBombAppearance,resetPlayerArtworks,projectileHitsActor,artBombDamage} from './art-bomb.js';
import {addArtwork,artworkDefinitions,validateAppearance} from './artwork-library.js';
import {ECONOMY,ITEMS,MATERIALS,SHOP_ITEMS,STARTER_LOADOUT,EQUIPPABLE_SLOTS,attackStats,itemById,groundDropRoll,monsterDropRoll} from './catalog.js';
import {ARENA_RADIUS,GROUND_DROP_POINTS,MONSTER_SPAWNS,PLATFORMS,PLAYER_SPAWNS,SAFE_ZONE,distance2d,insideArena,insideSafeZone} from './arena.js';
import layoutDefaults from '../../temple-artwork-layout.json' with {type:'json'};
import {ORIGINAL_ACTIONS,originalAction,originalView} from './reletter-actions.js';
import {applyStatus,tickStatus,effectActive} from './combat-status.js';
import {playerStats,refreshStats} from './player-stats.js';
import {fuseOriginal,equippedItem} from './fusion-adapter.js';
import {advanceIslandEnemy,ISLAND_ENEMIES,ENEMY_HEIGHT,ENEMY_RADIUS} from './island-combat.js';
import {spawnMonsterPack,MONSTER_PACK_SIZE} from './monster-pack.js';
import {patrolMonster} from './monster-patrol.js';
import {calicoPellets} from './calico-pellets.js';
import {pvpShotDamage,projectileFlightMs} from './combat-balance.js';
import {isChannelStaff,weaponQuality,channelVisualRadius,GOLDFISH_SWIM_MS,GOLDFISH_SWIM_RADIUS} from './weapon-abilities.js';
import {recordTempleDamage} from './damage-events.js';
import {directHitModifiers} from '../reletter/combat-hit-rules.js';
import {insideArtSanctuary} from './arena.js';
import {replenishHearts} from './heart-pickups.js';
import {cleanLegacyScene} from './scene-cleanup.js';

export const WORLD_VERSION=1;
export const ARTWORK_RESPAWN_MS=30_000;
export const MAX_FIGHTERS=4;
export const MAX_SPECTATORS=2;
const POSITION_LIMIT=60;

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
    profiles:{},
    coins:Object.fromEntries(PLATFORMS.map(p=>[p.id,{availableAt:0}])),
    artworks:Object.fromEntries(PLATFORMS.map(p=>[p.id,{availableAt:0,holder:null,throwEvent:null}])),
    artworkLayout:clone(layoutDefaults.artworkLayout||{}),floatingPlatforms:clone(layoutDefaults.floatingPlatforms||[]),removedPlatformIds:[],persistentAttacks:[],groundDrops:[],structures:[],plants:[],sceneCleanupVersion:1,
    monster:{active:false,nextSpawnAt:now+ECONOMY.monsterIntervalMs,generation:0},monsters:[],
    nextGroundDropAt:now+ECONOMY.groundSpawnMinMs,
    activity:{coinMinted:0,coinBurned:0,itemsSpawned:0,itemsClaimed:0}
  };
}

export function migrateWorld(raw,now=Date.now()){
  const world=raw&&typeof raw==='object'?raw:createInitialWorld(now);
  if(!world.version)world.version=1;
  world.profiles??={};world.coins??={};world.artworks??={};world.artworkLayout??={};world.floatingPlatforms??=clone(layoutDefaults.floatingPlatforms||[]);world.removedPlatformIds??=[];world.persistentAttacks??=[];world.groundDrops??=[];world.structures??=[];world.plants??=[];
  world.activity??={coinMinted:0,coinBurned:0,itemsSpawned:0,itemsClaimed:0};
  for(const p of PLATFORMS){world.coins[p.id]??={availableAt:0};world.artworks[p.id]??={availableAt:0,holder:null,throwEvent:null};if(!world.artworkLayout[p.id]&&layoutDefaults.artworkLayout?.[p.id])world.artworkLayout[p.id]=clone(layoutDefaults.artworkLayout[p.id]);}
  // Old RELETTER farming data must not survive the removal of the Garden game mode.
  if(world.reletter?.garden)delete world.reletter.garden;
  world.monster??={active:false,nextSpawnAt:now+ECONOMY.monsterIntervalMs,generation:0};world.monsters??=[];
  world.nextGroundDropAt??=now+ECONOMY.groundSpawnMinMs;
  return cleanLegacyScene(world);
}

export function createProfile(key,name,color,now=Date.now(),admin=false){
  return {key,name:String(name||'Pilgrim').slice(0,24),color:validColor(color)?color:'#43b59a',admin:!!admin,
    wallet:80,level:1,xp:0,hp:100,maxHp:100,deadUntil:0,inventory:admin?ITEMS.map(item=>item.id):[STARTER_LOADOUT.weapon],equipment:{...STARTER_LOADOUT},
    fusion:{},createdAt:now,updatedAt:now,lastAttackAt:0};
}

export function ensureProfile(world,key,name,color,now=Date.now(),admin=false){
  const current=world.profiles[key]??=createProfile(key,name,color,now,admin);
  if(name)current.name=String(name).slice(0,24);if(validColor(color))current.color=color;current.admin=!!admin;current.updatedAt=now;
  current.wallet=Number.isFinite(current.wallet)?Math.max(0,Math.floor(current.wallet)):0;
  current.level=Math.max(1,Math.floor(current.level||1));current.xp=Math.max(0,Math.floor(current.xp||0));
  current.inventory=Array.isArray(current.inventory)?current.inventory.filter(itemById).slice(0,600):[STARTER_LOADOUT.weapon];
  if(current.admin){const owned=new Set(current.inventory);for(const item of ITEMS)if(!owned.has(item.id)){current.inventory.push(item.id);owned.add(item.id);}}
  if(!current.inventory.includes(STARTER_LOADOUT.weapon))current.inventory.unshift(STARTER_LOADOUT.weapon);
  current.equipment??={...STARTER_LOADOUT};if(current.equipment.weapon&&!itemById(current.equipment.weapon))current.equipment.weapon=STARTER_LOADOUT.weapon;delete current.equipment.rod;delete current.equipment.tool;current.fusion??={};delete current.fish;delete current.lastFishAt;
  refreshStats(world,current,now);
  if(current.deadUntil<=now&&current.hp<=0){current.hp=current.maxHp||100;current.deadUntil=0;}
  return current;
}

export function validColor(value){return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);}
export function validName(value){return typeof value==='string'&&value.trim().length>=1&&value.trim().length<=24&&!/[<>\u0000-\u001f]/.test(value);}

export function publicProfile(profile){
  return {key:profile.key,name:profile.name,color:profile.color,wallet:profile.admin?'∞':profile.wallet,hp:profile.hp,maxHp:profile.maxHp,
    level:profile.level,xp:profile.xp,deadUntil:profile.deadUntil,equipment:clone(profile.equipment),hitReaction:profile.hitReaction||null,admin:profile.admin};
}

export function worldView(world,actorKey,now=Date.now()){
  const profile=world.profiles[actorKey];
  return {version:world.version,revision:world.revision,serverTime:now,
    coins:Object.fromEntries(PLATFORMS.map(p=>[p.id,{available:now>=(world.coins[p.id]?.availableAt||0),availableAt:world.coins[p.id]?.availableAt||0}])),
    artworks:clone(world.artworks),artworkLayout:clone(world.artworkLayout||{}),customArtworks:clone(world.customArtworks||[]),floatingPlatforms:clone(world.floatingPlatforms||[]),removedPlatformIds:clone(world.removedPlatformIds||[]),groundDrops:clone(world.groundDrops),structures:clone(world.structures),plants:clone(world.plants),monster:clone(world.monster),monsters:clone(world.monsters||[]),
    profile:profile?{...publicProfile(profile),stats:playerStats(world,profile,now),inventory:clone(profile.inventory),fusion:clone(profile.fusion),impulse:profile.impulse||null}:null,
    reletter:originalView(world),economy:ECONOMY,damageEvents:clone((world.damageEvents||[]).filter(e=>now-e.time<8000))};
}

function requireFighter(actor){return actor.role==='fighter'?null:{error:'Spectators cannot perform this action'};}
function requireAlive(profile,now){return profile.hp>0&&profile.deadUntil<=now?null:{error:'Wait for respawn'};}
function near(actor,position,radius){return distance2d(actor.position,position)<=radius&&Math.abs((actor.position?.[1]||0)-position[1])<=8;}
function spend(profile,amount,world){if(profile.admin)return true;if(profile.wallet<amount)return false;profile.wallet-=amount;world.activity.coinBurned+=amount;return true;}
function earn(profile,amount,world){if(!profile.admin)profile.wallet+=amount;world.activity.coinMinted+=amount;}
function addItem(profile,itemId){if(!itemById(itemId)||profile.inventory.length>=600)return false;profile.inventory.push(itemId);return true;}

export function validateState(previous,next,elapsedMs,role='fighter',spawn=null,journey=null,now=Date.now(),mobility=null){
  const pose=journeyPose(journey,now);
  if(pose&&role==='fighter')return {state:{position:pose.position,rotation:Math.PI,animation:pose.animation,visible:true}};
  if(!next||!Array.isArray(next.position)||next.position.length!==3||!next.position.every(Number.isFinite)||
     !insideArena(next.position,role==='spectator'?28:2)||!Number.isFinite(next.rotation))
    return {error:'Invalid position',state:previous||null};
  const distanceTo=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const nearSpawn=spawn&&distanceTo(next.position,spawn)<=6;
  if(!previous&&spawn&&!nearSpawn)return {error:'Spawn position rejected',state:{position:spawn,rotation:0,animation:'idle',visible:true}};
  if(previous&&role==='fighter'){
    const elapsed=clamp(elapsedMs/1000,.05,12),distance=distanceTo(next.position,previous.position);
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
    if(distance>allowance&&!justRespawned&&!landedFromWrite)
      return {error:'Movement rejected',state:previous};
  }
  return {state:{position:next.position.map(n=>+n.toFixed(3)),rotation:+next.rotation.toFixed(4),animation:String(next.animation||'idle').slice(0,12),visible:next.visible!==false}};
}

export function applyAction(world,actor,body,context={}){
  const now=context.now??Date.now(),rng=context.rng??Math.random,profile=ensureProfile(world,actor.key,actor.name,actor.color,now,actor.admin);
  if(body.action==='recover-artworks')return recoverArtworks(world,profile.admin);
  if(body.action==='reset-player-artworks')return resetPlayerArtworks(world,profile.admin,now);
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
    case 'unequip':if(!EQUIPPABLE_SLOTS.includes(body.slot))return {error:'Invalid slot'};profile.equipment[body.slot]=null;result={notice:'Unequipped'};break;
    case 'fuse':result=fuse(world,profile,body,rng);break;
    case 'attack':result=attack(world,profile,actor,body,context,now);break;
    case 'monster-hit':return {error:'Use a directional weapon attack'};
    case 'build':result=build(world,profile,actor,body,now,rng);break;
    case 'destroy':result=destroy(world,profile,actor,body,now);break;
    case 'remove-structure':result=removeStructure(world,profile,actor,body,now);break;
    case 'plant':result=plant(world,profile,actor,body,now);break;
    case 'respawn':profile.hp=profile.maxHp;profile.deadUntil=0;profile.lastRespawnAt=now;result={spawn:PLAYER_SPAWNS[context.seatIndex%4]};break;
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
  const drop=world.groundDrops[index];if(drop.expiresAt<=now)return {error:'Drop expired'};if(!near(actor,drop.position,3.2))return {error:'Move closer to the drop'};
  if(drop.owner===actor.key&&now<drop.ownerLockedUntil)return {error:'Drop is still settling'};
  world.groundDrops.splice(index,1);if(drop.kind==='coin')earn(profile,drop.amount,world);else if(drop.kind==='heart'){if(profile.hp>=profile.maxHp){world.groundDrops.splice(index,0,drop);return {error:'Health is full'};}profile.hp=Math.min(profile.maxHp,profile.hp+(drop.amount||25));}else{addItem(profile,drop.itemId);const item=itemById(drop.itemId);if(item&&EQUIPPABLE_SLOTS.includes(item.slot)&&!profile.equipment[item.slot])profile.equipment[item.slot]=item.id;}
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
  const landing=bomb?artworkLanding(event,ground):null,bombSize=world.artworkLayout?.[platformId]?.scale?.[0]||1;
  let hit=null;for(const target of context.actors||[]){if(target.key===actor.key||target.role!=='fighter'||insideSafeZone(target.position))continue;
    const along=project(origin,direction,target.position),ordinaryHit=along>0&&along<18*event.power&&perpendicular(origin,direction,target.position,along)<2.1;
    const collision=bomb?projectileHitsActor(event,target.position,landing.time,bombSize):ordinaryHit;
    if(collision){const maxHp=world.profiles?.[target.key]?.maxHp||100,damage=bomb?artBombDamage(maxHp,context.rng??Math.random):34*event.power;hit=damagePlayer(world,profile,target,damage,now,bomb?'art-bomb':'artwork',actor.position);break;}
  }
  let monsterHit=null;for(const mob of [world.monster,...(world.monsters||[])]){
    if(!mob?.active)continue;
    const along=project(origin,direction,mob.position);
    if(along>0&&along<18*event.power&&perpendicular(origin,direction,mob.position,along)<ENEMY_RADIUS+1){
     monsterHit=damageMonster(world,profile,68*event.power,now,context.rng??Math.random,'artwork',mob);
     break;
    }
   }
  let structureDestroyed=null,structureHit=null;if(!hit&&!monsterHit){for(const structure of world.structures||[]){
    if(structure.owner==='temple')continue;
    const along=project(origin,direction,structure.position);
    if(along>0&&along<18*event.power&&perpendicular(origin,direction,structure.position,along)<structureRadius(structure)){
     structure.maxHp??=structure.kind==='house'?220:structure.kind==='tree'?90:140;
     const damage=Math.round(70*event.power);
     structure.hp=Math.max(0,structure.hp-damage);
     structureHit={id:id(),structureId:structure.id,kind:structure.kind,position:[...structure.position],hp:structure.hp,maxHp:structure.maxHp,damage,time:now};
     if(structure.hp<=0){structureDestroyed=structureEvent(structure,now);world.structures.splice(world.structures.indexOf(structure),1);}
     break;
    }
   }}
  return {throwEvent:event,hit,monsterHit,structureHit,structureDestroyed,notice:monsterHit?.defeated?'Monster defeated · loot dropped':structureDestroyed?'Artwork shattered a structure':undefined};
}

function buy(world,profile,body){const item=SHOP_ITEMS.find(entry=>entry.id===body.itemId);if(!item)return {error:'Item is not sold'};if(profile.inventory.includes(item.id)&&item.slot!=='seed')return {error:'Already owned'};if(profile.inventory.length>=600)return {error:'Inventory full'};if(!spend(profile,item.price,world))return {error:'Not enough coins'};profile.inventory.push(item.id);profile.itemOrigins??={};profile.itemOrigins[item.id]='shop';return {notice:`Purchased ${item.name}`};}
function sell(world,profile,body){const item=itemById(body.itemId),index=profile.inventory.indexOf(body.itemId);if(!item||index<0)return {error:'Item is not owned'};if(item.id===STARTER_LOADOUT.weapon||Object.values(profile.equipment).includes(item.id))return {error:'Unequip this item before selling'};profile.inventory.splice(index,1);earn(profile,item.sell||Math.floor((item.price||0)*.25),world);return {notice:`Sold ${item.name} · +${item.sell||0} coins`};}
function equip(profile,body){const item=itemById(body.itemId);if(!item||!profile.inventory.includes(item.id)||!EQUIPPABLE_SLOTS.includes(item.slot))return {error:'Item is not owned'};profile.equipment[item.slot]=item.id;return {notice:`Equipped ${item.name}`};}

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

function fuse(world,profile,body,rng){
  const source=itemById(body.sourceId),target=itemById(body.targetId),requestId=String(body.requestId||'');
  if(requestId.length<8||requestId.length>80)return {error:'Missing fusion request ID'};profile.fusionReceipts??={};if(profile.fusionReceipts[requestId])return clone(profile.fusionReceipts[requestId]);
  if(source?.slot!=='material'&&source&&target){const result=fuseOriginal(world,profile,body,rng);if(!result.error)profile.fusionReceipts[requestId]=clone(result);return result;}
  if(!source||!target||source.id===target.id||!['weapon','material'].includes(source.slot)||target.slot!=='weapon')return {error:'Choose a weapon or material and a different target weapon'};
  const sourceIndex=profile.inventory.indexOf(source.id),targetIndex=profile.inventory.indexOf(target.id);if(sourceIndex<0||targetIndex<0)return {error:'Weapons are not owned'};
  const layer=(profile.fusion[target.id]?.layer||0)+1,cost=ECONOMY.fusionBaseCost*layer;if(!spend(profile,cost,world))return {error:'Not enough coins for fusion'};
  profile.inventory.splice(sourceIndex,1);const materialBonus={"wet-stone":3.5,"signal-wire":6,"temple-resin":10}[source.id]||0,success=rng()<Math.max(.18,(source.slot==='material'?.82:.72)-layer*.09),gain=source.slot==='weapon'?source.damage*.2:materialBonus;if(success)profile.fusion[target.id]={layer,bonus:+((profile.fusion[target.id]?.bonus||0)+gain).toFixed(2),source:source.id};
  const result={notice:success?`Fusion succeeded · ${target.name} +${layer}`:'Fusion failed · material consumed',fusion:{success,target:target.id,layer:success?layer:layer-1,cost}};
  profile.fusionReceipts[requestId]=result;const keys=Object.keys(profile.fusionReceipts);if(keys.length>64)delete profile.fusionReceipts[keys[0]];return result;
}

function attack(world,profile,actor,body,context,now){
  if(profile.hitReaction&&now-profile.hitReaction.time<profile.hitReaction.stunMs)return {error:'Recovering from hit'};
  const weapon=equippedItem(profile,itemById(profile.equipment.weapon)||itemById(STARTER_LOADOUT.weapon)),bonus=profile.fusion[weapon.id]?.bonus||0;
  if(body.phase==='channel-start'){
    if(!isChannelStaff(weapon))return {error:'Only staffs support continuous casting'};
    // A staff is silent during a hold. Continuous magic only becomes legal
    // once the ORIGINAL charge request has reached the weapon's full time.
    if(!profile.chargeStartedAt||now-profile.chargeStartedAt<(weapon.chargeMs||1500))
      return {error:'Charge must reach 100% before channeling'};
    profile.channelWeapon=weapon.id;
    profile.channelStartedAt=profile.chargeStartedAt;
    profile.lastChannelPulseAt=now;
    return {channeling:true};
  }
  if(body.phase==='channel-stop'){
    profile.channelWeapon=null;profile.channelStartedAt=0;profile.chargeStartedAt=0;
    profile.lastChannelPulseAt=0;return {channeling:false};
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
  if(channel)stats.range=Math.max(stats.range,weapon.id==='clam'?10:Math.min(18,weapon.range));
  stats.range=+(stats.range*quality.range).toFixed(2);
  // The narrow server collision tube must agree with the visible spray and
  // the original blue #59 rectangle. Non-channel charged AoEs stay intact.
  stats.radius=channel?channelVisualRadius(weapon,quality,stats.range):
   +(stats.radius*quality.radius).toFixed(2);
  const origin=[actor.position[0],actor.position[1]+1,actor.position[2]],combo=stats.ultimate?6:now-(profile.lastComboAt||0)<1200?((profile.combo||0)+1)%6:0;if((weapon.firstPerson||isChannelStaff(weapon)||weapon.family==='saber')&&Array.isArray(body.origin)&&body.origin.length===3&&body.origin.every(Number.isFinite)&&Math.hypot(...body.origin.map((v,i)=>v-actor.position[i]))<=3)origin.splice(0,3,...body.origin);stats.damage=+(stats.damage*playerStats(world,profile,now).attack*.1).toFixed(3);profile.combo=combo;profile.lastComboAt=now;
  const groundForSpell=(x,z,y)=>spellGroundHeight(world,x,z,y);
  // The goldfish ultimate is an actual travelling creature, not a splash at a distant ground marker.
  const area=stats.ultimate&&weapon.id!=='goldfish'?chargedArea(weapon,origin,direction,stats,groundForSpell,channel):null;
  const pellets=weapon.pattern==='scatter'?calicoPellets(direction,stats.ultimate,now):null;
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
      damage:stats.damage+bonus*.1,pvpDamage,radius:swimmingFish?GOLDFISH_SWIM_RADIUS*quality.visual:Math.max(2,stats.radius)*quality.radius,tier:quality.tier,
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
    const duration=projectileFlightMs(weapon,stats.ultimate);
    world.persistentAttacks??=[];
    world.persistentAttacks.push({
      id:id(),kind:'projectile',owner:actor.key,weapon:weapon.id,
      origin:[...origin],direction:[...direction],range:stats.range,
      radius:stats.radius,area,damage:stats.damage+bonus*.1,pvpDamage,charge,
      qualityDuration:quality.duration,qualityScale:quality.visual,
      pellets:pellets?.map(p=>({...p,radius:p.radius*quality.visual}))||null,
      hits:[],pelletHits:{},areaResolved:false,
      createdAt:now,lastAt:now,expiresAt:now+duration
    });
    if(world.persistentAttacks.length>40)world.persistentAttacks.splice(0,world.persistentAttacks.length-40);
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
  return {structureHit,structureDestroyed,structureHits,structureDestroyedEvents,attackEvent:{id:id(),owner:actor.key,origin,direction,aimPoint:weapon.firstPerson?origin.map((v,i)=>v+direction[i]*stats.range):null,impactPoint:monsterHit?.position||(hit?.target?(()=>{const p=(context.actors||[]).find(a=>a.key===hit.target)?.position;return p?[p[0],p[1]+1,p[2]]:null;})():null),weapon:weapon.id,family:weapon.family,color:weapon.color,charge,combo,area,qualityTier:quality.tier,qualityScale:quality.visual,qualityDuration:quality.duration,channel,pellets:pellets?.map(p=>p.direction)||null,fusionEffects:profile.fusion[weapon.id]?.effects||[],...stats,time:now},hit,hits,monsterHit,monsterHits:monsterHits.map(x=>x.result)};
}

function damagePlayer(world,sourceProfile,targetActor,amount,now,cause,dropPosition,kind='normal',hitPosition=null){
  const target=world.profiles[targetActor.key];if(!target||target.hp<=0||target.deadUntil>now)return null;
  const stats=refreshStats(world,target,now);if(target.admin){target.hp=target.maxHp;return {target:targetActor.key,damage:0,defeated:false,immune:true};}
  const armor=itemById(target.equipment.armor),reduction=Math.min(.65,(armor?.defense||0)/100);let damage=Math.max(1,+((amount)*(1-reduction)*stats.defense).toFixed(1));
  if(target.shield){const absorbed=Math.min(target.shield.hp,damage);target.shield.hp-=absorbed;target.shield.lastHit=now;damage-=absorbed;}
  damage=Math.min(target.hp,damage);target.hp=Math.max(0,target.hp-damage);if(damage>0){const from=dropPosition||targetActor.position,dx=targetActor.position[0]-from[0],dz=targetActor.position[2]-from[2],length=Math.hypot(dx,dz)||1;target.hitReaction={id:id(),time:now,stunMs:100,vector:[dx/length,0,dz/length]};}
  recordTempleDamage(world,{amount:damage,kind,position:hitPosition||[targetActor.position[0],targetActor.position[1]+1,targetActor.position[2]],owner:sourceProfile?.key,target:targetActor.key},now);
  if(target.hp>0)return {target:targetActor.key,damage,defeated:false};
  target.deadUntil=now+5_000;releasePlayerWorldState(world,targetActor.key,now);if(sourceProfile)addXp(sourceProfile,60);const lost=Math.floor(target.wallet*ECONOMY.deathCoinFraction);target.wallet-=lost;
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

export function tickWorld(world,{now=Date.now(),rng=Math.random,activeFighters=0,actors=[]}={}){
  migrateWorld(world,now);let changed=false;
  changed=tickPersistentAttacks(world,actors,now,rng)||changed;
  if(world.monster?.active)changed=tickStatus(world.monster,now,(owner,amount)=>damageMonster(world,world.profiles[owner],amount,now,rng))||changed;
  for(const mob of world.monsters||[])if(mob?.active)changed=tickStatus(mob,now,(owner,amount)=>damageMonster(world,world.profiles[owner],amount,now,rng,'status',mob))||changed;
  for(const target of actors){const p=world.profiles[target.key];if(p&&!p.admin&&p.hp>0)changed=tickStatus(p,now,(owner,amount)=>damagePlayer(world,world.profiles[owner],target,Math.min(amount,2),now,'status',target.position))||changed;}
  world.groundDrops=world.groundDrops.filter(drop=>drop.expiresAt>now);if(world.groundDrops.length>ECONOMY.maxGroundDrops)world.groundDrops.splice(0,world.groundDrops.length-ECONOMY.maxGroundDrops);
  if(activeFighters>0){changed=replenishHearts(world,now)||changed;changed=spawnMonsterPack(world,now,rng)||changed;}
  if(activeFighters>0&&now>=world.nextGroundDropAt&&world.groundDrops.length<ECONOMY.maxGroundDrops){const point=GROUND_DROP_POINTS[Math.floor(rng()*GROUND_DROP_POINTS.length)],rolled=groundDropRoll(rng);world.groundDrops.push({id:id(),...rolled,position:[...point],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs});world.nextGroundDropAt=now+ECONOMY.groundSpawnMinMs+rng()*(ECONOMY.groundSpawnMaxMs-ECONOMY.groundSpawnMinMs);world.activity.itemsSpawned++;changed=true;}
  if(activeFighters>0&&!world.monster.active&&now>=world.monster.nextSpawnAt){const spawn=MONSTER_SPAWNS[Math.floor(rng()*MONSTER_SPAWNS.length)],variant=['warden','drowned','signal'][Math.floor(rng()*3)],maxHp={warden:420,drowned:520,signal:360}[variant];world.monster={active:true,id:id(),variant,position:[...spawn],hp:maxHp,maxHp,generation:(world.monster.generation||0)+1,spawnedAt:now,nextAttackAt:now+2_000,nextSpawnAt:now+ECONOMY.monsterIntervalMs};changed=true;}
  if(world.monster.active){const monster=world.monster;monster.model=ISLAND_ENEMIES.includes(monster.model)?monster.model:ISLAND_ENEMIES[(monster.generation||0)%ISLAND_ENEMIES.length];if(insideArtSanctuary(monster.position)){monster.position=[...MONSTER_SPAWNS[(monster.generation||0)%MONSTER_SPAWNS.length]];monster.skills=[];}monster.attackStyles=true;monster.level??=1+(monster.generation||0)%12;monster.damage=12+monster.level*2;monster.bodyHeight=ENEMY_HEIGHT;monster.bodyRadius=ENEMY_RADIUS;monster.position[1]=0;const fighters=actors.filter(a=>a.role==='fighter'&&world.profiles[a.key]?.hp>0&&!insideArtSanctuary(a.position));monster.lastPosition=[...monster.position];advanceIslandEnemy(monster,fighters,now,{disabled:!!effectActive(monster,'stun',now)||!!effectActive(monster,'root',now),slow:effectActive(monster,'root',now)?1:effectActive(monster,'slow',now)?.power||0,move:(target,distance)=>moveMonster(world,monster,target,distance),hit:(target,amount)=>damagePlayer(world,null,target,amount*(1-(effectActive(monster,'weak',now)?.power||0)),now,'monster',target.position)});if(!monster.aggroTarget&&!fighters.some(a=>distance2d(a.position,monster.position)<18))patrolMonster(monster,now,rng,(target,distance)=>moveMonster(world,monster,target,distance));changed=true;}
  if(activeFighters>0){
   for(const mob of world.monsters||[]){
    if(!mob?.active)continue;
    if(insideArtSanctuary(mob.position)){mob.position=[...MONSTER_SPAWNS[(mob.slot||0)%MONSTER_SPAWNS.length]];}
    mob.bodyHeight=ENEMY_HEIGHT;mob.bodyRadius=ENEMY_RADIUS;
    const fighters=actors.filter(a=>a.role==='fighter'&&world.profiles[a.key]?.hp>0&&!insideArtSanctuary(a.position));
    mob.lastPosition=[...mob.position];advanceIslandEnemy(mob,fighters,now,{disabled:!!effectActive(mob,'stun',now)||!!effectActive(mob,'root',now),slow:effectActive(mob,'root',now)?1:effectActive(mob,'slow',now)?.power||0,
     move:(target,distance)=>moveMonster(world,mob,target,distance),hit:(target,amount)=>damagePlayer(world,null,target,amount*(1-(effectActive(mob,'weak',now)?.power||0)),now,'monster',mob.position)});
    if(!mob.aggroTarget&&!fighters.some(a=>distance2d(a.position,mob.position)<18))patrolMonster(mob,now,rng,(target,distance)=>moveMonster(world,mob,target,distance));
    changed=true;
   }
  }
  for(const profile of Object.values(world.profiles))if(profile.hp<=0&&profile.deadUntil<=now){profile.hp=profile.maxHp;profile.deadUntil=0;profile.lastRespawnAt=now;changed=true;}
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
  const prev=Math.max(0,Math.min(1,(fx.lastAt-fx.createdAt)/(fx.expiresAt-fx.createdAt)));
  const next=Math.max(0,Math.min(1,(now-fx.createdAt)/(fx.expiresAt-fx.createdAt)));
  const owner=world.profiles[fx.owner];
  if(!owner){fx.lastAt=now;continue;}
  if(fx.kind==='projectile'){
   const weapon=itemById(fx.weapon);
   if(!weapon){fx.lastAt=now;continue;}
   const alreadyHit=new Set(fx.hits||[]);
   const outcome=(target,position,impact,pellet=null,along=0)=>{
    const enemy=target.value,key=(enemy.id||enemy.key),isPlayer=target.kind==='player';
    if(enemy.key===fx.owner||(isPlayer&&insideSafeZone(enemy.position)))return false;
    const hitKey=pellet===null?key:pellet+':'+key;
    const history=pellet===null?alreadyHit:(fx.pelletHits[pellet]??=[]);
    if(pellet===null?history.has(hitKey):history.includes(hitKey))return false;
    if(pellet===null){alreadyHit.add(hitKey);fx.hits.push(hitKey);}else history.push(hitKey);
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
    const pvpCap=weapon.id==='black-cat'?(fx.charge>=1?50:32):
      fx.charge>=1?(pellet===null?29.5:2.95):(pellet===null?13.9:1.39);
    const damage=isPlayer?Math.min(rawDamage,pvpCap):rawDamage;
    let applied;
    if(isPlayer)applied=damagePlayer(world,owner,enemy,damage,now,'pvp',fx.origin,modifiers.kind,impact);
    else applied=damageMonster(world,owner,damage,now,rng,modifiers.kind,enemy,impact);
    if(applied&&!applied.immune&&!applied.defeated){
     const statusKey=enemy.id||enemy.key;
     if(!(fx.statusHits||[]).includes(statusKey)){
      fx.statusHits??=[];fx.statusHits.push(statusKey);
      applyStatus(world,owner,isPlayer?world.profiles[enemy.key]:enemy,weapon,{
       direction:fx.direction,charge:fx.charge,
       damage:isPlayer?Math.min(12,fx.pvpDamage):fx.damage,
       qualityDuration:fx.qualityDuration
      },now);
     }
    }
    return !!applied;
   };
   // Each travelling sphere uses its own independent ray. The server sweeps
   // all travelled segments, so no damage can occur before contact.
   const lanes=fx.pellets||[{direction:fx.direction,radius:fx.radius}];
   const segmentLength=Math.max(0,(next-prev)*fx.range);
   if(segmentLength>.00001){
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
   // Ground-targeted charged area explosions are evaluated only once their
   // visible travel has completed; targets that have moved away evade damage.
   if((fx.area?.mode==='area'||fx.area?.mode==='sector')&&!fx.areaResolved&&next>=.70){
    fx.areaResolved=true;
    for(const target of targets){
     const enemy=target.value,key=enemy.id||enemy.key;
     if(alreadyHit.has(key)||enemy.key===fx.owner)continue;
     const pos=target.kind==='player'
      ?[enemy.position[0],enemy.position[1]+1,enemy.position[2]]:
       [enemy.position[0],enemy.position[1]+ENEMY_HEIGHT*.5,enemy.position[2]];
     if(!insideChargedArea(fx.area,pos,target.kind==='player'?1.02:ENEMY_RADIUS))continue;
     if(outcome(target,pos,fx.area.center,null,fx.area.travel))changed=true;
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
     const contact=target.kind==='monster'?monsterRayDistance(a,direction,length,value,1.35*fx.radius):
      rayCylinderDistance(a,direction,length,value.position,1+fx.radius,2.35);
     if(contact===null)continue;
     seen.push(value.id||value.key);
     const hit=a.map((v,j)=>v+direction[j]*contact);
     if(target.kind==='monster')damageMonster(world,owner,fx.damage*.53,now,rng,leg==='out'?'boomerang-out':'boomerang-return',value,hit);
     else damagePlayer(world,owner,value,(fx.pvpDamage||12)*.62,now,'boomerang',fx.origin,leg==='out'?'boomerang-out':'boomerang-return',hit);
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
     if(key===fx.owner||fx.fishHits.includes(key))continue;
     if(target.kind==='player'&&insideArtSanctuary(value.position))continue;
     const contact=target.kind==='monster'
      ?monsterRayDistance(origin,fx.direction,length,value,fx.radius)
      :rayCylinderDistance(origin,fx.direction,length,value.position,1.02+fx.radius,2.35);
     if(contact===null)continue;
     fx.fishHits.push(key);
     const impact=origin.map((v,j)=>v+fx.direction[j]*contact);
     if(target.kind==='monster'){
      const result=damageMonster(world,owner,fx.damage*1.25,now,rng,'giant-goldfish',value,impact);
      if(result&&!result.defeated){
       const moved=[value.position[0]+fx.direction[0]*(3+fx.tier*.7),value.position[1],value.position[2]+fx.direction[2]*(3+fx.tier*.7)];
       if(insideArena(moved,-2)&&!insideArtSanctuary(moved))value.position=moved;
       value.effects??={};value.effects.stun={owner:fx.owner,power:1,until:now+800,next:now+1000};
      }
     }else{
      const hit=damagePlayer(world,owner,value,(fx.pvpDamage||12)*1.08,now,'goldfish',fx.origin,'giant-goldfish',impact);
      if(hit&&!hit.immune){const profile=world.profiles[value.key];if(profile?.hitReaction){profile.hitReaction.stunMs=300;profile.hitReaction.knockback=14;}}
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
     const pos=value.position,dist=Math.hypot(pos[0]-p[0],pos[2]-p[2]),id2=value.id||value.key,key=i+':'+id2;
     // The rendered tornado is a finite 3-D column, not an infinite 2-D
     // hazard: a fighter flying above the visible vortex cannot be struck.
     const tornadoTop=p[1]+10*(1+(fx.tier-1)*.19),victimHeight=target.kind==='monster'?(value.bodyHeight||ENEMY_HEIGHT):2.35;
     if(pos[1]>tornadoTop||pos[1]+victimHeight<p[1]-1)continue;
     if(dist>2.4+fx.radius*.48||now-(fx.fanHits[key]||0)<900)continue;
     fx.fanHits[key]=now;
     if(target.kind==='monster')damageMonster(world,owner,fx.damage*.18,now,rng,'tornado',value,p);
     else damagePlayer(world,owner,value,(fx.pvpDamage||10)*.10,now,'tornado',fx.origin,'tornado',p);
     const victim=target.kind==='monster'?value:world.profiles[value.key];
     if(victim){
      victim.effects??={};
      victim.effects.slow={owner:fx.owner,power:.4,until:now+Math.round(1300*(1+(fx.tier-1)*.3)),next:now+1000};
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

function damageMonster(world,profile,amount,now,rng,kind='normal',monster=world.monster,hitPosition=null){if(!monster?.active)return null;amount*=1+(effectActive(monster,'expose',now)?.power||0);amount=Math.min(monster.hp,amount);monster.hp=Math.max(0,monster.hp-amount);recordTempleDamage(world,{amount,kind,position:hitPosition||[monster.position[0],monster.position[1]+ENEMY_HEIGHT*.6,monster.position[2]],owner:profile?.key,target:monster.id},now);monster.lastHitAt=now;if(profile?.key){monster.aggroTarget=profile.key;monster.aggroUntil=now+26000;}if(monster.hp>0)return {monsterId:monster.id,position:[monster.position[0],monster.position[1]+ENEMY_HEIGHT*.5,monster.position[2]],damage:+amount.toFixed(1),hp:monster.hp,defeated:false};const coin=Math.floor(ECONOMY.monsterCoinMin+rng()*(ECONOMY.monsterCoinMax-ECONOMY.monsterCoinMin+1)),gear=monsterDropRoll(rng),material=MATERIALS[Math.floor(rng()*MATERIALS.length)];world.groundDrops.push({id:id(),kind:'coin',amount:coin,position:[monster.position[0]-1,.4,monster.position[2]],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs},{id:id(),...gear,position:[monster.position[0]+1,.4,monster.position[2]],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs},{id:id(),kind:'material',itemId:material.id,position:[monster.position[0],.4,monster.position[2]+1.4],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs});monster.active=false;monster.defeatedAt=now;monster.nextSpawnAt=now+ECONOMY.monsterIntervalMs;world.activity.itemsSpawned+=3;if(profile)addXp(profile,120);return {monsterId:monster.id,position:[monster.position[0],monster.position[1]+ENEMY_HEIGHT*.5,monster.position[2]],damage:+amount.toFixed(1),hp:0,defeated:true};}
function moveMonster(world,monster,target,distance){const dx=target[0]-monster.position[0],dz=target[2]-monster.position[2],angle=Math.atan2(dz,dx);for(const offset of [0,.68,-.68,1.2,-1.2]){const next=[monster.position[0]+Math.cos(angle+offset)*distance,monster.position[1],monster.position[2]+Math.sin(angle+offset)*distance];if(!insideArena(next,-2)||insideArtSanctuary(next)||(world.structures||[]).some(s=>distance2d(next,s.position)<structureRadius(s)+1.1))continue;monster.position[0]=next[0];monster.position[2]=next[2];return;}}
function hashString(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;}

export const CATALOG_VIEW=Object.freeze(ITEMS.map(item=>Object.freeze({...item})));
export const SHOP_VIEW=Object.freeze(SHOP_ITEMS.map(item=>Object.freeze({...item})));
