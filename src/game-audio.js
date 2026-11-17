const db=value=>10**(value/20);
// Separate transient envelopes and timbres keep skills intelligible.
export const SOUND_PROFILES=Object.freeze({
 giraffe:{duration:.39,freq:278,end:148,shape:'triangle',noise:.39,gain:.95},
 goldfish:{duration:.62,freq:235,end:74,shape:'sine',noise:1,gain:1},
 clam:{duration:.39,freq:396,end:172,shape:'triangle',noise:.83,gain:.92},
 telephone:{duration:.45,freq:680,end:380,shape:'square',noise:.23,gain:.82},
 jellybrella:{duration:.65,freq:158,end:320,shape:'sine',noise:.91,gain:.9},
 fan:{duration:.61,freq:110,end:750,shape:'sawtooth',noise:.88,gain:.87},
 wind:{duration:.65,freq:160,end:620,shape:'sine',noise:1,gain:.94},
 venom:{duration:.57,freq:115,end:65,shape:'triangle',noise:.77,gain:.85},
 stomp:{duration:.65,freq:80,end:38,shape:'sawtooth',noise:.94,gain:1.04},
 smg:{duration:.13,freq:190,end:56,shape:'square',noise:.75,gain:.8},
 sniper:{duration:.65,freq:390,end:56,shape:'sawtooth',noise:.84,gain:1},
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
  this.voices=0;this.played={};this.volumes={};this.muted=false;this.trackSources=['./sound/GGTEMPLE%E9%9F%B3%E6%A8%82.mp3','./sound/backgroundmusic.MP3'];this.musicIndex=0; // Sound is ON by default; WebAudio starts at first user gesture.
  for(const type of ['pointerdown','keydown'])addEventListener(type,()=>this.unlock(),{passive:true});
 }
 unlock(){
  if(!this.context){
   const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
   this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=db(-8)*(this.volumes.master??1);
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
 setVolumes(settings={}){
  for(const [key,value] of Object.entries(settings||{}))if(/^[a-z][a-z0-9-]{0,60}$/.test(key)&&Number.isFinite(Number(value)))
   this.volumes[key]=Math.max(0,Math.min(2,Number(value)));
  if(this.master)this.master.gain.setTargetAtTime(db(-8)*(this.volumes.master??1),this.context.currentTime,.03);
  if(this.music)this.music.volume=this.musicVolume();
 }
 musicVolume(){return Math.max(0,Math.min(1,.35*(this.volumes.music??1)*(this.volumes.master??1)));}
 startMusic(){
  this.unlock();if(!this.music){
   this.music=new Audio();this.music.loop=true;this.music.preload='auto';
   this.music.addEventListener('error',()=>{if(++this.musicIndex<this.trackSources.length){this.music.src=this.trackSources[this.musicIndex];this.music.play().catch(()=>{});}});
   this.music.src=this.trackSources[0];
  }
  this.music.volume=this.musicVolume();this.music.play().catch(()=>{});
 }
 playWeapon(item,volume=1){
  if(!item)return this.play('shot',volume);
  const id=String(item.id||''),family=String(item.family||'shot');
  const odd={'white-cat':'smg','black-cat':'sniper','calico-cat':'scatter',accordion:'accordion',giraffe:'giraffe',goldfish:'goldfish',clam:'clam',fan:'fan',telephone:'telephone',jellybrella:'jellybrella'};
  const key=odd[id]||family;
  const hash=[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
  const pitch=.86+(hash%29)/100; // unique weapon intonation within its element
  return this.play(key,volume*(this.volumes['weapon-'+id]??1),pitch);
 }
 play(kind,volume=1,pitch=1){
  if(!this.context)this.unlock();
  if(!this.context||this.context.state!=='running'||this.muted||this.voices>=34)return;
  const ctx=this.context,now=ctx.currentTime,key=kind||'shot';
  if(now-(this.last?.[key]??-10)<.04)return;
  (this.last??={})[key]=now;this.played[key]=(this.played[key]||0)+1;
  const p=SOUND_PROFILES[key]||SOUND_PROFILES.shot,amp=Math.max(0,Math.min(1.6,volume))*(this.volumes[key]??1)*p.gain;
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
  tone.type=p.shape;tone.frequency.setValueAtTime(Math.max(35,p.freq*pitch),now);
  tone.frequency.exponentialRampToValueAtTime(Math.max(35,p.end*pitch),now+p.duration*.86);
  createVoice(tone,null,.34*amp);
  // Rich, pitched lower partial gives jumping and attacks physical weight.
  if(['jump','land','saber','scatter','fire','ice','ultimate','explosion','stomp','sniper','smg','wind','water','wave','lightning'].includes(key)){
   const sub=ctx.createOscillator();sub.type='sine';
   sub.frequency.setValueAtTime(Math.max(30,p.freq*.52*pitch),now);
   sub.frequency.exponentialRampToValueAtTime(Math.max(30,p.end*.6*pitch),now+p.duration*.9);
   createVoice(sub,null,.17*amp);
  }
  if(p.noise>0){
   const source=ctx.createBufferSource();source.buffer=this.noise;
   source.playbackRate.value=key==='ice'?1.6:key==='fire'?.7:1;
   const filter=ctx.createBiquadFilter();
   filter.type=['wind','water','wave'].includes(key)?'bandpass':key==='ice'?'highpass':'lowpass';
   filter.frequency.value=key==='wind'?710:key==='water'||key==='wave'?390:key==='ice'?1300:key==='fire'?500:key==='lightning'?4200:key==='jump'?2500:3500;
   if(['wind','water','wave','fire','venom'].includes(key)){
    filter.Q.value=key==='wind'?.8:.55;
    filter.frequency.setValueAtTime(filter.frequency.value,now);
    filter.frequency.exponentialRampToValueAtTime(key==='wind'?1700:key==='fire'?180:950,now+p.duration*.8);
   }
   createVoice(source,filter,.35*p.noise*amp);
  }
  if(['lightning','smg','sniper'].includes(key)){
   // A separate short transient produces electrical crackle or ballistic snap.
   const snap=ctx.createOscillator();snap.type='square';
   snap.frequency.setValueAtTime(key==='lightning'?2200:key==='sniper'?310:900,now);
   snap.frequency.exponentialRampToValueAtTime(70,now+.055);
   const gain=ctx.createGain();gain.gain.setValueAtTime(.001,now);
   gain.gain.exponentialRampToValueAtTime(.20*amp,now+.006);
   gain.gain.exponentialRampToValueAtTime(.001,now+.075);
   snap.connect(gain);gain.connect(this.sfx);this.voices++;
   snap.onended=()=>{snap.disconnect();gain.disconnect();this.voices=Math.max(0,this.voices-1);};
   snap.start(now);snap.stop(now+.08);
  }
 }
}
