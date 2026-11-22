const db=value=>10**(value/20);
// Combat identity is not just item.family: its elemental identity can differ
// (e.g. a dark melee weapon or a light-based sword). Keep the eight requested
// timbres independently addressable through the existing GM mixer.
export const ELEMENTAL_AUDIO_KEYS=Object.freeze(['fire','dark','light','water','wind','plant','ice','lightning']);
export function weaponSoundKey(item){
 if(!item)return 'shot';
 const id=String(item.id||''),family=String(item.family||'');
 const odd={'white-cat':'smg','black-cat':'sniper','calico-cat':'scatter',
   accordion:'accordion',giraffe:'giraffe',goldfish:'goldfish',clam:'clam',
   fan:'wind',telephone:'telephone',jellybrella:'water'};
 if(odd[id])return odd[id];
 if(family==='ice')return 'ice';
 if(family==='lightning')return 'lightning';
 if(['petal','planter','palm','whip'].includes(family))return 'plant';
 if(family==='beam'||family==='saber')return 'light';
 if(family==='wave')return 'wind';
 if(item.element==='dark')return 'dark';
 if(item.element==='light')return 'light';
 if(item.element==='earth')return 'plant';
 if(['fire','water','wind'].includes(family))return family;
 if(ELEMENTAL_AUDIO_KEYS.includes(item.element))return item.element;
 return family||'shot';
}
// Separate transient envelopes and timbres keep skills intelligible.
export const SOUND_PROFILES=Object.freeze({
 giraffe:{duration:.39,freq:278,end:148,shape:'triangle',noise:.39,gain:.95},
 goldfish:{duration:.62,freq:235,end:74,shape:'sine',noise:1,gain:1},
 clam:{duration:.39,freq:396,end:172,shape:'triangle',noise:.83,gain:.92},
 telephone:{duration:.45,freq:680,end:380,shape:'square',noise:.23,gain:.82},
 jellybrella:{duration:.65,freq:158,end:320,shape:'sine',noise:.91,gain:.9},
 fan:{duration:.61,freq:110,end:750,shape:'sawtooth',noise:.88,gain:.87},
 wind:{duration:.85,freq:170,end:690,shape:'triangle',noise:1,gain:1.12},
 dark:{duration:.68,freq:88,end:43,shape:'sawtooth',noise:.78,gain:1.15},
 light:{duration:.63,freq:740,end:1430,shape:'sine',noise:.40,gain:1.10},
 plant:{duration:.55,freq:330,end:116,shape:'triangle',noise:.85,gain:1.10},
 earth:{duration:.58,freq:198,end:65,shape:'triangle',noise:.73,gain:1.06},
 venom:{duration:.57,freq:115,end:65,shape:'triangle',noise:.77,gain:.85},
 stomp:{duration:.65,freq:80,end:38,shape:'sawtooth',noise:.94,gain:1.04},
  'ground-crack':{duration:.46,freq:450,end:40,shape:'sawtooth',noise:1,gain:1.2},
 smg:{duration:.13,freq:190,end:56,shape:'square',noise:.75,gain:.8},
 sniper:{duration:.65,freq:390,end:56,shape:'sawtooth',noise:.84,gain:1},
 jump:{duration:.34,freq:340,end:780,shape:'triangle',noise:.25,gain:1.0},
 land:{duration:.23,freq:125,end:49,shape:'sine',noise:.72,gain:.9},
 saber:{duration:.36,freq:510,end:150,shape:'sawtooth',noise:.72,gain:1.0},
 swatter:{duration:.24,freq:330,end:140,shape:'triangle',noise:.68,gain:.9},
 pan:{duration:.36,freq:230,end:82,shape:'triangle',noise:.8,gain:1.0},
 fire:{duration:.70,freq:155,end:48,shape:'sawtooth',noise:1,gain:1.18},
 ice:{duration:.65,freq:1420,end:420,shape:'sine',noise:.52,gain:1.10},
 water:{duration:.72,freq:245,end:100,shape:'sine',noise:1,gain:1.06},
 wave:{duration:.5,freq:240,end:80,shape:'sine',noise:.91,gain:1},
 lightning:{duration:.41,freq:1800,end:170,shape:'square',noise:1,gain:1.13},
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
 explosion:{duration:.92,freq:120,end:34,shape:'sawtooth',noise:1,gain:1.25},
 coin:{duration:.29,freq:970,end:1540,shape:'sine',noise:0,gain:.75},
 drink:{duration:.43,freq:430,end:160,shape:'sine',noise:.18,gain:.65},
 'fusion-success':{duration:.65,freq:520,end:1180,shape:'sine',noise:.23,gain:.85},
 'fusion-fail':{duration:.4,freq:380,end:105,shape:'triangle',noise:.45,gain:.82}
});
export class GameAudio{
 constructor(){
  this.voices=0;this.played={};this.volumes={};this.muted=false;this.trackSources=['./sound/backgroundmusic.MP3'];this.musicIndex=0; // Sound is ON by default.
  // A HEAD probe ensures an absent user MP3 never interrupts browser playback.
  // The file becomes the primary soundtrack automatically once present on Pages.
  const preferred='./sound/GGTEMPLEMUSIC.mp3';
  this.musicProbe=fetch(preferred,{method:'HEAD',cache:'no-store'})
   .then(response=>{
    if(!response.ok||this.uploadedMusicUrl)return false;
    this.trackSources=[preferred,'./sound/backgroundmusic.MP3'];this.musicIndex=0;
    if(this.music&&this.music.src!==new URL(preferred,location.href).href){
     this.music.pause();this.music.src=preferred;this.music.load();
     this.music.volume=this.musicVolume();this.music.play().catch(()=>{});
    }
    return true;
   }).catch(()=>false);
  // The effects graph must be primed before jump/attack handlers run.
  // Music is HTMLAudioElement; all transient SFX use the Web Audio graph.
  const activate=()=>{this.unlock(true);if(this.music?.paused)this.startMusic();};
  for(const type of ['touchstart','pointerdown','keydown','click'])
   addEventListener(type,activate,{capture:true,passive:true});
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{
   if(document.visibilityState==='hidden')this.primed=false;
   else if(this.context?.state==='running')this.flushQueued();
  });
 }
 unlock(fromGesture=true){
  // Async world snapshots cannot authorize AudioContext.start/resume on iOS.
  // A pending unauthorized resume promise must not block a later real gesture.
  if(!this.context){
   if(!fromGesture)return false;
   const Audio=typeof window==='undefined'?null:(window.AudioContext||window.webkitAudioContext);
   if(!Audio)return false;
   try{
    this.context=new Audio();
    this.master=this.context.createGain();this.master.gain.value=db(-3)*(this.volumes.master??1);
    this.sfx=this.context.createGain();this.sfx.gain.value=db(0);this.sfx.connect(this.master);
    const limiter=this.context.createDynamicsCompressor();
    limiter.threshold.value=-9;limiter.knee.value=5;limiter.ratio.value=12;limiter.attack.value=.002;limiter.release.value=.16;
    this.master.connect(limiter);limiter.connect(this.context.destination);
    const n=Math.floor(this.context.sampleRate),buffer=this.context.createBuffer(1,n,this.context.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<n;i++)data[i]=Math.random()*2-1;
    this.noise=buffer;
    this.context.addEventListener?.('statechange',()=>{
     if(this.context.state==='running')this.flushQueued();
     else this.primed=false;
    });
   }catch(error){console.warn('Unable to initialize game sound effects',error);return false;}
  }
  const ctx=this.context;
  if(fromGesture&&!this.primed){
   // iOS WebKit requires a silent buffer source started synchronously on touch.
   try{
    const source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=ctx.createBuffer(1,1,ctx.sampleRate);
    gain.gain.value=0;source.connect(gain);gain.connect(ctx.destination);
    source.onended=()=>{source.disconnect();gain.disconnect();};
    source.start(0);this.primed=true;
   }catch(error){this.primed=false;}
  }
  if(ctx.state==='running'){this.flushQueued();return true;}
  if(!fromGesture)return false;
  const now=performance.now();
  // Deduplicate touch/pointer from one gesture; retry on subsequent gestures
  // even if WebKit never resolves a previous resume() promise.
  if(this.resumePending&&now-(this.lastResumeAttemptAt??-Infinity)<350)return false;
  this.lastResumeAttemptAt=now;
  try{
   const attempt=Promise.resolve(ctx.resume());
   const tracked=attempt.then(()=>{this.flushQueued();return ctx.state==='running';},()=>false)
    .finally(()=>{if(this.resumePending===tracked)this.resumePending=null;});
   this.resumePending=tracked;
  }catch(error){this.resumePending=null;}
  return false;
 }
 queueCue(kind,volume,pitch){
  if(this.muted)return;
  const now=performance.now(),queue=this.queuedCues??=([]);
  if(queue.some(cue=>cue.kind===kind&&now-cue.at<80))return;
  queue.push({kind,volume,pitch,at:now});
  if(queue.length>10)queue.splice(0,queue.length-10);
 }
 flushQueued(){
  if(this.context?.state!=='running'||!this.queuedCues?.length)return;
  const now=performance.now(),cues=this.queuedCues.splice(0);
  for(const cue of cues)if(now-cue.at<1000)this.play(cue.kind,cue.volume,cue.pitch);
 }
 setVolumes(settings={}){
  for(const [key,value] of Object.entries(settings||{}))if(/^[a-z][a-z0-9-]{0,60}$/.test(key)&&Number.isFinite(Number(value)))
   this.volumes[key]=Math.max(0,Math.min(2,Number(value)));
  if(this.master)this.master.gain.setTargetAtTime(db(-3)*(this.volumes.master??1),this.context.currentTime,.03);
  if(this.music)this.music.volume=this.musicVolume();
 }
 musicVolume(){return Math.max(0,Math.min(1,.35*(this.volumes.music??1)*(this.volumes.master??1)));}
 setUploadedMusic(backendUrl,version){
  // Do not restart the track on ordinary world snapshots.
  if(!backendUrl||!Number.isSafeInteger(Number(version))||Number(version)<=0)return;
  const url=String(backendUrl).replace(/\/$/,'')+'/api/gm/music?v='+encodeURIComponent(version);
  if(url===this.uploadedMusicUrl)return;
  this.uploadedMusicUrl=url;
  this.trackSources=[url,'./sound/GGTEMPLEMUSIC.mp3','./sound/backgroundmusic.MP3'];
  this.musicIndex=0;
  if(this.music){
   this.music.pause();this.music.src=url;this.music.load();
   this.music.volume=this.musicVolume();
   this.music.play().catch(()=>{}); // Playback may await the next user gesture on iOS.
  }
 }
 startMusic(){
  this.unlock(false);if(!this.music){
   this.music=new Audio();this.music.loop=true;this.music.preload='auto';
   this.music.addEventListener('error',()=>{if(++this.musicIndex<this.trackSources.length){this.music.src=this.trackSources[this.musicIndex];this.music.play().catch(()=>{});}});
   this.music.src=this.trackSources[0];
  }
  this.music.volume=this.musicVolume();this.music.play().catch(()=>{});
 }
 playWeapon(item,volume=1,ultimate=false){
  if(!item)return this.play('shot',volume);
  const id=String(item.id||''),key=weaponSoundKey(item);
  const hash=[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
  const pitch=.89+(hash%23)/100; // Each weapon retains a unique note.
  const perWeapon=this.volumes['weapon-'+id]??1;
  const level=ultimate?1.12:1;
  this.play(key,volume*perWeapon*level,pitch);
 }

 play(kind,volume=1,pitch=1){
  if(!this.context)this.unlock(false);
  if(this.muted)return;
  if(!this.context||this.context.state!=='running'){
   this.queueCue(kind||'shot',volume,pitch);
   return;
  }
  if(this.voices>=34)return;
  const ctx=this.context,now=ctx.currentTime,key=kind||'shot';
  if(now-(this.last?.[key]??-10)<.04)return;
  (this.last??={})[key]=now;this.played[key]=(this.played[key]||0)+1;
  const p=SOUND_PROFILES[key]||SOUND_PROFILES.shot,amp=Math.max(0,Math.min(1.6,volume))*(this.volumes[key]??1)*p.gain;
  if(amp<=0)return; // An exact zero slider setting must be truly silent.
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
  if(['jump','land','saber','scatter','fire','ice','ultimate','explosion','stomp','ground-crack','sniper','smg','wind','water','wave','lightning','dark','light','plant','earth'].includes(key)){
   const sub=ctx.createOscillator();
   sub.type=key==='lightning'?'square':'sine';
   const harmonic=key==='light'?2.03:key==='ice'?2.41:key==='lightning'?3.2:
    key==='dark'?.47:key==='plant'?.73:key==='water'?.61:key==='wind'?1.45:.52;
   sub.frequency.setValueAtTime(Math.max(30,p.freq*harmonic*pitch),now);
   sub.frequency.exponentialRampToValueAtTime(Math.max(30,p.end*harmonic*pitch),now+p.duration*.9);
   createVoice(sub,null,(key==='lightning'?.09:key==='light'?.19:.21)*amp);
  }
  if(p.noise>0){
   const source=ctx.createBufferSource();source.buffer=this.noise;
   source.playbackRate.value=key==='ice'||key==='light'?1.6:key==='fire'?.60:key==='dark'?.45:key==='plant'?.84:1;
   const filter=ctx.createBiquadFilter();
   filter.type=['wind','water','wave','plant'].includes(key)?'bandpass':['ice','light','lightning'].includes(key)?'highpass':'lowpass';
   filter.frequency.value=key==='wind'?1100:key==='water'||key==='wave'?350:key==='plant'?920:
    key==='ice'?2300:key==='light'?3400:key==='dark'?230:key==='fire'?480:
    key==='lightning'?4200:key==='explosion'?370:key==='jump'?2500:3500;
   if(['wind','water','wave','fire','venom','dark','light','plant','ice','explosion'].includes(key)){
    filter.Q.value=key==='wind'?.8:.55;
    filter.frequency.setValueAtTime(filter.frequency.value,now);
    filter.frequency.exponentialRampToValueAtTime(key==='wind'?2000:key==='fire'||key==='dark'||key==='explosion'?140:
     key==='light'||key==='ice'?5500:key==='plant'?480:980,now+p.duration*.8);
   }
   createVoice(source,filter,(key==='fire'||key==='wind'||key==='explosion'?.55:.41)*p.noise*amp);
  }
  if(['lightning','smg','sniper','ice','light','plant','explosion','ground-crack'].includes(key)){
   // A separate short transient produces electrical crackle or ballistic snap.
   const snap=ctx.createOscillator();snap.type='square';
   snap.frequency.setValueAtTime(key==='lightning'?3500:key==='ice'?2800:key==='light'?2200:key==='plant'?610:key==='explosion'?145:key==='sniper'?310:900,now);
   snap.frequency.exponentialRampToValueAtTime(key==='light'||key==='ice'?660:70,now+.055);
   const gain=ctx.createGain();gain.gain.setValueAtTime(.001,now);
   gain.gain.exponentialRampToValueAtTime(.20*amp,now+.006);
   gain.gain.exponentialRampToValueAtTime(.001,now+.075);
   snap.connect(gain);gain.connect(this.sfx);this.voices++;
   snap.onended=()=>{snap.disconnect();gain.disconnect();this.voices=Math.max(0,this.voices-1);};
   snap.start(now);snap.stop(now+.08);
  }
 }
}
