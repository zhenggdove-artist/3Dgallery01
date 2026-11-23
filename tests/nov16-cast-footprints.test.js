import {GOLDFISH_SCHOOL_RADIUS} from '../src/shared/goldfish-school.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {ChargeTargetPreview} from '../src/charge-target-preview.js';
import {chargedArea,spellFootprint,insideChargedArea,scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {WEAPONS,itemById,attackStats} from '../src/shared/catalog.js';
import {isChannelStaff,weaponQuality,channelVisualRadius,forwardCastRadius,channelReachMultiplier} from '../src/shared/weapon-abilities.js';

const nearly=(a,b,what)=>assert.ok(Math.abs(a-b)<1e-6,what+': '+a+' vs '+b);
const scene=()=>new THREE.Scene();
const world={floatingPlatforms:[]};

test('blue warnings are the two unchanged original MIT source files, not imitations',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../vendor/00gamedevs/warning-manifest.json',import.meta.url)));
 assert.deepEqual(manifest.assets.map(a=>a.number),[58,59]);
 for(const a of manifest.assets){
  assert.equal(a.license,'MIT');
  const bytes=await readFile(new URL('../vendor/00gamedevs/source/'+a.id+'.js',import.meta.url));
  assert.equal(createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g,'\n')).digest('hex'),a.sha256);
 }
});

test('original #58 points its apex from the actual clam muzzle and exactly spans the server sector',()=>{
 const item=itemById('clam'),root=new THREE.Group(),fx=new ChargeTargetPreview(scene());
 root.position.set(3,0,4);
 const muzzle=[3.6,1.3,4.7],direction=[0,0,1];
 fx.update(root,item,.7,direction,{world},null,muzzle);
 assert.equal(fx.footprint.shape,'sector');
 assert.equal(fx.sector.group.userData.vfxNumber,58);
 assert.equal(fx.sector.group.visible,true);
 assert.deepEqual(fx.sector.group.position.toArray(),[muzzle[0],fx.footprint.position[1],muzzle[2]]);
 nearly(fx.sector.group.scale.x*fx.sector.settings.size,fx.footprint.range,'sector reach');
 assert.equal(fx.sector.settings.angleDeg,90);
 assert.equal(fx.sector.settings.color.toLowerCase(),'#24aaff');
 const stats=attackStats(item,1),q=weaponQuality(item);
 stats.range=+(Math.max(stats.range,10)*q.range).toFixed(2);
 stats.radius=channelVisualRadius(item,q,stats.range);
 scaleUltimateFootprint(stats,item);
 const area=chargedArea(item,muzzle,direction,stats,()=>0,true);
 assert.equal(area.mode,'sector');
 assert.equal(insideChargedArea(area,[3.6,1,4.7+area.range*.8]),true);
 assert.equal(insideChargedArea(area,[3.6+area.range*.8,1,4.7]),false);
 fx.dispose();
});

test('original #59 is a full-length blue forward strip with exact server range and diameter',()=>{
 const item=itemById('ember-1'),root=new THREE.Group(),fx=new ChargeTargetPreview(scene());
 root.position.set(5,0,9);
 const muzzle=[5.2,1.25,9.3],direction=[0,0,1];
 fx.update(root,item,.5,direction,{world},null,muzzle);
 assert.equal(fx.rectangle.group.userData.vfxNumber,59);
 assert.equal(fx.rectangle.group.visible,true);
 assert.equal(fx.footprint.shape,'rectangle');
 const q=weaponQuality(item),stats=attackStats(item,1);
 stats.range=+(Math.max(stats.range,Math.min(18,item.range))*q.range).toFixed(2);
 stats.radius=channelVisualRadius(item,q,stats.range);
 scaleUltimateFootprint(stats,item);
 nearly(fx.rectangle.settings.length*fx.rectangle.group.scale.x,stats.range,'full rectangle length');
 nearly(fx.rectangle.settings.width*fx.rectangle.group.scale.z,stats.radius*2,'full rectangle width');
 nearly(fx.rectangle.group.position.z,muzzle[2]+stats.range/2,'forward center');
 assert.equal(fx.rectangle.settings.color.toLowerCase(),'#24aaff');
 fx.dispose();
});

test('all weapons have dimensional warning contracts derived from identical attack stats',()=>{
 const s=scene(),root=new THREE.Group(),preview=new ChargeTargetPreview(s);
 for(const item of WEAPONS){
  const dir=[0,0,1];
  preview.update(root,item,.65,dir,{world});
  const a=preview.footprint;
  assert.ok(a&&a.position.every(Number.isFinite),item.id);
  const stats=attackStats(item,1),quality=weaponQuality(item);
  if(isChannelStaff(item))stats.range=Math.max(stats.range,item.id==='clam'?10:Math.min(18,item.range))*channelReachMultiplier(item);
  stats.range=+(stats.range*quality.range).toFixed(2);
  stats.radius=forwardCastRadius(item,quality,stats.radius,isChannelStaff(item));
  if(item.id==='black-cat')stats.range=256;
  if(item.id==='jellybrella'&&stats.ultimate)stats.radius=Math.max(10,stats.radius*2);
  if(item.id==='goldfish'&&stats.ultimate)stats.radius=1.05*quality.visual;
  scaleUltimateFootprint(stats,item);
  if(item.id==='goldfish'&&stats.ultimate)stats.radius=GOLDFISH_SCHOOL_RADIUS*quality.visual;
  if(item.id==='clam'||item.family==='saber'){
   assert.equal(a.shape,'sector',item.id);
   nearly(preview.sector.settings.size*preview.sector.group.scale.x,stats.range,item.id);
   assert.equal(preview.sector.settings.angleDeg,item.family==='saber'?60:90,item.id);
  }else if((isChannelStaff(item)&&item.family!=='ice')||(item.id==='accordion'&&stats.ultimate)||item.firstPerson||item.family==='saber'||(item.family==='palm'&&!stats.ultimate)||item.pattern==='scatter'||item.id==='goldfish'){
   assert.equal(a.shape,'rectangle',item.id);
   nearly(preview.rectangle.settings.length*preview.rectangle.group.scale.x,stats.range,item.id);
   nearly(preview.rectangle.settings.width*preview.rectangle.group.scale.z,stats.radius*2,item.id);
  }else{
   assert.equal(a.shape,'circle',item.id);
   nearly(preview.group.scale.x,a.radius,item.id);
  }
 }
 preview.dispose();
 assert.equal(s.children.length,0);
});

test('cat A tap cycles the camera; long A hold can now charge a firearm ultimate',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const gun=await readFile(new URL('../src/gun-controller.js',import.meta.url),'utf8');
 const ui=await readFile(new URL('../src/ui.js',import.meta.url),'utf8');
 assert.match(ui,/charge\.onpointerdown=.*?emit\('attack-start'\)/s);
 assert.match(main,/if\(weapon\?\.firstPerson&&heldMs<STAFF_TAP_MAX_MS\)\{gun\.cycle\(\);return;\}/);
 assert.match(main,/chargeDelayTimer=setTimeout\(/);
 assert.match(main,/if\(artworkThrow\.started!==null\)\{[\s\S]*?return artworkThrow\.release\(\)/);
 assert.doesNotMatch(main,/if\(itemById\(world\?\.profile\?\.equipment\?\.weapon\)\?\.firstPerson\)\{gun\.held=false;return;\}/);
 assert.match(gun,/if\(button\)return;/);
 assert.doesNotMatch(main,/else if\(weapon\.id==='white-cat'\)/);
 assert.match(gun,/ui\.emit\('gun-fire'\)/);
 assert.doesNotMatch(gun,/else ui\.emit\('attack-start'\)/);
});


test('the blue #59 strip is narrower than old charged AoE and matches each staff-tier hit tube',()=>{
 const s=new THREE.Scene(),r=new THREE.Group(),v=new ChargeTargetPreview(s);
 for(const family of ['water','fire','ice','lightning','beam','petal','wave']){
  for(const item of WEAPONS.filter(w=>w.family===family&&!w.exotic)){
   v.update(r,item,.8,[0,0,1],{world});
   const q=weaponQuality(item);
   const stat=attackStats(item,1);
   stat.range=Math.max(stat.range,Math.min(18,item.range))*channelReachMultiplier(item);
   stat.range=+(stat.range*q.range).toFixed(2);
   stat.radius=family==='ice'?forwardCastRadius(item,q,stat.radius,true):channelVisualRadius(item,q,stat.range);

   scaleUltimateFootprint(stat,item);

   if(family==='ice'){
    assert.equal(v.footprint.shape,'circle',item.id+' is a forward frost magic circle');
    nearly(v.footprint.radius,stat.radius,item.id+' frozen AoE radius');
   }else{
    const width=2*stat.radius;
    nearly(v.footprint.width,width,item.id+' width');
    assert.ok(width<2*attackStats(item,1).radius*q.radius,item.id+' must shrink versus old blast');
   }
  }
 }
 v.dispose();
 assert.equal(s.children.length,0);
});
