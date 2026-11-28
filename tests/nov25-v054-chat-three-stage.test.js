import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindChatLayout} from '../src/chat-layout.js';

test('chat button cycles once per pointer tap on desktop and touch even with no collision-free placement',()=>{
 for(const mobile of [false,true]){
  const values=new Map(),classes=new Set(),raf=[];let blocked=true,saved=null;
  function element(){
   const listeners=new Map();
   return {dataset:{},isConnected:true,
    classList:{toggle(k,v){if(v)classes.add(k);else classes.delete(k);},add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)},
    style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)},
    addEventListener(k,fn){if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn);},
    fire(type,extra={}){const e={type,button:0,pointerId:1,clientX:100,clientY:200,pointerType:mobile?'touch':'mouse',target:this,preventDefault(){},stopPropagation(){},...extra};for(const fn of listeners.get(type)||[])fn(e);},
    setAttribute(){},closest(){return null;},setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}
   };
  }
  const panel=element(),handle=element(),toggle=element(),body=element();
  Object.defineProperties(panel,{offsetWidth:{get:()=>panel.dataset.chatSize==='min'?42:320},offsetHeight:{get:()=>panel.dataset.chatSize==='min'?42:panel.dataset.chatSize==='medium'?92:220}});
  panel.getBoundingClientRect=()=>({left:parseFloat(values.get('left')||'30'),top:parseFloat(values.get('top')||'390'),width:panel.offsetWidth,height:panel.offsetHeight});
  const obs={isConnected:true,getBoundingClientRect:()=>({left:0,top:0,right:390,bottom:780,width:390,height:780})};
  const mock={document:{body,getElementById:id=>({'chat-hud':panel,'chat-resize':handle,'chat-toggle':toggle}[id]),querySelectorAll:()=>blocked?[obs]:[]},
   window:{},innerWidth:390,innerHeight:780,matchMedia:()=>({matches:mobile}),getComputedStyle:()=>({display:'block',visibility:'visible'}),
   localStorage:{getItem:()=>null,setItem(k,v){saved=JSON.parse(v);},removeItem(){saved=null;}},requestAnimationFrame:fn=>raf.push(fn),addEventListener(){},ResizeObserver:undefined,MutationObserver:undefined};
  const before=Object.fromEntries(Object.keys(mock).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const [k,v] of Object.entries(mock))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
  const flush=()=>{let n=0;while(raf.length){assert.ok(++n<20,'refit must not recurse into size changes');raf.shift()();}};
  try{
   const layout=bindChatLayout();layout.applyDefault(null);flush();
   assert.equal(panel.dataset.chatSize,'medium');
   for(const expected of ['min','max','medium','min','max','medium']){
    toggle.fire('pointerdown');toggle.fire('pointerup');toggle.fire('click');flush();
    assert.equal(panel.dataset.chatSize,expected);
    assert.equal(toggle.textContent,expected==='min'?'＋':'－');assert.equal(values.has('left'),false);assert.equal(values.has('top'),false);assert.equal(saved,null);
   }
   layout.applyDefault({revision:9,x:.25,y:.8});flush();
   const expectedTop=8+(780-panel.offsetHeight-16)*.8;
   assert.equal(parseFloat(values.get('top')),expectedTop);
   toggle.fire('pointerdown');toggle.fire('pointerup');toggle.fire('click');flush();
   assert.equal(panel.dataset.chatSize,'min');
   assert.equal(parseFloat(values.get('top')),8+(780-42-16)*.8);
   assert.equal(parseFloat(values.get('left')),8+(390-42-16)*.25);
   blocked=false;
   toggle.fire('pointerdown');toggle.fire('pointermove',{clientX:120,clientY:180});toggle.fire('pointerup');toggle.fire('click');flush();
   assert.equal(panel.dataset.chatSize,'min','drag must not change size');
   assert.ok(saved&&saved.revision===9,'drag persists the position and GM revision');
   assert.ok(saved.x>.25&&saved.y<.8);
  }finally{for(const [k,v] of Object.entries(before)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}}
 }
});
test('chat header has only the original label and default CSS position remains above quickbar',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../fidelity-ui.css',import.meta.url),'utf8');
 assert.match(html,/<header id="chat-resize">.*<span>CHAT<\/span><\/header>/);
 assert.match(css,/--chat-gap:10px/);
 assert.match(css,/#hud #chat-hud\{bottom:calc\(var\(--comfort-bottom\) \+ var\(--comfort-slot-size\) \+ var\(--chat-gap\)\)!important\}/);
});
