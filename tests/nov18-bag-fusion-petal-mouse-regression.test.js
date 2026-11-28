import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,tickBloomChannelHeal} from '../src/shared/temple-rules.js';
import {fuseTemple} from '../src/shared/temple-fusion.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';
import {ITEMS,itemById,attackStats} from '../src/shared/catalog.js';
import {normalMeleeFootprint} from '../src/shared/melee-contact.js';
import {PlayerController} from '../src/player-controller.js';
import {MonsterAttackEffects} from '../src/monster-attack-effects.js';
import {STAFF_RAISE_SECONDS,advanceStaffRaise} from '../src/staff-raise-pose.js';
import {VerdantRestorationChannel,RESTORATION_GROUND_SIZE} from '../src/verdant-restoration-channel.js';

const NOW=41000000,person=(key='p',admin=false)=>({key,name:key,color:'#abcdef',position:[75,0,0],role:'fighter',admin});
const profile=(world,key='p',admin=false)=>ensureProfile(world,key,key,'#abcdef',NOW,admin);

test('weapon can fuse only weapon; every other slot can fuse only its own slot',()=>{
 const world=createInitialWorld(NOW),gm=profile(world,'gm',true);
 const groups=new Map();
 for(const item of ITEMS)if(['weapon','head','outfit','wings','shield'].includes(item.slot)){
  if(!groups.has(item.slot))groups.set(item.slot,[]);
  groups.get(item.slot).push(item);
 }
 for(const slot of ['weapon','head','outfit','wings','shield'])
  assert.ok(groups.get(slot).length>=2,slot+' needs two items');
 assert.equal(ITEMS.some(item=>item.slot==='armor'),false,'removed armor slot must not return');
 assert.equal(ITEMS.some(item=>item.slot==='material'),false,'deprecated material slot must not exist');
 for(const [a,b] of [['weapon','head'],['head','weapon'],['weapon','outfit'],['outfit','wings'],
     ['wings','shield'],['shield','head']]){
  const source=groups.get(b)[0],target=groups.get(a)[0];
  const inventory=[...gm.inventory],wallet=gm.wallet;
  const result=fuseTemple(world,gm,{sourceId:source.id,targetId:target.id,requestId:'reject-'+a+'-'+b},()=>0);
  assert.match(result.error,/matching equipment categories|same category/,a+' ← '+b);
  assert.deepEqual(gm.inventory,inventory,'invalid cross-slot attempts consume nothing');
  assert.equal(gm.wallet,wallet);
 }
 for(const slot of ['weapon','head','outfit','wings','shield']){
  const [source,target]=groups.get(slot);
  const result=fuseTemple(world,gm,{sourceId:source.id,targetId:target.id,
   requestId:'same-slot-'+slot},()=>0);
  assert.equal(result.fusion?.success,true,slot+' legitimate fusion');
 }
});

test('ranged weapon fused into melee cannot change normal reach, including old persisted fusion',()=>{
 const world=createInitialWorld(NOW),gm=profile(world,'gm',true);
 const pan=itemById('pan-1'),sniper=itemById('black-cat');
 gm.equipment.weapon=pan.id;
 gm.fusion[pan.id]={layer:2,attempts:2,templeStats:{range:140,radius:18,
  chargeRange:400,damage:999},effects:['frost-1','storm-1']};
 const before=normalMeleeFootprint(pan);
 const legacy=equippedItem(gm,pan);
 assert.equal(legacy.range,pan.range);
 assert.equal(legacy.radius,pan.radius);
 assert.ok(attackStats(legacy,0).range<10);
 assert.equal(fuseTemple(world,gm,{sourceId:sniper.id,targetId:pan.id,
  requestId:'legacy-pan-fusion'},()=>0).fusion.success,true);
 assert.equal(gm.fusion[pan.id].templeStats.range,undefined);
 assert.equal(gm.fusion[pan.id].templeStats.radius,undefined);
 const attack=applyAction(world,person('gm',true),{action:'attack',direction:[0,0,1]},
  {now:NOW+2000,actors:[person('gm',true)],rng:()=>.5});
 assert.ok(attack.attackEvent.range<=before.range,JSON.stringify(attack.attackEvent.range));
 assert.ok(attack.attackEvent.radius<=before.radius);
 assert.ok(gm.fusion[pan.id].effects.includes('frost-1'));
});

test('flower crown channel restores quality-scaled HP per second, capped, never on tap or after stopping',()=>{
 const world=createInitialWorld(NOW),a=person('flora');
 const p=profile(world,'flora');
 p.inventory.push('bloom-1');p.equipment.weapon='bloom-1';p.hp=91;
 const weapon=itemById('bloom-1');
 assert.equal(tickBloomChannelHeal(p,NOW+10000),0,'ordinary weapon state does not heal');
 const charge=applyAction(world,a,{action:'attack',phase:'charge'},{now:NOW+500});
 assert.equal(charge.charging,true);
 const started=NOW+500+(weapon.chargeMs||1500)+50;
 const active=applyAction(world,a,{action:'attack',phase:'channel-start'},{now:started});
 assert.equal(active.channeling,true);
 const firstPulse=applyAction(world,a,{action:'attack',phase:'channel',direction:[0,0,1]},{now:started+100,actors:[a],rng:()=>.5});
 assert.ok(firstPulse.attackEvent,'healing requires the first mana-paid pulse');
 p.hp=91; // Equip refresh can add +20 max HP; set test damage afterward.
 assert.equal(tickBloomChannelHeal(p,started+999),0);
 // A live channel has a connected actor; disconnected casters now stop.
 tickWorld(world,{now:started+1000,actors:[a],activeFighters:1,rng:()=>.5});
 assert.ok(Math.abs(p.hp-92)<1e-8);
 assert.equal(tickBloomChannelHeal(p,started+1000),0,'repeat tick in same second cannot double heal');
 const heartbeat=applyAction(world,a,{action:'attack',phase:'channel',direction:[0,0,1]},
  {now:started+1750,actors:[a],rng:()=>.5});
 assert.ok(heartbeat.attackEvent,'a live 1 HP/s channel sends authenticated attack pulses');
 assert.equal(tickBloomChannelHeal(p,started+2300),1);
 assert.ok(Math.abs(p.hp-93)<1e-8);
 p.hp=p.maxHp-.5;
 assert.equal(tickBloomChannelHeal(p,started+3300),.5,'healing is capped at max HP');
 assert.equal(p.hp,p.maxHp);
 p.hp=p.maxHp-8;
 assert.equal(applyAction(world,a,{action:'attack',phase:'channel-stop'},{now:started+3500}).channeling,false);
 assert.equal(tickBloomChannelHeal(p,started+5500),0);
 assert.equal(p.hp,p.maxHp-8);
 p.channelWeapon='bloom-1';p.channelStartedAt=started;p.lastBloomHealAt=started;
 p.lastChannelPulseAt=started;p.equipment.weapon='ember-1';
 assert.equal(tickBloomChannelHeal(p,started+1200),0,'unequipped flower crown cannot restore HP');
});

test('official ground healing scene-object VFX is present, at character scale, while freeze warnings are red',()=>{
 const native=readFileSync(new URL('../vendor/00gamedevs/source/verdant-restoration.js',import.meta.url),'utf8');
 assert.match(native,/00GameDevs exported assets/);
 assert.match(native,/The MIT License/);
 assert.match(native,/"id":"verdant-restoration"/);
 assert.match(native,/export default function createVFX/);
 assert.ok(RESTORATION_GROUND_SIZE<=.5&&RESTORATION_GROUND_SIZE>=.25);
 const manager=new VerdantRestorationChannel(new THREE.Scene());
 assert.equal(manager.live.size,0);
 const effects=new MonsterAttackEffects(new THREE.Scene());
 const ice=effects.make('freeze');
 assert.equal(ice.marker.material.color.getHexString(),'ff242c');
 assert.equal(ice.fringe.material.color.getHexString(),'ff242c');
 const active=readFileSync(new URL('../src/weapon-vfx.js',import.meta.url),'utf8');
 assert.match(active,/!data\.fusionEcho&&item\.family==='petal'/);
 assert.match(active,/this\.restoration\.pulse\(root\)/);
 ice.native.dispose();
});

test('a single 100ms raise remains continuous without blocking attack input',()=>{
 assert.equal(STAFF_RAISE_SECONDS,.1);
 assert.ok(Math.abs(advanceStaffRaise(0,true,.04)-.4)<1e-9);
 assert.ok(Math.abs(advanceStaffRaise(.4,true,.06)-1)<1e-9);
 assert.equal(advanceStaffRaise(1,true,.02),1);
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/staffCastingUntil=Infinity/);
 assert.doesNotMatch(main,/STAFF_RAISE_SECONDS\*1000-heldMs/);
 assert.match(main,/normalOnPress=true;void performAttack\(0\)/);
 assert.match(main,/await performAttack\(0,null,releaseAim\)/);
 assert.match(main,/controller\.channelAiming=!!\(attackHeld&&isChannelStaff/);
});

test('mouse camera rotates during held cast even when attack button captured the pointer',()=>{
 const prior={add:globalThis.addEventListener,doc:globalThis.document,media:globalThis.matchMedia,
  width:globalThis.innerWidth,height:globalThis.innerHeight};
 const globals={},canvasListeners={};let pointerMove;
 try{
  globalThis.addEventListener=(name,fn)=>{globals[name]=fn;};
  globalThis.document={addEventListener:(name,fn)=>{if(name==='pointermove')pointerMove=fn;}};
  globalThis.matchMedia=()=>({matches:false});
  globalThis.innerWidth=1000;globalThis.innerHeight=800;
  const canvas={addEventListener:(name,fn)=>{canvasListeners[name]=fn;}};
  const player=new PlayerController({canvas,camera:new THREE.PerspectiveCamera(60,1,.1,300),
   arena:{groundHeight:()=>0},root:new THREE.Group(),seat:0});
  player.setEnabled(true);player.channelAiming=true;
  player.drag={id:12,x:100,y:100,yaw:0,pitch:.2}; // Stale canvas drag must NOT lock the camera.
  pointerMove({pointerType:'mouse',movementX:100,movementY:-40,clientX:200,clientY:160});
  assert.ok(Math.abs(player.yaw+.4)<.00001,'a captured left mouse button must still rotate yaw');
  assert.ok(Math.abs(player.pitch-.1)<.00001);
  canvasListeners.pointermove({pointerId:12,pointerType:'mouse',clientX:205,clientY:160});
  assert.ok(Math.abs(player.yaw+.4)<.00001,'canvas must not rotate a second time');
  pointerMove({pointerType:'touch',movementX:60,movementY:0,clientX:300,clientY:160});
  assert.ok(Math.abs(player.yaw+.4)<.00001,'mobile touch remains unaffected');
 }finally{
  globalThis.addEventListener=prior.add;globalThis.document=prior.doc;
  globalThis.matchMedia=prior.media;globalThis.innerWidth=prior.width;globalThis.innerHeight=prior.height;
 }
});

test('desktop BAG uses exactly seven visible columns and six grid rows; mobile layout remains separate',()=>{
 const css=readFileSync(new URL('../fidelity-ui.css',import.meta.url),'utf8');
 assert.match(css,/@media \(min-width: 840px\) and \(min-height: 650px\)/);
 assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(css,/min-height:calc\(6 \* var\(--temple-bag-row\)/);
 assert.match(css,/#bag-items:not\(\.equipment-view\)/);
});
