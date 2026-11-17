import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {monsterBeamEndpoint,monsterSkillContains,MONSTER_SKILLS} from '../src/shared/island-combat.js';
import {normalMeleeFootprint,MELEE_TEN_PIXEL_MARGIN} from '../src/shared/melee-contact.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {itemById} from '../src/shared/catalog.js';
import {NumberedWeaponEffects,requestedEffect,budgetedNativeOptions} from '../src/numbered-weapon-effects.js';
import {MonsterAttackEffects} from '../src/monster-attack-effects.js';

const T=10000000;

test('laser moves from near to far, pans laterally, and uses the same authoritative moving hit segment',()=>{
 const s={motion:'beam',phase:'active',origin:[0,0,0],aim:[0,0,38],start:T,end:T+5000};
 const begin=monsterBeamEndpoint(s,T),middle=monsterBeamEndpoint(s,T+2500),far=monsterBeamEndpoint(s,T+5000);
 assert.ok(Math.abs(begin[2]-38*.24)<.0001,'short ray begins near monster');
 assert.ok(middle[2]>begin[2]&&middle[2]<far[2]);
 assert.ok(Math.abs(middle[0])>1,'lateral sweep visibly changes ground impact');
 assert.ok(Math.abs(far[2]-38)<.0001,'ends at full reach');
 assert.equal(monsterSkillContains(s,[0,0,30],T+100),false,'far targets cannot be hit by the initial short ray');
 assert.equal(monsterSkillContains(s,[0,0,30],T+4800),true);
 assert.equal(MONSTER_SKILLS.beam.active,5000);
 assert.equal(MONSTER_SKILLS.beam.radius,4.95,'damage tube doubles with visual diameter');
});

test('ordinary melee at each rarity stays inside authored weapon mesh plus ten pixels; saber excluded',()=>{
 assert.ok(MELEE_TEN_PIXEL_MARGIN>.07&&MELEE_TEN_PIXEL_MARGIN<.08);
 for(const family of ['whip','swatter','pan','planter','palm']){
  for(let tier=1;tier<=5;tier++){
   const item=itemById(family+'-'+tier),contact=normalMeleeFootprint(item);
   const world=createInitialWorld(T),actor={key:'caster',name:'Caster',role:'fighter',position:[75,0,0]};
   const profile=ensureProfile(world,actor.key,actor.name,'#eeeeee',T);
   profile.inventory.push(item.id);profile.equipment.weapon=item.id;
   const result=applyAction(world,actor,{action:'attack',direction:[0,0,1]},{
    now:T+5000,actors:[actor],rng:()=>.5});
   assert.ok(result.attackEvent&&!result.attackEvent.ultimate,family+'-'+tier);
   assert.ok(result.attackEvent.range<=contact.range+.001,family+'-'+tier+' range');
   assert.ok(result.attackEvent.radius<=contact.radius+.001,family+'-'+tier+' extra sweep width');
  }
 }
 const saber=itemById('saber-5');
 assert.equal(normalMeleeFootprint(saber),null,'light saber range must remain unaffected');
});

test('all light-saber tiers show original dimensional-rend on final normal combo',()=>{
 for(let tier=1;tier<=5;tier++)
  assert.equal(requestedEffect(itemById('saber-'+tier),{
   combo:5,ultimate:false,channel:false,qualityTier:tier})?.number,47);
 const budget=budgetedNativeOptions({number:47},{size:3,quantity:32,density:.8,panelCount:9});
 assert.equal(budget.panelCount,0,'disable expensive scene-refracting panels, keep original slash meshes');
 assert.equal(budget.quantity,8);
 assert.ok(budget.size<=1.7);
});

test('repeated original #47 casts reuse the native effect without growing concurrent GPU allocations',()=>{
 const scene=new THREE.Scene(),effects=new NumberedWeaponEffects(scene);
 const item=itemById('saber-2');
 for(let i=0;i<6;i++){
  assert.equal(effects.play({id:'combo'+i,origin:[0,1,0],direction:[0,0,1],
   range:3,combo:5,ultimate:false,qualityTier:2,qualityScale:1},item),true);
  assert.equal(effects.active.length,1);
  assert.equal(effects.active[0].fx.group.userData.vfxId,'dimensional-rend');
  assert.equal(effects.active[0].fx.settings.panelCount,0);
 }
 effects.dispose();
 assert.equal(effects.active.length,0);
});

test('native full-screen post effects cannot override a VHS offscreen render target',()=>{
 const effects=new NumberedWeaponEffects(new THREE.Scene());
 let rendered=0;
 effects.active.push({spec:{number:70},fx:{render(){throw Error('must never enter nested vendor render');}}});
 effects.render({getRenderTarget:()=>({id:'VHS offscreen'}),render(){rendered++;}},new THREE.Scene(),new THREE.Camera());
 assert.equal(rendered,1,'VHS must retain ownership of its offscreen framebuffer');
 effects.active.length=0;
 effects.dispose();
});

test('monster pulse beam still uses vendor source with doubled physical diameter',()=>{
 const effects=new MonsterAttackEffects(new THREE.Scene());
 const beam=effects.make('beam');
 assert.equal(beam.native.settings.size,1.8,'vendor shader size is capped, keep authored width');
 effects.updateEntry(beam,{motion:'beam',phase:'active',origin:[0,0,0],
  aim:[0,0,38],start:T,end:T+5000,radius:4.95},T+1000,null,[0,0,0]);
 assert.equal(beam.native.group.scale.y,2);
 assert.equal(beam.native.group.scale.z,2);
 assert.equal(beam.root.userData.vfxId,'pulse-beam');
 beam.native.dispose();
 beam.root.removeFromParent();
});
