import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createInitialWorld,applyAction,worldView,ensureProfile,tickWorld} from '../src/shared/temple-rules.js';
import {advanceIslandEnemy,monsterSkillContains,MONSTER_SKILLS} from '../src/shared/island-combat.js';
import {createHeart} from '../src/heart-model.js';
import {NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';
import {itemById} from '../src/shared/catalog.js';
import {SOUND_PROFILES} from '../src/game-audio.js';
import venomPool from '../vendor/00gamedevs/venom-pool.js';
import pulseBeam from '../vendor/00gamedevs/pulse-beam.js';

test('actual 00GameDevs original renderer supports both requested native effects',()=>{
 const beam=pulseBeam({density:.5}),venom=venomPool({quantity:7});
 assert.equal(beam.group.isObject3D,true);
 assert.equal(venom.group.isObject3D,true);
 assert.equal(typeof beam.setEndpoints,'function');
 beam.dispose();venom.dispose();
});

test('prism visible beam diameter is 5x without extending its reach',()=>{
 const effects=new NumberedWeaponEffects(new THREE.Scene());
 const item=itemById('prism-3'),event={id:'prism',weapon:item.id,origin:[0,1,0],
  direction:[0,0,1],range:24,qualityScale:1,qualityTier:3,channel:true,ultimate:true};
 assert.ok(effects.play(event,item));
 const fx=effects.active[0].fx;
 assert.equal(fx.group.scale.y,5);assert.equal(fx.group.scale.z,5);
 assert.ok(Math.abs(fx.group.scale.x-24/4.8)<.01);
 effects.dispose();
});

test('inflated heart has actual rounded depth, not an extruded front/back plane',()=>{
 const heart=createHeart();const box=new THREE.Box3().setFromObject(heart);
 assert.ok(box.max.z-box.min.z>.8);
 assert.ok(box.max.y-box.min.y>.8);
 assert.equal(heart.material.color.getHexString().length,6);
 heart.geometry.dispose();heart.material.dispose();
});

test('outer monsters cycle short melee, stomp and poison, with 5 HP/s venom ticks',()=>{
 const m={id:'mob',position:[0,0,0],damage:12,nextAttackAt:0,skills:[],attackCount:0},
  target={key:'f',position:[2,0,0]},strikes=[];
 const opt={move(){},hit(_,amount,s){strikes.push([s.motion,amount]);}};
 advanceIslandEnemy(m,[target],1000,opt);
 assert.equal(m.skills[0].motion,'swipe');
 advanceIslandEnemy(m,[target],1500,opt);
 assert.ok(strikes.some(([type])=>type==='swipe'));
 advanceIslandEnemy(m,[target],2000,opt);
 advanceIslandEnemy(m,[target],3000,opt);
 assert.ok(m.skills.some(s=>s.motion==='stomp'&&s.phase==='warning'));
 advanceIslandEnemy(m,[target],4100,opt);
 assert.equal(strikes.filter(([type])=>type==='stomp').length,0,'no stomp damage while ascending');
 advanceIslandEnemy(m,[target],5300,opt);
 assert.ok(strikes.some(([type])=>type==='stomp'),'stomp applies damage after descent');
 advanceIslandEnemy(m,[target],5700,opt);
 assert.ok(m.skills.some(s=>s.motion==='venom'&&s.phase==='warning'));
 advanceIslandEnemy(m,[target],6600,opt);
 advanceIslandEnemy(m,[target],7700,opt);
 const venomHits=strikes.filter(([type])=>type==='venom');
 assert.equal(venomHits.length,2);
 assert.ok(venomHits.every(([,amount])=>amount===5));
 assert.equal(Object.keys(MONSTER_SKILLS).length,5);
 assert.ok(MONSTER_SKILLS.freeze);
 assert.equal(MONSTER_SKILLS.charge,undefined);
 assert.equal(monsterSkillContains({phase:'active',end:2000,motion:'venom',aim:[2,0,0],origin:[0,0,0]},[2,10,0],1500),false);
});

test('GM volume changes are authorized and persist into every player world view',()=>{
 const world=createInitialWorld(1000);
 const guest={key:'guest',name:'Guest',admin:false,role:'fighter',position:[0,0,0]};
 const gm={key:'gm',name:'GM',admin:true,role:'spectator',position:[0,0,0]};
 assert.ok(applyAction(world,guest,{action:'gm-audio-setting',key:'music',value:0},{now:1000}).error);
 const result=applyAction(world,gm,{action:'gm-audio-setting',key:'music',value:.45},{now:1000});
 assert.equal(result.audioSettings.music,.45);
 assert.equal(worldView(world,guest.key,1000).audioSettings.music,.45);
 assert.ok(Object.hasOwn(SOUND_PROFILES,'wind'));
 assert.ok(Object.hasOwn(SOUND_PROFILES,'goldfish'));
 assert.notEqual(SOUND_PROFILES.fire.shape,SOUND_PROFILES.water.shape);
});

test('ground slam stuns grounded non-GM fighters for exactly one second',()=>{
 const now=6000,world=createInitialWorld(now),actor={key:'fighter',name:'Target',role:'fighter',position:[75,0,25]};
 const profile=ensureProfile(world,actor.key,actor.name,'#aabbcc',now);
 world.monster={active:true,id:'m',position:[75,0,24],skills:[{
   id:'slam',motion:'stomp',phase:'active',origin:[75,0,24],aim:[75,0,25],
   start:now-1200,end:now+300,hit:[],lastTick:{},damage:8
 }],nextAttackAt:now+3000,hp:100,maxHp:100};
 tickWorld(world,{now,activeFighters:0,actors:[actor],rng:()=>.5});
 assert.equal(profile.effects?.stun?.until,now+1000);
 // A starter shield can fully absorb impact damage; grounded slam must
 // still apply its one-second stun and physical knockback.
 assert.equal(profile.hitReaction?.motion,'stomp');
 assert.ok(profile.hitReaction?.knockbackDistance>0);
});
