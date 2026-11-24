import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCollector,tickCollector,COLLECTOR_INTERVAL_MS} from '../src/shared/collector.js';

const NOW=100_000;
const ID='platform-01';
const spot=[20,0,-34];
function fixture(admin){
 const profile={admin,hp:100,deadUntil:0,wallet:80,collectorSoldArtworks:{}};
 const world={profiles:{seller:profile},artworks:{[ID]:{holder:'seller',availableAt:0}},collector:initialCollector(NOW)};
 const actor={key:'seller',role:'fighter',position:spot,admin:!admin}; // forged client role must not decide exemption
 function encounter(now){
  Object.assign(world.collector,{active:true,position:spot,insideKeys:{}});
  world.artworks[ID].holder='seller';
  tickCollector(world,[actor],now,()=>.2,()=>{profile.hp-=50;return {damage:50};});
 }
 return {world,profile,encounter};
}
test('GM can sell the same artwork again after each respawn without refusal or gunfire',()=>{
 const {world,profile,encounter}=fixture(true);
 encounter(NOW);
 const first=world.lastCollectorSale;
 assert.equal(first.artworkId,ID);
 assert.equal(profile.collectorSoldArtworks[ID],NOW);
 assert.equal(world.artworks[ID].availableAt,NOW+30_000);
 assert.equal(world.collector.nextSpawnAt,NOW+COLLECTOR_INTERVAL_MS);
 encounter(NOW+30_000);
 assert.notEqual(world.lastCollectorSale.id,first.id);
 assert.equal(world.lastCollectorSale.artworkId,ID);
 assert.equal(world.lastCollectorSale.time,NOW+30_000);
 assert.equal(world.collector.active,false);
 assert.equal(world.artworks[ID].holder,null);
 assert.equal(world.collector.shots.length,0);
 assert.equal(profile.hp,100);
 assert.equal(profile.wallet,80,'preserve existing GM wallet behavior');
});
test('ordinary player is still refused for the same artwork even with a client admin flag',()=>{
 const {world,profile,encounter}=fixture(false);
 encounter(NOW);
 const first=world.lastCollectorSale;
 const wallet=profile.wallet;
 encounter(NOW+30_000);
 assert.equal(world.lastCollectorSale.id,first.id);
 assert.equal(world.collector.active,true);
 assert.equal(world.artworks[ID].holder,'seller');
 assert.equal(world.collector.shots.at(-1).reason,'already-collected');
 assert.equal(profile.wallet,wallet);
 assert.equal(profile.hp,50);
});
test('GM without artwork still receives normal empty-handed refusal',()=>{
 const {world,profile}=fixture(true);
 world.artworks[ID].holder=null;
 Object.assign(world.collector,{active:true,position:spot});
 tickCollector(world,[{key:'seller',role:'fighter',position:spot}],NOW,()=>.2,()=>({damage:0}));
 assert.equal(world.collector.shots.at(-1).reason,'empty-handed');
 assert.equal(world.lastCollectorSale,undefined);
 assert.equal(profile.wallet,80);
});
