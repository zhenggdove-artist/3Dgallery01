import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {equipmentById,attackStats} from '../src/reletter/equipment-catalog.js';
import {weaponRangeClass} from '../src/reletter/odd-weapons.js';
import {applyElementalHit} from '../src/shared/combat-status.js';
import {scaleUltimateFootprint,PALM_ULTIMATE_RADIUS_MULTIPLIER,chargedArea,spellFootprint} from '../src/shared/charge-area.js';
import {CITY_LOTS,CITY_MAX_HP,cityBlocked} from '../src/shared/city-layout.js';
import {moveMonster} from '../src/shared/temple-rules.js';
import {PlantUltimateEffects} from '../src/plant-ultimate-effects.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('equipped marker, stable quickbar-anchored chat, GM help inside S and opaque clean paper doll',()=>{
 const css=source('fidelity-ui.css'),ui=source('src/ui.js'),portrait=source('src/equipment-portrait-view.js');
 assert.match(css,/\.bag-cell\.equipped::after\{top:1px!important;bottom:auto!important/);
 assert.ok(css.includes('bottom:calc(var(--comfort-bottom) + var(--comfort-slot-size) + var(--chat-gap))!important'));
 assert.match(css,/#gm-help\{display:none!important\}/);
 assert.match(ui,/data-gm-action="help" aria-label="GM instructions and shortcuts"/);
 assert.match(css,/#panel #bag-portrait-frame::after\{display:none!important\}/);
 assert.match(portrait,/alpha:false/);assert.match(portrait,/setClearColor\(0xf5f4f7,1\)/);
});
test('store moves storm and prism staffs into Far while retaining other Mid staffs and melee categories',()=>{
 for(const id of ['water','tide-1','tide-5','frost-5','ember-5','bloom-5','nova-5']){
  assert.equal(weaponRangeClass(equipmentById(id)),'mid',id);
 }
 for(const id of ['storm-1','storm-5','prism-1','prism-5']){
  assert.equal(weaponRangeClass(equipmentById(id)),'far',id);
 }
 assert.equal(weaponRangeClass(equipmentById('giraffe')),'near');
 assert.equal(weaponRangeClass(equipmentById('jellybrella')),'mid');
 assert.equal(weaponRangeClass(equipmentById('goldfish')),'mid');
 assert.equal(equipmentById('giraffe').chargedRange,56);
});
test('goldfish 115ms water orbs, shoulder aim and exactly half Cat SMG normal range',()=>{
 const fish=equipmentById('goldfish'),cat=equipmentById('white-cat');
 assert.equal(fish.cooldown,115);assert.equal(fish.range,cat.range/2);
 assert.equal(fish.firstPerson,true);
 const gun=source('src/gun-controller.js'),main=source('src/main.js'),
  effect=source('src/weapon-signature-effects.js');
 assert.match(gun,/weapon\(\)\.id==='white-cat'\|\|weapon\(\)\.id==='goldfish'/);
 assert.match(gun,/\['goldfish','black-cat'\]\.includes\(weapon\(\)\?\.id\)/);
 assert.match(main,/if\(weapon\?\.id==='goldfish'\)\{/);
 assert.match(effect,/goldfishBubble\(event\)/);
});
test('ice freezes three seconds with six-second trigger lock and palm ultimate binds for three seconds every six',()=>{
 const caster={key:'artist'},target={hp:100,maxHp:100,effects:{},effectLocks:{}};
 assert.equal(applyElementalHit(target,caster,equipmentById('frost-1'),10000),'freeze');
 assert.equal(target.effects.freeze.until,13000);
 assert.equal(target.effectLocks.freeze,16000);
 assert.equal(applyElementalHit(target,caster,equipmentById('frost-1'),12000),'slow');
 assert.equal(target.effects.slow.power,.3);
 assert.equal(target.effects.freeze.until,13000);
 const palm={hp:100,maxHp:100,effects:{},effectLocks:{}},weapon=equipmentById('palm-3');
 assert.equal(applyElementalHit(palm,caster,{...weapon,ultimateHit:true},20000),'root');
 assert.equal(palm.effects.root.until,23000);assert.equal(palm.effectLocks.root,26000);
 assert.equal(applyElementalHit(palm,caster,{...weapon,ultimateHit:true},24500),null);
 assert.equal(palm.effects.root.until,23000);
 const basic={hp:100,maxHp:100,effects:{},effectLocks:{}};
 applyElementalHit(basic,caster,weapon,20000);
 assert.equal(basic.effects.root.until,21000,'normal palm root must remain unchanged');
});
test('palm ultimate is a real authoritative circle with an identical warning',()=>{
 const item=equipmentById('palm-3');
 const stats=scaleUltimateFootprint({...attackStats(item,1),radius:7,range:30},item);
 const area=chargedArea(item,[0,1.16,0],[0,-.12,1],stats,()=>0);
 const foot=spellFootprint(item,[0,1.16,0],[0,-.12,1],stats,area,()=>0);
 assert.equal(area.mode,'area');assert.equal(foot.shape,'circle');
 assert.equal(foot.radius,area.radius);assert.equal(stats.radius,+(7*.6*PALM_ULTIMATE_RADIUS_MULTIPLIER).toFixed(3));
});
test('planter ultimate doubles down on existing 60% scaling with one further 50% for warning and server hits',()=>{
 const plant=equipmentById('planter-3');
 const stats=scaleUltimateFootprint({ultimate:true,range:30,radius:8},plant);
 assert.equal(stats.range,9);assert.equal(stats.radius,2.4);
 const visuals=source('src/plant-ultimate-effects.js');
 assert.match(visuals,/radius\/4/);
 assert.match(source('src/weapon-vfx.js'),/plantUltimates\.play/);
});
test('monsters are physically blocked by solid houses on server patrol and client interpolation',()=>{
 const lot=CITY_LOTS.find(v=>v.index===15),dx=Math.cos(lot.yaw),dz=-Math.sin(lot.yaw);
 const from=[lot.x+dx*(lot.width*.5+2),0,lot.z+dz*(lot.width*.5+2)];
 const mob={position:[...from],bodyRadius:.6};
 const world={cityDamage:{},structures:[]};
 const dest=[lot.x,0,lot.z];
 moveMonster(world,mob,dest,4);
 assert.equal(cityBlocked(mob.position[0],mob.position[2],0,{},.48),false);
 const sourceMob=source('src/island-enemies.js');
 assert.match(sourceMob,/cityBlocked\(x,z,next\.y,damage,\.58\)/);
});
test('single guided native Prism beam, water surf and colored music notes in active VFX',()=>{
 const vfx=source('src/weapon-vfx.js'),native=source('src/numbered-weapon-effects.js');
 assert.doesNotMatch(vfx,/prismCardinalBeams|new ForwardChannelBeam/);
 assert.match(native,/entry\.lockedPoint\.clone\(\)/);
 assert.match(native,/world\?\.prismLocks\?\.\[e\.owner\]/);
 const shader=source('src/weapon-particle-effects.js');
 assert.match(shader,/float lane=floor\(u\*3\.\)/);
 assert.match(shader,/float crest=pow\(max/);
 assert.match(vfx,/item\.id==='accordion'&&!data\.ultimate/);
 assert.match(source('src/reletter/odd-weapon-effects.js'),/pattern===5\?2400:650/);
});
test('green tornado replaces legacy palm binding vines without changing gameplay status',()=>{
 const root=new THREE.Group(),effects=new PlantUltimateEffects(root),item=equipmentById('palm-3');
 const event={ultimate:true,origin:[0,1,0],direction:[0,0,1],range:20,
  area:{mode:'area',visualCenter:[3,.16,4],radius:4}};
 assert.equal(effects.play(event,item),true);
 assert.equal(effects.active.length,1);
 const storm=effects.active[0];
 assert.equal(storm.group.name,'Green lightning-fire tornado');
 assert.equal(storm.group.position.x,3);
 assert.equal(storm.group.position.z,4);
 assert.equal(storm.fx.group.userData.vfxSource,'00GameDevs');
 effects.update(.45);
 assert.ok(storm.age>0);
 effects.dispose();assert.equal(root.children.length,0);
 assert.match(source('src/weapon-vfx.js'),/this\.plantUltimates\.play/);
 assert.doesNotMatch(source('src/weapon-vfx.js'),/bindingCurse\.play/);
});
test('attached boomerang native electrical arc and no held duplicate',()=>{
 const sourceEffects=source('src/weapon-signature-effects.js');
 assert.match(sourceEffects,/nativeArcRay\(/);
 assert.match(sourceEffects,/flexBones\[5\]\.add\(nativeElectric\.group\)/);
 assert.match(sourceEffects,/giraffeHideUntil=performance\.now\(\)\+duration\*1000/);
 assert.match(source('src/main.js'),/giraffeHideUntil/);
});
test('preserve high-detail city destruction and 432-house spatial collision optimization',()=>{
 const city=source('src/outer-city.js'),fire=source('src/city-fire-field.js');
 assert.match(city,/part\.mesh\.scale\.set\(\.88,\.17,\.86\)/);
 assert.match(city,/this\.splinters\?\.burst\(lot/);
 assert.match(city,/applyCityDeformationBasis\(original/);
 assert.match(fire,/float spread=1\.\+4\.\*power/);
});
