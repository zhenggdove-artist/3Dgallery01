
import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_SHOP_STYLES} from '../src/shared/city-layout.js';
import {signShopKind,signPortraitSource,cleanSignHeadPixels,drawSignArtwork} from '../src/sign-art.js';

test('all city shop types resolve to the actual trade, never a random food image',()=>{
 const kinds=new Set();
 for(const [key,title,subtitle] of CITY_SHOP_STYLES){
  assert.equal(signShopKind(title+'・123號',subtitle+' / 123'),key);
  assert.equal(signShopKind('anything','anything',key),key);
  kinds.add(key);
 }
 assert.equal(kinds.size,24);
 for(const key of ['repair','laundry','electronics','pharmacy','barber','hardware','tailor','pawn','internet','clinic','flower','printing','fortune','tattoo','shoes','shipping','motel','generic']){
  assert.equal(signPortraitSource(key),'occupation');
 }
 for(const key of ['noodle','fish','tea','streetfood','rice','fruit','grocery']){
  assert.equal(signPortraitSource(key),'food-head');
 }
 assert.equal(signShopKind('商店','TEMPLE SHOP'),'generic');
});

test('paper and coloured image backdrops are transparent; enclosed light facial details are preserved',()=>{
 const W=5,H=5;
 for(const [variant,bg] of [[0,[250,205,0]],[3,[251,146,29]],[8,[185,8,12]],[6,[250,240,220]]]){
  const d=new Uint8ClampedArray(W*H*4);
  for(let i=0;i<W*H;i++)d.set([...bg,255],i*4);
  for(let y=1;y<=3;y++)for(let x=1;x<=3;x++)d.set([95,55,43,255],(y*W+x)*4);
  d.set([250,245,230,255],(2*W+2)*4);
  cleanSignHeadPixels(d,W,H,variant);
  assert.equal(d[3],0,'backdrop must be transparent');
  assert.equal(d[(2*W+2)*4+3],255,'enclosed highlights must remain');
  assert.equal(d[(W+1)*4+3],255,'skin or ink must remain');
 }
 const ink=new Uint8ClampedArray([255,255,255,255,0,0,0,255,125,125,125,255]);
 cleanSignHeadPixels(ink,3,1,5);
 assert.equal(ink[3],0);assert.equal(ink[7],255);assert.ok(ink[11]>0&&ink[11]<255);
});

test('all 24 trades render portrait and icon art in both sign orientations with a single underlying background',()=>{
 const traces=new Map();
 for(const [key,title,subtitle,color] of CITY_SHOP_STYLES)for(const vertical of [false,true])for(const style of ['portrait','icon']){
  const calls=[];
  const ctx=new Proxy({},{
   get(target,name){if(name in target)return target[name];if(name==='createRadialGradient')return ()=>({addColorStop(){}});return (...args)=>calls.push([name,...args]);},
   set(target,name,value){target[name]=value;return true;}
  });
  drawSignArtwork(ctx,0,0,96,96,{title,subtitle,color,vertical,style,seed:49,shopKind:key});
  assert.ok(calls.length>10);
  assert.equal(calls.filter(c=>c[0]==='drawImage').length,0,'no loaded image in Node; occupational fallback required');
  if(style==='portrait')assert.equal(calls.filter(c=>c[0]==='fillRect'&&c[1]===0&&c[2]===0).length,1,'no separate opaque portrait background');
  if(style==='icon'&&!vertical)traces.set(key,JSON.stringify(calls.filter(c=>!['fillText','strokeText'].includes(c[0]))));
 }
 assert.equal(new Set(traces.values()).size,24);
});
