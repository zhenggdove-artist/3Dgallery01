import * as THREE from 'three';
import {islandModel,animateIslandModel} from './reletter/island-actors.js';
import {createEnemySpellEffect,updateEnemySpellEffect} from './reletter/temple-spell-effects.js';
import {ISLAND_ENEMIES,ENEMY_HEIGHT} from './shared/island-combat.js';

export class IslandEnemies{
 constructor(scene){this.scene=scene;this.models=new Map();this.spells=new Map();this.current=null;}
 async load(){await Promise.all(ISLAND_ENEMIES.map(async kind=>{const root=await islandModel(kind,ENEMY_HEIGHT);root.visible=false;root.name='Nangan enemy: '+kind;this.models.set(kind,root);this.scene.add(root);}));}
 sync(state){this.state=state;const next=state?.active?this.models.get(state.model)||this.models.get('auntie'):null;if(this.current!==next||this.generation!==state?.id){if(this.current)this.current.visible=false;this.current=next;this.generation=state?.id;if(next)next.position.fromArray(state.position);}if(next)next.visible=true;}
 update(dt,now,viewport){const state=this.state,live=new Set();if(this.current&&state?.active){
  const root=this.current;for(const [bone,q] of root.userData.attackRestore||[])bone.quaternion.copy(q);root.userData.attackRestore=[];root.userData.pivot.rotation.x=0;
  const skill=state.skills?.find(s=>s.motion&&s.phase==='active');
  // These three motions are explicitly requested additions; do not route them to Kick.
  animateIslandModel(root,{...state,skills:skill?[]:state.skills,lastHit:state.lastHitAt},dt,now);
  if(skill){const t=Math.min(1,(now-skill.start)/1200),pulse=Math.sin(Math.PI*t);root.userData.pivot.rotation.x=skill.motion==='roar'?.45*pulse:skill.motion==='charge'?.28:0;
   if(skill.motion==='swipe')root.traverse(b=>{if(b.isBone&&/RightArm$|RightForeArm$/i.test(b.name)){root.userData.attackRestore.push([b,b.quaternion.clone()]);b.rotateX(-1.1*pulse);b.rotateZ(-1.3*pulse);}});
  }
 }
  for(const spell of state?.active?state.skills||[]:[]){if(now>=spell.end&&spell.phase==='active')continue;live.add(spell.id);let mesh=this.spells.get(spell.id);if(!mesh){mesh=createEnemySpellEffect(THREE,spell,{mobile:matchMedia('(pointer:coarse)').matches});this.spells.set(spell.id,mesh);this.scene.add(mesh);}updateEnemySpellEffect(THREE,mesh,spell,now,viewport);}
  for(const [id,mesh] of this.spells)if(!live.has(id)){mesh.removeFromParent();mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.spells.delete(id);}
 }
}
