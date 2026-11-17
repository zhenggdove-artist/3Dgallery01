import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {NumberedWeaponEffects,REQUESTED_VFX,requestedEffect} from '../src/numbered-weapon-effects.js';
import {ChargeTargetPreview} from '../src/charge-target-preview.js';
import {chargedArea,spellGroundHeight,scaleUltimateFootprint} from '../src/shared/charge-area.js';
import {weaponQuality} from '../src/shared/weapon-abilities.js';
import {equippedItem} from '../src/shared/fusion-adapter.js';
import {attackStats,itemById} from '../src/shared/catalog.js';
import {WeaponVFX} from '../src/weapon-vfx.js';

const references=[
 ['clam',33,'channel'],['prism-1',29,'channel'],['saber-1',38,'ultimate'],['palm-1',31,'ultimate'],['bloom-1',43,'channel'],
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

test('numbered effects retain verified originals; prism alone switches to original charged-beam',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../vendor/00gamedevs/numbered-manifest.json',import.meta.url)));
 assert.equal(manifest.assets.length,14);
 assert.equal(manifest.packaging.includes('byte-identical'),true);
 for(const [weapon,num,kind] of references){
  const item=itemById(weapon),spec=requestedEffect(item,evt(kind));
  assert.ok(item,weapon);
  assert.equal(spec?.number,num,weapon);
  assert.equal(spec.original,true,weapon);
  if(weapon.startsWith('prism-')){
   assert.equal(spec.asset,'charged-beam','prism uses newly requested official source');
   const source=await readFile(new URL('../vendor/00gamedevs/charged-beam.js',import.meta.url));
   assert.match(source.toString(),/The MIT License/);
   assert.match(source.toString(),/"id": "charged-beam"/);
   continue; // The old numbered #29 is retained on disk for other effects.
  }
  const manifestEntry=manifest.assets.find(a=>a.number===num);
  assert.equal(manifestEntry?.id,spec.asset,weapon);
  assert.equal(manifestEntry.license,'MIT');
  assert.equal(manifestEntry.url.startsWith('https://00gamedevs.com/'),true);
  const file=await readFile(new URL('../vendor/00gamedevs/source/'+spec.asset+'.js',import.meta.url));
  assert.equal(createHash('sha256').update(file).digest('hex'),manifestEntry.sha256);
 }
 assert.equal(Object.keys(REQUESTED_VFX).length,19);
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
  if(kind==='ultimate'){
   if(num===31){
    assert.equal(entry.palmLayers.length,3,'stack of three authentic #31 originals');
    assert.equal(entry.palmLayers.every(fx=>fx.group.userData.vfxNumber===31),true);
    assert.ok(entry.group.position.distanceTo(new THREE.Vector3(0,1,0))<1e-8);
   }else if(num===38){
    assert.ok(entry.group.position.z>0,'#38 cannot be centred at the actor');
    const length=entry.range;
    const tip=entry.group.position.clone().add(new THREE.Vector3(-2.25,0,0)
       .multiply(entry.group.scale).applyQuaternion(entry.group.quaternion));
    tip.y=1; // the ground crack starts below the hand, on the terrain
    assert.ok(Math.abs(tip.z)<.02,'first crack must start at the sword');
    assert.ok(Math.abs(entry.group.userData.fissureRange-length)<1e-8);
    const axis=new THREE.Vector3(1,0,0).applyQuaternion(entry.group.quaternion);
    assert.ok(axis.distanceTo(new THREE.Vector3(0,0,1))<1e-8,'crack must point along the sword ray');
    assert.ok(Math.abs(entry.group.scale.x-entry.range/4.68)<1e-8,'length follows server range, not sideways stretch');
    assert.ok(Math.abs(entry.group.scale.z-2/3)<1e-8,'side-to-side fissure is one-third prior width');
   }else assert.ok(entry.group.position.distanceTo(new THREE.Vector3(0,.16,8))<1e-8,weapon);
  }
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

test('saber ultimate warns with a sword-origin straight rectangle instead of a remote circle',()=>{
 const item=itemById('saber-1'),scene=new THREE.Scene(),root=new THREE.Group();
 root.position.set(5,0,9);
 const preview=new ChargeTargetPreview(scene);
 const fusion={layer:2},direction=[0,-.1,1];
 const quality=weaponQuality(item,fusion),stats=attackStats(item,1);
 stats.range=+(stats.range*quality.range).toFixed(2);
 stats.radius=+(stats.radius*quality.radius).toFixed(2);
 scaleUltimateFootprint(stats);
 const world={floatingPlatforms:[]};
 const area=chargedArea(item,[5,1,9],direction,stats,(x,z,y)=>spellGroundHeight(world,x,z,y));
 preview.update(root,item,1,direction,{world},fusion);
 assert.equal(preview.rectangle.group.visible,true);
 assert.equal(preview.footprint.shape,'rectangle');
 assert.ok(preview.footprint.position[2]>root.position.z);
 assert.ok(Math.abs(preview.footprint.length-stats.range)<1e-7);
 assert.ok(preview.rectangle.group.position.distanceTo(new THREE.Vector3(...area.visualCenter))>1);
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
 scaleUltimateFootprint(stats);
 const world={floatingPlatforms:[]},direction=[0,-.12,1];
 const area=chargedArea(actual,[3,1,4],direction,stats,(x,z,y)=>spellGroundHeight(world,x,z,y));
 const scene=new THREE.Scene(),preview=new ChargeTargetPreview(scene),root=new THREE.Group();
 root.position.set(3,0,4);preview.update(root,item,1,direction,{world},fusion);
 assert.equal(preview.footprint.shape,'rectangle');
 assert.ok(Math.abs(preview.rectangle.group.scale.x*preview.rectangle.settings.length-
  ((stats.range)))<1e-7);
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


test('prism focuser uses original Charged Beam on tap, full charge, and held cast',()=>{
 const item=itemById('prism-2');
 for(const event of [
  {...evt('normal'),channel:false,ultimate:false},
  {...evt('ultimate'),channel:false,ultimate:true},
  {...evt('channel'),channel:true,ultimate:true}
 ]){
  assert.equal(requestedEffect(item,event)?.asset,'charged-beam');
  const scene=new THREE.Scene(),effects=new NumberedWeaponEffects(scene);
  assert.equal(effects.play(event,item),true);
  const active=effects.active[0];
  assert.equal(active.spec.number,29);
  // Source setEndpoints() puts its center at the real midway ray position.
  assert.ok(active.fx.group.position.distanceTo(new THREE.Vector3(0,1,6))<1e-7);
  assert.equal(active.fx.group.userData.vfxSource,'00GameDevs');
  effects.dispose();
  assert.equal(scene.children.length,0);
 }
});

test('authored #73 demonstration sphere and cube are hidden; the fire nozzle is weapon-anchored',()=>{
 const item=itemById('ember-1'),scene=new THREE.Scene(),root=new THREE.Group();
 scene.add(root);
 const muzzle=(host)=>host.position.clone().add(new THREE.Vector3(.25,1.4,.15));
 const effects=new NumberedWeaponEffects(scene,muzzle);
 const event={...evt('channel'),range:10.8};
 assert.equal(effects.play(event,item,root),true);
 const fx=effects.active[0].fx;
 assert.equal(fx.group.userData.vfxNumber,73);
 const demoProps=fx.group.userData.flameAimTargets;
 assert.equal(demoProps?.length,2);
 for(const prop of demoProps)assert.equal(prop.parent.visible,false,'no visible grey demo prop');
 const source=fx.group.userData.flameAimRoot.localToWorld(new THREE.Vector3(-3.6,1.65,0));
 assert.ok(source.distanceTo(muzzle(root))<1e-6,'visible flame starts at the staff nozzle');
 root.position.set(3,0,4);
 effects.update(.01);
 const moved=fx.group.userData.flameAimRoot.localToWorld(new THREE.Vector3(-3.6,1.65,0));
 assert.ok(moved.distanceTo(muzzle(root))<1e-6,'no detached flame origin after moving');
 effects.stop(root);root.removeFromParent();
 assert.equal(scene.children.length,0);
});

test('the original #70 ice shards detach from the staff and travel the full doubled distance',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),fx=new NumberedWeaponEffects(scene);
 scene.add(root);
 fx.play(evt('channel'),itemById('frost-1'),root);
 assert.equal(fx.active[0].spec.number,70);
 const entry=fx.active[0];
 assert.ok(entry.cycles?.length===1);
 const origin=entry.cycles[0].start.clone();
 const baseSize=entry.cycles[0].fx.settings.size;
 assert.ok(Math.abs(baseSize-.6)<1e-7,'ice shards stay half-size');
 assert.ok(Math.abs(entry.cycles[0].fx.settings.speed-2)<1e-7,'source animation stays 2x speed');
 fx.update(.65);
 assert.ok(entry.cycles[0].fx.group.position.z>origin.z+entry.range*.45,'ice shards travel world-space');
 fx.update(.65);
 assert.ok(entry.cycles[0].fx.group.position.z>origin.z+entry.range*.95,'ice reaches entire server ray');
 fx.dispose();root.removeFromParent();
 assert.equal(scene.children.length,0);
});

test('clam held channel layers original #33 waves that ease forward and overlap instead of snapping',()=>{
 const item=itemById('clam'),scene=new THREE.Scene(),root=new THREE.Group();
 scene.add(root);
 const effects=new NumberedWeaponEffects(scene,(r)=>r.position.clone().add(new THREE.Vector3(0,1.3,0)));
 const event={...evt('channel'),range:18};
 assert.equal(effects.play(event,item,root),true);
 const entry=effects.active[0];
 assert.equal(entry.waves.length,1);
 const first=entry.waves[0];
 effects.update(.41);
 assert.ok(entry.waves.length>=2,'several original #33 copies overlap');
 assert.equal(entry.waves.every(w=>w.fx.group.userData.vfxNumber===33),true);
 const z=first.fx.group.position.z;
 effects.update(.35);
 assert.ok(first.fx.group.position.z>z,'wave crest moves gradually outward');
 assert.ok(entry.waves.length>=2,'there is never a frame with no crest');
 root.position.set(4,0,1);
 effects.play({...event,origin:[4,1,1]},item,root);
 effects.update(.40);
 assert.ok(entry.waves.some(w=>w.start.x===4),'new crest starts at current weapon, not a stale position');
 effects.stop(root);
 assert.equal(effects.active.length,0);
 assert.equal(scene.children.length,1,'all wave copies disposed');
 root.removeFromParent();
});


test('flowers and conch launch forward-progressing native copies instead of floating at the muzzle',()=>{
 for(const id of ['bloom-1','nova-1']){
  const item=itemById(id),scene=new THREE.Scene(),root=new THREE.Group();
  scene.add(root);
  const muzzle=host=>host.position.clone().add(new THREE.Vector3(.1,1.3,.2));
  const effects=new NumberedWeaponEffects(scene,muzzle);
  const event={...evt('channel'),range:16};
  assert.ok(effects.play(event,item,root));
  const entry=effects.active[0];
  assert.ok(entry.cycles,id+' must maintain overlapping true native copies');
  const first=entry.cycles[0],z=first.fx.group.position.z;
  effects.update(.6);
  assert.ok(first.fx.group.position.z>z+.2,id+' travels gradually forward');
  root.position.x=5;
  effects.update(.8);
  assert.ok(entry.cycles.length>=2,id+' spawns a new offset copy');
  assert.ok(entry.cycles.some(x=>Math.abs(x.start.x-5.1)<1e-7),id+' new copy starts at moving staff');
  assert.ok(entry.cycles.some(x=>Math.abs(x.start.x-.1)<1e-7),id+' existing copy remains on its old route');
  const z2=first.fx.group.position.z;
  effects.update(.15);
  assert.ok(first.fx.group.position.z>z2,id+' first copy must continue its forward path');
  effects.stop(root);
  root.removeFromParent();
  assert.equal(scene.children.length,0);
 }
});

test('doubling the ice timeline retains overlapping channels without a zero-visible interval',()=>{
 const item=itemById('frost-1'),scene=new THREE.Scene(),root=new THREE.Group();
 scene.add(root);
 const effects=new NumberedWeaponEffects(scene,()=>new THREE.Vector3(0,1,0));
 effects.play({...evt('channel'),range:20},item,root);
 const entry=effects.active[0],first=entry.cycles[0];
 effects.update(1.30);
 assert.ok(entry.cycles.length>=2,'the next ice pillar enters before the first 2x-speed clip finishes');
 assert.ok(!first.fx.finished);
 effects.stop(root);root.removeFromParent();
 assert.equal(scene.children.length,0);
});

test('charged sword warning and radius follow the final 60% collision dimensions',()=>{
 const item=itemById('saber-1'),stats=attackStats(item,1);
 const oldReach=Math.max(30,item.range*2,(item.range+item.chargeRange)*1.8)*4;
 assert.ok(Math.abs(stats.range-oldReach*.60)<.01,'ultimate reach must equal 60% of the former 4x baseline');
 assert.ok(stats.radius>0,'server-authoritative sword collision radius must stay positive');
 const scene=new THREE.Scene(),fx=new ChargeTargetPreview(scene);
 const root=new THREE.Group(),muzzle=[2,1.1,3],direction=[0,0,1];
 fx.update(root,item,.95,direction,{world:{floatingPlatforms:[]}},null,muzzle);
 assert.equal(fx.rectangle.group.userData.vfxNumber,59);
 assert.equal(fx.footprint.shape,'rectangle');
 const expected=scaleUltimateFootprint({...stats,radius:+(stats.radius*weaponQuality(item).radius).toFixed(2)});
 assert.ok(Math.abs(fx.footprint.length-expected.range)<1e-8);
 assert.ok(Math.abs(fx.footprint.width-Math.max(.5,expected.radius*2))<1e-8);
 assert.ok(Math.abs(fx.footprint.position[2]-(muzzle[2]+expected.range/2))<1e-8);
 fx.dispose();
});


test('fully charged release also uses original wave/flower/conch sources, never the pan fireburst or static stand-ins',()=>{
 for(const [id,number] of [['clam',33],['bloom-1',43],['nova-1',20]]){
  const item=itemById(id),scene=new THREE.Scene(),root=new THREE.Group();
  scene.add(root);
  const effects=new NumberedWeaponEffects(scene,(host)=>host.position.clone().add(new THREE.Vector3(0,1,0)));
  const data={...evt('ultimate'),area:{mode:'corridor',visualCenter:[20,.16,25]},range:16};
  assert.equal(requestedEffect(item,data)?.number,number,id);
  assert.equal(effects.play(data,item,root),true,id);
  const active=effects.active[0];
  assert.equal(active.spec.number,number,id);
  if(number===33){
   assert.ok(active.waves?.length===1,'clam creates a native water crest');
   const wave=active.waves[0],before=wave.fx.group.position.z;
   effects.update(.55);
   assert.ok(wave.fx.group.position.z>before,'native water wave advances in world +Z');
   assert.ok(active.waves.length>1,'unheld ultimate retains successive overlapping wave crests');
  }else{
   assert.equal(active.singleTravel,true,id);
   const before=active.fx.group.position.z;
   effects.update(.55);
   assert.ok(active.fx.group.position.z>before+.1,id+' releases a forward-travelling native effect');
   assert.ok(active.fx.group.position.z<16,id+' moves gradually, not teleports to the impact');
  }
  effects.dispose();root.removeFromParent();
  assert.equal(scene.children.length,0);
 }
});


test('native ice / sword / coconut travel durations agree with their extended visual paths',async()=>{
 const {projectileFlightMs}=await import('../src/shared/combat-balance.js');
 assert.equal(projectileFlightMs(itemById('frost-1'),true),1260);
 assert.equal(projectileFlightMs(itemById('saber-1'),true),1100);
 assert.equal(projectileFlightMs(itemById('palm-1'),true),1650);
 assert.equal(projectileFlightMs(itemById('palm-1'),false),245);
});

test('official #31 coconut tree ultimate stacks three real crowns and rotates rapidly as it travels forward',()=>{
 const scene=new THREE.Scene(),effects=new NumberedWeaponEffects(scene);
 const item=itemById('palm-3'),event={...evt('ultimate'),range:32,origin:[2,1,4],direction:[0,0,1],
  area:{mode:'corridor',visualCenter:[99,.16,99],radius:7}};
 assert.equal(requestedEffect(item,event)?.number,31);
 assert.equal(effects.play(event,item),true);
 const entry=effects.active[0];
 assert.ok(entry.palmLayers?.length===3);
 assert.equal(scene.children.length,3);
 assert.ok(entry.palmLayers.every(fx=>fx.group.userData.vfxSource==='00GameDevs'&&fx.group.userData.vfxNumber===31));
 const heights=entry.palmLayers.map(fx=>fx.group.position.y);
 assert.ok(heights[1]>heights[0]&&heights[2]>heights[1], 'exactly three ascending layers');
 const start=entry.palmLayers[0].group.position.z;
 effects.update(.5);
 assert.ok(entry.palmLayers.every(fx=>fx.group.position.z>start+5),'all layers move rapidly forward');
 assert.ok(entry.palmLayers.every(fx=>fx.group.rotation.y>5),'layers rotate while advancing');
 assert.ok(entry.palmLayers.every(fx=>Math.abs(fx.group.position.z-entry.palmLayers[0].group.position.z)<1e-8),'one shared projectile path');
 effects.update(1.0);
 assert.ok(entry.palmLayers[0].group.position.z>start+20,'rapid advance covers the actual spell reach');
 effects.dispose();
 assert.equal(scene.children.length,0,'three native scenes all disposed');
});

test('500ms A hold threshold is shared by tap vs charge and client and server ice reach',async()=>{
 const {STAFF_TAP_MAX_MS,isStaffTap,chargeProgress,channelReachMultiplier,weaponQuality}=await import('../src/shared/weapon-abilities.js');
 assert.equal(STAFF_TAP_MAX_MS,500);
 assert.equal(isStaffTap(itemById('frost-1'),499),true);
 assert.equal(isStaffTap(itemById('frost-1'),501),false);
 assert.equal(chargeProgress(500,1500),0);
 assert.ok(chargeProgress(1000,1500)>0);
 const ice=itemById('frost-1'),fire=itemById('ember-1');
 assert.equal(channelReachMultiplier(ice),2);
 assert.equal(channelReachMultiplier(fire),1);
 const q=weaponQuality(ice),stats=attackStats(ice,1);
 const expected=+((+(Math.max(stats.range,Math.min(18,ice.range))*2*q.range).toFixed(2))*.6).toFixed(3);
 const scene=new THREE.Scene(),fx=new ChargeTargetPreview(scene),root=new THREE.Group();
 fx.update(root,ice,.7,[0,0,1],{world:{floatingPlatforms:[]}});
 assert.equal(fx.footprint.shape,'rectangle');
 assert.ok(Math.abs(fx.footprint.length-expected)<1e-7);
 fx.dispose();
 assert.equal(scene.children.length,0);
});

test('jellyfish ultimate doubles the previous oversized wheel and uses a real group 2x scale',()=>{
 const scene=new THREE.Scene(),effects=new NumberedWeaponEffects(scene);
 const item=itemById('jellybrella');
 const event={...evt('ultimate'),qualityScale:1,area:{mode:'area',radius:2,visualCenter:[0,0,5]}};
 assert.equal(effects.play(event,item,null),true);
 assert.equal(effects.active[0].spec.number,26);
 assert.equal(effects.active[0].options.size,84);
 assert.equal(effects.active[0].fx.group.scale.x,2);
 effects.dispose();
 assert.equal(scene.children.length,0);
});
