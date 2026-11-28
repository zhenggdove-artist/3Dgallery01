import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gmPreviewDimensions,gmPreviewMediaMatches,gmPreviewUnits,gmMobilePreviewActive,previewLocalRect,GM_PHONE_REFERENCE,viewScale} from '../src/gm-mobile-preview.js';
test('reference Safari logical viewport stays fixed while the 9:16 frame scales and centers',()=>{
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7);
 for(const [w,h] of [[1920,1080],[1280,720],[600,400],[400,250],[800,150]]){
  const v=gmPreviewDimensions(w,h);
  assert.equal(v.width,375);assert.equal(v.height,628);
  close(v.displayWidth*16,v.frameHeight*9);
  assert.ok(v.displayWidth<=w+1e-7&&v.frameHeight+48<=h+1e-7);
  close(v.clientLeft*2+v.displayWidth,w);close(v.frameTop*2+v.frameHeight+48,h);
  close(v.displayHeight/v.displayWidth,628/375);
  close(v.clientTop+(v.displayHeight/2),v.frameTop+v.frameHeight/2);
 }
 assert.equal(GM_PHONE_REFERENCE.width,375);
 assert.equal(gmPreviewDimensions(1920,1080).scale,1.2);
 assert.equal(gmMobilePreviewActive(),false);assert.equal(viewScale(),1);
});
test('existing coarse-pointer mobile portrait CSS is selected at the simulated width',()=>{
 const match=q=>gmPreviewMediaMatches(q,375,628,()=>false);
 assert.equal(match('(max-width: 720px), (pointer: coarse)'),true);
 assert.equal(match('(pointer: coarse) and (orientation: landscape) and (min-width: 601px)'),false);
 assert.equal(match('(min-width: 840px) and (min-height: 650px)'),false);
 assert.equal(match('(max-width: 600px) and (orientation: portrait)'),true);
 assert.equal(match('(pointer: fine)'),false);
 assert.equal(match('(any-pointer: coarse)'),true);
 assert.equal(match('(prefers-reduced-motion: reduce)'),false);
});
test('viewport units track simulated width and height without modifying other values',()=>{
 assert.equal(gmPreviewUnits('calc(100vw - 24px)',375,628),'calc(375px - 24px)');
 assert.equal(gmPreviewUnits('max(12px, 40dvh)',375,628),'max(12px, 251.2px)');
 assert.equal(gmPreviewUnits('10vmin 10vmax -2.5vw',375,628),'37.5px 62.8px -9.375px');
 assert.equal(gmPreviewUnits('env(safe-area-inset-bottom) 50%',375,628),'env(safe-area-inset-bottom) 50%');
});
test('GM preview is local, has an independent exit, and uses the same live renderer',()=>{
 const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(ui,/data-gm-action="mobile-preview"/);
 assert.match(ui,/action==='mobile-preview'.*setGmMobilePreview/);
 assert.match(main,/camera\.aspect=viewWidth\(\)\/viewHeight\(\)/);
 assert.match(main,/renderer\.setSize\(viewWidth\(\),viewHeight\(\),false\)/);
 assert.match(index,/"src\/gm-mobile-preview\.js"/);
});

test('centered frame converts DOM client bounds to local HUD coordinates without altering desktop bounds',()=>{
 const rect={left:746,top:137,right:846,bottom:187,width:100,height:50};
 assert.deepEqual(previewLocalRect(rect,735,116),{left:11,top:21,right:111,bottom:71,width:100,height:50});
 assert.deepEqual(previewLocalRect({left:740,top:126,right:790,bottom:151,width:50,height:25},735,116,.5),{left:10,top:20,right:110,bottom:70,width:100,height:50});
 assert.equal(previewLocalRect(rect),rect);
 const a=gmPreviewDimensions(1280,720),b=gmPreviewDimensions(1400,720);
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.equal(b.clientLeft-a.clientLeft,60);
 const source=readFileSync(new URL('../src/gm-mobile-preview.js',import.meta.url),'utf8');
 assert.match(source,/view\.scale===next\.scale&&view\.clientLeft===next\.clientLeft&&view\.clientTop===next\.clientTop/);
});
