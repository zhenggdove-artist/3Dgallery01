import test from 'node:test';
import assert from 'node:assert/strict';
import {applySpacePaint} from '../src/shared/space-paint.js';
import {surfaceInfo} from '../src/shared/space-paint-surface.js';
import {RASTER_BYTES,RASTER_TILE,encodeSurfaceRaster,decodeSurfaceRaster,rasterizeSurfaceStroke,compactSurfaceRecords,surfaceTailSize,SURFACE_TAIL_BYTES,surfaceChartRect} from '../src/shared/space-paint-raster.js';
const gm={key:'gm',admin:true,role:'fighter',position:[0,2,0]};
const stroke={ownerKey:'gm',ownerEpoch:0,id:'stroke-0001',size:.5,thickness:.4,color:'#ffaa00',normal:[0,0,1],points:[[-2,3,0],[2,3,0]]};
const brush={owner:'gm',id:stroke.id,chart:0,color:'#112233',tool:'brush',size:.2,points:[[.2,.5],[.8,.5]]};
const key='00000000-0000-4000-8000-000000000001';
test('no cumulative count or point quota on surface graffiti',()=>{
 const world={profiles:{gm:{admin:true,hp:100}},spacePaint:[stroke],spacePaintSurface:{},revision:0};
 let bytes=null,compactions=0;
 for(let i=0;i<1500;i++){
  const result=applySpacePaint(world,gm,{action:'paint-space-surface',stroke:brush});
  assert.equal(result.spaceSurfacePainted,true);
  const records=world.spacePaintSurface[stroke.id];
  if(surfaceTailSize(records)>SURFACE_TAIL_BYTES){
   const next=compactSurfaceRecords(stroke,records,bytes,key);world.spacePaintSurface[stroke.id]=next.records;bytes=next.bytes;compactions++;
  }
 }
 assert.ok(compactions>1);assert.ok(surfaceTailSize(world.spacePaintSurface[stroke.id])<=SURFACE_TAIL_BYTES);
 assert.ok(bytes.length<=RASTER_BYTES+1);assert.equal(world.spacePaintSurfaceRevision,1500);
});
test('raster checkpoint losslessly roundtrips sparse and dense pixel states; brush and eraser preserve base transparency',()=>{
 const p=new Uint8ClampedArray(RASTER_BYTES),info=surfaceInfo(stroke),rect=surfaceChartRect(RASTER_TILE,0);
 const i=(Math.floor(rect.y+rect.h*.5)*RASTER_TILE+Math.floor(rect.x+rect.w*.5))*4;
 rasterizeSurfaceStroke(p,brush,info);assert.deepEqual([...p.slice(i,i+4)],[17,34,51,255]);
 const compressed=encodeSurfaceRaster(p);assert.ok(compressed.length<RASTER_BYTES);assert.deepEqual(decodeSurfaceRaster(compressed),p);
 rasterizeSurfaceStroke(p,{...brush,tool:'eraser'},info);assert.equal(p[i+3],0);
 for(let j=0;j<p.length;j++)p[j]=(j*13+Math.floor(j/4)*3)%256;
 assert.deepEqual(decodeSurfaceRaster(encodeSurfaceRaster(p)),p);
});
test('checkpoint history is authorized for its actual geometry, restored with recent strokes, and removed with geometry',()=>{
 const world={profiles:{gm:{admin:true,hp:100}},spacePaint:[stroke],spacePaintSurface:{[stroke.id]:[{checkpoint:key,owners:['gm']},brush]},revision:0};
 const erased=applySpacePaint(world,gm,{action:'gm-erase-3d',id:stroke.id}).erasedStroke;
 assert.ok(applySpacePaint(world,gm,{action:'gm-edit-3d',remove:[],add:[erased]}).error);
 assert.ok(applySpacePaint(world,gm,{action:'gm-edit-3d',remove:[],add:[erased]},{verifySurfaceCheckpoint:(id,ref)=>id===stroke.id&&ref===key,surfaceCheckpointOwners:()=>['gm']}).spacePaintEdited);
 assert.equal(world.spacePaintSurface[stroke.id][0].checkpoint,key);
});

import {createWorldPatch,applyWorldPatch} from '../src/shared/world-patch.js';
test('negotiated surface patches contain only changed tiles and preserve deletion and legacy full-map protocol',()=>{
 const old={revision:1,serverTime:10,spacePaintSurfaceRevision:1,spacePaintSurface:{one:[brush],two:[brush]}};
 const next={...old,revision:2,serverTime:11,spacePaintSurfaceRevision:2,spacePaintSurface:{one:[{checkpoint:key}],three:[brush]}};
 const delta=createWorldPatch(old,next,false,undefined,true);
 assert.deepEqual(delta.spaceSurface,{one:[{checkpoint:key}],three:[brush],two:null});
 assert.equal(Object.hasOwn(delta.fields,'spacePaintSurface'),false);
 assert.deepEqual(applyWorldPatch(old,delta).spacePaintSurface,next.spacePaintSurface);
 assert.deepEqual(createWorldPatch(old,next).fields.spacePaintSurface,next.spacePaintSurface);
 const unchanged=createWorldPatch(next,{...next,revision:3,serverTime:12},false,undefined,true);
 assert.equal(unchanged.spaceSurface,undefined);
});
