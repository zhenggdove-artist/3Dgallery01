import * as THREE from 'three';
import {equipmentPortrait} from './equipment-portrait.js';
import {setHealthBar,faceHealthBar} from './health-bars.js';
import {attackDirection} from './aiming.js';
import {uploadArtwork} from './artwork-upload.js';
import {VitalModels} from './vital-models.js';
import {createVHS} from './reletter-vhs.js';
import {TempleArena} from './arena-view.js';
import {TempleNetwork} from './network.js';
import {PlayerController} from './player-controller.js';
import {TempleUI} from './ui.js';
import {PLAYER_SPAWNS} from './shared/arena.js';
import {canBuildAt} from './shared/temple-rules.js';
import {itemById,ITEMS,EQUIPPABLE_SLOTS} from './shared/catalog.js';
import {ArtworkEditor} from './artwork-editor.js';
import {uploadMedia} from './media-ui.js';

import {GunController} from './gun-controller.js';
import {Minimap} from './minimap.js';
import {createDamageNumbers} from './reletter/damage-numbers.js';

const canvas=document.getElementById('game'),coarse=matchMedia('(pointer:coarse)').matches,settings=loadEditorSettings();
const renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,settings.pixelRatio|| (coarse?1:1.35)));renderer.setSize(innerWidth,innerHeight,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,1000),arena=new TempleArena(scene,renderer),ui=new TempleUI(),network=new TempleNetwork();
const vhs=createVHS(renderer);
arena.artFloat=settings.artFloat??.17;

let vitalModels=null;
let assetsReady=false,joined=false,self=null,world=null,players=[],controller=null,localRoot=null,wasDead=false,last=performance.now(),externalUntil=0,toastErrorAt=0,lastAutoCoinAt=0,frameSamples=[],fps=0,fpsFrames=0,fpsAt=performance.now(),buildPlacement=null,spectatorFollowIndex=-1;
const roots=new Map(),remoteTargets=new Map(),effects=[];
const minimap=new Minimap();
const damageNumbers=createDamageNumbers(THREE);
const performanceSamples={logic:[],submit:[],frame:[]};
let chargeStarted=null,chargeRequest=null,autoChargeBusy=false,attackHeld=false;
const gun=new GunController({canvas,camera,controller:()=>controller,weapon:()=>itemById(world?.profile?.equipment?.weapon),ui,attack:performAttack});
const artEditor=new ArtworkEditor({scene,camera,canvas,arena,player:()=>localRoot,isGM:()=>!!self?.profile?.admin,send:sendAction,control:enabled=>{if(controller){controller.setEnabled(enabled&&!ui.panelName&&!wasDead);controller.cameraLocked=!!artEditor.mode&&artEditor.mode!=='follow';}},toast:text=>ui.toast(text)});

let portraitSignature='',portraitURL='';ui.addEventListener('equipment-portrait',()=>{const signature=JSON.stringify([world?.profile?.equipment,self?.color]);if(signature!==portraitSignature){portraitURL=equipmentPortrait(renderer,localRoot);portraitSignature=signature;}const image=document.getElementById('bag-portrait');if(image)image.src=portraitURL;});
boot();

async function boot(){
  const started=performance.now(),timings=window.templeLoadTimings={};
  try{const [published,layout]=await Promise.all([fetch('./temple-layout.json').then(r=>r.ok?r.json():{}),fetch('./temple-artwork-layout.json').then(r=>r.json())]);Object.assign(settings,published.settings||{},loadEditorSettings());arena.defaultLayout=layout.artworkLayout||{};timings.configMs=performance.now()-started;const assetStart=performance.now(),warmStart=performance.now(),warmTask=arena.presentation.vfx.warm(renderer,camera).then(result=>{timings.effects=result;timings.effectsMs=performance.now()-warmStart;});await Promise.all([arena.load((value,label)=>ui.setLoading(value,label)),document.fonts.load('bold 48px GoldenGirdle')]);vitalModels=new VitalModels(arena.coinMesh.geometry,arena.coinMesh.material);timings.assetsMs=performance.now()-assetStart;ui.setLoading(.9,'Preparing 00GameDevs weapon effects');await warmTask;applyEditorSettings({pixelRatio:settings.pixelRatio||(coarse?1:1.35),fog:settings.fog??.0008,artFloat:settings.artFloat??.17});camera.position.set(0,13,30);camera.lookAt(0,2,0);ui.setLoading(.99,'Preparing scene shaders');const compileStart=performance.now();await renderer.compileAsync(scene,camera);timings.sceneCompileMs=performance.now()-compileStart;timings.totalMs=performance.now()-started;ui.setLoading(1,'100% · Ready');assetsReady=true;ui.ready();}
  catch(error){console.error(error);ui.setLoading(0,'Loading failed · reload to retry: '+error.message);ui.joinError(error.message);}
}

ui.addEventListener('join',async event=>{
  if(!assetsReady)return ui.joinError('Temple assets are still loading');ui.joinBusy(true);try{network.setBackend(event.detail.backendUrl);const data=await network.join(event.detail);arena.world=data.world;await arena.loadCustomArtworks(data.world.customArtworks,network.base);self=data.self;world=data.world;players=data.players||[];joined=true;ui.enter(data);createLocalPlayer(data);syncPlayers();syncWorld();network.chatHistory().then(history=>history.forEach(message=>ui.addChat(message))).catch(()=>{});}
  catch(error){ui.joinError(error.message);}
});

network.addEventListener('welcome',event=>{const data=event.detail;self={...self,...data.self};world=data.world;players=data.players;syncPlayers();syncWorld();});
network.addEventListener('world',event=>{world=event.detail;ui.setWorld(world);syncWorld();});
network.addEventListener('players',event=>{players=event.detail;ui.setPlayers(players);syncPlayers();});
network.addEventListener('state',event=>{const data=event.detail;if(data.key===self?.key)return;let target=remoteTargets.get(data.key);if(!target){syncPlayers();target=remoteTargets.get(data.key);}if(target){target.position.fromArray(data.state.position);target.rotation=data.state.rotation;target.animation=data.state.animation;}});
network.addEventListener('chat',event=>ui.addChat(event.detail));
network.addEventListener('artwork-throw',event=>showThrowPulse(event.detail));
network.addEventListener('attack',event=>showAttack(event.detail));
network.addEventListener('structure-destroyed',event=>arena.showStructureBreak(event.detail));
network.addEventListener('state-rejected',event=>{if(performance.now()-toastErrorAt>1200){toastErrorAt=performance.now();ui.toast(event.detail.error||'MOVEMENT REJECTED');}});
network.addEventListener('connection',event=>{if(joined)ui.toast(event.detail.connected?'REALTIME CONNECTED':'RECONNECTING…');});

ui.addEventListener('attack',()=>performAttack());ui.addEventListener('interact',()=>performInteract());ui.addEventListener('fish',()=>ui.openPanel('fishing'));
ui.addEventListener('upload-artwork',async event=>{if(!self?.profile?.admin)return;const button=ui.content.querySelector('[data-upload-submit]');if(button)button.disabled=true;try{ui.toast('VALIDATING ARTWORK…');const upload=await uploadArtwork(network,event.detail),position=controller.buildPosition(4);position[1]+=2;const result=await sendAction('add-artwork',{artwork:{...upload,position,appearance:{depth:.1}}});if(!result)throw Error('Artwork was not published. Retry after checking the connection.');await arena.loadCustomArtworks(world.customArtworks,network.base);ui.closePanel();artEditor.select(arena.artworks.get(result.artwork.id));ui.toast('ARTWORK PUBLISHED · EDIT POSITION / SURFACE');}catch(error){ui.toast(error.message);const status=ui.content.querySelector('[data-upload-status]');if(status)status.textContent=error.message;}finally{if(button)button.disabled=false;}});
ui.addEventListener('use-item',event=>{const item=itemById(event.detail);if(!item||!controller)return;const position=controller.buildPosition(item.slot==='pond'?7:3);position[1]=0;if(item.slot==='seed'){ui.closePanel();sendAction('seed-plant',{item:item.id,position});}else if(item.slot==='harvest')sendAction('harvest-eat',{item:item.id});else if(item.slot==='pond'){ui.closePanel();sendAction('pond-build',{position,size:'small'});}else ui.toast('Use this material in BAG → FUSION');});
ui.addEventListener('original-action',event=>{const body={...event.detail};if(body.action==='dig'){body.position=controller.buildPosition(4);body.position[1]=0;}sendAction(body.action,body);});
let fishingPollBusy=false;setInterval(async()=>{const s=world?.reletter?.fishing?.sessions?.[self?.key];if(!s||!['waiting','fight'].includes(s.stage)||fishingPollBusy)return;fishingPollBusy=true;try{await sendAction('reel',{id:s.id,reeling:!!ui.reeling&&ui.panelName==='fishing'});}finally{fishingPollBusy=false;}},250);
ui.addEventListener('jump',()=>controller?.jump());
ui.addEventListener('aim',()=>gun.cycle());
ui.addEventListener('attack-start',()=>{if(!controller?.enabled||self?.role!=='fighter'||chargeStarted!==null)return;attackHeld=true;chargeStarted=performance.now();chargeRequest=sendAction('attack',{phase:'charge'});});
ui.addEventListener('attack-release',async()=>{attackHeld=false;if(chargeStarted===null)return;const charge=Math.min(1,(performance.now()-chargeStarted)/(itemById(world?.profile?.equipment?.weapon)?.chargeMs||1500));chargeStarted=null;await chargeRequest;performAttack(charge);});
ui.addEventListener('attack-cancel',()=>{attackHeld=false;chargeStarted=null;});
ui.addEventListener('server-action',event=>{const {action,...data}=event.detail;sendAction(action,data);});
ui.addEventListener('build-start',async event=>{try{const d=event.detail;const media=d.file?await uploadMedia(network,d.file):null;startBuildPlacement(d.kind,media?.id);}catch(error){ui.clearBuildMode();ui.toast(error.message);}});ui.addEventListener('build-rotate',()=>rotateBuildPlacement());ui.addEventListener('build-confirm',()=>confirmBuildPlacement());ui.addEventListener('build-cancel',()=>cancelBuildPlacement());
ui.addEventListener('destroy-near',()=>{if(!controller)return;const position=controller.root.position.toArray(),nearest=(world?.structures||[]).map(structure=>({structure,distance:distance2d3(position,structure.position)})).sort((a,b)=>a.distance-b.distance)[0];if(!nearest||nearest.distance>12)return ui.toast('NO STRUCTURE NEARBY');sendAction('destroy',{structureId:nearest.structure.id,direction:controller.aimDirection()});});
ui.addEventListener('chat',async event=>{try{await network.chat(event.detail);}catch(error){ui.toast(error.message);}});
ui.addEventListener('plant',async event=>{const p=controller?.root.position||new THREE.Vector3(),detail={...event.detail};try{ui.toast('SAVING MESSAGE…');if(detail.file)detail.media=await uploadMedia(network,detail.file);delete detail.file;const r=await sendAction('plant',{...detail,position:p.toArray()});if(r)ui.closePanel();}catch(error){ui.toast(error.message);}});
ui.addEventListener('save-code',async()=>{try{const data=await network.createSaveCode();self.saveCode=data.code;ui.self=self;ui.renderPanel();ui.toast(`SAVE CODE · ${data.code}`);}catch(error){ui.toast(error.message);}});
ui.addEventListener('role-change',async event=>{try{const data=await network.changeRole(event.detail);cancelBuildPlacement();self={...self,...data.self,role:data.role,seat:data.seat};world=data.world;players=data.players;controller.seat=data.seat;controller.setFollowTarget(null);controller.setRole(data.role);controller.teleport(PLAYER_SPAWNS[data.seat]||PLAYER_SPAWNS[0]);ui.setSelf(self);syncPlayers();syncWorld();ui.toast(data.role==='fighter'?'FIGHTER SEAT READY':'SPECTATOR MODE · TAB TO FOLLOW');}catch(error){ui.toast(error.message);}});
ui.addEventListener('spectator-follow',event=>followSpectator(event.detail));ui.addEventListener('spectator-cycle',()=>cycleSpectator());
ui.addEventListener('panel',event=>{chargeStarted=null;controller?.setEnabled(!event.detail.open&&!artEditor.mode);});
ui.addEventListener('editor-settings',event=>applyEditorSettings(event.detail));

function createLocalPlayer(data){
  localRoot=arena.createPlayer(data.self.color,data.self.profile?.admin,data.self.name);scene.add(localRoot);roots.set(data.self.key,localRoot);controller=new PlayerController({camera,arena,canvas,root:localRoot,role:data.role,seat:data.seat,mobileStick:document.getElementById('mobile-stick')});controller.setRole(data.role);controller.setEnabled(true);
}

function syncPlayers(){
  if(!self)return;const live=new Set([self.key]);for(const player of players){live.add(player.key);if(player.key===self.key)continue;let root=roots.get(player.key);if(!root){root=arena.createPlayer(player.color,false,player.name);root.name=`Player ${player.name}`;scene.add(root);roots.set(player.key,root);remoteTargets.set(player.key,{position:new THREE.Vector3(),rotation:0,animation:'idle'});}if(player.state){const target=remoteTargets.get(player.key);target.position.fromArray(player.state.position);target.rotation=player.state.rotation;target.animation=player.state.animation;root.visible=player.role==='fighter';}else root.visible=false;}
  for(const player of players){const root=roots.get(player.key);if(root){arena.setPlayerEquipment(root,player.profile?.equipment);if(root!==localRoot)setHealthBar(root,player.profile?.hp,player.profile?.maxHp);root.userData.deadUntil=player.profile?.deadUntil||0;applyHitReaction(root,player.profile);}}
  for(const [key,root] of roots)if(key!==self.key&&!live.has(key)){root.removeFromParent();roots.delete(key);remoteTargets.delete(key);}ui.setPlayers(players);
}
function applyHitReaction(root,profile){const hit=profile?.hitReaction;if(!root||!hit||root.userData.lastHitReaction===hit.id||Date.now()-hit.time>2500)return;root.userData.lastHitReaction=hit.id;root.userData.hitFlashUntil=performance.now()+250;if(root===localRoot){controller.stunUntil=performance.now()+100;controller.knockback=new THREE.Vector3(...hit.vector).multiplyScalar(4);}}
function syncWorld(){if(!world)return;arena.loadCustomArtworks(world.customArtworks,network.base).catch(error=>ui.toast(error.message));damageNumbers.receive(world.damageEvents);arena.sync(world,players);ui.setWorld(world);const profile=world.profile,dead=profile?.deadUntil>Date.now();if(localRoot&&profile){arena.setPlayerEquipment(localRoot,profile.equipment);localRoot.userData.deadUntil=profile.deadUntil||0;applyHitReaction(localRoot,profile);controller.stats=profile.stats||{speed:1,jump:1,gravity:1};if(profile.impulse&&controller.lastImpulse!==profile.impulse.id){controller.lastImpulse=profile.impulse.id;controller.knockback=new THREE.Vector3(...profile.impulse.vector).multiplyScalar(5);}}if(dead){wasDead=true;controller?.setEnabled(false);ui.death(profile.deadUntil);}else if(joined){if(wasDead&&controller){controller.teleport(PLAYER_SPAWNS[self.seat]||PLAYER_SPAWNS[0]);wasDead=false;ui.toast('RESPAWNED');}if(!ui.panelName&&!artEditor.mode)controller?.setEnabled(true);ui.death(0);}if(profile&&self)self.profile=profile;}

async function sendAction(action,data={}){if(!joined||!controller)return null;try{const result=await network.action(action,data);if(result.world){world=result.world;syncWorld();}if(result.notice)ui.toast(result.notice);if(result.attackEvent)showAttack(result.attackEvent);if(result.structureDestroyed)arena.showStructureBreak(result.structureDestroyed);if(result.hit?.defeated)ui.toast(`DEFEATED · ${result.hit.lostCoins} COINS DROPPED`);return result;}catch(error){if(performance.now()-toastErrorAt>400){toastErrorAt=performance.now();ui.toast(error.message);}return null;}}

function startBuildPlacement(kind,surface=null){if(self?.role!=='fighter')return ui.toast('SPECTATORS CANNOT BUILD');buildPlacement={kind,surface,rotation:controller?.root.rotation.y||0,position:controller?.buildPosition(5)||[0,0,0],valid:false};ui.toast('MOVE TO AIM · R ROTATE · E PLACE');}
function rotateBuildPlacement(){if(!buildPlacement)return;buildPlacement.rotation+=Math.PI/4;}
async function confirmBuildPlacement(){if(!buildPlacement||!controller)return;if(!buildPlacement.valid)return ui.toast('CANNOT BUILD HERE');const result=await sendAction('build',{kind:buildPlacement.kind,surface:buildPlacement.surface,position:buildPlacement.position,rotation:buildPlacement.rotation});if(result)cancelBuildPlacement();}
function cancelBuildPlacement(){buildPlacement=null;arena.clearBuildPreview();ui.clearBuildMode();}
function followSpectator(key){if(self?.role!=='spectator')return;const target=key?roots.get(key):null;controller.setFollowTarget(target||null);spectatorFollowIndex=players.filter(player=>player.role==='fighter').findIndex(player=>player.key===key);ui.toast(target?`FOLLOWING ${players.find(player=>player.key===key)?.name||'FIGHTER'}`:'FREE SPECTATOR CAMERA');}
function cycleSpectator(){if(self?.role!=='spectator')return;const fighters=players.filter(player=>player.role==='fighter'&&roots.get(player.key));if(!fighters.length)return followSpectator('');spectatorFollowIndex=(spectatorFollowIndex+1)%fighters.length;followSpectator(fighters[spectatorFollowIndex].key);}

function performAttack(charge=0){if(!controller?.enabled||performance.now()<(controller.stunUntil||0)||self?.role!=='fighter'||ui.panelName)return;const direction=gun.mode?gun.shotDirection().toArray():attackDirection(controller,camera,arena,roots,itemById(world?.profile?.equipment?.weapon)||itemById('water'),charge);return sendAction('attack',{direction,charge});}
function performInteract(){if(!controller||self?.role!=='fighter')return;const held=Object.entries(world?.artworks||{}).find(([,art])=>art.holder===self.key);if(held)return sendAction('throw-artwork',{direction:controller.aimDirection(),power:1});const near=arena.nearest(controller.root.position.toArray());if(!near)return ui.toast('NOTHING WITHIN REACH');if(near.type==='coin')sendAction('pickup-coin',{platformId:near.id});if(near.type==='drop')sendAction('pickup-drop',{dropId:near.id});if(near.type==='artwork')sendAction('pickup-artwork',{platformId:near.id});if(near.type==='plant'){const plant=(world?.plants||[]).find(entry=>entry.id===near.id);if(plant)ui.showPlant(plant);}}

function update(dt,time){
  damageNumbers.update(camera,innerWidth,innerHeight);vitalModels?.update(time,world?.profile?.hp||0,world?.profile?.maxHp||100);
  if(joined)minimap.update(time,roots,self?.key,world?.monster);
  if(joined&&controller){const state=controller.update(dt);arena.setPlayerAnimation(localRoot,state.animation);network.sendState(state);for(const [key,target] of remoteTargets){const root=roots.get(key);if(!root)continue;root.position.lerp(target.position,1-Math.exp(-dt*11));root.rotation.y=lerpAngle(root.rotation.y,target.rotation,1-Math.exp(-dt*12));arena.setPlayerAnimation(root,target.animation);}const near=arena.nearest(localRoot.position.toArray()),holding=Object.values(world?.artworks||{}).some(art=>art.holder===self.key);ui.setNear(near,holding);if(buildPlacement){buildPlacement.position=controller.buildPosition(5);buildPlacement.valid=canBuildAt(world,controller.root.position.toArray(),buildPlacement.position);arena.setBuildPreview(buildPlacement.kind,buildPlacement.position,buildPlacement.rotation,buildPlacement.valid);}if(self?.role==='fighter'&&performance.now()-lastAutoCoinAt>300){const p=localRoot.position;const coin=PLATFORMS.find(c=>world?.coins?.[c.id]?.available&&p.distanceTo(new THREE.Vector3(...c.coinPosition))<2.2),drop=world?.groundDrops?.find(d=>p.distanceTo(new THREE.Vector3(...d.position))<2.2&&(d.kind!=='heart'||world.profile.hp<world.profile.maxHp)&&!(d.owner===self.key&&Date.now()<d.ownerLockedUntil));if(coin||drop){lastAutoCoinAt=performance.now();if(coin)sendAction('pickup-coin',{platformId:coin.id});else sendAction('pickup-drop',{dropId:drop.id});}}const profile=world?.profile;if(profile?.deadUntil>Date.now())ui.death(profile.deadUntil);}
  arena.update(dt,time,camera,roots);for(const root of roots.values())faceHealthBar(root,camera);if(arena.monster&&world?.monster){setHealthBar(arena.monster,world.monster.hp,world.monster.maxHp,2.1);faceHealthBar(arena.monster,camera);}gun.update();gun.pose(arena.presentation);const charge=chargeStarted===null?0:Math.min(1,(performance.now()-chargeStarted)/(itemById(world?.profile?.equipment?.weapon)?.chargeMs||1500));if(charge>=1&&itemById(world?.profile?.equipment?.weapon)?.autoCharge&&!autoChargeBusy){autoChargeBusy=true;const pending=chargeRequest;chargeStarted=null;Promise.resolve(pending).then(async()=>{await performAttack(1);if(attackHeld&&controller?.enabled&&!ui.panelName){chargeStarted=performance.now();chargeRequest=sendAction('attack',{phase:'charge'});}}).finally(()=>autoChargeBusy=false);}arena.presentation.charging(localRoot,charge);const attackButton=document.getElementById('attack-button');attackButton.classList.toggle('charging',charge>0);attackButton.style.setProperty('--charge',`${charge*100}%`);artEditor.update();for(let i=effects.length-1;i>=0;i--){const effect=effects[i];effect.age+=dt;effect.material.opacity=Math.max(0,1-effect.age/effect.duration);effect.scale.setScalar(1+effect.age*3);if(effect.age>=effect.duration){effect.removeFromParent();effect.geometry.dispose();effect.material.dispose();effects.splice(i,1);}}
}

function frame(now){requestAnimationFrame(frame);const elapsed=now-last,dt=Math.min(.05,elapsed/1000);last=now;if(!assetsReady)return;const started=performance.now();if(now>externalUntil)update(dt,now/1000);const updated=performance.now();vhs.render(scene,camera,performance.now()/1000);const ended=performance.now();for(const [key,value] of [['frame',elapsed],['logic',updated-started],['submit',ended-updated]]){performanceSamples[key].push(value);if(performanceSamples[key].length>240)performanceSamples[key].shift();}frameSamples.push(elapsed);if(frameSamples.length>180)frameSamples.shift();fpsFrames++;if(now-fpsAt>1000){fps=fpsFrames*1000/(now-fpsAt);fpsFrames=0;fpsAt=now;}}
requestAnimationFrame(frame);

function showAttack(event){arena.presentation.play(event,roots.get(event.owner));}
function showThrowPulse(event){const geometry=new THREE.RingGeometry(.5,.7,24),material=new THREE.MeshBasicMaterial({color:'#e2c96e',transparent:true,opacity:.8,side:THREE.DoubleSide}),ring=new THREE.Mesh(geometry,material);ring.position.fromArray(event.origin);ring.lookAt(camera.position);ring.age=0;ring.duration=.5;scene.add(ring);effects.push(ring);}
function applyEditorSettings(next){renderer.setPixelRatio(Math.min(devicePixelRatio,next.pixelRatio));renderer.setSize(innerWidth,innerHeight,false);scene.fog.density=next.fog;arena.artFloat=next.artFloat;}
function loadEditorSettings(){try{return JSON.parse(localStorage.getItem('temple-editor-settings')||'{}');}catch{return {};}}
function lerpAngle(a,b,t){let d=(b-a+Math.PI)%(Math.PI*2)-Math.PI;if(d<-Math.PI)d+=Math.PI*2;return a+d*t;}
function distance2d3(a,b){return Math.hypot(a[0]-b[0],a[2]-b[2]);}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);});
addEventListener('pagehide',()=>network.close());

window.render_game_to_text=()=>JSON.stringify({mode:joined?'play':'entry',name:self?.name||null,role:self?.role||null,connected:network.socket?.readyState===WebSocket.OPEN,position:controller?.root.position.toArray().map(n=>+n.toFixed(2))||null,players:players.map(p=>({name:p.name,role:p.role,seat:p.seat})),economy:{wallet:world?.profile?.wallet??null,inventory:world?.profile?.inventory?.length||0,groundDrops:world?.groundDrops?.length||0,platformCoins:Object.values(world?.coins||{}).filter(c=>c.available).length,platformCoinTotal:Object.keys(world?.coins||{}).length},artworks:{total:arena.artworks.size,available:Object.values(world?.artworks||{}).filter(a=>!a.holder&&Date.now()>=(a.availableAt||0)).length},monster:world?.monster?.active?{variant:world.monster.variant,hp:world.monster.hp}:null,render:{fps:+fps.toFixed(1),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),gunMode:gun.mode,frameMs:+(frameSamples.reduce((a,b)=>a+b,0)/Math.max(1,frameSamples.length)).toFixed(2)},editorShortcut:'Shift+Y'});
window.advanceTime=milliseconds=>{externalUntil=performance.now()+120;const steps=Math.ceil(milliseconds/16.6667);for(let i=0;i<steps;i++)update(Math.min(.05,milliseconds/steps/1000),(performance.now()+i*milliseconds/steps)/1000);vhs.render(scene,camera,performance.now()/1000);};
if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname))window.templeTest={arena,camera,renderer,ui,gun,editor:artEditor,controller:()=>controller,network,roots,items:ITEMS,slots:EQUIPPABLE_SLOTS,performanceSamples,vitals:()=>vitalModels,hit:applyHitReaction};
import {PLATFORMS} from './shared/arena.js';
