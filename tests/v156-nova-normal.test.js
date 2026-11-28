import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {attackDirection,raisedBeamDirection} from '../src/aiming.js';
import {itemById,attackStats} from '../src/shared/catalog.js';
import {weaponQuality,forwardCastRadius,normalCastRadius,staffOrbVisualScale,STAFF_ORB_SHELL_RADIUS,STAFF_ORB_SHELL_PULSE} from '../src/shared/weapon-abilities.js';
import {createInitialWorld,ensureProfile,applyAction,previewImmediateBuildingDamage,previewActorContacts} from '../src/shared/temple-rules.js';
import {CITY_LOTS,CITY_MAX_HP,citySignSpecs,cityLocal,cityFacadeFloor,cityRaycast} from '../src/shared/city-layout.js';
test('all five Nova taps retain a fixed reticle direction independent of scene targets',()=>{
 const camera=new THREE.PerspectiveCamera(55,1.8,.1,400);
 camera.position.set(0,2,8);camera.lookAt(0,2,-12);camera.updateMatrixWorld(true);
 const root=new THREE.Group(),muzzle=new THREE.Vector3(.5,2.5,0);
 const scene={structureGroup:new THREE.Group(),world:{monster:null,monsters:[]},islandEnemies:{current:null,extraModels:[]}};
 const roots=new Map(),expected=raisedBeamDirection(camera,muzzle).toArray();
 for(let grade=1;grade<=5;grade++){
  const item=itemById('nova-'+grade);
  assert.deepEqual(attackDirection({root},camera,scene,roots,item,0,muzzle),expected);
  const target=new THREE.Group();target.position.set(0,1,-3);roots.set('enemy',target);
  scene.world.monster={active:true,position:[0,0,-2],bodyRadius:2,bodyHeight:4};
  assert.deepEqual(attackDirection({root},camera,scene,roots,item,0,muzzle),expected);
 }
});
test('Nova normal collision uses visible orb at every quality; other staff normal radius stays unchanged',()=>{
 for(let grade=1;grade<=5;grade++){
  const item=itemById('nova-'+grade),q=weaponQuality(item),stats=attackStats(item,0);
  const radius=normalCastRadius(item,q,stats.radius);
  assert.equal(radius,STAFF_ORB_SHELL_RADIUS*(1+STAFF_ORB_SHELL_PULSE)*staffOrbVisualScale(q.visual));
  assert.ok(radius<.9&&radius<forwardCastRadius(item,q,stats.radius,false));
  const data={weapon:item.id,owner:'caster',origin:[75,1,0],direction:[0,0,1],range:8,radius,flightMs:300};
  const targets=[{key:'side',kind:'player',position:[79,0,4],hp:100},{key:'ahead',kind:'player',position:[75,0,4],hp:100}];
  assert.deepEqual(previewActorContacts(data,targets,0,300),['ahead']);
 }
 const other=itemById('bloom-5'),q=weaponQuality(other),stats=attackStats(other,0);
 assert.equal(normalCastRadius(other,q,stats.radius),forwardCastRadius(other,q,stats.radius,false));
});
test('authoritative Nova tap launches ordinary fixed-direction projectile with shared normal radius',()=>{
 const T=90000000;
 for(let grade=1;grade<=5;grade++){
  const w=createInitialWorld(T),actor={key:'caster',name:'Caster',color:'#abcdef',role:'fighter',position:[75,0,0]};
  const p=ensureProfile(w,actor.key,actor.name,actor.color,T),item=itemById('nova-'+grade);
  p.inventory.push(item.id);p.equipment.weapon=item.id;
  const result=applyAction(w,actor,{action:'attack',direction:[0,0,1],charge:0},{now:T+5000,actors:[actor],rng:()=>.5});
  assert.ok(result.attackEvent,result.error);
  assert.equal(result.attackEvent.ultimate,false);
  assert.equal(result.attackEvent.radius,normalCastRadius(item,weaponQuality(item),attackStats(item,0).radius));
  const fx=w.persistentAttacks.find(v=>v.owner===actor.key&&v.weapon===item.id);
  assert.equal(fx.kind,'projectile');assert.deepEqual(fx.direction,[0,0,1]);assert.equal(fx.radius,result.attackEvent.radius);
 }
});
test('Nova grazing a city facade places chips on the real wall, not at the launch position',()=>{
 const T=90000000,w=createInitialWorld(T),lot=CITY_LOTS[0],floor=cityFacadeFloor(lot,0);
 w.cityDamage=Object.fromEntries(CITY_LOTS.filter(v=>v!==lot).map(v=>[v.id,{hp:0,maxHp:CITY_MAX_HP}]));
 w.cityDamage[lot.id]={hp:CITY_MAX_HP,maxHp:CITY_MAX_HP,parts:Object.fromEntries(citySignSpecs(lot).map(s=>[s.id,0]))};
 const item=itemById('nova-5'),q=weaponQuality(item),radius=normalCastRadius(item,q,attackStats(item,0).radius);
 const c=Math.cos(lot.yaw),s=Math.sin(lot.yaw),localX=-floor.w/2+floor.w*.25,localZ=-floor.d/2-.35,y=Math.min(1.2,floor.top*.5);
 const origin=[lot.x+c*localX+s*localZ,y,lot.z-s*localX+c*localZ],direction=[c,0,-s];
 assert.equal(cityRaycast(origin,direction,3,w.cityDamage),null);
 const hits=previewImmediateBuildingDamage({...w,profile:{stats:{attack:1},fusion:{}}},item,{origin,direction,range:3,radius,ultimate:false},T+5000);
 const hit=hits.find(v=>v.structureId===lot.id);
 assert.ok(hit,'grazing the wall must register');
 const [x,z]=cityLocal(lot,hit.position[0],hit.position[2]);
 assert.ok(Math.abs(z+floor.d/2)<1e-7,'debris belongs on the wall');
 assert.ok(x>=-floor.w/2-1e-7&&x<=floor.w/2+1e-7);
 assert.ok(Math.hypot(hit.position[0]-origin[0],hit.position[2]-origin[2])>.3);
 const away=[lot.x+c*localX+s*(localZ-3),y,lot.z-s*localX+c*(localZ-3)];
 assert.equal(previewImmediateBuildingDamage({...w,profile:{stats:{attack:1},fusion:{}}},item,{origin:away,direction,range:3,radius,ultimate:false},T+5000).length,0);
});
