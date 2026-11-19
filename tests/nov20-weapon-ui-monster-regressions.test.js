import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {equipmentById,attackStats} from '../src/reletter/equipment-catalog.js';
import {weaponRangeClass} from '../src/reletter/odd-weapons.js';
import {applyElementalHit} from '../src/shared/combat-status.js';
import {scaleUltimateFootprint,chargedArea,spellFootprint} from '../src/shared/charge-area.js';
import {CITY_LOTS,CITY_MAX_HP,cityBlocked} from '../src/shared/city-layout.js';
import {moveMonster} from '../src/shared/temple-rules.js';
import {TripleBindingCurse} from '../src/binding-curse-triple.js';
import {ForwardChannelBeam} from '../src/forward-channel-beam.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('equipped marker, 3px chat lift, GM help inside S and opaque clean paper doll',()=>{
 const css=source('fidelity-ui.css'),ui=source('src/ui.js'),portrait=source('src/equipment-portrait-view.js');
 assert.match(css,/\.bag-cell\.equipped::after\{top:1px!important;bottom:auto!important/);
 assert.match(css,/#hud #chat-hud\{bottom:max\(160px/);
 assert.match(css,/#gm-help\{display:none!important\}/);
 assert.match(ui,/data-gm-action="help" aria-label="GM instructions and shortcuts"/);
 assert.match(css,/#panel #bag-portrait-frame::after\{display:none!important\}/);
 assert.match(portrait,/alpha:false/);assert.match(portrait,/setClearColor\(0xe9e8ed,1\)/);
});
test('store classes all original staffs as mid and giraffe melee and jellybrella as mid',()=>{
 for(const id of ['water','tide-1','tide-5','frost-5','storm-5','prism-5','ember-5','bloom-5','nova-5']){
  assert.equal(weaponRangeClass(equipmentById(id)),'mid',id);
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
 assert.match(gun,/this\.mode===1&&weapon\(\)\?\.id==='goldfish'/);
 assert.match(main,/if\(weapon\?\.id==='goldfish'\)\{/);
 assert.match(effect,/goldfishBubble\(event\)/);
});
test('ice freezes three seconds with five-second trigger lock and palm ultimate binds for three seconds every six',()=>{
 const caster={key:'artist'},target={hp:100,maxHp:100,effects:{},effectLocks:{}};
 assert.equal(applyElementalHit(target,caster,equipmentById('frost-1'),10000),'freeze');
 assert.equal(target.effects.freeze.until,13000);
 assert.equal(target.effectLocks.freeze,15000);
 assert.equal(applyElementalHit(target,caster,equipmentById('frost-1'),12000),null);
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
 assert.equal(foot.radius,area.radius);assert.equal(stats.radius,7*.6);
});
test('planter ultimate doubles down on existing 60% scaling with one further 50% for warning and server hits',()=>{
 const plant=equipmentById('planter-3');
 const stats=scaleUltimateFootprint({ultimate:true,range:30,radius:8},plant);
 assert.equal(stats.range,9);assert.equal(stats.radius,2.4);
 const visuals=source('src/weapon-signature-effects.js');
 assert.match(visuals,/const scale=Math\.max\(\.2,/);
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
test('four curved cardinal Prism beams, water surf and colored music notes in active VFX',()=>{
 const root=new THREE.Group(),fx=new ForwardChannelBeam(root,false);
 assert.equal(fx.paths.length,4);
 assert.ok(fx.paths.every(p=>p.geometry.attributes.position.count===65));
 fx.update(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),35,.8,.5);
 const top=fx.paths[1].geometry.attributes.position.array;
 assert.ok(Math.abs(top[32*3+1]-1)>5,'Prism beam must visibly curve upward');
 assert.ok(fx.paths.every(p=>p.userData.glow));
 fx.dispose();assert.equal(root.children.length,0);
 const shader=source('src/weapon-particle-effects.js');
 assert.match(shader,/float lane=floor\(u\*3\.\)/);
 assert.match(shader,/float crest=pow\(max/);
 const vfx=source('src/weapon-vfx.js');
 assert.match(vfx,/new ForwardChannelBeam\(this\.scene,false\)/);
 assert.match(vfx,/item\.id==='accordion'&&!data\.ultimate/);
 assert.match(source('src/reletter/odd-weapon-effects.js'),/pattern===5\?2400:650/);
});
test('three binding vine levels fill palm circle without multiplying draw calls per skill tick',()=>{
 const root=new THREE.Group(),field=new TripleBindingCurse(root);
 const event={area:{visualCenter:[3,0,4],radius:4}};
 const vines=field.play(event);
 assert.equal(vines.userData.vines.length,3);
 assert.equal(vines.userData.rings.length,3);
 assert.equal(vines.children.filter(x=>x.isInstancedMesh).length,1);
 field.update(.45);
 assert.ok(vines.scale.y>.5);
 field.update(3.1);assert.equal(field.active.length,0);
 field.dispose();
 assert.match(source('src/weapon-vfx.js'),/item\.family==='palm'&&data\.ultimate/);
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
