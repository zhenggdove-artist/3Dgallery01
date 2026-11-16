import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {itemById} from '../src/shared/catalog.js';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,worldView} from '../src/shared/temple-rules.js';
import {isChannelStaff,weaponQuality} from '../src/shared/weapon-abilities.js';
import {WeaponSignatureEffects} from '../src/weapon-signature-effects.js';
import {calicoPellets} from '../src/shared/calico-pellets.js';

const start=200000;
const actor={key:'caster',name:'Caster',color:'#ffffff',role:'fighter',position:[75,0,0]};
const game=(id)=>{
 const world=createInitialWorld(start),p=ensureProfile(world,actor.key,actor.name,actor.color,start);
 p.inventory.push(id);p.equipment.weapon=id;
 world.monster={id:'boss',active:true,variant:'uncle',model:'uncle',position:[75,0,11],hp:12000,maxHp:12000,skills:[],nextAttackAt:start+200000};
 return {world,p};
};
const attack=(w,now,extra={})=>applyAction(w,actor,{action:'attack',direction:[0,0,1],...extra},{now,actors:[actor],rng:()=>.5});

test('every magic staff and the seashell uses a press-and-hold server channel; guns do not',()=>{
 for(const id of ['water','tide-1','ember-1','frost-1','storm-1','prism-1','bloom-1','nova-1','clam'])
  assert.ok(isChannelStaff(itemById(id)),id);
 for(const id of ['calico-cat','white-cat','black-cat','fan','giraffe','planter-1'])
  assert.equal(isChannelStaff(itemById(id)),false,id);
 const {world}=game('ember-1');
 assert.match(attack(world,start+1000,{phase:'channel'}).error,/channel/);
 assert.equal(attack(world,start+1100,{phase:'channel-start'}).channeling,true);
 const first=attack(world,start+1200,{phase:'channel'});
 assert.ok(first.attackEvent);
 assert.equal(first.attackEvent.channel,true);
 assert.equal(first.attackEvent.ultimate,false);
 const charged=attack(world,start+5000,{phase:'channel'});
 assert.equal(charged.attackEvent.ultimate,true);
 assert.equal(attack(world,start+5100,{phase:'channel-stop'}).channeling,false);
 assert.ok(attack(world,start+6200,{phase:'channel'}).error);
});
test('higher quality increases strike volume, damage and debuff lifespan',()=>{
 const lower=weaponQuality(itemById('ember-1')),higher=weaponQuality(itemById('ember-5'));
 assert.ok(higher.visual>lower.visual);
 assert.ok(higher.range>lower.range);
 assert.ok(higher.damage>lower.damage);
 assert.ok(higher.duration>lower.duration);
 const a=game('ember-1'),b=game('ember-5');
 a.world.monster.position=[75,0,2];b.world.monster.position=[75,0,2];
 const low=attack(a.world,start+2500),high=attack(b.world,start+2500);
 assert.ok(low.attackEvent&&high.attackEvent);
 assert.ok(high.attackEvent.range>low.attackEvent.range);
 assert.ok(high.attackEvent.damage>low.attackEvent.damage);
 assert.ok(high.attackEvent.radius>low.attackEvent.radius);
 tickWorld(a.world,{now:start+3000,actors:[actor],activeFighters:0,rng:()=>.5});
 tickWorld(b.world,{now:start+3000,actors:[actor],activeFighters:0,rng:()=>.5});
 assert.ok(b.world.monster.effects?.burn?.until>a.world.monster.effects?.burn?.until);
});
test('giraffe boomerang damages monster on both outbound and return independently',()=>{
 const {world}=game('giraffe');
 assert.ok(attack(world,start+1000,{phase:'charge'}).charging);
 const started=attack(world,start+3100,{charge:1});
 assert.equal(started.attackEvent.ultimate,true);
 assert.equal(world.persistentAttacks[0]?.kind,'giraffe');
 const before=world.monster.hp;
 tickWorld(world,{now:start+3800,actors:[actor],activeFighters:1,rng:()=>.5});
 const afterOutbound=world.monster.hp;
 assert.ok(afterOutbound<before,'outgoing model must hit');
 tickWorld(world,{now:start+5400,actors:[actor],activeFighters:1,rng:()=>.5});
 assert.ok(world.monster.hp<afterOutbound,'returning model hits again');
 const hits=worldView(world,actor.key,start+5401).damageEvents.filter(e=>e.target==='boss');
 assert.ok(hits.some(e=>e.kind==='boomerang-out'));
 assert.ok(hits.some(e=>e.kind==='boomerang-return'));
});
test('fan produces four server-owned independently wandering vortex tracks, and quality lengthens them',()=>{
 const {world,p}=game('fan');
 p.fusion.fan={layer:4,bonus:1};
 attack(world,start+1000,{phase:'charge'});
 const result=attack(world,start+2400,{charge:1});
 assert.ok(result.attackEvent?.ultimate);
 const fx=world.persistentAttacks.find(v=>v.kind==='fan');
 assert.ok(fx);
 assert.ok(fx.expiresAt-fx.createdAt>5000);
 assert.ok(fx.radius>2,'purple/legendary fan must sweep a larger damage radius');
 const low=weaponQuality({...itemById('fan'),tier:1});
 assert.ok(fx.expiresAt-fx.createdAt>1400+low.tier*850);
});
test('shotgun is ten visible round coloured spheres, charged larger; other charged skills have separate constructions',()=>{
 const scene=new THREE.Scene(),vfx=new WeaponSignatureEffects(scene);
 const weapon=itemById('calico-cat'),pellets=calicoPellets([0,0,1],false).map(x=>x.direction);
 const shot={origin:[75,1,0],direction:[0,0,1],pellets,range:10,qualityScale:1,qualityTier:3,time:start};
 assert.equal(vfx.play({...shot,ultimate:false},weapon),true);
 const normal=vfx.active.at(-1);
 assert.equal(normal.obj.children.length,10,'ten actual volumetric coloured spheres');
 assert.equal(normal.obj.children.filter(x=>x.isMesh&&x.geometry.type==='SphereGeometry').length,10);
 assert.ok(normal.obj.children.every(x=>x.material.isMeshPhysicalMaterial&&x.material.vertexColors));
 const normalRadius=normal.obj.children[0].scale.x;
 assert.equal(vfx.play({...shot,ultimate:true,range:17,qualityScale:1.4},weapon),true);
 assert.ok(vfx.active.at(-1).obj.children[0].scale.x>normalRadius);
 const cases=[
  ['bloom-3','One enormous forward rotating translucent particle blossom','Points'],
  ['planter-3','Three stacked solid thorn-vine tiers','Mesh'],
  ['fan','Four independent wandering volumetric tornadoes','Points'],
  ['giraffe','Visible spinning yellow giraffe model, outbound and returning','Mesh']
 ];
 for(const [id,name,type] of cases){
  assert.equal(vfx.play({...shot,charge:1,ultimate:true,qualityScale:1.4,qualityTier:3,qualityDuration:1.4},itemById(id)),true,id);
  const root=vfx.active.at(-1).obj;
  assert.equal(root.name,name);
  let found=false;root.traverse(o=>{if(o.type===type)found=true;});
  assert.ok(found,id+' uses '+type);
 }
 const flower=vfx.active.find(e=>e.obj.name.includes('particle blossom'));
 const thorn=vfx.active.find(e=>e.obj.name.includes('thorn-vine tiers'));
 assert.notEqual(flower.obj,thorn.obj);
 assert.ok(thorn.obj.children.length>120,'three-tier thorns need sculpted spikes');
 for(let i=0;i<10;i++)vfx.update(.1);
 vfx.dispose();assert.equal(scene.children.length,0);
});
