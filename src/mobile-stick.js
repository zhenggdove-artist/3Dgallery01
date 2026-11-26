// Touch identifiers and PointerEvent IDs are different namespaces. On WebKit
// use the native TouchList as the authority for the joystick, independently
// of the pointer capture used by the attack, jump and camera controls.
const bindings=new WeakMap();
export function bindMobileStick(stick,{enabled,write,win=window,doc=document,nativeTouch=('ontouchstart' in win||typeof win.TouchEvent==='function'&&win.navigator?.maxTouchPoints>0)}){
 bindings.get(stick)?.dispose();
 const knob=stick.firstElementChild;
 let owner=null;
 const listeners=[];
 function listen(target,type,fn,options){
  target.addEventListener(type,fn,options);
  listeners.push(()=>target.removeEventListener(type,fn,options));
 }
 function reset(){
  const old=owner;owner=null;
  write(0,0);knob.style.transform='';
  if(old?.kind==='pointer')try{if(stick.hasPointerCapture(old.id))stick.releasePointerCapture(old.id);}catch{}
 }
 function move(x,y){
  if(!enabled()||!Number.isFinite(x)||!Number.isFinite(y)){reset();return;}
  const r=stick.getBoundingClientRect(),dx=x-r.left-r.width/2,dy=y-r.top-r.height/2;
  const radius=Math.max(20,(r.width-knob.offsetWidth)/2-4);
  const f=radius/Math.max(radius,Math.hypot(dx,dy));
  write(dx*f/radius,dy*f/radius);knob.style.transform='translate('+dx*f+'px,'+dy*f+'px)';
 }
 const find=(list,id)=>{
  if(!list)return undefined;
  if(!Array.isArray(list)&&typeof list.item!=='function')return Array.from(list).find(t=>t.identifier===id);
  for(let i=0,n=list.length;i<n;i++){const t=list[i];if(t.identifier===id)return t;}
 };
 const belongs=t=>!!t?.target&&stick.contains(t.target);
 function touchEvent(e){
  if(!enabled()){if(owner)reset();return;}
  // Reconcile on EVERY touch event, including another finger's start/move.
  // This recovers when WebKit drops the previous touchend or pointerup.
  if(owner?.kind==='touch'){
   const same=find(e.touches,owner.id),changed=find(e.changedTouches,owner.id);
   if(!same||!belongs(same)||
      (changed&&(e.type==='touchend'||e.type==='touchcancel'||e.type==='touchstart')))reset();
  }
  if(e.type==='touchstart'&&!owner){
   const fresh=Array.from(e.changedTouches||[]).find(t=>belongs(t)&&find(e.touches,t.identifier));
   if(fresh)owner={kind:'touch',id:fresh.identifier};
  }
  if(owner?.kind!=='touch')return;
  const current=find(e.touches,owner.id);
  if(!current){reset();return;}
  // A second finger must never take ownership or cancel the held joystick.
  if(e.type==='touchstart'||e.type==='touchmove'){
   if(find(e.changedTouches,owner.id)){
    if(e.cancelable)e.preventDefault();
    move(current.clientX,current.clientY);
   }
  }
 }
 if(nativeTouch)for(const type of ['touchstart','touchmove','touchend','touchcancel'])
  listen(win,type,touchEvent,{capture:true,passive:false});
 function pointerDown(e){
  if((nativeTouch&&e.pointerType==='touch')||e.button>0||!enabled()||owner)return;
  if(e.cancelable)e.preventDefault();
  owner={kind:'pointer',id:e.pointerId};
  // Capture failure is not fatal: window-level move/up still tracks the ID.
  try{stick.setPointerCapture(e.pointerId);}catch{}
  move(e.clientX,e.clientY);
 }
 function pointerMove(e){
  if(owner?.kind!=='pointer'||e.pointerId!==owner.id)return;
  if(e.pointerType==='mouse'&&e.buttons===0){reset();return;}
  move(e.clientX,e.clientY);
 }
 function pointerEnd(e){if(owner?.kind==='pointer'&&e.pointerId===owner.id)reset();}
 listen(stick,'pointerdown',pointerDown,{passive:false});
 listen(win,'pointermove',pointerMove,true);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(win,type,pointerEnd,true);
 listen(stick,'lostpointercapture',pointerEnd);
 for(const type of ['blur','pagehide','orientationchange'])listen(win,type,reset);
 listen(doc,'visibilitychange',()=>{if(doc.hidden)reset();});
 const binding={reset,dispose(){reset();for(const off of listeners)off();if(bindings.get(stick)===binding)bindings.delete(stick);}};
 bindings.set(stick,binding);
 return binding;
}
