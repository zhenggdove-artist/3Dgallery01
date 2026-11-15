import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WEAPONS} from '../src/shared/catalog.js';
import {isSpellWeapon,makeSpellEquipment} from '../src/spell-equipment.js';
import {weaponClass,explainWeapon} from '../src/shared/weapon-info.js';
import {spellGroundHeight,chargedArea} from '../src/shared/charge-area.js';
import {ARTWORK_DISCS} from '../src/shared/artwork-discs.js';

test('every elemental weapon and rank has a visible hand-held 3D model',()=>{
 const spellItems=WEAPONS.filter(isSpellWeapon);
 assert.ok(spellItems.length>=35);
 const signatures=new Set();
 for(const item of spellItems){
  const model=makeSpellEquipment(item);
  assert.equal(model.userData.weaponId,item.id);
  let meshes=0,vertices=0;
  model.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.getAttribute('position').count;}});
  assert.ok(meshes>6,item.id+' contains too few modeled details');
  const box=new THREE.Box3().setFromObject(model);
  assert.ok(!box.isEmpty()&&box.min.y>-2&&box.max.y<5,item.id+' is not hand-sized');
  assert.ok(box.getSize(new THREE.Vector3()).length()>.2,item.id);
  signatures.add(item.family+':'+item.tier+':'+meshes+':'+vertices);
  model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();}});
 }
 assert.equal(signatures.size,spellItems.length,'Every spell and rank must have different modeling details');
});

test('all weapons have a readable near/mid/far classification and exact combat stats',()=>{
 for(const item of WEAPONS){
  assert.ok(['near','mid','far'].includes(weaponClass(item)),item.id);
  const text=explainWeapon(item);
  assert.match(text,/滿集氣/);
  assert.match(text,/m/);
  assert.ok(text.length>50,item.id);
 }
 const gl=WEAPONS.find(x=>x.id==='frost-1'),ember=WEAPONS.find(x=>x.id==='ember-3');
 assert.equal(weaponClass(gl),'mid');
 assert.ok(explainWeapon(gl).includes('冰晶'));
 assert.ok(explainWeapon(ember).includes('燼火'));
});

test('preview ground height agrees with server geometry, including doubled GM platforms',()=>{
 const d=ARTWORK_DISCS[0],world={floatingPlatforms:[{position:[10,5,12],radius:2}]};
 assert.equal(spellGroundHeight(world,d.position[0],d.position[2],d.top),d.top);
 assert.equal(spellGroundHeight(world,10,12,5),5);
 assert.ok(spellGroundHeight(world,13,12,5)>=5);
 const spell=WEAPONS.find(w=>w.family==='fire');
 const a=chargedArea(spell,[10,8,12],[0,-.2,1],{range:30,radius:7},(x,z,y)=>spellGroundHeight(world,x,z,y));
 assert.equal(a.mode,'area');
 assert.ok(a.center[1]>.1&&a.radius>=5);
});
