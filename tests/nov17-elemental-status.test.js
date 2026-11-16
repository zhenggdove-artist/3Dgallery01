import test from 'node:test';
import assert from 'node:assert/strict';
import {applyElementalHit,effectActive} from '../src/shared/combat-status.js';
import {createProfile,publicProfile,validateState} from '../src/shared/temple-rules.js';
import {attackStats,itemById} from '../src/shared/catalog.js';
import {ELEMENTAL_FILTERS} from '../src/elemental-status-visuals.js';

const T=50_000,source={key:'artist'};
const target=()=>({hp:100,maxHp:100,effects:{},effectLocks:{}});
const hit=(victim,family,element,at=T)=>applyElementalHit(victim,source,{family,element},at);

test('water makes target take 1.5x damage for precisely five seconds',()=>{
 const victim=target();
 assert.equal(hit(victim,'water','water'),'soaked');
 assert.equal(victim.effects.soaked.power,.5);
 assert.equal(victim.effects.soaked.until,T+5000);
 assert.ok(effectActive(victim,'soaked',T+4999));
 assert.equal(effectActive(victim,'soaked',T+5000),null);
});

test('freeze prevents actions for one second, with five-second proc lock',()=>{
 const victim=target();
 assert.equal(hit(victim,'ice','water'),'freeze');
 assert.equal(victim.effects.freeze.until,T+1000);
 assert.equal(hit(victim,'ice','water',T+1200),null);
 assert.equal(victim.effects.freeze.until,T+1000);
 assert.equal(hit(victim,'ice','water',T+5000),'freeze');
 const profile=createProfile('fighter','Fighter','#ffffff',T,false);
 profile.effects=victim.effects;
 assert.ok(publicProfile(profile).effects.freeze);
 const previous={position:[75,0,0],rotation:.2,animation:'idle',visible:true},
  next={position:[78,0,0],rotation:1.1,animation:'walk',visible:true};
 const stuck=validateState(previous,next,120,'fighter',null,null,T+5000,{effects:victim.effects});
 assert.deepEqual(stuck.state.position,previous.position);
 assert.equal(stuck.state.rotation,previous.rotation);
});

test('plants root movement but allow rotation, reapply only after 5 seconds',()=>{
 const victim=target();
 assert.equal(hit(victim,'planter','earth'),'root');
 assert.equal(victim.effects.root.until,T+1000);
 hit(victim,'planter','earth',T+1100);
 assert.equal(victim.effects.root.until,T+1000);
 const previous={position:[75,0,0],rotation:.2,animation:'idle',visible:true},
  next={position:[78,0,0],rotation:1.1,animation:'walk',visible:true};
 const result=validateState(previous,next,120,'fighter',null,null,T+500,{effects:victim.effects});
 assert.deepEqual(result.state.position,previous.position);
 assert.equal(result.state.rotation,1.1);
 assert.equal(hit(victim,'planter','earth',T+5000),'root');
});

test('dark confusion and light dizziness have 10-second proc immunity',()=>{
 for(const [family,element,key] of [
  ['swatter','dark','confuse'],['beam','light','dazzle']
 ]){
  const victim=target();
  assert.equal(hit(victim,family,element),key);
  assert.equal(victim.effects[key].until,T+3000);
  assert.equal(hit(victim,family,element,T+4000),null);
  assert.equal(hit(victim,family,element,T+10000),key);
 }
});

test('burn attaches a five-second damage-over-time visual status',()=>{
 const victim=target();
 assert.equal(hit(victim,'fire','fire'),'burn');
 assert.equal(victim.effects.burn.until,T+5000);
});
test('target-only overlay colors have exactly four 30%-alpha families',()=>{
 assert.deepEqual(Object.keys(ELEMENTAL_FILTERS).sort(),['dazzle','freeze','root','soaked']);
});
test('charged saber authoritative range is 60% of previous four-times multiplier',()=>{
 const item=itemById('saber-1'),uncharged=attackStats(item,.99),charged=attackStats(item,1);
 assert.ok(charged.range>=uncharged.range*2.39);
 assert.ok(charged.range<=uncharged.range*2.41);
});
