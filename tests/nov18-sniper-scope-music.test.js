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

test('scoped Black Cat still fires, and scoped full charges preserve intentional ultimates',()=>{
 const {world,profile}=setup(true),first=NOW+4000;
 const fired=act(world,first,{direction:[0,0,1],scoped:true,charge:0});
 assert.equal(fired.error,undefined);
 assert.equal(fired.attackEvent.ultimate,false);
 assert.equal(fired.attackEvent.fusionEchoes.length,0);
 assert.equal(act(world,first+3000,{phase:'charge',scoped:true}).charging,true);
 const chargedAt=first+3000+itemById('black-cat').chargeMs+150;
 const charged=act(world,chargedAt,{direction:[0,0,1],scoped:true,charge:1});
 assert.equal(charged.error,undefined);
 assert.equal(charged.attackEvent.ultimate,true);
 assert.ok(charged.attackEvent.fusionEchoes.length>0);
 // Leaving scope cancels an in-progress charged sniper rather than firing it.
 assert.equal(act(world,chargedAt+2500,{phase:'charge',scoped:true}).charging,true);
 const blocked=act(world,chargedAt+2500+itemById('black-cat').chargeMs+150,{direction:[0,0,1],charge:1});
 assert.match(blocked.error,/scope/i);
 assert.equal(profile.chargeStartedAt,0);
});

test('shoulder Black Cat normal shots need no scope, but unfused ultimates stay locked',()=>{
 const {world,profile}=setup(false),at=NOW+4000;
 const fired=act(world,at,{direction:[0,0,1],aimMode:'shoulder',charge:0});
 assert.equal(fired.error,undefined);
 assert.equal(fired.attackEvent.ultimate,false);
 assert.equal(fired.attackEvent.aimMode,'shoulder');
 assert.equal(world.persistentAttacks.at(-1).shoulderSpread,true);
 assert.equal(act(world,at+5000,{phase:'charge',aimMode:'shoulder'}).error,
  'Fuse a chargeable weapon to unlock the shoulder ultimate');
 assert.equal(profile.chargeStartedAt,0);
});

test('only a fused and fully charged shoulder sniper launches the penetrating spiral',()=>{
 const {world,profile}=setup(true),at=NOW+4000;
 assert.equal(act(world,at,{phase:'charge',aimMode:'shoulder'}).charging,true);
 const first=act(world,at+itemById('black-cat').chargeMs+10,{
  direction:[0,0,1],aimMode:'shoulder',charge:1
 });
 assert.equal(first.error,undefined);
 assert.equal(first.attackEvent.ultimate,true);
 assert.equal(first.attackEvent.piercing,true);
 assert.equal(first.attackEvent.aimMode,'shoulder');
 assert.ok(first.attackEvent.fusionEchoes.length>0);
 assert.equal(world.persistentAttacks.find(v=>v.weapon==='black-cat')?.shoulderSpread,true);
});

test('client uses scope or fused shoulder state and the camera surface can fire',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const gun=readFileSync(new URL('../src/gun-controller.js',import.meta.url),'utf8');
 const audio=readFileSync(new URL('../src/game-audio.js',import.meta.url),'utf8');
 assert.match(main,/function hasBlackCatFusionUltimate\(/);
 assert.match(main,/weapon\?\.id==='black-cat'&&!wasScopedAtPress/);
 assert.match(main,/gun\.mode===1&&charge>=1&&!hasBlackCatFusionUltimate\(\)/);
 assert.match(main,/aimMode:gun\.mode===1\?'shoulder':'scope'/);
 assert.match(gun,/\['goldfish','black-cat'\]/);
 assert.match(audio,/sound\/GGTEMPLEMUSIC\.mp3/);
 assert.doesNotMatch(audio,/sound\/backgroundmusic\.MP3/);
});
