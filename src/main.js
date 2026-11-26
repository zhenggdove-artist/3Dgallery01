import {terrainStyle,TERRAIN_DEFAULTS} from './shared/terrain-style.js';
import {bindWantedList,syncWantedButton} from './wanted-list.js';
import {tunedEquipment,weaponManaQuote,restorativeCooldown} from './shared/equipment-tuning.js';
import {equippedItem} from './shared/fusion-adapter.js';
import {mergeWingCatalog,reuseHttpSceneFields} from './shared/world-patch.js';
import {registerCustomWings,SHOP_CATALOG_REVISION} from './shared/catalog.js';
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
import {castBaseOrigin} from './shared/charge-area.js';
import {lateralBeamInput,targetOnBeam} from './native-beam-curve.js';
import {isChannelStaff,isStaffTap,channelInterval,chargeProgress,STAFF_TAP_MAX_MS,CAST_MOVE_FACTOR} from './shared/weapon-abilities.js';
import {uploadArtwork} from './artwork-upload.js';
import {VitalModels} from './vital-models.js';
import {createVHS} from './reletter-vhs.js';
import {TempleArena} from './arena-view.js';
import {TempleNetwork,requestStaffChannelStop} from './network.js';
import {PlayerController} from './player-controller.js';
import {STAFF_RAISE_SECONDS} from './staff-raise-pose.js';
import {TempleUI} from './ui.js';
import {PLAYER_SPAWNS} from './shared/arena.js';
import {canBuildAt,canPlaceArtworkAt} from './shared/temple-rules.js';
import {itemById,ITEMS,EQUIPPABLE_SLOTS} from './shared/catalog.js';
import {warmItemPreviews,setOutfitPreviewCharacter} from './item-preview.js';
import {GPUFrameQueue} from './gpu-frame-queue.js';
import {ArtworkEditor} from './artwork-editor.js';
import {applyArtworkAppearance} from './artwork-surface.js';
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
let tunedWeaponBase=null,tunedWeaponFusion=null,tunedWeaponOverrides=null,tunedWeaponValue=null;
function currentTunedWeapon(){
 const p=world?.profile,base=itemById(p?.equipment?.weapon);if(!base||!p)return base;
 const fusion=p.fusion?.[base.id],overrides=world.equipmentTuning;
 if(base!==tunedWeaponBase||fusion!==tunedWeaponFusion||overrides!==tunedWeaponOverrides){
  tunedWeaponBase=base;tunedWeaponFusion=fusion;tunedWeaponOverrides=overrides;
  tunedWeaponValue=tunedEquipment(world,equippedItem(p,base));
 }
 return tunedWeaponValue;
}
let artBombUploading=false;let assetsReady=false,joined=false,self=null,world=null,players=[],controller=null,localRoot=null,wasDead=false,last=performance.now(),externalUntil=0,toastErrorAt=0,lastAutoCoinAt=0,frameSamples=[],fps=0,fpsFrames=0,fpsAt=performance.now(),buildPlacement=null,spectatorFollowIndex=-1;
const roots=new Map(),remoteTargets=new Map(),effects=[],pendingAutoPickups=new Set();
let heldArtworkSource=null,heldArtworkOwner=null,heldArtworkCached=false;
function hasHeldArtwork(artworks,owner){
 if(heldArtworkSource!==artworks||heldArtworkOwner!==owner){heldArtworkSource=artworks;heldArtworkOwner=owner;heldArtworkCached=Object.values(artworks||{}).some(art=>art.holder===owner);}
 return heldArtworkCached;
}
function autoPickup(action,id,field){
 const key=action+':'+id;if(pendingAutoPickups.has(key))return;
 pendingAutoPickups.add(key);void sendAction(action,{[field]:id}).finally(()=>pendingAutoPickups.delete(key));
}
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
function stopInsufficientCharge(){
 attackHeld=false;attackHoldStarted=null;chargeStarted=null;chargeRequest=null;lastWarnedCast=null;clearChargeDelay();chargePreview.hide();
 if(localRoot){localRoot.userData.staffCasting=false;localRoot.userData.staffCastingUntil=0;}
 ui.toast('NOT ENOUGH MANA');
}
function startHeldCharge(){
 if(!attackHeld||attackHoldStarted===null||chargeStarted!==null||chargeRequest||staffChannel||
    !controller?.enabled||performance.now()<nextChargeRetryAt)return;
 // Goldfish changes camera on a tap, but its original giant red fish
 // ultimate must remain chargeable ONLY before entering shoulder mode.
 if(currentTunedWeapon()?.id==='goldfish'&&gun.mode!==0)return;
 if(currentTunedWeapon()?.id==='black-cat')return;
 const item=currentTunedWeapon();
 if(!item||!world?.profile)return;
 const quote=weaponManaQuote(world,item,world.profile.fusion?.[item.id]);
 if(Number(world.profile.mana)+1e-6<quote.initial){stopInsufficientCharge();return;}
 const started=performance.now(),hold=attackHoldStarted;
 // Do not render the warning until the server has approved charge.
 chargeRequest=sendAction('attack',{phase:'charge'},{throwOnError:true}).then(result=>{
  if(result?.charging&&attackHeld&&attackHoldStarted===hold)chargeStarted=started;
  else if(attackHeld&&attackHoldStarted===hold){chargeStarted=null;chargeRequest=null;nextChargeRetryAt=performance.now()+350;}
  return result;
 }).catch(error=>{
  if(attackHeld&&attackHoldStarted===hold){
   if(/not enough mana/i.test(error.message||''))stopInsufficientCharge();
   else{chargeStarted=null;chargeRequest=null;nextChargeRetryAt=performance.now()+350;ui.toast(error.message);}
  }
  return null;
 });
 audio.play('charge',.62);
 // Original vendor #08 and #29 now become visible on the FIRST channel pulse.
 // Do not wait for a future render frame to request that pulse: slow mobile
 // GPU compilation can starve the rAF-driven transition for several seconds.
 const weapon=currentTunedWeapon();
 if(weapon&&['lightning','beam'].includes(weapon.family))
  scheduleBeamChannelStart((Number(weapon.chargeMs)||1500)+75);
}
let staffChannel=null,staffChannelPromise=null,staffChannelBusy=false,staffChannelShotAt=0,staffChannelSerial=0;
function beginStaffChannel(){
 const item=currentTunedWeapon();
 const now=performance.now();
 if(!attackHeld||!chargeStarted||!isChannelStaff(item)||item?.family==='ice'||staffChannel||
    !controller?.enabled||self?.role!=='fighter'||ui.panelName||
    world?.profile?.effects?.paralysis?.until>Date.now()||now-(window._templeLastChannelAttempt||0)<=170)return;
 const elapsed=now-chargeStarted,chargeMs=Number(item?.chargeMs)||1500;
 if(elapsed<chargeMs)return;
 window._templeLastChannelAttempt=now;
 const serial=++staffChannelSerial,firstCast=captureReleasedCast(item,1);
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
   if(!staffChannelBusy){
    staffChannelShotAt=performance.now();
    staffChannelBusy=true;
    void Promise.resolve(performAttack(1,'channel',firstCast)).catch(error=>{if(/not enough mana|channel is not active/i.test(error.message||'')&&staffChannel){staffChannel=null;attackHeld=false;chargeStarted=null;arena.presentation.vfx.stopChannel(localRoot);ui.toast('NOT ENOUGH MANA');void sendAction('attack',{phase:'channel-stop'});}}).finally(()=>{staffChannelBusy=false;});
   }
  }else if(staffChannel?.serial===serial){
   staffChannel=null;
   // Server charge start can lag the client clock. Retry the actual state
   // transition without depending on rendering/fps; never fake an attack.
   if(Number(world?.profile?.mana)<weaponManaQuote(world,equippedItem(world.profile,itemById(item.id)||item),world?.profile?.fusion?.[item.id]).initial){attackHeld=false;chargeStarted=null;ui.toast('NOT ENOUGH MANA');void sendAction('attack',{phase:'channel-stop'});}
   else if(attackHeld)
    scheduleBeamChannelStart(260);
  }
  return result;
 });
}

const writer=new WriteCinematic({scene,controller:()=>controller,arena,ui,send:sendAction,audio,bursts,upload:file=>uploadMedia(network,file)});
const plantHover=bindPlantHover({canvas,camera,arena,controller:()=>controller,ui});
ui.addEventListener('write-start',()=>writer.begin());
const gun=new GunController({canvas,camera,controller:()=>controller,weapon:()=>currentTunedWeapon(),ui,attack:performAttack});
const artEditor=new ArtworkEditor({scene,camera,canvas,arena,player:()=>localRoot,isGM:()=>!!self?.profile?.admin,ownerKey:()=>self?.key,focusArtwork:root=>{if(!controller)return;controller.artworkEditTarget=root;if(root){controller.target.copy(root.position);controller.yaw=root.rotation.y;controller.pitch=.05;controller.updateCamera(1,true);camera.updateMatrixWorld(true);}},send:sendAction,control:enabled=>{if(controller){controller.setEnabled(enabled&&!ui.panelName&&!wasDead);controller.cameraLocked=!!artEditor.mode&&artEditor.mode!=='follow';}},toast:text=>ui.toast(text)});
const platformDelete=new PlatformDeleteEditor({canvas,camera,arena,ui,editor:artEditor,isGM:()=>!!self?.profile?.admin,send:sendAction,controller:()=>controller,cancelBuild:cancelBuildPlacement});
const wallPainter=new CityWallPainter({canvas,camera,arena,controller:()=>controller,
 role:()=>self?.role,ui,send:(action,data)=>sendAction(action,data,{throwOnError:true}),
 beforeStart:()=>{gun.end();ui.emit('attack-cancel');}});

// Shared capture-phase MIDDLE-MOUSE orbit for player BUILD/PAINT and
// GM disc / artwork editing. Left-button picking, painting, and gizmos are
// untouched. Pointer capture continues the orbit beyond the canvas edge.
let editMiddleOrbit=null;
const canEditMiddleOrbit=()=>!!controller&&(
 !!(buildPlacement||wallPainter.active||ui.panelName==='build'||artEditor.selected)||
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
 let canvas=document.getElementById('bag-portrait');
 if(canvas?.dataset.portraitRetired){const replacement=canvas.cloneNode(false);delete replacement.dataset.portraitRetired;canvas.replaceWith(replacement);ui.bagPortraitCanvas=canvas=replacement;}
 if(ui.panelName!=='bag'||ui.bagCategory!=='equipment'||!canvas?.isConnected){if(portraitViewport.renderer)portraitViewport.close();return;}
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
  try{const [published,layout]=await Promise.all([fetch('./temple-layout.json').then(r=>r.ok?r.json():{}),fetch('./temple-artwork-layout.json').then(r=>r.json())]);Object.assign(settings,published.settings||{},loadEditorSettings());arena.defaultLayout=layout.artworkLayout||{};timings.configMs=performance.now()-started;const assetStart=performance.now();await Promise.all([arena.load((value,label)=>ui.setLoading(value,label)),document.fonts.load('bold 48px GoldenGirdle')]);vitalModels=new VitalModels(arena.coinMesh.geometry,arena.coinMesh.material);timings.assetsMs=performance.now()-assetStart;ui.setLoading(.9,'Preparing 00GameDevs weapon effects');const warmStart=performance.now();timings.effects=await arena.presentation.vfx.warm(renderer,camera);timings.effectsMs=performance.now()-warmStart;ui.setLoading(.905,'Pre-rendering complete equipment for SHOP and BAG');setOutfitPreviewCharacter(arena.characterAsset?.scene);timings.previews=await warmItemPreviews(ITEMS,(done,total)=>ui.setLoading(.905+.032*done/Math.max(1,total),'Pre-rendering full equipment '+done+'/'+total));ui.setLoading(.94,'Prewarming all monster jump and dash animations');try{timings.monsterRigs=await arena.islandEnemies.warmModels(renderer,camera);}catch(error){console.warn('Monster rig prewarm incomplete',error);}ui.setLoading(.95,'Prewarming monster landing shockwaves');try{await arena.islandEnemies.attackEffects.warm(renderer,camera);}catch(error){console.warn('Monster VFX shader prewarm incomplete',error);}applyEditorSettings({pixelRatio:settings.pixelRatio||(coarse?1:1.35),fog:settings.fog??.0008,artFloat:settings.artFloat??.17});camera.position.set(0,13,30);camera.lookAt(0,2,0);ui.setLoading(.99,'Preparing scene shaders');const compileStart=performance.now();await renderer.compileAsync(scene,camera);await chargePreview.warm(renderer,camera);try{await arena.warmGroundDropPrograms(renderer,camera);}catch(error){console.warn('Ground loot shader prewarm incomplete',error);}try{await statusVisuals.warmModelTints(renderer,camera,scene,[...arena.islandEnemies.models.values(),arena.characterAsset.scene]);}catch(error){console.warn('Elemental filter shader prewarm incomplete',error);}await arena.outerCity?.warmEffects(renderer,camera);timings.sceneCompileMs=performance.now()-compileStart;timings.totalMs=performance.now()-started;ui.setLoading(1,'100% · Ready');assetsReady=true;ui.ready();void initializeGoogleAuth();}
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
    ui.setFirebaseLoginStatus(false,'Account verified. Loading your character…');
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
    // A failed game connection must not open another Google account chooser.
    const token=ui.firebaseIdToken||await signInWithGoogle();
     ui.confirmGoogleIdentity(token);
     await completeFirebaseLogin(token);
  }catch(error){
    const message=error?.code==='auth/popup-closed-by-user'?'Google sign-in window was closed':
      error?.code==='auth/popup-blocked'?'Allow your browser to open the Google sign-in window':
      error?.message||'Google sign-in failed';
    ui.joinError(message);
    ui.setFirebaseLoginStatus(true,message);
  }
});
bindWantedList(ui,network,async destination=>{if(!controller||!destination?.position)throw Error('Artwork navigation unavailable');controller.setFollowTarget(null);controller.artworkEditTarget=null;controller.teleport(destination.position);controller.root.rotation.y=destination.rotation;controller.yaw=destination.rotation+Math.PI;controller.pitch=.2;controller.target.copy(controller.root.position);const exhibit=arena.artworks.get(destination.id);const bounds=new THREE.Box3();if(exhibit){exhibit.updateMatrixWorld(true);bounds.setFromObject(exhibit);}if(bounds.isEmpty()){const p=new THREE.Vector3(...destination.lookAt);bounds.set(p.clone().addScalar(-2),p.clone().addScalar(2));}controller.frameWantedArtwork(bounds,destination.rotation);controller.updateCamera(1,true);network.lastCorrectedSequence=network.stateSequence;network.sentStates.clear();network.lastStateAt=0;if(self?.role==='fighter')network.sendState(controller.state());},(action,data)=>sendAction(action,data,{throwOnError:true}));
ui.addEventListener('join',async event=>{
   if(event.detail?.mode==='guest'&&ui.googleAuthenticated)
     return ui.joinError('Google account already selected. Enter with Google instead.');
   if(joined||ui.joining)return;
   if(!assetsReady)return ui.joinError('Temple assets are still loading');audio.unlock(false);ui.joinBusy(true);try{network.setBackend(event.detail.backendUrl);const data=await network.join(event.detail);registerCustomWings(data.world?.customWings);arena.world=data.world;self=data.self;world=data.world;players=data.players||[];
    // Keep login visible until every existing custom artwork is decoded and mounted.
    const enterButton=document.getElementById(ui.pendingLoginMode==='guest'?'guest-enter':'enter-button');enterButton.textContent='Loading gallery…';
    let snapshot=data.world;for(let pass=0;pass<5;pass++){arena.world=snapshot;await arena.loadCustomArtworks(snapshot.customArtworks||[],network.base);const latest=await network.request('/api/world',{timeoutMs:20000});if(JSON.stringify(latest.world.customArtworks||[])===JSON.stringify(snapshot.customArtworks||[])){data.world=latest.world;data.self=latest.self;data.players=latest.players;break;}if(pass===4)throw Error('Gallery changed during loading; enter again');snapshot=latest.world;}
    world=data.world;self=data.self;players=data.players||[];arena.world=world;registerCustomWings(world.customWings||[]);
    if(world.customArtworks?.length){enterButton.textContent='Preparing artwork textures…';const textures=new Set();for(const art of world.customArtworks){const root=arena.artworks.get(art.id);if(!root)throw Error('Artwork not ready: '+art.title);root.traverse(o=>{for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[])for(const value of Object.values(material))if(value?.isTexture)textures.add(value);});}for(const texture of textures)renderer.initTexture(texture);await renderer.compileAsync(scene,camera);}
    joined=true;lastHealVisualAt=0;ui.enter(data);createLocalPlayer(data);syncPlayers();syncWorld();audio.startMusic();
    void resumeWingCheckout(network,ui);
    // Chat starts empty on every login; only post-login realtime messages appear.
    }
  catch(error){if(!joined&&network.token){network.close();network.token='';self=null;world=null;players=[];queuedWorld=null;}ui.joinError(error.message);}
});

function acceptWorldView(next,httpSnapshot=false){
 if(!next||!joined)return false;
 const existing=world?.customWings||[];
 const wings=mergeWingCatalog(existing,Array.isArray(next.customWings)?next.customWings:[]);
 if(world&&Number.isFinite(world.revision)&&Number.isFinite(next.revision)&&next.revision<=world.revision){
  if(wings!==existing){registerCustomWings(wings);world={...world,customWings:wings};syncWorld();if(ui.panelName==='bag')ui.renderPanel();}
  return false;
 }
 if(wings!==existing)registerCustomWings(wings);if(httpSnapshot)next=reuseHttpSceneFields(world,next);world={...next,customWings:wings};syncWorld();return true;
}
network.addEventListener('welcome',event=>{if(!joined)return;const data=event.detail;self={...self,...data.self};players=data.players;syncPlayers();acceptWorldView(data.world);});
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
 if(!joined)return;
 const incoming=Array.isArray(event.detail?.wings)?event.detail.wings:[];
 const wings=mergeWingCatalog(world?.customWings||[],incoming);
 if(queuedWorld)queuedWorld={...queuedWorld,customWings:mergeWingCatalog(queuedWorld.customWings||[],wings)};
 registerCustomWings(wings);
 if(world){world={...world,customWings:wings};syncWorld();
  if(['wing-shop','wing-manage','bag'].includes(ui.panelName))ui.renderPanel();}
});
network.addEventListener('wanted-settings',event=>{if(joined)syncWantedButton(event.detail,network.base);});
network.addEventListener('players',event=>{if(!joined)return;players=event.detail;syncPlayers();});
network.addEventListener('state',event=>{const data=event.detail;if(data.key===self?.key)return;let target=remoteTargets.get(data.key);if(!target){syncPlayers();target=remoteTargets.get(data.key);}if(target){target.position.fromArray(data.state.position);target.rotation=data.state.rotation;target.animation=data.state.animation;}});
network.addEventListener('chat',event=>{if(!joined)return;ui.addChat(event.detail);showPlayerSpeech(event.detail);});
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
ui.addEventListener('own-artwork-select',async event=>{if(self?.role!=='fighter'||!controller)return ui.toast('JOIN AS A FIGHTER TO EDIT');const id=event.detail.id;if(!(world?.customArtworks||[]).some(a=>a.id===id&&a.owner===self.key))return;if(artEditor.dirty)return ui.toast('請先儲存或取消目前作品修改');let root=arena.artworks.get(id);if(!root){try{await arena.loadCustomArtworks(world.customArtworks,network.base);}catch(error){return ui.toast(error.message);}root=arena.artworks.get(id);}if(!root)return ui.toast('作品尚未載入');ui.closePanel();artEditor.select(root);});
ui.addEventListener('art-bomb-resize',event=>sendAction('resize-art-bomb',event.detail));

ui.addEventListener('art-bomb-appearance-preview',event=>{
 const {id,appearance}=event.detail;
 const record=(world?.customArtworks||[]).find(a=>a.id===id&&a.bomb&&a.owner===self?.key);
 if(!record)return; // Other players' labels are never previewed or overridden.
 const root=arena.artworks.get(id);if(!root)return;
 root.userData.previewAppearance={...appearance};
 applyArtworkAppearance(root,world?.artworkLayout?.[id]?.appearance);
});
ui.addEventListener('apply-my-label-style',async event=>{
 const result=await sendAction('apply-my-artwork-label-style',event.detail);
 if(!result?.updatedCount)return;
 for(const form of ui.content.querySelectorAll('[data-form="art-bomb-appearance"]')){
  const id=form.querySelector('[name="id"]')?.value;
  const revision=result.revisions?.[id];
  if(Number.isFinite(revision))form.querySelector('[name="revision"]').value=String(revision);
 }
 ui.toast('已將名稱樣式套用至自己上傳的 '+result.updatedCount+' 件作品');
});
ui.addEventListener('panel',event=>{
 if(event.detail?.open)return;
 // A dismissed player editor must roll back only its local unsaved previews.
 // Authoritatively saved colour is restored by the latest room snapshot.
 for(const root of arena.artworks.values()){
  if(root.userData.previewAppearance){
   delete root.userData.previewAppearance;
   applyArtworkAppearance(root,world?.artworkLayout?.[root.userData.platformId]?.appearance);
  }
 }
});

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
 const {files,size,title,author,labelBackground}=event.detail;
 if(!title?.trim())return ui.toast('請輸入作品名稱');
 if(!Number.isFinite(size)||size<1||size>3)return ui.toast('藝術品尺寸只能設定 1–3 倍');
 artBombUploading=true;
 const button=ui.content.querySelector('[data-form="art-bomb-upload"] button[type="submit"]');
 if(button)button.disabled=true;
 try{
  ui.toast('上傳中：驗證檔案並確認 Cloudflare 已儲存…');
  const upload={...await uploadArtwork(network,files,{maxBytes:8*1024*1024}),title:title.trim().slice(0,100),author:String(author||'').slice(0,100),labelBackground};
  ui.closePanel();
  startBuildPlacement('art-bomb',null,{...upload,size,previewFile:files.find(f=>f.type.startsWith('image/'))||null});
  arena.setBuildPreview('art-bomb',controller.buildPosition(3.2),controller.root.rotation.y,true,size,files.find(f=>f.type.startsWith('image/'))||null);
  arena.previewUploadedArtwork({...upload,size},network.base).catch(error=>ui.toast('預覽讀取失敗：'+error.message));
  ui.toast('Cloudflare 已儲存 · 移動角色攜帶作品，再按 PLACE');
 }catch(error){ui.toast(error.message);}
 finally{artBombUploading=false;if(button)button.disabled=false;}
});
ui.addEventListener('upload-artwork',async event=>{if(!self?.profile?.admin)return;const button=ui.content.querySelector('[data-upload-submit]');if(button)button.disabled=true;try{ui.toast('正在驗證藝術品…');const upload={...await uploadArtwork(network,event.detail.files,{maxBytes:32*1024*1024}),title:event.detail.title.trim().slice(0,100),author:String(event.detail.author||'').slice(0,100)},position=controller.buildPosition(4);position[1]+=2;const result=await sendAction('add-artwork',{artwork:{...upload,position,appearance:{labelBackground:event.detail.labelBackground||'#000000'}}});if(!result)throw Error('Artwork was not published. Retry after checking the connection.');await arena.loadCustomArtworks(world.customArtworks,network.base);ui.closePanel();artEditor.select(arena.artworks.get(result.artwork.id));ui.toast('藝術品已發布 · 可調整位置及表面');}catch(error){ui.toast(error.message);const status=ui.content.querySelector('[data-upload-status]');if(status)status.textContent=error.message;}finally{if(button)button.disabled=false;}});
ui.addEventListener('use-item',event=>{const item=itemById(event.detail);if(item&&controller)ui.toast('Use this material in BAG → FUSION');});
ui.addEventListener('original-action',event=>sendAction(event.detail.action,event.detail));
// Safari's AudioContext must be resumed during the trusted jump touch gesture.
ui.addEventListener('jump',()=>{audio.unlock();controller?.jump();});
const pendingQuickUses=new Set();
ui.addEventListener('quick-use',event=>{
 const slot=event.detail?.slot;
 if(!Number.isInteger(slot)||slot<0||slot>2||pendingQuickUses.has(slot))return;
 if(!joined||self?.role!=='fighter'||!controller?.enabled||ui.panelName||document.body.classList.contains('chat-typing')||Date.now()<restorativeCooldown(world?.profile,itemById(world?.profile?.quickSlots?.[slot])))return;
 pendingQuickUses.add(slot);
 void sendAction('use-consumable',{slot}).finally(()=>pendingQuickUses.delete(slot));
});
// On-screen A/Q is the sole interaction/throw control on desktop and mobile.
// For firearms A ONLY switches
// camera: standard > shoulder > sniper scope > standard; canvas tap fires.
ui.addEventListener('attack-start',event=>{
 if(wallPainter.active||!controller?.enabled||self?.role!=='fighter')return;
 if(coarse&&buildPlacement){confirmBuildPlacement();return;}
 // A held artwork overrides the currently equipped firearm/camera mode.
 // Query the live world as holdingArt can lag behind a pickup response.
 const carryingArtwork=Object.values(world?.artworks||{}).some(art=>art.holder===self.key);
 // A previous sale/throw may have removed ownership while a charge preview
 // lingered. Do not let that stale preview block pickup of a respawned work.
 if(!carryingArtwork&&artworkThrow.started!==null)artworkThrow.cancel();
 if(carryingArtwork){
  clearChargeDelay();pendingAInteraction=null;attackHeld=false;
  attackHoldStarted=null;chargeStarted=null;chargeRequest=null;
  artworkThrow.begin();return;
 }
 if(attackHeld||staffChannel)return;
 const weapon=currentTunedWeapon();
 // Black Cat uses A/Q solely to toggle the scope (or interact with nearby items).
 pendingAInteraction=null;
 if(!artworkThrow.started){
   const nearbyArt=arena.nearest(controller.root.position.toArray());
  if(nearbyArt?.type==='artwork'||['coin','drop'].includes(nearbyArt?.type))
   pendingAInteraction=nearbyArt;
 }
 attackHeld=true;
 lastWarnedCast=null;
 attackHoldStarted=performance.now();
 chargeStarted=null;chargeRequest=null;nextChargeRetryAt=0;
 clearChargeDelay();
 if(weapon?.id!=='black-cat')chargeDelayTimer=setTimeout(()=>{chargeDelayTimer=null;startHeldCharge();},STAFF_TAP_MAX_MS);
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
  const pending=staffChannelPromise,acknowledged=staffChannel.ready;
  staffChannel=null;++staffChannelSerial;
  arena.presentation.vfx.stopChannel(localRoot);localRoot.userData.staffCastingUntil=0;
  chargeStarted=null;attackHoldStarted=null;chargeRequest=null;
  void requestStaffChannelStop(acknowledged,pending,()=>sendAction('attack',{phase:'channel-stop'}));
  return;
 }
 if(attackHoldStarted===null)return;
 const weapon=currentTunedWeapon()||itemById('clam');
 const heldMs=performance.now()-attackHoldStarted;
 const charge=chargeProgress(heldMs,weapon?.chargeMs||1500);
 const releaseAim=controller&&localRoot?captureReleasedCast(weapon,charge):null;
 lastWarnedCast=null;

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
  if(pending&&!(await pending)?.charging)return;
  if(charge>=1)await performAttack(1,null,releaseAim); // original full-size red fish
  else void sendAction('attack',{phase:'channel-stop'}); // clear interrupted charge
  return;
 }
 if(weapon?.id==='black-cat'){if(heldMs<STAFF_TAP_MAX_MS)gun.cycle();return;}
 if(weapon?.firstPerson&&heldMs<STAFF_TAP_MAX_MS){gun.cycle();return;}
 if(heldMs>=STAFF_TAP_MAX_MS&&pending&&!(await pending)?.charging)return;
 if(isChannelStaff(weapon)){
  if(isStaffTap(weapon,heldMs)){
   if(localRoot)localRoot.userData.staffCastingUntil=Infinity;
   const liftRemaining=Math.max(0,STAFF_RAISE_SECONDS*1000-heldMs);
   if(liftRemaining>0)await new Promise(resolve=>setTimeout(resolve,liftRemaining));
   if(world?.profile?.equipment?.weapon===weapon.id)await performAttack(0,null,releaseAim);
   if(localRoot)localRoot.userData.staffCastingUntil=performance.now()+200;
  }else if(weapon.family==='ice'&&charge>=1){
   // A charged frost staff is a RELEASE cast. Never start a continuous
   // channel or abort its ice circle when A is lifted.
   if(world?.profile?.equipment?.weapon===weapon.id)
    await performAttack(1,null,releaseAim);
   if(localRoot)localRoot.userData.staffCastingUntil=performance.now()+200;
  }else if(localRoot)localRoot.userData.staffCastingUntil=0;
 }else{
  performAttack(heldMs<STAFF_TAP_MAX_MS?0:charge,null,releaseAim);
 }
});
ui.addEventListener('attack-cancel',()=>{
 gun.held=false;
 attackHeld=false;chargeStarted=null;attackHoldStarted=null;chargeRequest=null;pendingAInteraction=null;clearChargeDelay();artworkThrow.cancel();
 if(localRoot)localRoot.userData.staffCastingUntil=0;
 if(staffChannel){
  const pending=staffChannelPromise,acknowledged=staffChannel.ready;
  staffChannel=null;++staffChannelSerial;
  arena.presentation.vfx.stopChannel(localRoot);localRoot.userData.staffCastingUntil=0;
  void requestStaffChannelStop(acknowledged,pending,()=>sendAction('attack',{phase:'channel-stop'}));
 }
});
async function confirmSavedWing(result,wingId){
 const snapshot=result.world;
 const receipt=snapshot?.profile;
 const catalog=snapshot?.customWings;
 // The HTTP receipt is authoritative even if a newer combat patch arrived first.
 // Preserve the latest profile; only merge the confirmed catalog entry.
 const saved=catalog?.find(w=>w.id===wingId)||result.savedWing;
 if(saved&&world&&!world.customWings?.some(w=>w.id===wingId)){
  const wings=[...(world.customWings||[]),saved];registerCustomWings(wings);world={...world,customWings:wings};syncWorld();
 }
 const ready=()=>world?.profile?.inventory?.includes(wingId)&&!!itemById(wingId);
 if(!ready()){
  const data=await network.world();acceptWorldView(data.world);
  if(!ready()&&data.world?.revision===world?.revision){const wings=mergeWingCatalog(world.customWings||[],data.world.customWings||[]);registerCustomWings(wings);world={...world,customWings:wings,profile:data.world.profile};syncWorld();}
 }
 if(!ready())throw Error(receipt?.inventory?.includes(wingId)?'翅膀已儲存，背包同步未完成；請重新開啟 BAG':'伺服器未確認背包內的翅膀');
}
ui.addEventListener('wing-publish-request',async event=>{
 const {wing,wingId,personal,resolve,reject,requestId}=event.detail;
 if(!personal&&!self?.profile?.admin){reject(new Error('僅 GM 可以上架翅膀'));return;}
 if(personal&&!world?.profile?.wingDesignCredits){reject(new Error('未取得已付款的繪圖權限'));return;}
 try{
  const updating=!!wingId&&!personal;
  const result=await sendAction(personal?'redeem-wing-design':updating?'gm-wing-update':'gm-wing-publish',{wing,wingId,...(requestId?{requestId}:{})},{throwOnError:true});
  if(personal){
   if(!result?.personalWingId||result.equippedWingId!==result.personalWingId)
    throw new Error('伺服器尚未確認個人翅膀已儲存');
   await confirmSavedWing(result,result.personalWingId);
   resolve({...result,wingName:wing.name});
   ui.wingPersonalDraft=null;ui.bagCategory='wings';ui.openPanel('bag');
   ui.toast('翅膀已存入 BAG 並自動裝備：'+wing.name);return;
  }
  if(updating){
   if(result?.updatedWingId!==wingId)throw new Error('伺服器尚未確認原翅膀的編輯更新');
   resolve({...result,wingName:wing.name});ui.openPanel('wing-manage');
   ui.toast('翅膀已修改並重新上架：'+wing.name);return;
  }
  if(!result?.publishedWingId||result.equippedWingId!==result.publishedWingId)
   throw new Error('伺服器沒有確認翅膀已上架並自動裝備');
  await confirmSavedWing(result,result.publishedWingId);
  resolve({...result,wingName:wing.name});
  ui.bagCategory='wings';
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
ui.addEventListener('wing-payment-checkout',async event=>{
 if(ui.wingCheckoutBusy)return;
 ui.wingCheckoutBusy=true;if(ui.panelName==='wing-shop')ui.renderWingShop(world.profile);
 const order=await beginWingCheckout(network,ui,event.detail);
 if(!order){ui.wingCheckoutBusy=false;if(ui.panelName==='wing-shop')ui.renderWingShop(world.profile);}
});
ui.addEventListener('server-action',event=>{const {action,...data}=event.detail;
 if(action==='fuse'){
  if(ui.bagFusionPending)return;
  ui.bagFusionPending=true;
  void sendAction(action,data).finally(()=>{ui.bagFusionPending=false;});
 }else if(['gm-player-level','gm-wing-canvas'].includes(action)){
  if(ui.gmPlayerActionPending)return;
  ui.setGmPlayerActionState(true,'正在儲存…');
  void sendAction(action,data,{throwOnError:true}).then(result=>{
   if(!result)throw Error('伺服器未確認');
   ui.setGmPlayerActionState(false,action==='gm-player-level'?'等級已更新':'翅膀畫布已贈送');
   if(ui.panelName==='gm'){ui.renderGm();ui.refreshGmPlayerTargets();}
  }).catch(error=>{ui.setGmPlayerActionState(false,error.message||'操作失敗');ui.toast(error.message||'操作失敗');});
 }else if(['buy','sell','sell-bulk'].includes(action)){
  if(ui.shopPurchasePending)return;
  ui.setShopPurchasePending(true);
  if(action==='buy')ui.showPurchaseStatus('pending','PURCHASING…');
  void sendAction(action,data).then(result=>{if(action==='buy'&&!result)ui.showPurchaseStatus('error',ui.inventoryActionError||'PURCHASE NOT CONFIRMED');}).finally(()=>{ui.setShopPurchasePending(false);});
 }else void sendAction(action,data);
});
ui.addEventListener('build-start',async event=>{try{const d=event.detail;const media=d.file?await uploadMedia(network,d.file):null;startBuildPlacement(d.kind,media?.id);}catch(error){ui.clearBuildMode();ui.toast(error.message);}});ui.addEventListener('build-rotate',()=>rotateBuildPlacement());ui.addEventListener('build-confirm',()=>confirmBuildPlacement());ui.addEventListener('build-cancel',()=>cancelBuildPlacement());
ui.addEventListener('destroy-near',()=>{if(!controller)return;const position=controller.root.position.toArray(),nearest=(world?.structures||[]).map(structure=>({structure,distance:distance2d3(position,structure.position)})).sort((a,b)=>a.distance-b.distance)[0];if(!nearest||nearest.distance>12)return ui.toast('NO STRUCTURE NEARBY');sendAction('destroy',{structureId:nearest.structure.id,direction:controller.aimDirection()});});
ui.addEventListener('chat',async event=>{const text=String(event.detail||'').trim();if(text==='/recovery'){await sendAction('recover-artworks');return;}if(/^\/recoverposition$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('recover-misplaced-artwork');return;}if(/^\/reset$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('reset-player-artworks');return;}
 if(/^\/reset\s+building$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('reset-buildings');return;}
 if(/^\/clean\s+(?:graffic|graffiti)$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('clean-graffiti');return;}
 if(/^\/reset\s+message$/i.test(text)){if(!self?.profile?.admin)return ui.toast('GM only');await sendAction('reset-messages');return;}
 try{const result=await network.chat(text);if(result?.notice)ui.toast(result.notice);}catch(error){ui.toast(error.message);}});
ui.addEventListener('plant',async event=>{
  if(self?.role!=='spectator'){writer.submit(event.detail);return;}
  if(ui.spectatorPlantPending)return;
  ui.spectatorPlantPending=true;
  try{
   const {file,...data}=event.detail||{};
   if(file)data.media=await uploadMedia(network,file);
   const result=await sendAction('plant',{...data,position:[0,0,0]},{throwOnError:true});
   if(result?.plant){ui.closePanel();ui.toast('WRITE · MESSAGE PLANTED');}
  }catch(error){ui.toast(error.message||'Spectator WRITE failed');}
  finally{ui.spectatorPlantPending=false;}
 });
ui.addEventListener('save-code',async()=>{try{const data=await network.createSaveCode();self.saveCode=data.code;ui.self=self;ui.showSaveCode(data.code);ui.toast('存檔代碼已產生 · 請保存');}catch(error){ui.toast(error.message);}});
ui.addEventListener('gm-chat-history-request',async event=>{if(!self?.profile?.admin)return;try{ui.setGmChatHistory(await network.gmChatHistory(event.detail),!!event.detail);}catch(error){ui.setGmChatHistoryError(error.message);}});
ui.addEventListener('gm-presence-request',async()=>{if(!self?.profile?.admin)return;try{ui.setGmPresence(await network.gmPresence());}catch(error){ui.setGmPresenceError(error.message);}});
function applyRoleTransition(data){
   if(!data?.self||!data.world)throw Error('Role transition missing authoritative world');
   gun.end();
   network.spawnConfirmed=data.role==='fighter'&&self?.role==='fighter'&&network.spawnConfirmed;
   cancelBuildPlacement();
   self={...self,...data.self,role:data.role,seat:data.seat};
   world=data.world;players=data.players;
   controller.seat=data.seat;controller.setFollowTarget(null);controller.setRole(data.role);
   controller.spectatorLift=0;
   if(data.role!=='fighter')wallPainter.stop();
   controller.teleport(PLAYER_SPAWNS[data.seat]||PLAYER_SPAWNS[0]);
   ui.setSelf(self);syncPlayers();syncWorld();
   ui.toast(data.role==='fighter'?'FIGHTER SEAT READY':'SPECTATOR MODE · FREE CAMERA · WRITE / CHAT');
}
ui.addEventListener('role-change',async event=>{
 try{applyRoleTransition(await network.changeRole(event.detail));}
 catch(error){ui.toast(error.message);}
});
ui.addEventListener('gm-spectator-test',async()=>{
 if(!self?.profile?.admin||ui.gmSpectatorBusy)return;
 if(writer.active||artEditor.mode||platformDelete.active)return ui.toast('請先結束 WRITE 或作品編輯模式');
 if(self.role==='spectator'&&!self.gmSpectatorPreview)return ui.toast('目前已是正式觀眾模式');
 ui.gmSpectatorBusy=true;
 try{
  const returning=!!self.gmSpectatorPreview;
  const data=await network.changeRole({role:returning?'fighter':'spectator',gmPreview:true});
  ui.closePanel();applyRoleTransition(data);
  ui.toast(returning?'GM 戰鬥席已恢復':'GM 觀眾測試：使用正式觀眾權限與操作');
 }catch(error){ui.toast(error.message);}
 finally{ui.gmSpectatorBusy=false;}
});
ui.addEventListener('spectator-lift',event=>{
 if(controller?.role==='spectator')controller.spectatorLift=Number(event.detail)||0;
});
ui.addEventListener('spectator-follow',event=>followSpectator(event.detail));ui.addEventListener('spectator-cycle',()=>cycleSpectator());
ui.addEventListener('panel',event=>{if(event.detail.open)wallPainter.stop();chargeStarted=null;attackHoldStarted=null;chargeRequest=null;pendingAInteraction=null;clearChargeDelay();if(event.detail.open){attackHeld=false;}if(event.detail.open&&staffChannel){arena.presentation.vfx.stopChannel(localRoot);localRoot.userData.staffCastingUntil=0;const pending=staffChannelPromise,acknowledged=staffChannel.ready;staffChannel=null;++staffChannelSerial;void requestStaffChannelStop(acknowledged,pending,()=>sendAction('attack',{phase:'channel-stop'}));}if(event.detail.open)artworkThrow.cancel();controller?.setEnabled(!event.detail.open&&!artEditor.mode&&!writer.active&&!platformDelete.active&&!wallPainter.active);if(!event.detail.open&&(writer.phase==='write'||writer.legacy))writer.cancel();});
let skyColorPreview=null;
const savedSkyColor=()=>world?.environment?.skyBaseColor||'#101b36';
const applySkyColor=color=>scene.userData.moonlitSky?.setBaseColor(color);
ui.addEventListener('sky-color-preview',event=>{if(!self?.profile?.admin)return;skyColorPreview=event.detail.color;applySkyColor(skyColorPreview);});
ui.addEventListener('sky-color-save',async event=>{
 if(!self?.profile?.admin)return;
 try{const result=await sendAction('gm-sky-color',{color:event.detail.color},{throwOnError:true});if(!result?.environment)throw Error('Server did not confirm sky color');skyColorPreview=null;applySkyColor(result.environment.skyBaseColor);ui.toast('星空底色已儲存');}catch(error){ui.toast(error.message);}
});
ui.addEventListener('panel',event=>{if(ui.panelName!=='sky-color'&&skyColorPreview!==null){skyColorPreview=null;applySkyColor(savedSkyColor());}});
let terrainPreview=null,terrainSaving=false,appliedTerrainKey='';
const savedTerrain=()=>terrainStyle(world?.environment);
function applyTerrain(style){
 if(!arena.grass)return;const key=JSON.stringify(style);if(key===appliedTerrainKey)return;appliedTerrainKey=key;
 arena.grass.setTerrainStyle({terrain:style});
 const ground=scene.userData.terrainGround?.material;
 if(ground){ground.color.set(style.floorColor);if(style.floorColor===TERRAIN_DEFAULTS.floorColor)ground.emissive.set('#0c302b');else ground.emissive.set(style.floorColor).multiplyScalar(.18);}
}
ui.addEventListener('terrain-preview',event=>{if(!self?.profile?.admin||self.gmSpectatorPreview)return;terrainPreview=terrainStyle({terrain:event.detail});applyTerrain(terrainPreview);});
ui.addEventListener('terrain-save',async event=>{
 if(!self?.profile?.admin||self.gmSpectatorPreview||terrainSaving)return;terrainSaving=true;
 const button=ui.content.querySelector('[data-terrain-save]'),status=ui.content.querySelector('[data-terrain-status]');if(button)button.disabled=true;if(status)status.textContent='儲存中…';
 const draft=terrainStyle({terrain:event.detail});
 try{const result=await sendAction('gm-terrain-style',{terrain:draft},{throwOnError:true});if(!result?.environment?.terrain||JSON.stringify(terrainStyle(result.environment))!==JSON.stringify(draft))throw Error('Server did not confirm terrain settings');terrainPreview=null;applyTerrain(terrainStyle(result.environment));if(status)status.textContent='已儲存並同步全服';ui.toast('草地環境已儲存');}
 catch(error){if(status)status.textContent=error.message;ui.toast(error.message);}finally{terrainSaving=false;if(button)button.disabled=false;}
});
ui.addEventListener('panel',()=>{if(ui.panelName!=='terrain-style'&&terrainPreview!==null){terrainPreview=null;applyTerrain(savedTerrain());}});
ui.addEventListener('gm-remove-artworks',async event=>{
 if(!self?.profile?.admin)return;
 if(artEditor.selected&&event.detail.ids.includes(artEditor.selected.userData.platformId))artEditor.close();
 try{const result=await sendAction('gm-remove-artworks',{ids:event.detail.ids},{throwOnError:true});if(result?.removedArtworks&&ui.panelName==='editor')ui.renderPanel();}catch(error){ui.toast(error.message);}
});
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
  for(const player of players){if(player.role!=='fighter'||player.key===self.key)continue;const root=roots.get(player.key);if(root){arena.setPlayerName(root,player.name,player.profile?.admin);arena.setPlayerEquipment(root,player.profile?.equipment);setHealthBar(root,player.profile?.hp,player.profile?.maxHp);root.userData.deadUntil=player.profile?.deadUntil||0;applyShieldHit(root,player.profile);applyHitReaction(root,player.profile);statusVisuals.sync(root,player.profile?.effects);}}
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
 if(skyColorPreview===null&&(!previous||world.environment!==previous.environment))applySkyColor(savedSkyColor());
 if(terrainPreview===null&&(!previous||world.environment!==previous.environment))applyTerrain(savedTerrain());
 if(artEditor.selected&&!world.artworks?.[artEditor.selected.userData.platformId])artEditor.close();
 if(!previous||world.audioSettings!==previous.audioSettings)audio.setVolumes(world.audioSettings||{});
 if(world.musicVersion&&world.musicVersion!==previous?.musicVersion)audio.setUploadedMusic(network.base,world.musicVersion);
 if(!previous||world.customArtworks!==previous.customArtworks)
  arena.loadCustomArtworks(world.customArtworks,network.base).catch(error=>ui.toast(error.message));
 if(!previous||world.damageEvents!==previous.damageEvents)damageNumbers.receive(world.damageEvents);
 arena.sync(world,players);
 if(!previous||world.collector!==previous.collector)collectorView.sync(world.collector);
 syncWantedButton(world.wantedSettings,network.base);ui.setWorld(world);ui.showCollectorSale(world.collectorSale,self?.key);ui.showKillEvents(world.killEvents);
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
if(localRoot&&profile){if(self.name!==profile.name){self.name=profile.name;ui.self.name=profile.name;document.getElementById('hud-name').textContent=profile.name;}arena.setPlayerName(localRoot,profile.name,profile.admin);arena.setPlayerEquipment(localRoot,profile.equipment);localRoot.userData.deadUntil=profile.deadUntil||0;applyShieldHit(localRoot,profile);applyHitReaction(localRoot,profile);
 if(profile.tidePush?.id&&profile.tidePush.id!==controller.lastTidePushId&&Date.now()-profile.tidePush.time<profile.tidePush.durationMs){
  controller.lastTidePushId=profile.tidePush.id;controller.tidePush={...profile.tidePush,progress:Math.max(0,(Date.now()-profile.tidePush.time)/profile.tidePush.durationMs)};
 }
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

async function sendAction(action,data={},options={}){const inventoryAction=['buy','sell','sell-bulk','equip','unequip','inspect-item','assign-consumable','swap-inventory','gm-shop-price','gm-shop-delist','gm-equipment-tuning','gm-player-level','gm-wing-canvas'].includes(action);if(!joined||!controller&&!inventoryAction){if(inventoryAction)ui.toast('CONNECT TO TEMPLE FIRST');return null;}try{const result=await network.action(action,data);if(result.purchased){const purchased=itemById(result.purchased.itemId);ui.purchaseNotice(purchased?.name||result.purchased.itemId,result.purchased.quantity);}if(inventoryAction){ui.inventoryActionError='';ui.inventoryActionNotice=result.sold?`SOLD ${result.sold.count} · BAG ${result.sold.remaining}/${result.sold.capacity}`:'';}if(result.world)acceptWorldView(result.world,true);if(inventoryAction&&['bag','shop','shop-prices'].includes(ui.panelName)){document.activeElement?.blur();if(ui.panelName==='bag'&&['equip','unequip','inspect-item'].includes(action))ui.refreshBagAfterAction();else ui.renderPanel();}if(!result.purchased&&result.notice)ui.toast(result.notice);if(result.resetMessages)ui.clearChat();if(['gm-wing-draw','wing-draw'].includes(action)&&result.wingDraw)ui.showWingDraw(result.wingDraw);if(['gm-wing-remove','gm-wing-set-rate'].includes(action)&&ui.panelName==='wing-manage')ui.renderPanel();if(action==='fuse'&&result.fusion){ui.fusionFeedback(!!result.fusion.success,result.notice);audio.play(result.fusion.success?'fusion-success':'fusion-fail',1);}if(result.attackEvent)showAttack(result.attackEvent);if(result.throwEvent)showThrowPulse(result.throwEvent);if(action==='pickup-coin'||action==='pickup-drop')audio.play('coin');for(const hit of result.structureHits||(result.structureHit?[result.structureHit]:[]))arena.showStructureHit(hit);for(const broken of result.structureDestroyedEvents||(result.structureDestroyed?[result.structureDestroyed]:[]))arena.showStructureBreak(broken);if(result.hit?.defeated)ui.toast(`DEFEATED · ${result.hit.lostCoins} COINS DROPPED`);return result;}catch(error){if(['gm-wing-draw','wing-draw'].includes(action))ui.cancelWingDraw();if(options.throwOnError)throw error;if(action==='fuse')ui.fusionFeedback(false,error.message);if(['buy','sell','sell-bulk','equip'].includes(action)){ui.inventoryActionNotice='';ui.inventoryActionError=String(error.message||'Transaction failed');const status=ui.content.querySelector('[data-inventory-error]');if(status){status.textContent=ui.inventoryActionError;status.hidden=false;}if(action==='buy'&&/item is not sold|invalid weapon quality|unknown action/i.test(ui.inventoryActionError)){void network.request('/health',{auth:false,timeoutMs:5000}).then(health=>{if(health?.features?.wearableCatalog!==SHOP_CATALOG_REVISION){ui.inventoryActionError='SERVER CATALOG OUT OF DATE · '+String(error.message);const node=ui.content.querySelector('[data-inventory-error]');if(node){node.textContent=ui.inventoryActionError;node.hidden=false;}}}).catch(()=>{});}}if((action==='pickup-artwork'||!/^Move closer to (?:the )?(?:artwork|coin|drop)/i.test(error.message||''))&&performance.now()-toastErrorAt>400){toastErrorAt=performance.now();ui.toast(error.message);}return null;}}

function startBuildPlacement(kind,surface=null,artwork=null){if(self?.role!=='fighter')return ui.toast('SPECTATORS CANNOT BUILD');buildPlacement={kind,surface,artwork,rotation:controller?.root.rotation.y||0,position:controller?.buildPosition(kind==='art-bomb'?3.2:5)||[0,0,0],valid:false};ui.buildKind=kind;document.getElementById('build-kind').textContent=kind==='art-bomb'?'YOUR ARTWORK':kind.toUpperCase();document.getElementById('build-mode').hidden=false;document.activeElement?.blur();if(!writer.active&&!artEditor.mode)controller?.setEnabled(true);ui.toast('MOVE WITH YOUR ARTWORK · R ROTATE · E / PLACE');}
function rotateBuildPlacement(){if(!buildPlacement)return;buildPlacement.rotation+=Math.PI/4;}
async function confirmBuildPlacement(){if(!buildPlacement||!controller)return;if(!buildPlacement.valid)return ui.toast('CANNOT BUILD HERE');const result=buildPlacement.kind==='art-bomb'
 ?await sendAction('publish-art-bomb',{artwork:{title:buildPlacement.artwork?.title,author:buildPlacement.artwork?.author,mediaId:buildPlacement.artwork?.mediaId,position:[buildPlacement.position[0],buildPlacement.position[1]+1.5*(buildPlacement.artwork?.size||1),buildPlacement.position[2]],appearance:{labelBackground:buildPlacement.artwork?.labelBackground||'#000000'}},size:buildPlacement.artwork?.size})
 :await sendAction('build',{kind:buildPlacement.kind,surface:buildPlacement.surface,position:buildPlacement.position,rotation:buildPlacement.rotation});
 if(result)cancelBuildPlacement();}
function cancelBuildPlacement(){buildPlacement=null;arena.clearBuildPreview();ui.clearBuildMode();}
function followSpectator(key){if(self?.role!=='spectator')return;const target=key?roots.get(key):null;controller.setFollowTarget(target||null);spectatorFollowIndex=players.filter(player=>player.role==='fighter').findIndex(player=>player.key===key);ui.toast(target?`FOLLOWING ${players.find(player=>player.key===key)?.name||'FIGHTER'}`:'FREE SPECTATOR CAMERA');}
function cycleSpectator(){if(self?.role!=='spectator')return;const fighters=players.filter(player=>player.role==='fighter'&&roots.get(player.key));if(!fighters.length)return followSpectator('');spectatorFollowIndex=(spectatorFollowIndex+1)%fighters.length;followSpectator(fighters[spectatorFollowIndex].key);}

let lastWarnedCast=null;
function sampleCast(item,charge=0){
 const goldfishUltimate=item.id==='goldfish'&&charge>=1&&gun.mode===0;
 const shot=item.firstPerson&&!goldfishUltimate?gun.shot():null;
 const muzzle=isChannelStaff(item)||item.family==='saber'||item.id==='calico-cat'?arena.presentation.vfx.channelMuzzle(localRoot,item):null;
 const origin=shot?.origin||muzzle?.toArray()||castBaseOrigin(controller.root.position.toArray());
 const direction=goldfishUltimate?cameraAimDirection(camera).toArray():
  shot?.direction||attackDirection(controller,camera,arena,roots,item,charge,new THREE.Vector3(...origin));
 return {weapon:item.id,origin,direction,castPoseV081:true,at:performance.now()};
}
function captureReleasedCast(item,charge){
 // Use the actual last displayed warning at release, not a new ray after
 // awaiting a network request, walking, turning the camera or lifting a staff.
 const warned=lastWarnedCast;
 return charge>=1&&warned?.weapon===item.id&&performance.now()-warned.at<350
  ?warned:sampleCast(item,charge);
}
function performAttack(charge=0,phase=null,captured=null){
 if(wallPainter.active)return;
 if(controller?.status?.freeze||world?.profile?.effects?.paralysis?.until>Date.now())return;
 if(!controller?.enabled||performance.now()<(controller.stunUntil||0)||self?.role!=='fighter'||ui.panelName)return;
 const item=currentTunedWeapon()||itemById('water');
 // Centralized guard covers UI A/Q, canvas clicks, auto-charge and fusion.
 if(item.id==='black-cat'&&(gun.mode!==2||charge!==0||phase))return;
 if(item.id==='goldfish'&&gun.mode!==1&&charge<1)return;
 if(captured&&captured.weapon!==item.id)return;
 const sample=captured||sampleCast(item,charge);
 const {origin,direction}=sample;
 // A movement sample can be in flight over the socket; the Worker checks
 // this bounded cast origin against its authoritative player position.
 return sendAction('attack',{origin,direction,castPoseV081:true,charge,...(phase?{phase}:{}),
  ...(item.id==='black-cat'?{
   scoped:gun.mode===2,aimMode:'scope'
  }:{})},{throwOnError:phase==='channel'});
}
function performInteract(target=null){if(!controller||self?.role!=='fighter')return;const held=Object.entries(world?.artworks||{}).find(([,art])=>art.holder===self.key);if(held){artworkThrow.begin();return;}const near=target||arena.nearest(controller.root.position.toArray());if(!near)return;if(near.type==='plant')return;if(near.type==='coin')sendAction('pickup-coin',{platformId:near.id});if(near.type==='drop')sendAction('pickup-drop',{dropId:near.id});if(near.type==='artwork')sendAction('pickup-artwork',{platformId:near.id});}

let screenShakeUntil=0;
const heardStompLandings=new Set();
function update(dt,time,movementDt=dt){
  const nowMs=Date.now();
  if(queuedWorld){const pending=queuedWorld;queuedWorld=null;acceptWorldView(pending);}
  damageNumbers.update(camera,innerWidth,innerHeight);vitalModels?.update(time,world?.profile?.hp||0,world?.profile?.maxHp||100);
  if(joined)minimap.update(time,roots,self?.key,world?.monster,world?.monsters||[],world?.collector);
  if(joined&&controller){
   const debuffs=world?.profile?.effects||{};
   controller.status={freeze:(debuffs.freeze?.until||0)>nowMs||(debuffs.stun?.until||0)>nowMs,
      root:(debuffs.root?.until||0)>nowMs,
      confuse:(debuffs.confuse?.until||0)>nowMs,
      dazzle:(debuffs.dazzle?.until||0)>nowMs,
      paralysis:(debuffs.paralysis?.until||0)>nowMs};
   if(controller.status.paralysis&&(attackHeld||staffChannel))ui.emit('attack-cancel');
   // Desktop channel casts steer the camera with relative mouse movement
    // even without holding a mouse button. Mobile touch remains unchanged.
    controller.channelAiming=!!(attackHeld&&isChannelStaff(currentTunedWeapon()));
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
    if(!wasGrounded&&controller.grounded)audio.play('land',.95);arena.setPlayerAnimation(localRoot,state.animation);if(!(writer.active&&writer.legacy)&&self?.role==='fighter')network.sendState(state);const remotePositionAlpha=1-Math.exp(-dt*11),remoteRotationAlpha=1-Math.exp(-dt*12);for(const [key,target] of remoteTargets){const root=roots.get(key);if(!root)continue;root.position.lerp(target.position,remotePositionAlpha);root.rotation.y=lerpAngle(root.rotation.y,target.rotation,remoteRotationAlpha);arena.setPlayerAnimation(root,target.animation);}const near=arena.nearest(localRoot.position.toArray()),holding=hasHeldArtwork(world?.artworks,self.key);if(!holding&&artworkThrow.started!==null)artworkThrow.cancel();controller.holdingArt=holding;ui.setNear(near,holding);if(buildPlacement){buildPlacement.position=controller.buildPosition(buildPlacement.kind==='art-bomb'?3.2:5);buildPlacement.valid=(buildPlacement.kind==='art-bomb'?canPlaceArtworkAt:canBuildAt)(world,controller.root.position.toArray(),buildPlacement.position);arena.setBuildPreview(buildPlacement.kind,buildPlacement.position,buildPlacement.rotation,buildPlacement.valid,buildPlacement.artwork?.size||1,buildPlacement.artwork?.previewFile||null);}if(self?.role==='fighter'&&performance.now()-lastAutoCoinAt>300){lastAutoCoinAt=performance.now();const p=localRoot.position;const coin=PLATFORMS.find(c=>!pendingAutoPickups.has('pickup-coin:'+c.id)&&world?.coins?.[c.id]?.available&&(p.x-c.coinPosition[0])**2+(p.z-c.coinPosition[2])**2<2.8**2&&Math.abs(p.y-c.coinPosition[1])<3.1),drop=coin?null:world?.groundDrops?.find(d=>!pendingAutoPickups.has('pickup-drop:'+d.id)&&(p.x-d.position[0])**2+(p.y-d.position[1])**2+(p.z-d.position[2])**2<2.2**2&&(d.kind!=='heart'||world.profile.hp<world.profile.maxHp)&&!(d.owner===self.key&&nowMs<d.ownerLockedUntil));if(coin||drop){if(coin)autoPickup('pickup-coin',coin.id,'platformId');else autoPickup('pickup-drop',drop.id,'dropId');}}const profile=world?.profile;if(profile?.deadUntil>Date.now())ui.death(profile.deadUntil,profile.lastKilledBy?.name||'');}
  platformDelete.update();
  collectorView.update(time,camera);
  statusVisuals.update(dt);
  const castingItem=currentTunedWeapon();
  if(localRoot){
   localRoot.userData.staffCasting=!!(attackHeld&&isChannelStaff(castingItem));
   // Render the live native #08 / #29 on the EXACT ray that the next
    // authoritative cast will transmit, not on the old screen-center ray.
    const staffAimActive=!!(localRoot.userData.staffCasting||performance.now()<(localRoot.userData.staffCastingUntil||0));
   const muzzle=staffAimActive&&castingItem&&isChannelStaff(castingItem)?arena.presentation.vfx.channelMuzzle(localRoot,castingItem):null;
    localRoot.userData.staffAimDirection=staffAimActive&&castingItem&&isChannelStaff(castingItem)&&controller
     ?attackDirection(controller,camera,arena,roots,castingItem,1,muzzle)
     :cameraAimDirection(camera).toArray();
    const curved=!!(staffAimActive&&castingItem&&['lightning','beam'].includes(castingItem.family)&&
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
  arena.update(dt,time,camera,roots,localRoot);
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
  const heldItem=castingItem||itemById('clam');
  if(chargeStarted!==null&&!staffChannel&&attackHeld&&world?.profile&&Number(world.profile.mana)+1e-6<weaponManaQuote(world,heldItem,world.profile.fusion?.[heldItem.id]).initial)stopInsufficientCharge();
  if(heldItem.id!=='black-cat'&&attackHeld&&attackHoldStarted!==null&&chargeStarted===null&&!chargeRequest&&
     performance.now()-attackHoldStarted>=STAFF_TAP_MAX_MS)startHeldCharge();
  const charge=heldItem.id==='black-cat'||chargeStarted===null?0:Math.min(1,(performance.now()-chargeStarted)/(heldItem?.chargeMs||1500));
  // First 500ms is a tap window, then progress becomes visible from 0%. No staff may continuously cast during
  // the charging window; the very first sustained pulse is the ultimate.
  if(attackHeld&&charge>=1&&isChannelStaff(heldItem)&&heldItem?.family!=='ice'&&!staffChannel)
   beginStaffChannel();
  if(staffChannel){
   if(!attackHeld||!isChannelStaff(heldItem)||heldItem.id!==staffChannel.weapon||!controller.enabled){
    const pending=staffChannelPromise,acknowledged=staffChannel.ready;staffChannel=null;++staffChannelSerial;
    void requestStaffChannelStop(acknowledged,pending,()=>sendAction('attack',{phase:'channel-stop'}));
   }else if(staffChannel.ready&&!staffChannelBusy&&performance.now()-staffChannelShotAt>=channelInterval(heldItem)+45){
    const cost=weaponManaQuote(world,equippedItem(world.profile,itemById(heldItem.id)||heldItem),world.profile?.fusion?.[heldItem.id]).pulse;
    if(Number(world?.profile?.mana)+1e-6<cost){staffChannel=null;attackHeld=false;chargeStarted=null;arena.presentation.vfx.stopChannel(localRoot);ui.toast('NOT ENOUGH MANA');void sendAction('attack',{phase:'channel-stop'});}
    else{
    staffChannelShotAt=performance.now();staffChannelBusy=true;
    void Promise.resolve(performAttack(1,'channel')).catch(error=>{if(/not enough mana|channel is not active/i.test(error.message||'')&&staffChannel){staffChannel=null;attackHeld=false;chargeStarted=null;arena.presentation.vfx.stopChannel(localRoot);ui.toast('NOT ENOUGH MANA');void sendAction('attack',{phase:'channel-stop'});}}).finally(()=>{staffChannelBusy=false;});
    }
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
   autoChargeBusy=true;const pending=chargeRequest,releaseAim=captureReleasedCast(heldItem,1);chargeStarted=null;
   Promise.resolve(pending).then(async()=>{await performAttack(1,null,releaseAim);if(attackHeld&&controller?.enabled&&!ui.panelName){chargeRequest=null;startHeldCharge();}}).finally(()=>autoChargeBusy=false);
  }
  arena.presentation.charging(localRoot,charge);
  const chargedWeapon=castingItem;
  if(charge>.08&&!staffChannel&&chargedWeapon&&controller){
   const cast=sampleCast(chargedWeapon,1);
   chargePreview.update(localRoot,chargedWeapon,charge,cast.direction,arena,world?.profile?.fusion?.[chargedWeapon.id]||null,cast.origin,dt);
   lastWarnedCast=cast;
  }else{chargePreview.hide();lastWarnedCast=null;}
  const attackButton=document.getElementById('attack-button'),charging=charge>0||!!staffChannel||artworkThrow.started!==null,chargeStyle=`${(artworkThrow.started!==null?artworkThrow.progress:charge)*100}%`;if(attackButton.classList.contains('charging')!==charging)attackButton.classList.toggle('charging',charging);if(attackButton.style.getPropertyValue('--charge')!==chargeStyle)attackButton.style.setProperty('--charge',chargeStyle);artEditor.update();for(let i=effects.length-1;i>=0;i--){const effect=effects[i];effect.age+=dt;effect.material.opacity=Math.max(0,1-effect.age/effect.duration);effect.scale.setScalar(1+effect.age*3);if(effect.age>=effect.duration){effect.removeFromParent();effect.geometry.dispose();effect.material.dispose();effects.splice(i,1);}}
}

let lastFrameFaultAt=0,lastRenderFaultAt=0,contextLost=false,lastHealthSampleAt=0;
const runtimeHealthKey='temple-render-health-v032';
const gpuFrames=new GPUFrameQueue(renderer.getContext(),coarse,2);
let previousRuntimeHealth=null;try{previousRuntimeHealth=JSON.parse(localStorage.getItem(runtimeHealthKey)||localStorage.getItem('temple-render-health-v029')||localStorage.getItem('temple-render-health-v024')||localStorage.getItem('temple-render-health-v023')||'null');}catch{}
const renderDiagnostics=window.templeRenderDiagnostics={contextLosses:0,contextRestores:0,renderFaults:0,lastError:null,previousRuntimeHealth};
function recordRenderHealth(now){
 if(now-lastHealthSampleAt<5000)return;lastHealthSampleAt=now;
 const vfx=arena.presentation.vfx,poolSize=map=>Array.from(map.values()).reduce((n,v)=>n+v.length,0);
 const sample={version:'V085',time:Date.now(),fps:Math.round(fps),gpuPending:gpuFrames.pending.length,gpuPeak:gpuFrames.peak,gpuSkipped:gpuFrames.skipped,gpuFenceFailures:gpuFrames.failures,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length||0,activeVfx:vfx.active.length+vfx.numberedEffects.active.length+vfx.particleSkills.active.length+vfx.signatureEffects.active.length,pooledVfx:poolSize(vfx.pools)+poolSize(vfx.numberedEffects.prewarmed)+vfx.particleSkills.pooledCount+poolSize(vfx.orbPools),cityRuins:arena.outerCity?.chunks.size||0,contextLosses:renderDiagnostics.contextLosses,renderFaults:renderDiagnostics.renderFaults};
 renderDiagnostics.latest=sample;try{localStorage.setItem(runtimeHealthKey,JSON.stringify(sample));}catch{}
 // Each pool only releases its own inactive surplus, even if another weapon is busy.
 vfx.trimIdlePools(now);
}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;gpuFrames.reset();renderDiagnostics.contextLosses++;renderDiagnostics.lastError='WebGL context lost';});
canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;gpuFrames.reset();renderDiagnostics.contextRestores++;last=performance.now();});
function frame(now){requestAnimationFrame(frame);const elapsed=now-last,dt=Math.min(.10,elapsed/1000);last=now;if(!assetsReady||!joined||document.hidden||contextLost)return;const started=performance.now();
 // An unexpected model/animation exception cannot prevent the render pass.
 // Individual effects are also contained at source; this is a final guard.
 if(now>externalUntil)try{update(dt,now/1000,Math.min(.24,elapsed/1000));}catch(error){
  if(now-lastFrameFaultAt>2000){lastFrameFaultAt=now;console.error('Gameplay update fault; render frame preserved',error);}
 }
 const updated=performance.now();
 // Logic, controls, authoritative events and animations still advance above.
 // If two GPU frames are outstanding, do not submit a third stale frame.
 if(!gpuFrames.canSubmit()){
  if(now-fpsAt>1000){fps=fpsFrames*1000/(now-fpsAt);fpsFrames=0;fpsAt=now;}
  try{recordRenderHealth(now);}catch{}return;
 }
 refreshEquipmentPortrait();vhs.setDizzy(world?.profile?.effects?.dazzle?.until>Date.now()?1:0);const shake=gun.mode===2?0:Math.max(0,(screenShakeUntil-performance.now())/350),savedPosition=shake>0?camera.position.clone():null;if(shake>0){camera.position.x+=(Math.random()-.5)*shake*.16;camera.position.y+=(Math.random()-.5)*shake*.10;}try{arena.grass?.prepareVisibility(camera);vhs.render(scene,camera,performance.now()/1000,(gl,world,view)=>arena.presentation.vfx.numberedEffects.render(gl,world,view));}catch(error){renderDiagnostics.renderFaults++;renderDiagnostics.lastError=String(error?.message||error);if(now-lastRenderFaultAt>2000){lastRenderFaultAt=now;console.error('Render fault',error);}}finally{if(savedPosition)camera.position.copy(savedPosition);gpuFrames.submitted();}const ended=performance.now();for(const [key,value] of [['frame',elapsed],['logic',updated-started],['submit',ended-updated]]){performanceSamples[key].push(value);if(performanceSamples[key].length>240)performanceSamples[key].shift();}frameSamples.push(elapsed);if(frameSamples.length>180)frameSamples.shift();fpsFrames++;if(now-fpsAt>1000){fps=fpsFrames*1000/(now-fpsAt);fpsFrames=0;fpsAt=now;}try{recordRenderHealth(now);}catch(error){console.warn('Render health sample failed',error);}}
requestAnimationFrame(frame);

const heardAttacks=new Set();function showAttack(event){if(!heardAttacks.has(event.id)){heardAttacks.add(event.id);if(heardAttacks.size>128)heardAttacks.delete(heardAttacks.values().next().value);const item=itemById(event.weapon),gain=event.owner===self?.key?1:.38;audio.playWeapon(item,gain,!!event.ultimate);if(event.owner===self?.key&&(item?.firstPerson||item?.id==='calico-cat'))gun.kick(item);if(event.ultimate&&item?.family!=='fire'){audio.play('ultimate',gain*.45);if(['pan','swatter','lightning','wave','beam','planter','palm'].includes(item?.family)||Number(event.area?.radius)>1.5)audio.play('explosion',gain*.95);}}arena.presentation.play(event,roots.get(event.owner));}
function showThrowPulse(event){artworkThrow.queue(event);}
function applyEditorSettings(next){renderer.setPixelRatio(Math.min(devicePixelRatio,next.pixelRatio));renderer.setSize(innerWidth,innerHeight,false);scene.fog.density=next.fog;arena.artFloat=next.artFloat;}
function loadEditorSettings(){try{return JSON.parse(localStorage.getItem('temple-editor-settings')||'{}');}catch{return {};}}
function lerpAngle(a,b,t){let d=(b-a+Math.PI)%(Math.PI*2)-Math.PI;if(d<-Math.PI)d+=Math.PI*2;return a+d*t;}
function distance2d3(a,b){return Math.hypot(a[0]-b[0],a[2]-b[2]);}

let viewportResizeFrame=0;
addEventListener('resize',()=>{if(viewportResizeFrame)return;viewportResizeFrame=requestAnimationFrame(()=>{viewportResizeFrame=0;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const size=renderer.getSize(new THREE.Vector2());if(size.x!==innerWidth||size.y!==innerHeight)renderer.setSize(innerWidth,innerHeight,false);});});
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){if(portraitViewport.renderer)portraitViewport.close();arena.pauseArtworkVideos();}});
addEventListener('pagehide',()=>{gpuFrames.reset();network.close();});

window.render_game_to_text=()=>JSON.stringify({mode:joined?'play':'entry',name:self?.name||null,role:self?.role||null,connected:network.socket?.readyState===WebSocket.OPEN,position:controller?.root.position.toArray().map(n=>+n.toFixed(2))||null,players:players.map(p=>({name:p.name,role:p.role,seat:p.seat})),economy:{wallet:world?.profile?.wallet??null,inventory:world?.profile?.inventory?.length||0,groundDrops:world?.groundDrops?.length||0,platformCoins:Object.values(world?.coins||{}).filter(c=>c.available).length,platformCoinTotal:Object.keys(world?.coins||{}).length},artworks:{total:arena.artworks.size,available:Object.values(world?.artworks||{}).filter(a=>!a.holder&&Date.now()>=(a.availableAt||0)).length},monster:world?.monster?.active?{variant:world.monster.variant,hp:world.monster.hp}:null,render:{fps:+fps.toFixed(1),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length||0,contextLosses:renderDiagnostics.contextLosses,contextRestores:renderDiagnostics.contextRestores,renderFaults:renderDiagnostics.renderFaults,gpuPending:gpuFrames.pending.length,gpuSkipped:gpuFrames.skipped,pixelRatio:renderer.getPixelRatio(),gunMode:gun.mode,frameMs:+(frameSamples.reduce((a,b)=>a+b,0)/Math.max(1,frameSamples.length)).toFixed(2)},movementSync:{sent:network.stateSequence,acked:network.lastAcceptedSequence,
  rejections:network.rejectionCounts,recent:network.motionDiagnostics},editorShortcut:'Shift+Y'});
window.advanceTime=milliseconds=>{externalUntil=performance.now()+120;const steps=Math.ceil(milliseconds/16.6667);for(let i=0;i<steps;i++)update(Math.min(.05,milliseconds/steps/1000),(performance.now()+i*milliseconds/steps)/1000);vhs.render(scene,camera,performance.now()/1000);};
if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname))window.templeTest={writer,plantHover,audio,bursts,artworkThrow,arena,camera,renderer,ui,gun,editor:artEditor,platformDelete,portraitViewport,controller:()=>controller,network,roots,items:ITEMS,slots:EQUIPPABLE_SLOTS,performanceSamples,vitals:()=>vitalModels,hit:applyHitReaction,channelDebug:()=>({attackHeld,chargeStarted,chargeRequest:!!chargeRequest,staffChannel:staffChannel?{...staffChannel}:null,staffChannelBusy,staffChannelShotAt,enabled:controller?.enabled,role:self?.role,weapon:world?.profile?.equipment?.weapon,joined,panel:ui.panelName,now:performance.now(),attemptAge:performance.now()-(window._templeLastChannelAttempt||0),beamStartScheduled:beamStartTimer!==null,channelEligible:isChannelStaff(currentTunedWeapon()),paralysisUntil:world?.profile?.effects?.paralysis?.until||0,lastFrameFaultAt})};
import {PLATFORMS} from './shared/arena.js';
