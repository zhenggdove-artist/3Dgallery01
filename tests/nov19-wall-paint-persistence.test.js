import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createInitialWorld,ensureProfile,applyAction,worldView,migrateWorld
} from '../src/shared/temple-rules.js';
import {CITY_LOTS,CITY_MAX_HP,cityWallPoint,cityPaintHit} from '../src/shared/city-layout.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const LOT=CITY_LOTS.find(l=>l.floors>=2);
const S=1700000000000;
const point=cityWallPoint(LOT,'front',.5,.8);
function actor(key='artist',admin=false,role='fighter'){
 return {key,name:admin?'Ely':'Artist',color:'#334455',
  role,admin,position:[point[0],point[1],point[2]+1]};
}
function stroke(tool='brush'){
 return {lotId:LOT.id,wall:'front',tool,color:'#f5223e',size:.18,
  points:[[.45,.8],[.50,.79],[.55,.78]]};
}
test('3D facade cursor hit returns real facade and normalized UV',()=>{
 const target=cityWallPoint(LOT,'front',.5,.8);
 const origin=cityWallPoint(LOT,'front',.5,.8,6);
 const dir=target.map((p,i)=>(p-origin[i])/6);
 const hit=cityPaintHit(origin,dir,12,{});
 assert.equal(hit.lotId,LOT.id);
 assert.equal(hit.wall,'front');
 assert.ok(Math.abs(hit.u-.5)<1e-5&&Math.abs(hit.v-.8)<1e-5);
 assert.equal(cityPaintHit(origin,dir,12,{[LOT.id]:{hp:0,maxHp:CITY_MAX_HP}}),null);
});
test('brush + eraser remain archived through reload and GM building repair',()=>{
 const world=createInitialWorld(S),artist=actor(),gm=actor('gm',true);
 ensureProfile(world,artist.key,artist.name,artist.color,S,false);
 ensureProfile(world,gm.key,gm.name,gm.color,S,true);
 const brush=applyAction(world,artist,{action:'paint-building',stroke:stroke()},{now:S+1});
 assert.ok(brush.paintStroke?.id);
 const erase=applyAction(world,artist,{action:'paint-building',stroke:stroke('eraser')},{now:S+2});
 assert.equal(erase.paintStroke.tool,'eraser');
 assert.equal(world.wallPaint[LOT.id].front.length,2);
 world.cityDamage[LOT.id]={hp:0,maxHp:CITY_MAX_HP};
 const paintSnapshot=structuredClone(world.wallPaint);
 const repaired=applyAction(world,gm,{action:'reset-buildings'},{now:S+3});
 assert.equal(repaired.resetBuildings,true);
 assert.deepEqual(world.cityDamage,{});
 assert.deepEqual(world.wallPaint,paintSnapshot,'GM repair MUST NOT erase art');
 const restored=migrateWorld(structuredClone(world));
 assert.deepEqual(restored.wallPaint,paintSnapshot);
 assert.equal(worldView(restored,artist.key).wallPaint[LOT.id].front.length,2);
});
test('/clean graffic is GM-only and cleans every stored facade stroke',()=>{
 const world=createInitialWorld(S),artist=actor(),gm=actor('gm',true);
 ensureProfile(world,artist.key,artist.name,artist.color,S,false);
 ensureProfile(world,gm.key,gm.name,gm.color,S,true);
 applyAction(world,artist,{action:'paint-building',stroke:stroke()},{now:S+1});
 world.cityDamage[LOT.id]={hp:1};
 const denied=applyAction(world,artist,{action:'clean-graffiti'},{now:S+2});
 assert.equal(denied.error,'GM only');
 assert.equal(world.wallPaint[LOT.id].front.length,1);
 const clean=applyAction(world,gm,{action:'clean-graffiti'},{now:S+3});
 assert.equal(clean.cleanGraffiti,true);assert.equal(clean.removedStrokes,1);
 assert.deepEqual(world.wallPaint,{});
 assert.deepEqual(world.cityDamage[LOT.id],{hp:1},'clean must NOT repair the building');
});
test('painting rejects spectators, destroyed walls and unsafe coordinates',()=>{
 const world=createInitialWorld(S),artist=actor();
 ensureProfile(world,artist.key,artist.name,artist.color,S,false);
 assert.equal(applyAction(world,{...artist,role:'spectator'},
  {action:'paint-building',stroke:stroke()},{now:S+1}).error,'Spectators cannot paint');
 assert.equal(applyAction(world,artist,{action:'paint-building',stroke:{...stroke(),points:[[100,2]]}},
  {now:S+1}).error,'Invalid paint coordinates');
 world.cityDamage[LOT.id]={hp:0};
 assert.match(applyAction(world,artist,{action:'paint-building',stroke:stroke()},
  {now:S+2}).error,/Restore/);
});
test('rendered wall paints deform with the actual building and restore without clearing canvas',()=>{
 const city=source('src/outer-city.js'),paint=source('src/city-wall-paint.js'),arena=source('src/arena-view.js');
 assert.match(city,/wallPaint=new CityWallPaint/);
 assert.match(city,/wallPaint\?\.collapseLot\(index\)/);
 assert.match(city,/wallPaint\?\.resetBuildings\(\)/);
 assert.match(paint,/const compression=\.08\+\.075/);
 assert.match(paint,/attr\.array\.set\(slot\.original\)/);
 assert.match(paint,/destination-out/);
 assert.match(arena,/wallPaint\?\.sync\(world\.wallPaint/);
 const html=source('index.html'),login=html.slice(html.indexOf('<main id="entry"'),html.indexOf('<section id="hud"'));
 assert.match(login,/Choose Google Account/);assert.match(login,/不會讀取 Gmail/);
 assert.doesNotMatch(login,/多人線上互動藝術空間/);
 assert.match(html,/id="paint-button"/);assert.match(html,/id="paint-eraser"/);
 assert.match(source('src/main.js'),/clean-graffiti/);
 assert.match(source('cloudflare/worker.js'),/graffic\|graffiti/);
});
