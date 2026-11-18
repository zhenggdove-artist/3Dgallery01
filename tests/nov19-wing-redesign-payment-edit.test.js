import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,createProfile,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {itemById} from '../src/shared/catalog.js';
import {SWALLOWTAIL_WINGS} from '../src/reletter/wing-catalog.js';
const T=Date.UTC(2026,10,19,8),admin='gm-verified',player='firebase:wing-test:verified';
const actor=(key)=>({key,name:key,color:'#aabbcc',role:'fighter',position:[0,0,0]});
const draft=(name,rate=1)=>({name,drawRatePct:rate,tier:4,color:'#d9b389',
 ability:'glide',shape:'freehand',scaleX:1,scaleY:1,impulse:11,gravity:.53,flapMs:300,
 outline:[[.1,.1],[.85,.1],[.9,.45],[.6,.8],[.15,.8]],strokes:[]});
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('GM edits published wing in-place without inventory duplication or lost ownership',()=>{
 const world=createInitialWorld(T),gm=ensureProfile(world,admin,admin,'#aabbcc',T,true);
 const p=applyAction(world,actor(admin),{action:'gm-wing-publish',wing:draft('Before',2)},{now:T});
 assert.ok(p.publishedWingId,p.error);
 const initial=gm.inventory.length,id=p.publishedWingId;
 const updated=applyAction(world,actor(admin),{action:'gm-wing-update',wingId:id,
  wing:{...draft('After',7),color:'#1a9ef8'}},{now:T+1});
 assert.equal(updated.error,undefined);
 assert.equal(updated.updatedWingId,id);
 assert.equal(gm.inventory.length,initial);
 assert.equal(gm.equipment.wings,id);
 assert.equal(itemById(id)?.name,'After');
 assert.equal(itemById(id)?.color,'#1a9ef8');
 assert.equal(world.customWings.length,1);
 assert.equal(world.customWings[0].drawRatePct,7);
});
test('GM edit rejects unauthorized updates, duplicate names, and retired wings',()=>{
 const world=createInitialWorld(T);
 ensureProfile(world,admin,admin,'#aabbcc',T,true);
 ensureProfile(world,'viewer','Viewer','#aabbcc',T,false);
 const a=applyAction(world,actor(admin),{action:'gm-wing-publish',wing:draft('Design One',2)},{now:T}).publishedWingId;
 const b=applyAction(world,actor(admin),{action:'gm-wing-publish',wing:draft('Design Two',2)},{now:T+1}).publishedWingId;
 assert.equal(applyAction(world,actor('viewer'),{action:'gm-wing-update',wingId:a,wing:draft('Stolen')},{now:T+2}).error,'GM only');
 assert.match(applyAction(world,actor(admin),{action:'gm-wing-update',wingId:a,wing:draft('Design Two')},{now:T+3}).error,/already exists/);
 assert.match(applyAction(world,actor(admin),{action:'gm-wing-update',wingId:a,wing:draft('Hundred',99)},{now:T+4}).error,/100%/);
 applyAction(world,actor(admin),{action:'gm-wing-remove',wingId:b},{now:T+5});
 assert.match(applyAction(world,actor(admin),{action:'gm-wing-update',wingId:b,wing:draft('Retired')},{now:T+6}).error,/已下架/);
});
test('paid-draw credits consume one unit only after the initial five Google trials',()=>{
 const world=createInitialWorld(T),profile=createProfile(player,'Tester','#aabbcc',T,false);
 world.profiles[player]=profile;profile.wingPaidDraws=5;
 const size=profile.inventory.length;
 for(let i=0;i<10;i++){
  const result=applyAction(world,actor(player),{action:'wing-draw',wingPaidDraws:2000},{now:T+i,rng:()=>0});
  assert.equal(result.error,undefined);
  assert.equal(result.wingDraw.mode,i<5?'free-trial':'paid-draw');
 }
 assert.equal(profile.inventory.length,size+10);
 assert.equal(profile.wingTrialDraws,5);
 assert.equal(profile.wingPaidDraws,0);
 assert.match(applyAction(world,actor(player),{action:'wing-draw'},{now:T+20}).error,/No paid wing draws remaining/);
});
test('fourteen material designs have deterministic motifs and epic detail independent of color',()=>{
 const blue=SWALLOWTAIL_WINGS.filter(w=>w.tier===3),gold=SWALLOWTAIL_WINGS.filter(w=>w.tier===5),purple=SWALLOWTAIL_WINGS.filter(w=>w.tier===4);
 assert.deepEqual(blue.map(w=>w.motif),['wood','balloon','rag','tin','tape']);
 assert.deepEqual(gold.map(w=>w.motif),['chicken','plastic','fur','koinobori']);
 assert.deepEqual(purple.map(w=>w.motif),['peacock','swan','cyberpunk','steampunk','monster']);
 assert.ok(purple.every(w=>w.visualComplexity>blue[0].visualComplexity));
 assert.ok(purple.every(w=>w.visualComplexity>gold[0].visualComplexity));
 assert.ok(new Set([...blue,...purple,...gold].map(w=>w.color)).size>=12);
});
test('forward channel beams, floating +1, wing thumbnail hydration and isolated payment are wired',()=>{
 const fx=read('src/numbered-weapon-effects.js'),ray=read('src/forward-channel-beam.js');
 const ui=read('src/ui.js'),main=read('src/main.js'),numbers=read('src/reletter/damage-numbers.js');
 assert.match(fx,/entry\.forwardBeam=new ForwardChannelBeam/);
 assert.match(fx,/e\.forwardBeam\.update/);
 assert.match(ray,/reach=distance\*Math\.min/);
 assert.match(numbers,/data-kind=heal/);
 assert.match(main,/staffChannel\?\.ready/);
 assert.match(ui,/data-wing-edit/);
 assert.match(ui,/data-start-wing-stage/);
 assert.match(ui,/root:null,rootMargin:'700px'/);
 const shop=ui.slice(ui.indexOf('  renderShop(profile){'),ui.indexOf('  renderWingShop(profile){'));
 assert.doesNotMatch(shop,/wing-shop-link/);
});
