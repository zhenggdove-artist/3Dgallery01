import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createColaStream,updateColaStream} from '../src/reletter/street-outfit-motion.js';
import {RenderMemoryManager} from '../src/render-residency.js';
import {SharedRenderResources} from '../src/shared-render-resources.js';
import {repackVisibleSpans} from '../src/visible-spans.js';
test('liquid tips have a moving rounded end, closed cap, same height and detached spray',()=>{
 const r={colaMotion:{open:1}};createColaStream(T,new T.Group(),r,color=>new T.MeshStandardMaterial({color}));
 const j=r.colaMotion.jet,a=j.mesh.geometry.attributes.position,idx=j.mesh.geometry.index;
 assert.equal(idx.count,j.streams*((j.n-1)*j.sides*6+(j.sides-2)*3));
 updateColaStream(r.colaMotion,1);
 const k=1,last=(k*j.n+j.n-1)*j.sides,body=(k*j.n+j.n-5)*j.sides;
 const point=i=>new T.Vector3().fromBufferAttribute(a,i);
 const diameter=i=>point(i).distanceTo(point(i+j.sides/2));
 assert.ok(diameter(body)>.01);assert.ok(diameter(last)>.001);assert.ok(diameter(last)<diameter(body));
 const previous=point(last);updateColaStream(r.colaMotion,1.31);assert.ok(previous.distanceTo(point(last))>.005);
 assert.ok([...a.array].every(Number.isFinite));assert.equal(j.drops.count,64);
 r.colaMotion.open=0;updateColaStream(r.colaMotion,2);assert.equal(j.mesh.visible,false);assert.equal(j.drops.count,0);
});
test('shared resources retain actual texture until the final owner releases it',()=>{
 const m=new SharedRenderResources();let created=0,disposed=0;
 const make=()=>({id:++created}),drop=()=>disposed++;
 const a=m.acquire('fruit',make,drop,()=>1024),b=m.acquire('fruit',make,drop);
 assert.equal(a,b);assert.equal(created,1);assert.deepEqual(m.snapshot(),{entries:1,references:2,estimatedPixelBytes:1024});
 assert.equal(m.release('fruit',{}),false);assert.ok(m.release('fruit',a));assert.equal(disposed,0);
 assert.ok(m.release('fruit',b));assert.equal(disposed,1);assert.equal(m.snapshot().entries,0);
});
test('pool accounting is incremental, deduplicates shared buffers, and never evicts reserves',()=>{
 const m=new RenderMemoryManager({mobile:true});m.maintenanceMs=Infinity;m.accountNodeLimit=1;
 const root=new T.Group(),geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();
 root.add(new T.Mesh(geometry,material),new T.Mesh(geometry,material));
 const entry={root};const group={kind:'test',list:[entry],keep:1,idleMs:0,root:e=>e.root,since:()=>0,dispose:()=>assert.fail('reserve disposed')};
 m.sweepPools([group],100);assert.ok(m.snapshot().pools.accountingPending);let count=0;
 while(m.snapshot().pools.accountingPending&&count++<30){m.beginFrame();assert.ok(m.advanceAccounting()<=1);}
 assert.equal(m.snapshot().pools.accountingPending,false);assert.equal(m.snapshot().pools.accountedNodes,3);
 assert.equal(m.snapshot().pools.estimatedBufferBytes,geometry.index.array.buffer.byteLength+Object.values(geometry.attributes).reduce((n,a)=>n+a.array.buffer.byteLength,0));
 geometry.dispose();material.dispose();
});
test('prefix packing preserves exact values, pending uploads, and draw-only shrink',()=>{
 const a=new Uint32Array([1,2]),b=new Uint32Array([3,4]),c=new Uint32Array([5,6]);
 const attr=new T.BufferAttribute(new Uint32Array([1,2,3,4,5,6]),1);
 assert.equal(repackVisibleSpans(attr,[a,b,c],[a,c]),4);assert.deepEqual([...attr.array.slice(0,4)],[1,2,5,6]);
 assert.equal(attr.updateRanges[0].start,2);assert.equal(repackVisibleSpans(attr,[a,c],[b,c]),4);
 assert.deepEqual([...attr.array.slice(0,4)],[3,4,5,6]);assert.equal(attr.updateRanges[0].start,0);assert.equal(attr.updateRanges[0].count,4);
 const v=attr.version;assert.equal(repackVisibleSpans(attr,[b,c],[b]),2);assert.equal(attr.version,v);
 assert.equal(repackVisibleSpans(attr,[b],[a,b,c]),6);assert.deepEqual([...attr.array],[1,2,3,4,5,6]);
});

test('cola translucency and shortened falling arcs preserve the crest and rounded moving ends',()=>{
 const r={colaMotion:{open:1}};createColaStream(T,new T.Group(),r,color=>new T.MeshStandardMaterial({color}));
 const j=r.colaMotion.jet,a=j.mesh.geometry.attributes.position;
 assert.ok(j.mesh.material.transparent&&j.mesh.material.opacity>.5&&j.mesh.material.opacity<.85);
 assert.equal(j.mesh.material.depthWrite,false);assert.equal(j.mesh.material.side,T.FrontSide);
 const center=(k,ring)=>{const v=new T.Vector3();for(let i=0;i<j.sides;i++)v.add(new T.Vector3().fromBufferAttribute(a,(k*j.n+ring)*j.sides+i));return v.multiplyScalar(1/j.sides);};
 for(let t=0;t<4;t+=.125){
  updateColaStream(r.colaMotion,t);
  for(let k=1;k<j.streams;k++){
   let crest=-Infinity;for(let ring=0;ring<j.n;ring++)crest=Math.max(crest,center(k,ring).y);
   const tip=center(k,j.n-1),base=center(k,j.n-5);
   assert.ok(crest-1.98>1.75,'outer arc retains original upward crest');
   assert.ok(crest-tip.y<.65,'continuous downward tail is short');
   assert.ok(tip.distanceTo(base)<.03,'cap is rounded without an elongated spike');
  }
  assert.equal(j.drops.count,64);
 }
});
