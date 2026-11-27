import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {useStablePaintPixels,copyFlippedRows,fillPaintTile,staticPaintTexture} from '../src/paint-texture-source.js';
test('Apple touch detection includes desktop-mode iPad, without changing desktop texture path',()=>{
 assert.equal(useStablePaintPixels({userAgent:'Mozilla iPad',platform:'iPad',maxTouchPoints:5}),true);
 assert.equal(useStablePaintPixels({userAgent:'Mozilla Macintosh',platform:'MacIntel',maxTouchPoints:5}),true);
 assert.equal(useStablePaintPixels({userAgent:'Mozilla Macintosh',platform:'MacIntel',maxTouchPoints:0}),false);
 assert.equal(useStablePaintPixels({userAgent:'Android',platform:'Linux',maxTouchPoints:5}),false);
});
test('RGBA atlas tiles preserve original RGB, alpha, vertical orientation and adjacent colors',()=>{
 const pixels=new Uint8Array(4*4*4);
 fillPaintTile(pixels,4,0,0,2,'#ee2299');fillPaintTile(pixels,4,2,2,2,'#23c456');
 const source=new Uint8ClampedArray([1,2,3,255,4,5,6,255,7,8,9,255,10,11,12,255]);
 copyFlippedRows(source,2,2,pixels,4,2,0);
 const at=(x,y)=>Array.from(pixels.subarray((y*4+x)*4,(y*4+x)*4+4));
 assert.deepEqual(at(0,0),[238,34,153,255]);assert.deepEqual(at(2,2),[35,196,86,255]);
 assert.deepEqual(at(2,0),[7,8,9,255]);assert.deepEqual(at(3,1),[4,5,6,255]);
});
test('static outfit keeps an independent pixel source, same filtering and alpha; invalid readback retains original canvas',()=>{
 const source=new Uint8ClampedArray([1,2,3,255,4,5,6,128]);
 const canvas={width:1,height:2,getContext:()=>({getImageData:()=>({data:source})})};
 const texture=staticPaintTexture(THREE,canvas,true);
 assert.equal(texture.isDataTexture,true);assert.deepEqual(Array.from(texture.image.data),[4,5,6,128,1,2,3,255]);
 assert.equal(texture.image.width,1);assert.equal(texture.image.height,2);assert.equal(texture.flipY,false);assert.equal(texture.generateMipmaps,true);assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(texture.colorSpace,THREE.SRGBColorSpace);
 assert.equal(canvas.width,0);source.fill(0);assert.equal(texture.image.data[3],128);
 const npot={width:3,height:5};assert.equal(staticPaintTexture(THREE,npot,true).isCanvasTexture,true);
 const failed={width:1,height:1,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(4)})})};
 assert.equal(staticPaintTexture(THREE,failed,true).isCanvasTexture,true);assert.equal(failed.width,1);
});
