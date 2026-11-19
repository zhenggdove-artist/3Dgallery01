import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,ARTWORK_RESPAWN_MS} from '../src/shared/temple-rules.js';
import {ARENA_RADIUS,PLATFORMS} from '../src/shared/arena.js';
import {cityLots,CITY_SHOP_STYLES,CITY_INNER_RADIUS,CITY_OUTER_RADIUS} from '../src/outer-city.js';

const T=19_004_000;
const actor=(key,position)=>({key,name:key,role:'fighter',position:[...position],rotation:0,color:'#aa5577'});
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('a sold artwork becomes pickable after respawn, despite that player exhausting sale rights',()=>{
 const world=createInitialWorld(T),player=ensureProfile(world,'buyer','Buyer','#aa5577',T);
 tickWorld(world,{now:T,actors:[],rng:()=>.4});
 const id=PLATFORMS[0].id,position=[...world.collector.position];
 world.artworks[id].holder='buyer';
 tickWorld(world,{now:T+100,actors:[actor('buyer',position)],rng:()=>.4});
 assert.ok(player.collectorSoldArtworks[id]>0);
 assert.equal(world.artworks[id].holder,null);
 const spawn=[...PLATFORMS[0].artPosition];
 let pickup=applyAction(world,actor('buyer',spawn),{action:'pickup-artwork',platformId:id},{now:T+150});
 assert.equal(pickup.error,'Artwork is unavailable','cooldown must be enforced while the art is absent');
 pickup=applyAction(world,actor('buyer',spawn),{action:'pickup-artwork',platformId:id},{now:T+100+ARTWORK_RESPAWN_MS+1});
 assert.equal(pickup.error,undefined,'prior buyer must be able to carry a returned artwork');
 assert.equal(world.artworks[id].holder,'buyer');
 assert.equal(player.collectorSoldArtworks[id],T+100,'one-time sale receipt must remain');
 const released=applyAction(world,actor('buyer',spawn),{action:'throw-artwork',direction:[0,.1,-1],power:1},{now:T+100+ARTWORK_RESPAWN_MS+100,rng:()=>.5,actors:[]});
 assert.equal(released.error,undefined,'artwork sold earlier must remain throwable');
});

test('sand district doubles usable surface area while the central grass remains fixed',()=>{
 assert.equal(ARENA_RADIUS,244);
 assert.equal(CITY_INNER_RADIUS,92);
 assert.ok(Math.abs((CITY_OUTER_RADIUS**2-CITY_INNER_RADIUS**2)/(184**2-92**2)-2)<1e-9);
 assert.match(source('src/grass-field.js'),/new THREE\.CircleGeometry\(CITY_INNER_RADIUS,128\)/);
 assert.match(source('src/arena-view.js'),/this\.outerCity=new OuterCity/);
 assert.match(source('src/arena-view.js'),/cityBlocked\(x,z,y,this\.world\?\.cityDamage/);
});

test('shopfront city is deterministic, varied, bilingual, non-repeating and mobile-safe',()=>{
 const a=cityLots(),b=cityLots(),mobile=cityLots(912744,48);
 assert.deepEqual(a,b);
 assert.equal(a.length,432);assert.equal(mobile.length,48);
 assert.ok(CITY_SHOP_STYLES.length>=12);
 assert.equal(new Set(a.map(l=>l.shopName)).size,a.length);
 assert.ok(a.every(l=>l.shopName&&l.enName&&Math.hypot(l.x,l.z)>CITY_INNER_RADIUS));
 assert.ok(a.every(l=>Math.hypot(l.x,l.z)+l.depth/2<CITY_OUTER_RADIUS));
 assert.deepEqual([...new Set(a.map(l=>l.band))].sort(),[0,1,2,3,4,5,6]);
 const render=source('src/outer-city.js');
 assert.match(render,/Corrugated|corrugated|corrugate/);
 assert.match(render,/Bent dumpster|Open foul dumpsters/);
 assert.match(render,/Windblown tissue paper, leaflets and plastic/);
 assert.match(render,/Small alley rats/);
 assert.match(render,/Buzzing dumpster flies/);
 assert.match(render,/tilted, broken power poles/);
});

test('stale artwork charge cannot block a new pickup and chat disappears only in sniper scope',()=>{
 const main=source('src/main.js'),gun=source('src/gun-controller.js'),css=source('fidelity-ui.css');
 assert.match(main,/if\(!carryingArtwork&&artworkThrow\.started!==null\)artworkThrow\.cancel\(\)/);
 assert.match(main,/if\(carryingArtwork\)/);
 assert.match(gun,/document\.body\.classList\.toggle\('sniper-scoped',scope\)/);
 assert.match(gun,/document\.body\.classList\.remove\('sniper-scoped'\)/);
 assert.match(css,/body\.sniper-scoped #chat-hud\{visibility:hidden!important/);
 assert.doesNotMatch(css,/body\.sniper-scoped #gun-overlay\{visibility:hidden/);
});