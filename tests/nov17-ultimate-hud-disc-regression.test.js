import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {PlayerController} from '../src/player-controller.js';
import {ChargeTargetPreview} from '../src/charge-target-preview.js';
import {ULTIMATE_FOOTPRINT_SCALE,PALM_ULTIMATE_RADIUS_MULTIPLIER,scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {ultimateWorldScale,NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';
import {WEAPONS,itemById,attackStats} from '../src/shared/catalog.js';
import {weaponQuality,isChannelStaff,channelReachMultiplier,forwardCastRadius} from '../src/shared/weapon-abilities.js';

test('ultimate footprint ratios: unchanged reach, with 1.5x wider whip blast radius',()=>{
 assert.equal(ULTIMATE_FOOTPRINT_SCALE,.6);
 for(const weapon of WEAPONS){
  const normal=attackStats(weapon,1);
  assert.ok(normal.ultimate,weapon.id);
  const stats={...normal};
  scaleUltimateFootprint(stats,weapon);
  const extra=weapon.id.startsWith('pan-')?.5:weapon.id.startsWith('swatter-')?.85:weapon.id.startsWith('whip-')?.2:weapon.id.startsWith('planter-')?.5:weapon.family==='saber'?.25:weapon.family==='ice'?1.5:weapon.family==='wave'||weapon.id==='goldfish'?3:1;
  assert.ok(Math.abs(stats.range-normal.range*.6*extra)<.001,weapon.id+' reach');
  if(weapon.id!=='telephone')assert.ok(Math.abs(stats.radius-normal.radius*.6*(weapon.id==='goldfish'||weapon.family==='saber'?1:extra)*(weapon.id.startsWith('whip-')?1.5:weapon.id.startsWith('palm-')?PALM_ULTIMATE_RADIUS_MULTIPLIER:weapon.family==='ice'?1/3:1))<.001,weapon.id+' radius');
 }
 const normal=attackStats(itemById('pan-1'),0);
 const before=structuredClone(normal);
 scaleUltimateFootprint(normal);
 assert.deepEqual(normal,before,'ordinary attacks must not be affected');
});
test('every weapon receives a smaller warning with its quality multiplier',()=>{
 const scene=new THREE.Scene(),avatar=new THREE.Group(),v=new ChargeTargetPreview(scene);
 for(const weapon of WEAPONS){
  const item=itemById(weapon.id);
  v.update(avatar,item,1,[0,0,1],{world:{floatingPlatforms:[]}});
  assert.ok(v.footprint,'no blank warning for '+item.id);
  assert.ok(v.footprint.position.every(Number.isFinite),item.id);
  const q=weaponQuality(item);
  const stats=attackStats(item,1);
  if(isChannelStaff(item))stats.range=Math.max(stats.range,item.id==='clam'?10:Math.min(18,item.range))*channelReachMultiplier(item);
  stats.range=+(stats.range*q.range).toFixed(2);
  if(item.id==='black-cat')stats.range=256;
  stats.radius=forwardCastRadius(item,q,stats.radius,isChannelStaff(item));
  if(item.id==='jellybrella')stats.radius=Math.max(10,stats.radius*2);
  scaleUltimateFootprint(stats,item);
  if(item.id==='black-cat')stats.range=256;
  if(item.id==='giraffe'){
   // Boomerang overrides the generic 60% AoE range with its full sweep.
   stats.range=+(item.chargedRange*q.range).toFixed(2);
   stats.radius=Math.max(stats.radius,5.9*q.visual);
  }
  assert.ok(Math.abs(v.footprint.range-stats.range)<.001,item.id);
  if(item.id.startsWith('pan-')||item.id.startsWith('whip-')){
   assert.equal(v.footprint.shape,'circle',item.id+' blast telegraph');
   assert.ok(Math.abs(v.footprint.radius-stats.radius)<.001,item.id+' blast radius');
  }
 }
 v.dispose();
});
test('original #68 pan and #48 whip world geometry reduce by exactly 50% and 80%',()=>{
 const event={ultimate:true,channel:false,range:18,radius:3.6,area:{radius:3.6,center:[0,.1,9],visualCenter:[0,.16,9]},origin:[0,1,0],direction:[0,0,1],qualityScale:1};
 const fx=new NumberedWeaponEffects(new THREE.Scene());
 assert.ok(fx.play(event,itemById('pan-1'),null));
 const e=fx.active[0];
 assert.equal(e.spec.number,68);
 assert.ok(e.group.scale.x>=3.75,'pan keeps at least half the enlarged original #68');
 const panExpected=ultimateWorldScale(68,event,{size:e.options.size});
 assert.ok(Math.abs(e.group.scale.x-panExpected)<1e-6);
 fx.update(.016);
 assert.ok(Math.abs(e.group.scale.x-panExpected)<1e-6,'native frame update must not reset pan size');
 fx.dispose();
 const whipping={...event,area:{...event.area,radius:1.44}};
 const whip=new NumberedWeaponEffects(new THREE.Scene());
 assert.ok(whip.play(whipping,itemById('whip-1'),null));
 const we=whip.active[0];
 assert.equal(we.spec.number,48);
 assert.ok(Math.abs(we.group.scale.x-ultimateWorldScale(48,whipping,{size:we.options.size}))<1e-6);
 const oldWhipRadius=1.44/1.5; // Wider collision/warning, same pre-existing #48 art dimensions.
 const originalWhipScale=Math.max(2,Math.min(12,(oldWhipRadius/.2)/Math.max(.25,we.options.size*.8)));
 assert.ok(Math.abs(we.group.scale.x-originalWhipScale*.2)<1e-6);
 whip.dispose();
 assert.ok(ultimateWorldScale(53,event,{size:.8})>=.08,'swatter native scale is bounded and visible');
 assert.ok(ultimateWorldScale(48,event,{size:.8})>0,'tiny whip FX stays visible');
});
test('raised displays have no side wall: the player can cross an edge and fall naturally',()=>{
 const controller=Object.create(PlayerController.prototype);
 controller.root=new THREE.Group();controller.root.position.set(0,5,0);
 controller.grounded=true;controller.velocityY=0;
 controller.jumpVelocity=new THREE.Vector3();controller.speed=8.64;
 let blockCalls=0;
 controller.arena={groundHeight:(x,z)=>x>2?8:5,blocked:()=>{blockCalls++;return false;}};
 controller.stepHorizontal(3,0);
 assert.equal(controller.root.position.x,3,'height differential cannot create a phantom fence');
 assert.ok(blockCalls>0);
 controller.root.position.set(0,5,0);
 controller.arena.groundHeight=x=>x>2?0:5;
 controller.stepHorizontal(3,0);
 assert.equal(controller.root.position.x,3);
 assert.equal(controller.grounded,false,'walking beyond the disc enters gravity');
});
test('roster is enlarged to 52% with 10% clash fallback and no black panel',()=>{
 const css=readFileSync(new URL('../fidelity-ui.css',import.meta.url),'utf8');
 assert.match(css,/#player-roster\{[^}]*transform:scale\(var\(--roster-scale,\.52\)\)[^}]*transform-origin:top left/);
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.match(ui, /--roster-scale','\.468'/);
 assert.match(css,/\.roster-player\{background:transparent;border:0/);
 assert.doesNotMatch(css,/\.roster-player\{background:#1e102ab8/);
 assert.match(css,/#chat-hud\{bottom:max\(145px,env\(safe-area-inset-bottom\) \+ 131px\)/);
});
