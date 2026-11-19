import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARENA_RADIUS} from '../src/shared/arena.js';
import {CITY_LOTS,CITY_BUILDING_COUNT,CITY_MATERIALS,CITY_MAX_HP,CITY_INNER_RADIUS,
 CITY_OUTER_RADIUS,cityBlocked,cityStage,cityRaycast,cityLots} from '../src/shared/city-layout.js';
import {validateState,createInitialWorld,worldView,ensureProfile} from '../src/shared/temple-rules.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('the ruined city district retains twice the original area and triple the housing density',()=>{
 const oldArea=Math.PI*(184**2-92**2);
 const newArea=Math.PI*(CITY_OUTER_RADIUS**2-CITY_INNER_RADIUS**2);
 assert.ok(Math.abs(newArea/oldArea-2)<1e-12);
 assert.equal(CITY_BUILDING_COUNT,72*2*3);
 assert.equal(CITY_LOTS.length,432);
 assert.equal(ARENA_RADIUS,244);
 assert.deepEqual(cityLots(),cityLots());
 assert.equal(new Set(CITY_LOTS.map(l=>l.id)).size,432);
});
test('every material and physically distinct low and tall silhouettes exist',()=>{
 const materials=new Set(CITY_LOTS.map(l=>l.material));
 assert.equal(materials.size,CITY_MATERIALS.length);
 assert.ok(CITY_LOTS.some(l=>l.floors===4));
 assert.ok(CITY_LOTS.some(l=>l.floors===1));
 assert.ok(CITY_LOTS.some(l=>l.depth/l.width>2));
 assert.ok(CITY_LOTS.some(l=>l.width/l.depth>1.3));
 assert.ok(CITY_LOTS.some(l=>l.decay>.9));
 assert.ok(CITY_LOTS.every(l=>l.height>2&&l.width>3&&l.depth>3));
});
test('intact homes obstruct players and weapon rays; stage three clears the collider',()=>{
 const lot=CITY_LOTS.find(l=>l.floors>=3);
 assert.equal(cityBlocked(lot.x,lot.z,0,{}),true);
 assert.equal(cityStage(CITY_MAX_HP),0);
 assert.equal(cityStage(CITY_MAX_HP*.62),1);
 assert.equal(cityStage(CITY_MAX_HP*.2),2);
 assert.equal(cityStage(0),3);
 const wreck={[lot.id]:{hp:0,maxHp:CITY_MAX_HP}};
 assert.equal(cityBlocked(lot.x,lot.z,0,wreck),false);
 const dir=[-Math.cos(lot.angle),0,-Math.sin(lot.angle)];
 const origin=[lot.x+Math.cos(lot.angle)*18,lot.height*.4,lot.z+Math.sin(lot.angle)*18];
 const hit=cityRaycast(origin,dir,23,{});
 assert.ok(hit);
 assert.ok(hit.distance>=0&&hit.distance<=23);
 assert.equal(typeof hit.part,'string');
});
test('authoritative player pose validation rejects entry into a solid building',()=>{
 const world=createInitialWorld(1000),lot=CITY_LOTS[0];
 ensureProfile(world,'tester','Tester','#aa5577',1000);
 assert.deepEqual(world.cityDamage,{});
 assert.deepEqual(worldView(world,'tester',2000).cityDamage,{});
 const previous={position:[lot.x+15,0,lot.z],rotation:0,animation:'idle'};
 const next={position:[lot.x,0,lot.z],rotation:0,animation:'run'};
 const r=validateState(previous,next,1000,'fighter',null,null,2000,{cityDamage:world.cityDamage,stats:{speed:3}});
 assert.equal(r.error,'Building collision');
 const nowBroken={cityDamage:{[lot.id]:{hp:0}} ,stats:{speed:3}};
 const reopened=validateState(previous,next,1000,'fighter',null,null,2000,nowBroken);
 assert.equal(reopened.error,undefined);
});
test('fragmented structural facades stay solid, synchronized and restore all damaged lots',()=>{
 const render=source('src/outer-city.js');
 assert.match(render,/BoxGeometry\(1,1,1\)/);
 assert.match(render,/createChunks\(lot,stage/);
 assert.match(render,/applyDamageEvent\(event\)/);
 assert.match(render,/syncDamage\(damage=\{\}\)/);
 assert.match(render,/hidePart\(index,part\)/);
 assert.match(render,/flash\(lot\)/);
 assert.match(render,/eject\(lot,part,point,detached=false\)/);
 assert.doesNotMatch(render,/this\.root\.add\(ground\)/);
 assert.match(render,/installFacadeCracks/);
 assert.doesNotMatch(render,/cityLots\(912744,mobile/);
});
test('entry copy is entirely English and SUPPORT has no fake OS or artist prompt',()=>{
 const html=source('index.html'),ui=source('src/ui.js'),main=source('src/main.js');
 const login=html.slice(html.indexOf('<main id="entry"'),html.indexOf('<section id="hud"'));
 assert.doesNotMatch(login,/[\u3400-\u9fff]/);
 assert.match(login,/Sign in with Google/);
 assert.match(login,/Create Character & Enter/);
 const start=ui.indexOf('  renderWingShop(profile){');
 const end=ui.indexOf('  hydrateWingGalleryImages(){',start);
 const support=ui.slice(start,end);
 assert.doesNotMatch(support,/ggdove98|<em>98<\/em>/i);
 assert.match(support,/data-wing-checkout/);
 for(const fragment of ['Firebase 尚未','Google 登入','帳號登入'])assert.ok(!main.includes(fragment));
});
