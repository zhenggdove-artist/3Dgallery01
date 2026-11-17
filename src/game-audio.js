import {WEAPONS} from './shared/catalog.js';

// All generators are native WebAudio: no downloads, samples, or startup decode.
// The id seed gives every individual weapon a stable pitch/formant signature.
const db=value=>10**(value/20);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
const hash=str=>{let n=2166136261;for(const c of String(str)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
export const MUSIC_PATH='./sound/GGTEMPLE音樂.mp3';
export const SOUND_PROFILES=Object.freeze({
 jump:{duration:.34,freq:340,end:780,shape:'triangle',noise:.25,gain:1},
 land:{duration:.23,freq:125,end:49,shape:'sine',noise:.72,gain:.9},
 saber:{duration:.36,freq:510,end:150,shape:'sawtooth',noise:.72,gain:1},
 swatter:{duration:.24,freq:330,end:140,shape:'triangle',noise:.68,gain:.9},
 pan:{duration:.36,freq:230,end:82,shape:'triangle',noise:.8,gain:1},
 fire:{duration:.58,freq:125,end:45,shape:'sawtooth',noise:1,gain:1.03},
 ice:{duration:.61,freq:1380,end:280,shape:'sine',noise:.25,gain:.94},
 water:{duration:.7,freq:210,end:78,shape:'sine',noise:.95,gain:.9},
 wave:{duration:.76,freq:160,end:55,shape:'sine',noise:.96,gain:.9},
 wind:{duration:.68,freq:470,end:750,shape:'triangle',noise:1,gain:.92},
 lightning:{duration:.36,freq:960,end:180,shape:'square',noise:1,gain:.95},
 beam:{duration:.55,freq:340,end:1450,shape:'sawtooth',noise:.33,gain:.88},
 petal:{duration:.48,freq:740,end:410,shape:'sine',noise:.28,gain:.75},
 planter:{duration:.4,freq:260,end:75,shape:'triangle',noise:.74,gain:.95},
 palm:{duration:.49,freq:190,end:53,shape:'sawtooth',noise:.84,gain:.92},
 whip:{duration:.24,freq:650,end:150,shape:'triangle',noise:.87,gain:.95},
 scatter:{duration:.55,freq:420,end:75,shape:'sawtooth',noise:1,gain:1.02},
 accordion:{duration:.56,freq:495,end:310,shape:'triangle',noise:.3,gain:.86},
 phone:{duration:.45,freq:830,end:280,shape:'square',noise:.3,gain:.85},
 jelly:{duration:.65,freq:410,end:110,shape:'sine',noise:.55,gain:.88},
 goldfish:{duration:.58,freq:270,end:90,shape:'sine',noise:.82,gain:.88},
 clam:{duration:.4,freq:210,end:95,shape:'triangle',noise:.85,gain:.85},
 charge:{duration:.3,freq:250,end:490,shape:'triangle',noise:.12,gain:.5},
 ultimate:{duration:.78,freq:125,end:48,shape:'sawtooth',noise:.88,gain:1},
 shot:{duration:.21,freq:480,end:135,shape:'sawtooth',noise:.7,gain:.85},
 hit:{duration:.25,freq:210,end:65,shape:'triangle',noise:.9,gain:1},
 explosion:{duration:.75,freq:118,end:35,shape:'sawtooth',noise:1,gain:1},
 coin:{duration:.29,freq:970,end:1540,shape:'sine',noise:0,gain:.75},
 drink:{duration:.43,freq:430,end:160,shape:'sine',noise:.18,gain:.65},
 'fusion-success':{duration:.65,freq:520,end:1180,shape:'sine',noise:.23,gain:.85},
 'fusion-fail':{duration:.4,freq:380,end:105,shape:'triangle',noise:.45,gain:.82},
 'monster-dash':{duration:.56,freq:160,end:64,shape:'sawtooth',noise:.65,gain:1},
 'monster-beam':{duration:.72,freq:460,end:1140,shape:'sawtooth',noise:.55,gain:1},
 'monster-slam':{duration:.62,freq:110,end:36,shape:'triangle',noise:1,gain:1},
 'monster-venom':{duration:.78,freq:180,end:74,shape:'sine',noise:1,gain:.9}
});
export const AUDIO_KEYS=Object.freeze([
 ...Object.keys(SOUND_PROFILES),...WEAPONS.map(w=>w.id)
].filter((key,i,list)=>list.indexOf(key)===i));
export const DEFAULT_AUDIO_MIX=Object.freeze({master:75,music:45,sfx:100,levels:{}});
export function normaliseAudioMix(value){
 const source=value&&typeof value==='object'?value:{},levels={};
 for(const key of AUDIO_KEYS)if(Object.prototype.hasOwnProperty.call(source.levels||{},key)){
  levels[key]=Math.round(clamp(source.levels[key],0,200));
 }
 return {master:Math.round(clamp(source.master??75,0,200)),
  music:Math.round(clamp(source.music??45,0,200)),
  sfx:Math.round(clamp(source.sfx??100,0,200)),musicVersion:Number(source.musicVersion)||0,levels};
}
const familyFor=item=>{
 if(item.id==='calico-cat')return 'scatter';
 if(item.id==='accordion')return 'accordion';
 if(item.id==='goldfish')return 'goldfish';
 if(item.id==='clam')return 'clam';
 if(item.id==='telephone')return 'phone';
 if(item.id==='jellybrella')return 'jelly';
 if(item.id==='fan')return 'wind';
 if(item.id==='black-cat')return 'beam';
 if(item.id==='white-cat')return 'shot';
 return item.family||'shot';
};
export class GameAudio{
 constructor(){
  this.musicUrl=MUSIC_PATH;this.voices=0;this.played={};this.muted=false;this.mix=normaliseAudioMix(DEFAULT_AUDIO_MIX);
  this.music=null;this.musicFailed=false;
  if(typeof addEventListener==='function')
   for(const type of ['pointerdown','keydown','touchend'])
    addEventListener(type,()=>this.unlock(),{passive:true});
 }
 setMusicUrl(url){
  if(!url||url===this.musicUrl)return;
  this.musicUrl=url;
  if(this.music){this.music.pause();this.music.src=url;this.music.load();this.music.play().catch(()=>{});}
 }
 applyMix(value){
  this.mix=normaliseAudioMix(value);
  if(this.master)this.master.gain.setTargetAtTime(.85*this.mix.master/100,this.context.currentTime,.03);
  if(this.sfx)this.sfx.gain.setTargetAtTime(.9*this.mix.sfx/100,this.context.currentTime,.03);
  if(this.music)this.music.volume=clamp(this.mix.music*this.mix.master/10000,0,1);
 }
 unlock(){
  if(!this.context){
   const AudioContextImpl=window.AudioContext||window.webkitAudioContext;if(!AudioContextImpl)return;
   this.context=new AudioContextImpl();this.master=this.context.createGain();
   this.sfx=this.context.createGain();this.sfx.connect(this.master);
   const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-9;
   limiter.knee.value=5;limiter.ratio.value=12;limiter.attack.value=.002;limiter.release.value=.16;
   this.master.connect(limiter);limiter.connect(this.context.destination);
   const n=this.context.sampleRate*2,buffer=this.context.createBuffer(1,n,this.context.sampleRate);
   const data=buffer.getChannelData(0);
   for(let i=0;i<n;i++)data[i]=Math.random()*2-1;
   this.noise=buffer;this.applyMix(this.mix);
   // Browsers prohibit autoplay. Both audio paths start only after a gesture.
   this.music=new Audio(this.musicUrl);this.music.loop=true;this.music.preload='none';
   this.music.addEventListener('error',()=>{this.musicFailed=true;},{once:true});
   this.applyMix(this.mix);
  }
  if(this.context.state==='suspended')this.context.resume().catch(()=>{});
  if(this.music?.paused&&!this.musicFailed&&this.mix.music>0)
   this.music.play().catch(()=>{});
 }
 playWeapon(item,volume=1,ultimate=false){
  if(!item)return this.play('shot',volume);
  const category=familyFor(item);
  // Each rarity/individual weapon has a distinct stable spectral signature.
  const seed=hash(item.id),pitch=.88+(seed%25)/100;
  return this.play(item.id,volume,category,pitch,ultimate);
 }
 play(kind,volume=1,category=kind,pitch=1,ultimate=false){
  if(!this.context)this.unlock();
  if(!this.context||this.context.state!=='running'||this.muted||this.voices>=32)return;
  const ctx=this.context,now=ctx.currentTime,key=String(kind||'shot');
  if(now-(this.last?.[key]??-10)<.045)return;
  const p=SOUND_PROFILES[key]||SOUND_PROFILES[category]||SOUND_PROFILES.shot;
  const level=(this.mix.levels[key]??this.mix.levels[category]??100)/100;
  if(!level)return;
  (this.last??={})[key]=now;this.played[key]=(this.played[key]||0)+1;
  const amp=clamp(volume,0,1.6)*p.gain*level;
  const duration=p.duration*(ultimate?1.18:1);
  const noiseType=category==='water'||category==='wave'||category==='goldfish'||category==='clam'?'water':
   category==='fire'?'fire':category==='lightning'?'lightning':category==='wind'?'wind':
   category==='ice'?'ice':'generic';
  const createVoice=(source,filter,amount,attack=.012)=>{
   const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,now);
   gain.gain.exponentialRampToValueAtTime(Math.max(.002,amount),now+attack);
   gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
   if(filter){source.connect(filter);filter.connect(gain);}else source.connect(gain);
   gain.connect(this.sfx);this.voices++;
   source.onended=()=>{source.disconnect();filter?.disconnect();gain.disconnect();this.voices=Math.max(0,this.voices-1);};
   source.start(now);source.stop(now+duration+.015);
  };
  const tone=ctx.createOscillator();tone.type=p.shape;
  tone.frequency.setValueAtTime(Math.max(35,p.freq*pitch),now);
  tone.frequency.exponentialRampToValueAtTime(Math.max(35,p.end*pitch),now+duration*.87);
  createVoice(tone,null,.29*amp,noiseType==='wind'?.12:.012);
  // Low oscillation creates the rolling pressure of flame/water, while
  // dissonant upper partials make electrical cracks and crystalline ice.
  if(['fire','water','wave','goldfish','clam','ice','lightning','beam','wind','jelly','scatter','saber','pan','ultimate','explosion'].includes(category)||ultimate){
   const partial=ctx.createOscillator();
   partial.type=noiseType==='lightning'?'square':'sine';
   const factor=noiseType==='ice'?2.39:noiseType==='lightning'?3.4:noiseType==='water'?.59:noiseType==='wind'?1.53:.46;
   partial.frequency.setValueAtTime(Math.max(40,p.freq*pitch*factor),now);
   partial.frequency.exponentialRampToValueAtTime(Math.max(40,p.end*pitch*factor),now+duration*.9);
   createVoice(partial,null,(noiseType==='lightning'?.075:.16)*amp,.025);
  }
  if(p.noise>0&&this.voices<32){
   const source=ctx.createBufferSource();source.buffer=this.noise;
   source.playbackRate.value=noiseType==='ice'?1.6:noiseType==='fire'?.7:noiseType==='wind'?.84:1;
   const filter=ctx.createBiquadFilter();
   filter.type=noiseType==='ice'||noiseType==='lightning'?'highpass':
    noiseType==='water'||noiseType==='wind'?'bandpass':'lowpass';
   const hz=noiseType==='fire'?680:noiseType==='water'?420:noiseType==='wind'?1200:
    noiseType==='lightning'?2150:noiseType==='ice'?1800:2400;
   filter.frequency.setValueAtTime(hz,now);
   filter.frequency.exponentialRampToValueAtTime(
    noiseType==='water'?1100:noiseType==='wind'?580:noiseType==='lightning'?4300:hz,now+duration*.8);
   filter.Q.value=noiseType==='water'?1.5:noiseType==='wind'?.8:.5;
   createVoice(source,filter,(noiseType==='fire'?.4:.31)*p.noise*amp,noiseType==='wind'?.13:.014);
  }
 }
}
