import * as THREE from 'three';
import {islandModel,animateIslandModel} from './reletter/island-actors.js';
import {createEnemySpellEffect,updateEnemySpellEffect} from './reletter/temple-spell-effects.js';
import {ISLAND_ENEMIES,ENEMY_HEIGHT} from './shared/island-combat.js';
import {MONSTER_PACK_SIZE} from './shared/monster-pack.js';
import {setHealthBar,faceHealthBar} from './health-bars.js';
import {samplePanBlastPosition} from './shared/pan-blast-flight.js';

const makeInvisible=root=>{root.visible=false;return root;};
export class IslandEnemies{
 constructor(scene){
  this.scene=scene;this.models=new Map();this.spells=new Map();this.current=null;this.extraModels=[];
  this.extraStates=[];this.extraLive=[];
 }
 async load(){
  await Promise.all([
   ...ISLAND_ENEMIES.map(async kind=>{
    const root=makeInvisible(await islandModel(kind,ENEMY_HEIGHT));
    root.name='Giant Nangan enemy: '+kind;this.models.set(kind,root);this.scene.add(root);
   }),
   ...Array.from({length:MONSTER_PACK_SIZE},(_,i)=>(async()=>{
    const kind=ISLAND_ENEMIES[i%ISLAND_ENEMIES.length],root=makeInvisible(await islandModel(kind,ENEMY_HEIGHT));
    root.name='Sixfold outer monster '+(i+1)+' · '+kind;this.extraModels[i]=root;this.scene.add(root);
   })())
  ]);
 }
 sync(state,extras=[]){
  this.state=state;
  const next=state?.active?this.models.get(state.model)||this.models.get(ISLAND_ENEMIES[0]):null;
  if(this.current!==next||this.generation!==state?.id){
   if(this.current)this.current.visible=false;
   this.current=next;this.generation=state?.id;
   if(next)next.position.fromArray(state.position);
  }
  if(next)next.visible=true;
  this.extraStates=extras.slice(0,MONSTER_PACK_SIZE);
  this.extraLive=[];
  for(let i=0;i<this.extraModels.length;i++){
   const root=this.extraModels[i],mob=this.extraStates[i];
   if(!root)continue;
   root.visible=!!mob?.active;
   if(root.visible){
    if(root.userData.monsterId!==mob.id){root.userData.monsterId=mob.id;root.position.fromArray(mob.position);}
    this.extraLive.push({root,state:mob});
   }
  }
 }
 updateModel(root,state,dt,now){
  if(!root||!state?.active)return;
  for(const [bone,q] of root.userData.attackRestore||[])bone.quaternion.copy(q);
  root.userData.attackRestore=[];root.userData.pivot.rotation.x=0;
  const skill=state.skills?.find(s=>s.motion&&s.phase==='active');
  animateIslandModel(root,{...state,skills:skill?[]:state.skills,lastHit:state.lastHitAt},dt,now);
  if(skill){
   const t=Math.min(1,(now-skill.start)/1200),pulse=Math.sin(Math.PI*t);
   root.userData.pivot.rotation.x=skill.motion==='roar'?.45*pulse:skill.motion==='charge'?.28:0;
   if(skill.motion==='swipe')root.traverse(b=>{
    if(b.isBone&&/RightArm$|RightForeArm$/i.test(b.name)){
     root.userData.attackRestore.push([b,b.quaternion.clone()]);
     b.rotateX(-1.1*pulse);b.rotateZ(-1.3*pulse);
    }
   });
  }
 }
 update(dt,now,viewport,camera){
  this.updateModel(this.current,this.state,dt,now);
  const sources=[this.state?.active?this.state:null];
  for(const {root,state} of this.extraLive){
   const previous=root.position.clone(),flight=state.panBlastFlight;
   const next=new THREE.Vector3(...(flight?samplePanBlastPosition(flight,now).position:state.position));
   if(flight)root.position.copy(next);
   else root.position.lerp(next,1-Math.exp(-dt*7));
   const displacement=next.sub(previous);
   if(displacement.lengthSq()>.00025)root.rotation.y=Math.atan2(displacement.x,displacement.z);
   this.updateModel(root,state,dt,now);
   setHealthBar(root,state.hp,state.maxHp,ENEMY_HEIGHT+.65);
   if(camera)faceHealthBar(root,camera);
   sources.push(state);
  }
  const live=new Set();
  for(const state of sources){
   if(!state?.active)continue;
   for(const spell of state.skills||[]){
    if(now>=spell.end&&spell.phase==='active')continue;
    const key=state.id+':'+spell.id;live.add(key);
    let mesh=this.spells.get(key);
    if(!mesh){
     mesh=createEnemySpellEffect(THREE,spell,{mobile:matchMedia('(pointer:coarse)').matches});
     this.spells.set(key,mesh);this.scene.add(mesh);
    }
    updateEnemySpellEffect(THREE,mesh,spell,now,viewport);
   }
  }
  for(const [id,mesh] of this.spells)if(!live.has(id)){
   mesh.removeFromParent();mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.spells.delete(id);
  }
 }
}