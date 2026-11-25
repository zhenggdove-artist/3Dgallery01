import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {houseTileTexture,houseWallMaterial,createGmHouseMesh,disposeGmHouseMesh} from '../src/build-style.js';
import {installFacadeCracks} from '../src/city-ruins-vfx.js';
import {GM_HOUSE_DEFAULT} from '../src/shared/arena.js';
test('staggered tiles use identical cached DOM-independent pixel data and mipmaps',()=>{
 const t=houseTileTexture();assert.equal(t,houseTileTexture());assert.equal(t.image.width,512);assert.equal(t.image.height,256);assert.equal(t.image.data.length,512*256*4);assert.ok(t.generateMipmaps);assert.equal(t.wrapS,T.RepeatWrapping);
 const red=(x,y)=>t.image.data[(y*512+x)*4];
 assert.ok(red(0,20)<red(128,20)-30);assert.ok(red(128,84)<red(0,84)-30);
 const m=houseWallMaterial();assert.equal(m.map,t);m.dispose();
 const root=createGmHouseMesh(GM_HOUSE_DEFAULT);assert.ok(root.children.length>10);assert.equal(root.userData.gmHouseMaterials[0].map,t);disposeGmHouseMesh(root);
});
test('facade cracks retain old invocation and bind shared tile material in shader',()=>{
 const m=new T.MeshStandardMaterial(),facade=installFacadeCracks({material:m}),shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};m.onBeforeCompile(shader);
 assert.equal(shader.uniforms.uHouseTile.value,houseTileTexture());assert.equal(shader.uniforms.uCityDamage.value,facade.texture);assert.match(shader.vertexShader,/vCityTile=cityTile/);assert.match(shader.fragmentShader,/texture2D\(uHouseTile/);
 m.dispose();facade.texture.dispose();
});
test('tile luminance preserves each original facade hue and house instance tint',()=>{
 const texture=houseTileTexture(),data=texture.image.data;for(let i=0;i<data.length;i+=4){assert.equal(data[i],data[i+1]);assert.equal(data[i],data[i+2]);}
 const a=houseWallMaterial('#a56854'),b=houseWallMaterial('#687676');assert.equal(a.map,b.map);assert.equal(a.color.getHexString(),'a56854');assert.equal(b.color.getHexString(),'687676');
 const material=new T.MeshStandardMaterial(),facade=installFacadeCracks({material}),shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};material.onBeforeCompile(shader);
 assert.ok(shader.fragmentShader.includes('diffuseColor.rgb*=mix(1.,tile,.85)'));assert.ok(!shader.fragmentShader.includes('mix(diffuseColor.rgb,tile'));
 a.dispose();b.dispose();material.dispose();facade.texture.dispose();
});
