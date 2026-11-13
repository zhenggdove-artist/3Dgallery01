import {addArtwork,artworkDefinitions,validateAppearance} from './artwork-library.js';
import {ECONOMY,ITEMS,MATERIALS,SHOP_ITEMS,STARTER_LOADOUT,EQUIPPABLE_SLOTS,attackStats,itemById,groundDropRoll,monsterDropRoll} from './catalog.js';
import {ARENA_RADIUS,FISHING_POND,GROUND_DROP_POINTS,MONSTER_SPAWNS,PLATFORMS,PLAYER_SPAWNS,SAFE_ZONE,distance2d,insideArena,insideSafeZone} from './arena.js';
import layoutDefaults from '../../temple-artwork-layout.json' with {type:'json'};
import {ORIGINAL_ACTIONS,originalAction,originalView} from './reletter-actions.js';
import {applyStatus,tickStatus,effectActive} from './combat-status.js';
import {playerStats,refreshStats} from './player-stats.js';
import {fuseOriginal,equippedItem} from './fusion-adapter.js';
import {advanceIslandEnemy,ISLAND_ENEMIES,ENEMY_HEIGHT,ENEMY_RADIUS} from './island-combat.js';
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
    artworkLayout:clone(layoutDefaults.artworkLayout||{}),groundDrops:[],structures:[],plants:[],sceneCleanupVersion:1,
    monster:{active:false,nextSpawnAt:now+ECONOMY.monsterIntervalMs,generation:0},
    nextGroundDropAt:now+ECONOMY.groundSpawnMinMs,
    activity:{coinMinted:0,coinBurned:0,itemsSpawned:0,itemsClaimed:0}
  };
}

export function migrateWorld(raw,now=Date.now()){
  const world=raw&&typeof raw==='object'?raw:createInitialWorld(now);
  if(!world.version)world.version=1;
  world.profiles??={};world.coins??={};world.artworks??={};world.artworkLayout??={};world.groundDrops??=[];world.structures??=[];world.plants??=[];
  world.activity??={coinMinted:0,coinBurned:0,itemsSpawned:0,itemsClaimed:0};
  for(const p of PLATFORMS){world.coins[p.id]??={availableAt:0};world.artworks[p.id]??={availableAt:0,holder:null,throwEvent:null};if(!world.artworkLayout[p.id]&&layoutDefaults.artworkLayout?.[p.id])world.artworkLayout[p.id]=clone(layoutDefaults.artworkLayout[p.id]);}
  world.monster??={active:false,nextSpawnAt:now+ECONOMY.monsterIntervalMs,generation:0};
  world.nextGroundDropAt??=now+ECONOMY.groundSpawnMinMs;
  return cleanLegacyScene(world);
}

export function createProfile(key,name,color,now=Date.now(),admin=false){
  return {key,name:String(name||'Pilgrim').slice(0,24),color:validColor(color)?color:'#bde8dc',admin:!!admin,
    wallet:80,level:1,xp:0,hp:100,maxHp:100,deadUntil:0,inventory:[STARTER_LOADOUT.weapon],equipment:{...STARTER_LOADOUT},
    fusion:{},fish:{minnow:0,koi:0,relic:0},createdAt:now,updatedAt:now,lastAttackAt:0,lastFishAt:0};
}

export function ensureProfile(world,key,name,color,now=Date.now(),admin=false){
  const current=world.profiles[key]??=createProfile(key,name,color,now,admin);
  if(name)current.name=String(name).slice(0,24);if(validColor(color))current.color=color;current.admin=!!admin;current.updatedAt=now;
  current.wallet=Number.isFinite(current.wallet)?Math.max(0,Math.floor(current.wallet)):0;
  current.level=Math.max(1,Math.floor(current.level||1));current.xp=Math.max(0,Math.floor(current.xp||0));
  current.inventory=Array.isArray(current.inventory)?current.inventory.filter(itemById).slice(0,600):[STARTER_LOADOUT.weapon];
  if(!current.inventory.includes(STARTER_LOADOUT.weapon))current.inventory.unshift(STARTER_LOADOUT.weapon);
  current.equipment??={...STARTER_LOADOUT};current.fusion??={};current.fish??={minnow:0,koi:0,relic:0};
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
    artworks:clone(world.artworks),artworkLayout:clone(world.artworkLayout||{}),customArtworks:clone(world.customArtworks||[]),groundDrops:clone(world.groundDrops),structures:clone(world.structures),plants:clone(world.plants),monster:clone(world.monster),
    profile:profile?{...publicProfile(profile),stats:playerStats(world,profile,now),inventory:clone(profile.inventory),fish:clone(profile.fish),fusion:clone(profile.fusion),impulse:profile.impulse||null}:null,
    reletter:originalView(world),economy:ECONOMY,damageEvents:clone((world.damageEvents||[]).filter(e=>now-e.time<8000))};
}

function requireFighter(actor){return actor.role==='fighter'?null:{error:'Spectators cannot perform this action'};}
function requireAlive(profile,now){return profile.hp>0&&profile.deadUntil<=now?null:{error:'Wait for respawn'};}
function near(actor,position,radius){return distance2d(actor.position,position)<=radius&&Math.abs((actor.position?.[1]||0)-position[1])<=8;}
function spend(profile,amount,world){if(profile.admin)return true;if(profile.wallet<amount)return false;profile.wallet-=amount;world.activity.coinBurned+=amount;return true;}
function earn(profile,amount,world){if(!profile.admin)profile.wallet+=amount;world.activity.coinMinted+=amount;}
function addItem(profile,itemId){if(!itemById(itemId)||profile.inventory.length>=600)return false;profile.inventory.push(itemId);return true;}

export function validateState(previous,next,elapsedMs,role='fighter',spawn=null){
  if(!next||!insideArena(next.position,role==='spectator'?28:2)||!Number.isFinite(next.rotation))return {error:'Invalid position'};
  if(!previous&&spawn&&Math.hypot(next.position[0]-spawn[0],next.position[1]-spawn[1],next.position[2]-spawn[2])>6)return {error:'Spawn position rejected'};
  if(previous&&role==='fighter'){
    const elapsed=clamp(elapsedMs/1000,.05,2),distance=Math.hypot(next.position[0]-previous.position[0],next.position[1]-previous.position[1],next.position[2]-previous.position[2]);
    if(distance>14*elapsed+4)return {error:'Movement rejected'};
  }
  return {state:{position:next.position.map(n=>+n.toFixed(3)),rotation:+next.rotation.toFixed(4),animation:String(next.animation||'idle').slice(0,12),visible:next.visible!==false}};
}

export function applyAction(world,actor,body,context={}){
  const now=context.now??Date.now(),rng=context.rng??Math.random,profile=ensureProfile(world,actor.key,actor.name,actor.color,now,actor.admin);
  if(body.action==='add-artwork')return addArtwork(world,profile,actor,body,now);
  if(body.action==='set-artwork-layout')return setArtworkLayout(world,profile,body,now);
  const denied=requireFighter(actor);if(denied)return denied;const dead=requireAlive(profile,now);if(dead&&!['respawn'].includes(body.action))return dead;
  if(!insideArena(actor.position,2))return {error:'Invalid actor position'};
  if(ORIGINAL_ACTIONS.has(body.action)){const result=originalAction(world,profile,actor,body,now,rng);if(!result.error)world.revision++;return result;}
  let result;
  switch(body.action){
    case 'pickup-coin':result=pickupCoin(world,profile,actor,body,now);break;
    case 'pickup-drop':result=pickupDrop(world,profile,actor,body,now);break;
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
    case 'fish':result=fish(world,profile,actor,now,rng);break;
    case 'plant':result=plant(world,profile,actor,body,now);break;
    case 'respawn':profile.hp=profile.maxHp;profile.deadUntil=0;result={spawn:PLAYER_SPAWNS[context.seatIndex%4]};break;
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
  const [platformId,art]=entry,origin=[actor.position[0],actor.position[1]+1.4,actor.position[2]],event={id:id(),platformId,origin,direction,time:now,power:clamp(Number(body.power)||1,.4,1.4),owner:actor.key};
  art.holder=null;art.availableAt=now+ARTWORK_RESPAWN_MS;art.throwEvent=event;
  let hit=null;for(const target of context.actors||[]){if(target.key===actor.key||target.role!=='fighter'||insideSafeZone(target.position))continue;const along=project(origin,direction,target.position);if(along>0&&along<18*event.power&&perpendicular(origin,direction,target.position,along)<2.1){hit=damagePlayer(world,profile,target,34*event.power,now,'artwork',actor.position);break;}}
  let monsterHit=null;if(world.monster?.active){const along=project(origin,direction,world.monster.position);if(along>0&&along<18*event.power&&perpendicular(origin,direction,world.monster.position,along)<2.7)monsterHit=damageMonster(world,profile,68*event.power,now,context.rng??Math.random);}
  let structureDestroyed=null;if(!hit&&!monsterHit){for(const structure of world.structures||[]){const along=project(origin,direction,structure.position);if(along>0&&along<18*event.power&&perpendicular(origin,direction,structure.position,along)<structureRadius(structure)){structure.hp-=Math.round(70*event.power);if(structure.hp<=0){structureDestroyed=structureEvent(structure,now);world.structures.splice(world.structures.indexOf(structure),1);}break;}}}
  return {throwEvent:event,hit,monsterHit,structureDestroyed,notice:monsterHit?.defeated?'Monster defeated · loot dropped':structureDestroyed?'Artwork shattered a structure':undefined};
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
  const appearance=validateAppearance(layout.appearance||current?.appearance);if(!appearance)return {error:'Invalid appearance settings'};
  world.artworkLayout??={};world.artworkLayout[platform.id]={position:[...layout.position],rotation:[...layout.rotation],scale:[...layout.scale],appearance,revision:(current?.revision||0)+1,updatedAt:now};world.revision++;
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
  if(body.phase==='charge'){profile.chargeStartedAt=now;return {charging:true};}
  if(now-profile.lastAttackAt<weapon.cooldown)return {error:'Weapon is recovering'};const direction=normalDirection(body.direction);if(!direction)return {error:'Invalid attack direction'};profile.lastAttackAt=now;
  const charge=Math.min(clamp(Number(body.charge)||0,0,1),profile.chargeStartedAt?clamp((now-profile.chargeStartedAt)/(weapon.chargeMs||1500),0,1):0);profile.chargeStartedAt=0;
  const stats=attackStats(weapon,charge),origin=[actor.position[0],actor.position[1]+1,actor.position[2]],combo=stats.ultimate?6:now-(profile.lastComboAt||0)<1200?((profile.combo||0)+1)%6:0;stats.damage*=playerStats(world,profile,now).attack;profile.combo=combo;profile.lastComboAt=now;
  let hit=null;for(const target of context.actors||[]){if(target.key===actor.key||target.role!=='fighter'||insideSafeZone(actor.position)||insideSafeZone(target.position))continue;const targetPosition=[target.position[0],target.position[1]+1,target.position[2]],along=project(origin,direction,targetPosition);if(along>0&&along<stats.range&&perpendicular(origin,direction,targetPosition,along)<stats.radius+1){const modifiers=directHitModifiers(weapon,{origin,direction,range:stats.range},{position:target.position,island:true},targetPosition,now,context.rng??Math.random);hit=damagePlayer(world,profile,target,(stats.damage+bonus)*modifiers.multiplier,now,'pvp',actor.position,modifiers.kind);break;}}
  let monsterHit=null;if(world.monster?.active&&!insideSafeZone(actor.position)){const target=[world.monster.position[0],world.monster.position[1]+ENEMY_HEIGHT*.5,world.monster.position[2]],along=project(origin,direction,target);if(along>0&&along<stats.range&&perpendicular(origin,direction,target,along)<stats.radius+ENEMY_RADIUS){const modifiers=directHitModifiers(weapon,{origin,direction,range:stats.range},{...world.monster,island:true},target,now,context.rng??Math.random);monsterHit=damageMonster(world,profile,(stats.damage+bonus)*modifiers.multiplier,now,context.rng??Math.random,modifiers.kind);}}
  if(hit&&!hit.defeated&&!hit.immune)applyStatus(world,profile,world.profiles[hit.target],weapon,{direction,charge,damage:stats.damage},now);if(monsterHit&&!monsterHit.defeated)applyStatus(world,profile,world.monster,weapon,{direction,charge,damage:stats.damage},now);
  return {attackEvent:{id:id(),owner:actor.key,origin,direction,impactPoint:monsterHit?[world.monster.position[0],world.monster.position[1]+ENEMY_HEIGHT*.5,world.monster.position[2]]:hit?.target?(()=>{const p=(context.actors||[]).find(a=>a.key===hit.target)?.position;return p?[p[0],p[1]+1,p[2]]:null;})():null,weapon:weapon.id,family:weapon.family,color:weapon.color,charge,combo,fusionEffects:profile.fusion[weapon.id]?.effects||[],...stats,time:now},hit,monsterHit};
}

function damagePlayer(world,sourceProfile,targetActor,amount,now,cause,dropPosition,kind='normal'){
  const target=world.profiles[targetActor.key];if(!target||target.hp<=0||target.deadUntil>now)return null;
  const stats=refreshStats(world,target,now);if(target.admin){target.hp=target.maxHp;return {target:targetActor.key,damage:0,defeated:false,immune:true};}
  const armor=itemById(target.equipment.armor),reduction=Math.min(.65,(armor?.defense||0)/100);let damage=Math.max(1,+((amount)*(1-reduction)*stats.defense).toFixed(1));
  if(target.shield){const absorbed=Math.min(target.shield.hp,damage);target.shield.hp-=absorbed;target.shield.lastHit=now;damage-=absorbed;}
  damage=Math.min(target.hp,damage);target.hp=Math.max(0,target.hp-damage);if(damage>0){const from=cause==='monster'?world.monster.position:dropPosition||targetActor.position,dx=targetActor.position[0]-from[0],dz=targetActor.position[2]-from[2],length=Math.hypot(dx,dz)||1;target.hitReaction={id:id(),time:now,stunMs:100,vector:[dx/length,0,dz/length]};}
  recordTempleDamage(world,{amount:damage,kind,position:[targetActor.position[0],targetActor.position[1]+1,targetActor.position[2]],owner:sourceProfile?.key,target:targetActor.key},now);
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
  if(!spend(profile,cost,world))return {error:'Not enough coins'};const structure={id:id(),kind,surface:typeof body.surface==='string'?body.surface:null,variant:Math.floor(rng()*4),position:position.map(n=>+n.toFixed(2)),rotation:+(Number(body.rotation)||0).toFixed(3),owner:actor.key,hp:kind==='house'?220:kind==='tree'?90:140,createdAt:now};world.structures.push(structure);return {notice:`Built ${kind}`,structure};
}
function destroy(world,profile,actor,body,now){const structure=world.structures.find(entry=>entry.id===body.structureId);if(!structure)return {error:'Structure is gone'};if(distance2d(actor.position,structure.position)>12)return {error:'Move closer to the structure'};const weapon=itemById(profile.equipment.weapon)||itemById(STARTER_LOADOUT.weapon);if(now-profile.lastAttackAt<weapon.cooldown)return {error:'Weapon is recovering'};profile.lastAttackAt=now;structure.hp-=Math.max(8,weapon.damage+(profile.fusion[weapon.id]?.bonus||0));let structureDestroyed=null;if(structure.hp<=0){structureDestroyed=structureEvent(structure,now);world.structures.splice(world.structures.indexOf(structure),1);}return {notice:structureDestroyed?'Structure destroyed':`${Math.ceil(structure.hp)} structure HP`,structureDestroyed,attackEvent:{id:id(),owner:actor.key,origin:actor.position,direction:normalDirection(body.direction)||[0,0,-1],weapon:weapon.id,time:now}};}

function fish(world,profile,actor,now,rng){if(distance2d(actor.position,[FISHING_POND.x,0,FISHING_POND.z])>FISHING_POND.radius+2)return {error:'Fish beside the pond'};if(now-profile.lastFishAt<8_000)return {error:'The water needs time to settle'};profile.lastFishAt=now;const roll=rng(),kind=roll<.72?'minnow':roll<.96?'koi':'relic';profile.fish[kind]=(profile.fish[kind]||0)+1;earn(profile,ECONOMY.fishValues[kind],world);return {notice:`Caught ${kind} · +${ECONOMY.fishValues[kind]} coins`,fish:kind};}

function plant(world,profile,actor,body,now){const text=String(body.text||'').trim();if((!text&&!body.media)||text.length>500)return {error:'Plant message must contain 1–500 characters'};if(distance2d(actor.position,[0,0,0])>SAFE_ZONE.radius+3)return {error:'Write beside the central plant'};const parent=typeof body.parentId==='string'?world.plants.find(entry=>entry.id===body.parentId):null;if(body.parentId&&!parent)return {error:'Parent plant no longer exists'};const seed=hashString(`${profile.key}:${now}`),angle=(seed%628)/100,radius=parent ? .7 : Math.min(5,Math.max(1.4,distance2d(body.position,[0,0,0]))),base=parent?.position||body.position||actor.position,position=parent?[clamp(base[0]+Math.cos(angle)*radius,-5,5),0,clamp(base[2]+Math.sin(angle)*radius,-5,5)]:[clamp(Number(base?.[0])||0,-5,5),0,clamp(Number(base?.[2])||0,-5,5)];const entry={id:id(),author:profile.name,text,media:body.media||null,position,parentId:parent?.id||null,createdAt:now};world.plants.push(entry);if(world.plants.length>500)world.plants.shift();return {notice:parent?'Reply branch planted':'Message planted',plant:entry};}

export function releasePlayerWorldState(world,playerKey,now=Date.now()){
  let changed=false;for(const art of Object.values(world.artworks||{}))if(art.holder===playerKey){art.holder=null;art.throwEvent=null;art.availableAt=now+ARTWORK_RESPAWN_MS;changed=true;}return changed;
}

function addXp(profile,amount){
  profile.xp=(profile.xp||0)+amount;let needed=profile.level*100;while(profile.xp>=needed){profile.xp-=needed;profile.level++;profile.maxHp=100+(profile.level-1)*4;profile.hp=Math.min(profile.maxHp,profile.hp+12);needed=profile.level*100;}
}

export function canBuildAt(world,actorPosition,position){
  if(!insideArena(position,-3)||insideSafeZone(position)||distance2d(actorPosition,position)>12)return false;
  if(distance2d(position,[FISHING_POND.x,0,FISHING_POND.z])<FISHING_POND.radius+3)return false;
  if(PLAYER_SPAWNS.some(spawn=>distance2d(position,spawn)<5.5))return false;
  if(PLATFORMS.some(platform=>distance2d(position,platform.position)<Math.max(platform.size[0],platform.size[2])*.5+3.2))return false;
  if((world.structures||[]).some(structure=>distance2d(position,structure.position)<(structure.kind==='house'?5.5:structure.kind==='tree'?2.4:3.5)))return false;
  return true;
}

function validBuildPosition(world,actor,position){return canBuildAt(world,actor.position,position);}

export function tickWorld(world,{now=Date.now(),rng=Math.random,activeFighters=0,actors=[]}={}){
  migrateWorld(world,now);let changed=false;
  if(world.monster?.active)changed=tickStatus(world.monster,now,(owner,amount)=>damageMonster(world,world.profiles[owner],amount,now,rng))||changed;
  for(const target of actors){const p=world.profiles[target.key];if(p&&!p.admin&&p.hp>0)changed=tickStatus(p,now,(owner,amount)=>damagePlayer(world,world.profiles[owner],target,amount,now,'status',target.position))||changed;}
  world.groundDrops=world.groundDrops.filter(drop=>drop.expiresAt>now);if(world.groundDrops.length>ECONOMY.maxGroundDrops)world.groundDrops.splice(0,world.groundDrops.length-ECONOMY.maxGroundDrops);
  if(activeFighters>0)changed=replenishHearts(world,now)||changed;
  if(activeFighters>0&&now>=world.nextGroundDropAt&&world.groundDrops.length<ECONOMY.maxGroundDrops){const point=GROUND_DROP_POINTS[Math.floor(rng()*GROUND_DROP_POINTS.length)],rolled=groundDropRoll(rng);world.groundDrops.push({id:id(),...rolled,position:[...point],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs});world.nextGroundDropAt=now+ECONOMY.groundSpawnMinMs+rng()*(ECONOMY.groundSpawnMaxMs-ECONOMY.groundSpawnMinMs);world.activity.itemsSpawned++;changed=true;}
  if(activeFighters>0&&!world.monster.active&&now>=world.monster.nextSpawnAt){const spawn=MONSTER_SPAWNS[Math.floor(rng()*MONSTER_SPAWNS.length)],variant=['warden','drowned','signal'][Math.floor(rng()*3)],maxHp={warden:420,drowned:520,signal:360}[variant];world.monster={active:true,id:id(),variant,position:[...spawn],hp:maxHp,maxHp,generation:(world.monster.generation||0)+1,spawnedAt:now,nextAttackAt:now+2_000,nextSpawnAt:now+ECONOMY.monsterIntervalMs};changed=true;}
  if(world.monster.active){const monster=world.monster;monster.model=ISLAND_ENEMIES.includes(monster.model)?monster.model:ISLAND_ENEMIES[(monster.generation||0)%ISLAND_ENEMIES.length];if(insideArtSanctuary(monster.position)){monster.position=[...MONSTER_SPAWNS[(monster.generation||0)%MONSTER_SPAWNS.length]];monster.skills=[];}monster.attackStyles=true;monster.level??=1+(monster.generation||0)%12;monster.damage=12+monster.level*2;monster.bodyHeight=ENEMY_HEIGHT;monster.bodyRadius=ENEMY_RADIUS;monster.position[1]=0;const fighters=actors.filter(a=>a.role==='fighter'&&world.profiles[a.key]?.hp>0&&!insideArtSanctuary(a.position)&&a.position[1]<.6);advanceIslandEnemy(monster,fighters,now,{disabled:!!effectActive(monster,'stun',now),slow:effectActive(monster,'root',now)?1:effectActive(monster,'slow',now)?.power||0,move:(target,distance)=>moveMonster(world,monster,target,distance),hit:(target,amount)=>damagePlayer(world,null,target,amount*(1-(effectActive(monster,'weak',now)?.power||0)),now,'monster',target.position)});changed=true;}
  for(const profile of Object.values(world.profiles))if(profile.hp<=0&&profile.deadUntil<=now){profile.hp=profile.maxHp;profile.deadUntil=0;changed=true;}
  if(changed)world.revision=(world.revision||0)+1;return changed;
}

function normalDirection(value){if(!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))return null;const length=Math.hypot(...value);if(length<.5||length>1.5)return null;return value.map(n=>n/length);}
function project(origin,direction,point){return (point[0]-origin[0])*direction[0]+(point[1]-origin[1])*direction[1]+(point[2]-origin[2])*direction[2];}
function perpendicular(origin,direction,point,along){return Math.hypot(point[0]-origin[0]-direction[0]*along,point[1]-origin[1]-direction[1]*along,point[2]-origin[2]-direction[2]*along);}
function structureRadius(structure){return structure.kind==='house'?3.4:structure.kind==='tree'?1.4:['wall','bar'].includes(structure.kind)?3.3:1.7;}
function structureEvent(structure,now){return {id:structure.id,kind:structure.kind,variant:structure.variant||0,position:[...structure.position],time:now};}
function damageMonster(world,profile,amount,now,rng,kind='normal'){const monster=world.monster;amount*=1+(effectActive(monster,'expose',now)?.power||0);if(!monster?.active)return null;amount=Math.min(monster.hp,amount);monster.hp=Math.max(0,monster.hp-amount);recordTempleDamage(world,{amount,kind,position:[monster.position[0],monster.position[1]+ENEMY_HEIGHT*.6,monster.position[2]],owner:profile?.key,target:monster.id},now);monster.lastHitAt=now;if(monster.hp>0)return {damage:+amount.toFixed(1),hp:monster.hp,defeated:false};const coin=Math.floor(ECONOMY.monsterCoinMin+rng()*(ECONOMY.monsterCoinMax-ECONOMY.monsterCoinMin+1)),gear=monsterDropRoll(rng),material=MATERIALS[Math.floor(rng()*MATERIALS.length)];world.groundDrops.push({id:id(),kind:'coin',amount:coin,position:[monster.position[0]-1,.4,monster.position[2]],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs},{id:id(),...gear,position:[monster.position[0]+1,.4,monster.position[2]],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs},{id:id(),kind:'material',itemId:material.id,position:[monster.position[0],.4,monster.position[2]+1.4],createdAt:now,expiresAt:now+ECONOMY.groundDropLifetimeMs});monster.active=false;monster.defeatedAt=now;monster.nextSpawnAt=now+ECONOMY.monsterIntervalMs;world.activity.itemsSpawned+=3;if(profile)addXp(profile,120);return {damage:+amount.toFixed(1),hp:0,defeated:true};}
function moveMonster(world,monster,target,distance){const dx=target[0]-monster.position[0],dz=target[2]-monster.position[2],angle=Math.atan2(dz,dx);for(const offset of [0,.68,-.68,1.2,-1.2]){const next=[monster.position[0]+Math.cos(angle+offset)*distance,monster.position[1],monster.position[2]+Math.sin(angle+offset)*distance];if(!insideArena(next,-2)||insideArtSanctuary(next)||(world.structures||[]).some(s=>distance2d(next,s.position)<structureRadius(s)+1.1))continue;monster.position[0]=next[0];monster.position[2]=next[2];return;}}
function hashString(value){let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;}

export const CATALOG_VIEW=Object.freeze(ITEMS.map(item=>Object.freeze({...item})));
export const SHOP_VIEW=Object.freeze(SHOP_ITEMS.map(item=>Object.freeze({...item})));
