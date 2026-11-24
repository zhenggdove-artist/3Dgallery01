import * as THREE from 'three';
import {originalWorldVisuals} from './reletter/world-visuals.js';
import {disposeGardenModel} from './reletter/garden-art.js';
import {makePlant} from './reletter/plants.js';
import {itemById} from './shared/catalog.js';
import {makeHeldWeapon} from './reletter/held-weapons.js';
import {isSpellWeapon,makeSpellEquipment} from './spell-equipment.js';

function createVisibleDrop(item,original){
 if(item?.slot!=='weapon')return original.createItemDrop(item);
 // The original world loot uses a billboard icon and a blurry glow.
 // Reuse the actual held weapon's 3D geometry for world pickups instead.
 const group=new THREE.Group();
 group.name='Dropped weapon model: '+item.name;
 const model=isSpellWeapon(item)?makeSpellEquipment(item):makeHeldWeapon(item);
 const bounds=new THREE.Box3().setFromObject(model);
 const size=bounds.getSize(new THREE.Vector3());
 const factor=Math.min(1.25,1.9/Math.max(.15,size.y),1.6/Math.max(.15,size.x,size.z));
 model.scale.setScalar(factor);
 model.position.y=-(bounds.min.y+bounds.max.y)*.5*factor;
 group.add(model);group.userData.weaponDrop=true;group.userData.itemId=item.id;
 return group;
}

export class AdventureView{
 constructor(scene){this.scene=scene;this.original=originalWorldVisuals(scene);this.loot=new Map();this.plants=new Map();this.world=null;this.nextSync=0;}
 // GGTEMPLE never supplies fishing sessions. Keep the original model factory
 // for loot art, but do not tick the inactive RELETTER fishing runtime.
 beforeAnimation(){}
 sync(world){this.world=world;}
 reconcile(cache,records,create,remove=disposeGardenModel){const live=new Set();for(const record of records){live.add(record.id);if(!cache.has(record.id))cache.set(record.id,create(record));}for(const [id,o] of cache)if(!live.has(id)){remove(o);cache.delete(id);}}
 update(dt,time,roots,camera){
  if(!this.world)return;
  if(time>=this.nextSync){this.nextSync=time+.5;
   this.reconcile(this.loot,this.world.groundDrops.filter(d=>d.kind!=='heart'&&d.kind!=='coin'&&itemById(d.itemId)),d=>{const o=createVisibleDrop(itemById(d.itemId),this.original);o.userData.drop=d;this.scene.add(o);return o;});
   // Detailed original plants are distance bounded. All entries remain persistent/readable.
   const {x,y,z}=camera.position;
   const distance=p=>(p.position[0]-x)**2+(p.position[1]-y)**2+(p.position[2]-z)**2;
   // Same nearest 24 entries, but compute distance once per entry instead
   // of allocating two Vector3 instances on every sort comparison.
   const near=this.world.plants.map(p=>({p,distance:distance(p)})).sort((a,b)=>a.distance-b.distance).slice(0,24).map(e=>e.p);
   this.reconcile(this.plants,near,p=>{const o=makePlant(p.text||p.id);o.position.fromArray(p.position);o.userData.entry=p;o.userData.growDur=3100;
    o.userData.growStart=performance.now()-Math.max(0,(this.world.serverTime||Date.now())-(p.createdAt||0));
    o.userData.fullScale=o.scale.clone();o.scale.setScalar(.001);
    o.children[0]?.geometry?.setDrawRange(0,0);
    o.userData.phase=Math.random()*Math.PI*2;this.scene.add(o);return o;});
  }
  for(const o of this.loot.values()){const d=o.userData.drop;o.position.fromArray(d.position);o.position.y+=(o.userData.weaponDrop?.95:1.2)+Math.sin(time*2)*.15;if(o.userData.weaponDrop){o.rotation.y=time*.7;o.rotation.z=Math.sin(time*1.4)*.18;}}
  // Original RELETTER indexed growth and organic wriggle, not whole-plant scaling.
  const now=performance.now();
  for(const o of this.plants.values()){const m=o.children[0],t=Math.max(0,Math.min(1,(now-o.userData.growStart)/o.userData.growDur)),ease=t*t*(3-2*t),ph=o.userData.phase;
   // Growth begins below the soil after the WRITE burst: indexed stems unfold
   // while the entire plant rises in size, instead of appearing fully formed.
   if(o.userData.lastGrowth!==ease){
    o.userData.lastGrowth=ease;o.scale.copy(o.userData.fullScale).multiplyScalar(Math.max(.001,ease));
    if(m?.geometry&&m.userData.totalIdx)m.geometry.setDrawRange(0,Math.ceil(ease*m.userData.totalIdx/3)*3);
   }o.rotation.x=Math.sin(time*1.1+ph)*.01+Math.sin(time*2.3+ph*1.7)*.005;o.rotation.z=Math.cos(time*.85+ph*.8)*.01+Math.cos(time*1.9+ph*1.3)*.005;}

 }
}
