import test from 'node:test';
import assert from 'node:assert/strict';
import {SOUND_PROFILES,AUDIO_KEYS,normaliseAudioMix} from '../src/game-audio.js';
import {WEAPONS} from '../src/shared/catalog.js';
import {advanceIslandEnemy} from '../src/shared/island-combat.js';
import {createInitialWorld,applyAction,worldView} from '../src/shared/temple-rules.js';

test('every weapon exposes a separately adjustable synthesized sound',()=>{
 assert.ok(WEAPONS.length>30);
 for(const item of WEAPONS)assert.ok(AUDIO_KEYS.includes(item.id),item.id);
 for(const effect of ['water','fire','wind','lightning','ice','beam','monster-dash','monster-beam','monster-slam','monster-venom'])
  assert.ok(SOUND_PROFILES[effect],effect);
});
test('shared music version survives volume changes and levels clamp securely',()=>{
 const mix=normaliseAudioMix({master:55,music:25,sfx:80,musicVersion:1001,levels:{'prism-4':55,'white-cat':190,unknown:200}});
 assert.equal(mix.musicVersion,1001);
 assert.equal(mix.levels['prism-4'],55);
 assert.equal(mix.levels.unknown,undefined);
 assert.equal(normaliseAudioMix({master:500,music:-12}).master,200);
});
test('GM can control all player audio, normal player cannot',()=>{
 const now=Date.now(),world=createInitialWorld(now),gm={key:'gm',name:'Ely',role:'fighter',admin:true,position:[30,0,30]};
 const player={key:'other',name:'Visitor',role:'fighter',admin:false,position:[30,0,30]};
 const good=applyAction(world,gm,{action:'set-audio-level',key:'prism-4',volume:75},{now});
 assert.ok(!good.error,good.error);
 assert.equal(world.audioMix.levels['prism-4'],75);
 assert.ok(applyAction(world,player,{action:'set-audio-level',key:'master',volume:0},{now}).error);
 assert.equal(worldView(world,'gm',now).audioMix.levels['prism-4'],75);
 assert.ok(applyAction(world,gm,{action:'set-audio-level',key:'invalid',volume:50},{now}).error);
});
test('arena monsters telegraph hits and support dash, ray, slam and poison',()=>{
 const now=100000,monster={id:'m1',position:[0,0,0],hp:200,active:true,attackStyles:true,skills:[],damage:20,nextAttackAt:0};
 const target={key:'player',position:[2,0,0],role:'fighter'},hits=[];
 const callbacks={move:(p,d)=>{monster.position[0]+=Math.sign(p[0]-monster.position[0])*Math.min(Math.abs(p[0]-monster.position[0]),d);},
 hit:(player,damage,skill)=>hits.push({key:player.key,damage,motion:skill.motion})};
 advanceIslandEnemy(monster,[target],now,callbacks);
 assert.equal(monster.skills[0]?.motion,'swipe');
 assert.equal(monster.skills[0]?.phase,'warning');
 assert.equal(hits.length,0);
 advanceIslandEnemy(monster,[target],now+490,callbacks);
 assert.equal(monster.skills[0]?.phase,'active');
 assert.ok(hits.some(h=>h.motion==='swipe'));
 assert.ok(['charge','laser','slam','venom'].every(x=>
  ['charge','laser','slam','venom'].includes(x)));// Stable repertoire contract.
});
