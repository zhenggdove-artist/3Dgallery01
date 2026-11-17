import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {advanceIslandEnemy,monsterSkillContains,MONSTER_SKILLS} from '../src/shared/island-combat.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {ReletterPresentation} from '../src/reletter-presentation.js';
import {itemById} from '../src/shared/catalog.js';
import {attackDirection} from '../src/aiming.js';

const NOW=70_000_000;
const opts={move(){},hit(target,damage,skill){target.hits??=[];target.hits.push([skill.motion,damage]);}};

test('monster beam lasts five seconds and damages on each second of contact without another ability',()=>{
 const monster={id:'laser',model:'uncle',position:[0,0,0],damage:12,nextAttackAt:0,skills:[],attackCount:0};
 const target={key:'victim',position:[0,0,14],hits:[]};
 advanceIslandEnemy(monster,[target],NOW,opts);
 assert.equal(monster.skills[0]?.motion,'beam');
 const beam=monster.skills[0];
 assert.ok(Math.abs(Math.hypot(beam.aim[0],beam.aim[2])-38)<.001);
 advanceIslandEnemy(monster,[target],NOW+800,opts);
 assert.equal(beam.phase,'active');
 assert.equal(beam.end-beam.start,5000);
 const first=target.hits.length;
 assert.equal(first,1);
 advanceIslandEnemy(monster,[target],NOW+1250,opts);
 assert.equal(target.hits.length,first,'no extra hit before 1 second');
 advanceIslandEnemy(monster,[target],NOW+1900,opts);
 advanceIslandEnemy(monster,[target],NOW+3000,opts);
 assert.equal(target.hits.length,3);
 assert.equal(monster.skills.length,1,'no concurrent skill during beam');
 assert.equal(MONSTER_SKILLS.beam.radius,2.475);
});

test('charge telegraph has exact fixed 19m reach, even when target is closer',()=>{
 const monster={id:'dash',model:'uncle',position:[0,0,0],damage:10,nextAttackAt:0,skills:[],attackCount:0};
 const target={key:'near',position:[3,0,7],hits:[]};
 advanceIslandEnemy(monster,[target],NOW,opts);
 const charge=monster.skills[0];
 assert.equal(charge.motion,'charge');
 assert.ok(Math.abs(Math.hypot(charge.aim[0],charge.aim[2])-19)<.001);
 assert.equal(charge.phase,'warning');
});

test('stomp collision starts on late descent instead of midair',()=>{
 const skill={id:'stomp',motion:'stomp',phase:'active',origin:[0,0,0],aim:[0,0,0],
  start:NOW,end:NOW+1500};
 assert.equal(monsterSkillContains(skill,[0,0,0],NOW+800),false);
 assert.equal(monsterSkillContains(skill,[0,0,0],NOW+1200),true);
});

test('continuous staff fusion produces three simultaneous native VFX streams and reuses them',()=>{
 const world=createInitialWorld(NOW),actor={key:'caster',name:'caster',role:'fighter',position:[75,0,0]};
 const profile=ensureProfile(world,actor.key,actor.name,'#ffffff',NOW);
 profile.equipment.weapon='ember-1';
 profile.inventory.push('ember-1','frost-1','storm-1');
 profile.fusion['ember-1']={effects:['frost-1','storm-1']};
 const action=(now,data)=>applyAction(world,actor,{action:'attack',direction:[0,0,1],...data},{now,actors:[actor],rng:()=>.5});
 assert.equal(action(NOW+1000,{phase:'charge'}).charging,true);
 assert.equal(action(NOW+3000,{phase:'channel-start'}).channeling,true);
 const event=action(NOW+3200,{phase:'channel'}).attackEvent;
 assert.ok(event?.ultimate&&event?.channel);
 assert.deepEqual(event.fusionEchoes.map(e=>e.weapon),['frost-1','storm-1']);
 assert.ok(event.fusionEchoes.every(e=>e.channel&&e.fusionEcho));
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
 const presentation=new ReletterPresentation(scene);
 presentation.play(event,root);
 const originals=presentation.vfx.numberedEffects;
 assert.deepEqual(originals.active.map(e=>e.spec.number).sort((a,b)=>a-b),[8,70,73]);
 assert.equal(originals.active.filter(e=>!!e.key).length,3,'primary and 2 unique fusion channels');
 const next=action(NOW+4200,{phase:'channel'}).attackEvent;
 presentation.play(next,root);
 assert.equal(originals.active.length,3,'repeat damage pulse must reuse VFX objects');
 presentation.vfx.stopChannel(root);
 assert.equal(originals.active.length,0,'channel release removes all three streams');
 presentation.vfx.dispose();
});

test('staff attack direction is solved from the actual raised muzzle to the centre reticle',()=>{
 const camera=new THREE.PerspectiveCamera(60,1,.1,300);
 camera.position.set(0,2,6);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
 const root=new THREE.Group(),controller={root},arena={};
 const muzzle=new THREE.Vector3(0,3,0);
 const direction=new THREE.Vector3(...attackDirection(controller,camera,arena,new Map(),itemById('ember-1'),0,muzzle));
 const ray=new THREE.Raycaster().setFromCamera(new THREE.Vector2(),camera);
 const target=ray.ray.at(150,new THREE.Vector3());
 const expected=target.sub(muzzle).normalize();
 assert.ok(direction.dot(expected)>.995,'aim direction must intersect the reticle ray at distance');
});
