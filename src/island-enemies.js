import * as THREE from 'three';
import {MonsterAttackEffects} from './monster-attack-effects.js';
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
  this.extraStates=[];this.extraLive=[];this.attackEffects=new MonsterAttackEffects(scene);
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
  root.userData.attackRestore=[];root.userData.pivot.rotation.x=0;root.userData.pivot.position.y=0;
  const skill=state.skills?.find(s=>s.motion&&s.phase==='active');
  animateIslandModel(root,{...state,moving:state.moving||skill?.motion==='charge',
   leap:false,skills:skill?.motion==='charge'?[skill]:skill?[]:state.skills,
   lastHit:state.lastHitAt},dt,now);
  if(skill){
   const t=Math.min(1,Math.max(0,(now-skill.start)/Math.max(1,skill.end-skill.start))),pulse=Math.sin(Math.PI*t);
   root.userData.pivot.rotation.x=skill.motion==='charge'?.28:0;
   if(skill.motion==='swipe')root.traverse(b=>{
    if(b.isBone&&/RightArm$|RightForeArm$/i.test(b.name)){
     root.userData.attackRestore.push([b,b.quaternion.clone()]);
     b.rotateX(-1.1*pulse);b.rotateZ(-1.3*pulse);
    }
   });
  }
   const stomp=state.skills?.find(s=>s.motion==='stomp'&&(s.phase==='warning'||s.phase==='active'));
   if(stomp){
    const t=Math.max(0,Math.min(1,(now-stomp.start)/Math.max(1,stomp.end-stomp.start)));
    const windup=stomp.phase==='warning',rise=.55,landing=.76;
    const crouch=windup?Math.min(1,t*1.7):t<.08?1-t/.08:t>.76?Math.min(1,(t-.76)/.24)*.35:0;
    // Slow decelerating ascent; shorter, accelerating gravity-like fall.
    const height=windup?0:t<=rise?6.6*(1-(1-t/rise)**2):t<landing?6.6*(1-((t-rise)/(landing-rise))**2):0;
    // The root/pivot is positioned once per frame, with no jump mixer fighting it.
    root.userData.pivot.position.y=height-crouch*.30;
    root.userData.pivot.rotation.x=-.22*crouch;
    const bend=Math.max(crouch,!windup?Math.sin(Math.PI*t)*.38:0);
    for(const name of ['LeftUpLeg','RightUpLeg','LeftLeg','RightLeg']){
     const bone=root.userData.bones?.[name];if(!bone)continue;
     root.userData.attackRestore.push([bone,bone.quaternion.clone()]);
     bone.rotateX((name.endsWith('UpLeg')?-.68:1.18)*bend);
    }
   }
 }
 mouthWorld(root){
  if(!root)return null;
  root.updateWorldMatrix(true,true);
  const bones=root.userData.bones||{},head=bones.Head||bones.head||bones.HeadTopEnd;
  const mouth=head?head.getWorldPosition(new THREE.Vector3()):root.position.clone().add(new THREE.Vector3(0,ENEMY_HEIGHT*.84,0));
  const facing=new THREE.Vector3(0,0,1).applyQuaternion(root.userData.pivot.getWorldQuaternion(new THREE.Quaternion()));
  facing.y=0;if(facing.lengthSq()<.001)facing.set(0,0,1);facing.normalize();
  return mouth.addScaledVector(facing,.56).add(new THREE.Vector3(0,-.12,0));
 }
 placeModel(root,state,dt,now){
  const previous=root.position.clone(),flight=state.panBlastFlight;
  const target=new THREE.Vector3(...(flight?samplePanBlastPosition(flight,now).position:state.position));
  if(flight)root.position.copy(target);
  else root.position.lerp(target,1-Math.exp(-dt*10));
  const motion=state.skills?.find(s=>['charge','beam'].includes(s.motion)&&(s.phase==='warning'||s.phase==='active'));
  if(motion){
   const delta=new THREE.Vector3(...motion.aim).sub(new THREE.Vector3(...motion.origin));
   if(delta.lengthSq()>.001)root.rotation.y=Math.atan2(delta.x,delta.z);
  }else{
   const delta=root.position.clone().sub(previous);
   if(delta.lengthSq()>.00025)root.rotation.y=Math.atan2(delta.x,delta.z);
  }
 }
 update(dt,now,viewport,camera){
  if(this.current&&this.state?.active)this.placeModel(this.current,this.state,dt,now);
  this.updateModel(this.current,this.state,dt,now);
  const sources=[this.state?.active?this.state:null];
  for(const {root,state} of this.extraLive){
   this.placeModel(root,state,dt,now);
   this.updateModel(root,state,dt,now);
   setHealthBar(root,state.hp,state.maxHp,ENEMY_HEIGHT+.65);
   if(camera)faceHealthBar(root,camera);
   sources.push(state);
  }
  const live=new Set();
  const modelById=new Map();
  if(this.state?.active&&this.current)modelById.set(this.state.id,this.current);
  for(const {root,state} of this.extraLive)if(state?.active)modelById.set(state.id,root);
  this.attackEffects.sync(sources,now,state=>this.mouthWorld(modelById.get(state.id)));
  for(const state of sources){
   if(!state?.active)continue;
   for(const spell of state.skills||[]){
    if(spell.motion)continue; // use the dedicated original 00GameDevs attack effects.
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