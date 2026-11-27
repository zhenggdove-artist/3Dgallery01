import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SpacePainter,spacePaintGeometry,spacePaintGuideHeight} from '../src/space-painter.js';

const stroke=(id,y,z=0)=>({id,color:'#ff0033',size:.5,thickness:.4,normal:[0,0,1],points:[[-2,y,z],[2,y,z]]});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,actual+' != '+expected);
test('highest actual tube surface wins independently of draw height, order and atlas indexing',()=>{
 const {geometry,ranges}=spacePaintGeometry([stroke('stroke-high',12),stroke('stroke-low',4),stroke('stroke-other',20,4)]);
 near(spacePaintGuideHeight(geometry,ranges,0,0,0),12.5);
 near(spacePaintGuideHeight(geometry,ranges,0,4,0),20.5);
 near(spacePaintGuideHeight(geometry,ranges,0,2,0),0);
 near(spacePaintGuideHeight(geometry,ranges,0,0,15),15);
 const atlasGeometry=geometry.toNonIndexed();
 near(spacePaintGuideHeight(atlasGeometry,ranges,0,0,0),12.5);
 atlasGeometry.dispose();geometry.dispose();
});
test('dot, horizontal thickness and empty ground use actual visual geometry, not padded actor collision',()=>{
 const dot={...stroke('stroke-dot',3),points:[[0,3,0]]};
 const horizontal={...stroke('stroke-flat',7,2),normal:[0,1,0],thickness:2};
 const {geometry,ranges}=spacePaintGeometry([dot,horizontal]);
 near(spacePaintGuideHeight(geometry,ranges,0,0,0),3.5);
 near(spacePaintGuideHeight(geometry,ranges,0,2,0),8);
 near(spacePaintGuideHeight(geometry,ranges,5,2,0),0);
 geometry.dispose();
});
test('guide rises above saved and active structures, falls after removal, and preserves position, colour, size and cache',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.1,200);
 camera.position.set(0,2,8);camera.lookAt(0,2,0);camera.updateMatrixWorld(true);
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
 const painter=new SpacePainter({scene,camera,canvas});
 const settings={size:.4,color:'#abcdef',thickness:.34,distance:8},arena={world:{cityDamage:{}}};
 painter.sync({spacePaint:[stroke('stroke-high',12)],spacePaintRevision:1});
 painter.updateGuide(null,settings,arena);const guide=painter.guide,key=painter.guideKey;
 near(guide.position.y,12.525);near(guide.position.x,0);near(guide.position.z,0);
 painter.updateGuide(null,settings,arena);assert.equal(painter.guideKey,key);
 painter.mesh('preview',[stroke('stroke-preview',15)]);painter.updateGuide(null,settings,arena);near(guide.position.y,15.525);
 painter.mesh('preview',[]);painter.updateGuide(null,settings,arena);near(guide.position.y,12.525);
 painter.sync({spacePaint:[],spacePaintRevision:2});painter.updateGuide(null,settings,arena);
 near(guide.position.y,.025);assert.equal(painter.guide,guide);assert.equal(guide.scale.x,.4);assert.equal(guide.material.color.getHexString(),'abcdef');
});
