import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {NumberedWeaponEffects,REQUESTED_VFX,requestedEffect} from '../src/numbered-weapon-effects.js';
import {itemById} from '../src/shared/catalog.js';
import {WeaponVFX} from '../src/weapon-vfx.js';

const references=[
 ['clam',33,'channel'],['saber-1',38,'ultimate'],['bloom-1',43,'channel'],
 ['swatter-1',53,'ultimate'],['ember-1',73,'channel'],['pan-1',68,'ultimate'],
 ['frost-1',70,'channel'],['storm-1',8,'channel'],['nova-1',20,'channel'],
 ['saber-4',47,'combo'],['jellybrella',26,'ultimate'],['whip-1',48,'ultimate']
];
const evt=(kind)=>({origin:[0,1,0],direction:[0,0,1],range:12,
 qualityScale:1,channel:kind==='channel',ultimate:kind==='ultimate'||kind==='channel',
 combo:kind==='combo'?5:0,time:123});
test('twelve specific weapon/ability pairs are assigned distinct reference IDs',()=>{
 assert.equal(Object.keys(REQUESTED_VFX).length,12);
 for(const [id,num,kind] of references){
  const item=itemById(id);
  assert.ok(item,id);
  assert.equal(requestedEffect(item,evt(kind))?.number,num,id);
 }
 assert.equal(REQUESTED_VFX['clam:channel'].original,true);
 assert.equal(REQUESTED_VFX['lightning:channel'].original,true);
 assert.equal(Object.values(REQUESTED_VFX).filter(x=>x.original).length,2,
  'unavailable originals must not be misrepresented as archived source code');
});
test('all twelve references build visible 3-D multicolour groups with mobile-scalable particle depth',()=>{
 for(const [id,num,kind] of references){
  const scene=new THREE.Scene(),vfx=new NumberedWeaponEffects(scene),item=itemById(id);
  const played=vfx.play(evt(kind),item);
  assert.equal(played,true,id);assert.equal(vfx.active.length,1,id);
  const entry=vfx.active[0];assert.equal(entry.spec.number,num,id);
  assert.ok(entry.group.children.length>=2,id);
  assert.ok(entry.group.children.some(x=>x.isPoints&&x.geometry.attributes.color.count>=110),id);
  assert.equal(entry.group.name.includes('#'+String(num).padStart(2,'0')),true,id);
  if(entry.spec.original)assert.ok(entry.fx?.group,id);
  vfx.update(.15);
  vfx.dispose();assert.equal(scene.children.length,0,id);
 }
});
test('numbered effect has priority over generic, plain-color weapon presets',()=>{
 for(const [id,num,kind] of references){
  const scene=new THREE.Scene(),vfx=new WeaponVFX(scene),item=itemById(id);
  vfx.play({...evt(kind),weapon:item.id},item);
  assert.ok(vfx.numberedEffects.active.some(e=>e.spec.number===num),id);
  vfx.dispose();
 }
});
