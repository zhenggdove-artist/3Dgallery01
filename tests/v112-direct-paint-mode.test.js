import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SpacePainter} from '../src/space-painter.js';
import {readFileSync} from 'node:fs';

const settings={tool:'brush',color:'#abcdef',size:.4,thickness:.34,distance:12};
const arena={world:{cityDamage:{}}};
const event=(x,y,type='pointerdown')=>({clientX:x,clientY:y,pointerId:1,type});
const near=(a,b)=>assert.ok(a.distanceTo(b)<1e-7,a.toArray()+' != '+b.toArray());
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,200);
 const player={root:{position:new THREE.Vector3(0,8,0)},yaw:0,pitch:0,distance:7};
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
 const painter=new SpacePainter({scene,canvas,camera,controller:()=>player,ui:{toast:()=>assert.fail('unexpected toast')}});
 const zoom=d=>{player.distance=d;camera.position.set(0,9.5,d);camera.lookAt(0,9.5,0);camera.updateMatrixWorld(true);};
 zoom(7);return {painter,player,camera,zoom};
}
function assertUnderPointer(point,camera,e){
 const projected=point.clone().project(camera);
 assert.ok(Math.abs((projected.x+1)*100-e.clientX)<1e-6);
 assert.ok(Math.abs((1-projected.y)*100-e.clientY)<1e-6);
}
test('default brush draws exactly under the cursor at every zoom and keeps the avatar-anchored plane',()=>{
 const {painter,camera,zoom}=fixture();
 assert.equal(painter.fixedScale,false);
 const e=event(135,85),point=new THREE.Vector3(),center=new THREE.Vector3();
 for(const d of [3,7,50]){
  zoom(d);assert.ok(painter.setDrawingFrame(settings.distance));
  assert.ok(painter.drawingPoint(e,point));assertUnderPointer(point,camera,e);
  painter.drawingPoint(null,center);near(center,new THREE.Vector3(0,9.5,-12));
  assert.ok(Math.abs(point.z+12)<1e-8);
  painter.updateGuide(e,settings,arena);near(painter.guidePoint,point);
 }
});
test('direct stroke starts at pointer, follows drag and release, not the ground marker',()=>{
 const {painter,camera}=fixture(),points=[];
 const stroke={id:'stroke-top',color:'#334455',size:.5,thickness:.4,normal:[0,0,1],points:[[-20,15,-12],[20,15,-12]]};
 painter.sync({spacePaint:[stroke],spacePaintRevision:1});
 const e=event(135,85),move=event(150,100,'pointermove'),up=event(155,110,'pointerup');
 painter.updateGuide(e,settings,arena);
 assert.ok(Math.abs(painter.guide.position.y-15.525)<1e-6);
 painter.append=p=>points.push(p.clone());painter.finish=()=>{painter.stroke=null;};
 painter.down(e,settings,false);assert.equal(painter.setFixedScale(true),false);
 painter.move(move);painter.end(up,true);
 [e,move,up].forEach((e,i)=>assertUnderPointer(points[i],camera,e));
 assert.ok(points.every(p=>Math.abs(p.z+12)<1e-8));
 assert.equal(painter.setFixedScale(true),true);
 assert.equal(painter.fixedScale,true);
});
test('idle guide stays anchored when zoom changes; fixed-scale checkbox is optional and unchecked by default',()=>{
 const {painter,zoom}=fixture();
 painter.updateGuide(null,settings,arena);const position=painter.guide.position.clone(),key=painter.guideKey;
 zoom(50);painter.updateGuide(null,settings,arena);near(painter.guide.position,position);assert.equal(painter.guideKey,key);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const input=html.match(/<button id="paint-3d-fixed-scale"[^>]*>/)?.[0];
 assert.ok(input);assert.match(input,/aria-pressed="false"/);
 const settings=html.slice(html.indexOf('<div id="paint-3d-settings"'),html.indexOf('<button data-paint-close'));
 assert.equal((settings.match(/type="checkbox"/g)||[]).length,1);
});
