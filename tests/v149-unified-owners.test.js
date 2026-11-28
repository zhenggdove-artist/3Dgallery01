import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {disposeOwnedVisual,registerRenderOwner,manageNativeEffect,acquireRootTexture,wearableResourceSnapshot} from '../src/shared-render-resources.js';
import {makeHeldWeapon} from '../src/reletter/held-weapons.js';
import {makeSpellEquipment} from '../src/spell-equipment.js';
import {disposeGardenModel} from '../src/reletter/garden-art.js';
import {WeaponVFX} from '../src/weapon-vfx.js';
import {ElementalStatusVisuals} from '../src/elemental-status-visuals.js';
import {itemById} from '../src/shared/catalog.js';
test('owned weapon disposal releases skeleton bone textures once, including nested ground drops',()=>{
 const base=wearableResourceSnapshot().weapon.active;
 for(let i=0;i<40;i++){
  const model=makeHeldWeapon(itemById('giraffe')),outer=new T.Group();outer.add(model);
  let sk;model.traverse(o=>{if(o.isSkinnedMesh)sk=o.skeleton;});assert.ok(sk);
  sk.computeBoneTexture();let released=0;sk.boneTexture.addEventListener('dispose',()=>released++);
  disposeGardenModel(outer);assert.equal(released,1);assert.equal(disposeOwnedVisual(model),false);
 }
 assert.equal(wearableResourceSnapshot().weapon.active,base);
 const spell=makeSpellEquipment(itemById('prism-3'));disposeOwnedVisual(spell);assert.equal(wearableResourceSnapshot().weapon.active,base);
});
test('native disposer runs once and releases independent instance buffers',()=>{
 const group=new T.Group(),g=new T.BoxGeometry(),m=new T.MeshBasicMaterial(),instance=new T.InstancedMesh(g,m,2);group.add(instance);
 let native=0,instances=0;instance.addEventListener('dispose',()=>instances++);
 const fx={group,dispose(){native++;g.dispose();m.dispose();}};
 const before=wearableResourceSnapshot().effect.active;
 assert.equal(manageNativeEffect(fx),fx);assert.equal(manageNativeEffect(fx),fx);
 assert.equal(wearableResourceSnapshot().effect.active,before+1);
 fx.dispose();fx.dispose();assert.equal(native,1);assert.equal(instances,1);assert.equal(wearableResourceSnapshot().effect.active,before);
});
test('explicit leases and borrowed geometry survive until last owner',()=>{
 const g=new T.BoxGeometry(),a=registerRenderOwner(new T.Group(),'weapon'),b=registerRenderOwner(new T.Group(),'weapon');
 let count=0;const t=acquireRootTexture(a,'test:weapon:shared',()=>new T.Texture(),()=>count++);
 const other=acquireRootTexture(b,'test:weapon:shared',()=>assert.fail('duplicate texture'));
 a.add(new T.Mesh(g,new T.MeshBasicMaterial({map:t})));b.add(new T.Mesh(g,new T.MeshBasicMaterial({map:other})));
 let geoDisposes=0;g.addEventListener('dispose',()=>geoDisposes++);
 disposeOwnedVisual(a,{borrowGeometry:v=>v===g});assert.equal(count,0);assert.equal(geoDisposes,0);
 disposeOwnedVisual(b);assert.equal(count,1);assert.equal(geoDisposes,1);
});
test('plant, restoration, and burn effects are visible to the common pool manager',()=>{
 const v=new WeaponVFX(new T.Scene()),status=new ElementalStatusVisuals();
 const groups=v.idlePoolGroups().concat(status.idlePoolGroups());
 assert.equal(groups.filter(g=>g.kind==='plantVfx').length,2);
 assert.ok(groups.some(g=>g.kind==='restorationVfx'&&g.keep===1));
 assert.ok(groups.some(g=>g.kind==='statusFireball'&&g.keep===8));v.dispose();status.dispose();
});

test('idle surplus retirement continues within each frame budget without evicting reacquired entries',async()=>{
 const {RenderMemoryManager}=await import('../src/render-residency.js');
 const m=new RenderMemoryManager({mobile:true});m.maintenanceMs=Infinity;
 const list=Array.from({length:8},(_,id)=>({id,root:new T.Group(),since:id})),disposed=[];
 const group={kind:'probe',list,keep:2,idleMs:30,root:e=>e.root,since:e=>e.since,dispose:e=>disposed.push(e.id)};
 assert.equal(m.sweepPools([group],100),2);assert.deepEqual(disposed,[2,3]);
 list.find(e=>e.id===4).since=100;
 m.beginFrame();assert.equal(m.advancePoolRetirement(),2);assert.deepEqual(disposed,[2,3,5,6]);
 m.beginFrame();assert.equal(m.advancePoolRetirement(),1);assert.deepEqual(disposed,[2,3,5,6,7]);
 assert.deepEqual(list.map(e=>e.id),[0,1,4]);
});
