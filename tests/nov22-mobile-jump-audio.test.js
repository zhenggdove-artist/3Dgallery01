import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {PlayerController} from '../src/player-controller.js';
import {GameAudio} from '../src/game-audio.js';

function fakeController(impulse=0){
 const controller=Object.create(PlayerController.prototype);
 let cues=0;
 Object.assign(controller,{
  enabled:true,role:'fighter',status:{},grounded:true,
  stats:{jump:1,impulse,flapMs:300},
  root:{position:new THREE.Vector3(0,0,0)},
  direction:new THREE.Vector3(0,0,1),
  jumpVelocity:new THREE.Vector3(),speed:4,velocityY:0,
  onJump:()=>{cues++;}
 });
 return {controller,cues:()=>cues};
}

test('normal takeoff emits exactly one jump cue; rejected jumps remain silent',()=>{
 const {controller,cues}=fakeController();
 controller.jump();
 assert.equal(cues(),1);
 assert.equal(controller.grounded,false);
 assert.equal(controller.velocityY,10);
 controller.jump();
 assert.equal(cues(),1);
 controller.enabled=false;controller.grounded=true;controller.jump();
 assert.equal(cues(),1);
});

test('wing-assisted takeoff and accepted flap sound; cooldown and ceiling prevent duplicates',()=>{
 const {controller,cues}=fakeController(10.15);
 controller.jump();
 assert.equal(cues(),1,'wing takeoff must sound');
 assert.equal(controller.velocityY,10.15);
 controller.jump();
 assert.equal(cues(),1,'cooldown-rejected flap must remain silent');
 controller.lastFlap=performance.now()-400;
 controller.jump();
 assert.equal(cues(),2,'accepted midair flap must sound exactly once');
 controller.root.position.y=64;controller.lastFlap=performance.now()-400;
 controller.jump();
 assert.equal(cues(),2,'ceiling-rejected flap must remain silent');
});

test('iOS interrupted AudioContext resumes only once for duplicated touch/pointer events',async()=>{
 const audio=Object.create(GameAudio.prototype);
 let resolveResume,attempts=0;
 const pending=new Promise(resolve=>{resolveResume=resolve;});
 audio.context={state:'interrupted',resume(){
  attempts++;
  return pending.then(()=>{audio.context.state='running';});
 }};
 audio.unlock();audio.unlock();
 assert.equal(attempts,1);
 resolveResume();
 await audio.resumePending;
 assert.equal(audio.context.state,'running');
 assert.equal(audio.resumePending,null);
});

test('touch activation precedes mobile jump and jump callback reaches audio',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const audio=readFileSync(new URL('../src/game-audio.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.ok(main.includes("ui.addEventListener('jump',()=>{audio.unlock();controller?.jump();});"));
 assert.ok(main.includes("controller.onJump=()=>audio.play('jump',1.2)"));
 assert.ok(audio.includes("['touchstart','pointerdown','keydown','click']"));
 assert.ok(audio.includes("{capture:true,passive:true}"));
 assert.ok(ui.includes("jump.onpointerdown="));
});

test('a later gesture retries an interrupted context despite a stalled Safari resume',async()=>{
 const audio=Object.create(GameAudio.prototype);
 let calls=0,finish;
 const stalled=new Promise(resolve=>{finish=resolve;});
 audio.context={state:'interrupted',resume(){
  calls++;
  if(calls===1)return stalled;
  audio.context.state='running';
  return Promise.resolve();
 }};
 audio.unlock(true);audio.unlock(true);
 assert.equal(calls,1);
 audio.lastResumeAttemptAt=performance.now()-400;
 audio.unlock(true);
 assert.equal(calls,2);
 await audio.resumePending;
 assert.equal(audio.context.state,'running');
 assert.equal(audio.resumePending,null);
 finish();await Promise.resolve();
});

test('a jump triggered during Web Audio resumption plays once after unlock',async()=>{
 const audio=Object.create(GameAudio.prototype);
 let finish;
 const pending=new Promise(resolve=>{finish=resolve;});
 audio.context={state:'suspended',resume:()=>pending};
 audio.played={};audio.volumes={};audio.voices=0;
 audio.unlock(true);
 audio.play('jump',1.2);audio.play('jump',1.2);
 assert.equal(audio.queuedCues.length,1);
 const heard=[];audio.play=(kind,volume)=>heard.push([kind,volume]);
 audio.context.state='running';finish();
 await audio.resumePending;
 assert.deepEqual(heard,[['jump',1.2]]);
 assert.equal(audio.queuedCues.length,0);
});

test('pre-entry gesture primes a silent buffer without creating audio from network callbacks',()=>{
 const sound=readFileSync(new URL('../src/game-audio.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(sound,/source\.buffer=ctx\.createBuffer\(1,1,ctx\.sampleRate\)/);
 assert.match(sound,/gain\.gain\.value=0;source\.connect\(gain\)/);
 assert.match(sound,/this\.unlock\(false\);if\(!this\.music\)/);
 assert.match(main,/audio\.unlock\(false\);audio\.startMusic\(\)/);
});
