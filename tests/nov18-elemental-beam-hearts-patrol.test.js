import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weaponSoundKey,ELEMENTAL_AUDIO_KEYS,SOUND_PROFILES} from '../src/game-audio.js';
import {WEAPONS} from '../src/shared/catalog.js';
import {requestedEffect} from '../src/numbered-weapon-effects.js';
import {patrolMonster} from '../src/shared/monster-patrol.js';
import {dedupeHealingHearts,replenishHearts} from '../src/shared/heart-pickups.js';

test('all eight audible elements have distinct profiles and their own GM level',()=>{
 const expected=['fire','dark','light','water','wind','plant','ice','lightning'];
 assert.deepEqual([...ELEMENTAL_AUDIO_KEYS],expected);
 const fingerprints=new Set();
 for(const key of expected){
  const p=SOUND_PROFILES[key];
  assert.ok(p&&p.noise>0&&p.gain>0,key);
  fingerprints.add([p.freq,p.end,p.shape,p.duration].join(':'));
 }
 assert.equal(fingerprints.size,8,'elemental timbres cannot reuse the same synthesis signature');
 assert.ok(SOUND_PROFILES.explosion&&SOUND_PROFILES.explosion.noise>0);
 assert.equal(weaponSoundKey({id:'chiang-token',family:'pan',element:'dark'}),'dark');
 assert.equal(weaponSoundKey({id:'prism-4',family:'beam',element:'light'}),'light');
 assert.equal(weaponSoundKey({id:'frost-1',family:'ice',element:'water'}),'ice');
 assert.equal(weaponSoundKey({id:'storm-1',family:'lightning',element:'wind'}),'lightning');
 assert.equal(weaponSoundKey({id:'bloom-2',family:'petal',element:'earth'}),'plant');
 assert.equal(weaponSoundKey({id:'nova-2',family:'wave',element:'wind'}),'wind');
 assert.equal(weaponSoundKey({id:'ember-2',family:'fire',element:'fire'}),'fire');
 assert.equal(weaponSoundKey({id:'tide-2',family:'water',element:'water'}),'water');
 for(const weapon of WEAPONS)assert.ok(SOUND_PROFILES[weaponSoundKey(weapon)],weapon.id);
});

test('prism family uses the real, bundled 00GameDevs charged-beam module in all modes',()=>{
 for(const event of [{channel:false,ultimate:false},{channel:true},{channel:false,ultimate:true}]){
  const spec=requestedEffect({id:'prism-4',family:'beam'},event);
  assert.equal(spec?.asset,'charged-beam');
 }
 const mod=readFileSync(new URL('../src/numbered-weapon-effects.js',import.meta.url),'utf8');
 const original=readFileSync(new URL('../vendor/00gamedevs/charged-beam.js',import.meta.url),'utf8');
 assert.match(mod,/import chargedBeam from '\.\.\/vendor\/00gamedevs\/charged-beam\.js'/);
 assert.match(original,/"id": "charged-beam"/);
 assert.match(original,/export default function createVFX/);
});

test('non-aggro perimeter humanoids pause, walk slowly and stop again',()=>{
 const mob={active:true,position:[70,0,0],skills:[],moving:false};
 const move=(to,dist)=>{const d=Math.hypot(to[0]-mob.position[0],to[2]-mob.position[2]);if(!d)return;mob.position[0]+=(to[0]-mob.position[0])*Math.min(1,dist/d);mob.position[2]+=(to[2]-mob.position[2])*Math.min(1,dist/d);};
 const rng=()=>.5;
 assert.equal(patrolMonster(mob,1000,rng,move),false);
 assert.equal(mob.patrolling,true);
 assert.equal(mob.moving,false);
 assert.equal(patrolMonster(mob,5000,rng,move),true);
 assert.equal(mob.moving,true);
 const before=[...mob.position];
 assert.equal(patrolMonster(mob,13000,rng,move),false);
 assert.equal(mob.moving,false);
 assert.notDeepEqual(mob.position,[70,0,0]);
 assert.deepEqual(mob.position,before);
 const rig=readFileSync(new URL('../src/reletter/island-actors.js',import.meta.url),'utf8');
 assert.match(rig,/const walking=!b\.leap&&!freezing/);
 assert.doesNotMatch(rig,/b\.patrolling\?'Walk':'Run'/);
 assert.match(rig,/setEffectiveTimeScale/);
});

test('heart pickups render once and never overlap, including older persisted duplicates',()=>{
 const now=500000;
 const world={nextHeartAt:0,groundDrops:[
  {id:'old-1',kind:'heart',position:[12,.2,0],expiresAt:now+30000},
  {id:'old-2',kind:'heart',position:[12.2,.2,0],expiresAt:now+30000},
  {id:'coin',kind:'coin',position:[-12,.2,0],expiresAt:now+30000}
 ]};
 assert.equal(dedupeHealingHearts(world),true);
 assert.equal(world.groundDrops.filter(d=>d.kind==='heart').length,1);
 replenishHearts(world,now);
 const hearts=world.groundDrops.filter(d=>d.kind==='heart');
 for(let i=0;i<hearts.length;i++)for(let j=i+1;j<hearts.length;j++)
  assert.ok(Math.hypot(hearts[i].position[0]-hearts[j].position[0],hearts[i].position[2]-hearts[j].position[2])>=4);
 assert.ok(!hearts.some(h=>Math.hypot(h.position[0]+12,h.position[2])<4));
 const adventure=readFileSync(new URL('../src/adventure-view.js',import.meta.url),'utf8');
 assert.match(adventure,/d\.kind!=='heart'/);
 assert.doesNotMatch(adventure,/d\.kind==='heart'\?createHeart/);
 const arena=readFileSync(new URL('../src/arena-view.js',import.meta.url),'utf8');
 assert.match(arena,/syncHearts\(\)/);
 const hud=readFileSync(new URL('../src/vital-models.js',import.meta.url),'utf8');
 assert.match(hud,/heart\.scale\.setScalar\(\.72\)/);
});

test('uploaded GGTEMPLE MP3 is selected only after a successful HEAD probe',()=>{
 const audio=readFileSync(new URL('../src/game-audio.js',import.meta.url),'utf8');
 assert.match(audio,/GGTEMPLE%E9%9F%B3%E6%A8%82\.mp3/);
 assert.match(audio,/method:'HEAD'/);
 assert.match(audio,/if\(!response\.ok\|\|this\.uploadedMusicUrl\)return false/);
 assert.match(audio,/backgroundmusic\.MP3/);
});
