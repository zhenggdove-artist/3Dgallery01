import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {monsterChargePosition,advanceIslandEnemy} from '../src/shared/island-combat.js';
import {IslandEnemies} from '../src/island-enemies.js';

test('charge covers the fixed telegraphed path smoothly without depending on network packet delivery',()=>{
 const skill={id:'dash',motion:'charge',phase:'active',
  origin:[0,0,0],aim:[19,0,0],start:1000,end:2600,hit:[],lastTick:{}};
 assert.deepEqual(monsterChargePosition(skill,1000),[0,0,0]);
 assert.deepEqual(monsterChargePosition(skill,1800),[9.5,0,0]);
 assert.deepEqual(monsterChargePosition(skill,2600),[19,0,0]);
 assert.deepEqual(monsterChargePosition(skill,3300),[19,0,0]);
 let previous=0;
 for(let now=1000;now<=2600;now+=16){
  const x=monsterChargePosition(skill,now)[0];
  assert.ok(x>=previous&&x-previous<.2,'every 16ms rendered step is sub-20cm');
  previous=x;
 }
 const scene=new THREE.Scene(),actors=new IslandEnemies(scene),root=new THREE.Group();
 actors.models.set('uncle',root);scene.add(root);
 const state={id:'mob',model:'uncle',active:true,position:[0,0,0],skills:[skill]};
 actors.sync(state);
 actors.placeModel(root,state,1/60,1800);
 const first=root.position.x;
 actors.placeModel(root,state,1/60,1816);
 assert.ok(root.position.x>first&&first>0,'monster moves between frozen server snapshots');
 assert.deepEqual(state.position,[0,0,0],'client prediction never changes authoritative position');
});

test('authoritative dash advances toward the time-sampled target and does not teleport',()=>{
 const skill={id:'charge',motion:'charge',phase:'active',origin:[0,0,0],aim:[19,0,0],
  start:1000,end:2600,hit:[],lastTick:{},damage:10};
 const mob={id:'m',model:'uncle',position:[0,0,0],skills:[skill],updatedAt:1000,nextAttackAt:10000};
 const move=(target,distance)=>{
  const dx=target[0]-mob.position[0],dz=target[2]-mob.position[2],length=Math.hypot(dx,dz);
  if(length){mob.position[0]+=dx/length*distance;mob.position[2]+=dz/length*distance;}
 };
 advanceIslandEnemy(mob,[],1100,{move,hit(){}});
 assert.ok(mob.position[0]>0&&mob.position[0]<2);
 const first=mob.position[0];
 advanceIslandEnemy(mob,[],1600,{move,hit(){}});
 assert.ok(mob.position[0]>first&&mob.position[0]<19);
});

test('loading renders real Jump, Run and Idle skinned poses and restores scene ownership',async()=>{
 const scene=new THREE.Scene(),actors=new IslandEnemies(scene),root=new THREE.Group();
 const pivot=new THREE.Group(),model=new THREE.Group();root.add(pivot);pivot.add(model);
 const mixer=new THREE.AnimationMixer(model),actions={};
 for(const name of ['Jump','Run','Idle']){
  actions[name]=mixer.clipAction(new THREE.AnimationClip(name,1,[]));
 }
 root.userData={pivot,bones:{},mixer,actions,clipYaw:{},materials:[],active:null};
 root.visible=false;scene.add(root);actors.models.set('uncle',root);
 const observed=[];
 const renderer={
  getRenderTarget:()=>null,setRenderTarget:()=>{},
  compileAsync:async(stage,view)=>{assert.ok(stage.children.includes(root));assert.ok(view.position.z>20);},
  render:()=>{observed.push(root.userData.active?.getClip()?.name);},
 };
 const count=await actors.warmModels(renderer,new THREE.PerspectiveCamera());
 assert.equal(count,1);
 assert.deepEqual(observed,['Jump','Run','Idle']);
 assert.equal(root.parent,scene);
 assert.equal(root.visible,false);
 assert.deepEqual(root.position.toArray(),[0,0,0]);
});
