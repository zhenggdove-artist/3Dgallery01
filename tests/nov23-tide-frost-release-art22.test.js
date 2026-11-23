import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,migrateWorld,ensureProfile,applyAction,setArtworkLayout,tickWorld} from '../src/shared/temple-rules.js';
import {isArtwork22,artworkDefinitions} from '../src/shared/artwork-library.js';
import {itemById} from '../src/shared/catalog.js';
import {applyElementalHit} from '../src/shared/combat-status.js';
import {GOLDFISH_DAMAGE_PER_FISH,GOLDFISH_T1_TOTAL_MAX,goldfishDirectHitBudget} from '../src/shared/goldfish-school.js';
import {readFileSync} from 'node:fs';

test('image 22 filename unlock is per artwork, even if the legacy migration flag was already set',()=>{
 const T=1800000,world=createInitialWorld(T);
 world.customArtworks=[{
  id:'art-stuck22',title:'22.png',mediaId:'media-22',type:'image',mime:'image/png',
  position:[78,2,14],owner:'gm'
 }];
 world.artworks['art-stuck22']={holder:'old-disconnected-player',availableAt:T+9000000,throwEvent:{platformId:'art-stuck22'}};
 world.pendingArtworkFlights=[{event:{platformId:'art-stuck22'},lastAt:T}];
 world.artworkLayout['art-stuck22']={
  position:[-100,2,14],rotation:[0,0,0],scale:[1,1,1],
  appearance:{depth:0,brightness:.4,contrast:1,saturation:1.43,blackPoint:.1,tint:'#ffffff'},
  revision:4,updatedAt:T
 };
 world.artwork22UnlockMigrationApplied=true;
 assert.equal(isArtwork22(world.customArtworks[0]),true);
 assert.equal(isArtwork22({title:'Other',filename:'gallery/22.webp'}),true);
 assert.equal(isArtwork22({title:'222.png'}),false);
 const migrated=migrateWorld(world,T+150);
 assert.equal(migrated.artwork22RecoveryV2['art-stuck22'],true);
 assert.equal(migrated.artworks['art-stuck22'].holder,null);
 assert.equal(migrated.artworks['art-stuck22'].availableAt,0);
 assert.equal(migrated.pendingArtworkFlights.length,0);
 assert.deepEqual(migrated.artworkLayout['art-stuck22'].position,[78,2,14]);
 assert.equal(artworkDefinitions(migrated).some(a=>a.id==='art-stuck22'),true);
 const prevRevision=migrated.revision;
 migrateWorld(migrated,T+200);
 assert.equal(migrated.revision,prevRevision,'legitimate later pickup state is never reset repeatedly');
 const gm={key:'gm',name:'GM',color:'#ffffff',role:'fighter',admin:true,position:[78,0,15]};
 const admin=ensureProfile(migrated,'gm','GM','#ffffff',T,true);
 const layout=migrated.artworkLayout['art-stuck22'];
 const saved=setArtworkLayout(migrated,admin,{platformId:'art-stuck22',expectedRevision:0,
  layout:{...layout,position:[79,2,15]}},T+250);
 assert.ok(saved.artworkLayout,!saved.error&&'saving an image 22 must succeed even with stale revision');
 assert.deepEqual(saved.artworkLayout.position,[79,2,15]);
 const picked=applyAction(migrated,gm,{action:'pickup-artwork',platformId:'art-stuck22'},
  {now:T+300,actors:[gm]});
 assert.equal(picked.error,undefined,'image 22 is once again physically pickupable');
 assert.equal(migrated.artworks['art-stuck22'].holder,'gm');
});

test('goldfish damage budgets and visual material transparency are both halved',()=>{
 assert.equal(GOLDFISH_DAMAGE_PER_FISH,.1);
 assert.equal(GOLDFISH_T1_TOTAL_MAX,45);
 assert.equal(goldfishDirectHitBudget(1,true),9);
 const visuals=readFileSync(new URL('../src/weapon-signature-effects.js',import.meta.url),'utf8');
 assert.match(visuals,/transparent:true,opacity:\.5,depthWrite:false/);
 assert.match(visuals,/transparent:true,opacity:\.435/);
});

test('frost proc freeze lasts three seconds; subsequent hit is 30% slow and still damage-eligible',()=>{
 const victim={hp:500,maxHp:500,effects:{},effectLocks:{}};
 const source={key:'caster'},frost=itemById('frost-1');
 assert.equal(applyElementalHit(victim,source,{...frost,ultimateHit:true},1000),'freeze');
 assert.equal(victim.effects.freeze.until,4000);
 assert.equal(victim.effectLocks.freeze,7000);
 assert.equal(applyElementalHit(victim,source,{...frost,ultimateHit:true},5100),'slow');
 assert.equal(victim.effects.slow.power,.3);
 assert.equal(victim.effects.slow.until,8100);
 assert.equal(applyElementalHit(victim,source,{...frost,ultimateHit:true},7000),'freeze');
 assert.equal(victim.effects.freeze.until,10000);
});

test('charged frost circle damages on contact rather than using the retired straight ice ray',()=>{
 const T=900000,world=createInitialWorld(T),actor={
  key:'caster',name:'Caster',color:'#ffffff',role:'fighter',position:[75,0,0]
 };
 const profile=ensureProfile(world,actor.key,actor.name,actor.color,T),item=itemById('frost-1');
 profile.inventory.push('frost-1');profile.equipment.weapon='frost-1';
 assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},{now:T+2000}).charging,true);
 const at=T+2000+item.chargeMs+25;
 const cast=applyAction(world,actor,{action:'attack',charge:1,direction:[0,0,1]},
  {now:at,actors:[actor],rng:()=>.5});
 assert.equal(cast.attackEvent.area.mode,'area');
 const [x,,z]=cast.attackEvent.area.center;
 world.monster={id:'frost-target',active:true,model:'uncle',position:[x,0,z],
  hp:100000,maxHp:100000,skills:[],nextAttackAt:T+999999};
 const hp=world.monster.hp;
 tickWorld(world,{now:at+450,actors:[actor],activeFighters:0,rng:()=>.5});
 assert.ok(world.monster.hp<hp,'damage occurs while Ice Shatter is still visibly active');
 assert.equal(world.monster.effects.freeze.until,at+3450);
 const firstHit=hp-world.monster.hp;
 const secondChargeAt=at+2100;
 assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},
  {now:secondChargeAt}).charging,true);
 const secondAt=secondChargeAt+item.chargeMs+25;
 const followup=applyAction(world,actor,{action:'attack',charge:1,direction:[0,0,1]},
  {now:secondAt,actors:[actor],rng:()=>.5});
 assert.ok(followup.attackEvent?.ultimate);
 world.monster.position=[...followup.attackEvent.area.center];world.monster.position[1]=0;
 const prior=world.monster.hp;
 tickWorld(world,{now:secondAt+450,actors:[actor],activeFighters:0,rng:()=>.5});
 assert.ok(world.monster.hp<prior,'second ice blast still damages before six seconds');
 assert.equal(world.monster.effects.slow.power,.3);
 assert.ok(firstHit>prior-world.monster.hp,'first freezing hit is stronger than subsequent slowing hit');
});
