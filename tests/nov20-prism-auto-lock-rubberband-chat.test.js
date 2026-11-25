import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,tickPrismChannels,prismDamageMultiplier,
 validateState,worldView,PRISM_DAMAGE_TICK_MS} from '../src/shared/temple-rules.js';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const T=4_000_000;
const actor={key:'prism-owner',name:'Prism',color:'#abcdef',role:'fighter',position:[65,0,0],seat:0};
function setup(){
 const world=createInitialWorld(T);
 const owner=ensureProfile(world,actor.key,actor.name,actor.color,T);
 owner.inventory.push('prism-3');owner.equipment.weapon='prism-3';
 world.monster={id:'prism-mob',active:true,variant:'uncle',model:'uncle',
  position:[65,0,8],hp:50000,maxHp:50000,nextAttackAt:T+9999999,skills:[]};
 const attack=(now,body)=>applyAction(world,actor,{action:'attack',direction:[0,0,1],...body},
  {now,actors:[actor],rng:()=>.5});
 assert.equal(attack(T+100,{phase:'charge'}).charging,true);
 assert.equal(attack(T+3000,{phase:'channel-start'}).channeling,true);
 const first=attack(T+3100,{phase:'channel',charge:1});
 assert.equal(first?.error,undefined);
 assert.equal(first.attackEvent.channel,true);
 assert.ok(owner.prismChannelStats);
 assert.equal(world.persistentAttacks.some(a=>a.owner===actor.key&&a.weapon==='prism-3'),false,
  'prism must NOT also spawn the old forward-tube hit that double damages a lock');
 return {world,owner,attack};
}

test('server never validates normal post-cast walking against stale 5% speed',()=>{
 const prev={position:[0,0,0],rotation:0,animation:'walk'};
 const next={position:[2,0,0],rotation:0,animation:'walk'};
 const mobility={stats:{speed:1},channeling:true,effects:{},cityDamage:{}};
 assert.equal(validateState(prev,next,200,'fighter',null,null,T,mobility).error,undefined,
  'a legal two-metre step must not be rejected after a lost staff stop');
 assert.equal(validateState(prev,{...next,position:[45,0,0]},200,'fighter',null,null,T,mobility).error,'Movement rejected',
  'the speed validator must still reject nonphysical long-range teleports');
 assert.match(src('src/shared/temple-rules.js'),/const maxSpeed=\(hasWings\?28:14\)\*boostedSpeed\+/);
});

test('one authentic prism VFX replaces four artificial perpendicular cardinal beams',()=>{
 const effects=src('src/weapon-vfx.js'),native=src('src/numbered-weapon-effects.js');
 assert.doesNotMatch(effects,/prismCardinalBeams|new ForwardChannelBeam/);
 assert.match(native,/world\?\.prismLocks\?\.\[e\.owner\]/);
 assert.match(native,/entry\.lockedPoint\.clone\(\)/);
});

test('sticky server prism locks closest living foe and sends exact target position to client',()=>{
 const {world,owner,attack}=setup();
 let changed=tickPrismChannels(world,[actor],T+3200,()=>.5);
 assert.ok(changed);
 const lock=world.prismLocks[actor.key];
 assert.ok(lock);
 assert.equal(lock.targetKey,'prism-mob');
 assert.equal(lock.kind,'monster');
 assert.deepEqual(worldView(world,actor.key,T+3200).prismLocks[actor.key].position,lock.position);
 const hp=world.monster.hp;
 assert.equal(tickPrismChannels(world,[actor],T+3320,()=>.5),false,
  'before 250ms there must be no invisible damage tick');
 assert.equal(world.monster.hp,hp);
 tickPrismChannels(world,[actor],T+3500,()=>.5);
 assert.ok(world.monster.hp<hp,'after 250ms target must take sustained damage');
 const hp2=world.monster.hp;
 tickPrismChannels(world,[actor],T+3600,()=>.5);
 assert.equal(world.monster.hp,hp2,'no double damage before the next 250ms');
 world.monsters=[{id:'another-mob',active:true,position:[65,0,3],hp:10000,maxHp:10000}];
 tickPrismChannels(world,[actor],T+3700,()=>.5);
 assert.equal(world.prismLocks[actor.key].targetKey,'prism-mob',
  'a newly nearer enemy must not steal a still-valid lock');
 world.monster.position=[65,0,110];
 tickPrismChannels(world,[actor],T+3900,()=>.5);
 assert.equal(world.prismLocks[actor.key].targetKey,'another-mob',
  'out-of-range old victim releases the lock and finds another enemy');
 assert.equal(world.prismLocks[actor.key].since,T+3900,'new victim starts from initial DPS');
 assert.equal(attack(T+4000,{phase:'channel-stop'}).channeling,false);
 assert.equal(world.prismLocks[actor.key],undefined,'release deletes damage source immediately');
 tickPrismChannels(world,[actor],T+4600,()=>.5);
 assert.equal(world.prismLocks[actor.key],undefined);
});

test('prism 20% per second compound ramp reaches an absolute 5x ceiling',()=>{
 assert.equal(PRISM_DAMAGE_TICK_MS,250);
 assert.equal(prismDamageMultiplier(0),1);
 assert.equal(prismDamageMultiplier(999),1);
 assert.equal(prismDamageMultiplier(1000),1.2);
 assert.ok(Math.abs(prismDamageMultiplier(2000)-1.44)<1e-10);
 assert.equal(prismDamageMultiplier(9000),5);
 assert.equal(prismDamageMultiplier(600000),5);
});

test('default chat stays ten pixels above the healing quickbar across viewport sizes',()=>{
 const css=src('fidelity-ui.css');
 assert.ok(css.includes('--chat-gap:10px'));
 assert.ok(css.includes('bottom:calc(var(--comfort-bottom) + var(--comfort-slot-size) + var(--chat-gap))!important'));
 assert.ok(css.includes('bottom:var(--comfort-bottom)'));
 assert.ok(css.includes('--comfort-slot-size:43px'));
 assert.ok(css.includes('--comfort-slot-size:35px'));
});
