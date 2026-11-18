import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {advanceIslandEnemy,MONSTER_SKILLS} from '../src/shared/island-combat.js';
import {IslandEnemies} from '../src/island-enemies.js';

test('persisted dash snapshots are discarded without moving or damaging anyone',()=>{
 const mob={id:'m',model:'uncle',position:[0,0,0],skills:[{
  id:'old',motion:'charge',phase:'active',origin:[0,0,0],aim:[19,0,0],
  start:1000,end:2600,hit:[],lastTick:{},damage:10
 }],updatedAt:1000,nextAttackAt:10000};
 let moveCount=0,hitCount=0;
 advanceIslandEnemy(mob,[],1500,{move(){moveCount++;},hit(){hitCount++;}});
 assert.deepEqual(mob.skills,[]);
 assert.equal(moveCount,0);
 assert.equal(hitCount,0);
 assert.equal(MONSTER_SKILLS.charge,undefined);
});

test('ordinary monster positions interpolate without dash prediction',()=>{
 const scene=new THREE.Scene(),actors=new IslandEnemies(scene),root=new THREE.Group();
 actors.models.set('uncle',root);scene.add(root);
 const state={id:'mob',model:'uncle',active:true,position:[0,0,0],skills:[]};
 actors.sync(state);
 const next={...state,position:[0,0,8]};
 actors.placeModel(root,next,1/60,1000);
 const first=root.position.z;
 actors.placeModel(root,next,1/60,1016);
 assert.ok(root.position.z>first&&first>0,'visual interpolation remains smooth');
});

test('loading compiles gameplay Jump, Walk, frost Kick and Idle poses, restoring scene ownership',async()=>{
 const scene=new THREE.Scene(),actors=new IslandEnemies(scene),root=new THREE.Group();
 const pivot=new THREE.Group(),model=new THREE.Group();root.add(pivot);pivot.add(model);
 const mixer=new THREE.AnimationMixer(model),actions={};
 for(const name of ['Jump','Walk','Kick','Idle']){
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
 assert.deepEqual(observed,['Jump','Walk','Kick','Idle']);
 assert.equal(root.parent,scene);
 assert.equal(root.visible,false);
 assert.deepEqual(root.position.toArray(),[0,0,0]);
});
