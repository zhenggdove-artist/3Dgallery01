import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CITY_LAYOUT_SIGNATURE,CITY_LOTS,cityShopSignSpec,citySignSpecs,signWorldPosition,cityRaycast,deriveCitySignMounts} from '../src/shared/city-layout.js';
import {CITY_SIGN_MOUNT_SIGNATURE,CITY_SIGN_MOUNTS} from '../src/shared/city-sign-mounts.js';

test('a cold short attack in open space does not solve every distant sign mount',async()=>{
 const {cityRaycast:cast}=await import('../src/shared/city-layout.js?cold-v085-perf');
 const original=Math.cos;let calls=0;
 Math.cos=x=>{calls++;return original(x);};
 try{assert.equal(cast([101,1.16,-51],[0,0,1],2.03),null);}
 finally{Math.cos=original;}
 // Count work, not milliseconds: a ray that cannot reach any sign must
 // only need the per-lot test, not the hundreds of thousands of solver calls.
 assert.ok(calls<4*CITY_LOTS.length,`unexpected work for an open-space miss: ${calls} cosine evaluations`);
});

test('a cold first cast that hits a building resolves only the signs it can reach',async()=>{
 const {cityRaycast:cast}=await import('../src/shared/city-layout.js?cold-building-v085-perf');
 const original=Math.cos;let calls=0;
 Math.cos=x=>{calls++;return original(x);};
 try{
  const hit=cast([85.964,1.16,-43.694],[.91771,0,-.39725],2.03);
  assert.equal(hit?.lot.id,'city-0');assert.equal(hit?.part,'windows-0-0');
 }finally{Math.cos=original;}
 assert.ok(calls<6*CITY_LOTS.length,`unexpected work for first building impact: ${calls} cosine evaluations`);
});

test('V85 city sign choices, order and bracket transforms are preserved for all 504 lots',()=>{
 const all=CITY_LOTS.map(lot=>[lot.id,cityShopSignSpec(lot),citySignSpecs(lot)]);
 assert.equal(all.length,504);
 // Round only the platform-dependent last bits of trigonometric functions.
 // The reference comes from the unmodified V85 (15ede91) algorithm.
 const digest=createHash('sha256').update(JSON.stringify(all,(_,n)=>typeof n==='number'?+n.toFixed(8):n)).digest('hex');
 assert.equal(digest,'e74cf9229868e428aaada746e1c2f89636459f2d48d68475356aedf6d2bb0659');
});

test('an outward shot still hits a board before masonry, excluding a detached board',()=>{
 let tested=0;
 for(const lot of CITY_LOTS){
  const sign=citySignSpecs(lot).find(s=>!s.blade);
  if(!sign)continue;
  const [x,y,z]=signWorldPosition(lot,sign),dx=Math.sin(lot.yaw),dz=Math.cos(lot.yaw);
  const origin=[x+dx,y,z+dz],direction=[-dx,0,-dz];
  const impact=cityRaycast(origin,direction,2);
  if(impact?.lot!==lot||impact.part!==sign.id)continue;
  const detached=cityRaycast(origin,direction,2,{[lot.id]:{hp:240,parts:{[sign.id]:0}}});
  assert.ok(detached?.lot!==lot||detached.part!==sign.id);
  tested++;
 }
 assert.ok(tested>100,'use a representative sample of authored sign colliders');
});

test('static mount recipe still matches the complete placement solver',()=>{
 assert.equal(CITY_SIGN_MOUNT_SIGNATURE,CITY_LAYOUT_SIGNATURE);
 assert.deepEqual(CITY_SIGN_MOUNTS,deriveCitySignMounts(),'regenerate via node scripts/generate-city-sign-mounts.mjs');
});
