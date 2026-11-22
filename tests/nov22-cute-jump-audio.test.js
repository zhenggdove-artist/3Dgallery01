import test from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio,SOUND_PROFILES} from '../src/game-audio.js';

const createParam=()=>({
 points:[],
 setValueAtTime(value,time){this.points.push(['set',value,time]);},
 exponentialRampToValueAtTime(value,time){this.points.push(['ramp',value,time]);}
});
function harness(volumes={}){
 const oscillators=[];
 const audio=Object.create(GameAudio.prototype);
 audio.context={
  state:'running',currentTime:30,
  createOscillator(){
   const osc={
    type:'sine',frequency:createParam(),started:null,stopped:null,
    connect(){},disconnect(){},start(time){this.started=time;},
    stop(time){this.stopped=time;}
   };
   oscillators.push(osc);
   return osc;
  },
  createGain(){return {gain:createParam(),connect(){},disconnect(){}};}
 };
 audio.sfx={};
 audio.played={};audio.volumes=volumes;audio.voices=0;audio.muted=false;
 return {audio,oscillators};
}
test('jump has a playful, clean three-voice rising chirp, not the original noisy impact',()=>{
 const {audio,oscillators}=harness();
 assert.equal(SOUND_PROFILES.jump.noise,0);
 assert.equal(SOUND_PROFILES.jump.shape,'sine');
 audio.play('jump',1.2);
 assert.equal(audio.played.jump,1);
 assert.equal(oscillators.length,3);
 assert.deepEqual(oscillators.map(o=>o.type),['sine','triangle','sine']);
 for(const osc of oscillators){
  assert.ok(osc.started>=30&&osc.stopped<30.35);
  assert.ok(osc.frequency.points.some(([kind,hz],i)=>kind==='ramp'&&hz>osc.frequency.points[0][1]));
 }
 assert.ok(oscillators[2].started>oscillators[0].started,'the second note follows the takeoff');
 assert.equal(audio.voices,3);
 oscillators.forEach(o=>o.onended());
 assert.equal(audio.voices,0);
});
test('the GM jump volume slider can completely silence the new sound',()=>{
 const {audio,oscillators}=harness({jump:0});
 audio.play('jump');
 assert.equal(oscillators.length,0);
 assert.equal(audio.voices,0);
});
test('jump sound remains independent of landing and weapon sound profiles',()=>{
 assert.ok(SOUND_PROFILES.jump.duration>=.3);
 assert.equal(SOUND_PROFILES.land.noise,0);
 assert.ok(SOUND_PROFILES.saber.noise>0);
});
