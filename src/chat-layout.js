// Mobile: hold the chat for one second to drag anywhere within the viewport.
// Hold the + button for one second to reduce the entire chat to +.
// Desktop: dragging the header resizes; holding it for a second moves it.
export function bindChatLayout(){
 const panel=document.getElementById('chat-hud');
 const handle=document.getElementById('chat-resize');
 const toggle=document.getElementById('chat-toggle');
 const mobile=matchMedia('(pointer:coarse)').matches;
 const STORAGE_KEY='temple-chat-position-v2'; // Ignore corrupted old upper-left layout.
 let active=null,timer=null,toggleTimer=null,expanded=false,minimized=false,ignoreClick=false,minimizedAt=0;
 const limit=(n,min,max)=>Math.max(min,Math.min(Math.max(min,max),n));
 const resize=height=>{const h=limit(height,Math.min(112,innerHeight*.5),innerHeight*.5);panel.style.setProperty('--chat-height',h+'px');};
 const blocking=()=>['#attack-button','#mobile-stick','#dock [data-action=jump]','#dock [data-action=interact]','#dock #aim-button']
  .map(q=>document.querySelector(q)).filter(el=>el&&getComputedStyle(el).display!=='none').map(el=>el.getBoundingClientRect());
 const collide=(a,b)=>a.left<b.right+6&&a.right>b.left-6&&a.top<b.bottom+6&&a.bottom>b.top-6;
 function relocate(left,top){
  const viewport=window.visualViewport,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
  const x=limit(left,4,width-panel.offsetWidth-4),y=limit(top,4,height-panel.offsetHeight-4);
  const r={left:x,top:y,right:x+panel.offsetWidth,bottom:y+panel.offsetHeight};
  // Never allow the chat to cover A, jump or the virtual joystick on mobile.
  if(blocking().some(b=>collide(r,b)))return false;
  panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';
  panel.style.bottom='auto';panel.style.transform='none';
  return true;
 }
 // Default: CSS-controlled lower-center chat, wholly above combat controls.
 function resetPosition(){
  for(const property of ['left','top','right','bottom','transform'])panel.style.removeProperty(property);
  try{localStorage.removeItem(STORAGE_KEY);}catch{}
 }
 const save=()=>{try{const r=panel.getBoundingClientRect();localStorage.setItem(STORAGE_KEY,JSON.stringify({left:r.left,top:r.top}));}catch{}};
 const minimize=value=>{
  minimized=value;panel.classList.toggle('chat-minimized',minimized);
  toggle.textContent=minimized?'＋':expanded?'−':'＋';
  toggle.setAttribute('aria-expanded',String(!minimized));
  toggle.setAttribute('aria-label',minimized?'Restore chat':'Collapse chat (hold 1 second)');
  if(panel.style.top){const r=panel.getBoundingClientRect();if(!relocate(r.left,r.top))resetPosition();}
  save();
 };
 toggle.addEventListener('pointerdown',e=>{
  if(!mobile||e.pointerType==='mouse')return;
  clearTimeout(toggleTimer);
  toggleTimer=setTimeout(()=>{ignoreClick=true;minimizedAt=performance.now();minimize(true);},1000);
 });
 const clearToggle=()=>{clearTimeout(toggleTimer);toggleTimer=null;};
 for(const event of ['pointerup','pointercancel','pointerleave'])toggle.addEventListener(event,clearToggle);
 toggle.addEventListener('click',e=>{
  // Some mobile browsers suppress the click following a long press.
  // Do not swallow the user's next actual tap to restore the chat.
  if(ignoreClick&&performance.now()-minimizedAt<350){ignoreClick=false;e.preventDefault();return;}
  ignoreClick=false;
  if(minimized){minimize(false);return;}
  expanded=!expanded;resize(expanded?Math.min(240,innerHeight*.45):118);
  toggle.textContent=expanded?'−':'＋';toggle.setAttribute('aria-expanded',String(expanded));
 });
 if(mobile){
  // Do not intercept native chat typing or normal message scrolling before
  // one stationary second has elapsed.
  panel.addEventListener('touchstart',e=>{
   if(e.touches.length!==1||e.target.closest('button,input,textarea,select,form')||minimized)return;
   const p=e.touches[0],r=panel.getBoundingClientRect();
   active={id:p.identifier,x:p.clientX,y:p.clientY,left:r.left,top:r.top,mode:'pending'};
   clearTimeout(timer);
   timer=setTimeout(()=>{if(active?.id===p.identifier)active.mode='move';},1000);
  },{passive:true});
  panel.addEventListener('touchmove',e=>{
   if(!active)return;
   const p=[...e.changedTouches].find(v=>v.identifier===active.id);if(!p)return;
   const dx=p.clientX-active.x,dy=p.clientY-active.y;
   if(active.mode==='pending'){
    if(Math.hypot(dx,dy)>11){clearTimeout(timer);active=null;}return;
   }
   e.preventDefault();e.stopPropagation();
   relocate(active.left+dx,active.top+dy);
  },{passive:false});
  const finish=e=>{
   if(!active)return;
   if(e.changedTouches&&![...e.changedTouches].some(t=>t.identifier===active.id))return;
   clearTimeout(timer);if(active.mode==='move')save();active=null;
  };
  for(const type of ['touchend','touchcancel'])panel.addEventListener(type,finish);
 }else{
  handle.addEventListener('pointerdown',e=>{
   if(e.target.closest('button')||active)return;
   e.preventDefault();const r=panel.getBoundingClientRect();
   active={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,height:r.height,mode:'pending'};
   handle.setPointerCapture(e.pointerId);
   timer=setTimeout(()=>{if(active?.id===e.pointerId)active.mode='move';},1000);
  });
  handle.addEventListener('pointermove',e=>{
   if(!active||active.id!==e.pointerId)return;
   const dx=e.clientX-active.x,dy=e.clientY-active.y;
   if(active.mode==='move'){relocate(active.left+dx,active.top+dy);return;}
   if(Math.hypot(dx,dy)>8){clearTimeout(timer);active.mode='resize';}
   if(active.mode==='resize')resize(active.height-dy);
  });
  const finish=e=>{if(!active||e.pointerId!==active.id)return;clearTimeout(timer);if(active.mode==='move')save();active=null;};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,finish);
 }
 addEventListener('resize',()=>{
  if(!minimized)resize(panel.getBoundingClientRect().height);
  if(panel.style.top){const r=panel.getBoundingClientRect();if(!relocate(r.left,r.top))resetPosition();}
 });
 // Restore only positions saved with the new control-safe layout policy.
 // Old mobile coordinates could overlap the title or be pinned at (4,4).
 try{
  const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top))
   requestAnimationFrame(()=>{if(!relocate(saved.left,saved.top))resetPosition();});
 }catch{resetPosition();}
}
