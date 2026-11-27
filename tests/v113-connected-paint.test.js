import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SpacePainter,spacePaintGeometry,nearestSpacePaintPoint} from '../src/space-painter.js';
import {validateSpacePaint} from '../src/shared/space-paint.js';
import {readFileSync} from 'node:fs';

const stroke=(id,z)=>({id,color:'#334455',size:.5,thickness:.4,normal:[0,0,1],points:[[-2,9.5,z],[2,9.5,z]]});
const settings={tool:'brush',color:'#abcdef',size:.4,thickness:.34,distance:12};
const e=(x=100,y=100,type='pointerdown')=>({clientX:x,clientY:y,pointerId:1,type});
const near=(a,b)=>assert.ok(a.distanceTo(b)<1e-5,a.toArray()+' != '+b.toArray());
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,200);
 camera.position.set(0,9.5,7);camera.lookAt(0,9.5,0);camera.updateMatrixWorld(true);
 const player={root:{position:new THREE.Vector3(0,8,0)},yaw:0,pitch:0};
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
 const painter=new SpacePainter({scene,camera,canvas,controller:()=>player,ui:{toast:()=>assert.fail('unexpected toast')}});
 return painter;
}
test('nearest surface is selected in 3D rather than archive order, endpoints or padded collider',()=>{
 const {geometry,ranges}=spacePaintGeometry([stroke('stroke-far',-17),stroke('stroke-near',-10)]);
 const p=new THREE.Vector3(0,9.5,-12),out=new THREE.Vector3();
 assert.ok(nearestSpacePaintPoint(geometry,ranges,p,out));near(out,new THREE.Vector3(0,9.5,-10.2));
 const atlas=geometry.toNonIndexed();
 assert.ok(nearestSpacePaintPoint(atlas,ranges,p,out));near(out,new THREE.Vector3(0,9.5,-10.2));
 assert.equal(nearestSpacePaintPoint(geometry,[],p,out),false);
 geometry.dispose();atlas.dispose();
});
test('connected stroke starts on nearest existing surface and preserves drag delta, plane and validation',()=>{
 for(const fixed of [false,true]){
  const painter=fixture(),points=[];
  painter.sync({spacePaint:[stroke('stroke-far',-17),stroke('stroke-near',-10)],spacePaintRevision:1});
  painter.setFixedScale(fixed);assert.equal(painter.connected,false);painter.setConnected(true);
  painter.append=p=>{points.push(p.clone());painter.stroke.points.push(p.toArray().map(v=>+v.toFixed(3)));};
  let saved;painter.finish=()=>{saved=painter.stroke;painter.stroke=null;};
  const start=e(),move=e(110,95,'pointermove'),up=e(120,90,'pointerup');
  painter.setDrawingFrame(settings.distance);const from=new THREE.Vector3(),to=new THREE.Vector3();
  painter.drawingPoint(start,from);painter.drawingPoint(move,to);const delta=to.sub(from);
  painter.down(start,settings,false);assert.equal(painter.setConnected(false),false);
  near(points[0],new THREE.Vector3(0,9.5,-10.2));painter.move(move);
  near(points[1],points[0].clone().add(delta));
  painter.end(up,true);assert.ok(validateSpacePaint(saved));
  assert.equal(painter.archive.length,2);
  painter.setConnected(false);painter.down(start,settings,false);near(points[3],new THREE.Vector3(0,9.5,-12));
 }
});
test('no existing structure starts on ground, pending geometry is eligible, checkbox defaults off',()=>{
 const painter=fixture(),points=[];
 painter.setConnected(true);painter.append=p=>points.push(p.clone());painter.finish=()=>{painter.stroke=null;};
 painter.down(e(),settings,false);near(points[0],new THREE.Vector3(0,0,-12));painter.end(null,true);
 const pending=stroke('stroke-pending',-10);painter.pending.set(pending.id,pending);painter.rebuild();
 painter.down(e(),settings,false);near(points[1],new THREE.Vector3(0,9.5,-10.2));
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const input=html.match(/<input id="paint-3d-connect"[^>]*>/)?.[0];assert.ok(input);assert.match(input,/type="checkbox"/);assert.doesNotMatch(input,/\bchecked\b/);
});
