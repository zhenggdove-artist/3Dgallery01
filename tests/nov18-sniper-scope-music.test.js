import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';

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
 const charged=act(world,first+5200,{direction:[0,0,1],scoped:true,charge:1});
 assert.equal(charged.error,undefined);
 assert.equal(charged.attackEvent.ultimate,true);
 assert.ok(charged.attackEvent.fusionEchoes.length>0);
 // Leaving scope cancels an in-progress charged sniper rather than firing it.
 assert.equal(act(world,first+7500,{phase:'charge',scoped:true}).charging,true);
 const blocked=act(world,first+9500,{direction:[0,0,1],charge:1});
 assert.match(blocked.error,/scope/i);
 assert.equal(profile.chargeStartedAt,0);
});

test('client guards scoped Black Cat at A start, A release and all direct fire paths',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const gun=readFileSync(new URL('../src/gun-controller.js',import.meta.url),'utf8');
 const audio=readFileSync(new URL('../src/game-audio.js',import.meta.url),'utf8');
 assert.match(main,/sniperScopeAtPress=weapon\?\.id==='black-cat'&&gun\.mode===2/);
 assert.match(main,/weapon\?\.id==='black-cat'&&!wasScopedAtPress/);
 assert.match(main,/item\.id==='black-cat'&&gun\.mode!==2/);
 assert.match(main,/item\.id==='black-cat'\?\{scoped:true\}/);
 assert.match(gun,/weapon\(\)\?\.id==='black-cat'&&this\.mode!==2/);
 assert.match(audio,/sound\/GGTEMPLEMUSIC\.mp3/);
 assert.match(audio,/sound\/backgroundmusic\.MP3/);
});
