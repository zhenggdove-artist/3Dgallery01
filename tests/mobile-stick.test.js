import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMobileStick} from '../src/mobile-stick.js';
function fixture(nativeTouch=true){
 const target=()=>({listeners:new Map(),addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);},removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);},emit(type,props={}){const e={type,cancelable:true,preventDefault(){},...props};for(const fn of [...(this.listeners.get(type)||[])])fn(e);}});
 const win=target(),doc=target(),other={},knob={offsetWidth:40,style:{}},stick=Object.assign(target(),{firstElementChild:knob,contains:t=>t===stick||t===knob,getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),setPointerCapture(){throw Error('capture failed');},hasPointerCapture:()=>false});
 let active=true,vector=[0,0];
 const binding=bindMobileStick(stick,{win,doc,nativeTouch,enabled:()=>active,write:(x,y)=>{vector=[x,y];}});
 const touch=(id,x=80,y=50,t=stick)=>({identifier:id,clientX:x,clientY:y,target:t});
 const emit=(type,touches,changedTouches)=>win.emit(type,{touches,changedTouches});
 return {win,doc,stick,knob,other,binding,touch,emit,vector:()=>vector,disable:()=>{active=false;binding.reset();},enable:()=>{active=true;}};
}
test('multi-touch: releasing attack finger preserves held joystick; releasing joystick stops',()=>{
 const f=fixture(),a=f.touch(1),b=f.touch(2,10,10,f.other);
 f.emit('touchstart',[a],[a]);assert.deepEqual(f.vector(),[1,0]);
 f.emit('touchstart',[a,b],[b]);f.emit('touchend',[a],[b]);assert.deepEqual(f.vector(),[1,0]);
 f.emit('touchend',[],[a]);assert.deepEqual(f.vector(),[0,0]);assert.equal(f.knob.style.transform,'');
});
test('lost touchend is reconciled on another touch event and new stick touch works',()=>{
 const f=fixture(),a=f.touch(1),b=f.touch(2,10,10,f.other),c=f.touch(3,20,50);
 f.emit('touchstart',[a],[a]);f.emit('touchstart',[b],[b]);assert.deepEqual(f.vector(),[0,0]);
 f.emit('touchstart',[b,c],[c]);assert.deepEqual(f.vector(),[-1,0]);
});
test('disable, reenable and old finger cannot resurrect movement',()=>{
 const f=fixture(),a=f.touch(1);
 f.emit('touchstart',[a],[a]);f.disable();f.enable();f.emit('touchmove',[a],[a]);assert.deepEqual(f.vector(),[0,0]);
 f.emit('touchend',[],[a]);f.emit('touchstart',[a],[a]);assert.deepEqual(f.vector(),[1,0]);
});
test('touchcancel, background, blur and orientation reset ownership',()=>{
 const f=fixture(),a=f.touch(1);
 for(const cancel of [()=>f.emit('touchcancel',[],[a]),()=>{f.doc.hidden=true;f.doc.emit('visibilitychange');f.doc.hidden=false;},()=>f.win.emit('blur'),()=>f.win.emit('orientationchange'),()=>f.win.emit('pagehide')]){
  f.emit('touchstart',[a],[a]);assert.deepEqual(f.vector(),[1,0]);cancel();assert.deepEqual(f.vector(),[0,0]);
 }
});
test('native touch ignores duplicate pointer events and allows stationary hold',()=>{
 const f=fixture(),a=f.touch(1);
 f.stick.emit('pointerdown',{pointerType:'touch',pointerId:91,button:0,clientX:80,clientY:50});assert.deepEqual(f.vector(),[0,0]);
 f.emit('touchstart',[a],[a]);f.win.emit('pointercancel',{pointerType:'touch',pointerId:91});assert.deepEqual(f.vector(),[1,0]);
 f.emit('touchend',[],[a]);assert.deepEqual(f.vector(),[0,0]);
});
test('pointer fallback handles capture failure and release outside joystick',()=>{
 const f=fixture(false);
 f.stick.emit('pointerdown',{pointerType:'touch',pointerId:7,button:0,clientX:80,clientY:50});assert.deepEqual(f.vector(),[1,0]);
 f.win.emit('pointerup',{pointerId:8});assert.deepEqual(f.vector(),[1,0]);
 f.win.emit('pointermove',{pointerType:'touch',pointerId:7,clientX:20,clientY:50});assert.deepEqual(f.vector(),[-1,0]);
 f.win.emit('pointerup',{pointerId:7});assert.deepEqual(f.vector(),[0,0]);
});
test('recycled touch identifier starts fresh and mouse button loss clears fallback',()=>{
 const f=fixture(),a=f.touch(1),b=f.touch(1,20,50);
 f.emit('touchstart',[a],[a]);f.emit('touchstart',[b],[b]);assert.deepEqual(f.vector(),[-1,0]);
 const m=fixture(false);m.stick.emit('pointerdown',{pointerType:'mouse',pointerId:9,button:0,clientX:80,clientY:50});m.win.emit('pointermove',{pointerType:'mouse',pointerId:9,buttons:0,clientX:80,clientY:50});assert.deepEqual(m.vector(),[0,0]);
});
