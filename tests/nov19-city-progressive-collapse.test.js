import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CITY_LOTS,CITY_MAX_HP,cityDamageTier,cityCollapseProgress,
 cityCollapsePosition,cityRoofHeight,cityRoofHeightAtHp,cityGroundHeight,cityBlocked
} from '../src/shared/city-layout.js';

const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const lot=CITY_LOTS.find(l=>l.floors>=3);

test('building HP drops create exactly ten independent 10% structural tiers',()=>{
 assert.equal(cityDamageTier(CITY_MAX_HP),0);
 assert.equal(cityDamageTier(239),0);
 for(let tier=1;tier<=10;tier++){
  const hp=CITY_MAX_HP*(1-tier/10);
  assert.equal(cityDamageTier(hp),tier);
  assert.equal(cityDamageTier(Math.min(CITY_MAX_HP,hp+.001)),tier-1);
 }
 assert.equal(cityDamageTier(-500),10);
 assert.equal(cityDamageTier(9999),0);
 assert.equal(cityCollapseProgress(0),0);
 assert.equal(cityCollapseProgress(10),1);
});

test('every 10% damage causes a distinguishable physical roof collapse and matches wall vertices',()=>{
 let previous=Infinity;
 for(let tier=0;tier<=10;tier++){
  const hp=CITY_MAX_HP*(1-tier/10);
  const height=cityRoofHeightAtHp(lot,hp);
  assert.ok(height<previous,'each damage tier must lower the physical building');
  previous=height;
  const roof=cityCollapsePosition(lot,lot.x,lot.height+.13,lot.z,tier,true);
  assert.ok(Math.abs(roof[1]-height)<1e-6,'rendered roof and shared Worker collider remain aligned');
  const target={[lot.id]:{hp,maxHp:CITY_MAX_HP}};
  assert.equal(cityBlocked(lot.x,lot.z,0,target),true);
  assert.equal(cityBlocked(lot.x,lot.z,height+.1,target),false);
  assert.ok(cityGroundHeight(lot.x,lot.z,height+.01,target)>=height-.001);
 }
 assert.equal(cityRoofHeightAtHp(lot,0),cityRoofHeight(lot,3));
 assert.equal(cityRoofHeightAtHp(lot,CITY_MAX_HP),lot.height+.13);
});

test('building-hit shader uses an actual per-building red surface tint, not a reverse-face dummy box',()=>{
 const city=source('src/outer-city.js'),vfx=source('src/city-ruins-vfx.js');
 assert.match(vfx,/bytes\[index\*4\+1\]/);
 assert.match(vfx,/diffuseColor\.rgb=mix\(diffuseColor\.rgb,vec3\(1\.,\.014,\.025\)/);
 assert.match(vfx,/installAttachedFlash\(/);
 assert.match(city,/this\.facade\.pulse\(lot\.index,1\)/);
 assert.match(city,/this\.shakes\.set\(lot\.index/);
 assert.doesNotMatch(city,/side:THREE\.BackSide/);
});

test('strong hits traverse every crossed threshold while small hits still shed debris',()=>{
 const client=source('src/outer-city.js'),server=source('src/shared/temple-rules.js');
 assert.match(server,/previousHp,previousTier,tier/);
 assert.match(client,/this\.beginCollapse\(lot,from,tier,event\)/);
 assert.match(client,/this\.emitCollapseStep\(lot,motion\.tier\+1,motion\.event\)/);
 assert.match(client,/if\(tier===from\)/);
 for(const part of ['sign','pipes','timber','tiles','stone','sheets-roof','windows-']){
  assert.ok(client.includes(part),'staged debris contains '+part);
 }
});

test('user painting follows deformed walls on all steps and survives GM repair',()=>{
 const city=source('src/outer-city.js'),paint=source('src/city-wall-paint.js');
 assert.match(city,/this\.wallPaint\?\.deformTier\(index,tier,shakeX,shakeZ\)/);
 assert.match(paint,/cityCollapsePosition\(lot,/);
 assert.match(paint,/attr\.array\.set\(slot\.original\)/);
 assert.match(city,/this\.wallPaint\?\.resetBuildings\(\)/);
});
