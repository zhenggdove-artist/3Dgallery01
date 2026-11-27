import assert from 'node:assert/strict';
import {serveLarge} from './large-assets.mjs';
const data=new TextEncoder().encode('0123456789');
const path='/models/test.glb',key='sha256/abcd';
const manifest={[path]:{key,size:data.length,type:'model/gltf-binary'}};
let calls=0;
const env={ASSETS:{fetch:async()=>new Response('static')},GGTEMPLE_LARGE_ASSETS:{
 head:async k=>{assert.equal(k,key);calls++;return {size:data.length};},
 get:async(k,options)=>{assert.equal(k,key);calls++;const r=options?.range;return {size:data.length,body:r?data.slice(r.offset,r.offset+r.length):data};}
}};
const req=(headers={},method='GET',p=path)=>serveLarge(new Request('https://test.invalid'+p,{headers,method}),env,manifest);
let r=await req();assert.equal(r.status,200);assert.equal(await r.text(),'0123456789');
r=await req({Range:'bytes=2-4'});assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 2-4/10');assert.equal(await r.text(),'234');
r=await req({Range:'bytes=-3'});assert.equal(await r.text(),'789');
r=await req({Range:'bytes=7-'});assert.equal(await r.text(),'789');
r=await req({Range:'bytes=10-'});assert.equal(r.status,416);
r=await req({Range:'bytes=-0'});assert.equal(r.status,416);
r=await req({Range:'bytes=0-1','If-Range':'"old"'});assert.equal(r.status,200);assert.equal(await r.text(),'0123456789');
r=await req({},'HEAD');assert.equal(r.status,200);assert.equal(r.headers.get('Content-Length'),'10');assert.equal(await r.text(),'');
r=await req({'If-None-Match':'"abcd"'});assert.equal(r.status,304);
r=await req({},'POST');assert.equal(r.status,405);
const before=calls;r=await req({},'GET','/arbitrary');assert.equal(await r.text(),'static');assert.equal(calls,before);
r=await serveLarge(new Request('https://test.invalid'+path),{},manifest);assert.equal(r.status,503);
console.log('Large asset handler: full GET, HEAD, ranges, conditional requests, missing storage and route isolation passed.');
