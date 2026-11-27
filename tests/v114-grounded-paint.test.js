import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SpacePainter,nearestSpacePaintPoint,spacePaintGeometry} from '../src/space-painter.js';
import {validateSpacePaint} from '../src/shared/space-paint.js';
import {readFileSync} from 'node:fs';

const settings={tool:'brush',color:'#abcdef',size:.4,thickness:.34,distance:12};
const event=(x=100,y=100,type='pointerdown')=>({clientX:x,clientY:y,pointerId:1,type});
const stroke=(id,y,z)=>({id,color:'#334455',size:.5,thickness:.4,normal:[0,0,1],points:[[-2,y,z],[2,y,z]]});
const near=(a,b)=>assert.ok(a.distanceTo(b)<1e-5,a.toArray()+' != '+b.toArray());
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,200);
 camera.position.set(0,9.5,7);camera.lookAt(0,9.5,0);camera.updateMatrixWorld(true);
 const player={root:{position:new THREE.Vector3(0,8,0)},yaw:0,pitch:0};
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
 const arena={world:{cityDamage:{}}};
 const painter=new SpacePainter({scene,camera,canvas,arena,controller:()=>player,ui:{toast:()=>assert.fail('unexpected toast')}});
 const points=[];painter.append=p=>{points.push(p.clone());painter.stroke.points.push(p.toArray().map(v=>+v.toFixed(3)));};
 let saved;painter.finish=()=>{saved=painter.stroke;painter.stroke=null;};
 return {painter,arena,points,getSaved:()=>saved};
}
test('Connect has a ground anchor even with no geometry or only a more distant structure',()=>{
 for(const strokes of [[],[stroke('stroke-remote',35,-12)]]){
  const {painter,arena,points,getSaved}=fixture();painter.setConnected(true);
  painter.sync({spacePaint:strokes,spacePaintRevision:1});
  const e=event();painter.updateGuide(e,settings,arena);
  near(painter.guidePoint,new THREE.Vector3(0,0,-12));near(painter.guideAnchor.position,painter.guidePoint);
  painter.down(e,settings,false);near(points[0],painter.guidePoint);
  painter.move(event(100,90,'pointermove'));assert.ok(points[1].y>0);
  painter.end(event(110,80,'pointerup'),true);assert.ok(validateSpacePaint(getSaved()));
 }
});
test('nearest actual surface wins over ground, preview equals start and search is not repeated during drag',()=>{
 const {painter,arena,points,getSaved}=fixture();painter.setConnected(true);
 painter.sync({spacePaint:[stroke('stroke-near',9.5,-10)],spacePaintRevision:1});
 const e=event();painter.updateGuide(e,settings,arena);
 near(painter.guidePoint,new THREE.Vector3(0,9.5,-10.2));near(painter.guideAnchor.position,painter.guidePoint);
 const key=painter.connectKey;painter.down(e,settings,false);near(points[0],painter.guidePoint);assert.equal(painter.connectKey,key);
 painter.move(event(110,90,'pointermove'));painter.updateGuide(event(110,90),settings,arena);
 near(painter.guideAnchor.position,points[1]);assert.equal(painter.connectKey,key);
 painter.end(event(120,80,'pointerup'),true);assert.ok(validateSpacePaint(getSaved()));
 painter.setConnected(false);painter.down(e,settings,false);near(points[3],new THREE.Vector3(0,9.5,-12));
 painter.hideGuide();assert.equal(painter.guideAnchor.visible,false);
});
test('ground cutoff skips farther geometry; saved geometry replacement invalidates the anchor cache',()=>{
 const {geometry,ranges}=spacePaintGeometry([stroke('stroke-remote',35,-12)]);
 const out=new THREE.Vector3(0,0,-12);
 assert.equal(nearestSpacePaintPoint(geometry,ranges,new THREE.Vector3(0,9.5,-12),out,9.5**2),false);
 near(out,new THREE.Vector3(0,0,-12));geometry.dispose();
 const {painter,arena}=fixture();painter.setConnected(true);
 painter.sync({spacePaint:[stroke('stroke-near',9.5,-10)],spacePaintRevision:1});
 painter.updateGuide(event(),settings,arena);const key=painter.connectKey;
 painter.sync({spacePaint:[],spacePaintRevision:2});
 painter.updateGuide(event(),settings,arena);assert.notEqual(painter.connectKey,key);near(painter.guidePoint,new THREE.Vector3(0,0,-12));
});
test('Distance retains its existing slider range and adds independent one-unit controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),wall=readFileSync(new URL('../src/city-wall-painter.js',import.meta.url),'utf8');
 assert.match(html,/<input id="paint-3d-distance" type="range" min="4" max="80" step="\.5" value="12"/);
 assert.match(html,/data-paint-distance-step="-1"/);assert.match(html,/data-paint-distance-step="1"/);
 assert.match(wall,/Number\(input.value\)\+Number\(button.dataset.paintDistanceStep\)/);
});
