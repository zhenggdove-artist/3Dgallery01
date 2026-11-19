import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_LOTS,CITY_MAX_HP,cityCollisionCandidates,cityBlocked,cityGroundHeight,
 cityRoofHeightAtPoint} from '../src/shared/city-layout.js';
function actualFootprint(lot,x,z,margin=0){
 const dx=x-lot.x,dz=z-lot.z,c=Math.cos(lot.yaw),s=Math.sin(lot.yaw);
 if(dx*dx+dz*dz>(lot.width+lot.depth+margin*3)**2)return false;
 const lx=dx*c-dz*s,lz=dx*s+dz*c;
 return Math.abs(lx)<=lot.width/2+margin&&Math.abs(lz)<=lot.depth/2+margin;
}
function legacyHeight(x,z,y,damage){
 let height=0;
 for(const lot of CITY_LOTS){
  if(!actualFootprint(lot,x,z,.16))continue;
  const top=cityRoofHeightAtPoint(lot,x,z,damage[lot.id]?.hp??CITY_MAX_HP,damage[lot.id]?.maxHp??CITY_MAX_HP);
  if(y>=top-.16)height=Math.max(height,top);
 }
 return height;
}
function legacyBlocked(x,z,y,damage,radius=.22){
 for(const lot of CITY_LOTS){
  if(!actualFootprint(lot,x,z,radius))continue;
  const top=cityRoofHeightAtPoint(lot,x,z,damage[lot.id]?.hp??CITY_MAX_HP,damage[lot.id]?.maxHp??CITY_MAX_HP);
  if(y>=-1&&y<top-.12)return true;
 }
 return false;
}
function random(seed){let x=seed>>>0;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);}
test('spatial hash produces EXACTLY the same client and Worker collision results as all-432 scans',()=>{
 const r=random(91240);
 const damage={};
 for(const lot of CITY_LOTS)if(lot.index%3===0)damage[lot.id]={hp:Math.round(r()*CITY_MAX_HP),maxHp:CITY_MAX_HP};
 for(let i=0;i<1900;i++){
  const x=(r()-.5)*510,z=(r()-.5)*510,y=r()*22;
  const nearby=cityCollisionCandidates(x,z);
  assert.ok(nearby.length<=CITY_LOTS.length);
  for(const radius of [.16,.22,.6]){
   const expected=legacyBlocked(x,z,y,damage,radius);
   assert.equal(cityBlocked(x,z,y,damage,radius),expected,`block mismatch at ${x},${z},${y},r=${radius}`);
  }
  assert.ok(Math.abs(cityGroundHeight(x,z,y,damage)-legacyHeight(x,z,y,damage))<1e-8);
 }
});
test('roof corners, rotated facades and near-wall margins never miss city collision candidates',()=>{
 for(const lot of CITY_LOTS){
  const cs=Math.cos(lot.yaw),sn=Math.sin(lot.yaw);
  for(const sx of [-1,0,1])for(const sz of [-1,0,1]){
   const x=lot.x+cs*sx*lot.width*.5+sn*sz*lot.depth*.5;
   const z=lot.z-sn*sx*lot.width*.5+cs*sz*lot.depth*.5;
   assert.ok(cityCollisionCandidates(x,z).includes(lot),`missed corner ${lot.id}`);
   assert.equal(cityBlocked(x,z,-.2,{[lot.id]:{hp:CITY_MAX_HP}}),legacyBlocked(x,z,-.2,{[lot.id]:{hp:CITY_MAX_HP}}));
  }
 }
 assert.equal(cityCollisionCandidates(9999,9999).length,0);
 assert.equal(cityCollisionCandidates(0,0,2.1),CITY_LOTS);
});
