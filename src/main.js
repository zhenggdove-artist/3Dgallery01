import * as THREE from 'three';
import {TempleArena} from './arena-view.js';
import {TempleNetwork} from './network.js';
import {PlayerController} from './player-controller.js';
import {TempleUI} from './ui.js';
import {PLAYER_SPAWNS} from './shared/arena.js';
import {canBuildAt} from './shared/temple-rules.js';

const canvas=document.getElementById('game'),coarse=matchMedia('(pointer:coarse)').matches,settings=loadEditorSettings();
const renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,settings.pixelRatio|| (coarse?1:1.35)));renderer.setSize(innerWidth,innerHeight,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.08,220),arena=new TempleArena(scene,renderer),ui=new TempleUI(),network=new TempleNetwork();
scene.fog=new THREE.FogExp2('#0d120e',settings.fog??.011);arena.artFloat=settings.artFloat??.17;

let assetsReady=false,joined=false,self=null,world=null,players=[],controller=null,localRoot=null,wasDead=false,last=performance.now(),externalUntil=0,toastErrorAt=0,lastAutoCoinAt=0,frameSamples=[],fps=0,fpsFrames=0,fpsAt=performance.now(),buildPlacement=null,spectatorFollowIndex=-1;
const roots=new Map(),remoteTargets=new Map(),effects=[];

boot();

async function boot(){
  try{await arena.load((value,label)=>ui.setLoading(value,label));assetsReady=true;ui.ready();camera.position.set(0,13,30);camera.lookAt(0,2,0);}
  catch(error){console.error(error);ui.setLoading(1,'Some assets could not load');ui.ready();ui.joinError(error.message);}
}

ui.addEventListener('join',async event=>{
  if(!assetsReady)return ui.joinError('Temple assets are still loading');ui.joinBusy(true);try{network.setBackend(event.detail.backendUrl);const data=await network.join(event.detail);self=data.self;world=data.world;players=data.players||[];joined=true;ui.enter(data);createLocalPlayer(data);syncPlayers();syncWorld();network.chatHistory().then(history=>history.forEach(message=>ui.addChat(message))).catch(()=>{});}
  catch(error){ui.joinError(error.message);}
});

network.addEventListener('welcome',event=>{const data=event.detail;self={...self,...data.self};world=data.world;players=data.players;syncPlayers();syncWorld();});
network.addEventListener('world',event=>{world=event.detail;ui.setWorld(world);syncWorld();});
network.addEventListener('players',event=>{players=event.detail;ui.setPlayers(players);syncPlayers();});
network.addEventListener('state',event=>{const data=event.detail;if(data.key===self?.key)return;let target=remoteTargets.get(data.key);if(!target){syncPlayers();target=remoteTargets.get(data.key);}if(target){target.position.fromArray(data.state.position);target.rotation=data.state.rotation;target.animation=data.state.animation;}});
network.addEventListener('chat',event=>ui.addChat(event.detail));
network.addEventListener('artwork-throw',event=>showThrowPulse(event.detail));
network.addEventListener('structure-destroyed',event=>arena.showStructureBreak(event.detail));
network.addEventListener('state-rejected',event=>{if(performance.now()-toastErrorAt>1200){toastErrorAt=performance.now();ui.toast(event.detail.error||'MOVEMENT REJECTED');}});
network.addEventListener('connection',event=>{if(joined)ui.toast(event.detail.connected?'REALTIME CONNECTED':'RECONNECTING…');});

ui.addEventListener('attack',()=>performAttack());ui.addEventListener('interact',()=>performInteract());ui.addEventListener('fish',()=>sendAction('fish'));
ui.addEventListener('server-action',event=>{const {action,...data}=event.detail;sendAction(action,data);});
ui.addEventListener('build-start',event=>startBuildPlacement(event.detail));ui.addEventListener('build-rotate',()=>rotateBuildPlacement());ui.addEventListener('build-confirm',()=>confirmBuildPlacement());ui.addEventListener('build-cancel',()=>cancelBuildPlacement());
ui.addEventListener('destroy-near',()=>{if(!controller)return;const position=controller.root.position.toArray(),nearest=(world?.structures||[]).map(structure=>({structure,distance:distance2d3(position,structure.position)})).sort((a,b)=>a.distance-b.distance)[0];if(!nearest||nearest.distance>12)return ui.toast('NO STRUCTURE NEARBY');sendAction('destroy',{structureId:nearest.structure.id,direction:controller.aimDirection()});});
ui.addEventListener('chat',async event=>{try{await network.chat(event.detail);}catch(error){ui.toast(error.message);}});
ui.addEventListener('plant',event=>{const p=controller?.root.position||new THREE.Vector3(),detail=typeof event.detail==='string'?{text:event.detail}:event.detail;sendAction('plant',{...detail,position:p.toArray()});});
ui.addEventListener('save-code',async()=>{try{const data=await network.createSaveCode();self.saveCode=data.code;ui.self=self;ui.renderPanel();ui.toast(`SAVE CODE · ${data.code}`);}catch(error){ui.toast(error.message);}});
ui.addEventListener('role-change',async event=>{try{const data=await network.changeRole(event.detail);cancelBuildPlacement();self={...self,...data.self,role:data.role,seat:data.seat};world=data.world;players=data.players;controller.seat=data.seat;controller.setFollowTarget(null);controller.setRole(data.role);controller.teleport(PLAYER_SPAWNS[data.seat]||PLAYER_SPAWNS[0]);ui.setSelf(self);syncPlayers();syncWorld();ui.toast(data.role==='fighter'?'FIGHTER SEAT READY':'SPECTATOR MODE · TAB TO FOLLOW');}catch(error){ui.toast(error.message);}});
ui.addEventListener('spectator-follow',event=>followSpectator(event.detail));ui.addEventListener('spectator-cycle',()=>cycleSpectator());
ui.addEventListener('panel',event=>controller?.setEnabled(!event.detail.open));
ui.addEventListener('editor-settings',event=>applyEditorSettings(event.detail));

function createLocalPlayer(data){
  localRoot=arena.createPlayer(data.self.color,data.self.profile?.admin,data.self.name);scene.add(localRoot);roots.set(data.self.key,localRoot);controller=new PlayerController({camera,arena,canvas,root:localRoot,role:data.role,seat:data.seat,mobileStick:document.getElementById('mobile-stick')});controller.setRole(data.role);controller.setEnabled(true);
}

function syncPlayers(){
  if(!self)return;const live=new Set([self.key]);for(const player of players){live.add(player.key);if(player.key===self.key)continue;let root=roots.get(player.key);if(!root){root=arena.createPlayer(player.color,false,player.name);root.name=`Player ${player.name}`;scene.add(root);roots.set(player.key,root);remoteTargets.set(player.key,{position:new THREE.Vector3(),rotation:0,animation:'idle'});}if(player.state){const target=remoteTargets.get(player.key);target.position.fromArray(player.state.position);target.rotation=player.state.rotation;target.animation=player.state.animation;root.visible=player.role==='fighter';}else root.visible=false;}
  for(const player of players){const root=roots.get(player.key);if(root)arena.setPlayerEquipment(root,player.profile?.equipment);}
  for(const [key,root] of roots)if(key!==self.key&&!live.has(key)){root.removeFromParent();roots.delete(key);remoteTargets.delete(key);}ui.setPlayers(players);
}
function syncWorld(){if(!world)return;arena.sync(world,players);ui.setWorld(world);const profile=world.profile,dead=profile?.deadUntil>Date.now();if(localRoot&&profile)arena.setPlayerEquipment(localRoot,profile.equipment);if(dead){wasDead=true;controller?.setEnabled(false);ui.death(profile.deadUntil);}else if(joined){if(wasDead&&controller){controller.teleport(PLAYER_SPAWNS[self.seat]||PLAYER_SPAWNS[0]);wasDead=false;ui.toast('RESPAWNED');}if(!ui.panelName)controller?.setEnabled(true);ui.death(0);}if(profile&&self)self.profile=profile;}

async function sendAction(action,data={}){if(!joined||!controller)return null;try{const result=await network.action(action,data);if(result.world){world=result.world;syncWorld();}if(result.notice)ui.toast(result.notice);if(result.attackEvent)showAttack(result.attackEvent);if(result.structureDestroyed)arena.showStructureBreak(result.structureDestroyed);if(result.hit?.defeated)ui.toast(`DEFEATED · ${result.hit.lostCoins} COINS DROPPED`);return result;}catch(error){if(performance.now()-toastErrorAt>400){toastErrorAt=performance.now();ui.toast(error.message);}return null;}}

function startBuildPlacement(kind){if(self?.role!=='fighter')return ui.toast('SPECTATORS CANNOT BUILD');buildPlacement={kind,rotation:controller?.root.rotation.y||0,position:controller?.buildPosition(5)||[0,0,0],valid:false};ui.toast('MOVE TO AIM · R ROTATE · E PLACE');}
function rotateBuildPlacement(){if(!buildPlacement)return;buildPlacement.rotation+=Math.PI/4;}
async function confirmBuildPlacement(){if(!buildPlacement||!controller)return;if(!buildPlacement.valid)return ui.toast('CANNOT BUILD HERE');const result=await sendAction('build',{kind:buildPlacement.kind,position:buildPlacement.position,rotation:buildPlacement.rotation});if(result)cancelBuildPlacement();}
function cancelBuildPlacement(){buildPlacement=null;arena.clearBuildPreview();ui.clearBuildMode();}
function followSpectator(key){if(self?.role!=='spectator')return;const target=key?roots.get(key):null;controller.setFollowTarget(target||null);spectatorFollowIndex=players.filter(player=>player.role==='fighter').findIndex(player=>player.key===key);ui.toast(target?`FOLLOWING ${players.find(player=>player.key===key)?.name||'FIGHTER'}`:'FREE SPECTATOR CAMERA');}
function cycleSpectator(){if(self?.role!=='spectator')return;const fighters=players.filter(player=>player.role==='fighter'&&roots.get(player.key));if(!fighters.length)return followSpectator('');spectatorFollowIndex=(spectatorFollowIndex+1)%fighters.length;followSpectator(fighters[spectatorFollowIndex].key);}

function performAttack(){if(!controller||self?.role!=='fighter')return;const near=arena.nearest(controller.root.position.toArray()),direction=controller.aimDirection();if(near?.type==='structure'&&near.distance<3.8)return sendAction('destroy',{structureId:near.id,direction});if(world?.monster?.active&&distance2d3(controller.root.position.toArray(),world.monster.position)<18)return sendAction('monster-hit');sendAction('attack',{direction});}
function performInteract(){if(!controller||self?.role!=='fighter')return;const held=Object.entries(world?.artworks||{}).find(([,art])=>art.holder===self.key);if(held)return sendAction('throw-artwork',{direction:controller.aimDirection(),power:1});const near=arena.nearest(controller.root.position.toArray());if(!near)return ui.toast('NOTHING WITHIN REACH');if(near.type==='coin')sendAction('pickup-coin',{platformId:near.id});if(near.type==='drop')sendAction('pickup-drop',{dropId:near.id});if(near.type==='artwork')sendAction('pickup-artwork',{platformId:near.id});if(near.type==='plant'){const plant=(world?.plants||[]).find(entry=>entry.id===near.id);if(plant)ui.showPlant(plant);}}

function update(dt,time){
  if(joined&&controller){const state=controller.update(dt);arena.setPlayerAnimation(localRoot,state.animation);network.sendState(state);for(const [key,target] of remoteTargets){const root=roots.get(key);if(!root)continue;root.position.lerp(target.position,1-Math.exp(-dt*11));root.rotation.y=lerpAngle(root.rotation.y,target.rotation,1-Math.exp(-dt*12));arena.setPlayerAnimation(root,target.animation);}const near=arena.nearest(localRoot.position.toArray()),holding=Object.values(world?.artworks||{}).some(art=>art.holder===self.key);ui.setNear(near,holding);if(buildPlacement){buildPlacement.position=controller.buildPosition(5);buildPlacement.valid=canBuildAt(world,controller.root.position.toArray(),buildPlacement.position);arena.setBuildPreview(buildPlacement.kind,buildPlacement.position,buildPlacement.rotation,buildPlacement.valid);}if(self?.role==='fighter'&&near?.type==='coin'&&performance.now()-lastAutoCoinAt>900){lastAutoCoinAt=performance.now();sendAction('pickup-coin',{platformId:near.id});}const profile=world?.profile;if(profile?.deadUntil>Date.now())ui.death(profile.deadUntil);}
  arena.update(dt,time,camera,roots);for(let i=effects.length-1;i>=0;i--){const effect=effects[i];effect.age+=dt;effect.material.opacity=Math.max(0,1-effect.age/effect.duration);effect.scale.setScalar(1+effect.age*3);if(effect.age>=effect.duration){effect.removeFromParent();effect.geometry.dispose();effect.material.dispose();effects.splice(i,1);}}
}

function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(now>externalUntil)update(dt,now/1000);renderer.render(scene,camera);frameSamples.push(dt*1000);if(frameSamples.length>180)frameSamples.shift();fpsFrames++;if(now-fpsAt>1000){fps=fpsFrames*1000/(now-fpsAt);fpsFrames=0;fpsAt=now;}}
requestAnimationFrame(frame);

function showAttack(event){const start=new THREE.Vector3(...event.origin).add(new THREE.Vector3(0,1.1,0)),end=start.clone().add(new THREE.Vector3(...event.direction).multiplyScalar(4)),geometry=new THREE.BufferGeometry().setFromPoints([start,end]),material=new THREE.LineBasicMaterial({color:'#f0d276',transparent:true,opacity:.95}),line=new THREE.Line(geometry,material);line.age=0;line.duration=.24;scene.add(line);effects.push(line);}
function showThrowPulse(event){const geometry=new THREE.RingGeometry(.5,.7,24),material=new THREE.MeshBasicMaterial({color:'#e2c96e',transparent:true,opacity:.8,side:THREE.DoubleSide}),ring=new THREE.Mesh(geometry,material);ring.position.fromArray(event.origin);ring.lookAt(camera.position);ring.age=0;ring.duration=.5;scene.add(ring);effects.push(ring);}
function applyEditorSettings(next){renderer.setPixelRatio(Math.min(devicePixelRatio,next.pixelRatio));renderer.setSize(innerWidth,innerHeight,false);scene.fog.density=next.fog;arena.artFloat=next.artFloat;}
function loadEditorSettings(){try{return JSON.parse(localStorage.getItem('temple-editor-settings')||'{}');}catch{return {};}}
function lerpAngle(a,b,t){let d=(b-a+Math.PI)%(Math.PI*2)-Math.PI;if(d<-Math.PI)d+=Math.PI*2;return a+d*t;}
function distance2d3(a,b){return Math.hypot(a[0]-b[0],a[2]-b[2]);}

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false);});
addEventListener('pagehide',()=>network.close());

window.render_game_to_text=()=>JSON.stringify({mode:joined?'play':'entry',name:self?.name||null,role:self?.role||null,connected:network.socket?.readyState===WebSocket.OPEN,position:controller?.root.position.toArray().map(n=>+n.toFixed(2))||null,players:players.map(p=>({name:p.name,role:p.role,seat:p.seat})),economy:{wallet:world?.profile?.wallet??null,inventory:world?.profile?.inventory?.length||0,groundDrops:world?.groundDrops?.length||0,platformCoins:Object.values(world?.coins||{}).filter(c=>c.available).length,platformCoinTotal:Object.keys(world?.coins||{}).length},artworks:{total:arena.artworks.size,available:Object.values(world?.artworks||{}).filter(a=>!a.holder&&Date.now()>=(a.availableAt||0)).length},monster:world?.monster?.active?{variant:world.monster.variant,hp:world.monster.hp}:null,render:{fps:+fps.toFixed(1),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),frameMs:+(frameSamples.reduce((a,b)=>a+b,0)/Math.max(1,frameSamples.length)).toFixed(2)},editorShortcut:'Shift+Y'});
window.advanceTime=milliseconds=>{externalUntil=performance.now()+120;const steps=Math.ceil(milliseconds/16.6667);for(let i=0;i<steps;i++)update(Math.min(.05,milliseconds/steps/1000),(performance.now()+i*milliseconds/steps)/1000);renderer.render(scene,camera);};
