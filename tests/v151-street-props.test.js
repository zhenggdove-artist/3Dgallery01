import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {itemById,SHOP_ITEMS,shopPurchaseVariant} from '../src/shared/catalog.js';
import {attachOutfit,disposeOutfit,animateOutfit,poseWheelchair} from '../src/reletter/outfit-model.js';
import {outfitTextureResources,wearableResourceSnapshot} from '../src/shared-render-resources.js';
import {animateFaultyMutton} from '../src/reletter/street-outfit-motion.js';
const kinds=['gg-noodle','wheelchair','joss-burner'];
function rig(){
 const root=new T.Group(),model=new T.Group();root.add(model);
 const add=(name,p,parent=model)=>{const b=new T.Bone();b.name=name;b.position.set(...p);parent.add(b);return b;};
 const hips=add('Hips',[0,.92,0]),spine=add('Spine2',[0,.32,0],hips),head=add('Head',[0,.27,0],spine);add('HeadTop_End',[0,.22,0],head);
 for(const [side,sign] of [['Left',1],['Right',-1]]){add(side+'Shoulder',[sign*.16,.14,0],spine);const thigh=add(side+'UpLeg',[sign*.13,-.04,0],hips),shin=add(side+'Leg',[0,-.40,0],thigh);const foot=add(side+'Foot',[0,-.40,0],shin);add(side+'ToeBase',[0,-.02,.1],foot);}
 root.updateMatrixWorld(true);return {root,model,hips};
}
function withCanvas(fn){const prior=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}),set:(o,k,v)=>(o[k]=v,true)})})};try{return fn();}finally{globalThis.document=prior;}}
function drive(record,root,n,step=.1,t=0){for(let i=1;i<=n;i++){root.position.x+=step;animateOutfit(record,t+i*.1,root,.1);}}
test('three actual purchasable outfits have finite geometry and common ownership, repeated attach/dispose returns every lease',()=>withCanvas(()=>{
 const before=outfitTextureResources.snapshot(),active=wearableResourceSnapshot().outfit.active;
 for(const kind of kinds){
  const item=itemById('outfit-'+kind+'-disguise');assert.ok(SHOP_ITEMS.includes(item));assert.ok(shopPurchaseVariant(item.id).price>0);
  for(let i=0;i<3;i++){const {root,model}=rig(),record=attachOutfit(T,model,item);assert.ok(record);const prop=record.extraStreetMotion.g;
   prop.traverse(o=>{if(o.geometry)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});
   animateOutfit(record,0,root,.1);drive(record,root,40,.7);const instances=[];prop.traverse(o=>{if(o.isInstancedMesh)instances.push(o);});
   assert.ok(instances.length>0);let released=0;for(const o of instances)o.addEventListener('dispose',()=>released++);
   assert.equal(disposeOutfit(record),true);assert.equal(disposeOutfit(record),false);assert.equal(released,instances.length);assert.equal(prop.parent,null);
  }
 }
 assert.deepEqual(outfitTextureResources.snapshot(),before);assert.equal(wearableResourceSnapshot().outfit.active,active);
}));
test('noodle lid lifts on movement, faster motion raises steam and spills strands, teleport clears particles',()=>withCanvas(()=>{
 const {root,model}=rig(),record=attachOutfit(T,model,itemById('outfit-gg-noodle-disguise')),d=record.extraStreetMotion;
 animateOutfit(record,0,root,.1);drive(record,root,10,.1);assert.ok(record.noodleProp.lid.rotation.x<-.9);assert.ok(d.smoke.mesh.count>0);const low=Math.max(...d.smoke.particles.filter(p=>p.age<p.life).map(p=>p.v.y));assert.equal(d.batches[0].mesh.count,0);
 drive(record,root,20,.8,1);assert.ok(d.batches[0].mesh.count>0);assert.ok(Math.max(...d.smoke.particles.filter(p=>p.age<p.life).map(p=>p.v.y))>low);
 root.position.x+=10;animateOutfit(record,4,root,.1);assert.equal(d.smoke.mesh.count,0);assert.equal(d.batches[0].mesh.count,0);disposeOutfit(record);
}));
test('wheelchair rotates and seats the real skeleton; fire uses cola activation and pose is reversible',()=>withCanvas(()=>{
 const {root,model,hips}=rig(),record=attachOutfit(T,model,itemById('outfit-wheelchair-disguise')),d=record.extraStreetMotion,chair=record.chairProp,original=hips.position.clone(),restore=[];
 poseWheelchair(record,restore);const seat=chair.g.localToWorld(new T.Vector3(0,.85,-.09));assert.ok(hips.getWorldPosition(new T.Vector3()).distanceTo(seat)<1e-6);
 for(const l of record.seatedPose.legs){const delta=l.shin.getWorldPosition(new T.Vector3()).sub(l.thigh.getWorldPosition(new T.Vector3()));assert.ok(delta.z>.3);const side=l.thigh.name.includes('Left')?1:-1,rest=chair.footrests.find(r=>r.side===side),foot=chair.g.worldToLocal(l.foot.getWorldPosition(new T.Vector3()));assert.ok(Math.abs(foot.y-rest.group.position.y-.075)<.06);assert.ok(Math.abs(foot.z-rest.group.position.z+.08)<.06);}
 for(const [o,key,value] of restore.reverse())o[key].copy(value);assert.ok(hips.position.equals(original));
 animateOutfit(record,0,root,.1);drive(record,root,29,.1);assert.equal(chair.wheels[0].hot.visible,false);assert.ok(chair.wheels[0].group.rotation.x<0);drive(record,root,5,.1,2.9);assert.ok(chair.wheels.every(w=>w.hot.visible));assert.ok(d.smoke.mesh.count>0&&d.fire.mesh.count>0);
 animateOutfit(record,4,root,.1);assert.ok(chair.wheels.every(w=>!w.hot.visible));disposeOutfit(record);
}));
test('burner is twice avatar height, emits smoke at rest and paper after movement; dim sign remains visible',()=>withCanvas(()=>{
 const {root,model}=rig(),item=itemById('outfit-joss-burner-disguise'),r=attachOutfit(T,model,item),d=r.extraStreetMotion;assert.equal(item.disguiseHeight,2);
 animateOutfit(r,0,root,.1);for(let i=1;i<=10;i++)animateOutfit(r,i*.1,root,.1);assert.ok(d.smoke.mesh.count>20);assert.equal(d.batches[0].mesh.count,0);
 drive(r,root,40,.1,1);assert.ok(d.batches[0].mesh.count>0);disposeOutfit(r);
 const mat=new T.MeshStandardMaterial({color:'#fff'});animateFaultyMutton(mat,.4);assert.ok(mat.color.r>=.5&&mat.emissiveIntensity>0);animateFaultyMutton(mat,2);assert.equal(mat.color.r,1);mat.dispose();
}));
