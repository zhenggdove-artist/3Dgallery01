import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {PlayerController} from '../src/player-controller.js';
import {ChargeTargetPreview} from '../src/charge-target-preview.js';
import {ULTIMATE_FOOTPRINT_SCALE,scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {ultimateWorldScale,NumberedWeaponEffects} from '../src/numbered-weapon-effects.js';
import {WEAPONS,itemById,attackStats} from '../src/shared/catalog.js';
import {weaponQuality,isChannelStaff,channelReachMultiplier} from '../src/shared/weapon-abilities.js';

test('all ultimate hitboxes reduce radius and forward reach to exactly 60%',()=>{
 assert.equal(ULTIMATE_FOOTPRINT_SCALE,.6);
 for(const weapon of WEAPONS){
  const normal=attackStats(weapon,1);
  assert.ok(normal.ultimate,weapon.id);
  const stats={...normal};
  scaleUltimateFootprint(stats);
  assert.ok(Math.abs(stats.range-normal.range*.6)<.001,weapon.id+' reach');
  assert.ok(Math.abs(stats.radius-normal.radius*.6)<.001,weapon.id+' radius');
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
  scaleUltimateFootprint(stats);
  assert.ok(Math.abs(v.footprint.range-stats.range)<.001,item.id);
 }
 v.dispose();
});
test('source #68 explosion expands at least 7.5x after the 60% warning scale',()=>{
 const event={ultimate:true,channel:false,range:18,radius:3.6,area:{radius:3.6,center:[0,.1,9],visualCenter:[0,.16,9]},origin:[0,1,0],direction:[0,0,1],qualityScale:1};
 const fx=new NumberedWeaponEffects(new THREE.Scene());
 assert.ok(fx.play(event,itemById('pan-1'),null));
 const e=fx.active[0];
 assert.equal(e.spec.number,68);
 assert.ok(e.group.scale.x>=7.5);
 fx.update(.016);
 assert.ok(e.group.scale.x>=7.5,'native frame update must not reset the size');
 fx.dispose();
 assert.ok(ultimateWorldScale(53,event,{size:.8})>1);
 assert.ok(ultimateWorldScale(48,event,{size:.8})>1);
});
test('raised displays have no side wall: the player can cross an edge and fall naturally',()=>{
 const controller=Object.create(PlayerController.prototype);
 controller.root=new THREE.Group();controller.root.position.set(0,5,0);
 controller.grounded=true;controller.velocityY=0;
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
test('mobile roster is 40% scale without a black panel, chat is shifted above joystick',()=>{
 const css=readFileSync(new URL('../fidelity-ui.css',import.meta.url),'utf8');
 assert.match(css,/#player-roster\{[^}]*transform:scale\(\.4\)[^}]*transform-origin:top left/);
 assert.match(css,/\.roster-player\{background:transparent;border:0/);
 assert.doesNotMatch(css,/\.roster-player\{background:#1e102ab8/);
 assert.match(css,/#chat-hud\{bottom:max\(145px,env\(safe-area-inset-bottom\) \+ 131px\)/);
});
