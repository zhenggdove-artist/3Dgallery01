import test from 'node:test';
import assert from 'node:assert/strict';
import {CityWallPainter} from '../src/city-wall-painter.js';
import {readFileSync} from 'node:fs';

function fixture(){
 const calls=[],player={paintFlight:true,enabled:true,role:'fighter',status:{},yaw:.4,pitch:.2,distance:7,root:{rotation:{y:-.3},position:{x:1,y:2,z:3}},updateCamera:(...args)=>calls.push(args)};
 const painter=Object.assign(Object.create(CityWallPainter.prototype),{mode3D:true,can3D:()=>true,space:{pointer:null},controller:()=>player});
 return {painter,player,calls};
}
test('90 degree turns rotate camera and avatar together without translating or changing pitch/zoom',()=>{
 const {painter,player,calls}=fixture();
 assert.equal(painter.turn3D(1),true);
 assert.equal(player.yaw,.4+Math.PI/2);assert.equal(player.root.rotation.y,-.3+Math.PI/2);
 assert.equal(painter.turn3D(-1),true);
 assert.ok(Math.abs(player.yaw-.4)<1e-12);assert.ok(Math.abs(player.root.rotation.y+.3)<1e-12);
 assert.deepEqual(player.root.position,{x:1,y:2,z:3});assert.equal(player.pitch,.2);assert.equal(player.distance,7);
 assert.deepEqual(calls,[[0,true],[0,true]]);
 for(let n=0;n<4;n++)painter.turn3D(1);
 assert.ok(Math.abs(player.yaw-.4-2*Math.PI)<1e-12);
 assert.ok(Math.abs(player.root.rotation.y+.3-2*Math.PI)<1e-12);
});
test('rotation cannot interfere with active strokes, revoked access, disabled flight or combat immobilization',()=>{
 const {painter,player,calls}=fixture();
 painter.space.pointer=3;assert.equal(painter.turn3D(1),false);painter.space.pointer=null;
 painter.can3D=()=>false;assert.equal(painter.turn3D(1),false);painter.can3D=()=>true;
 painter.mode3D=false;assert.equal(painter.turn3D(1),false);painter.mode3D=true;
 player.paintFlight=false;assert.equal(painter.turn3D(1),false);player.paintFlight=true;
 player.status.freeze=true;assert.equal(painter.turn3D(1),false);player.status.freeze=false;
 player.enabled=false;assert.equal(painter.turn3D(1),false);player.enabled=true;
 assert.equal(painter.turn3D(0),false);assert.equal(player.yaw,.4);assert.equal(player.root.rotation.y,-.3);assert.deepEqual(calls,[]);
});
test('both rotation buttons are inside the hidden 3D flight toolbar, independent of translation axes',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const toolbar=html.match(/<div id="paint-3d-flight"[^>]*hidden>[^]*?<\/div>/)?.[0];
 assert.ok(toolbar);assert.equal((toolbar.match(/data-paint-axis=/g)||[]).length,6);
 assert.match(toolbar,/data-paint-turn="1" aria-label="Turn left 90 degrees"/);
 assert.match(toolbar,/data-paint-turn="-1" aria-label="Turn right 90 degrees"/);
});
