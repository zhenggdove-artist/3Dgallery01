import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GameAudio,SOUND_PROFILES} from '../src/game-audio.js';

function parameter(){
 return {points:[],setValueAtTime(v,t){this.points.push(['set',v,t]);},
  exponentialRampToValueAtTime(v,t){this.points.push(['ramp',v,t]);}};
}
function harness(volumes={}){
 const oscillators=[];
 const audio=Object.create(GameAudio.prototype);
 audio.context={state:'running',currentTime:10,
  createOscillator(){
   const osc={frequency:parameter(),connect(){},disconnect(){},start(t){this.started=t;},stop(t){this.stopped=t;}};
   oscillators.push(osc);return osc;
  },
  createGain(){return {gain:parameter(),connect(){},disconnect(){}};}};
 audio.sfx={};audio.played={};audio.voices=0;audio.volumes=volumes;audio.muted=false;
 return {audio,oscillators};
}
test('landing makes a clean, cute descending bubble instead of a heavy crash',()=>{
 const {audio,oscillators}=harness();
 assert.equal(SOUND_PROFILES.land.noise,0);
 audio.play('land',.95);
 assert.equal(audio.played.land,1);
 assert.deepEqual(oscillators.map(o=>o.type),['sine','triangle','sine']);
 for(const o of oscillators){
  assert.ok(o.started>=10&&o.stopped<10.27);
  assert.ok(o.frequency.points.some(([kind,hz])=>kind==='ramp'&&hz<o.frequency.points[0][1]));
 }
 oscillators.forEach(o=>o.onended());
 assert.equal(audio.voices,0);
});
test('GM landing slider can mute the landing alone',()=>{
 const {audio,oscillators}=harness({land:0});
 audio.play('land');assert.equal(oscillators.length,0);
 assert.equal(audio.voices,0);
});
test('mobile controls prevent Safari selection and native loupe while preserving text editing',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(ui,/addEventListener\('selectstart'/);
 assert.match(ui,/addEventListener\('touchstart'/);
 assert.match(ui,/mobileControl\(event\.target\)\)event\.preventDefault\(\)/);
 assert.match(ui,/passive:false/);
 assert.match(css,/#dock button \*/);
 assert.match(css,/-webkit-touch-callout:none!important/);
 assert.match(css,/#chat-form input/);
});
