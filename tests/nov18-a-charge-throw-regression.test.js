import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {itemById} from '../src/shared/catalog.js';
import {chargeProgress,STAFF_TAP_MAX_MS} from '../src/shared/weapon-abilities.js';

const NOW=2400000;
const actor={key:'a-button-regression',name:'A tester',role:'fighter',position:[75,0,0],color:'#fff'};

test('server validates fully charged ultimates for melee, odd weapons and first-person firearms',()=>{
 for(const id of ['pan-1','whip-1','telephone','goldfish','fan','accordion','jellybrella','white-cat','black-cat','calico-cat']){
  const world=createInitialWorld(NOW),profile=ensureProfile(world,actor.key,actor.name,actor.color,NOW);
  profile.inventory.push(id);profile.equipment.weapon=id;
  if(id==='black-cat')profile.fusion[id]={effects:['ember-1']};
  const weapon=itemById(id),pressed=NOW+1000;
  assert.equal(applyAction(world,actor,{action:'attack',phase:'charge',...(id==='black-cat'?{aimMode:'shoulder'}:{})},{now:pressed}).charging,true,id);
  const result=applyAction(world,actor,{action:'attack',direction:[0,0,1],charge:1,...(id==='black-cat'?{aimMode:'shoulder'}:{})},
   {now:pressed+weapon.chargeMs+50});
  assert.equal(result.error,undefined,id+': '+result.error);
  assert.equal(result.attackEvent?.ultimate,true,id+' should cast an ultimate');
  assert.equal(chargeProgress(STAFF_TAP_MAX_MS+weapon.chargeMs,weapon.chargeMs),1,id);
 }
});

test('A/Q prioritizes held art, and charged firearm release cannot trap an artwork',async()=>{
 const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const start=source.split("ui.addEventListener('attack-start',()=>{")[1]
  .split("ui.addEventListener('attack-release',async()=>{")[0];
 const release=source.split("ui.addEventListener('attack-release',async()=>{")[1]
  .split("ui.addEventListener('attack-cancel',()=>{")[0];
 assert.match(start,/artworkThrow\.begin\(\)/,'A starts the held-art throw charge');
 assert.match(start,/pendingAInteraction=nearbyArt/,'artwork pickup is deferred until short tap');
 assert.doesNotMatch(start,/performInteract\(\)/,'artwork proximity must not swallow charged holds');
 assert.match(start,/setTimeout\(.*startHeldCharge\(\)/,'hold charge timer must work without frames');
 assert.ok(release.indexOf('artworkThrow.release()')<release.indexOf('weapon?.firstPerson'),
  'artwork release must precede firearm special handling');
 assert.match(release,/heldMs<STAFF_TAP_MAX_MS&&tapInteraction/);
 assert.match(release,/weapon\?\.firstPerson&&heldMs<STAFF_TAP_MAX_MS/);
 assert.doesNotMatch(source,/if\(heldItem\.firstPerson\)\{attackHeld=false/,
  'animation loop cannot erase the starter SMG charged hold');
});
