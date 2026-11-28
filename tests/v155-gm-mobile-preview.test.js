import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gmPreviewDimensions,gmPreviewMediaMatches,gmPreviewUnits,gmMobilePreviewActive,previewLocalRect} from '../src/gm-mobile-preview.js';
test('9:16 portrait phone-scale viewport fits the browser and reserves the exit control',()=>{
 for(const [w,h] of [[1920,1080],[1280,720],[600,400],[400,250],[800,150]]){
  const v=gmPreviewDimensions(w,h);
  assert.equal(v.width*16,v.height*9);assert.ok(v.width<=w&&v.height+48<=h);
  assert.equal(v.clientLeft*2+v.width,w);assert.equal(v.clientTop*2+v.height+48,h);
 }
 assert.deepEqual(gmPreviewDimensions(1280,720),{width:378,height:672,offsetLeft:0,offsetTop:0,clientLeft:451,clientTop:0});
 assert.deepEqual(gmPreviewDimensions(1920,1080),{width:450,height:800,offsetLeft:0,offsetTop:0,clientLeft:735,clientTop:116});
 assert.deepEqual(gmPreviewDimensions(390,844),{width:387,height:688,offsetLeft:0,offsetTop:0,clientLeft:1.5,clientTop:54});
 assert.equal(gmMobilePreviewActive(),false);
});
test('existing coarse-pointer mobile portrait CSS is selected at the simulated width',()=>{
 const match=q=>gmPreviewMediaMatches(q,450,800,()=>false);
 assert.equal(match('(max-width: 720px), (pointer: coarse)'),true);
 assert.equal(match('(pointer: coarse) and (orientation: landscape) and (min-width: 601px)'),false);
 assert.equal(match('(min-width: 840px) and (min-height: 650px)'),false);
 assert.equal(match('(max-width: 600px) and (orientation: portrait)'),true);
 assert.equal(match('(pointer: fine)'),false);
 assert.equal(match('(any-pointer: coarse)'),true);
 assert.equal(match('(prefers-reduced-motion: reduce)'),false);
});
test('viewport units track simulated width and height without modifying other values',()=>{
 assert.equal(gmPreviewUnits('calc(100vw - 24px)',450,800),'calc(450px - 24px)');
 assert.equal(gmPreviewUnits('max(12px, 40dvh)',450,800),'max(12px, 320px)');
 assert.equal(gmPreviewUnits('10vmin 10vmax -2.5vw',450,800),'45px 80px -11.25px');
 assert.equal(gmPreviewUnits('env(safe-area-inset-bottom) 50%',450,800),'env(safe-area-inset-bottom) 50%');
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
 assert.equal(previewLocalRect(rect),rect);
 const a=gmPreviewDimensions(1280,720),b=gmPreviewDimensions(1400,720);
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert.equal(b.clientLeft-a.clientLeft,60);
 const source=readFileSync(new URL('../src/gm-mobile-preview.js',import.meta.url),'utf8');
 assert.match(source,/view\.clientLeft===next\.clientLeft&&view\.clientTop===next\.clientTop/);
});
