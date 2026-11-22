import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,tickWorld,worldView} from '../src/shared/temple-rules.js';
import {COLLECTOR_SHOT_DAMAGE,COLLECTOR_RADIUS} from '../src/shared/collector.js';

const NOW=18_000_000;
const fighter=(key,position)=>({key,role:'fighter',position});
function activeWorld(){
 const world=createInitialWorld(NOW);
 tickWorld(world,{now:NOW,actors:[],rng:()=>.4});
 assert.equal(world.collector.active,true);
 return world;
}

test('empty-handed entry triggers exactly one 50 HP server shot; standing inside does not spam damage',()=>{
 const world=activeWorld(),profile=ensureProfile(world,'alice','Alice','#abcdef',NOW);
 const inside=[...world.collector.position];
 tickWorld(world,{now:NOW+100,actors:[fighter('alice',inside)],rng:()=>.2});
 assert.equal(COLLECTOR_SHOT_DAMAGE,50);
 assert.equal(profile.hp,50);
 assert.equal(world.collector.shots.length,1);
 const shot=world.collector.shots[0];
 assert.equal(shot.target,'alice');
 assert.equal(shot.damage,50);
 assert.ok(Array.isArray(shot.from)&&Array.isArray(shot.to));
 assert.equal(world.collector.active,true,'buyer must remain visible after shooting');
 assert.equal(worldView(world,'alice',NOW+100).collector.shots[0].id,shot.id);
 for(const elapsed of [200,600,1200,8000]){
  tickWorld(world,{now:NOW+elapsed,actors:[fighter('alice',inside)],rng:()=>.8});
  assert.equal(profile.hp,50,'same-circle presence must not fire again');
 }
});

test('leaving and entering again triggers second 50 HP shot and ordinary death flow',()=>{
 const world=activeWorld(),profile=ensureProfile(world,'bob','Bob','#abcdef',NOW);
 const inside=world.collector.position,away=[inside[0]+COLLECTOR_RADIUS+8,0,inside[2]];
 tickWorld(world,{now:NOW+10,actors:[fighter('bob',inside)]});
 assert.equal(profile.hp,50);
 tickWorld(world,{now:NOW+100,actors:[fighter('bob',away)]});
 assert.equal(profile.hp,50);
 tickWorld(world,{now:NOW+200,actors:[fighter('bob',inside)]});
 assert.equal(profile.hp,0);
 assert.equal(profile.deadUntil,NOW+200+5000);
 assert.equal(profile.lastKilledBy.name,'COLLECTOR');
 assert.equal(world.killEvents.at(-1).killerName,'COLLECTOR');
 assert.equal(world.killEvents.at(-1).cause,'collector');
 assert.equal(world.collector.shots.length,2);
});

test('carrying a real artwork results in purchase, not shooting',()=>{
 const world=activeWorld(),p=ensureProfile(world,'carol','Carol','#abcdef',NOW);
 world.artworks['platform-01'].holder='carol';
 const position=world.collector.position;
 tickWorld(world,{now:NOW+100,actors:[fighter('carol',position)],rng:()=>.2});
 assert.equal(p.hp,100);
 assert.equal(world.collector.shots.length,0);
 assert.equal(world.collector.active,false);
 assert.equal(world.lastCollectorSale.buyer,'carol');
});

test('spectators, unreachable vertical positions and respawn shields cannot lose HP',()=>{
 const world=activeWorld(),p=ensureProfile(world,'sue','Sue','#abcdef',NOW);
 const at=world.collector.position;
 const safeHealth=p.hp;
 tickWorld(world,{now:NOW+100,actors:[{...fighter('sue',at),role:'spectator'}]});
 tickWorld(world,{now:NOW+200,actors:[fighter('sue',[at[0],30,at[2]])]});
 assert.equal(p.hp,safeHealth);
 assert.equal(world.collector.shots.length,0);
 p.spawnProtectedUntil=NOW+10000;
 tickWorld(world,{now:NOW+300,actors:[fighter('sue',at)]});
 assert.equal(p.hp,safeHealth,'respawn protection must be respected');
 assert.equal(world.collector.shots[0].damage,0);
 tickWorld(world,{now:NOW+10_001,actors:[fighter('sue',at)]});
 assert.equal(p.hp,safeHealth,'standing inside after protection expires is not re-entry');
});

test('simultaneous intruders receive separate authoritative shot events',()=>{
 const world=activeWorld(),a=ensureProfile(world,'a','A','#abcdef',NOW),
 b=ensureProfile(world,'b','B','#abcdef',NOW);
 const pos=world.collector.position;
 tickWorld(world,{now:NOW+100,actors:[fighter('a',pos),fighter('b',pos)]});
 assert.ok(Math.abs(a.hp-(a.maxHp-50))<.00001);assert.ok(Math.abs(b.hp-(b.maxHp-50))<.00001);
 assert.deepEqual(world.collector.shots.map(s=>s.target),['a','b']);
 assert.equal(new Set(world.collector.shots.map(s=>s.id)).size,2);
});

test('Collector spawning atop a fighter requires exit and reentry before aggression',()=>{
 const world=createInitialWorld(NOW),p=ensureProfile(world,'early','Early','#abcdef',NOW);
 // Seed the target at the collector's deterministic future spot.
 const sample=createInitialWorld(NOW);
 tickWorld(sample,{now:NOW,actors:[],rng:()=>.4});
 const spot=sample.collector.position;
 tickWorld(world,{now:NOW,actors:[fighter('early',spot)],rng:()=>.4});
 assert.equal(world.collector.active,true);
 assert.equal(world.collector.shots.length,0);
 tickWorld(world,{now:NOW+100,actors:[fighter('early',spot)]});
 assert.equal(p.hp,100);
});

test('Collector appraisals never expire automatically and only dismiss on pointerdown',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 const block=ui.slice(ui.indexOf('  showCollectorSale(sale,key){'),ui.indexOf('  toast(message)'));
 assert.ok(block.length>100);
 assert.match(block,/addEventListener\('pointerdown'/);
 assert.match(block,/overlay\.remove\(\)/);
 assert.doesNotMatch(block,/setTimeout\s*\(/);
 assert.doesNotMatch(block,/collectorSaleTimeout/);
 assert.match(block,/TAP ANYWHERE TO CLOSE/);
});

test('Collector draws a gun, visual tracer and muzzle flash from native avatar shot events',()=>{
 const view=readFileSync(new URL('../src/collector-view.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(view,/createCollectorPistol\(\)/);
 assert.match(view,/this\.gunBone/);
 assert.match(view,/this\.seenShots/);
 assert.match(view,/this\.root\.worldToLocal\(this\.tmpHand\)/);
 assert.match(view,/this\.tracers\.push\(/);
 assert.match(view,/this\.muzzle\.visible/);
 assert.match(main,/new CollectorView\(scene,arena,\(\)=>audio\.play\('shot'/);
});
