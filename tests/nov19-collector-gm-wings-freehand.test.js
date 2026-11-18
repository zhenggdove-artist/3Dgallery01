import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInitialWorld,createProfile,ensureProfile,tickWorld,migrateWorld} from '../src/shared/temple-rules.js';
import {COLLECTOR_INTERVAL_MS,COLLECTOR_SHOT_DAMAGE,COLLECTOR_REPEAT_LINES} from '../src/shared/collector.js';
import {ITEMS,registerCustomWings} from '../src/shared/catalog.js';
import {SWALLOWTAIL_WINGS} from '../src/reletter/wing-catalog.js';
import {normalizePaintedWing} from '../src/shared/custom-wings.js';
import {simplifyFreehandOutline} from '../src/gm-wing-painter.js';

const T=11_199_000;
const player=(key,pos)=>({key,role:'fighter',position:[...pos]});
const fetchText=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fresh=()=>{
 const w=createInitialWorld(T);
 const a=ensureProfile(w,'a','Player A','#aabbcc',T);
 const b=ensureProfile(w,'b','Player B','#bbccdd',T);
 tickWorld(w,{now:T,actors:[],rng:()=>.4});
 assert.equal(w.collector.active,true);
 return {w,a,b};
};

test('Collector allows one sale per player per unique artwork, persists receipts, and punishes duplicates',()=>{
 const {w,a,b}=fresh();
 const pos=[...w.collector.position];
 const id='platform-01',other='platform-02';
 w.artworks[id].holder='a';
 tickWorld(w,{now:T+100,actors:[player('a',pos)],rng:()=>.6});
 assert.equal(w.lastCollectorSale.artworkId,id);
 assert.equal(a.wallet,6080);
 assert.equal(a.collectorSoldArtworks[id],T+100);
 assert.equal(w.collector.active,false);
 // Same art, same account, different Collector visit.
 tickWorld(w,{now:T+100+COLLECTOR_INTERVAL_MS,actors:[],rng:()=>.4});
 const second=[...w.collector.position];
 w.artworks[id].holder='a';
 tickWorld(w,{now:T+102+COLLECTOR_INTERVAL_MS,actors:[player('a',second)],rng:()=>.4});
 assert.equal(a.wallet,6080,'a duplicate must never mint coins');
 assert.equal(a.hp,100-COLLECTOR_SHOT_DAMAGE);
 assert.equal(w.artworks[id].holder,'a','duplicate should not consume the carried artwork');
 assert.equal(w.collector.active,true,'collector stays to trade with other players');
 assert.equal(w.collector.shots.at(-1).reason,'already-collected');
 assert.equal(w.collector.shots.at(-1).artworkId,id);
 assert.ok(COLLECTOR_REPEAT_LINES.includes(w.collector.shots.at(-1).taunt));
 tickWorld(w,{now:T+200+COLLECTOR_INTERVAL_MS,actors:[player('a',second)],rng:()=>.2});
 assert.equal(a.hp,50,'standing inside does not cause repeated shots');
 // Player B may sell exactly the same artwork once.
 w.artworks[id].holder='b';
 tickWorld(w,{now:T+300+COLLECTOR_INTERVAL_MS,actors:[player('b',second)],rng:()=>.2});
 assert.equal(b.wallet,2080);
 assert.equal(b.collectorSoldArtworks[id],T+300+COLLECTOR_INTERVAL_MS);
 // Player A still may sell a different piece.
 tickWorld(w,{now:T+300+2*COLLECTOR_INTERVAL_MS,actors:[],rng:()=>.4});
 w.artworks[other].holder='a';
 tickWorld(w,{now:T+400+2*COLLECTOR_INTERVAL_MS,actors:[player('a',w.collector.position)],rng:()=>.9});
 assert.equal(w.lastCollectorSale.artworkId,other);
 assert.equal(a.wallet,15080);
 const restored=migrateWorld(structuredClone(w),T+500+2*COLLECTOR_INTERVAL_MS);
 assert.equal(restored.profiles.a.collectorSoldArtworks[id],T+100);
 assert.equal(restored.profiles.a.collectorSoldArtworks[other],T+400+2*COLLECTOR_INTERVAL_MS);
 assert.equal(restored.profiles.b.collectorSoldArtworks[id],T+300+COLLECTOR_INTERVAL_MS);
});

test('Collector migrated legacy last sale is protected against one more sale',()=>{
 const w=createInitialWorld(T);
 w.profiles.a=createProfile('a','a','#abcdef',T);
 w.lastCollectorSale={buyer:'a',artworkId:'platform-03',price:1999,time:T-10};
 migrateWorld(w,T);
 assert.equal(w.profiles.a.collectorSoldArtworks['platform-03'],T-10);
});

test('GM receives all catalogue items, all 41 wings, and every new custom wing only once',()=>{
 const w=createInitialWorld(T);
 const gm=ensureProfile(w,'gm','GM','#aabbcc',T,true);
 assert.ok(ITEMS.every(item=>gm.inventory.includes(item.id)),'every base item must be granted');
 assert.equal(SWALLOWTAIL_WINGS.length,21);
 assert.ok(SWALLOWTAIL_WINGS.every(item=>gm.inventory.includes(item.id)));
 assert.equal(new Set(gm.inventory).size,gm.inventory.length,'one of each at initialization');
 const existing=createProfile('legacyGM','legacy','#aabbcc',T,false);
 existing.admin=true;existing.gmInventoryGranted=true;existing.inventory=['white-cat'];
 w.profiles.legacyGM=existing;
 ensureProfile(w,'legacyGM','legacy','#aabbcc',T+1,true);
 assert.ok(ITEMS.every(item=>existing.inventory.includes(item.id)),'legacy GM must migrate');
 const excluded='ember-1';
 existing.inventory.splice(existing.inventory.indexOf(excluded),1);
 ensureProfile(w,'legacyGM','legacy','#aabbcc',T+2,true);
 assert.equal(existing.inventory.includes(excluded),false,'spent fusion item must not be reissued');
 const custom=normalizePaintedWing({
  name:'Freehand specimen',tier:4,color:'#aabbcc',ability:'glide',
  shape:'freehand',scaleX:1,scaleY:1,impulse:11,gravity:.53,flapMs:300,
  outline:[[.1,.2],[.8,.1],[.9,.8],[.2,.9]],strokes:[]
 },'gm-wing-12345678-1234-4123-8123-123456789abc');
 w.customWings.push(custom);
 registerCustomWings(w.customWings);
 ensureProfile(w,'gm','GM','#aabbcc',T+3,true);
 ensureProfile(w,'legacyGM','legacy','#aabbcc',T+3,true);
 for(const p of [gm,existing]){
  assert.equal(p.inventory.filter(id=>id===custom.id).length,1);
  ensureProfile(w,p.key,p.name,p.color,T+4,true);
  assert.equal(p.inventory.filter(id=>id===custom.id).length,1);
 }
});

test('Collector neon text grows 1.5x and flickers without rerendering textures',()=>{
 const source=fetchText('src/collector-view.js');
 assert.match(source,/sprite\.scale\.set\(2\.85\*1\.5,\.75\*1\.5,1\)/);
 assert.match(source,/ctx\.strokeText\('Collector'/);
 assert.match(source,/this\.label\.material\.opacity=/);
 assert.match(source,/Math\.sin\(time\*29\)/);
});

test('GM wing painter starts blank, accepts fully freehand contours and simplifies to server size',()=>{
 const editor=fetchText('src/gm-wing-painter.js');
 const renderer=fetchText('src/reletter/painted-wing-art.js');
 assert.doesNotMatch(editor,/data-wing-shape/);
 assert.match(editor,/shape:'freehand'/);
 assert.match(editor,/outline:\[\]/);
 assert.match(editor,/data-wing-clear-outline/);
 assert.match(editor,/design\.outline=simplifyFreehandOutline\(active\.points,96\)/);
 assert.match(renderer,/item\.shape==='freehand'\?null/);
 const points=Array.from({length:900},(_,i)=>[
  .5+.38*Math.cos(2*Math.PI*i/899)*(1+.12*Math.sin(9*i/899*Math.PI*2)),
  .5+.37*Math.sin(2*Math.PI*i/899)*(1+.08*Math.cos(5*i/899*Math.PI*2))
 ]);
 const simplified=simplifyFreehandOutline(points,96);
 assert.ok(simplified.length>=3&&simplified.length<=96);
 assert.deepEqual(simplified[0],points[0]);
 assert.deepEqual(simplified.at(-1),points.at(-1));
 assert.ok(simplified.every(p=>p.length===2&&p.every(n=>n>=0&&n<=1)));
});
