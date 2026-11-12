import * as THREE from 'three';
import {islandModel,animateIslandModel} from './reletter/island-actors.js';
import {createEnemySpellEffect,updateEnemySpellEffect} from './reletter/temple-spell-effects.js';
import {ISLAND_ENEMIES,ENEMY_HEIGHT} from './shared/island-combat.js';

export class IslandEnemies{
 constructor(scene){this.scene=scene;this.models=new Map();this.spells=new Map();this.current=null;}
 async load(){await Promise.all(ISLAND_ENEMIES.map(async kind=>{const root=await islandModel(kind,ENEMY_HEIGHT);root.visible=false;root.name='Nangan enemy: '+kind;this.models.set(kind,root);this.scene.add(root);}));}
 sync(state){this.state=state;const next=state?.active?this.models.get(state.model)||this.models.get('auntie'):null;if(this.current!==next||this.generation!==state?.id){if(this.current)this.current.visible=false;this.current=next;this.generation=state?.id;if(next)next.position.fromArray(state.position);}if(next)next.visible=true;}
 update(dt,now,viewport){const state=this.state,live=new Set();if(this.current&&state?.active)animateIslandModel(this.current,{...state,lastHit:state.lastHitAt},dt,now);
  for(const spell of state?.active?state.skills||[]:[]){if(now>=spell.end&&spell.phase==='active')continue;live.add(spell.id);let mesh=this.spells.get(spell.id);if(!mesh){mesh=createEnemySpellEffect(THREE,spell,{mobile:matchMedia('(pointer:coarse)').matches});this.spells.set(spell.id,mesh);this.scene.add(mesh);}updateEnemySpellEffect(THREE,mesh,spell,now,viewport);}
  for(const [id,mesh] of this.spells)if(!live.has(id)){mesh.removeFromParent();mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.spells.delete(id);}
 }
}
