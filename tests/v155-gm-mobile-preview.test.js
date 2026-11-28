import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gmPreviewDimensions,gmPreviewMediaMatches,gmPreviewUnits,gmMobilePreviewActive} from '../src/gm-mobile-preview.js';
test('19:6 phone-scale viewport fits the browser and reserves the exit control',()=>{
 for(const [w,h] of [[1920,1080],[1280,720],[600,400],[400,250],[800,150]]){
  const v=gmPreviewDimensions(w,h);
  assert.equal(v.width*6,v.height*19);assert.ok(v.width<=w&&v.height+48<=h);
 }
 assert.deepEqual(gmPreviewDimensions(1280,720),{width:950,height:300,offsetLeft:0,offsetTop:0});
 assert.equal(gmMobilePreviewActive(),false);
});
test('existing coarse-pointer mobile landscape CSS is selected at the simulated width',()=>{
 const match=q=>gmPreviewMediaMatches(q,950,300,()=>false);
 assert.equal(match('(max-width: 720px), (pointer: coarse)'),true);
 assert.equal(match('(pointer: coarse) and (orientation: landscape) and (min-width: 601px)'),true);
 assert.equal(match('(min-width: 840px) and (min-height: 650px)'),false);
 assert.equal(match('(max-width: 600px) and (orientation: portrait)'),false);
 assert.equal(match('(pointer: fine)'),false);
 assert.equal(match('(any-pointer: coarse)'),true);
 assert.equal(match('(prefers-reduced-motion: reduce)'),false);
});
test('viewport units track simulated width and height without modifying other values',()=>{
 assert.equal(gmPreviewUnits('calc(100vw - 24px)',950,300),'calc(950px - 24px)');
 assert.equal(gmPreviewUnits('max(12px, 40dvh)',950,300),'max(12px, 120px)');
 assert.equal(gmPreviewUnits('10vmin 10vmax -2.5vw',950,300),'30px 95px -23.75px');
 assert.equal(gmPreviewUnits('env(safe-area-inset-bottom) 50%',950,300),'env(safe-area-inset-bottom) 50%');
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
