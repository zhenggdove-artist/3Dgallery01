import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {TERRAIN_DEFAULTS,terrainStyle,setTerrainStyle,terrainColorDelta} from '../src/shared/terrain-style.js';
import {GrassField} from '../src/grass-field.js';
import {createWorldPatch,applyWorldPatch} from '../src/shared/world-patch.js';
test('legacy terrain uses exact original colors and grass length, with no mutations',()=>{
 assert.deepEqual(terrainStyle({skyBaseColor:'#123456'}),TERRAIN_DEFAULTS);
 for(const key of ['grassColor','floorColor','meadowColor'])assert.deepEqual(terrainColorDelta(TERRAIN_DEFAULTS[key],TERRAIN_DEFAULTS[key]),[0,0,0]);
});
test('GM terrain validation is atomic, persists independent values and preserves sky',()=>{
 const w={environment:{skyBaseColor:'#123456'},revision:4};
 assert.equal(setTerrainStyle(w,false,{grassColor:'#ff0000'}).error,'GM only');
 assert.equal(w.revision,4);assert.equal(setTerrainStyle(w,true,{grassColor:'#ff0000',grassLength:10}).error,'Grass length must be 10–300%');
 assert.equal(w.revision,4);assert.equal(setTerrainStyle(w,true,{floorColor:'red'}).error,'Invalid floorColor');
 const draft={meadowColor:'#aabbcc',grassColor:'#dd2233',floorColor:'#112233',grassLength:2.25};
 const result=setTerrainStyle(w,true,draft);assert.deepEqual(result.environment.terrain,{...TERRAIN_DEFAULTS,...draft});assert.equal(w.environment.skyBaseColor,'#123456');assert.equal(w.revision,5);
 const next=setTerrainStyle(w,true,{grassLength:.2});assert.equal(next.environment.terrain.grassColor,draft.grassColor);assert.equal(next.environment.terrain.grassLength,.2);
 const previous={revision:4,serverTime:1,environment:{skyBaseColor:'#123456'}},current={revision:5,serverTime:2,environment:result.environment};
 assert.deepEqual(applyWorldPatch(previous,createWorldPatch(previous,current)).environment,result.environment);
});
test('grass editing changes only uniforms; meshes, instance buffers, counts, wind, and canopy persist',()=>{
 const scene=new THREE.Scene(),field=new GrassField(scene,{mobile:true,count:20});
 const material=field.mesh.material,geo=field.mesh.geometry,outer=field.outerMesh.geometry,canopy=field.canopy.material,position=geo.getAttribute('aOffset');
 const total=scene.children.length,outerCount=outer.instanceCount;
 field.setTerrainStyle({terrain:{meadowColor:'#ff0000',grassColor:'#ffffff',floorColor:'#0000ff',grassLength:2}});
 assert.equal(material.uniforms.uGrassLength.value,2);assert.notDeepEqual(material.uniforms.uGrassDelta.value.toArray(),[0,0,0]);
 assert.notDeepEqual(canopy.uniforms.uMeadowDelta.value.toArray(),[0,0,0]);assert.notDeepEqual(canopy.uniforms.uFloorDelta.value.toArray(),[0,0,0]);
 assert.equal(field.mesh.material,material);assert.equal(field.outerMesh.material,material);assert.equal(field.mesh.geometry,geo);assert.equal(geo.getAttribute('aOffset'),position);assert.equal(geo.instanceCount,20);assert.equal(outer.instanceCount,outerCount);assert.equal(scene.children.length,total);
 field.update(3,new Map([['p',{visible:true,position:new THREE.Vector3(1,0,2)}]]));assert.equal(material.uniforms.uTime.value,3);assert.equal(material.uniforms.uPlayerCount.value,1);
 field.setTerrainStyle({});assert.equal(material.uniforms.uGrassLength.value,1);assert.deepEqual(material.uniforms.uGrassDelta.value.toArray(),[0,0,0]);assert.deepEqual(canopy.uniforms.uFloorDelta.value.toArray(),[0,0,0]);field.dispose();
});
test('GM entry, immediate preview and cancellation are wired independently of sky',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');const ui=read('src/ui.js'),main=read('src/main.js'),rules=read('src/shared/temple-rules.js');
 for(const token of ['data-terrain-tab','data-terrain-length','data-terrain-save','terrain-style-floating'])assert.ok(ui.includes(token));
 assert.ok(main.includes("ui.addEventListener('terrain-preview'"));assert.ok(main.includes("sendAction('gm-terrain-style'"));assert.ok(main.includes("ui.panelName!=='terrain-style'&&terrainPreview!==null"));assert.ok(rules.includes("setTerrainStyle(world,profile.admin&&actor.admin===true,body.terrain)"));
});

test('V136 meadow settings validate atomically, preserve independent values and support old saves',()=>{
 const w={environment:{terrain:{grassLength:1.7,grassColor:'#112233'},skyBaseColor:'#123456'},revision:5};
 const before=JSON.stringify(w);
 for(const bad of [{flowerDensity:1.1},{grassWidth:0},{windSpeed:NaN},{grassPushRadius:0},{flowerBlue:'red'}]){assert.ok(setTerrainStyle(w,true,bad).error);assert.equal(JSON.stringify(w),before);}
 assert.ok(setTerrainStyle(w,false,{flowerDensity:.2}).error);assert.equal(JSON.stringify(w),before);
 const change={grassDensity:.42,grassWidth:1.2,windSpeed:.6,windStrength:1.4,grassPushRadius:3,grassPushStrength:1.5,flowerDensity:.8,flowerSize:1.25,flowerYellow:'#ffcc22',flowerPurple:'#aa44ff',flowerBlue:'#4466ff'};
 const r=setTerrainStyle(w,true,change);assert.deepEqual(r.environment.terrain,{...TERRAIN_DEFAULTS,grassLength:1.7,grassColor:'#112233',...change});assert.equal(w.environment.skyBaseColor,'#123456');
});
test('V136 vegetation shares wind and player uniforms, density does not replace buffers and disposal removes all meshes',()=>{
 const scene=new THREE.Scene(),f=new GrassField(scene,{mobile:true,count:1000});
 const g=f.mesh.geometry,b=g.getAttribute('aOffset'),flower=f.flowerMesh.material.uniforms,grass=f.mesh.material.uniforms;
 assert.equal(flower.uPlayers,grass.uPlayers);assert.equal(flower.uTime,grass.uTime);assert.equal(flower.uPushRadius,grass.uPushRadius);
 assert.ok(f.flowerMesh.geometry.instanceCount>0);
 f.setTerrainStyle({terrain:{grassDensity:.5,flowerDensity:0,windSpeed:.7,grassPushRadius:3,grassPushStrength:1.4,flowerBlue:'#0000ff'}});
 assert.equal(f.mesh.geometry,g);assert.equal(g.getAttribute('aOffset'),b);assert.ok(g.instanceCount>450&&g.instanceCount<550);
 assert.equal(f.flowerMesh.geometry.instanceCount,0);assert.equal(f.outerFlowerMesh.geometry.instanceCount,0);assert.equal(grass.uPushRadius.value,3);assert.deepEqual(flower.uFlowerBlue.value.toArray(),[0,0,1]);
 f.setTerrainStyle({});assert.equal(g.instanceCount,1000);assert.ok(f.flowerMesh.geometry.instanceCount>0);f.dispose();assert.equal(scene.children.length,0);
});
