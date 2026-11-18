import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,createProfile,ensureProfile,applyAction,tickWorld,worldView} from '../src/shared/temple-rules.js';
import {fuseTemple,fusionChance} from '../src/shared/temple-fusion.js';
import {COLLECTOR_ANGRY_LINES} from '../src/shared/collector.js';

const TIME=11_180_000;
const fighter=(key,position=[70,0,12])=>({key,name:key,color:'#bcaef0',role:'fighter',position});
const fuse=(sourceId,targetId,sourceIndex,targetIndex,requestId='fusion-drag-123')=>
 ({action:'fuse',sourceId,targetId,sourceIndex,targetIndex,requestId});

test('migrate old +1 weapon whose 9 apparent attempts produced only 1 upgrade',()=>{
 const world=createInitialWorld(TIME);
 const old=createProfile('legacy','legacy','#aabbcc',TIME);
 old.inventory.push('ember-1','frost-1');
 old.fusion['ember-1']={layer:1,attempts:9,effects:['storm-1'],templeStats:{damage:96}};
 world.profiles.legacy=old;
 const p=ensureProfile(world,'legacy','legacy','#aabbcc',TIME);
 assert.equal(p.fusion['ember-1'].layer,1);
 assert.equal(p.fusion['ember-1'].attempts,1);
 assert.equal(p.fusion['ember-1'].legacyAttemptsBeforeRepair,9);
 assert.equal(fusionChance(p,'ember-1'),.25);
 const index=p.inventory.indexOf('ember-1');
 assert.equal(p.fusionByInstance[p.inventoryInstances[index].uid].attempts,1);
 // The next attempt must be #2, not #10; preserve all earned upgrades.
 const r=fuseTemple(world,p,fuse('frost-1','ember-1',
  p.inventory.indexOf('frost-1'),index,'post-migration-123'),()=>0);
 assert.equal(r.fusion.success,true);
 assert.equal(r.fusion.attempts,2);
 assert.equal(r.fusion.chance,.25);
 assert.equal(r.fusion.nextChance,.125);
 assert.equal(p.fusion['ember-1'].layer,2);
 assert.deepEqual(p.fusion['ember-1'].effects,['storm-1','frost-1']);
});

test('different physical copies of same base weapon never share fusion attempts',()=>{
 const w=createInitialWorld(TIME),p=ensureProfile(w,'copies','copies','#aabbcc',TIME);
 p.inventory.push('ember-1','ember-1','frost-1','storm-1');
 ensureProfile(w,'copies','copies','#aabbcc',TIME+1);
 const first=p.inventory.indexOf('ember-1'),second=first+1;
 const frost=p.inventory.indexOf('frost-1');
 const uidA=fuseIndexUid(p,first),uidB=fuseIndexUid(p,second);
 assert.notEqual(uidA,uidB);
 const failed=fuseTemple(w,p,fuse('frost-1','ember-1',frost,first,'first-failed-123'),()=>.9);
 assert.equal(failed.fusion.success,false);
 assert.equal(failed.fusion.nextChance,.5);
 assert.equal(failed.fusion.nextAttempt,1);
 assert.equal(p.fusionByInstance[uidA].attempts,0);
 assert.equal(p.fusionByInstance[uidB],undefined);
 const bIndex=p.inventoryInstances.findIndex(x=>x.uid===uidB);
 const aIndex=p.inventoryInstances.findIndex(x=>x.uid===uidA);
 assert.equal(fusionChance(p,'ember-1',aIndex),.5);
 assert.equal(fusionChance(p,'ember-1',bIndex),.5);
 const sIndex=p.inventory.indexOf('storm-1');
 const good=fuseTemple(w,p,fuse('storm-1','ember-1',sIndex,bIndex,'second-success-123'),()=>0);
 assert.equal(good.fusion.success,true);
 assert.equal(good.fusion.chance,.5);
 assert.equal(p.fusionByInstance[uidA].attempts,0);
 assert.equal(p.fusionByInstance[uidB].attempts,1);
 assert.equal(p.fusionByInstance[uidB].layer,1);
});

function fuseIndexUid(profile,index){
 // Simulate authoritative profile hydration after inventory is edited in a test.
 return profile.inventoryInstances?.[index]?.uid;
}

test('duplicate request IDs, stale UIDs and invalid indexes cannot consume twice',()=>{
 const w=createInitialWorld(TIME),actor=fighter('dup');
 const p=ensureProfile(w,'dup','dup','#bcaef0',TIME);
 p.inventory.push('ember-1','frost-1','storm-1');
 ensureProfile(w,'dup','dup','#bcaef0',TIME+1);
 // This reconciles the test-created inventory and creates stable copy IDs.
 const ids=worldView(w,'dup',TIME).profile.inventoryInstances;
 const ember=p.inventory.indexOf('ember-1'),frost=p.inventory.indexOf('frost-1');
 const req={...fuse('frost-1','ember-1',frost,ember,'idempotent-fuse-123'),
  sourceInstanceUid:ids[frost].uid,targetInstanceUid:ids[ember].uid};
 const before=p.inventory.length;
 const first=applyAction(w,actor,req,{now:TIME+100,rng:()=>0});
 assert.equal(first.fusion.success,true);
 assert.equal(p.inventory.length,before-1);
 const retry=applyAction(w,actor,req,{now:TIME+200,rng:()=>0});
 assert.deepEqual(retry.fusion,first.fusion);
 assert.equal(p.inventory.length,before-1);
 const wrong=applyAction(w,actor,{...fuse('storm-1','ember-1',
  p.inventory.indexOf('storm-1'),p.inventory.indexOf('ember-1'),'stale-fuse-123'),
  sourceInstanceUid:'incorrect-instance'}, {now:TIME+300,rng:()=>0});
 assert.match(wrong.error,/Inventory changed/);
 assert.equal(p.inventory.length,before-1);
 assert.equal(p.fusion['ember-1'].attempts,1);
});

test('swaps and equipment selection retain the exact copy UID and upgrade',()=>{
 const w=createInitialWorld(TIME),actor=fighter('swap'),p=ensureProfile(w,'swap','swap','#bcaef0',TIME);
 p.inventory.push('ember-1','ember-1','frost-1');
 ensureProfile(w,'swap','swap','#bcaef0',TIME+1);
 const idxA=p.inventory.indexOf('ember-1'),idxB=idxA+1;
 const uidA=p.inventoryInstances[idxA].uid,uidB=p.inventoryInstances[idxB].uid;
 const f=applyAction(w,actor,fuse('frost-1','ember-1',
  p.inventory.indexOf('frost-1'),idxB,'fuse-only-b-123'),{now:TIME+100,rng:()=>0});
 assert.equal(f.fusion.success,true);
 assert.equal(p.fusionByInstance[uidB].layer,1);
 assert.equal(p.fusionByInstance[uidA],undefined);
 const newIndexA=p.inventoryInstances.findIndex(x=>x.uid===uidA);
 const newIndexB=p.inventoryInstances.findIndex(x=>x.uid===uidB);
 assert.equal(applyAction(w,actor,{action:'equip',itemId:'ember-1',inventoryIndex:newIndexB},{now:TIME+200}).error,undefined);
 assert.equal(p.equippedInstanceIds.weapon,uidB);
 assert.equal(p.fusion['ember-1'].layer,1);
 assert.equal(applyAction(w,actor,{action:'swap-inventory',fromIndex:newIndexA,toIndex:newIndexB},{now:TIME+300}).error,undefined);
 assert.equal(p.equippedInstanceIds.weapon,uidB);
 assert.equal(p.inventoryInstances[newIndexA].uid,uidB);
 assert.equal(fusionChance(p,'ember-1',newIndexA),.25);
 assert.equal(applyAction(w,actor,{action:'equip',itemId:'ember-1',inventoryIndex:newIndexB},{now:TIME+400}).error,undefined);
 assert.equal(p.equippedInstanceIds.weapon,uidA);
 assert.equal(p.fusion['ember-1'],undefined,'virgin physical copy must not inherit previous +1');
});

test('legacy saved failed rolls do not stack across unrelated item instances',()=>{
 const world=createInitialWorld(TIME),p=createProfile('old','old','#ff9966',TIME);
 p.inventory.push('ember-1','ember-1');
 p.fusion['ember-1']={attempts:8};
 world.profiles.old=p;
 ensureProfile(world,'old','old','#ff9966',TIME);
 const i=p.inventory.indexOf('ember-1');
 assert.equal(p.fusionByInstance[p.inventoryInstances[i].uid].attempts,0);
 assert.equal(fusionChance(p,'ember-1',i),.5);
 assert.equal(fusionChance(p,'ember-1',i+1),.5);
});

test('existing profiles already on physical inventory UIDs migrate old failure penalties',()=>{
 const world=createInitialWorld(TIME),p=ensureProfile(world,'upgraded','upgraded','#aabbcc',TIME);
 p.inventory.push('ember-1','ember-1','frost-1');
 ensureProfile(world,'upgraded','upgraded','#aabbcc',TIME+1);
 const first=p.inventory.indexOf('ember-1'),second=first+1;
 const upgradedUid=p.inventoryInstances[first].uid,untouchedUid=p.inventoryInstances[second].uid;
 const record={layer:1,attempts:9,effects:['storm-1'],templeStats:{damage:111}};
 p.fusionByInstance[upgradedUid]=record;
 p.fusion['ember-1']=record;
 p.fusionIdentityMigrated=true;
 p.fusionSuccessOnlyMigrated=false;
 ensureProfile(world,'upgraded','upgraded','#aabbcc',TIME+2);
 assert.equal(record.attempts,1);
 assert.equal(record.legacyAttemptsBeforeRepair,9);
 assert.equal(record.layer,1);
 assert.deepEqual(record.effects,['storm-1']);
 assert.equal(fusionChance(p,'ember-1',first),.25);
 assert.equal(fusionChance(p,'ember-1',second),.5);
 assert.equal(p.fusionByInstance[untouchedUid],undefined);
 // Migration is idempotent: no further chance reductions after another login.
 ensureProfile(world,'upgraded','upgraded','#aabbcc',TIME+3);
 assert.equal(fusionChance(p,'ember-1',first),.25);
});

test('failure after an existing +1 does not change the next upgrade tier or odds',()=>{
 const world=createInitialWorld(TIME),p=ensureProfile(world,'after','after','#aabbcc',TIME);
 p.inventory.push('ember-1','frost-1','storm-1','frost-2');
 ensureProfile(world,'after','after','#aabbcc',TIME+1);
 const fusion1=fuseTemple(world,p,fuse('frost-1','ember-1',
  p.inventory.indexOf('frost-1'),p.inventory.indexOf('ember-1'),'upgrade-one-ok-123'),()=>0);
 assert.equal(fusion1.fusion.success,true);
 assert.equal(fusionChance(p,'ember-1'),.25);
 const failure=fuseTemple(world,p,fuse('storm-1','ember-1',
  p.inventory.indexOf('storm-1'),p.inventory.indexOf('ember-1'),'upgrade-two-fail-123'),()=>.9);
 assert.equal(failure.fusion.success,false);
 assert.equal(failure.fusion.layer,1);
 assert.equal(failure.fusion.attempts,1);
 assert.equal(failure.fusion.nextAttempt,2);
 assert.equal(failure.fusion.chance,.25);
 assert.equal(failure.fusion.nextChance,.25);
 const success=fuseTemple(world,p,fuse('frost-2','ember-1',
  p.inventory.indexOf('frost-2'),p.inventory.indexOf('ember-1'),'upgrade-two-yes-123'),()=>.2);
 assert.equal(success.fusion.success,true);
 assert.equal(success.fusion.layer,2);
 assert.equal(success.fusion.attempts,2);
 assert.equal(success.fusion.chance,.25);
 assert.equal(success.fusion.nextChance,.125);
});

test('client world profile keeps migration flags and correct per-copy odds on BAG inspection',()=>{
 const w=createInitialWorld(TIME),p=ensureProfile(w,'viewer','Viewer','#abcdef',TIME);
 p.inventory.push('ember-1','ember-1','frost-1');
 ensureProfile(w,'viewer','Viewer','#abcdef',TIME+1);
 const first=p.inventory.indexOf('ember-1'),second=first+1;
 const upgradedUid=p.inventoryInstances[second].uid;
 p.fusionByInstance[upgradedUid]={layer:1,attempts:1,effects:['frost-1']};
 // The projection is the equipped copy but the OTHER unfused copy must
 // still show 50% after the world view crosses into the browser.
 p.equipment.weapon='ember-1';
 p.equippedInstanceIds.weapon=upgradedUid;
 p.fusion['ember-1']=p.fusionByInstance[upgradedUid];
 const client=worldView(w,'viewer',TIME+2).profile;
 assert.equal(client.fusionIdentityMigrated,true);
 assert.equal(client.fusionSuccessOnlyMigrated,true);
 assert.equal(fusionChance(client,'ember-1',first),.5);
 assert.equal(fusionChance(client,'ember-1',second),.25);
 assert.equal(client.fusionByInstance[upgradedUid].layer,1);
 assert.equal(client.fusion['ember-1'].layer,1);
 assert.equal(client.inventoryInstances[first].uid,p.inventoryInstances[first].uid);
 assert.equal(client.inventoryInstances[second].uid,upgradedUid);
});

test('success-only progression is identical after any number of failed rolls',()=>{
 const w=createInitialWorld(TIME),p=ensureProfile(w,'failloop','failloop','#abcdee',TIME);
 p.inventory.push('ember-1',...Array(7).fill('frost-1'));
 ensureProfile(w,'failloop','failloop','#abcdee',TIME+1);
 const targetUid=p.inventoryInstances[p.inventory.indexOf('ember-1')].uid;
 for(let i=0;i<6;i++){
  const result=fuseTemple(w,p,fuse('frost-1','ember-1',
   p.inventory.indexOf('frost-1'),p.inventory.indexOf('ember-1'),
   'fail-roll-'+i+'-unique'),()=>.999);
  assert.equal(result.fusion.success,false);
  assert.equal(result.fusion.layer,0);
  assert.equal(result.fusion.attempts,0);
  assert.equal(result.fusion.nextAttempt,1);
  assert.equal(result.fusion.chance,.5);
  assert.equal(result.fusion.nextChance,.5);
  assert.equal(fusionChance(p,'ember-1'),.5);
  assert.equal(p.fusionByInstance[targetUid].attempts,0);
 }
 const success=fuseTemple(w,p,fuse('frost-1','ember-1',
  p.inventory.indexOf('frost-1'),p.inventory.indexOf('ember-1'),
  'finally-success-unique'),()=>0);
 assert.equal(success.fusion.success,true);
 assert.equal(success.fusion.layer,1);
 assert.equal(success.fusion.chance,.5);
 assert.equal(success.fusion.nextChance,.25);
});

test('ten server-chosen Collector taunts accompany empty-handed attack; stay with gunshot',()=>{
 assert.equal(COLLECTOR_ANGRY_LINES.length,10);
 assert.equal(new Set(COLLECTOR_ANGRY_LINES).size,10);
 assert.ok(COLLECTOR_ANGRY_LINES.every(line=>line.length>25));
 const w=createInitialWorld(TIME);
 tickWorld(w,{now:TIME,actors:[],rng:()=>.7});
 const a=fighter('artless',w.collector.position);
 ensureProfile(w,a.key,a.name,a.color,TIME);
 const old=COLLECTOR_ANGRY_LINES[0];
 tickWorld(w,{now:TIME+100,actors:[a],rng:()=>0});
 assert.equal(w.collector.shots[0].taunt,old);
 assert.equal(w.collector.shots[0].damage,50);
 assert.equal(worldView(w,a.key,TIME+100).collector.shots[0].taunt,old);
});

test('Collector warning bubble is translucent, anchored to animated rig head, and short-lived',()=>{
 const view=readFileSync(new URL('../src/collector-view.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../fidelity-ui.css',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(view,/this\.showTaunt\(shot\.taunt\)/);
 assert.match(view,/speech\.textContent=String\(message\)/);
 assert.match(view,/speechUntil=performance\.now\(\)\+3000/);
 assert.match(view,/speechPosition\.set\(/);
 assert.match(main,/collectorView\.update\(time,camera\)/);
 assert.match(css,/\.collector-angry-speech/);
 assert.match(css,/background:rgba\(255,255,255,\.78\)/);
 assert.match(css,/pointer-events:none/);
});
