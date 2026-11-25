import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {itemById} from '../src/shared/catalog.js';

const NOW=27_000_000;
const actor={key:'sniper-test',name:'Sniper',role:'fighter',color:'#fff',position:[75,0,0]};
function setup(fused=false){
 const world=createInitialWorld(NOW),profile=ensureProfile(world,actor.key,actor.name,actor.color,NOW);
 profile.inventory.push('black-cat');
 profile.equipment.weapon='black-cat';
 if(fused)profile.fusion['black-cat']={effects:['ember-1','frost-1'],bonus:20};
 return {world,profile};
}
function act(world,at,body){
 return applyAction(world,actor,{action:'attack',...body},{now:at,actors:[actor],rng:()=>.7});
}

test('server rejects unscoped Black Cat ordinary hits, charges and fused ultimates',()=>{
 for(const fused of [false,true]){
  const {world,profile}=setup(fused),at=NOW+4000;
  for(const payload of [
   {direction:[0,0,1]},
   {phase:'charge'},
   {direction:[0,0,1],charge:1},
   {direction:[0,0,1],charge:1,phase:'channel'}
  ]){
   const result=act(world,at,payload);
   assert.match(result.error,/scope/i);
   assert.equal(profile.chargeStartedAt,0);
   assert.equal(profile.lastAttackAt,0);
   assert.equal(world.persistentAttacks.length,0);
  }
 }
});

test('scoped Black Cat fires only normal attacks, even with legacy ultimate fusion or a stale charge',()=>{
 for(const fused of [false,true]){
  const {world,profile}=setup(fused),first=NOW+4000;
  for(const body of [{phase:'charge'},{phase:'channel-start'},{direction:[0,0,1],charge:1},{direction:[0,0,1],charge:.5}]){
   assert.match(act(world,first,{...body,scoped:true}).error,/normal attacks only/);
   assert.equal(profile.chargeStartedAt,0);
  }
  profile.chargeStartedAt=first-5000;
  const fired=act(world,first,{direction:[0,0,1],scoped:true,charge:0});
  assert.equal(fired.error,undefined);
  assert.equal(fired.attackEvent.ultimate,false);
  assert.equal(fired.attackEvent.charge,0);
  assert.equal(fired.attackEvent.manaCost,0);
  assert.equal(fired.attackEvent.fusionEchoes.length,0);
  assert.equal(fired.attackEvent.fusionEffects.length,0);
 }
});

test('shoulder attacks are rejected even with fused gear',()=>{
 for(const fused of [false,true]){
  const {world,profile}=setup(fused),at=NOW+4000;
  for(const body of [{direction:[0,0,1],charge:0},{phase:'charge'},{direction:[0,0,1],charge:1,scoped:true}]){
   assert.match(act(world,at,{...body,aimMode:'shoulder'}).error,/scope/i);
   assert.equal(profile.chargeStartedAt,0);
  }
  assert.equal(world.persistentAttacks.length,0);
 }
});
test('client uses scope or fused shoulder state and the camera surface can fire',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const gun=readFileSync(new URL('../src/gun-controller.js',import.meta.url),'utf8');
 const audio=readFileSync(new URL('../src/game-audio.js',import.meta.url),'utf8');
 assert.doesNotMatch(main,/hasBlackCatFusionUltimate/);
 assert.match(gun,/this\.mode=w\.id==='black-cat'\?2:1/);
 assert.doesNotMatch(gun,/shoulderPress|canShoulderCharge/);
 assert.match(audio,/sound\/GGTEMPLEMUSIC\.mp3/);
 assert.doesNotMatch(audio,/sound\/backgroundmusic\.MP3/);
});
