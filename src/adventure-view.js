import * as THREE from 'three';
import {originalWorldVisuals} from './reletter/world-visuals.js';
import {cropStage} from './reletter/garden-catalog.js';
import {animateFishModel,disposeFishModel} from './reletter/fish-model.js';
import {disposeGardenModel} from './reletter/garden-art.js';
import {makePlant} from './reletter/plants.js';
import {itemById} from './shared/catalog.js';

export class AdventureView{
 constructor(scene){this.scene=scene;this.original=originalWorldVisuals(scene);this.crops=new Map();this.waters=new Map();this.fish=new Map();this.loot=new Map();this.plants=new Map();this.world=null;this.nextSync=0;}
 beforeAnimation(){this.original.beforeAnimation();}
 sync(world){this.world=world;}
 reconcile(cache,records,create,remove=disposeGardenModel){const live=new Set();for(const record of records){live.add(record.id);if(!cache.has(record.id))cache.set(record.id,create(record));}for(const [id,o] of cache)if(!live.has(id)){remove(o);cache.delete(id);}}
 update(dt,time,roots,camera){
  if(!this.world)return;const f=this.world.reletter?.fishing||{holes:[],ponds:[],sessions:{}};
  this.original.sync(f,roots);this.original.update(dt,time);
  if(time>=this.nextSync){this.nextSync=time+.5;
   const crops=(this.world.reletter?.garden?.crops||[]).slice(0,40);for(const c of crops){const stage=cropStage(c);if(this.crops.get(c.id)?.userData.stage!==stage){disposeGardenModel(this.crops.get(c.id));this.crops.delete(c.id);}}
   this.reconcile(this.crops,crops,c=>{const o=this.original.makeCropModel(c.species,cropStage(c));o.position.fromArray(c.position);o.userData.stage=cropStage(c);this.scene.add(o);return o;});
   this.reconcile(this.waters,[...f.holes,...f.ponds],h=>{const o=this.original.waterFeature(h,!!h.fish);if(!h.fish)o.position.y+=.31;return o;});
   const fish=f.ponds.flatMap(pond=>pond.fish.map(fish=>({...fish,pond}))).slice(0,40);
   this.reconcile(this.fish,fish,f=>{const o=this.original.swimmingFish(f);o.userData.pond=f.pond;return o;},o=>{o.removeFromParent();disposeFishModel(o);});
   this.reconcile(this.loot,this.world.groundDrops.filter(d=>d.kind!=='coin'&&itemById(d.itemId)),d=>{const o=this.original.createItemDrop(itemById(d.itemId));o.userData.drop=d;this.scene.add(o);return o;});
   // Detailed original plants are distance bounded. All entries remain persistent/readable.
   const near=[...this.world.plants].sort((a,b)=>camera.position.distanceToSquared(new THREE.Vector3(...a.position))-camera.position.distanceToSquared(new THREE.Vector3(...b.position))).slice(0,24);
   this.reconcile(this.plants,near,p=>{const o=makePlant(p.text||p.id);o.position.fromArray(p.position);o.userData.entry=p;o.userData.growDur=1500+Math.random()*800;o.userData.phase=Math.random()*Math.PI*2;this.scene.add(o);return o;});
  }
  for(const o of this.waters.values())o.userData.water.material.uniforms.time.value=time;
  for(const o of this.crops.values())o.visible=o.position.distanceToSquared(camera.position)<6400;
  for(const o of this.loot.values()){const d=o.userData.drop;o.position.fromArray(d.position);o.position.y+=1.2+Math.sin(time*2)*.15;}
  // Original RELETTER indexed growth and organic wriggle, not whole-plant scaling.
  for(const o of this.plants.values()){const m=o.children[0],t=Math.max(0,Math.min(1,(Date.now()-o.userData.entry.createdAt)/o.userData.growDur)),ease=1-(1-t)*(1-t),ph=o.userData.phase;if(m?.geometry&&m.userData.totalIdx)m.geometry.setDrawRange(0,Math.ceil(ease*m.userData.totalIdx/3)*3);o.rotation.x=Math.sin(time*1.1+ph)*.01+Math.sin(time*2.3+ph*1.7)*.005;o.rotation.z=Math.cos(time*.85+ph*.8)*.01+Math.cos(time*1.9+ph*1.3)*.005;}
  for(const o of this.fish.values()){const p=o.userData.pond,d=p.size||[6,2.1,4],seed=o.userData.seed||0,a=time*.16+seed;o.position.set(p.position[0]+Math.cos(a)*Math.max(.1,d[0]/2-.7)*.65,p.position[1]+d[1]*.5,p.position[2]+Math.sin(a)*Math.max(.1,d[2]/2-.7)*.65);o.rotation.y=-a+Math.PI/2;animateFishModel(o,time);if(o.userData.mesh){const attr=o.userData.mesh.geometry.attributes.position,base=o.userData.base;for(let i=0;i<attr.count;i++)attr.setY(i,base[i*3+1]+Math.sin(time*5+base[i*3]*7+seed)*Math.max(0,-base[i*3]+.1)*.12);attr.needsUpdate=true;}}
 }
}
