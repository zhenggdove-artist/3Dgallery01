const db=value=>10**(value/20);
// Separate transient envelopes and timbres keep skills intelligible.
export const SOUND_PROFILES=Object.freeze({
 jump:{duration:.34,freq:340,end:780,shape:'triangle',noise:.25,gain:1.0},
 land:{duration:.23,freq:125,end:49,shape:'sine',noise:.72,gain:.9},
 saber:{duration:.36,freq:510,end:150,shape:'sawtooth',noise:.72,gain:1.0},
 swatter:{duration:.24,freq:330,end:140,shape:'triangle',noise:.68,gain:.9},
 pan:{duration:.36,freq:230,end:82,shape:'triangle',noise:.8,gain:1.0},
 fire:{duration:.52,freq:190,end:95,shape:'sawtooth',noise:.95,gain:1.0},
 ice:{duration:.55,freq:920,end:240,shape:'sine',noise:.52,gain:.95},
 water:{duration:.52,freq:340,end:130,shape:'sine',noise:.82,gain:.92},
 wave:{duration:.5,freq:240,end:80,shape:'sine',noise:.91,gain:1},
 lightning:{duration:.33,freq:760,end:280,shape:'square',noise:.95,gain:.9},
 beam:{duration:.4,freq:460,end:1100,shape:'sawtooth',noise:.3,gain:.9},
 petal:{duration:.36,freq:700,end:430,shape:'sine',noise:.28,gain:.72},
 planter:{duration:.37,freq:310,end:92,shape:'triangle',noise:.65,gain:.9},
 palm:{duration:.43,freq:245,end:66,shape:'sawtooth',noise:.67,gain:.92},
 whip:{duration:.23,freq:560,end:200,shape:'triangle',noise:.84,gain:.9},
 scatter:{duration:.52,freq:460,end:85,shape:'sawtooth',noise:.92,gain:1.1},
 accordion:{duration:.55,freq:500,end:290,shape:'triangle',noise:.35,gain:1},
 charge:{duration:.30,freq:250,end:490,shape:'triangle',noise:.12,gain:.52},
 ultimate:{duration:.72,freq:125,end:48,shape:'sawtooth',noise:.88,gain:1.0},
 shot:{duration:.21,freq:480,end:135,shape:'sawtooth',noise:.7,gain:.85},
 hit:{duration:.25,freq:210,end:65,shape:'triangle',noise:.9,gain:1},
 explosion:{duration:.75,freq:118,end:35,shape:'sawtooth',noise:1,gain:1},
 coin:{duration:.29,freq:970,end:1540,shape:'sine',noise:0,gain:.75},
 drink:{duration:.43,freq:430,end:160,shape:'sine',noise:.18,gain:.65},
 'fusion-success':{duration:.65,freq:520,end:1180,shape:'sine',noise:.23,gain:.85},
 'fusion-fail':{duration:.4,freq:380,end:105,shape:'triangle',noise:.45,gain:.82}
});
export class GameAudio{
 constructor(){
  this.voices=0;this.played={};this.muted=false; // Sound is ON by default; WebAudio starts at first user gesture.
  for(const type of ['pointerdown','keydown'])addEventListener(type,()=>this.unlock(),{passive:true});
 }
 unlock(){
  if(!this.context){
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
   this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=db(-8);
   this.sfx=this.context.createGain();this.sfx.gain.value=db(-1);this.sfx.connect(this.master);
   const limiter=this.context.createDynamicsCompressor();
   limiter.threshold.value=-9;limiter.knee.value=5;limiter.ratio.value=12;limiter.attack.value=.002;limiter.release.value=.16;
   this.master.connect(limiter);limiter.connect(this.context.destination);
   const n=Math.floor(this.context.sampleRate),buffer=this.context.createBuffer(1,n,this.context.sampleRate);
   const data=buffer.getChannelData(0);
   for(let i=0;i<n;i++)data[i]=Math.random()*2-1;
   this.noise=buffer;
  }
  if(this.context.state==='suspended')this.context.resume().catch(()=>{});
 }
 play(kind,volume=1){
  if(!this.context)this.unlock();
  if(!this.context||this.context.state!=='running'||this.muted||this.voices>=22)return;
  const ctx=this.context,now=ctx.currentTime,key=kind||'shot';
  if(now-(this.last?.[key]??-10)<.04)return;
  (this.last??={})[key]=now;this.played[key]=(this.played[key]||0)+1;
  const p=SOUND_PROFILES[key]||SOUND_PROFILES.shot,amp=Math.max(0,Math.min(1.6,volume))*p.gain;
  const createVoice=(source,filter,amount)=>{
   const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,now);
   gain.gain.exponentialRampToValueAtTime(Math.max(.002,amount),now+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,now+p.duration);
   if(filter){source.connect(filter);filter.connect(gain);}else source.connect(gain);
   gain.connect(this.sfx);this.voices++;
   source.onended=()=>{source.disconnect();filter?.disconnect();gain.disconnect();this.voices=Math.max(0,this.voices-1);};
   source.start(now);source.stop(now+p.duration+.015);
  };
  const tone=ctx.createOscillator();
  tone.type=p.shape;tone.frequency.setValueAtTime(Math.max(35,p.freq),now);
  tone.frequency.exponentialRampToValueAtTime(Math.max(35,p.end),now+p.duration*.86);
  createVoice(tone,null,.34*amp);
  // Rich, pitched lower partial gives jumping and attacks physical weight.
  if(['jump','land','saber','scatter','fire','ice','ultimate','explosion'].includes(key)){
   const sub=ctx.createOscillator();sub.type='sine';
   sub.frequency.setValueAtTime(Math.max(30,p.freq*.52),now);
   sub.frequency.exponentialRampToValueAtTime(Math.max(30,p.end*.6),now+p.duration*.9);
   createVoice(sub,null,.17*amp);
  }
  if(p.noise>0){
   const source=ctx.createBufferSource();source.buffer=this.noise;
   source.playbackRate.value=key==='ice'?1.6:key==='fire'?.7:1;
   const filter=ctx.createBiquadFilter();
   filter.type=key==='ice'?'highpass':'lowpass';
   filter.frequency.value=key==='ice'?1300:key==='fire'?1450:key==='jump'?2500:3500;
   createVoice(source,filter,.35*p.noise*amp);
  }
 }
}
