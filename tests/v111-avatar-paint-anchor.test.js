import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SpacePainter} from '../src/space-painter.js';

const settings={tool:'brush',color:'#abcdef',size:.4,thickness:.34,distance:12};
const arena={world:{cityDamage:{}}};
const event=(x,y)=>({clientX:x,clientY:y,pointerId:1,type:'pointerdown'});
const near=(a,b)=>assert.ok(a.distanceTo(b)<1e-8,a.toArray()+' != '+b.toArray());
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,200);
 const player={root:{position:new THREE.Vector3(0,8,0)},yaw:.3,pitch:-.25,distance:7};
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
 const painter=new SpacePainter({scene,canvas,camera,controller:()=>player,ui:{toast:()=>assert.fail('unexpected toast')}});
 const zoom=distance=>{player.distance=distance;camera.position.copy(player.root.position).add(new THREE.Vector3(0,2,distance));camera.lookAt(player.root.position);camera.updateMatrixWorld(true);};
 return {painter,player,camera,zoom};
}
test('avatar-anchored center and off-center paint points do not move with camera zoom or camera lag',()=>{
 const {painter,player,camera,zoom}=fixture();
 const e=event(135,85),point=new THREE.Vector3(),center=new THREE.Vector3();
 zoom(7);assert.ok(painter.setDrawingFrame(settings.distance));painter.drawingPoint(e,point);painter.drawingPoint(null,center);
 const expected=player.root.position.clone().add(new THREE.Vector3(0,1.5,0)).addScaledVector(painter.paintNormal,settings.distance);
 near(center,expected);
 painter.updateGuide(e,settings,arena);const landing=painter.guide.position.clone(),key=painter.guideKey;
 for(const d of [3,50]){
  zoom(d);camera.zoom=d===3?2:.5;camera.updateProjectionMatrix();
  painter.updateGuide(e,settings,arena);near(painter.guide.position,landing);assert.equal(painter.guideKey,key);
  assert.ok(painter.setDrawingFrame(settings.distance));const q=new THREE.Vector3();painter.drawingPoint(e,q);near(q,point);
 }
});
test('avatar translation, orientation and brush distance move the anchor; the active stroke frame stays planar',()=>{
 const {painter,player}=fixture(),a=new THREE.Vector3(),b=new THREE.Vector3();
 painter.setDrawingFrame(settings.distance);painter.drawingPoint(null,a);
 player.root.position.add(new THREE.Vector3(2,3,4));painter.setDrawingFrame(settings.distance);painter.drawingPoint(null,b);near(b,a.clone().add(new THREE.Vector3(2,3,4)));
 player.yaw+=Math.PI/2;painter.setDrawingFrame(settings.distance);painter.drawingPoint(null,a);assert.ok(a.distanceTo(b)>1);
 const initial=a.clone();painter.setDrawingFrame(settings.distance+4);painter.drawingPoint(null,b);near(b,initial.clone().addScaledVector(painter.paintNormal,4));
 player.root.position.x+=5;player.yaw+=.2;
 painter.drawingPoint(event(130,140),a);assert.ok(Math.abs(a.clone().sub(b).dot(painter.paintNormal))<1e-8);
});
test('brush start, drag, release and preview share the same fixed drawing frame',()=>{
 const {painter,zoom}=fixture(),points=[];
 painter.append=p=>points.push(p.clone());painter.finish=()=>{painter.stroke=null;};
 const e=event(135,85);zoom(7);painter.updateGuide(e,settings,arena);const guide=painter.guidePoint.clone();
 painter.down(e,settings,false);near(points[0],guide);
 zoom(50);painter.move({...e,type:'pointermove'});near(points[1],guide);
 painter.end({...e,type:'pointerup'},true);near(points[2],guide);
});
