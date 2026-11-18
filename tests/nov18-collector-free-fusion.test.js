import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialWorld,ensureProfile,tickWorld,worldView} from '../src/shared/temple-rules.js';
import {COLLECTOR_INTERVAL_MS,COLLECTOR_MIN_PRICE,COLLECTOR_MAX_PRICE,COLLECTOR_REVIEWS,COLLECTOR_RADIUS} from '../src/shared/collector.js';
import {ECONOMY} from '../src/shared/catalog.js';
import {fuseTemple} from '../src/shared/temple-fusion.js';

const NOW=8_200_000;
const fighter=(key,position)=>({key,role:'fighter',position});

test('fusion never charges coins, including attempts that fail',()=>{
 const world=createInitialWorld(NOW),p=ensureProfile(world,'owner','owner','#abcdef',NOW);
 p.wallet=0;p.inventory.push('ember-1','frost-1','ember-2');
 const done=fuseTemple(world,p,{sourceId:'frost-1',targetId:'ember-1',requestId:'free-fusion-success'},()=>0);
 assert.equal(done.fusion.cost,0);assert.equal(done.fusion.success,true);
 assert.equal(p.wallet,0);assert.equal(world.activity.coinBurned,0);
 const fail=fuseTemple(world,p,{sourceId:'ember-2',targetId:'ember-1',requestId:'free-fusion-failure'},()=>1);
 assert.equal(fail.fusion.cost,0);assert.equal(fail.fusion.success,false);
 assert.equal(p.wallet,0);assert.equal(world.activity.coinBurned,0);
 assert.equal(ECONOMY.fusionBaseCost,0);
});

test('collector purchases exactly one held artwork, pays buyer and disappears until next spawn',()=>{
 const world=createInitialWorld(NOW),p=ensureProfile(world,'buyer','buyer','#abcdef',NOW);
 assert.equal(world.collector.active,false);
 assert.equal(tickWorld(world,{now:NOW,actors:[],rng:()=>.42}),true);
 assert.equal(world.collector.active,true);
 const spot=[...world.collector.position];
 const other=ensureProfile(world,'other','other','#abcdef',NOW);
 world.artworks['platform-01'].holder='buyer';
 world.artworks['platform-02'].holder='buyer'; // a Collector accepts only one at a time
 const wallet=p.wallet;
 tickWorld(world,{now:NOW+100,actors:[fighter('buyer',spot),fighter('other',spot)],rng:()=>.6});
 assert.equal(p.wallet-wallet,6000);
 assert.equal(world.activity.coinMinted,6000);
 assert.equal(other.wallet,80);
 assert.equal(world.collector.active,false);
 assert.equal(world.collector.nextSpawnAt,NOW+100+COLLECTOR_INTERVAL_MS);
 assert.equal(world.lastCollectorSale.review,COLLECTOR_REVIEWS[3]);
 assert.equal(worldView(world,'buyer',NOW+100).collectorSale.price,6000);
 assert.equal(Object.values(world.artworks).filter(a=>a.holder==='buyer').length,1);
 assert.equal(world.artworks['platform-01'].holder,null);
 assert.equal(world.artworks['platform-01'].availableAt,NOW+100+30_000);
 const minted=world.activity.coinMinted;
 tickWorld(world,{now:NOW+200,actors:[fighter('buyer',spot)],rng:()=>.2});
 assert.equal(world.activity.coinMinted,minted);
 assert.equal(tickWorld(world,{now:NOW+100+COLLECTOR_INTERVAL_MS,actors:[],rng:()=>.3}),true);
 assert.equal(world.collector.active,true);
});

test('no purchase for spectators, empty hands or vertical-distance cheats',()=>{
 const world=createInitialWorld(NOW);
 tickWorld(world,{now:NOW,actors:[],rng:()=>.1});
 const pos=world.collector.position;
 const p=ensureProfile(world,'p','p','#abcdef',NOW);
 world.artworks['platform-01'].holder='p';
 const before=p.wallet;
 tickWorld(world,{now:NOW+1,actors:[{key:'p',role:'spectator',position:pos}],rng:()=>0});
 tickWorld(world,{now:NOW+2,actors:[fighter('p',[pos[0],20,pos[2]])],rng:()=>0});
 assert.equal(p.wallet,before);assert.equal(world.collector.active,true);
 world.artworks['platform-01'].holder=null;
 tickWorld(world,{now:NOW+3,actors:[fighter('p',pos)],rng:()=>0});
 assert.equal(p.wallet,before);assert.equal(world.collector.active,true);
 assert.equal(COLLECTOR_MIN_PRICE,1);
 assert.equal(COLLECTOR_MAX_PRICE,9999);
 assert.equal(COLLECTOR_REVIEWS.length,5);
 assert.equal(COLLECTOR_RADIUS,2.8);
});

test('collector stays at the same spot indefinitely without a purchase',()=>{
 const w=createInitialWorld(NOW);
 tickWorld(w,{now:NOW,actors:[],rng:()=>.15});
 const first=[...w.collector.position],spawned=w.collector.spawnedAt;
 for(const elapsed of [29_999,30_000,60_000,1_800_000]){
  tickWorld(w,{now:NOW+elapsed,actors:[],rng:()=>.8});
  assert.deepEqual(w.collector.position,first);
  assert.equal(w.collector.spawnedAt,spawned);
  assert.equal(w.collector.active,true);
 }
});

test('Collector price can be every integer from 1 to 9999, with inclusive endpoints and no 1000-coin tiers',()=>{
 const samples=[[0,1],[.0002,2],[.123456789,1235],[.5,5000],[.999999999999,9999],[1,9999]];
 for(const [sample,expected] of samples){
  const world=createInitialWorld(NOW),profile=ensureProfile(world,'buyer','buyer','#abcdef',NOW);
  tickWorld(world,{now:NOW,actors:[],rng:()=>.3});
  world.artworks['platform-01'].holder='buyer';
  tickWorld(world,{now:NOW+100,actors:[fighter('buyer',world.collector.position)],rng:()=>sample});
  assert.equal(world.lastCollectorSale.price,expected,'random sample '+sample);
  assert.equal(profile.wallet,80+expected);
  assert.ok(COLLECTOR_REVIEWS.includes(world.lastCollectorSale.review));
 }
});
