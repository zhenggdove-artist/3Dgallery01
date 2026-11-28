import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {residencyView,farMesh,updateResidency,RenderMemoryManager} from '../src/render-residency.js';
import {GPUFrameQueue} from '../src/gpu-frame-queue.js';
import {EquipmentPortraitViewport} from '../src/equipment-portrait-view.js';
test('cold offscreen GPU retirement is independent of fog and wakes before drawing',()=>{
 const camera=new T.PerspectiveCamera(55,1,.1,400),mesh=new T.Mesh(new T.BoxGeometry(2,2,2));mesh.position.z=100;
 assert.equal(farMesh(mesh,residencyView(camera)),false);assert.equal(farMesh(mesh,residencyView(camera,75)),true);
 let sleeps=0,wakes=0;const state={};const update=now=>updateResidency(state,farMesh(mesh,residencyView(camera,75)),now,()=>sleeps++,()=>wakes++);
 update(0);update(15000);assert.equal(sleeps,1);
 camera.rotation.y=Math.PI;update(15001);assert.equal(wakes,1);assert.equal(camera.far,400);
 camera.rotation.y=0;mesh.frustumCulled=false;assert.equal(farMesh(mesh,residencyView(camera,75)),false);
});
test('scene resource accounting deduplicates geometry and texture identity',()=>{
 const manager=new RenderMemoryManager({mobile:true});manager.maintenanceMs=Infinity;
 const scene=new T.Scene(),g=new T.BoxGeometry(),t=new T.DataTexture(new Uint8Array(4*4*4),4,4),m=new T.MeshBasicMaterial({map:t});
 scene.add(new T.Mesh(g,m),new T.Mesh(g,m));manager.sweepPools([],0,scene);
 for(let i=0;i<30&&manager.accounting;i++){manager.beginFrame();manager.advanceAccounting();}
 const sample=manager.snapshot().scene;assert.ok(sample);assert.equal(sample.textureCount,1);assert.equal(sample.estimatedTextureBytes,64);
 assert.equal(sample.estimatedGeometryBytes,g.index.array.byteLength+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0));
});
test('fence protection is reenabled on a valid restored context',()=>{
 const gl={fenceSync(){return {};},clientWaitSync(){return 5;},deleteSync(){},flush(){},isContextLost(){return false;},WAIT_FAILED:5,SYNC_GPU_COMMANDS_COMPLETE:1};
 const q=new GPUFrameQueue(gl,true);q.submitted();q.canSubmit();assert.equal(q.enabled,false);q.restore(gl);assert.equal(q.enabled,true);assert.equal(q.pending.length,0);
});
test('portrait close drops old clone attachments and backing surface without touching live assets',()=>{
 const p=new EquipmentPortraitViewport(),canvas={dataset:{},width:500,height:700};let disposed=0,lost=0;
 p.renderer={dispose(){disposed++;},forceContextLoss(){lost++;}};p.canvas=canvas;p.anchors=new Map([['head',{}]]);p.attachments=new Map([['outfit',{}]]);p.player={};p.focus={};
 p.close();assert.equal(disposed,1);assert.equal(lost,1);assert.equal(canvas.width,1);assert.equal(canvas.height,1);assert.equal(p.player,null);assert.equal(p.focus,null);assert.equal(p.anchors.size,0);assert.equal(p.attachments.size,0);
});
