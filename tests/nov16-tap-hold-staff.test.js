import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {itemById} from '../src/shared/catalog.js';
import {isChannelStaff} from '../src/shared/weapon-abilities.js';
const NOW=1200000;
const caster={key:'tap-player',name:'Tap',role:'fighter',position:[75,0,0],color:'#fff'};
function create(id){const world=createInitialWorld(NOW),p=ensureProfile(world,caster.key,caster.name,caster.color,NOW);p.inventory.push(id);p.equipment.weapon=id;return {world,p};}
test('starter clam can swing on a single quick press without starting a silent channel',()=>{
 const {world}=create('clam');
 const press=applyAction(world,caster,{action:'attack',phase:'charge'},{now:NOW+1000});
 assert.equal(press.charging,true);
 const hit=applyAction(world,caster,{action:'attack',direction:[0,0,1],charge:0},{now:NOW+1120});
 assert.equal(hit.error,undefined);
 assert.equal(hit.attackEvent.weapon,'clam');
 assert.equal(hit.attackEvent.ultimate,false);
 assert.ok(hit.attackEvent.range>0);
 assert.equal(world.profiles[caster.key].channelWeapon,null);
});
test('ordinary single taps on every elemental staff cast a non-ultimate projectile',()=>{
 for(const id of ['water','tide-1','frost-1','ember-1','storm-1','prism-1','bloom-1','nova-1']){
  const {world}=create(id);
  assert.ok(isChannelStaff(itemById(id)),id);
  const press=applyAction(world,caster,{action:'attack',phase:'charge'},{now:NOW+1000});
  assert.equal(press.charging,true);
  const shot=applyAction(world,caster,{action:'attack',direction:[0,0,1],charge:0},{now:NOW+1100});
  assert.ok(shot.attackEvent,id);
  assert.equal(shot.attackEvent.ultimate,false,id);
  assert.equal(shot.attackEvent.channel,false,id);
  assert.ok(world.persistentAttacks.some(a=>a.kind==='projectile'&&a.weapon===id),id);
 }
});
test('hold cannot cast before 100%, starts at completion, and stops when released',()=>{
 for(const id of ['clam','tide-1','frost-1','ember-1']){
  const {world,p}=create(id),ms=itemById(id).chargeMs;
  assert.ok(applyAction(world,caster,{action:'attack',phase:'charge'},{now:NOW+1000}).charging);
  const tooSoon=applyAction(world,caster,{action:'attack',phase:'channel-start'},{now:NOW+1000+ms-1});
  assert.match(tooSoon.error,/100%/,id);
  assert.equal(p.channelWeapon,null,id);
  assert.equal(applyAction(world,caster,{action:'attack',phase:'channel-start'},{now:NOW+1000+ms}).channeling,true,id);
  const pulse=applyAction(world,caster,{action:'attack',phase:'channel',direction:[0,0,1]},{now:NOW+1000+ms+20});
  assert.equal(pulse.attackEvent?.ultimate,true,id);
  assert.equal(pulse.attackEvent?.channel,true,id);
  assert.ok(world.persistentAttacks.length>0,id);
  assert.equal(applyAction(world,caster,{action:'attack',phase:'channel-stop'},{now:NOW+1000+ms+100}).channeling,false);
  assert.match(applyAction(world,caster,{action:'attack',phase:'channel',direction:[0,0,1]},{now:NOW+1000+ms+200}).error,/channel/,id);
 }
});
