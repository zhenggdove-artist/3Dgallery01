import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {weaponQuality} from '../src/shared/weapon-abilities.js';
import {GOLDFISH_TRAVEL_SCALE,GOLDFISH_SCHOOL_COUNT} from '../src/shared/goldfish-school.js';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const NOW=1_234_567_000;
const actor={key:'visual-check',name:'Visual Check',color:'#ffffff',
 role:'fighter',position:[75,0,0],seat:0};

function chargedGoldfish(){
 const world=createInitialWorld(NOW);
 const profile=ensureProfile(world,actor.key,actor.name,actor.color,NOW);
 profile.inventory.push('goldfish');profile.equipment.weapon='goldfish';
 const ctx=now=>({now,actors:[actor],rng:()=>.4});
 assert.equal(applyAction(world,actor,{action:'attack',phase:'charge'},ctx(NOW+1000)).charging,true);
 const result=applyAction(world,actor,{action:'attack',direction:[0,0,1],charge:1},ctx(NOW+4500));
 assert.equal(result.error,undefined);
 return {result,world};
}

test('reading NEW leaves the selected item detail and its DOM untouched',()=>{
 const ui=source('src/ui.js'),bag=source('src/bag-view.js');
 assert.match(ui,/export function inventoryPanelSignature\(profile\)/);
 assert.match(ui,/map\(row=>\[row.uid,row.itemId\]\)/);
 assert.match(ui,/this.panelSignature!==inventoryPanelSignature\(world.profile\)/);
 assert.match(bag,/querySelector\('\.bag-new-mark'\)\?\.remove\(\)/);
 assert.match(bag,/action:'inspect-item'/);
});

test('new creature outfit icon uses transparent-margin crop, old outfit artwork remains unaffected',()=>{
 const src=source('src/item-preview.js');
 assert.match(src,/export function cropCreatureOutfitPortrait\(source\)/);
 assert.match(src,/maxX-minX\+1,maxY-minY\+1/);
 assert.match(src,/const portrait=creatureSuit\?cropCreatureOutfitPortrait\(renderer.domElement\):renderer.domElement/);
 assert.match(src,/item.slot==='outfit'&&!item.creature/);
});

test('shield hit has a persistent and distinctly saturated red overlay, not faint additive tint alone',()=>{
 const visual=source('src/reletter-presentation.js'),main=source('src/main.js');
 assert.match(visual,/color:'#ff0030'/);
 assert.match(visual,/blending:THREE.NormalBlending/);
 assert.match(visual,/red\.material\.opacity=flashing\?\.4\+\.59\*blink:0/);
 assert.match(visual,/red\.visible=flashing/);
 assert.match(main,/shieldFlashUntil=performance\.now\(\)\+1300/);
});

test('goldfish ultimate authoritative travel and client event are exactly half former reach',()=>{
 const {result,world}=chargedGoldfish();
 const fish=world.persistentAttacks.find(x=>x.kind==='goldfish');
 assert.ok(fish,'persistent school must launch');
 assert.equal(GOLDFISH_TRAVEL_SCALE,.5);
 const item=itemById('goldfish'),quality=weaponQuality(item),stats=attackStats(item,1);
 const expected=scaleUltimateFootprint({
  ...stats,range:stats.range*quality.range
 },item,quality).range*GOLDFISH_TRAVEL_SCALE;
 assert.ok(Math.abs(fish.range-expected)<.01,'half travel range must be server owned');
 assert.equal(result.attackEvent.range,fish.range,'rendered school and collider reach must agree');
 assert.equal(fish.fishConsumed.length,0);
});

test('all 30 fish have variable-size blue bubble rings which burst at stored impact points',()=>{
 const visual=new WeaponSignatureEffects(new THREE.Scene()),impact=[75,3,1.2];
 visual.goldfish({origin:[75,2,0],direction:[0,0,1],range:25,qualityScale:1,
  qualityDuration:1,ultimate:true,persistentAttackId:'goldfish-hit'});
 const group=visual.active[0].obj,bursts=group.userData.goldfishBubbleBursts;
 assert.ok(bursts?.cloud?.isPoints);
 assert.ok(bursts.cloud.material.isShaderMaterial);
 assert.equal(bursts.cloud.geometry.getAttribute('bubbleSize').count,GOLDFISH_SCHOOL_COUNT*14);
 const sizes=bursts.cloud.geometry.getAttribute('bubbleSize').array;
 assert.ok(Math.max(...sizes)-Math.min(...sizes)>.45,'bubble diameters must visibly vary');
 const world={serverTime:NOW,goldfishFlights:[{id:'goldfish-hit',position:[75,2,1],
  consumed:[4],direction:[0,0,1]}],goldfishImpactEvents:[{
  attackId:'goldfish-hit',fishIndex:4,time:NOW,position:impact
 }]};
 visual.update(.08,world);
 assert.equal(group.userData.consumedFish.has(4),true);
 assert.ok(Math.abs(bursts.births[4]-.08)<1e-5,'Float32 burst timestamps should preserve frame age');
 assert.ok(bursts.opacities[4*14]>.1);
 group.updateMatrixWorld(true);
 const first=group.localToWorld(new THREE.Vector3(...bursts.positions.slice(4*14*3,4*14*3+3)));
 assert.ok(first.distanceTo(new THREE.Vector3(...impact))<1.1,
  'burst must appear at actual enemy contact');
 world.serverTime=NOW+200;world.goldfishFlights[0].position=[75,2,8];
 world.goldfishImpactEvents=[];
 visual.update(.2,world);
 group.updateMatrixWorld(true);
 const second=group.localToWorld(new THREE.Vector3(...bursts.positions.slice(4*14*3,4*14*3+3)));
 assert.ok(second.distanceTo(new THREE.Vector3(...impact))<2,
  'bubble ring must not travel away with the swimming school');
 visual.dispose();
});
