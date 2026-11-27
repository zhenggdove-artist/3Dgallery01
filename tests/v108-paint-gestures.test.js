import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CityWallPainter} from '../src/city-wall-painter.js';
import {SpacePainter} from '../src/space-painter.js';

const event=(id,x,y,type='pointermove')=>({pointerId:id,pointerType:'touch',clientX:x,clientY:y,type,preventDefault(){},stopImmediatePropagation(){}});
function fixture(){
 const calls=[],capture=new Set(),player={enabled:true,status:{},distance:10,orbitEditCamera:(x,y)=>calls.push(['orbit',x,y])};
 const painter=Object.assign(Object.create(CityWallPainter.prototype),{active:true,mode3D:true,paintTouches:new Map(),touchCamera:false,touchDrawing:false,touchPair:null,controller:()=>player,canvas:{setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id)},space:{end:(...args)=>calls.push(['end',...args])},paintDown:e=>calls.push(['down',e.pointerId]),paintMove:e=>calls.push(['move',e.pointerId]),paintUp:e=>calls.push(['up',e.pointerId])});
 return {painter,player,calls,capture};
}
test('two finger pinch and midpoint orbit never start a stroke or leave a ghost stroke',()=>{
 const {painter,player,calls,capture}=fixture();
 painter.touchDown(event(1,10,10,'pointerdown'));painter.touchDown(event(2,30,10,'pointerdown'));
 painter.touchMove(event(2,50,20));
 assert.ok(player.distance<10);assert.equal(calls[0][0],'orbit');
 painter.touchUp(event(2,50,20,'pointerup'));painter.touchMove(event(1,30,30));painter.touchUp(event(1,30,30,'pointerup'));
 assert.equal(capture.size,0);assert.equal(painter.touchCamera,false);assert.ok(calls.every(c=>c[0]==='orbit'));
 painter.touchDown(event(3,1,1,'pointerdown'));painter.touchUp(event(3,1,1,'pointerup'));
 assert.deepEqual(calls.slice(-2),[['down',3],['up',3]]);
});
test('single finger draws normally; adding a finger finishes intentional stroke before orbit',()=>{
 const {painter,calls}=fixture();
 painter.touchDown(event(1,10,10,'pointerdown'));painter.touchMove(event(1,15,10));
 assert.deepEqual(calls,[['down',1],['move',1]]);
 painter.touchDown(event(2,30,10,'pointerdown'));assert.deepEqual(calls.at(-1),['end',null,true]);
 painter.touchMove(event(1,25,10));assert.equal(calls.at(-1)[0],'orbit');
 painter.touchUp(event(1,25,10,'pointercancel'));painter.touchUp(event(2,30,10,'pointerup'));
 assert.equal(painter.paintTouches.size,0);
});
test('ordinary 2D paint also supports pinch; touch cancellation before drawing cannot erase',()=>{
 const {painter,calls}=fixture();painter.mode3D=false;
 painter.touchDown(event(1,5,5,'pointerdown'));painter.touchUp(event(1,5,5,'pointercancel'));assert.deepEqual(calls,[]);
 painter.touchDown(event(2,5,5,'pointerdown'));painter.touchDown(event(3,25,5,'pointerdown'));painter.touchMove(event(3,35,5));assert.equal(calls[0][0],'orbit');
});
test('landing guide uses selected brush radius and colour, projects below the cursor and reuses its mesh',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.1,200);
 camera.position.set(0,10,10);camera.lookAt(0,5,0);camera.updateMatrixWorld(true);
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
 const player={root:{position:new THREE.Vector3(0,8.5,10)},yaw:0,pitch:Math.atan(.5)};
 const painter=new SpacePainter({scene,canvas,camera,controller:()=>player});
 const arena={world:{cityDamage:{}}},settings={size:.4,color:'#ff0033',thickness:.34,distance:8};
 painter.updateGuide(null,settings,arena);const guide=painter.guide;
 assert.ok(guide.visible);assert.equal(guide.scale.x,.4);assert.equal(guide.material.color.getHexString(),'ff0033');
 assert.ok(guide.position.y>=0&&guide.position.y<10);assert.ok(Math.abs(guide.position.x)<1e-6);assert.ok(guide.position.z>0);
 painter.updateGuide(null,{...settings,size:.8,color:'#00ff00'},arena);assert.equal(painter.guide,guide);assert.equal(guide.scale.x,.8);assert.equal(guide.material.color.getHexString(),'00ff00');
 painter.hideGuide();assert.equal(guide.visible,false);
});
