import test from 'node:test';
import assert from 'node:assert/strict';
import {applySpacePaint} from '../src/shared/space-paint.js';
import {surfaceFace,surfaceInfo} from '../src/shared/space-paint-surface.js';
import {createInitialWorld,validateState,worldView} from '../src/shared/temple-rules.js';
import {spacePaintGeometry} from '../src/space-painter.js';
const gm={key:'gm',admin:true,role:'fighter',position:[0,2,0]},player={key:'firebase:player',role:'fighter',position:[0,2,0]},other={key:'other',role:'fighter',position:[0,2,0]};
const stroke=id=>({id,color:'#ee00cc',size:.5,thickness:.4,normal:[0,0,1],points:[[-2,3,0],[2,3,0]]});
function fixture(){const w=createInitialWorld();for(const a of [gm,player,other])w.profiles[a.key]={key:a.key,admin:!!a.admin,hp:100};return [w,(a,action,data={})=>applySpacePaint(w,a,{action,...data})];}
test('persisted grant, owner isolation, revoke and purge epoch prevent old history restoring deleted strokes',()=>{
 const [w,act]=fixture(),targetKey=player.key;
 assert.ok(act(player,'gm-paint-3d',{stroke:stroke('stroke-0001')}).error);
 assert.ok(act(other,'gm-space-paint-access',{targetKey,enabled:true}).error);
 assert.equal(act(gm,'gm-space-paint-access',{targetKey,enabled:true}).spacePaintAccess,true);
 const s=act(player,'gm-paint-3d',{stroke:{...stroke('stroke-0001'),ownerKey:gm.key}}).spacePaintStroke;
 assert.equal(s.ownerKey,player.key);
 act(gm,'gm-paint-3d',{stroke:stroke('stroke-0002')});
 assert.ok(act(player,'gm-erase-3d',{id:'stroke-0002'}).error);
 assert.ok(act(player,'gm-edit-3d',{remove:['stroke-0002'],add:[]}).error);
 act(gm,'gm-space-paint-access',{targetKey,enabled:false});
 assert.ok(act(player,'gm-erase-3d',{id:s.id}).error);assert.equal(w.spacePaint.length,2);
 assert.equal(act(gm,'gm-space-paint-clear',{targetKey}).spacePaintCleared,1);
 act(gm,'gm-space-paint-access',{targetKey,enabled:true});
 assert.ok(act(player,'gm-edit-3d',{remove:[],add:[s]}).error);assert.equal(w.spacePaint.length,1);
 assert.ok(act(player,'gm-paint-3d',{stroke:stroke('stroke-0003'),ownerEpoch:0}).error);
 assert.ok(act(player,'gm-paint-3d',{stroke:stroke('stroke-0004'),ownerEpoch:1}).spacePaintStroke);
});
test('ordinary player graffiti, reach, caps, eraser and deletion synchronization',()=>{
 const [w,act]=fixture(),s=act(gm,'gm-paint-3d',{stroke:stroke('stroke-0001')}).spacePaintStroke;
 const raw={id:s.id,chart:0,color:'#112233',size:.1,tool:'brush',points:[[.5,.5],[.6,.5]]};
 assert.equal(act(other,'paint-space-surface',{stroke:raw}).spaceSurfacePainted,true);
 assert.ok(act({...other,position:[100,2,100]},'paint-space-surface',{stroke:raw}).error);
 assert.equal(act(other,'paint-space-surface',{stroke:{...raw,chart:2,tool:'eraser'}}).spaceSurfacePainted,true);
 assert.equal(w.spacePaintRevision,1);assert.equal(w.spacePaintSurfaceRevision,2);
 const erased=act(gm,'gm-erase-3d',{id:s.id}).erasedStroke;assert.equal(erased.graffiti.length,2);assert.equal(w.spacePaintSurface[s.id],undefined);
 assert.equal(act(gm,'gm-edit-3d',{remove:[],add:[erased]}).spacePaintEdited,true);assert.equal(w.spacePaintSurface[s.id].length,2);
 act(gm,'gm-space-paint-clear',{targetKey:gm.key});assert.equal(w.spacePaint.length,0);assert.equal(w.spacePaintSurface[s.id],undefined);
});
test('surface chart topology matches the existing indexed mesh including single dots',()=>{
 for(const s of [stroke('stroke-0001'),{...stroke('stroke-0002'),points:[[0,3,0]]}]){
  const info=surfaceInfo(s),{geometry,ranges}=spacePaintGeometry([s]);
  assert.equal(info.sideFaces+24,geometry.index.count/3);assert.equal(ranges[0].info.sideFaces,info.sideFaces);
  for(let i=0;i<geometry.index.count/3;i++)assert.ok(surfaceFace(info,i).uv.flat().every(v=>v>=0&&v<=1));
  geometry.dispose();
 }
});
test('granted flight and descent after revoke are bounded',()=>{
 const pose=(y,paintFlight)=>({position:[0,y,0],rotation:0,paintFlight});
 assert.ok(validateState(pose(64),pose(65,true),100,'fighter',null,null,Date.now(),{spacePaintEnabled:true}).state);
 assert.equal(validateState(pose(64),pose(65,true),100,'fighter',null,null,Date.now(),{}).error,'Invalid position');
 assert.ok(validateState(pose(100),pose(99),100,'fighter',null,null,Date.now(),{}).state);
});
