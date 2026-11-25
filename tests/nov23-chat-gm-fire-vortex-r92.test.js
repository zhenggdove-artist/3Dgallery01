import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createInitialWorld,setArtworkLayout} from '../src/shared/temple-rules.js';
import {APPEARANCE_DEFAULTS} from '../src/shared/artwork-library.js';
import {PLATFORMS} from '../src/shared/arena.js';
import {editorPanelMarkup} from '../src/art-editor-panel.js';
import {GameAudio} from '../src/game-audio.js';
import {NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('CHAT long press works on all non-interactive portions of the mouse or touch panel after 1000 ms',()=>{
 const s=source('src/chat-layout.js');
 assert.match(s,/DRAG_HOLD_MS=1000/);
 assert.match(s,/panel\.addEventListener\('pointerdown'/);
 assert.match(s,/panel\.addEventListener\('touchstart'/);
 assert.match(s,/e\.target\.closest\('button,input,textarea,select,form'\)/);
 assert.match(s,/panel\.setPointerCapture\(e\.pointerId\)/);
 assert.match(s,/if\(active\.mode==='move'\)save\(\)/);
 assert.doesNotMatch(s,/handle\.addEventListener\('pointerdown'/);
});
test('GM artwork editor shows name + title background for both original and uploaded art',()=>{
 for(const originalArtwork of [true,false]){
  const html=editorPanelMarkup({...APPEARANCE_DEFAULTS,labelBackground:'#287ab1'},3,originalArtwork,'The Title');
  assert.match(html,/data-art-title/);
  assert.match(html,/data-appearance="labelBackground"/);
  assert.match(html,/value="#287ab1"/);
  assert.match(html,/value="The Title"/);
  if(originalArtwork)assert.match(html,/data-platform-radius/);
 }
 const s=source('src/artwork-editor.js');
 assert.match(s,/title:this\.title\.trim\(\)/);
 assert.match(s,/root\.userData\.titleOverride=this\.title\.trim\(\)/);
});
test('server accepts an original gallery title and hex label color, persists it, and preserves revision safety',()=>{
 const world=createInitialWorld(1000),id=PLATFORMS[0].id;
 const current={position:[...PLATFORMS[0].artPosition],rotation:[0,0,0],scale:[1,1,1],appearance:{...APPEARANCE_DEFAULTS},revision:1,updatedAt:1000};
 world.artworkLayout[id]=current;
 const layout={...current,title:'Unfinished Hours',appearance:{...current.appearance,labelBackground:'#2468ac'}};
 const saved=setArtworkLayout(world,{admin:true},{platformId:id,expectedRevision:1,layout},2000);
 assert.equal(saved.error,undefined,saved.error);
 assert.equal(saved.artworkLayout.title,'Unfinished Hours');
 assert.equal(saved.artworkLayout.appearance.labelBackground,'#2468ac');
 assert.equal(world.artworkLayout[id].revision,2);
 const conflict=setArtworkLayout(world,{admin:true},{platformId:id,expectedRevision:1,layout},3000);
 assert.match(conflict.error,/Layout changed/);
 assert.equal(world.artworkLayout[id].revision,2);
});
test('fire weapon uses filtered noise hiss rather than the low oscillator and generic impact drum',()=>{
 const calls=[];
 const fake={context:{state:'running',currentTime:3},muted:false,voices:0,last:{},played:{},volumes:{},
  playFireHiss:(ctx,time,amplitude)=>calls.push({ctx,time,amplitude})};
 GameAudio.prototype.play.call(fake,'fire',.8,1);
 assert.equal(calls.length,1);
 assert.equal(calls[0].time,3);
 const audio=source('src/game-audio.js'),main=source('src/main.js');
 assert.match(audio,/source\.loop=true/);
 assert.match(audio,/high\.type='highpass'/);
 assert.match(audio,/spray\.type='bandpass'/);
 assert.match(main,/event\.ultimate&&item\?\.family!=='fire'/);
});
test('native flame shaders preserve geometry while setting flame transparency to 60 percent (alpha 0.4)',()=>{
 const s=source('src/numbered-weapon-effects.js');
 assert.match(s,/node\.userData\?\.animeFlameLayer/);
 assert.match(s,/gl_FragColor\.a \*= 0\.4/);
 assert.match(s,/m\.transparent=true;m\.depthWrite=false/);
 assert.match(s,/m\.userData\.templeFireOpacity=\.4/);
});
test('one upright vortex instance per authoritative flight; repeat pulses do not reset it',()=>{
 const scene=new THREE.Scene();
 const effects=new NumberedWeaponEffects(scene,()=>new THREE.Vector3(0,1,0));
 let acquireCount=0;
 const advance=[];
 effects.acquire=()=>{acquireCount++;return {
  group:new THREE.Group(),lifecycle:{start:1.1},
  update:dt=>advance.push(dt),reset(){},stop(){},dispose(){}
 };};
 effects.align=e=>{e.fx.group.position.copy(e.origin);};
 const root=new THREE.Group(),item={id:'conch-weapon',family:'wave',cooldown:650};
 root.userData={staffCasting:true,equipment:{weapon:item.id}};
 const event={channel:true,owner:'gm',origin:[0,1,0],direction:[0,0,1],range:21,persistentAttackId:'vortex-1'};
 assert.equal(effects.play(event,item,root),true);
 assert.equal(effects.active.length,1);
 assert.equal(effects.active[0].cycles,null);
 assert.ok(advance[0]>=1.1,'first frame enters the stable native vortex phase');
 assert.equal(effects.play({...event,origin:[.2,1,0]},item,root),true);
 assert.equal(acquireCount,1,'network damage pulse must not allocate a second vortex');
 effects.update(.016,null,{vortexes:[{id:'vortex-1',position:[5,1,6]}]});
 assert.equal(acquireCount,1);
 assert.equal(effects.active.length,1);
 assert.ok(advance.length>=2);
 assert.ok(Math.abs(advance.at(-1)-.064)<1e-9,'native spin clock is 4x');
 assert.deepEqual(effects.active[0].fx.group.quaternion.toArray(),[0,0,0,1]);
 root.rotation.set(1,2,3);root.userData.staffAimDirection=[0,1,0];
 effects.update(.016,null,{vortexes:[{id:'vortex-1',position:[6,1,6]}]});
 assert.deepEqual(effects.active[0].fx.group.quaternion.toArray(),[0,0,0,1]);
 assert.equal(effects.play({...event,persistentAttackId:'vortex-2'},item,root),true);
 assert.equal(acquireCount,2,'a new flight must not teleport the existing vortex');
 assert.equal(effects.active.length,2);
});
