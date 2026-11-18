import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,createProfile,applyAction,tickWorld,worldView} from '../src/shared/temple-rules.js';
import {fuseTemple,fusionChance} from '../src/shared/temple-fusion.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {weaponQuality} from '../src/shared/weapon-abilities.js';
import {pvpShotDamage} from '../src/shared/combat-balance.js';

const T=100000;
const actor=(key,admin=false,position=[72,0,20])=>({key,name:key,color:'#abcdee',role:'fighter',admin,position});

test('fusion odds halve on each attempted fusion including failures; request retry never consumes twice',()=>{
 const world=createInitialWorld(T),player=ensureProfile(world,'fuser','fuser','#abcdee',T);
 player.wallet=100000;
 player.inventory.push('ember-1','frost-1','frost-1','frost-1');
 player.equipment.weapon='ember-1';
 assert.equal(fusionChance(player,'ember-1'),.5);
 const first=fuseTemple(world,player,{targetId:'ember-1',sourceId:'frost-1',requestId:'fusion-rate-1'},()=>.5);
 assert.equal(first.fusion.success,false);
 assert.equal(first.fusion.chance,.5);
 assert.equal(first.fusion.nextChance,.25);
 assert.equal(player.inventory.filter(x=>x==='frost-1').length,2);
 assert.equal(player.fusion['ember-1'].layer,undefined);
 assert.equal(player.fusion['ember-1'].attempts,1);
 const retry=fuseTemple(world,player,{targetId:'ember-1',sourceId:'frost-1',requestId:'fusion-rate-1'},()=>0);
 assert.deepEqual(retry,first,'duplicate request ID must return same receipt');
 assert.equal(player.inventory.filter(x=>x==='frost-1').length,2);
 const second=fuseTemple(world,player,{targetId:'ember-1',sourceId:'frost-1',requestId:'fusion-rate-2'},()=>.3);
 assert.equal(second.fusion.success,false);
 assert.equal(second.fusion.chance,.25);
 assert.equal(second.fusion.nextChance,.125);
 const third=fuseTemple(world,player,{targetId:'ember-1',sourceId:'frost-1',requestId:'fusion-rate-3'},()=>.1);
 assert.equal(third.fusion.success,true);
 assert.equal(third.fusion.chance,.125);
 assert.equal(third.fusion.nextChance,.0625);
 assert.equal(player.fusion['ember-1'].layer,1);
 assert.equal(player.fusion['ember-1'].attempts,3);
 assert.equal(player.inventory.filter(x=>x==='frost-1').length,0);
 assert.ok(player.wallet<100000);
});

test('GM logs in with purple tier-six wings, independently selects 0–100% fusion chance and toggles god mode',()=>{
 const gm=actor('god',true),world=createInitialWorld(T);
 const profile=ensureProfile(world,gm.key,gm.name,gm.color,T,true);
 assert.equal(profile.equipment.wings,'wings-18');
 assert.equal(itemById(profile.equipment.wings).color,'#c5a0ed');
 assert.equal(profile.gmInvincible,true);
 assert.equal(fusionChance(profile,'ember-1'),1);
 assert.equal(applyAction(world,gm,{action:'gm-fusion-chance',percent:0},{now:T}).gmFusionChance,0);
 assert.equal(fusionChance(profile,'ember-1'),0);
 profile.inventory.push('ember-1','frost-1');
 assert.equal(fuseTemple(world,profile,{targetId:'ember-1',sourceId:'frost-1',requestId:'gm-roll-zero'},()=>0).fusion.success,false);
 assert.equal(applyAction(world,gm,{action:'gm-fusion-chance',percent:100},{now:T+1}).gmFusionChance,1);
 profile.inventory.push('frost-1');
 assert.equal(fuseTemple(world,profile,{targetId:'ember-1',sourceId:'frost-1',requestId:'gm-roll-hundred'},()=>.999).fusion.success,true);
 assert.equal(applyAction(world,gm,{action:'gm-invincible',enabled:false},{now:T+2}).gmInvincible,false);
 assert.equal(worldView(world,gm.key,T+3).profile.gmInvincible,false);
 assert.equal(applyAction(world,gm,{action:'gm-invincible',enabled:true},{now:T+4}).gmInvincible,true);
 const visitor=actor('stranger',false);
 ensureProfile(world,visitor.key,visitor.name,visitor.color,T,false);
 assert.equal(applyAction(world,visitor,{action:'gm-invincible',enabled:false},{now:T+5}).error,'GM only');
 assert.equal(applyAction(world,visitor,{action:'gm-fusion-chance',percent:100},{now:T+6}).error,'GM only');
});

test('invincibility switch controls GM actual monster combat damage',()=>{
 const gm=actor('toggle-god',true,[72,0,20]),world=createInitialWorld(T),profile=ensureProfile(world,gm.key,gm.name,gm.color,T,true);
 const makeSwipe=(id,now)=>({id,motion:'swipe',phase:'active',origin:[72,0,19],aim:[72,0,22],
  start:now-50,end:now+500,hit:[],radius:4.2,damage:12});
 world.monster={id:'gm-test-monster',model:'uncle',active:true,hp:500,maxHp:500,position:[72,0,19],
  skills:[makeSwipe('s1',T+100)],updatedAt:T,nextAttackAt:T+10000};
 tickWorld(world,{now:T+100,actors:[gm],activeFighters:0,rng:()=>.5});
 assert.equal(profile.hp,profile.maxHp);
 applyAction(world,gm,{action:'gm-invincible',enabled:false},{now:T+110});
 world.monster.skills=[makeSwipe('s2',T+200)];
 tickWorld(world,{now:T+200,actors:[gm],activeFighters:0,rng:()=>.5});
 assert.ok(profile.hp<profile.maxHp,'GM becomes vulnerable to ordinary monster attacks');
});

test('sniper as a fusion material applies only 30% of base ultimate damage; echo cannot force-kill on headshot',()=>{
 const gm=actor('sniper-fuser',true),world=createInitialWorld(T),p=ensureProfile(world,gm.key,gm.name,gm.color,T,true);
 p.inventory.push('ember-1','black-cat');
 const r=fuseTemple(world,p,{sourceId:'black-cat',targetId:'ember-1',requestId:'sniper-echo-1'},()=>.5);
 assert.equal(r.fusion.success,true);
 p.equipment.weapon='ember-1';
 assert.ok(p.fusion['ember-1'].effects.includes('black-cat'));
 assert.equal(p.fusion['ember-1'].templeStats.damage,undefined,
  'a first-two-slot sniper material must not add another 30% main damage on top of its 30% echo');
 const ch=applyAction(world,gm,{action:'attack',phase:'charge'},{now:T+2000});
 assert.ok(ch.charging);
 const shot=applyAction(world,gm,{action:'attack',direction:[0,0,1],charge:1},{now:T+5000,rng:()=>.5,actors:[gm]});
 const echo=shot.attackEvent.fusionEchoes.find(e=>e.weapon==='black-cat');
 const fx=world.persistentAttacks.find(e=>e.id===echo.id);
 const sniper=itemById('black-cat'),full=attackStats(sniper,1),quality=weaponQuality(sniper);
 const reference=pvpShotDamage(sniper,full,quality);
 assert.ok(Math.abs(fx.damage-full.damage*.3)<.001);
 assert.ok(Math.abs(fx.pvpDamage-reference*.3)<.001);
 assert.equal(fx.echo,true);
 const server=readFileSync(new URL('../src/shared/temple-rules.js',import.meta.url),'utf8');
 assert.match(server,/lethalHeadshot=!fx\.echo&&/);
});

test('sniper material in a third fusion slot transfers only 30% of unfused sniper stats',()=>{
 const world=createInitialWorld(T),gm=ensureProfile(world,'late-sniper','late-sniper','#abcdee',T,true);
 gm.inventory.push('ember-1','black-cat');
 gm.fusion['ember-1']={layer:2,attempts:2,effects:['frost-1','storm-1']};
 const result=fuseTemple(world,gm,{targetId:'ember-1',sourceId:'black-cat',requestId:'late-sniper-3'},()=>0);
 assert.equal(result.fusion.success,true);
 assert.deepEqual(gm.fusion['ember-1'].effects,['frost-1','storm-1']);
 assert.ok(Math.abs(gm.fusion['ember-1'].templeStats.damage-(
  itemById('ember-1').damage+itemById('black-cat').damage*.3))<.001);
});

test('monster defeat emits a unique purely visual event, with no damage to nearby fighters',()=>{
 const attacker=actor('attacker',false,[72,0,20]),bystander=actor('spectator-nearby',false,[74,0,23]),world=createInitialWorld(T);
 const p=ensureProfile(world,attacker.key,attacker.name,attacker.color,T);
 const b=ensureProfile(world,bystander.key,bystander.name,bystander.color,T);
 world.monster={id:'death-mob',active:true,hp:1,maxHp:1,model:'uncle',position:[72,0,23],nextAttackAt:T+999999};
 const shot=applyAction(world,attacker,{action:'attack',direction:[0,0,1]},{now:T+100,actors:[attacker,bystander],rng:()=>.5});
 assert.ok(shot.attackEvent);
 tickWorld(world,{now:T+1000,actors:[attacker,bystander],activeFighters:0,rng:()=>.5});
 assert.equal(world.monster.active,false);
 assert.equal(world.monsterDeathEvents?.length,1);
 assert.equal(world.monsterDeathEvents[0].monsterId,'death-mob');
 assert.equal(world.monsterDeathEvents[0].damage,undefined);
 assert.equal(b.hp,b.maxHp);
 assert.equal(worldView(world,attacker.key,T+1001).monsterDeathEvents.length,1);
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/bursts\.play\(death\.position,'monster-death-'/);
});

test('inventory rerender preserves scroll and channel mouse-look can aim without dragging',()=>{
 const bag=readFileSync(new URL('../src/bag-view.js',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../src/player-controller.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(bag,/ui\.content\.scrollTop=scroll\.content/);
 assert.match(bag,/querySelector\('#bag-items'\)\.scrollTop=scroll\.items/);
 assert.match(controller,/addEventListener\('mousemove'/);
 assert.match(controller,/this\.channelAiming/);
 assert.match(main,/controller\.channelAiming=!!/);
});
