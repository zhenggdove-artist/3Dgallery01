import {registerCustomWings} from './shared/catalog.js';
import {beginWingCheckout,resumeWingCheckout} from './wing-payment-client.js';
import {prepareFirebase,signInWithGoogle} from './firebase-login.js';
import * as THREE from 'three';
import {WriteCinematic} from './write-cinematic.js';
import {ChargeTargetPreview} from './charge-target-preview.js';
import {bindPlantHover} from './plant-hover.js';
import {ENEMY_HEIGHT} from './shared/island-combat.js';
import {GoldenBursts} from './golden-burst.js';
import {GameAudio} from './game-audio.js';
import {ArtworkThrow} from './artwork-throw.js';
import {EquipmentPortraitViewport} from './equipment-portrait-view.js';
import {CollectorView} from './collector-view.js';
import {ElementalStatusVisuals} from './elemental-status-visuals.js';
import {setHealthBar,faceHealthBar} from './health-bars.js';
import {attackDirection,cameraAimDirection} from './aiming.js';
import {lateralBeamInput,targetOnBeam} from './native-beam-curve.js';
import {isChannelStaff,isStaffTap,channelInterval,chargeProgress,STAFF_TAP_MAX_MS,CAST_MOVE_FACTOR} from './shared/weapon-abilities.js';
import {uploadArtwork} from './artwork-upload.js';
import {VitalModels} from './vital-models.js';
import {createVHS} from './reletter-vhs.js';
import {TempleArena} from './arena-view.js';
import {TempleNetwork} from './network.js';
import {PlayerController} from './player-controller.js';
import {STAFF_RAISE_SECONDS} from './staff-raise-pose.js';
import {TempleUI} from './ui.js';
import {PLAYER_SPAWNS} from './shared/arena.js';
import {canBuildAt,canPlaceArtworkAt} from './shared/temple-rules.js';
import {itemById,ITEMS,EQUIPPABLE_SLOTS} from './shared/catalog.js';
import {warmItemPreviews,setOutfitPreviewCharacter} from './item-preview.js';
import {ArtworkEditor} from './artwork-editor.js';
import {PlatformDeleteEditor} from './platform-delete-editor.js';
import {uploadMedia} from './media-ui.js';

import {GunController} from './gun-controller.js';
import {Minimap} from './minimap.js';
import {CityWallPainter} from './city-wall-painter.js';
import {rebaseRejectedPose,shouldIgnoreRejection,keepPredictedMoveOnLatencyReject} from './shared/state-reconciliation.js';
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
// GPU warmup must see the scene from a real camera, not the default origin.
// Set it BEFORE the asynchronous VFX warm tasks are kicked off.
camera.position.set(0,13,30);camera.lookAt(0,2,0);camera.updateMatrixWorld(true);
const vhs=createVHS(renderer),audio=new GameAudio(),bursts=new GoldenBursts(scene),chargePreview=new ChargeTargetPreview(scene);
const artworkThrow=new ArtworkThrow({scene,arena,controller:()=>controller,holderKey:()=>self?.key,send:sendAction,bursts,audio});
const collectorView=new CollectorView(scene,arena,()=>audio.play('shot',.9));
arena.artFloat=settings.artFloat??.17;

let lastAppliedRespawnAt=0;
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
 // SUPPORT is a fully opaque Win98 window. Keep socket/inputs responsive
 // without rendering the hidden 3D scene beneath it.
 if(ui.panelName==='wing-shop')return;
}
const minimap=new Minimap();
const damageNumbers=createDamageNumbers(THREE),statusVisuals=new ElementalStatusVisuals();
let healVisualSeq=0,lastHealVisualAt=0;
const performanceSamples={logic:[],submit:[],frame:[]};
let chargeStarted=null,attackHoldStarted=null,chargeRequest=null,autoChargeBusy=false,attackHeld=false;
let pendingAInteraction=null,chargeDelayTimer=null,beamStartTimer=null,nextChargeRetryAt=0;
let sniperScopeAtPress=false; // Black Cat A-holds may charge only when already scoped.
// Begin charging after the 500ms tap threshold without relying on render FPS.
// After a stun/rejected request, retry only while the A/Q button is still held.
function clearChargeDelay(){
 if(chargeDelayTimer!==null)clearTimeout(chargeDelayTimer);
 chargeDelayTimer=null;
 if(beamStartTimer!==null)clearTimeout(beamStartTimer);
 beamStartTimer=null;
}
function scheduleBeamChannelStart(delay){
 if(beamStartTimer!==null)clearTimeout(beamStartTimer);
 const scheduledWeapon=world?.profile?.equipment?.weapon;
 beamStartTimer=setTimeout(()=>{
  beamStartTimer=null;
  beginStaffChannel();
  // A single missed browser timer (GPU compile or background throttling)
  // previously left the prism charged forever with NO active beam. Watch
  // until the authenticated channel has actually started, even without rAF.
  if(attackHeld&&chargeStarted!==null&&!staffChannel&&controller?.enabled&&
     scheduledWeapon===world?.profile?.equipment?.weapon&&
     ['lightning','beam'].includes(itemById(scheduledWeapon)?.family))
   scheduleBeamChannelStart(260);
 },Math.max(0,delay));
}
function startHeldCharge(){
 if(!attackHeld||attackHoldStarted===null||chargeStarted!==null||chargeRequest||staffChannel||
    !controller?.enabled||performance.now()<nextChargeRetryAt)return;
 // Goldfish changes camera on a tap, but its original giant red fish
 // ultimate must remain chargeable ONLY before entering shoulder mode.
 if(itemById(world?.profile?.equipment?.weapon)?.id==='goldfish'&&gun.mode!==0)return;
 // Never begin a Black Cat charge while outside the actual sniper scope.
 if(itemById(world?.profile?.equipment?.weapon)?.id==='black-cat'&&(!sniperScopeAtPress||gun.mode!==2))return;
 chargeStarted=performance.now();
 chargeRequest=sendAction('attack',{phase:'charge',...(sniperScopeAtPress?{scoped:true}:{})}).then(result=>{
  if(!result?.charging&&attackHeld){
   chargeStarted=null;chargeRequest=null;nextChargeRetryAt=performance.now()+350;
  }
  return result;
 });
 audio.play('charge',.62);
 // Original vendor #08 and #29 now become visible on the FIRST channel pulse.
 // Do not wait for a future render frame to request that pulse: slow mobile
 // GPU compilation can starve the rAF-driven transition for several seconds.
 const weapon=itemById(world?.profile?.equipment?.weapon);
 if(weapon&&['lightning','beam'].includes(weapon.family))
  scheduleBeamChannelStart((Number(weapon.chargeMs)||1500)+75);
}
let staffChannel=null,staffChannelPromise=null,staffChannelBusy=false,staffChannelShotAt=0,staffChannelSerial=0;
function beginStaffChannel(){
 const item=itemById(world?.profile?.equipment?.weapon);
 const now=performance.now();
 if(!attackHeld||!chargeStarted||!isChannelStaff(item)||item?.family==='ice'||staffChannel||
    !controller?.enabled||self?.role!=='fighter'||ui.panelName||
    world?.profile?.effects?.paralysis?.until>Date.now()||now-(window._templeLastChannelAttempt||0)<=170)return;
 const elapsed=now-chargeStarted,chargeMs=Number(item?.chargeMs)||1500;
 if(elapsed<chargeMs)return;
 window._templeLastChannelAttempt=now;
 const serial=++staffChannelSerial;
 staffChannel={weapon:item.id,serial,ready:false};
 staffChannelShotAt=-Infinity;
 staffChannelPromise=Promise.resolve(chargeRequest).then(result=>{
  if(!result?.charging||!attackHeld||staffChannel?.serial!==serial)return null;
  return sendAction('attack',{phase:'channel-start'});
 }).then(result=>{
  if(result?.channeling&&staffChannel?.serial===serial&&attackHeld){
   staffChannel.ready=true;
   // The player has ALREADY fully charged. Trigger one server-owned effect
   // now rather than rendering another empty frame before the next rAF.
   if(['lightning','beam'].includes(item.family)&&!staffChannelBusy){
    staffChannelShotAt=performance.now();
    staffChannelBusy=true;
    void Promise.resolve(performAttack(1,'channel')).finally(()=>{staffChannelBusy=false;});
   }
  }else if(staffChannel?.serial===serial){
   staffChannel=null;
   // Server charge start can lag the client clock. Retry the actual state
   // transition without depending on rendering/fps; never fake an attack.
   if(attackHeld&&['lightning','beam'].includes(item.family))
    scheduleBeamChannelStart(260);
  }
  return result;
 });
}

const writer=new WriteCinematic({scene,controller:()=>controller,arena,ui,send:sendAction,audio,bursts,upload:file=>uploadMedia(network,file)});
const plantHover=bindPlantHover({canvas,camera,arena,controller:()=>controller,ui});
ui.addEventListener('write-start',()=>writer.begin());
const gun=new GunController({canvas,camera,controller:()=>controller,weapon:()=>itemById(world?.profile?.equipment?.weapon),ui,attack:performAttack});
const artEditor=new ArtworkEditor({scene,camera,canvas,arena,player:()=>localRoot,isGM:()=>!!self?.profile?.admin,send:sendAction,control:enabled=>{if(controller){controller.setEnabled(enabled&&!ui.panelName&&!wasDead);controller.cameraLocked=!!artEditor.mode&&artEditor.mode!=='follow';}},toast:text=>ui.toast(text)});
const platformDelete=new PlatformDeleteEditor({canvas,camera,arena,ui,editor:artEditor,isGM:()=>!!self?.profile?.admin,send:sendAction,controller:()=>controller,cancelBuild:cancelBuildPlacement});
const wallPainter=new CityWallPainter({canvas,camera,arena,controller:()=>controller,
 role:()=>self?.role,ui,send:sendAction,
 beforeStart:()=>{gun.end();ui.emit('attack-cancel');}});

// Shared capture-phase MIDDLE-MOUSE orbit for player BUILD/PAINT and
// GM disc / artwork editing. Left-button picking, painting, and gizmos are
// untouched. Pointer capture continues the orbit beyond the canvas edge.
let editMiddleOrbit=null;
const canEditMiddleOrbit=()=>!!controller&&(
 !!(buildPlacement||wallPainter.active||ui.panelName==='build')||
 (!!self?.profile?.admin&&!!(platformDelete.active||artEditor.selected||
  ['gm','editor'].includes(ui.panelName))));
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==1||!canEditMiddleOrbit())return;
 e.preventDefault();e.stopImmediatePropagation();
 editMiddleOrbit={id:e.pointerId,x:e.clientX,y:e.clientY};
 try{canvas.setPointerCapture(e.pointerId);}catch{}
},{capture:true});
canvas.addEventListener('pointermove',e=>{
 if(editMiddleOrbit?.id!==e.pointerId)return;
 e.preventDefault();e.stopImmediatePropagation();
 const dx=e.clientX-editMiddleOrbit.x,dy=e.clientY-editMiddleOrbit.y;
 editMiddleOrbit.x=e.clientX;editMiddleOrbit.y=e.clientY;
 controller?.orbitEditCamera(dx,dy);
},{capture:true});
const endGmOrbit=e=>{
 if(editMiddleOrbit?.id!==e.pointerId)return;
 e.preventDefault();e.stopImmediatePropagation();
 editMiddleOrbit=null;
 try{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}catch{}
};
canvas.addEventListener('pointerup',endGmOrbit,{capture:true});
canvas.addEventListener('pointercancel',endGmOrbit,{capture:true});
canvas.addEventListener('lostpointercapture',e=>{if(editMiddleOrbit?.id===e.pointerId)editMiddleOrbit=null;},{capture:true});
canvas.addEventListener('mousedown',e=>{if(e.button===1&&canEditMiddleOrbit())e.preventDefault();},{capture:true});
canvas.addEventListener('auxclick',e=>{if(e.button===1&&canEditMiddleOrbit())e.preventDefault();},{capture:true});

const portraitViewport=new EquipmentPortraitViewport();
function refreshEquipmentPortrait(){
 const canvas=document.getElementById('bag-portrait');
 if(ui.panelName!=='bag'||ui.bagCategory!=='equipment'||!canvas?.isConnected)return;
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
ui.addEventListener('equipment-portrait',()=>{
 requestAnimationFrame(refreshEquipmentPortrait);
});
boot();

async function boot(){
  const started=performance.now(),timings=window.templeLoadTimings={};
  try{const [published,layout]=await Promise.all([fetch('./temple-layout.json').then(r=>r.ok?r.json():{}),fetch('./temple-artwork-layout.json').then(r=>r.json())]);Object.assign(settings,published.settings||{},loadEditorSettings());arena.defaultLayout=layout.artworkLayout||{};timings.configMs=performance.now()-started;const assetStart=performance.now(),warmStart=performance.now(),warmTask=arena.presentation.vfx.warm(renderer,camera).then(result=>{timings.effects=result;timings.effectsMs=performance.now()-warmStart;});await Promise.all([arena.load((value,label)=>ui.setLoading(value,label)),document.fonts.load('bold 48px GoldenGirdle')]);vitalModels=new VitalModels(arena.coinMesh.geometry,arena.coinMesh.material);timings.assetsMs=performance.now()-assetStart;ui.setLoading(.9,'Preparing 00GameDevs weapon effects');await warmTask;ui.setLoading(.905,'Pre-rendering complete equipment for SHOP and BAG');setOutfitPreviewCharacter(arena.characterAsset?.scene);timings.previews=await warmItemPreviews(ITEMS,(done,total)=>ui.setLoading(.905+.032*done/Math.max(1,total),'Pre-rendering full equipment '+done+'/'+total));ui.setLoading(.94,'Prewarming all monster jump and dash animations');try{timings.monsterRigs=await arena.islandEnemies.warmModels(renderer,camera);}catch(error){console.warn('Monster rig prewarm incomplete',error);}ui.setLoading(.95,'Prewarming monster landing shockwaves');try{await arena.islandEnemies.attackEffects.warm(renderer,camera);}catch(error){console.warn('Monster VFX shader prewarm incomplete',error);}applyEditorSettings({pixelRatio:settings.pixelRatio||(coarse?1:1.35),fog:settings.fog??.0008,artFloat:settings.artFloat??.17});camera.position.set(0,13,30);camera.lookAt(0,2,0);ui.setLoading(.99,'Preparing scene shaders');const compileStart=performance.now();await renderer.compileAsync(scene,camera);await chargePreview.warm(renderer,camera);await arena.outerCity?.warmEffects(renderer,camera);timings.sceneCompileMs=performance.now()-compileStart;timings.totalMs=performance.now()-started;ui.setLoading(1,'100% · Ready');assetsReady=true;ui.ready();void initializeGoogleAuth();}
  catch(error){console.error(error);ui.setLoading(0,'Loading failed · reload to retry: '+error.message);ui.joinError(error.message);}
}

async function completeFirebaseLogin(firebaseIdToken){
  // The player explicitly requested Google's account chooser on this visit.
  // Preserve the previously proven profile->join flow for existing GM/players.
  // Never auto-join from an old stored Firebase session on page load.
  const account=await network.firebaseProfile(firebaseIdToken);
  if(joined)return;
  if(account.existing&&account.profile){
    // Re-enable account selection in case joining fails, so the GM or any
    // other existing account can retry rather than remaining locked out.
    ui.setFirebaseLoginStatus(true,'Account verified. Loading your character…');
    ui.emit('join',{
      name:account.profile.name,color:account.profile.color,
      firebaseIdToken,backendUrl:network.base
    });
  }else ui.selectFirebaseAccount(firebaseIdToken);
}
async function initializeGoogleAuth(){
  try{
    network.setBackend(window.TEMPLE_CONFIG.backendUrl);
    const config=await network.firebaseConfig();
    if(!config.enabled){
      ui.setFirebaseLoginStatus(false,'Google sign-in is unavailable: Firebase project settings are missing.');
      return;
    }
    await prepareFirebase(config);
    ui.setFirebaseLoginStatus(true,'Choose an account to continue.');
  }catch(error){
    console.warn('Firebase Google login setup:',error);
    ui.setFirebaseLoginStatus(false,'Google sign-in initialization failed: '+(error?.message||'Unknown error'));
  }
}
ui.addEventListener('firebase-login',async()=>{
  try{
    // Firebase SDK is preloaded before clicking the button, keeping the popup
    // tied to the original user gesture on iOS Safari.
    const token=await signInWithGoogle();
    await completeFirebaseLogin(token);
  }catch(error){
    const message=error?.code==='auth/popup-closed-by-user'?'Google sign-in window was closed':
      error?.code==='auth/popup-blocked'?'Allow your browser to open the Google sign-in window':
      error?.message||'Google sign-in failed';
    ui.joinError(message);
    ui.setFirebaseLoginStatus(true,message);
  }
});
ui.addEventListener('join',async event=>{
  if(!assetsReady)return ui.joinError('Temple assets are still loading');audio.startMusic();ui.joinBusy(true);try{network.setBackend(event.detail.backendUrl);const data=await network.join(event.detail);registerCustomWings(data.world?.customWings);arena.world=data.world;self=data.self;world=data.world;players=data.players||[];joined=true;lastHealVisualAt=0;ui.enter(data);createLocalPlayer(data);syncPlayers();syncWorld();
    void resumeWingCheckout(network,ui);
    void arena.loadCustomArtworks(data.world.customArtworks,network.base).catch(error=>console.warn('Deferred artwork loading',error));
    network.chatHistory().then(history=>history.forEach(message=>ui.addChat(message))).catch(()=>{});}
  catch(error){ui.joinError(error.message);}
});

function acceptWorldView(next){
 // A successful attack delivers the same revision in its HTTP response AND
 // in a WebSocket world broadcast. Rebuilding the complete gallery/UI twice
 // on that same hit was one of the repeatable browser frame spikes.
 if(!next||(world&&Number.isFinite(world.revision)&&Number.isFinite(next.revision)&&
    next.revision<=world.revision))return false;
 const wings=Array.isArray(next.customWings)?next.customWings:(world?.customWings||[]);
 if(wings!==world?.customWings)registerCustomWings(wings);world={...next,customWings:wings};syncWorld();return true;
}
network.addEventListener('welcome',event=>{const data=event.detail;self={...self,...data.self};players=data.players;syncPlayers();acceptWorldView(data.world);});
// Coalesce high-frequency Worker snapshots: a busy attack can deliver many
// world packets between animation frames. Only the freshest revision needs a
// heavyweight UI/scene sync; the socket keeps receiving without blocking input.
let queuedWorld=null;
network.addEventListener('world',event=>{
 const next=event.detail;
 if(!next)return;
 if(!queuedWorld||!Number.isFinite(queuedWorld.revision)||
  !Number.isFinite(next.revision)||next.revision>=queuedWorld.revision)
  queuedWorld=next;
});
network.addEventListener('wing-catalog',event=>{
 const wings=Array.isArray(event.detail?.wings)?event.detail.wings:[];
 registerCustomWings(wings);
 if(world){world={...world,customWings:wings};arena.world=world;ui.setWorld(world);
  if(['wing-shop','wing-manage'].includes(ui.panelName))ui.renderPanel();}
});
network.addEventListener('players',event=>{players=event.detail;syncPlayers();});
network.addEventListener('state',event=>{const data=event.detail;if(data.key===self?.key)return;let target=remoteTargets.get(data.key);if(!target){syncPlayers();target=remoteTargets.get(data.key);}if(target){target.position.fromArray(data.state.position);target.rotation=data.state.rotation;target.animation=data.state.animation;}});
network.addEventListener('chat',event=>{ui.addChat(event.detail);showPlayerSpeech(event.detail);});
network.addEventListener('chat-reset',()=>{ui.clearChat();for(const entry of speechBubbles.values())entry.element.remove();speechBubbles.clear();});
network.addEventListener('artwork-throw',event=>showThrowPulse(event.detail));
network.addEventListener('attack',event=>showAttack(event.detail));
network.addEventListener('channel-stop',event=>{const root=roots.get(event.detail.owner);if(root){arena.presentation.vfx.stopChannel(root);root.userData.staffCastingUntil=0;}});
network.addEventListener('structure-destroyed',event=>arena.showStructureBreak(event.detail));
network.addEventListener('structure-hit',event=>arena.showStructureHit(event.detail));
network.addEventListener('structure-events',event=>{
 for(const hit of event.detail.hits)arena.showStructureHit(hit);
 for(const broken of event.detail.broken)arena.showStructureBreak(broken);
});
network.addEventListener('state-ack',event=>{
 const ack=event.detail||{};
 if(!controller||ack.seq!==network.lastAcceptedSequence||ack.seq<=network.lastCorrectedSequence)return;
 if(controller&&ack.seq===network.lastAcceptedSequence&&!network.spawnConfirmed){
  network.spawnConfirmed=true;
  if(!ui.panelName&&!artEditor.mode&&!writer.active&&!platformDelete.active&&!wasDead)controller.setEnabled(true);
 }
 // WRITE owns local cinematic motion. Its server pose is evaluated at a
 // different instant; treating the difference as a walking correction
 // double-applies the scripted travel (including after landing).
 if(ack.authority?.kind==='write')return;
 if(controller&&ack.authority?.kind==='immobilized'){
  const until=performance.now()+Math.max(0,ack.authority.until-ack.serverTime);
  controller.authorityHoldUntil=until;
 }else if(controller)controller.authorityHoldUntil=0;
 // Stun, root and server-scripted movement legitimately override prediction;
 // ordinary 3-decimal state rounding is below the correction threshold.
 if(!ack.corrected||!controller||!Array.isArray(ack.position)||
    ack.seq!==network.lastAcceptedSequence||ack.seq<=network.lastCorrectedSequence)return;
 const position=controller.root.position;
 const immobilized=ack.authority?.kind==='immobilized'||controller.status?.freeze||controller.status?.root||controller.vortexSpin;
 const recovered=!immobilized&&Array.isArray(ack.submitted)?
  rebaseRejectedPose(ack.position,ack.submitted,position.toArray(),
   (x,z,y)=>arena.blocked(x,z,y)):null;
 const corrected=recovered||ack.position;
 if(position.distanceToSquared(new THREE.Vector3(...corrected))>.36){
  network.noteMotionError({kind:'applied-ack',source:ack.authority?.kind||'correction',seq:ack.seq,serverTime:ack.serverTime,before:position.toArray(),submitted:ack.submitted,authoritative:ack.position,after:corrected});
  // Keep motion simulated after this ACK; do not rewind the newest frame.
  if(immobilized||!recovered)controller.teleport(corrected);
  else controller.root.position.fromArray(corrected);
 }
 network.lastCorrectedSequence=Math.max(network.lastCorrectedSequence,ack.seq||0);
});
network.addEventListener('state-rejected',event=>{
 const rejection=event.detail||{},seq=Number(rejection.seq)||0;
 if(shouldIgnoreRejection(seq,network.lastAcceptedSequence,network.lastCorrectedSequence))return;
 if(rejection.state?.position&&controller){
  const accepted=rejection.state.position,sent=network.sentStates.get(seq);
  const current=controller.root.position;
  // Root cause of repeated step-back: a delayed speed-budget rejection was
  // treated as a new teleport even while the client had a valid newer
  // position. Do NOT discard several subsequent walking frames for this
  // transient case. Building collisions and invalid teleports still enforce
  // the authoritative location.
  if(sent&&!controller.status.freeze&&!controller.status.root&&!controller.vortexSpin&&
     keepPredictedMoveOnLatencyReject(rejection.error,accepted,sent.position,
      current.toArray(),(x,z,y)=>arena.blocked(x,z,y),{
       sampleAgeMs:performance.now()-sent.sentAt,
       authorityAgeMs:performance.now()-(network.lastAuthorityAt||sent.sentAt)
      })){
    network.lastCorrectedSequence=Math.max(network.lastCorrectedSequence,seq);
    network.lastStateAt=0;
    return;
  }
  const recovered=sent&&rejection.error!=='Invalid position'?
   rebaseRejectedPose(accepted,sent.position,current.toArray(),(x,z,y)=>arena.blocked(x,z,y)):
   accepted;
  const corrected=recovered||accepted;
  const dx=current.x-corrected[0],dy=current.y-corrected[1],dz=current.z-corrected[2];
  // A correction is authoritative, but movement applied after the rejected
  // sample must not be wiped away by a delayed reply.
  if(dx*dx+dy*dy+dz*dz>.36){
   network.noteMotionError({kind:'applied-rejection',source:rejection.error,seq,serverTime:rejection.serverTime,before:current.toArray(),submitted:sent?.position,authoritative:accepted,after:corrected});
   // Predicted step replay is not a teleport: do not erase walk speed,
   // airborne velocity or knockback each time the server responds.
   // A true invalid teleport or blocked replay still needs a hard reset.
   if(!sent||rejection.error==='Invalid position'||(corrected===accepted))
    controller.teleport(corrected);
   else controller.root.position.fromArray(corrected);
   controller.grounded=Math.abs(corrected[1]-arena.groundHeight(
    corrected[0],corrected[2],corrected[1]))<.5;
  }
  network.lastCorrectedSequence=Math.max(network.lastCorrectedSequence,seq);
  network.lastStateAt=0;
 }
 if(rejection.error!=='Movement rejected'&&performance.now()-toastErrorAt>1200){
  toastErrorAt=performance.now();ui.toast(rejection.error||'STATE REJECTED');
 }
});
network.addEventListener('connection',event=>{if(joined)ui.toast(event.detail.connected?'REALTIME CONNECTED':'RECONNECTING…');});

ui.addEventListener('attack',()=>performAttack());
ui.addEventListener('gun-fire',()=>{if(gun.mode)void performAttack(0);});
ui.addEventListener('create-platform',event=>sendAction('create-platform',event.detail));
ui.addEventListener('gm-platform-tool',event=>{
 if(!self?.profile?.admin)return;
 platformDelete.begin(event.detail.mode,event.detail.kind);
});
ui.addEventListener('gm-artwork-select',async event=>{
 if(!self?.profile?.admin||!controller)return;
 const {id,repair}=event.detail;
 if(artEditor.dirty)return ui.toast('請先儲存或取消目前作品修改');
 if(repair){
  const position=controller.buildPosition(4);
  if(!position)return ui.toast('無法取得 GM 前方位置');
  position[1]=Math.max(0,position[1])+1.5;
  const result=await sendAction('repair-artwork',{platformId:id,position});
  if(!result)return;
 }
 ui.closePanel();
 let root=arena.artworks.get(id);
 if(!root){
  try{await arena.loadCustomArtworks(world?.customArtworks||[],network.base);}catch(error){ui.toast(error.message);return;}
  root=arena.artworks.get(id);
 }
 if(!root)return ui.toast('作品模型尚未載入：'+id);
 artEditor.select(root);
});
ui.addEventListener('art-bomb-resize',event=>sendAction('resize-art-bomb',event.detail));
ui.addEventListener('art-bomb-appearance',async event=>{
 const saved=await sendAction('update-art-bomb-appearance',event.detail);
 if(!saved?.artworkLayout)return;
 // The BUILD form stays open after a successful colour save; refresh its
 // authoritative revision for additional edits without forcing a panel
 // re-render or discarding the user's currently chosen colour.
 for(const form of ui.content.querySelectorAll('[data-form="art-bomb-appearance"]')){
  if(form.querySelector('[name="id"]')?.value!==event.detail.id)continue;
  const revision=form.querySelector('[name="revision"]');
  if(revision)revision.value=String(saved.artworkLayout.revision);
 }
});
ui.addEventListener('art-bomb-upload',async event=>{
 if(self?.role!=='fighter')return ui.toast('JOIN AS A FIGHTER TO PLACE ARTWORK');
 if(artBombUploading)return;
 const {files,size,title,labelBackground}=event.detail;
 if(!title?.trim())return ui.toast('請輸入作品名稱');
 if(!Number.isFinite(size)||size<1||size>3)return ui.toast('藝術品尺寸只能設定 1–3 倍');
 artBombUploading=true;
 const button=ui.content.querySelector('[data-form="art-bomb-upload"] button[type="submit"]');
 if(button)button.disabled=true;
 try{
  ui.toast('上傳中：驗證檔案並確認 Cloudflare 已儲存…');
  const upload={...await uploadArtwork(network,files,{maxBytes:8*1024*1024}),title:title.trim().slice(0,100),labelBackground};
  ui.closePanel();
  startBuildPlacement('art-bomb',null,{...upload,size,previewFile:files.find(f=>f.type.startsWith('image/'))||null});
  arena.setBuildPreview('art-bomb',controller.buildPosition(3.2),controller.root.rotation.y,true,size,files.find(f=>f.type.startsWith('image/'))||null);
  arena.previewUploadedArtwork({...upload,size},network.base).catch(error=>ui.toast('預覽讀取失敗：'+error.message));
  ui.toast('Cloudflare 已儲存 · 移動角色攜帶作品，再按 PLACE');
 }catch(error){ui.toast(error.message);}
 finally{artBombUploading=false;if(button)button.disabled=false;}
});
ui.addEventListener('upload-artwork',async event=>{if(!self?.profile?.admin)return;const button=ui.content.querySelector('[data-upload-submit]');if(button)button.disabled=true;try{ui.toast('正在驗證藝術品…');const upload={...await uploadArtwork(network,event.detail.files,{maxBytes:32*1024*1024}),title:event.detail.title.trim().slice(0,100)},position=controller.buildPosition(4);position[1]+=2;const result=await sendAction('add-artwork',{artwork:{...upload,position,appearance:{labelBackground:event.detail.labelBackground||'#000000'}}});if(!result)throw Error('Artwork was not published. Retry after checking the connection.');await arena.loadCustomArtworks(world.customArtworks,network.base);ui.closePanel();artEditor.select(arena.artworks.get(result.artwork.id));ui.toast('藝術品已發布 · 可調整位置及表面');}catch(error){ui.toast(error.message);const status=ui.content.querySelector('[data-upload-status]');if(status)status.textContent=error.message;}finally{if(button)button.disabled=false;}});
ui.addEventListener('use-item',event=>{const item=itemById(event.detail);if(item&&controller)ui.toast('Use this material in BAG → FUSION');});
ui.addEventListener('original-action',event=>sendAction(event.detail.action,event.detail));
// Safari's AudioContext must be resumed during the trusted jump touch gesture.
ui.addEventListener('jump',()=>{audio.unlock();controller?.jump();});
const pendingQuickUses=new Set();
ui.addEventListener('quick-use',event=>{
 const slot=event.detail?.slot;
 if(!Number.isInteger(slot)||slot<0||slot>2||pendingQuickUses.has(slot))return;
 if(!joined||self?.role!=='fighter'||!controller?.enabled||ui.panelName)return;
 pendingQuickUses.add(slot);
 void sendAction('use-consumable',{slot}).finally(()=>pendingQuickUses.delete(slot));
});
// On-screen A/Q is the sole interaction/throw control on desktop and mobile.
// For firearms A ONLY switches
// camera: standard > shoulder > sniper scope > standard; canvas tap fires.
ui.addEventListener('attack-start',()=>{
 if(wallPainter.active||!controller?.enabled||self?.role!=='fighter')return;
 if(coarse&&buildPlacement){confirmBuildPlacement();return;}
 // A held artwork overrides the currently equipped firearm/camera mode.
 // Query the live world as holdingArt can lag behind a pickup response.
 const carryingArtwork=Object.values(world?.artworks||{}).some(art=>art.holder===self.key);
 // A previous sale/throw may have removed ownership while a charge preview
 // lingered. Do not let that stale preview block pickup of a respawned work.
 if(!carryingArtwork&&artworkThrow.started!==null)artworkThrow.cancel();
 if(carryingArtwork){
  clearChargeDelay();pendingAInteraction=null;attackHeld=false;sniperScopeAtPress=false;
  attackHoldStarted=null;chargeStarted=null;chargeRequest=null;
  artworkThrow.begin();return;
 }
 if(attackHeld||staffChannel)return;
 const weapon=itemById(world?.profile?.equipment?.weapon);
 // Record scope at key-down, so holding A before aiming can never charge/fire.
 sniperScopeAtPress=weapon?.id==='black-cat'&&gun.mode===2;
 // A tap picks up nearby items; holding must still charge any weapon except unscoped Black Cat.
 // For first-person guns a tap cycles the camera, while a hold charges.
 pendingAInteraction=null;
 if(!artworkThrow.started){
  const nearbyArt=arena.nearest(controller.root.position.toArray());
  if(nearbyArt?.type==='artwork'||['coin','drop'].includes(nearbyArt?.type))
   pendingAInteraction=nearbyArt;
 }
 attackHeld=true;
 attackHoldStarted=performance.now();
 chargeStarted=null;chargeRequest=null;nextChargeRetryAt=0;
 clearChargeDelay();
 chargeDelayTimer=setTimeout(()=>{chargeDelayTimer=null;startHeldCharge();},STAFF_TAP_MAX_MS);
 if(isChannelStaff(weapon)&&localRoot)localRoot.userData.staffCastingUntil=attackHoldStarted+1800;
});
ui.addEventListener('attack-release',async()=>{
 // This check must precede gun handling. The initial SMG previously left
 // artwork charging forever because the firearm early return skipped release.
 if(artworkThrow.started!==null){
  gun.held=false;attackHeld=false;clearChargeDelay();pendingAInteraction=null;
  chargeStarted=null;attackHoldStarted=null;chargeRequest=null;
  return artworkThrow.release();
 }
 gun.held=false;attackHeld=false;clearChargeDelay();
 const tapInteraction=pendingAInteraction;pendingAInteraction=null;
 if(staffChannel){
  const pending=staffChannelPromise;
  staffChannel=null;++staffChannelSerial;
  arena.presentation.vfx.stopChannel(localRoot);localRoot.userData.staffCastingUntil=0;
  chargeStarted=null;attackHoldStarted=null;chargeRequest=null;
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
 const wasScopedAtPress=sniperScopeAtPress;sniperScopeAtPress=false;
 attackHoldStarted=null;chargeStarted=null;
 const pending=chargeRequest;chargeRequest=null;
 if(heldMs<STAFF_TAP_MAX_MS&&tapInteraction){
  performInteract(tapInteraction);return;
 }
 // Outside the scope Black Cat A/Q only changes cameras, even on long holds.
 // Fused weapons cannot turn this camera input into an ordinary or ultimate hit.
 if(weapon?.id==='goldfish'){
  if(gun.mode===1){gun.cycle();return;} // scoped A remains camera-only
  if(heldMs<STAFF_TAP_MAX_MS){gun.cycle();return;}
  if(pending)await pending;
  if(charge>=1)await performAttack(1); // original full-size red fish
  else void sendAction('attack',{phase:'channel-stop'}); // clear interrupted charge
  return;
 }
 if(weapon?.id==='black-cat'&&!wasScopedAtPress){gun.cycle();return;}
 if(weapon?.firstPerson&&heldMs<STAFF_TAP_MAX_MS){gun.cycle();return;}
 if(heldMs>=STAFF_TAP_MAX_MS&&pending)await pending;
 if(isChannelStaff(weapon)){
  if(isStaffTap(weapon,heldMs)){
   if(localRoot)localRoot.userData.staffCastingUntil=Infinity;
   const liftRemaining=Math.max(0,STAFF_RAISE_SECONDS*1000-heldMs);
   if(liftRemaining>0)await new Promise(resolve=>setTimeout(resolve,liftRemaining));
   if(world?.profile?.equipment?.weapon===weapon.id)await performAttack(0);
   if(localRoot)localRoot.userData.staffCastingUntil=performance.now()+200;
  }else if(weapon.family==='ice'&&charge>=1){
   // A charged frost staff is a RELEASE cast. Never start a continuous
   // channel or abort its ice circle when A is lifted.
   if(world?.profile?.equipment?.weapon===weapon.id)
    await performAttack(1);
   if(localRoot)localRoot.userData.staffCastingUntil=performance.now()+200;
  }else if(localRoot)localRoot.userData.staffCastingUntil=0;
 }else{
  performAttack(heldMs<STAFF_TAP_MAX_MS?0:charge);
 }
});
ui.addEventListener('attack-cancel',()=>{
 gun.held=false;
 attackHeld=false;sniperScopeAtPress=false;chargeStarted=null;attackHoldStarted=null;chargeRequest=null;pendingAInteraction=null;clearChargeDelay();artworkThrow.cancel();
 if(localRoot)localRoot.userData.staffCastingUntil=0;
 if(staffChannel){
  const pending=staffChannelPromise;
  staffChannel=null;++staffChannelSerial;
  arena.presentation.vfx.stopChannel(localRoot);localRoot.userData.staffCastingUntil=0;
  void sendAction('attack',{phase:'channel-stop'});void Promise.resolve(pending).then(result=>{if(result?.channeling)return sendAction('attack',{phase:'channel-stop'});});
 }
});
ui.addEventListener('wing-publish-request',async event=>{
 const {wing,wingId,personal,resolve,reject}=event.detail;
 if(!personal&&!self?.profile?.admin){reject(new Error('僅 GM 可以上架翅膀'));return;}
 if(personal&&!world?.profile?.wingDesignCredits){reject(new Error('未取得已付款的繪圖權限'));return;}
 try{
  const updating=!!wingId&&!personal;
  const result=await sendAction(personal?'redeem-wing-design':updating?'gm-wing-update':'gm-wing-publish',{wing,wingId},{throwOnError:true});
  if(personal){
   if(!result?.personalWingId||result.equippedWingId!==result.personalWingId)
    throw new Error('伺服器尚未確認個人翅膀已儲存');
   if(world?.profile?.equipment?.wings!==result.personalWingId)
    throw new Error('個人翅膀已存入背包，裝備資料仍在同步中');
   resolve({...result,wingName:wing.name});
   ui.wingDraft=null;ui.bagCategory='equipment';ui.openPanel('bag');
   ui.toast('翅膀已存入 BAG 並自動裝備：'+wing.name);return;
  }
  if(updating){
   if(result?.updatedWingId!==wingId)throw new Error('伺服器尚未確認原翅膀的編輯更新');
   resolve({...result,wingName:wing.name});ui.openPanel('wing-manage');
   ui.toast('翅膀已修改並重新上架：'+wing.name);return;
  }
  if(!result?.publishedWingId||result.equippedWingId!==result.publishedWingId)
   throw new Error('伺服器沒有確認翅膀已上架並自動裝備');
  if(world?.profile?.equipment?.wings!==result.publishedWingId)
   throw new Error('翅膀已上架，但裝備狀態尚未同步；請重新進入 BAG 確認');
  resolve({...result,wingName:wing.name});
  ui.bagCategory='equipment';
  ui.openPanel('bag');
  ui.toast('翅膀已上架、加入背包並自動裝備：'+wing.name);
 }catch(error){
  reject(error);
  ui.toast('上架失敗：'+(error?.message||'伺服器未回應'));
 }
});
ui.addEventListener('wing-payment-status-request',async()=>{
 try{ui.setWingPaymentStatus(await network.request('/api/wing-pay/status'));}
 catch(error){ui.setWingPaymentStatus({checkoutEnabled:false,checkoutMode:'disabled'});ui.toast('Payment status unavailable.');}
});
ui.addEventListener('wing-payment-checkout',async()=>{
 if(ui.wingCheckoutBusy)return;
 ui.wingCheckoutBusy=true;if(ui.panelName==='wing-shop')ui.renderWingShop(world.profile);
 const order=await beginWingCheckout(network,ui);
 if(!order){ui.wingCheckoutBusy=false;if(ui.panelName==='wing-shop')ui.renderWingShop(world.profile);}
});
ui.addEventListener('server-action',event=>{const {action,...data}=event.detail;
 if(action==='fuse'){
  if(ui.bagFusionPending)return;
  ui.bagFusionPending=true;
  void sendAction(action,data).finally(()=>{ui.bagFusionPending=false;});
 }else void sendAction(action,data);
});
ui.addEventListener('build-start',async event=>{try{const d=event.detail;const media=d.file?await uploadMedia(network,d.file):null;startBuildPlacement(d.kind,media?.id);}catch(error){ui.clearBuildMode();ui.toast(error.message);}});ui.addEventListener('build-rotate',()=>rotateBuildPlacement());ui.addEventListener('build-confirm',()=>confirmBuildPlacement());ui.addEventListener('build-cancel',()=>cancelBuildPlacement());
ui.addEventListener('destroy-near',()=>{if(!controller)return;const position=controller.root.position.toArray(),nearest=(world?.structures||[]).map(structure=>({structure,distance:distance2d3(position,structure.position)})).sort((a,b)=>a.distance-b.distance)[0];if(!nearest||nearest.distance>12)return ui.toast('NO STRUCTURE NEARBY');sendAction('destroy',{structureId:nearest.structure.id,direction:controller.aimDirection()});});
ui.addEventListener('chat',async event=>{const text=String(event.detail||'').trim();if(text==='/recovery'){await sendAction('recover-artworks');return;}if(/^\/recoverposition$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('recover-misplaced-artwork');return;}if(/^\/reset$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('reset-player-artworks');return;}
 if(/^\/reset\s+building$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('reset-buildings');return;}
 if(/^\/clean\s+(?:graffic|graffiti)$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('clean-graffiti');return;}
 if(/^\/reset\s+message$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('reset-messages');return;}
 try{const result=await network.chat(text);if(result?.notice)ui.toast(result.notice);}catch(error){ui.toast(error.message);}});
ui.addEventListener('plant',event=>writer.submit(event.detail));
ui.addEventListener('save-code',async()=>{try{const data=await network.createSaveCode();self.saveCode=data.code;ui.self=self;ui.showSaveCode(data.code);ui.toast('存檔代碼已產生 · 請保存');}catch(error){ui.toast(error.message);}});
ui.addEventListener('gm-presence-request',async()=>{if(!self?.profile?.admin)return;try{ui.setGmPresence(await network.gmPresence());}catch(error){ui.setGmPresenceError(error.message);}});
ui.addEventListener('role-change',async event=>{try{const data=await network.changeRole(event.detail);network.spawnConfirmed=data.role===self?.role&&network.spawnConfirmed;cancelBuildPlacement();self={...self,...data.self,role:data.role,seat:data.seat};world=data.world;players=data.players;controller.seat=data.seat;controller.setFollowTarget(null);controller.setRole(data.role);if(data.role!=='fighter')wallPainter.stop();controller.teleport(PLAYER_SPAWNS[data.seat]||PLAYER_SPAWNS[0]);ui.setSelf(self);syncPlayers();syncWorld();ui.toast(data.role==='fighter'?'FIGHTER SEAT READY':'SPECTATOR MODE · TAB TO FOLLOW');}catch(error){ui.toast(error.message);}});
ui.addEventListener('spectator-follow',event=>followSpectator(event.detail));ui.addEventListener('spectator-cycle',()=>cycleSpectator());
ui.addEventListener('panel',event=>{if(event.detail.open)wallPainter.stop();chargeStarted=null;attackHoldStarted=null;chargeRequest=null;pendingAInteraction=null;clearChargeDelay();if(event.detail.open){attackHeld=false;}if(event.detail.open&&staffChannel){arena.presentation.vfx.stopChannel(localRoot);localRoot.userData.staffCastingUntil=0;const pending=staffChannelPromise;staffChannel=null;++staffChannelSerial;void sendAction('attack',{phase:'channel-stop'});void Promise.resolve(pending).then(result=>{if(result?.channeling)return sendAction('attack',{phase:'channel-stop'});});}if(event.detail.open)artworkThrow.cancel();controller?.setEnabled(!event.detail.open&&!artEditor.mode&&!writer.active&&!platformDelete.active&&!wallPainter.active);if(!event.detail.open&&(writer.phase==='write'||writer.legacy))writer.cancel();});
ui.addEventListener('editor-settings',event=>applyEditorSettings(event.detail));
ui.addEventListener('gm-audio-setting',event=>{if(!self?.profile?.admin)return;audio.setVolumes({[event.detail.key]:event.detail.value});void sendAction('gm-audio-setting',event.detail);});
 ui.addEventListener('gm-fusion-chance',event=>{if(!self?.profile?.admin)return;void sendAction('gm-fusion-chance',event.detail);});
 ui.addEventListener('gm-invincible',event=>{if(!self?.profile?.admin)return;void sendAction('gm-invincible',event.detail);});
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
   audio.unlock(false);audio.startMusic();
  localRoot=arena.createPlayer(data.self.color,data.self.profile?.admin,data.self.name);scene.add(localRoot);roots.set(data.self.key,localRoot);controller=new PlayerController({camera,arena,canvas,root:localRoot,role:data.role,seat:data.seat,mobileStick:document.getElementById('mobile-stick')});controller.setRole(data.role);controller.setEnabled(true);controller.onJump=()=>audio.play('jump',1.2);
}

function syncPlayers(){
  if(!self)return;const live=new Set([self.key]);for(const player of players){if(player.role!=='fighter')continue;live.add(player.key);if(player.key===self.key)continue;let root=roots.get(player.key);if(!root){root=arena.createPlayer(player.color,false,player.name);root.name=`Player ${player.name}`;scene.add(root);roots.set(player.key,root);remoteTargets.set(player.key,{position:new THREE.Vector3(),rotation:0,animation:'idle'});}if(player.state){const target=remoteTargets.get(player.key);target.position.fromArray(player.state.position);target.rotation=player.state.rotation;target.animation=player.state.animation;root.visible=player.role==='fighter';}else root.visible=false;}
  // The authoritative private world is the ONLY owner of local equipment,
  // effects and impulses. A delayed cached roster can contain older combat
  // state even after the matching HTTP/WS world has been applied.
  for(const player of players){if(player.role!=='fighter'||player.key===self.key)continue;const root=roots.get(player.key);if(root){arena.setPlayerEquipment(root,player.profile?.equipment);setHealthBar(root,player.profile?.hp,player.profile?.maxHp);root.userData.deadUntil=player.profile?.deadUntil||0;applyShieldHit(root,player.profile);applyHitReaction(root,player.profile);statusVisuals.sync(root,player.profile?.effects);}}
  for(const [key,root] of roots)if(key!==self.key&&!live.has(key)){statusVisuals.clear(root);arena.removePlayer(root);roots.delete(key);remoteTargets.delete(key);}ui.setPlayers(players);
}
function applyShieldHit(root,profile){
 const shield=profile?.shield;
 if(!root||!shield?.hitId||root.userData.lastShieldHitId===shield.hitId)return;
 root.userData.lastShieldHitId=shield.hitId;
 if(Date.now()-Number(shield.lastHit||0)>1500)return; // No flash from stale reconnect snapshots.
 root.userData.shieldFlashUntil=performance.now()+1300;
}
function applyHitReaction(root,profile){const hit=profile?.hitReaction;if(!root||!hit||root.userData.lastHitReaction===hit.id||Date.now()-hit.time>2500)return;root.userData.lastHitReaction=hit.id;audio.play('hit',root===localRoot?1:.35);root.userData.hitFlashUntil=performance.now()+250;
 if((hit.stunMs||0)>=900){const remaining=Math.max(0,hit.stunMs-(Date.now()-hit.time));root.userData.knockdown={start:performance.now(),duration:remaining};}if(root===localRoot){
  controller.stunUntil=hit.whipPull?0:performance.now()+(hit.knockbackDurationMs||100);
   if(hit.motion==='stomp')screenShakeUntil=performance.now()+350;
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
   controller.knockbackSpeed=hit.knockbackDurationMs?hit.knockbackDistance/(hit.knockbackDurationMs/1000):0;
  }else{
   controller.knockbackRemaining=0;
   controller.knockbackSpeed=0;
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
let lastSyncedWorld=null;
function syncWorld(){if(!world)return;
 const previous=lastSyncedWorld;lastSyncedWorld=world;
 if(!previous||world.audioSettings!==previous.audioSettings)audio.setVolumes(world.audioSettings||{});
 if(world.musicVersion&&world.musicVersion!==previous?.musicVersion)audio.setUploadedMusic(network.base,world.musicVersion);
 if(!previous||world.customArtworks!==previous.customArtworks)
  arena.loadCustomArtworks(world.customArtworks,network.base).catch(error=>ui.toast(error.message));
 if(!previous||world.damageEvents!==previous.damageEvents)damageNumbers.receive(world.damageEvents);
 arena.sync(world,players);
 if(!previous||world.collector!==previous.collector)collectorView.sync(world.collector);
 ui.setWorld(world);ui.showCollectorSale(world.collectorSale,self?.key);ui.showKillEvents(world.killEvents);
  // Monster deaths use the SAME purely visual golden burst as thrown artwork.
  // Server-issued IDs prevent repeats on sync/reconnect; no attack collider.
  for(const death of world.monsterDeathEvents||[]){
   if(!Array.isArray(death.position)||Date.now()-death.time>5000)continue;
   bursts.play(death.position,'monster-death-'+death.id);
  }
 if(arena.monster)statusVisuals.sync(arena.monster,world.monster?.effects);
 for(const {root,state} of arena.islandEnemies.extraLive)statusVisuals.sync(root,state?.effects);const profile=world.profile,dead=profile?.deadUntil>Date.now();
// Follow the SERVER's revive timestamp and spawn instead of relying on
// wasDead: an iOS background tab may miss the five-second death overlay.
if(controller&&!dead&&Number(profile?.lastRespawnAt)>lastAppliedRespawnAt){
 lastAppliedRespawnAt=Number(profile.lastRespawnAt);
 if(Date.now()-lastAppliedRespawnAt<30_000){
  const spawn=Array.isArray(profile.respawnPosition)&&profile.respawnPosition.length===3
   ?profile.respawnPosition:(PLAYER_SPAWNS[self?.seat]||PLAYER_SPAWNS[0]);
  controller.teleport(spawn);
  // Flush the previous (dead-at-edge) client state immediately. The room
  // updates its own session position to the same hub coordinates on revival.
  network.lastStateAt=0;
  if(self?.role==='fighter')network.sendState(controller.state());
 }
}
if(localRoot&&profile){arena.setPlayerEquipment(localRoot,profile.equipment);localRoot.userData.deadUntil=profile.deadUntil||0;applyShieldHit(localRoot,profile);applyHitReaction(localRoot,profile);
 if(profile.whipPull?.id&&profile.whipPull.id!==controller.lastWhipPullId&&
    Date.now()-(profile.whipPull.time||0)<profile.whipPull.durationMs+400){
  // A new poison/bleed hit can replace hitReaction; the pull has its OWN
  // server-authored ID and must still reach the local physics controller.
  controller.lastWhipPullId=profile.whipPull.id;
  controller.stunUntil=0;controller.beginWhipPull(profile.whipPull);
 }
 if(profile.vortexSpin?.id&&profile.vortexSpin.id!==controller.lastVortexSpinId&&
    Date.now()-profile.vortexSpin.time<profile.vortexSpin.durationMs){
  controller.lastVortexSpinId=profile.vortexSpin.id;
  controller.beginVortexSpin(profile.vortexSpin);
 }
 controller.stats=profile.stats||{speed:1,jump:1,gravity:1};statusVisuals.sync(localRoot,profile.effects);if(profile.impulse&&controller.lastImpulse!==profile.impulse.id){controller.lastImpulse=profile.impulse.id;controller.knockback=new THREE.Vector3(...profile.impulse.vector).multiplyScalar(5);}}if(dead){if(!wasDead&&localRoot){bursts.play(localRoot.position,'death-'+self.key+'-'+profile.deadUntil);audio.play('explosion');}wasDead=true;controller?.setEnabled(false);ui.death(profile.deadUntil,profile.lastKilledBy?.name||'');}else if(joined){if(wasDead&&controller){
 const spawn=Array.isArray(profile?.respawnPosition)?profile.respawnPosition:
  (PLAYER_SPAWNS[self.seat]||PLAYER_SPAWNS[0]);
 controller.teleport(spawn);
 network.lastStateAt=0;
 if(self?.role==='fighter')network.sendState(controller.state());
 wasDead=false;ui.toast('RESPAWNED · WRITE HUB');
}if(!ui.panelName&&!artEditor.mode&&!writer.active&&!platformDelete.active)controller?.setEnabled(true);ui.death(0);}if(profile&&self)self.profile=profile;}

async function sendAction(action,data={},options={}){if(!joined||!controller)return null;try{const result=await network.action(action,data);if(result.world)acceptWorldView(result.world);if(result.purchased){const purchased=itemById(result.purchased.itemId);ui.purchaseNotice(purchased?.name||result.purchased.itemId,result.purchased.quantity);}else if(result.notice)ui.toast(result.notice);if(result.resetMessages)ui.clearChat();if(['gm-wing-draw','wing-draw'].includes(action)&&result.wingDraw)ui.showWingDraw(result.wingDraw);if(['gm-wing-remove','gm-wing-set-rate'].includes(action)&&ui.panelName==='wing-manage')ui.renderPanel();if(action==='fuse'&&result.fusion){ui.fusionFeedback(!!result.fusion.success,result.notice);audio.play(result.fusion.success?'fusion-success':'fusion-fail',1);}if(result.attackEvent)showAttack(result.attackEvent);if(result.throwEvent)showThrowPulse(result.throwEvent);if(action==='pickup-coin'||action==='pickup-drop')audio.play('coin');for(const hit of result.structureHits||(result.structureHit?[result.structureHit]:[]))arena.showStructureHit(hit);for(const broken of result.structureDestroyedEvents||(result.structureDestroyed?[result.structureDestroyed]:[]))arena.showStructureBreak(broken);if(result.hit?.defeated)ui.toast(`DEFEATED · ${result.hit.lostCoins} COINS DROPPED`);return result;}catch(error){if(['gm-wing-draw','wing-draw'].includes(action))ui.cancelWingDraw();if(options.throwOnError)throw error;if(action==='fuse')ui.fusionFeedback(false,error.message);if((action==='pickup-artwork'||!/^Move closer to (?:the )?(?:artwork|coin|drop)/i.test(error.message||''))&&performance.now()-toastErrorAt>400){toastErrorAt=performance.now();ui.toast(error.message);}return null;}}

function startBuildPlacement(kind,surface=null,artwork=null){if(self?.role!=='fighter')return ui.toast('SPECTATORS CANNOT BUILD');buildPlacement={kind,surface,artwork,rotation:controller?.root.rotation.y||0,position:controller?.buildPosition(kind==='art-bomb'?3.2:5)||[0,0,0],valid:false};ui.buildKind=kind;document.getElementById('build-kind').textContent=kind==='art-bomb'?'YOUR ARTWORK':kind.toUpperCase();document.getElementById('build-mode').hidden=false;document.activeElement?.blur();if(!writer.active&&!artEditor.mode)controller?.setEnabled(true);ui.toast('MOVE WITH YOUR ARTWORK · R ROTATE · E / PLACE');}
function rotateBuildPlacement(){if(!buildPlacement)return;buildPlacement.rotation+=Math.PI/4;}
async function confirmBuildPlacement(){if(!buildPlacement||!controller)return;if(!buildPlacement.valid)return ui.toast('CANNOT BUILD HERE');const result=buildPlacement.kind==='art-bomb'
 ?await sendAction('publish-art-bomb',{artwork:{title:buildPlacement.artwork?.title,mediaId:buildPlacement.artwork?.mediaId,position:[buildPlacement.position[0],buildPlacement.position[1]+1.5*(buildPlacement.artwork?.size||1),buildPlacement.position[2]],appearance:{labelBackground:buildPlacement.artwork?.labelBackground||'#000000'}},size:buildPlacement.artwork?.size})
 :await sendAction('build',{kind:buildPlacement.kind,surface:buildPlacement.surface,position:buildPlacement.position,rotation:buildPlacement.rotation});
 if(result)cancelBuildPlacement();}
function cancelBuildPlacement(){buildPlacement=null;arena.clearBuildPreview();ui.clearBuildMode();}
function followSpectator(key){if(self?.role!=='spectator')return;const target=key?roots.get(key):null;controller.setFollowTarget(target||null);spectatorFollowIndex=players.filter(player=>player.role==='fighter').findIndex(player=>player.key===key);ui.toast(target?`FOLLOWING ${players.find(player=>player.key===key)?.name||'FIGHTER'}`:'FREE SPECTATOR CAMERA');}
function cycleSpectator(){if(self?.role!=='spectator')return;const fighters=players.filter(player=>player.role==='fighter'&&roots.get(player.key));if(!fighters.length)return followSpectator('');spectatorFollowIndex=(spectatorFollowIndex+1)%fighters.length;followSpectator(fighters[spectatorFollowIndex].key);}

function performAttack(charge=0,phase=null){
 if(wallPainter.active)return;
 if(controller?.status?.freeze||world?.profile?.effects?.paralysis?.until>Date.now())return;
 if(!controller?.enabled||performance.now()<(controller.stunUntil||0)||self?.role!=='fighter'||ui.panelName)return;
 const item=itemById(world?.profile?.equipment?.weapon)||itemById('water');
 // Centralized guard covers UI A/Q, canvas clicks, auto-charge and fusion.
 if(item.id==='black-cat'&&gun.mode!==2)return;
 if(item.id==='goldfish'&&gun.mode!==1&&charge<1)return;
 // Unscoped goldfish ultimate follows the camera forward ray; an 11m
 // third-person muzzle intersection can otherwise aim behind the avatar.
 const goldfishUltimate=item.id==='goldfish'&&charge>=1&&gun.mode===0;
 const shot=item.firstPerson&&!goldfishUltimate?gun.shot():null;
 const muzzle=isChannelStaff(item)||item.family==='saber'||item.id==='calico-cat'?arena.presentation.vfx.channelMuzzle(localRoot,item):null;
 const direction=goldfishUltimate?cameraAimDirection(camera).toArray():
  shot?.direction||attackDirection(controller,camera,arena,roots,item,charge,muzzle);
 return sendAction('attack',{direction,charge,...(phase?{phase}:{}),
  ...(item.id==='black-cat'?{scoped:true}:{}),
  ...(muzzle?{origin:muzzle.toArray()}:{}),...(shot||{})});
}
function performInteract(target=null){if(!controller||self?.role!=='fighter')return;const held=Object.entries(world?.artworks||{}).find(([,art])=>art.holder===self.key);if(held){artworkThrow.begin();return;}const near=target||arena.nearest(controller.root.position.toArray());if(!near)return;if(near.type==='plant')return;if(near.type==='coin')sendAction('pickup-coin',{platformId:near.id});if(near.type==='drop')sendAction('pickup-drop',{dropId:near.id});if(near.type==='artwork')sendAction('pickup-artwork',{platformId:near.id});}

let screenShakeUntil=0;
const heardStompLandings=new Set();
function update(dt,time,movementDt=dt){
  if(queuedWorld){const pending=queuedWorld;queuedWorld=null;acceptWorldView(pending);}
  damageNumbers.update(camera,innerWidth,innerHeight);vitalModels?.update(time,world?.profile?.hp||0,world?.profile?.maxHp||100);
  if(joined)minimap.update(time,roots,self?.key,world?.monster,world?.monsters||[],world?.collector);
  if(joined&&controller){
   const nowMs=Date.now(),debuffs=world?.profile?.effects||{};
   controller.status={freeze:(debuffs.freeze?.until||0)>nowMs||(debuffs.stun?.until||0)>nowMs,
      root:(debuffs.root?.until||0)>nowMs,
      confuse:(debuffs.confuse?.until||0)>nowMs,
      dazzle:(debuffs.dazzle?.until||0)>nowMs,
      paralysis:(debuffs.paralysis?.until||0)>nowMs};
   if(controller.status.paralysis&&(attackHeld||staffChannel))ui.emit('attack-cancel');
   // Desktop channel casts steer the camera with relative mouse movement
    // even without holding a mouse button. Mobile touch remains unchanged.
    controller.channelAiming=!!(attackHeld&&isChannelStaff(itemById(world?.profile?.equipment?.weapon)));
    writer.update();plantHover.update();controller.castMoveFactor=staffChannel?CAST_MOVE_FACTOR:1;const wasGrounded=controller.grounded;
    // Simulate movement in short physics slices using WALL-CLOCK elapsed
    // time. The previous global 50ms cap made gameplay run in slow motion
    // after each shader compile or destruction hitch, then fight the Worker.
  // Only move after authority has accepted this seat's spawn. HTTP join is
  // allowed to paint the scene before WS opens, but cannot advance the pose.
  controller.awaitingSpawn=self?.role==='fighter'&&!network.spawnConfirmed;
  const simulationDt=Math.max(0,Math.min(.24,movementDt));
    const substeps=Math.max(1,Math.ceil(simulationDt/(1/40)));
    let state;
    for(let step=0;step<substeps;step++)state=controller.update(simulationDt/substeps);
    if(!wasGrounded&&controller.grounded)audio.play('land',.95);arena.setPlayerAnimation(localRoot,state.animation);if(!(writer.active&&writer.legacy)&&self?.role==='fighter')network.sendState(state);for(const [key,target] of remoteTargets){const root=roots.get(key);if(!root)continue;root.position.lerp(target.position,1-Math.exp(-dt*11));root.rotation.y=lerpAngle(root.rotation.y,target.rotation,1-Math.exp(-dt*12));arena.setPlayerAnimation(root,target.animation);}const near=arena.nearest(localRoot.position.toArray()),holding=Object.values(world?.artworks||{}).some(art=>art.holder===self.key);if(!holding&&artworkThrow.started!==null)artworkThrow.cancel();controller.holdingArt=holding;ui.setNear(near,holding);if(buildPlacement){buildPlacement.position=controller.buildPosition(buildPlacement.kind==='art-bomb'?3.2:5);buildPlacement.valid=(buildPlacement.kind==='art-bomb'?canPlaceArtworkAt:canBuildAt)(world,controller.root.position.toArray(),buildPlacement.position);arena.setBuildPreview(buildPlacement.kind,buildPlacement.position,buildPlacement.rotation,buildPlacement.valid,buildPlacement.artwork?.size||1,buildPlacement.artwork?.previewFile||null);}if(self?.role==='fighter'&&performance.now()-lastAutoCoinAt>300){const p=localRoot.position;const coin=PLATFORMS.find(c=>world?.coins?.[c.id]?.available&&Math.hypot(p.x-c.coinPosition[0],p.z-c.coinPosition[2])<2.8&&Math.abs(p.y-c.coinPosition[1])<3.1),drop=world?.groundDrops?.find(d=>p.distanceTo(new THREE.Vector3(...d.position))<2.2&&(d.kind!=='heart'||world.profile.hp<world.profile.maxHp)&&!(d.owner===self.key&&Date.now()<d.ownerLockedUntil));if(coin||drop){lastAutoCoinAt=performance.now();if(coin)sendAction('pickup-coin',{platformId:coin.id});else sendAction('pickup-drop',{dropId:drop.id});}}const profile=world?.profile;if(profile?.deadUntil>Date.now())ui.death(profile.deadUntil,profile.lastKilledBy?.name||'');}
  platformDelete.update();
  collectorView.update(time,camera);
  statusVisuals.update(dt);
  const castingItem=itemById(world?.profile?.equipment?.weapon);
  if(localRoot){
   localRoot.userData.staffCasting=!!(attackHeld&&isChannelStaff(castingItem));
   // Render the live native #08 / #29 on the EXACT ray that the next
    // authoritative cast will transmit, not on the old screen-center ray.
    const muzzle=castingItem&&isChannelStaff(castingItem)?arena.presentation.vfx.channelMuzzle(localRoot,castingItem):null;
    localRoot.userData.staffAimDirection=castingItem&&isChannelStaff(castingItem)&&controller
     ?attackDirection(controller,camera,arena,roots,castingItem,1,muzzle)
     :cameraAimDirection(camera).toArray();
    const curved=!!(castingItem&&['lightning','beam'].includes(castingItem.family)&&
     isChannelStaff(castingItem)&&controller&&muzzle);
    if(curved){
     const forward=new THREE.Vector3(...localRoot.userData.staffAimDirection).normalize();
     // Read the SAME movement vector used by PlayerController's keyboard or
     // touch joystick, projected perpendicular to the live camera ray.
     // Leftward input produces a negative bend, rightward a positive bend.
     localRoot.userData.staffStrafe=lateralBeamInput(
      controller.direction,forward,controller.speed>.02&&controller.enabled);
     const targets=[];
     const monsters=[world?.monster,...(world?.monsters||[])];
     for(const enemy of monsters)if(enemy?.active&&Array.isArray(enemy.position))
      targets.push(new THREE.Vector3(...enemy.position).add(new THREE.Vector3(0,1.1,0)));
     for(const [key,root] of roots)if(root!==localRoot&&root.visible&&
      players.some(p=>p.key===key&&p.role==='fighter'))
      targets.push(root.position.clone().add(new THREE.Vector3(0,1.05,0)));
     const end=targetOnBeam(muzzle,forward,
      Math.max(2,Math.min(18,Number(castingItem.range)||18)),targets,1.6);
     localRoot.userData.staffTargetPoint=end?.toArray()||null;
    }else{
     localRoot.userData.staffStrafe=0;
     localRoot.userData.staffTargetPoint=null;
    }
  }
  arena.update(dt,time,camera,roots);
  // The outbound/returning giraffe is the actual thrown weapon. Do not
  // keep a duplicate giraffe in its wielder's hand during the 2.3s flight.
  for(const actor of roots.values())if(actor.userData?.blade&&
   actor.userData?.equipment?.weapon==='giraffe'||
   actor.userData?.blade&&actor.userData?.giraffeHideUntil){
   if(actor.userData.blade)actor.userData.blade.visible=
    !(performance.now()<(actor.userData.giraffeHideUntil||0));
  }
  for(const mob of [world?.monster,...(world?.monsters||[])])for(const skill of mob?.skills||[]){
   if(skill.motion!=='stomp'||skill.phase!=='active'||nowMs<skill.start+(skill.end-skill.start)*.76||heardStompLandings.has(skill.id))continue;
   heardStompLandings.add(skill.id);if(heardStompLandings.size>128)heardStompLandings.delete(heardStompLandings.values().next().value);
   if(localRoot&&Math.hypot(localRoot.position.x-skill.aim[0],localRoot.position.z-skill.aim[2])<48){audio.play('stomp',.8);audio.play('ground-crack',.95);}
  }
  updateKnockdowns();arena.remoteAimTargets=[...roots.values()].filter(r=>r!==localRoot);for(const [key,root] of roots){const dead=root.userData.deadUntil>Date.now();if(dead&&!root.userData.burstDead){bursts.play(root.position,'death-'+key+'-'+root.userData.deadUntil);if(root!==localRoot)audio.play('explosion',.35);}root.userData.burstDead=dead;root.visible=!dead&&performance.now()>=(root.userData.plantHiddenUntil||0)&&(key===self?.key?self.role==='fighter':root.visible||players.find(p=>p.key===key)?.role==='fighter');}updatePlayerSpeech();artworkThrow.update();bursts.update(dt,renderer.domElement.height);for(const root of roots.values())faceHealthBar(root,camera);if(arena.monster&&world?.monster){setHealthBar(arena.monster,world.monster.hp,world.monster.maxHp,ENEMY_HEIGHT+.65);faceHealthBar(arena.monster,camera);}gun.update();gun.pose(arena.presentation);
  const heldItem=itemById(world?.profile?.equipment?.weapon)||itemById('clam');
  if(attackHeld&&attackHoldStarted!==null&&chargeStarted===null&&!chargeRequest&&
     performance.now()-attackHoldStarted>=STAFF_TAP_MAX_MS)startHeldCharge();
  const charge=chargeStarted===null?0:Math.min(1,(performance.now()-chargeStarted)/(heldItem?.chargeMs||1500));
  // First 500ms is a tap window, then progress becomes visible from 0%. No staff may continuously cast during
  // the charging window; the very first sustained pulse is the ultimate.
  if(attackHeld&&charge>=1&&isChannelStaff(heldItem)&&heldItem?.family!=='ice'&&!staffChannel)
   beginStaffChannel();
  if(staffChannel){
   if(!attackHeld||!isChannelStaff(heldItem)||heldItem.id!==staffChannel.weapon||!controller.enabled){
    const pending=staffChannelPromise;staffChannel=null;++staffChannelSerial;
    void sendAction('attack',{phase:'channel-stop'});void Promise.resolve(pending).then(result=>{if(result?.channeling)return sendAction('attack',{phase:'channel-stop'});});
   }else if(staffChannel.ready&&!staffChannelBusy&&performance.now()-staffChannelShotAt>=channelInterval(heldItem)+45){
    staffChannelShotAt=performance.now();staffChannelBusy=true;
    void Promise.resolve(performAttack(1,'channel')).finally(()=>{staffChannelBusy=false;});
   }
  }
   // Show +1 on every frame-clock second of a server-approved flower
   // channel, including at full HP and without requiring state broadcasts.
   const healNow=Date.now();
   if(staffChannel?.ready&&heldItem?.family==='petal'&&localRoot&&
      Number(world?.profile?.hp)>0&&!(world?.profile?.deadUntil>healNow)){
    if(healNow-lastHealVisualAt>=1000){
     lastHealVisualAt=healNow;
     damageNumbers.receive([{id:++healVisualSeq,time:healNow,kind:'heal',amount:1,
      position:[localRoot.position.x,localRoot.position.y+2.15,localRoot.position.z]}]);
    }
   }else lastHealVisualAt=0;
  if(charge>=1&&!isChannelStaff(heldItem)&&heldItem?.autoCharge&&!autoChargeBusy){
   autoChargeBusy=true;const pending=chargeRequest;chargeStarted=null;
   Promise.resolve(pending).then(async()=>{await performAttack(1);if(attackHeld&&controller?.enabled&&!ui.panelName){chargeStarted=performance.now();chargeRequest=sendAction('attack',{phase:'charge'});}}).finally(()=>autoChargeBusy=false);
  }
  arena.presentation.charging(localRoot,charge);
  const chargedWeapon=itemById(world?.profile?.equipment?.weapon);
  if(charge>.08&&!staffChannel&&chargedWeapon&&controller){
   const muzzle=isChannelStaff(chargedWeapon)||chargedWeapon.family==='saber'?arena.presentation.vfx.channelMuzzle(localRoot,chargedWeapon):null;
   const direction=chargedWeapon.id==='goldfish'&&gun.mode===0?cameraAimDirection(camera).toArray():
     chargedWeapon.firstPerson?gun.shotDirection().toArray():attackDirection(controller,camera,arena,roots,chargedWeapon,1,muzzle);
   chargePreview.update(localRoot,chargedWeapon,charge,direction,arena,world?.profile?.fusion?.[chargedWeapon.id]||null,muzzle?.toArray(),dt);
  }else chargePreview.hide();
  const attackButton=document.getElementById('attack-button');attackButton.classList.toggle('charging',charge>0||!!staffChannel||artworkThrow.started!==null);attackButton.style.setProperty('--charge',`${(artworkThrow.started!==null?artworkThrow.progress:charge)*100}%`);artEditor.update();for(let i=effects.length-1;i>=0;i--){const effect=effects[i];effect.age+=dt;effect.material.opacity=Math.max(0,1-effect.age/effect.duration);effect.scale.setScalar(1+effect.age*3);if(effect.age>=effect.duration){effect.removeFromParent();effect.geometry.dispose();effect.material.dispose();effects.splice(i,1);}}
}

let lastFrameFaultAt=0;
function frame(now){requestAnimationFrame(frame);const elapsed=now-last,dt=Math.min(.10,elapsed/1000);last=now;if(!assetsReady)return;const started=performance.now();
 // An unexpected model/animation exception cannot prevent the render pass.
 // Individual effects are also contained at source; this is a final guard.
 if(now>externalUntil)try{update(dt,now/1000,Math.min(.24,elapsed/1000));}catch(error){
  if(now-lastFrameFaultAt>2000){lastFrameFaultAt=now;console.error('Gameplay update fault; render frame preserved',error);}
 }
 const updated=performance.now();refreshEquipmentPortrait();vhs.setDizzy(world?.profile?.effects?.dazzle?.until>Date.now()?1:0);const shake=Math.max(0,(screenShakeUntil-performance.now())/350),savedPosition=shake>0?camera.position.clone():null;if(shake>0){camera.position.x+=(Math.random()-.5)*shake*.16;camera.position.y+=(Math.random()-.5)*shake*.10;}vhs.render(scene,camera,performance.now()/1000,(gl,world,view)=>arena.presentation.vfx.numberedEffects.render(gl,world,view),arena.presentation.vfx.numberedEffects.hasFullScreenPostprocess());if(savedPosition)camera.position.copy(savedPosition);const ended=performance.now();for(const [key,value] of [['frame',elapsed],['logic',updated-started],['submit',ended-updated]]){performanceSamples[key].push(value);if(performanceSamples[key].length>240)performanceSamples[key].shift();}frameSamples.push(elapsed);if(frameSamples.length>180)frameSamples.shift();fpsFrames++;if(now-fpsAt>1000){fps=fpsFrames*1000/(now-fpsAt);fpsFrames=0;fpsAt=now;}}
requestAnimationFrame(frame);

const heardAttacks=new Set();function showAttack(event){if(!heardAttacks.has(event.id)){heardAttacks.add(event.id);if(heardAttacks.size>128)heardAttacks.delete(heardAttacks.values().next().value);const item=itemById(event.weapon),gain=event.owner===self?.key?1:.38;audio.playWeapon(item,gain,!!event.ultimate);if(event.owner===self?.key&&(item?.firstPerson||item?.id==='calico-cat'))gun.kick(item);if(event.ultimate){audio.play('ultimate',gain*.45);if(['fire','pan','swatter','lightning','wave','beam','planter','palm'].includes(item?.family)||Number(event.area?.radius)>1.5)audio.play('explosion',gain*.95);}}arena.presentation.play(event,roots.get(event.owner));}
function showThrowPulse(event){artworkThrow.queue(event);}
function applyEditorSettings(next){renderer.setPixelRatio(Math.min(devicePixelRatio,next.pixelRatio));renderer.setSize(innerWidth,innerHeight,false);scene.fog.density=next.fog;arena.artFloat=next.artFloat;}
function loadEditorSettings(){try{return JSON.parse(localStorage.getItem('temple-editor-settings')||'{}');}catch{return {};}}
function lerpAngle(a,b,t){let d=(b-a+Math.PI)%(Math.PI*2)-Math.PI;if(d<-Math.PI)d+=Math.PI*2;return a+d*t;}
function distance2d3(a,b){return Math.hypot(a[0]-b[0],a[2]-b[2]);}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);});
addEventListener('pagehide',()=>network.close());

window.render_game_to_text=()=>JSON.stringify({mode:joined?'play':'entry',name:self?.name||null,role:self?.role||null,connected:network.socket?.readyState===WebSocket.OPEN,position:controller?.root.position.toArray().map(n=>+n.toFixed(2))||null,players:players.map(p=>({name:p.name,role:p.role,seat:p.seat})),economy:{wallet:world?.profile?.wallet??null,inventory:world?.profile?.inventory?.length||0,groundDrops:world?.groundDrops?.length||0,platformCoins:Object.values(world?.coins||{}).filter(c=>c.available).length,platformCoinTotal:Object.keys(world?.coins||{}).length},artworks:{total:arena.artworks.size,available:Object.values(world?.artworks||{}).filter(a=>!a.holder&&Date.now()>=(a.availableAt||0)).length},monster:world?.monster?.active?{variant:world.monster.variant,hp:world.monster.hp}:null,render:{fps:+fps.toFixed(1),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),gunMode:gun.mode,frameMs:+(frameSamples.reduce((a,b)=>a+b,0)/Math.max(1,frameSamples.length)).toFixed(2)},movementSync:{sent:network.stateSequence,acked:network.lastAcceptedSequence,
  rejections:network.rejectionCounts,recent:network.motionDiagnostics},editorShortcut:'Shift+Y'});
window.advanceTime=milliseconds=>{externalUntil=performance.now()+120;const steps=Math.ceil(milliseconds/16.6667);for(let i=0;i<steps;i++)update(Math.min(.05,milliseconds/steps/1000),(performance.now()+i*milliseconds/steps)/1000);vhs.render(scene,camera,performance.now()/1000);};
if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname))window.templeTest={writer,plantHover,audio,bursts,artworkThrow,arena,camera,renderer,ui,gun,editor:artEditor,platformDelete,portraitViewport,controller:()=>controller,network,roots,items:ITEMS,slots:EQUIPPABLE_SLOTS,performanceSamples,vitals:()=>vitalModels,hit:applyHitReaction,channelDebug:()=>({attackHeld,chargeStarted,chargeRequest:!!chargeRequest,staffChannel:staffChannel?{...staffChannel}:null,staffChannelBusy,staffChannelShotAt,enabled:controller?.enabled,role:self?.role,weapon:world?.profile?.equipment?.weapon,joined,panel:ui.panelName,now:performance.now(),attemptAge:performance.now()-(window._templeLastChannelAttempt||0),beamStartScheduled:beamStartTimer!==null,channelEligible:isChannelStaff(itemById(world?.profile?.equipment?.weapon)),paralysisUntil:world?.profile?.effects?.paralysis?.until||0,lastFrameFaultAt})};
import {PLATFORMS} from './shared/arena.js';
