import test from 'node:test';
import assert from 'node:assert/strict';
import {paintOwnerStrokes} from '../src/paint-composite.js';
import {applySpacePaint} from '../src/shared/space-paint.js';
import {RASTER_TILE,RASTER_BYTES,encodeSurfaceRaster,decodeSurfaceLayers,compactSurfaceRecords,surfaceRasterOwners,surfaceChartRect} from '../src/shared/space-paint-raster.js';
import {createInitialWorld,ensureProfile,applyAction} from '../src/shared/temple-rules.js';
import {CITY_LOTS,cityWallPoint} from '../src/shared/city-layout.js';
import {discPaintTarget} from '../src/shared/disc-paint.js';
const geometry={id:'stroke-owner-1',ownerKey:'alice',ownerEpoch:0,size:.5,thickness:.4,color:'#ffffff',normal:[0,0,1],points:[[-2,3,0],[2,3,0]]};
const brush=(owner,color='#112233')=>({owner,chart:0,tool:'brush',color,size:.2,points:[[.2,.5],[.8,.5]]});
const erase=owner=>({...brush(owner),size:.4,tool:'eraser',eraseOwn:true});
const rect=surfaceChartRect(RASTER_TILE,0),at=(Math.floor(rect.y+rect.h*.5)*RASTER_TILE+Math.floor(rect.x+rect.w*.5))*4;
const rgb=layer=>[...layer.pixels.slice(at,at+4)];
const checkpoint='00000000-0000-4000-8000-000000000001';
test('owner-scoped checkpoint keeps chronological runs and reveals other owners after erase',()=>{
 const first=compactSurfaceRecords(geometry,[brush('alice','#ff0000'),brush('bob','#00ff00'),brush('alice','#0000ff')],null,checkpoint);
 assert.deepEqual(surfaceRasterOwners(first.bytes),['alice','bob']);
 assert.deepEqual(decodeSurfaceLayers(first.bytes).map(rgb),[[255,0,0,255],[0,255,0,255],[0,0,255,255]]);
 const second=compactSurfaceRecords(geometry,[...first.records,erase('alice')],first.bytes,checkpoint);
 assert.deepEqual(surfaceRasterOwners(second.bytes),['bob']);assert.deepEqual(decodeSurfaceLayers(second.bytes).map(rgb),[[0,255,0,255]]);
 const third=compactSurfaceRecords(geometry,[...second.records,erase('alice')],second.bytes,checkpoint);
 assert.deepEqual(decodeSurfaceLayers(third.bytes).map(rgb),[[0,255,0,255]]);
});
test('old flattened checkpoint and unknown authors cannot be erased by a new player',()=>{
 const p=new Uint8ClampedArray(RASTER_BYTES);p.set([9,8,7,255],at);
 const next=compactSurfaceRecords(geometry,[erase('alice')],encodeSurfaceRaster(p),checkpoint);
 assert.deepEqual(surfaceRasterOwners(next.bytes),[null]);assert.deepEqual(decodeSurfaceLayers(next.bytes).map(rgb),[[9,8,7,255]]);
});
test('server stamps author and eraser scope; normal GM erase and undo cannot delete another owner or their attached graffiti',()=>{
 const actor=(key,admin=false)=>({key,admin,role:'fighter',position:[0,2,0]});
 const alice=actor('alice'),bob=actor('bob'),gm=actor('gm',true),world={profiles:{alice:{hp:100,spacePaintEnabled:true},bob:{hp:100,spacePaintEnabled:true},gm:{hp:100,admin:true}},spacePaint:[geometry],spacePaintSurface:{},revision:0};
 const act=(who,action,body)=>applySpacePaint(world,who,{action,...body});
 assert.ok(act(gm,'gm-erase-3d',{id:geometry.id}).error);
 assert.ok(act(gm,'gm-edit-3d',{remove:[geometry.id],add:[]}).error);
 assert.ok(act(bob,'paint-space-surface',{stroke:{...brush('alice'),id:geometry.id}}).spaceSurfacePainted);
 assert.ok(act(alice,'paint-space-surface',{stroke:{...erase('bob'),eraseOwn:false,id:geometry.id}}).error);
 assert.ok(act(alice,'paint-space-surface',{stroke:{...brush('bob'),id:geometry.id}}).spaceSurfacePainted);
 assert.ok(act(alice,'paint-space-surface',{stroke:{...erase('bob'),eraseOwn:false,id:geometry.id}}).spaceSurfacePainted);
 assert.deepEqual(world.spacePaintSurface[geometry.id].map(v=>[v.owner,v.eraseOwn]),[['bob',undefined],['alice',undefined],['alice',true]]);
 assert.ok(act(alice,'gm-erase-3d',{id:geometry.id}).error);
 assert.ok(act(alice,'gm-edit-3d',{remove:[geometry.id],add:[]}).error);
 const mine={...geometry,id:'stroke-owner-2'};assert.ok(act(alice,'gm-paint-3d',{stroke:mine}).spacePaintStroke);
 const removed=act(alice,'gm-erase-3d',{id:mine.id}).erasedStroke;assert.ok(removed);
 assert.ok(act(alice,'gm-edit-3d',{remove:[],add:[removed]}).spacePaintEdited);
 assert.ok(act(gm,'gm-edit-3d',{remove:[],add:[{...removed,id:'stroke-forged'}]}).error);
});
test('wall and disc eraser records are stamped by authenticated actor, not request owner',()=>{
 const world=createInitialWorld(),lot=CITY_LOTS.find(l=>l.floors>=2),point=cityWallPoint(lot,'front',.5,.8);
 const actor={key:'alice',name:'Alice',color:'#112233',role:'fighter',position:[point[0],point[1],point[2]+1]};
 ensureProfile(world,actor.key,actor.name,actor.color,Date.now(),false);
 const body={lotId:lot.id,wall:'front',tool:'eraser',owner:'bob',eraseOwn:false,color:'#123456',size:.18,points:[[.5,.8]]};
 assert.ok(applyAction(world,actor,{action:'paint-building',stroke:body}).error);
 assert.ok(applyAction(world,actor,{action:'paint-building',stroke:{...body,tool:'brush'}}).paintStroke);
 const wall=applyAction(world,actor,{action:'paint-building',stroke:body}).paintStroke;
 assert.equal(wall.owner,'alice');assert.equal(wall.eraseOwn,true);
 const key='display:platform-01',target=discPaintTarget(world,key);assert.ok(target);
 actor.position=target.position.slice();
 const discBody={...body,lotId:key,wall:'top',points:[[.5,.5]]};
 assert.ok(applyAction(world,actor,{action:'paint-disc',stroke:discBody}).error);
 assert.ok(applyAction(world,actor,{action:'paint-disc',stroke:{...discBody,tool:'brush'}}).paintStroke);
 const disc=applyAction(world,actor,{action:'paint-disc',stroke:discBody}).paintStroke;
 assert.equal(disc.owner,'alice');assert.equal(disc.eraseOwn,true);
});
class PixelContext{
 constructor(){this.canvas={width:1,height:1,ctx:this};this.pixel=null;this.globalCompositeOperation='source-over';this.stack=[];}
 save(){this.stack.push(this.globalCompositeOperation);}restore(){this.globalCompositeOperation=this.stack.pop();}
 clearRect(){this.pixel=null;}
 paint(value){if(value===null)return;switch(this.globalCompositeOperation){case 'destination-out':this.pixel=null;break;case 'destination-over':if(this.pixel===null)this.pixel=value;break;default:this.pixel=value;}}
 drawImage(canvas){this.paint(canvas.ctx.pixel);}
}
test('shared canvas compositor preserves brush order and never erases another author',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>{const c=new PixelContext();c.canvas.getContext=()=>c;return c.canvas;}};
 try{
  const ctx=new PixelContext(),draw=(c,r,mode)=>{c.save();c.globalCompositeOperation=mode;c.paint(r.color);c.restore();};
  const replay=records=>{ctx.clearRect();paintOwnerStrokes(ctx,records,draw);return ctx.pixel;};
  const a=brush('alice','red'),b=brush('bob','green'),a2=brush('alice','blue');
  assert.equal(replay([a,b,a2]),'blue');assert.equal(replay([a,b,a2,erase('alice')]),'green');
  assert.equal(replay([a,b,erase('bob')]),'red');assert.equal(replay([a,b,erase('alice'),a2]),'blue');
  assert.equal(replay([brush(null,'legacy'),erase('alice')]),'legacy');
  assert.equal(replay([a,b,{tool:'eraser',color:'black'},a2,erase('alice')]),null);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
