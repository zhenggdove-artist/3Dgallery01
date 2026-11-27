import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SpacePainter,closestSurfaceHit} from '../src/space-painter.js';
import {replaySurfaceInk,SpacePaintTexture} from '../src/space-paint-texture.js';

const brush=(points,owner='alice',color='#ff0000')=>({tool:'brush',chart:0,size:.15,color,owner,points});
test('growing brush draws only new samples and duplicate acknowledgement draws nothing',()=>{
 const ctx={canvas:{width:256,height:256},clearRect(){clears++;}},calls=[];let clears=0;
 const draw=(c,p,mode,start)=>calls.push({mode,start,count:p.points.length-start});
 const previous=Array.from({length:10},()=>brush([[.2,.2],[.3,.3]]));
 const active=brush([[.1,.1]]);let state=replaySurfaceInk(ctx,null,[...previous,active],draw);
 assert.equal(clears,1);assert.equal(calls.length,11);calls.length=0;
 for(let i=1;i<=99;i++){active.points.push([i/100,.4]);state=replaySurfaceInk(ctx,state,[...previous,active],draw);}
 assert.equal(clears,1);assert.equal(calls.length,99);assert.ok(calls.every(c=>c.count===1&&c.mode==='source-over'));
 const ack=structuredClone(active);assert.equal(replaySurfaceInk(ctx,state,[...previous,ack],draw),state);assert.equal(calls.length,99);
 const next=brush([[.2,.6]]);state=replaySurfaceInk(ctx,state,[...previous,ack,next],draw);assert.equal(calls.at(-1).start,0);assert.equal(clears,1);
 replaySurfaceInk(ctx,state,[...previous,ack],draw);assert.equal(clears,2,'rejection removes the optimistic ink through complete replay');
});
test('optimized drawing calls the same clipped, wrapped ellipse stamps as full replay',()=>{
 const make=()=>{const stamps=[];return {stamps,ctx:{canvas:{width:256,height:256},clearRect(){stamps.length=0;},save(){},restore(){},beginPath(){},rect(){},clip(){},ellipse(...v){stamps.push(v);},fill(){}}};};
 const info={total:12,circumference:3,a:.5,b:.3},tile={tile:256,rect:SpacePaintTexture.prototype.rect};
 const a=make(),b=make(),s=brush([[.1,.99]]),draw=(ctx,p,mode,start)=>SpacePaintTexture.prototype.drawInk.call(tile,p,info,ctx,mode,start);
 let state=replaySurfaceInk(a.ctx,null,[s],draw);
 for(const p of [[.12,.01],[.2,.08],[.22,.94],[.27,.9]]){s.points.push(p);state=replaySurfaceInk(a.ctx,state,[s],draw);}
 replaySurfaceInk(b.ctx,null,[s],draw);assert.deepEqual(a.stamps,b.stamps);
});
test('bounded exact ray query agrees with original full Three raycast before and after atlas conversion',()=>{
 const painter=new SpacePainter({scene:new THREE.Scene(),canvas:{},camera:new THREE.PerspectiveCamera()});
 const strokes=Array.from({length:48},(_,i)=>({id:'stroke-'+i,color:'#ee00cc',size:.3+i%3*.1,thickness:.4,normal:[0,0,1],points:Array.from({length:24},(_,j)=>[-5+j*.4,2+(i%6)*.9+Math.sin(j*.3)*.1,Math.floor(i/6)*2])}));
 painter.sync({spacePaint:strokes,spacePaintRevision:1});
 for(let pass=0;pass<2;pass++){
  for(let i=0;i<160;i++){
   painter.ray.set(new THREE.Vector3(-6+(i%20)*.65,1.5+(i%13)*.47,18),new THREE.Vector3(0,0,-1));
   const a=painter.nearestHit(),b=closestSurfaceHit(painter.pages,painter.ray);
   assert.equal(b?.range.id,a?.range.id);
   if(a){assert.equal(b.hit.faceIndex,a.hit.faceIndex);assert.ok(b.hit.point.distanceTo(a.hit.point)<1e-7);}
  }
  if(pass===0)for(const page of painter.pages){const old=page.mesh.geometry;page.mesh.geometry=old.toNonIndexed();old.dispose();}
 }
});
