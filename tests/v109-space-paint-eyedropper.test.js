import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SpacePainter} from '../src/space-painter.js';
import {CityWallPainter} from '../src/city-wall-painter.js';
import {readFileSync} from 'node:fs';

const stroke=(id,color,z)=>({id,color,size:.5,thickness:.4,normal:[0,0,1],points:[[-2,3,z],[2,3,z]]});
const event=(id,x=100,y=100,type='pointerup')=>({pointerId:id,pointerType:'touch',clientX:x,clientY:y,type,preventDefault(){},stopImmediatePropagation(){}});
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.1,200);
 camera.position.set(0,3,10);camera.lookAt(0,3,0);camera.updateMatrixWorld(true);
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
 const painter=new SpacePainter({scene,canvas,camera});
 return {painter,scene,camera};
}
test('nearest 3D stroke returns exact archived hex despite lighting, material tint or atlas conversion',()=>{
 const {painter,scene}=fixture();
 const far=stroke('stroke-far','#3a96f1',0),near=stroke('stroke-near','#e73b33',3);
 painter.sync({spacePaint:[far,near],spacePaintRevision:1});
 scene.add(new THREE.AmbientLight(0x0055ff,.01));
 painter.saved.material.color.set('#000000');
 assert.equal(painter.pickColor(event(1)),near.color);
 const old=painter.saved.geometry;painter.saved.geometry=old.toNonIndexed();old.dispose();
 painter.saved.material=new THREE.MeshLambertMaterial({color:'#00ff00'});
 assert.equal(painter.pickColor(event(1)),near.color);
 painter.sync({spacePaint:[far],spacePaintRevision:2});
 assert.equal(painter.pickColor(event(1)),far.color);
 assert.equal(painter.pickColor(event(1,0,0)),null);
});
test('pending visible geometry can be sampled without waiting for server acknowledgement',()=>{
 const {painter}=fixture();
 const s=stroke('stroke-pending','#24ba8c',2);
 painter.pending.set(s.id,s);painter.rebuild();
 assert.equal(painter.pickColor(event(1)),s.color);
 painter.pending.clear();painter.rebuild();assert.equal(painter.pickColor(event(1)),null);
});
function toolFixture(){
 const picked=[],capture=new Set(),player={enabled:true,status:{},distance:10,orbitEditCamera(){}};
 const painter=Object.assign(Object.create(CityWallPainter.prototype),{active:true,mode3D:true,can3D:()=>true,tool:'eyedropper',color:'#111111',colorInput:{value:'#111111'},paintTouches:new Map(),touchCamera:false,touchDrawing:false,touchPair:null,controller:()=>player,ui:{toast(){}},space:{pickColor:e=>{picked.push(e.pointerId);return '#e73b33';},hideGuide(){}},canvas:{setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)}});
 return {painter,picked,capture};
}
test('sample updates brush and palette, returns to brush without drawing, miss preserves colour and tool',()=>{
 const {painter,picked}=toolFixture();
 assert.equal(painter.pick3DColor(event(1)),true);
 assert.deepEqual(picked,[1]);assert.equal(painter.color,'#e73b33');assert.equal(painter.colorInput.value,'#e73b33');assert.equal(painter.tool,'brush');
 painter.setTool('eyedropper');painter.space.pickColor=()=>null;
 assert.equal(painter.pick3DColor(event(2)),false);assert.equal(painter.color,'#e73b33');assert.equal(painter.tool,'eyedropper');
});
test('touch eyedropper does not sample a pinch, cancellation or pointer movement',()=>{
 const {painter,picked,capture}=toolFixture();
 painter.touchDown(event(1,10,10,'pointerdown'));painter.touchMove(event(1,15,10,'pointermove'));
 painter.touchDown(event(2,30,10,'pointerdown'));painter.touchMove(event(2,40,10,'pointermove'));
 painter.touchUp(event(2));painter.touchUp(event(1));assert.deepEqual(picked,[]);
 painter.touchDown(event(3,10,10,'pointerdown'));painter.touchUp(event(3,10,10,'pointercancel'));assert.deepEqual(picked,[]);
 painter.touchDown(event(4,10,10,'pointerdown'));painter.touchUp(event(4));assert.deepEqual(picked,[4]);
 assert.equal(painter.tool,'brush');assert.equal(capture.size,0);
});
test('in-game eyedropper belongs to 3D mode rather than the native screen picker',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<div id="paint-3d-settings" hidden>\s*<button id="paint-3d-eyedropper"/);
});
