import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 defaultFloatingPanelLayout,clampFloatingPanelLayout,FloatingGmEditorPanel
} from '../src/gm-floating-panel.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fixture(width=390,height=700){
 const vv=new EventTarget();Object.assign(vv,{width,height,offsetLeft:0,offsetTop:0});
 const host=new EventTarget();Object.assign(host,{
  innerWidth:width,innerHeight:height,visualViewport:vv,
  matchMedia:()=>({matches:true})
 });
 const state=new Map(),store={
  setItem:(key,value)=>state.set(key,value),
  getItem:key=>state.get(key)||null
 };
 const panel=new EventTarget();const styles={},tokens=new Set();
 const toggle={textContent:'',setAttribute(key,v){this[key]=v;}};
 Object.assign(panel,{
  classList:{toggle:(name,on)=>{if(on)tokens.add(name);else tokens.delete(name);}},
  style:{setProperty:(key,val)=>{styles[key]=val;}},
  dataset:{},querySelector:selector=>selector==='[data-gm-panel-toggle]'?toggle:null,
  setPointerCapture(id){this.captured=id;},hasPointerCapture(id){return id===this.captured;},
  releasePointerCapture(id){if(this.captured===id)this.captured=null;}
 });
 return {host,vv,panel,store,state,styles,tokens,toggle};
}
const pointer=(id,x,y,targetSelector)=>{
 const fakeTarget={closest:selector=>selector===targetSelector?{}:null};
 return {pointerId:id,clientX:x,clientY:y,button:0,target:fakeTarget,
  preventDefault(){},stopPropagation(){}};
};
test('mobile GM window starts compact, leaving most 3D canvas unobstructed',()=>{
 const view={x:0,y:0,width:390,height:740},initial=defaultFloatingPanelLayout(view);
 assert.ok(initial.width<=view.width*.65,'width is not full-screen');
 assert.ok(initial.height<=view.height*.38,'height is not full-screen');
 const clamped=clampFloatingPanelLayout(initial,view);
 assert.equal(clamped.width,initial.width);
 assert.equal(clamped.height,initial.height);
});
test('drag, eight viewport boundaries, and resize pointer capture persist without changing artwork state',()=>{
 const f=fixture();const ctrl=new FloatingGmEditorPanel(f.panel,{host:f.host,store:f.store});
 ctrl.open();
 assert.ok(f.tokens.has('gm-mobile-floating'));
 assert.ok(ctrl.layout.width<260);
 const start={...ctrl.layout};
 ctrl.start(pointer(7,60,100,'[data-gm-panel-drag]'));
 assert.equal(f.panel.captured,7);
 ctrl.move(pointer(7,125,250,'[data-gm-panel-drag]'));
 assert.ok(ctrl.layout.x>start.x);
 assert.ok(ctrl.layout.y>start.y);
 ctrl.end(pointer(7,125,250,'[data-gm-panel-drag]'));
 assert.ok(f.state.size>0,'position persisted');
 ctrl.start(pointer(8,100,200,'[data-gm-panel-resize]'));
 ctrl.move(pointer(8,1000,1200,'[data-gm-panel-resize]'));
 ctrl.end(pointer(8,1000,1200,'[data-gm-panel-resize]'));
 assert.ok(ctrl.layout.width<=f.vv.width-16);
 assert.ok(ctrl.layout.height<=f.vv.height-16);
 assert.ok(ctrl.layout.x+ctrl.layout.width<=f.vv.width-8+.001);
 assert.ok(ctrl.layout.y+ctrl.layout.height<=f.vv.height-8+.001);
 const saved=new FloatingGmEditorPanel(f.panel,{host:f.host,store:f.store});
 saved.open();
 assert.deepEqual(saved.layout,ctrl.layout,'on reopening position and dimensions are restored');
});
test('collapse on editing retains header, accessible save, and preserves window size for re-expansion',()=>{
 const f=fixture(),ctrl=new FloatingGmEditorPanel(f.panel,{host:f.host,store:f.store});
 ctrl.open();
 const height=ctrl.layout.height;ctrl.collapseForScene();
 assert.equal(ctrl.collapsed,true);
 assert.equal(f.panel.dataset.gmCollapsed,'true');
 assert.equal(f.toggle['aria-expanded'],'false');
 assert.equal(ctrl.layout.height,height,'collapse must not change saved expanded height');
 ctrl.setCollapsed(false);
 assert.equal(f.panel.dataset.gmCollapsed,'false');
 assert.equal(ctrl.layout.height,height);
});
test('orientation and iOS keyboard viewport changes keep a visible reachable header',()=>{
 const f=fixture(),ctrl=new FloatingGmEditorPanel(f.panel,{host:f.host,store:f.store});
 ctrl.open();
 ctrl.layout={x:350,y:550,width:370,height:580};
 f.vv.width=320;f.vv.height=285;f.vv.offsetTop=18;
 ctrl.reflow();
 assert.ok(ctrl.layout.width<=304);
 assert.ok(ctrl.layout.height<=269);
 assert.ok(ctrl.layout.x>=8);
 assert.ok(ctrl.layout.y>=26);
 assert.ok(ctrl.layout.y+ctrl.layout.height<=18+285-8+.001);
 ctrl.reset();
 assert.equal(ctrl.collapsed,false);
 assert.ok(ctrl.layout.width<250);
});
test('floating editor markup and CSS include true scrollable controls and a close/save/toggle header',()=>{
 const markup=read('src/art-editor-panel.js'),css=read('fidelity-ui.css');
 const editor=read('src/artwork-editor.js'),index=read('index.html');
 for(const token of ['gm-floating-head','gm-floating-body','data-gm-panel-drag',
  'data-gm-panel-toggle','data-gm-panel-resize','data-gm-panel-reset',
  'data-action="save"','data-action="cancel"'])
  assert.ok(markup.includes(token),'Missing control '+token);
 assert.match(css,/#art-editor\.gm-mobile-floating\[hidden\]\{display:none!important\}/);
 assert.match(css,/overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain/);
 assert.match(css,/width:var\(--gm-editor-width/);
 assert.match(css,/height:var\(--gm-editor-height/);
 assert.match(editor,/new FloatingGmEditorPanel\(this\.panel\)/);
 assert.match(editor,/this\.floatingPanel\.open\(\)/);
 assert.match(editor,/this\.floatingPanel\.collapseForScene\(\)/);
 assert.match(index,/20261123-mobile-gm-floating-editor-r94/);
});
