import * as THREE from 'three';
import {WriteCinematic} from './write-cinematic.js';
import {ChargeTargetPreview} from './charge-target-preview.js';
import {bindPlantHover} from './plant-hover.js';
import {ENEMY_HEIGHT} from './shared/island-combat.js';
import {GoldenBursts} from './golden-burst.js';
import {GameAudio} from './game-audio.js';
import {ArtworkThrow} from './artwork-throw.js';
import {EquipmentPortraitViewport} from './equipment-portrait-view.js';
import {ElementalStatusVisuals} from './elemental-status-visuals.js';
import {setHealthBar,faceHealthBar} from './health-bars.js';
import {attackDirection} from './aiming.js';
import {isChannelStaff,isStaffTap,channelInterval,chargeProgress,STAFF_TAP_MAX_MS,CAST_MOVE_FACTOR} from './shared/weapon-abilities.js';
import {uploadArtwork} from './artwork-upload.js';
import {VitalModels} from './vital-models.js';
import {createVHS} from './reletter-vhs.js';
import {TempleArena} from './arena-view.js';
import {TempleNetwork} from './network.js';
import {PlayerController} from './player-controller.js';
import {TempleUI} from './ui.js';
import {PLAYER_SPAWNS} from './shared/arena.js';
import {canBuildAt,canPlaceArtworkAt} from './shared/temple-rules.js';
import {itemById,ITEMS,EQUIPPABLE_SLOTS} from './shared/catalog.js';
import {ArtworkEditor} from './artwork-editor.js';
import {PlatformDeleteEditor} from './platform-delete-editor.js';
import {uploadMedia} from './media-ui.js';

import {GunController} from './gun-controller.js';
import {Minimap} from './minimap.js';
import {createDamageNumbers} from './reletter/damage-numbers.js';

const canvas=document.getElementById('game'),coarse=matchMedia('(pointer:coarse)').matches,settings=loadEditorSettings();
// Prevent iOS Safari gesture zoom, long-press selection, and browser callouts
// on game controls. Editable chat and form fields retain native text entry.
if(coarse){
  const editable=target=>!!target?.closest?.('input,textarea,select,[contenteditable="true"]');
  for(const type of ['gesturestart','gesturechange','gestureend'])
    document.addEventListener(type,event=>event.preventDefault(),{passive:false});
  document.addEventListener('touchmove',event=>{if(event.touches.length>1&&!editable(event.target))event.preventDefault();},{passive:false});
  for(const type of ['selectstart','contextmenu','dblclick'])
    document.addEventListener(type,event=>{if(!editable(event.target))event.preventDefault();},{passive:false});
}
const renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,settings.pixelRatio|| (coarse?1:1.35)));renderer.setSize(innerWidth,innerHeight,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,1000),arena=new TempleArena(scene,renderer),ui=new TempleUI(),network=new TempleNetwork();
const vhs=createVHS(renderer),audio=new GameAudio(),bursts=new GoldenBursts(scene),chargePreview=new ChargeTargetPreview(scene);
const artworkThrow=new ArtworkThrow({scene,arena,controller:()=>controller,holderKey:()=>self?.key,send:sendAction,bursts,audio});
arena.artFloat=settings.artFloat??.17;

let vitalModels=null;
let artBombUploading=false;let assetsReady=false,joined=false,self=null,world=null,players=[],controller=null,localRoot=null,wasDead=false,last=performance.now(),externalUntil=0,toastErrorAt=0,lastAutoCoinAt=0,frameSamples=[],fps=0,fpsFrames=0,fpsAt=performance.now(),buildPlacement=null,spectatorFollowIndex=-1;
const roots=new Map(),remoteTargets=new Map(),effects=[];
const speechLayer=document.getElementById('chat-speech-layer'),speechBubbles=new Map(),speechPoint=new THREE.Vector3();
function showPlayerSpeech(message){
 const key=String(message?.profileKey||''),root=roots.get(key);if(!key||!root||!message?.text)return;
 let entry=speechBubbles.get(key);
 if(!entry){const element=document.createElement('div');element.className='player-chat-bubble';speechLayer.append(element);entry={element,expires:0};speechBubbles.set(key,entry);}
 entry.element.textContent=String(message.text);entry.expires=performance.now()+3000;
}
function updatePlayerSpeech(now=performance.now()){
 for(const [key,entry] of speechBubbles){
  const root=roots.get(key);if(now>=entry.expires||!root){entry.element.remove();speechBubbles.delete(key);continue;}
  if(!root.visible){entry.element.hidden=true;continue;}
  speechPoint.set(root.position.x,root.position.y+(root.userData.chatHeadY||2.8),root.position.z).project(camera);
  const visible=speechPoint.z>=-1&&speechPoint.z<=1&&Math.abs(speechPoint.x)<=1.25&&Math.abs(speechPoint.y)<=1.25;
  entry.element.hidden=!visible;
  if(visible){entry.element.style.left=((speechPoint.x+1)*innerWidth/2)+'px';entry.element.style.top=((1-speechPoint.y)*innerHeight/2-8)+'px';}
 }
}
const minimap=new Minimap();
const damageNumbers=createDamageNumbers(THREE),statusVisuals=new ElementalStatusVisuals();
const performanceSamples={logic:[],submit:[],frame:[]};
let chargeStarted=null,attackHoldStarted=null,chargeRequest=null,autoChargeBusy=false,attackHeld=false;
let staffChannel=null,staffChannelPromise=null,staffChannelBusy=false,staffChannelShotAt=0,staffChannelSerial=0;
const writer=new WriteCinematic({scene,controller:()=>controller,arena,ui,send:sendAction,audio,bursts,upload:file=>uploadMedia(network,file)});
const plantHover=bindPlantHover({canvas,camera,arena,controller:()=>controller,ui});
ui.addEventListener('write-start',()=>writer.begin());
const gun=new GunController({canvas,camera,controller:()=>controller,weapon:()=>itemById(world?.profile?.equipment?.weapon),ui,attack:performAttack});
const artEditor=new ArtworkEditor({scene,camera,canvas,arena,player:()=>localRoot,isGM:()=>!!self?.profile?.admin,send:sendAction,control:enabled=>{if(controller){controller.setEnabled(enabled&&!ui.panelName&&!wasDead);controller.cameraLocked=!!artEditor.mode&&artEditor.mode!=='follow';}},toast:text=>ui.toast(text)});
const platformDelete=new PlatformDeleteEditor({canvas,camera,arena,ui,editor:artEditor,isGM:()=>!!self?.profile?.admin,send:sendAction,controller:()=>controller,cancelBuild:cancelBuildPlacement});

const portraitViewport=new EquipmentPortraitViewport();
function refreshEquipmentPortrait(){
 const canvas=document.getElementById('bag-portrait');
 if(ui.panelName!=='bag'||ui.bagCategory!=='equipment'||!canvas?.isConnected){
  if(portraitViewport.canvas)portraitViewport.close();
  return;
 }
 if(!assetsReady||!localRoot?.userData?.model)return;
 const signature=JSON.stringify([self?.key,self?.color,world?.profile?.equipment,
  localRoot?.userData?.equipmentSignature]);
 try{
  portraitViewport.sync(canvas,localRoot,signature);
  canvas.removeAttribute('data-render-error');
 }catch(error){
  console.warn('EQUIP paper doll retry',error);
  canvas.setAttribute('data-render-error',error.message);
  // No cached failed <img>: retry on the next frame, including after DOM replacement.
 }
}
ui.addEventListener('equipment-portrait',()=>requestAnimationFrame(refreshEquipmentPortrait));
boot();

async function boot(){
  const started=performance.now(),timings=window.templeLoadTimings={};
  try{const [published,layout]=await Promise.all([fetch('./temple-layout.json').then(r=>r.ok?r.json():{}),fetch('./temple-artwork-layout.json').then(r=>r.json())]);Object.assign(settings,published.settings||{},loadEditorSettings());arena.defaultLayout=layout.artworkLayout||{};timings.configMs=performance.now()-started;const assetStart=performance.now(),warmStart=performance.now(),warmTask=arena.presentation.vfx.warm(renderer,camera).then(result=>{timings.effects=result;timings.effectsMs=performance.now()-warmStart;});await Promise.all([arena.load((value,label)=>ui.setLoading(value,label)),document.fonts.load('bold 48px GoldenGirdle')]);vitalModels=new VitalModels(arena.coinMesh.geometry,arena.coinMesh.material);timings.assetsMs=performance.now()-assetStart;ui.setLoading(.9,'Preparing 00GameDevs weapon effects');await warmTask;ui.setLoading(.95,'Prewarming monster attack shaders');try{await arena.islandEnemies.attackEffects.warm(renderer,camera);}catch(error){console.warn('Monster VFX shader prewarm incomplete',error);}applyEditorSettings({pixelRatio:settings.pixelRatio||(coarse?1:1.35),fog:settings.fog??.0008,artFloat:settings.artFloat??.17});camera.position.set(0,13,30);camera.lookAt(0,2,0);ui.setLoading(.99,'Preparing scene shaders');const compileStart=performance.now();await renderer.compileAsync(scene,camera);timings.sceneCompileMs=performance.now()-compileStart;timings.totalMs=performance.now()-started;ui.setLoading(1,'100% · Ready');assetsReady=true;ui.ready();}
  catch(error){console.error(error);ui.setLoading(0,'Loading failed · reload to retry: '+error.message);ui.joinError(error.message);}
}

ui.addEventListener('join',async event=>{
  if(!assetsReady)return ui.joinError('Temple assets are still loading');audio.startMusic();ui.joinBusy(true);try{network.setBackend(event.detail.backendUrl);const data=await network.join(event.detail);arena.world=data.world;await arena.loadCustomArtworks(data.world.customArtworks,network.base);self=data.self;world=data.world;players=data.players||[];joined=true;ui.enter(data);createLocalPlayer(data);syncPlayers();syncWorld();network.chatHistory().then(history=>history.forEach(message=>ui.addChat(message))).catch(()=>{});}
  catch(error){ui.joinError(error.message);}
});

network.addEventListener('welcome',event=>{const data=event.detail;self={...self,...data.self};world=data.world;players=data.players;syncPlayers();syncWorld();});
network.addEventListener('world',event=>{world=event.detail;ui.setWorld(world);syncWorld();});
network.addEventListener('players',event=>{players=event.detail;ui.setPlayers(players);syncPlayers();});
network.addEventListener('state',event=>{const data=event.detail;if(data.key===self?.key)return;let target=remoteTargets.get(data.key);if(!target){syncPlayers();target=remoteTargets.get(data.key);}if(target){target.position.fromArray(data.state.position);target.rotation=data.state.rotation;target.animation=data.state.animation;}});
network.addEventListener('chat',event=>{ui.addChat(event.detail);showPlayerSpeech(event.detail);});
network.addEventListener('artwork-throw',event=>showThrowPulse(event.detail));
network.addEventListener('attack',event=>showAttack(event.detail));
network.addEventListener('channel-stop',event=>{const root=roots.get(event.detail.owner);if(root)arena.presentation.vfx.stopChannel(root);});
network.addEventListener('structure-destroyed',event=>arena.showStructureBreak(event.detail));
network.addEventListener('structure-hit',event=>arena.showStructureHit(event.detail));
network.addEventListener('state-rejected',event=>{
  const rejection=event.detail||{};
  if(rejection.state?.position&&controller){
    const accepted=rejection.state.position,delta=controller.root.position.distanceTo(new THREE.Vector3(...accepted));
    if(delta>.6){controller.teleport(accepted);controller.grounded=Math.abs(accepted[1]-arena.groundHeight(accepted[0],accepted[2],accepted[1]))<.5;}
    // Server is the source of truth. Rebase subsequent predictions instead
    // of repeatedly sending the same impossible displacement.
    network.lastStateAt=0;
  }
  if(rejection.error!=='Movement rejected'&&performance.now()-toastErrorAt>1200){toastErrorAt=performance.now();ui.toast(rejection.error||'STATE REJECTED');}
});
network.addEventListener('connection',event=>{if(joined)ui.toast(event.detail.connected?'REALTIME CONNECTED':'RECONNECTING…');});

ui.addEventListener('attack',()=>performAttack());
ui.addEventListener('gun-fire',()=>{if(gun.mode)void performAttack(0);});
ui.addEventListener('create-platform',event=>sendAction('create-platform',event.detail));
ui.addEventListener('art-bomb-resize',event=>sendAction('resize-art-bomb',event.detail));
ui.addEventListener('art-bomb-appearance',event=>sendAction('update-art-bomb-appearance',event.detail));
ui.addEventListener('art-bomb-upload',async event=>{
 if(self?.role!=='fighter')return ui.toast('JOIN AS A FIGHTER TO PLACE ARTWORK');
 if(artBombUploading)return;
 const {files,size,title}=event.detail;
 if(!title?.trim())return ui.toast('請輸入作品名稱');
 if(!Number.isFinite(size)||size<1||size>3)return ui.toast('藝術品尺寸只能設定 1–3 倍');
 artBombUploading=true;
 const button=ui.content.querySelector('[data-form="art-bomb-upload"] button[type="submit"]');
 if(button)button.disabled=true;
 try{
  ui.toast('上傳中：驗證檔案並確認 Cloudflare 已儲存…');
  const upload={...await uploadArtwork(network,files,{maxBytes:8*1024*1024}),title:title.trim().slice(0,100)};
  ui.closePanel();
  startBuildPlacement('art-bomb',null,{...upload,size,previewFile:files.find(f=>f.type.startsWith('image/'))||null});
  arena.setBuildPreview('art-bomb',controller.buildPosition(3.2),controller.root.rotation.y,true,size,files.find(f=>f.type.startsWith('image/'))||null);
  arena.previewUploadedArtwork({...upload,size},network.base).catch(error=>ui.toast('預覽讀取失敗：'+error.message));
  ui.toast('Cloudflare 已儲存 · 移動角色攜帶作品，再按 PLACE');
 }catch(error){ui.toast(error.message);}
 finally{artBombUploading=false;if(button)button.disabled=false;}
});
ui.addEventListener('upload-artwork',async event=>{if(!self?.profile?.admin)return;const button=ui.content.querySelector('[data-upload-submit]');if(button)button.disabled=true;try{ui.toast('正在驗證藝術品…');const upload={...await uploadArtwork(network,event.detail.files,{maxBytes:32*1024*1024}),title:event.detail.title.trim().slice(0,100)},position=controller.buildPosition(4);position[1]+=2;const result=await sendAction('add-artwork',{artwork:{...upload,position,appearance:{}}});if(!result)throw Error('Artwork was not published. Retry after checking the connection.');await arena.loadCustomArtworks(world.customArtworks,network.base);ui.closePanel();artEditor.select(arena.artworks.get(result.artwork.id));ui.toast('藝術品已發布 · 可調整位置及表面');}catch(error){ui.toast(error.message);const status=ui.content.querySelector('[data-upload-status]');if(status)status.textContent=error.message;}finally{if(button)button.disabled=false;}});
ui.addEventListener('use-item',event=>{const item=itemById(event.detail);if(item&&controller)ui.toast('Use this material in BAG → FUSION');});
ui.addEventListener('original-action',event=>sendAction(event.detail.action,event.detail));
ui.addEventListener('jump',()=>controller?.jump());
// On-screen A/Q is the sole interaction/throw control on desktop and mobile.
// For firearms A ONLY switches
// camera: standard > shoulder > sniper scope > standard; canvas tap fires.
ui.addEventListener('attack-start',()=>{
 if(!controller?.enabled||self?.role!=='fighter')return;
 if(coarse&&buildPlacement){confirmBuildPlacement();return;}
 if(controller.holdingArt){artworkThrow.begin();return;}
 // Artwork pickup always wins over weapon camera cycling, including rifles.
 const nearbyArt=arena.nearest(controller.root.position.toArray());
 if(nearbyArt?.type==='artwork'){performInteract();return;}
 const weapon=itemById(world?.profile?.equipment?.weapon);
 if(weapon?.firstPerson){gun.cycle();return;}
 if(!artworkThrow.started){
  const near=arena.nearest(controller.root.position.toArray());
  const canUse=near&&['artwork','coin','drop','plant'].includes(near.type);
  const byPlant=!near&&Math.hypot(controller.root.position.x,controller.root.position.z)<7;
  if(canUse||byPlant){performInteract();return;}
 }
 if(chargeStarted!==null||staffChannel)return;
 attackHeld=true;
 attackHoldStarted=performance.now();
 chargeStarted=null;
 chargeRequest=null;
});
ui.addEventListener('attack-release',async()=>{
 if(itemById(world?.profile?.equipment?.weapon)?.firstPerson){gun.held=false;return;}
 attackHeld=false;
 if(artworkThrow.started!==null)return artworkThrow.release();
 if(staffChannel){
  const pending=staffChannelPromise;
  staffChannel=null;++staffChannelSerial;
  arena.presentation.vfx.stopChannel(localRoot);
  chargeStarted=null;attackHoldStarted=null;chargeRequest=null;
  // Local VFX stops on pointer-up, before any queued server response.
  void sendAction('attack',{phase:'channel-stop'});
  void Promise.resolve(pending).then(result=>{
   if(result?.channeling)return sendAction('attack',{phase:'channel-stop'});
  });
  return;
 }
 if(attackHoldStarted===null)return;
 const weapon=itemById(world?.profile?.equipment?.weapon)||itemById('clam');
 const heldMs=performance.now()-attackHoldStarted;
 const charge=chargeProgress(heldMs,weapon?.chargeMs||1500);
 attackHoldStarted=null;chargeStarted=null;
 const pending=chargeRequest;chargeRequest=null;
 if(heldMs>=STAFF_TAP_MAX_MS)await pending;
 // A short tap casts one projectile (or clam melee). Releasing a partly
 // charged LONG hold casts nothing; a fully charged hold stops the channel.
 if(isChannelStaff(weapon)){
  if(isStaffTap(weapon,heldMs))performAttack(0);
 }else{
  performAttack(heldMs<STAFF_TAP_MAX_MS?0:charge);
 }
});
ui.addEventListener('attack-cancel',()=>{
 gun.held=false;
 attackHeld=false;chargeStarted=null;attackHoldStarted=null;chargeRequest=null;artworkThrow.cancel();
 if(staffChannel){
  const pending=staffChannelPromise;
  staffChannel=null;++staffChannelSerial;
  arena.presentation.vfx.stopChannel(localRoot);
  void sendAction('attack',{phase:'channel-stop'});void Promise.resolve(pending).then(result=>{if(result?.channeling)return sendAction('attack',{phase:'channel-stop'});});
 }
});
ui.addEventListener('server-action',event=>{const {action,...data}=event.detail;sendAction(action,data);});
ui.addEventListener('build-start',async event=>{try{const d=event.detail;const media=d.file?await uploadMedia(network,d.file):null;startBuildPlacement(d.kind,media?.id);}catch(error){ui.clearBuildMode();ui.toast(error.message);}});ui.addEventListener('build-rotate',()=>rotateBuildPlacement());ui.addEventListener('build-confirm',()=>confirmBuildPlacement());ui.addEventListener('build-cancel',()=>cancelBuildPlacement());
ui.addEventListener('destroy-near',()=>{if(!controller)return;const position=controller.root.position.toArray(),nearest=(world?.structures||[]).map(structure=>({structure,distance:distance2d3(position,structure.position)})).sort((a,b)=>a.distance-b.distance)[0];if(!nearest||nearest.distance>12)return ui.toast('NO STRUCTURE NEARBY');sendAction('destroy',{structureId:nearest.structure.id,direction:controller.aimDirection()});});
ui.addEventListener('chat',async event=>{const text=String(event.detail||'').trim();if(text==='/recovery'){await sendAction('recover-artworks');return;}if(/^\/reset$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('reset-player-artworks');return;}try{const result=await network.chat(text);if(result?.notice)ui.toast(result.notice);}catch(error){ui.toast(error.message);}});
ui.addEventListener('plant',event=>writer.submit(event.detail));
ui.addEventListener('save-code',async()=>{try{const data=await network.createSaveCode();self.saveCode=data.code;ui.self=self;ui.showSaveCode(data.code);ui.toast('存檔代碼已產生 · 請保存');}catch(error){ui.toast(error.message);}});
ui.addEventListener('gm-presence-request',async()=>{if(!self?.profile?.admin)return;try{ui.setGmPresence(await network.gmPresence());}catch(error){ui.setGmPresenceError(error.message);}});
ui.addEventListener('role-change',async event=>{try{const data=await network.changeRole(event.detail);cancelBuildPlacement();self={...self,...data.self,role:data.role,seat:data.seat};world=data.world;players=data.players;controller.seat=data.seat;controller.setFollowTarget(null);controller.setRole(data.role);controller.teleport(PLAYER_SPAWNS[data.seat]||PLAYER_SPAWNS[0]);ui.setSelf(self);syncPlayers();syncWorld();ui.toast(data.role==='fighter'?'FIGHTER SEAT READY':'SPECTATOR MODE · TAB TO FOLLOW');}catch(error){ui.toast(error.message);}});
ui.addEventListener('spectator-follow',event=>followSpectator(event.detail));ui.addEventListener('spectator-cycle',()=>cycleSpectator());
ui.addEventListener('panel',event=>{chargeStarted=null;attackHoldStarted=null;chargeRequest=null;if(event.detail.open){attackHeld=false;}if(event.detail.open&&staffChannel){arena.presentation.vfx.stopChannel(localRoot);const pending=staffChannelPromise;staffChannel=null;++staffChannelSerial;void sendAction('attack',{phase:'channel-stop'});void Promise.resolve(pending).then(result=>{if(result?.channeling)return sendAction('attack',{phase:'channel-stop'});});}if(event.detail.open)artworkThrow.cancel();controller?.setEnabled(!event.detail.open&&!artEditor.mode&&!writer.active&&!platformDelete.active);if(!event.detail.open&&(writer.phase==='write'||writer.legacy))writer.cancel();});
ui.addEventListener('editor-settings',event=>applyEditorSettings(event.detail));
ui.addEventListener('gm-audio-setting',event=>{if(!self?.profile?.admin)return;audio.setVolumes({[event.detail.key]:event.detail.value});void sendAction('gm-audio-setting',event.detail);});
 ui.addEventListener('gm-music-upload',async event=>{
  if(!self?.profile?.admin)return;
  const file=event.detail;
  if(!file||file.size<1024||file.size>7_500_000||!/\.mp3$/i.test(file.name)){
   ui.toast('請選擇 7.5 MB 以內的 MP3');return;
  }
  ui.toast('背景音樂上傳中');
  try{
   const response=await fetch(network.base+'/api/gm/music',{method:'POST',
    headers:{Authorization:'Bearer '+network.token,'Content-Type':'audio/mpeg'},body:file});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'MP3 upload failed');
   audio.setUploadedMusic(network.base,result.version);
   audio.startMusic();
   if(world){world.musicVersion=result.version;ui.world=world;if(ui.panelName==='gm')ui.renderGm();}
   ui.toast('背景音樂已更新 · 所有玩家同步');
  }catch(error){ui.toast('背景音樂上傳失敗：'+(error.message||'連線錯誤'));}
 });

function createLocalPlayer(data){
   audio.unlock();audio.startMusic();
  localRoot=arena.createPlayer(data.self.color,data.self.profile?.admin,data.self.name);scene.add(localRoot);roots.set(data.self.key,localRoot);controller=new PlayerController({camera,arena,canvas,root:localRoot,role:data.role,seat:data.seat,mobileStick:document.getElementById('mobile-stick')});controller.setRole(data.role);controller.setEnabled(true);controller.onJump=()=>audio.play('jump',1.2);
}

function syncPlayers(){
  if(!self)return;const live=new Set([self.key]);for(const player of players){if(player.role!=='fighter')continue;live.add(player.key);if(player.key===self.key)continue;let root=roots.get(player.key);if(!root){root=arena.createPlayer(player.color,false,player.name);root.name=`Player ${player.name}`;scene.add(root);roots.set(player.key,root);remoteTargets.set(player.key,{position:new THREE.Vector3(),rotation:0,animation:'idle'});}if(player.state){const target=remoteTargets.get(player.key);target.position.fromArray(player.state.position);target.rotation=player.state.rotation;target.animation=player.state.animation;root.visible=player.role==='fighter';}else root.visible=false;}
  for(const player of players){if(player.role!=='fighter')continue;const root=roots.get(player.key);if(root){arena.setPlayerEquipment(root,player.profile?.equipment);if(root!==localRoot)setHealthBar(root,player.profile?.hp,player.profile?.maxHp);root.userData.deadUntil=player.profile?.deadUntil||0;applyHitReaction(root,player.profile);statusVisuals.sync(root,player.profile?.effects);}}
  for(const [key,root] of roots)if(key!==self.key&&!live.has(key)){statusVisuals.clear(root);root.removeFromParent();roots.delete(key);remoteTargets.delete(key);}ui.setPlayers(players);
}
function applyHitReaction(root,profile){const hit=profile?.hitReaction;if(!root||!hit||root.userData.lastHitReaction===hit.id||Date.now()-hit.time>2500)return;root.userData.lastHitReaction=hit.id;audio.play('hit',root===localRoot?1:.35);root.userData.hitFlashUntil=performance.now()+250;
 if((hit.stunMs||0)>=900){const remaining=Math.max(0,hit.stunMs-(Date.now()-hit.time));root.userData.knockdown={start:performance.now(),duration:remaining};}if(root===localRoot){
  controller.stunUntil=hit.whipPull?0:performance.now()+100;
  if(hit.whipPull){
   controller.lastWhipPullId=hit.whipPull.id;
   controller.beginWhipPull(hit.whipPull);
  }else if(hit.panBlast&&Number(hit.knockbackDistance)>0){
   // Server-authored launch. The local physics controller takes over for
   // a complete parabola followed by three diminishing ground rebounds.
   controller.beginPanBlast(hit);
  }else if(Number(hit.knockbackDistance)>0){
   controller.knockback=new THREE.Vector3(...hit.vector).normalize();
   controller.knockbackRemaining=hit.knockbackDistance;
  }else{
   controller.knockbackRemaining=0;
   controller.knockback=new THREE.Vector3(...hit.vector).multiplyScalar(hit.knockback||4);
  }
 }}
function updateKnockdowns(){
 const now=performance.now();
 for(const root of roots.values()){
  const model=root.userData.model;if(!model)continue;
  const kd=root.userData.knockdown;
  if(!kd){if(model.userData.knockdownBase!==undefined)model.rotation.z=model.userData.knockdownBase;continue;}
  model.userData.knockdownBase??=model.rotation.z;
  const elapsed=now-kd.start,duration=kd.duration;
  if(elapsed>=duration||duration<=0){model.rotation.z=model.userData.knockdownBase;delete root.userData.knockdown;continue;}
  const falling=Math.min(1,elapsed/130),rising=Math.min(1,Math.max(0,(elapsed-(duration-170))/170));
  const collapsed=falling*(1-rising);
  model.rotation.z=model.userData.knockdownBase-Math.PI*.39*collapsed;
 }
}
function syncWorld(){if(!world)return;audio.setVolumes(world.audioSettings||{});if(world.musicVersion)audio.setUploadedMusic(network.base,world.musicVersion);arena.loadCustomArtworks(world.customArtworks,network.base).catch(error=>ui.toast(error.message));damageNumbers.receive(world.damageEvents);arena.sync(world,players);ui.setWorld(world);ui.showKillEvents(world.killEvents);
 for(const player of players){const root=roots.get(player.key);if(root)statusVisuals.sync(root,player.profile?.effects);}
 if(arena.monster)statusVisuals.sync(arena.monster,world.monster?.effects);
 for(const {root,state} of arena.islandEnemies.extraLive)statusVisuals.sync(root,state?.effects);const profile=world.profile,dead=profile?.deadUntil>Date.now();if(localRoot&&profile){arena.setPlayerEquipment(localRoot,profile.equipment);localRoot.userData.deadUntil=profile.deadUntil||0;applyHitReaction(localRoot,profile);
 if(profile.whipPull?.id&&profile.whipPull.id!==controller.lastWhipPullId&&
    Date.now()-(profile.whipPull.time||0)<profile.whipPull.durationMs+400){
  // A new poison/bleed hit can replace hitReaction; the pull has its OWN
  // server-authored ID and must still reach the local physics controller.
  controller.lastWhipPullId=profile.whipPull.id;
  controller.stunUntil=0;controller.beginWhipPull(profile.whipPull);
 }
 controller.stats=profile.stats||{speed:1,jump:1,gravity:1};statusVisuals.sync(localRoot,profile.effects);if(profile.impulse&&controller.lastImpulse!==profile.impulse.id){controller.lastImpulse=profile.impulse.id;controller.knockback=new THREE.Vector3(...profile.impulse.vector).multiplyScalar(5);}}if(dead){if(!wasDead&&localRoot){bursts.play(localRoot.position,'death-'+self.key+'-'+profile.deadUntil);audio.play('explosion');}wasDead=true;controller?.setEnabled(false);ui.death(profile.deadUntil,profile.lastKilledBy?.name||'');}else if(joined){if(wasDead&&controller){controller.teleport(PLAYER_SPAWNS[self.seat]||PLAYER_SPAWNS[0]);wasDead=false;ui.toast('RESPAWNED');}if(!ui.panelName&&!artEditor.mode&&!writer.active&&!platformDelete.active)controller?.setEnabled(true);ui.death(0);}if(profile&&self)self.profile=profile;}

async function sendAction(action,data={},options={}){if(!joined||!controller)return null;try{const result=await network.action(action,data);if(result.world){world=result.world;syncWorld();}if(result.notice)ui.toast(result.notice);if(action==='fuse'&&result.fusion){ui.fusionFeedback(!!result.fusion.success,result.notice);audio.play(result.fusion.success?'fusion-success':'fusion-fail',1);}if(result.attackEvent)showAttack(result.attackEvent);if(result.throwEvent)showThrowPulse(result.throwEvent);if(action==='pickup-coin'||action==='pickup-drop')audio.play('coin');for(const hit of result.structureHits||(result.structureHit?[result.structureHit]:[]))arena.showStructureHit(hit);for(const broken of result.structureDestroyedEvents||(result.structureDestroyed?[result.structureDestroyed]:[]))arena.showStructureBreak(broken);if(result.hit?.defeated)ui.toast(`DEFEATED · ${result.hit.lostCoins} COINS DROPPED`);return result;}catch(error){if(options.throwOnError)throw error;if(action==='fuse')ui.fusionFeedback(false,error.message);if(!/^Move closer to (?:the )?(?:artwork|coin|drop)/i.test(error.message||'')&&performance.now()-toastErrorAt>400){toastErrorAt=performance.now();ui.toast(error.message);}return null;}}

function startBuildPlacement(kind,surface=null,artwork=null){if(self?.role!=='fighter')return ui.toast('SPECTATORS CANNOT BUILD');buildPlacement={kind,surface,artwork,rotation:controller?.root.rotation.y||0,position:controller?.buildPosition(kind==='art-bomb'?3.2:5)||[0,0,0],valid:false};ui.buildKind=kind;document.getElementById('build-kind').textContent=kind==='art-bomb'?'YOUR ARTWORK':kind.toUpperCase();document.getElementById('build-mode').hidden=false;document.activeElement?.blur();if(!writer.active&&!artEditor.mode)controller?.setEnabled(true);ui.toast('MOVE WITH YOUR ARTWORK · R ROTATE · E / PLACE');}
function rotateBuildPlacement(){if(!buildPlacement)return;buildPlacement.rotation+=Math.PI/4;}
async function confirmBuildPlacement(){if(!buildPlacement||!controller)return;if(!buildPlacement.valid)return ui.toast('CANNOT BUILD HERE');const result=buildPlacement.kind==='art-bomb'
 ?await sendAction('publish-art-bomb',{artwork:{title:buildPlacement.artwork?.title,mediaId:buildPlacement.artwork?.mediaId,position:[buildPlacement.position[0],buildPlacement.position[1]+1.5*(buildPlacement.artwork?.size||1),buildPlacement.position[2]],appearance:{}},size:buildPlacement.artwork?.size})
 :await sendAction('build',{kind:buildPlacement.kind,surface:buildPlacement.surface,position:buildPlacement.position,rotation:buildPlacement.rotation});
 if(result)cancelBuildPlacement();}
function cancelBuildPlacement(){buildPlacement=null;arena.clearBuildPreview();ui.clearBuildMode();}
function followSpectator(key){if(self?.role!=='spectator')return;const target=key?roots.get(key):null;controller.setFollowTarget(target||null);spectatorFollowIndex=players.filter(player=>player.role==='fighter').findIndex(player=>player.key===key);ui.toast(target?`FOLLOWING ${players.find(player=>player.key===key)?.name||'FIGHTER'}`:'FREE SPECTATOR CAMERA');}
function cycleSpectator(){if(self?.role!=='spectator')return;const fighters=players.filter(player=>player.role==='fighter'&&roots.get(player.key));if(!fighters.length)return followSpectator('');spectatorFollowIndex=(spectatorFollowIndex+1)%fighters.length;followSpectator(fighters[spectatorFollowIndex].key);}

function performAttack(charge=0,phase=null){
 if(controller?.status?.freeze||world?.profile?.effects?.paralysis?.until>Date.now())return;
 if(!controller?.enabled||performance.now()<(controller.stunUntil||0)||self?.role!=='fighter'||ui.panelName)return;
 const item=itemById(world?.profile?.equipment?.weapon)||itemById('water');
 const shot=item.firstPerson?gun.shot():null;
 const direction=shot?.direction||attackDirection(controller,camera,arena,roots,item,charge);
 const muzzle=isChannelStaff(item)||item.family==='saber'?arena.presentation.vfx.channelMuzzle(localRoot,item):null;
 return sendAction('attack',{direction,charge,...(phase?{phase}:{}),
  ...(muzzle?{origin:muzzle.toArray()}:{}),...(shot||{})});
}
function performInteract(){if(!controller||self?.role!=='fighter')return;const held=Object.entries(world?.artworks||{}).find(([,art])=>art.holder===self.key);if(held){artworkThrow.begin();return;}const near=arena.nearest(controller.root.position.toArray());if(!near){if(Math.hypot(controller.root.position.x,controller.root.position.z)<7)return ui.showPlantList();return;}if(near.type==='plant'){const plant=(world?.plants||[]).find(p=>p.id===near.id);if(plant)ui.showPlant(plant);return;}if(near.type==='coin')sendAction('pickup-coin',{platformId:near.id});if(near.type==='drop')sendAction('pickup-drop',{dropId:near.id});if(near.type==='artwork')sendAction('pickup-artwork',{platformId:near.id});}

function update(dt,time){
  damageNumbers.update(camera,innerWidth,innerHeight);vitalModels?.update(time,world?.profile?.hp||0,world?.profile?.maxHp||100);
  if(joined)minimap.update(time,roots,self?.key,world?.monster,world?.monsters||[]);
  if(joined&&controller){
   const nowMs=Date.now(),debuffs=world?.profile?.effects||{};
   controller.status={freeze:(debuffs.freeze?.until||0)>nowMs||(debuffs.stun?.until||0)>nowMs,
      root:(debuffs.root?.until||0)>nowMs,
      confuse:(debuffs.confuse?.until||0)>nowMs,
      dazzle:(debuffs.dazzle?.until||0)>nowMs,
      paralysis:(debuffs.paralysis?.until||0)>nowMs};
   if(controller.status.paralysis&&(attackHeld||staffChannel))ui.emit('attack-cancel');
   writer.update();plantHover.update();controller.castMoveFactor=staffChannel?CAST_MOVE_FACTOR:1;const wasGrounded=controller.grounded;const state=controller.update(dt);if(!wasGrounded&&controller.grounded)audio.play('land',.95);arena.setPlayerAnimation(localRoot,state.animation);if(!(writer.active&&writer.legacy)&&self?.role==='fighter')network.sendState(state);for(const [key,target] of remoteTargets){const root=roots.get(key);if(!root)continue;root.position.lerp(target.position,1-Math.exp(-dt*11));root.rotation.y=lerpAngle(root.rotation.y,target.rotation,1-Math.exp(-dt*12));arena.setPlayerAnimation(root,target.animation);}const near=arena.nearest(localRoot.position.toArray()),holding=Object.values(world?.artworks||{}).some(art=>art.holder===self.key);controller.holdingArt=holding;ui.setNear(near,holding);if(buildPlacement){buildPlacement.position=controller.buildPosition(buildPlacement.kind==='art-bomb'?3.2:5);buildPlacement.valid=(buildPlacement.kind==='art-bomb'?canPlaceArtworkAt:canBuildAt)(world,controller.root.position.toArray(),buildPlacement.position);arena.setBuildPreview(buildPlacement.kind,buildPlacement.position,buildPlacement.rotation,buildPlacement.valid,buildPlacement.artwork?.size||1,buildPlacement.artwork?.previewFile||null);}if(self?.role==='fighter'&&performance.now()-lastAutoCoinAt>300){const p=localRoot.position;const coin=PLATFORMS.find(c=>world?.coins?.[c.id]?.available&&Math.hypot(p.x-c.coinPosition[0],p.z-c.coinPosition[2])<2.8&&Math.abs(p.y-c.coinPosition[1])<3.1),drop=world?.groundDrops?.find(d=>p.distanceTo(new THREE.Vector3(...d.position))<2.2&&(d.kind!=='heart'||world.profile.hp<world.profile.maxHp)&&!(d.owner===self.key&&Date.now()<d.ownerLockedUntil));if(coin||drop){lastAutoCoinAt=performance.now();if(coin)sendAction('pickup-coin',{platformId:coin.id});else sendAction('pickup-drop',{dropId:drop.id});}}const profile=world?.profile;if(profile?.deadUntil>Date.now())ui.death(profile.deadUntil,profile.lastKilledBy?.name||'');}
  statusVisuals.update(dt);arena.update(dt,time,camera,roots);updateKnockdowns();arena.remoteAimTargets=[...roots.values()].filter(r=>r!==localRoot);for(const [key,root] of roots){const dead=root.userData.deadUntil>Date.now();if(dead&&!root.userData.burstDead){bursts.play(root.position,'death-'+key+'-'+root.userData.deadUntil);if(root!==localRoot)audio.play('explosion',.35);}root.userData.burstDead=dead;root.visible=!dead&&performance.now()>=(root.userData.plantHiddenUntil||0)&&(key===self?.key?self.role==='fighter':root.visible||players.find(p=>p.key===key)?.role==='fighter');}updatePlayerSpeech();artworkThrow.update();bursts.update(dt,renderer.domElement.height);for(const root of roots.values())faceHealthBar(root,camera);if(arena.monster&&world?.monster){setHealthBar(arena.monster,world.monster.hp,world.monster.maxHp,ENEMY_HEIGHT+.65);faceHealthBar(arena.monster,camera);}gun.update();gun.pose(arena.presentation);
  const heldItem=itemById(world?.profile?.equipment?.weapon)||itemById('clam');
  if(heldItem.firstPerson){attackHeld=false;chargeStarted=null;attackHoldStarted=null;chargeRequest=null;}
  if(attackHeld&&attackHoldStarted!==null&&chargeStarted===null&&!chargeRequest&&performance.now()-attackHoldStarted>=STAFF_TAP_MAX_MS){
   chargeStarted=performance.now();
   chargeRequest=sendAction('attack',{phase:'charge'});
   audio.play('charge',.62);
  }
  const charge=chargeStarted===null?0:Math.min(1,(performance.now()-chargeStarted)/(heldItem?.chargeMs||1500));
  // First 500ms is a tap window, then progress becomes visible from 0%. No staff may continuously cast during
  // the charging window; the very first sustained pulse is the ultimate.
  if(attackHeld&&!(world?.profile?.effects?.paralysis?.until>Date.now())&&charge>=1&&isChannelStaff(heldItem)&&!staffChannel&&
     performance.now()-(window._templeLastChannelAttempt||0)>170){
   window._templeLastChannelAttempt=performance.now();
   const serial=++staffChannelSerial;
   staffChannel={weapon:heldItem.id,serial,ready:false};
   staffChannelShotAt=-Infinity;
   staffChannelPromise=Promise.resolve(chargeRequest).then(result=>{
    if(!result?.charging||!attackHeld||staffChannel?.serial!==serial)return null;
    return sendAction('attack',{phase:'channel-start'});
   }).then(result=>{
    if(result?.channeling&&staffChannel?.serial===serial&&attackHeld){
     staffChannel.ready=true;
    }else if(staffChannel?.serial===serial){
     staffChannel=null; // network latency may require retry after 100%
    }
    return result;
   });
  }
  if(staffChannel){
   if(!attackHeld||!isChannelStaff(heldItem)||heldItem.id!==staffChannel.weapon||!controller.enabled){
    const pending=staffChannelPromise;staffChannel=null;++staffChannelSerial;
    void sendAction('attack',{phase:'channel-stop'});void Promise.resolve(pending).then(result=>{if(result?.channeling)return sendAction('attack',{phase:'channel-stop'});});
   }else if(staffChannel.ready&&!staffChannelBusy&&performance.now()-staffChannelShotAt>=channelInterval(heldItem)+45){
    staffChannelShotAt=performance.now();staffChannelBusy=true;
    void Promise.resolve(performAttack(1,'channel')).finally(()=>{staffChannelBusy=false;});
   }
  }
  if(charge>=1&&!isChannelStaff(heldItem)&&heldItem?.autoCharge&&!autoChargeBusy){
   autoChargeBusy=true;const pending=chargeRequest;chargeStarted=null;
   Promise.resolve(pending).then(async()=>{await performAttack(1);if(attackHeld&&controller?.enabled&&!ui.panelName){chargeStarted=performance.now();chargeRequest=sendAction('attack',{phase:'charge'});}}).finally(()=>autoChargeBusy=false);
  }
  arena.presentation.charging(localRoot,charge);
  const chargedWeapon=itemById(world?.profile?.equipment?.weapon);
  if(charge>.08&&!staffChannel&&chargedWeapon&&controller){
   const direction=chargedWeapon.firstPerson?gun.shotDirection().toArray():attackDirection(controller,camera,arena,roots,chargedWeapon,1);
   const muzzle=isChannelStaff(chargedWeapon)||chargedWeapon.family==='saber'?arena.presentation.vfx.channelMuzzle(localRoot,chargedWeapon):null;
   chargePreview.update(localRoot,chargedWeapon,charge,direction,arena,world?.profile?.fusion?.[chargedWeapon.id]||null,muzzle?.toArray(),dt);
  }else chargePreview.hide();
  const attackButton=document.getElementById('attack-button');attackButton.classList.toggle('charging',charge>0||!!staffChannel||artworkThrow.started!==null);attackButton.style.setProperty('--charge',`${(artworkThrow.started!==null?artworkThrow.progress:charge)*100}%`);artEditor.update();for(let i=effects.length-1;i>=0;i--){const effect=effects[i];effect.age+=dt;effect.material.opacity=Math.max(0,1-effect.age/effect.duration);effect.scale.setScalar(1+effect.age*3);if(effect.age>=effect.duration){effect.removeFromParent();effect.geometry.dispose();effect.material.dispose();effects.splice(i,1);}}
}

function frame(now){requestAnimationFrame(frame);const elapsed=now-last,dt=Math.min(.05,elapsed/1000);last=now;if(!assetsReady)return;const started=performance.now();if(now>externalUntil)update(dt,now/1000);const updated=performance.now();refreshEquipmentPortrait();vhs.setDizzy(world?.profile?.effects?.dazzle?.until>Date.now()?1:0);vhs.render(scene,camera,performance.now()/1000,(gl,world,view)=>arena.presentation.vfx.numberedEffects.render(gl,world,view),arena.presentation.vfx.numberedEffects.hasFullScreenPostprocess());const ended=performance.now();for(const [key,value] of [['frame',elapsed],['logic',updated-started],['submit',ended-updated]]){performanceSamples[key].push(value);if(performanceSamples[key].length>240)performanceSamples[key].shift();}frameSamples.push(elapsed);if(frameSamples.length>180)frameSamples.shift();fpsFrames++;if(now-fpsAt>1000){fps=fpsFrames*1000/(now-fpsAt);fpsFrames=0;fpsAt=now;}}
requestAnimationFrame(frame);

const heardAttacks=new Set();function showAttack(event){if(!heardAttacks.has(event.id)){heardAttacks.add(event.id);if(heardAttacks.size>128)heardAttacks.delete(heardAttacks.values().next().value);const item=itemById(event.weapon),gain=event.owner===self?.key?1:.38;audio.playWeapon(item,gain);if(event.owner===self?.key&&item?.firstPerson)gun.kick(item);if(event.ultimate)audio.play('ultimate',gain*.85);}arena.presentation.play(event,roots.get(event.owner));}
function showThrowPulse(event){artworkThrow.queue(event);}
function applyEditorSettings(next){renderer.setPixelRatio(Math.min(devicePixelRatio,next.pixelRatio));renderer.setSize(innerWidth,innerHeight,false);scene.fog.density=next.fog;arena.artFloat=next.artFloat;}
function loadEditorSettings(){try{return JSON.parse(localStorage.getItem('temple-editor-settings')||'{}');}catch{return {};}}
function lerpAngle(a,b,t){let d=(b-a+Math.PI)%(Math.PI*2)-Math.PI;if(d<-Math.PI)d+=Math.PI*2;return a+d*t;}
function distance2d3(a,b){return Math.hypot(a[0]-b[0],a[2]-b[2]);}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);});
addEventListener('pagehide',()=>network.close());

window.render_game_to_text=()=>JSON.stringify({mode:joined?'play':'entry',name:self?.name||null,role:self?.role||null,connected:network.socket?.readyState===WebSocket.OPEN,position:controller?.root.position.toArray().map(n=>+n.toFixed(2))||null,players:players.map(p=>({name:p.name,role:p.role,seat:p.seat})),economy:{wallet:world?.profile?.wallet??null,inventory:world?.profile?.inventory?.length||0,groundDrops:world?.groundDrops?.length||0,platformCoins:Object.values(world?.coins||{}).filter(c=>c.available).length,platformCoinTotal:Object.keys(world?.coins||{}).length},artworks:{total:arena.artworks.size,available:Object.values(world?.artworks||{}).filter(a=>!a.holder&&Date.now()>=(a.availableAt||0)).length},monster:world?.monster?.active?{variant:world.monster.variant,hp:world.monster.hp}:null,render:{fps:+fps.toFixed(1),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),gunMode:gun.mode,frameMs:+(frameSamples.reduce((a,b)=>a+b,0)/Math.max(1,frameSamples.length)).toFixed(2)},editorShortcut:'Shift+Y'});
window.advanceTime=milliseconds=>{externalUntil=performance.now()+120;const steps=Math.ceil(milliseconds/16.6667);for(let i=0;i<steps;i++)update(Math.min(.05,milliseconds/steps/1000),(performance.now()+i*milliseconds/steps)/1000);vhs.render(scene,camera,performance.now()/1000);};
if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname))window.templeTest={writer,plantHover,audio,bursts,artworkThrow,arena,camera,renderer,ui,gun,editor:artEditor,platformDelete,portraitViewport,controller:()=>controller,network,roots,items:ITEMS,slots:EQUIPPABLE_SLOTS,performanceSamples,vitals:()=>vitalModels,hit:applyHitReaction};
import {PLATFORMS} from './shared/arena.js';
