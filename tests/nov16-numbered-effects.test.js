import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {NumberedWeaponEffects,REQUESTED_VFX,requestedEffect} from '../src/numbered-weapon-effects.js';
import {ChargeTargetPreview} from '../src/charge-target-preview.js';
import {chargedArea,spellGroundHeight} from '../src/shared/charge-area.js';
import {weaponQuality} from '../src/shared/weapon-abilities.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';
import {attackStats,itemById} from '../src/shared/catalog.js';
import {WeaponVFX} from '../src/weapon-vfx.js';

const references=[
 ['clam',33,'channel'],['saber-1',38,'ultimate'],['bloom-1',43,'channel'],
 ['swatter-1',53,'ultimate'],['ember-1',73,'channel'],['pan-1',68,'ultimate'],
 ['frost-1',70,'channel'],['storm-1',8,'channel'],['nova-1',20,'channel'],
 ['saber-4',47,'combo'],['jellybrella',26,'ultimate'],['whip-1',48,'ultimate']
];
const evt=kind=>({origin:[0,1,0],direction:[0,0,1],range:12,
 qualityScale:1,qualityTier:kind==='combo'?4:1,
 channel:kind==='channel',ultimate:kind==='ultimate'||kind==='channel',
 combo:kind==='combo'?5:0,
 area:{mode:'area',center:[0,.12,8],visualCenter:[0,.16,8],radius:3,travel:8},
 time:123});

test('all twelve IDs map to verified, byte-identical official downloads',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../vendor/00gamedevs/numbered-manifest.json',import.meta.url)));
 assert.equal(manifest.assets.length,12);
 assert.equal(manifest.packaging.includes('byte-identical'),true);
 for(const [weapon,num,kind] of references){
  const item=itemById(weapon),spec=requestedEffect(item,evt(kind));
  assert.ok(item,weapon);
  assert.equal(spec?.number,num,weapon);
  assert.equal(spec.original,true,weapon);
  const manifestEntry=manifest.assets.find(a=>a.number===num);
  assert.equal(manifestEntry?.id,spec.asset,weapon);
  assert.equal(manifestEntry.license,'MIT');
  assert.equal(manifestEntry.url.startsWith('https://00gamedevs.com/'),true);
  const file=await readFile(new URL('../vendor/00gamedevs/source/'+spec.asset+'.js',import.meta.url));
  assert.equal(createHash('sha256').update(file).digest('hex'),manifestEntry.sha256);
 }
 assert.equal(Object.keys(REQUESTED_VFX).length,12);
});

test('every numbered attack instantiates an actual source module, never a particle imitation',()=>{
 for(const [weapon,num,kind] of references){
  const item=itemById(weapon),scene=new THREE.Scene(),effects=new NumberedWeaponEffects(scene);
  assert.equal(effects.play(evt(kind),item),true,weapon);
  const entry=effects.active[0];
  assert.equal(entry.spec.number,num);
  assert.ok(entry.fx?.group?.isObject3D);
  assert.equal(entry.group,entry.fx.group);
  assert.equal(entry.group.userData.vfxSource,'00GameDevs');
  assert.equal(entry.group.userData.vfxNumber,num);
  assert.equal(scene.children.includes(entry.group),true);
  if(kind==='ultimate')assert.ok(entry.group.position.distanceTo(new THREE.Vector3(0,.16,8))<1e-8,weapon);
  effects.update(.01);
  effects.dispose();
  assert.equal(scene.children.length,0,weapon);
 }
});

test('continuous original follows the weapon nozzle across movement and aim updates',()=>{
 const item=itemById('clam'),scene=new THREE.Scene(),root=new THREE.Group();
 scene.add(root);
 const muzzle=(host)=>host.position.clone().add(new THREE.Vector3(.5,1.3,.2));
 const effects=new NumberedWeaponEffects(scene,muzzle);
 assert.equal(effects.play(evt('channel'),item,root),true);
 const fx=effects.active[0].fx;
 assert.deepEqual(fx.group.position.toArray(),[.5,1.3,.2]);
 root.position.set(4,0,3);effects.update(.01);
 assert.ok(fx.group.position.distanceTo(new THREE.Vector3(4.5,1.3,3.2))<1e-8);
 const rerouted={...evt('channel'),direction:[1,0,0]};
 effects.play(rerouted,item,root);
 assert.equal(effects.active.length,1,'one continuous instance per source');
 assert.ok(effects.active[0].direction.distanceTo(new THREE.Vector3(1,0,0))<1e-8);
 effects.stop(root);assert.equal(effects.active.length,0);
 root.removeFromParent();
});

test('the server area and the warning circle share exactly the same ground-space position',()=>{
 const item=itemById('saber-1'),scene=new THREE.Scene(),root=new THREE.Group();
 root.position.set(5,0,9);
 const preview=new ChargeTargetPreview(scene);
 const fusion={layer:2},direction=[0,-.1,1];
 const quality=weaponQuality(item,fusion),stats=attackStats(item,1);
 stats.range=+(stats.range*quality.range).toFixed(2);
 stats.radius=+(stats.radius*quality.radius).toFixed(2);
 const world={floatingPlatforms:[]};
 const area=chargedArea(item,[5,1,9],direction,stats,(x,z,y)=>spellGroundHeight(world,x,z,y));
 preview.update(root,item,1,direction,{world},fusion);
 assert.equal(preview.group.visible,true);
 assert.ok(preview.group.position.distanceTo(new THREE.Vector3(...area.visualCenter))<1e-8);
 assert.equal(preview.guides.some(g=>g.visible),false);
 preview.dispose();
 assert.equal(scene.children.length,0);
});

test('warning circle includes fused original range/radius and authoritative channel reach',()=>{
 const item=itemById('ember-1'),fusion={layer:3,original:{stats:{range:37,radius:6.5}}};
 const actual=equippedItem({fusion:{[item.id]:fusion}},item);
 const stats=attackStats(actual,1),quality=weaponQuality(actual,fusion);
 stats.range=Math.max(stats.range,Math.min(18,actual.range));
 stats.range=+(stats.range*quality.range).toFixed(2);
 stats.radius=+(stats.radius*quality.radius).toFixed(2);
 const world={floatingPlatforms:[]},direction=[0,-.12,1];
 const area=chargedArea(actual,[3,1,4],direction,stats,(x,z,y)=>spellGroundHeight(world,x,z,y));
 const scene=new THREE.Scene(),preview=new ChargeTargetPreview(scene),root=new THREE.Group();
 root.position.set(3,0,4);preview.update(root,item,1,direction,{world},fusion);
 assert.ok(preview.group.position.distanceTo(new THREE.Vector3(...area.visualCenter))<1e-8);
 assert.ok(Math.abs(preview.group.scale.x-Math.max(1.7,area.radius))<1e-8);
 preview.dispose();
});

test('the native numbered effect overrides generic VFX in the integrated weapon renderer',()=>{
 const item=itemById('pan-1'),scene=new THREE.Scene(),vfx=new WeaponVFX(scene);
 vfx.play({...evt('ultimate'),weapon:item.id},item);
 assert.equal(vfx.numberedEffects.active[0]?.spec.number,68);
 assert.equal(vfx.numberedEffects.active[0].group.userData.vfxSource,'00GameDevs');
 vfx.dispose();
});
test('custom exotic ultimates are not stolen by ordinary family mappings',()=>{
 for(const id of ['giraffe','goldfish','fan','accordion','telephone']){
  assert.equal(requestedEffect(itemById(id),evt('ultimate')),null,id);
 }
});
