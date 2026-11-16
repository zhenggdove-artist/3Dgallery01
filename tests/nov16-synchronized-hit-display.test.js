import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {orientPortraitModel} from '../src/equipment-portrait.js';
import {createInitialWorld,ensureProfile,applyAction,tickWorld,worldView} from '../src/shared/temple-rules.js';
import {projectileFlightMs} from '../src/shared/combat-balance.js';
import {itemById} from '../src/shared/catalog.js';
import {ENEMY_HEIGHT} from '../src/shared/island-combat.js';

const T=1600000;
const caster={key:'caster',name:'Caster',role:'fighter',color:'#fff',position:[75,0,0]};
function worldWith(weapon,enemy=[75,0,9]){
 const world=createInitialWorld(T);
 const p=ensureProfile(world,caster.key,caster.name,caster.color,T);
 p.inventory.push(weapon);p.equipment.weapon=weapon;
 world.monster={id:'enemy',active:true,variant:'uncle',model:'uncle',
  position:[...enemy],hp:100000,maxHp:100000,skills:[],nextAttackAt:T+600000};
 return world;
}
function release(world,time,weapon){
 const ready=applyAction(world,caster,{action:'attack',phase:'charge'},{now:time-1600,actors:[caster]});
 assert.equal(ready.charging,true,weapon);
 const out=applyAction(world,caster,{action:'attack',direction:[0,0,1],charge:1},
  {now:time,actors:[caster],rng:()=>.5});
 assert.equal(out.attackEvent?.ultimate,true,weapon);
 return out;
}
test('the exact 90-degree clam cone cannot damage a monster before the original tidal wave reaches it',()=>{
 assert.equal(projectileFlightMs(itemById('clam'),true),2180);
 const world=worldWith('clam',[77,0,9]),at=T+3000;
 const out=release(world,at,'clam');
 assert.equal(out.attackEvent.area.mode,'sector');
 const before=world.monster.hp;
 tickWorld(world,{now:at+310,actors:[caster],activeFighters:0,rng:()=>.5});
 assert.equal(world.monster.hp,before);
 assert.equal((world.damageEvents||[]).length,0,'no early damage number near the caster');
 tickWorld(world,{now:at+1800,actors:[caster],activeFighters:0,rng:()=>.5});
 assert.ok(world.monster.hp<before,'swept 90-degree wave intersects the body off centreline');
 const hits=worldView(world,caster.key,at+1801).damageEvents.filter(e=>e.target==='enemy');
 assert.equal(hits.length,1,'wave hit is not duplicated by invisible early AoE');
 assert.deepEqual(hits[0].position,[77,ENEMY_HEIGHT*.5,9],
  'critical/damage numbers are anchored to the monster model');
});
test('the warned clam cone must never damage actors beyond its 45-degree half-angle',()=>{
 const world=worldWith('clam',[89,0,7]),at=T+3000;
 release(world,at,'clam');
 tickWorld(world,{now:at+2181,actors:[caster],activeFighters:0,rng:()=>.5});
 assert.equal(world.monster.hp,100000);
 assert.equal((world.damageEvents||[]).length,0);
});
test('a sideways imported skinned paper doll becomes upright with face and shoulders toward camera',()=>{
 const model=new THREE.Group();
 const hips=new THREE.Bone();hips.name='mixamorigHips';hips.position.set(0,0,0);
 const head=new THREE.Bone();head.name='mixamorigHead';head.position.set(0,2,0);
 const left=new THREE.Bone();left.name='mixamorigLeftShoulder';left.position.set(-.65,1.45,0);
 const right=new THREE.Bone();right.name='mixamorigRightShoulder';right.position.set(.65,1.45,0);
 const nose=new THREE.Object3D();nose.position.set(0,1.9,-.26);
 model.add(hips,head,left,right,nose);
 model.quaternion.setFromEuler(new THREE.Euler(Math.PI/2,Math.PI/2,Math.PI/3));
 assert.equal(orientPortraitModel(model),'anatomical');
 const at=o=>o.getWorldPosition(new THREE.Vector3());
 const top=at(head),base=at(hips),l=at(left),r=at(right),f=at(nose);
 assert.ok(top.y-base.y>1.8,'head must be above hips, never lying horizontally');
 assert.ok(Math.abs(l.y-r.y)<.01&&Math.abs(l.z-r.z)<.01,'shoulders must be level on screen');
 assert.ok(f.z>top.z+.18,'anatomical front / face must look at the viewer');
});
