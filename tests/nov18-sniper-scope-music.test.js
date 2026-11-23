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


test('server requires either precise scope or declared shoulder for Black Cat',()=>{
 for(const fused of [false,true]){
  const {world,profile}=setup(fused),at=NOW+4000;
  for(const payload of [
   {direction:[0,0,1]},{phase:'charge'},
   {direction:[0,0,1],charge:1},{direction:[0,0,1],charge:1,phase:'channel'}
  ]){
   const result=act(world,at,payload);
   assert.match(result.error,/scope/i);
   assert.equal(profile.chargeStartedAt,0);
   assert.equal(profile.lastAttackAt,0);
   assert.equal(world.persistentAttacks.length,0);
  }
 }
});

test('unfused Black Cat shoulder can shoot inaccurately but cannot start an ultimate',()=>{
 const {world}=setup(),at=NOW+4000;
 assert.match(act(world,at,{phase:'charge',aimMode:'shoulder'}).error,/fusion/i);
 const shot=act(world,at,{direction:[0,0,1],aimMode:'shoulder'});
 assert.equal(shot.error,undefined);
 assert.equal(shot.attackEvent.ultimate,false);
 assert.equal(shot.attackEvent.rainbowSpiral,false);
 assert.notDeepEqual(shot.attackEvent.direction,[0,0,1],'shot spread is generated on the server');
 assert.match(act(world,at+4000,{direction:[0,0,1],charge:1,aimMode:'shoulder'}).error,/fusion/i);
});

test('precise sniper scope stays available but refuses ultimate charge',()=>{
 const {world}=setup(true),at=NOW+4000;
 const shot=act(world,at,{direction:[0,0,1],scoped:true,charge:0});
 assert.equal(shot.error,undefined);
 assert.deepEqual(shot.attackEvent.direction,[0,0,1]);
 assert.equal(shot.attackEvent.ultimate,false);
 assert.match(act(world,at+4000,{phase:'charge',scoped:true}).error,/fusion/i);
 assert.match(act(world,at+4000,{direction:[0,0,1],charge:1,scoped:true}).error,/fusion/i);
});

test('fused Black Cat shoulder long charge spawns a piercing rainbow spiral and fusion echoes',()=>{
 const {world,profile}=setup(true),first=NOW+4000;
 assert.equal(act(world,first,{phase:'charge',aimMode:'shoulder'}).charging,true);
 const chargedAt=first+itemById('black-cat').chargeMs+150;
 const charged=act(world,chargedAt,{direction:[0,0,1],aimMode:'shoulder',charge:1});
 assert.equal(charged.error,undefined);
 assert.equal(charged.attackEvent.ultimate,true);
 assert.equal(charged.attackEvent.rainbowSpiral,true);
 assert.ok(charged.attackEvent.fusionEchoes.length>0);
 assert.ok(charged.attackEvent.range>=256);
 assert.equal(charged.attackEvent.area,null,'piercing line must not become a remote circular blast');
 assert.ok(world.persistentAttacks.some(fx=>fx.weapon==='black-cat'&&fx.rainbowSpiral));
 assert.equal(profile.chargeStartedAt,0);
 assert.notDeepEqual(charged.attackEvent.direction,[0,0,1]);
});

test('client authorizes fused shoulder charge only and keeps separate scope buttons',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const gun=readFileSync(new URL('../src/gun-controller.js',import.meta.url),'utf8');
 const audio=readFileSync(new URL('../src/game-audio.js',import.meta.url),'utf8');
 assert.match(main,/sniperShoulderAtPress=authoredId\(weapon\)==='black-cat'&&gun\.mode===1&&canShoulderSniperUltimate/);
 assert.match(main,/aimMode:'shoulder'/);
 assert.match(main,/gun\.mode!==1&&gun\.mode!==2/);
 assert.match(gun,/this\.mode===1/);
 assert.match(audio,/sound\/GGTEMPLEMUSIC\.mp3/);
 assert.match(audio,/sound\/backgroundmusic\.MP3/);
});
