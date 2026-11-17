// Chat supports immediate header-drag resizing and 460ms long-press relocation.
// Persisted positions are constrained to the viewport and avoid mobile controls.
export function bindChatLayout(){
 const panel=document.getElementById('chat-hud'),handle=document.getElementById('chat-resize'),toggle=document.getElementById('chat-toggle');
 let active=null,timer=null,expanded=false;
 const resize=height=>{const h=Math.max(Math.min(112,innerHeight*.5),Math.min(innerHeight*.5,height));panel.style.setProperty('--chat-height',h+'px');};
 const limit=(n,min,max)=>Math.max(min,Math.min(Math.max(min,max),n));
 const blocking=()=>['#attack-button','#mobile-stick','#dock [data-action=jump]','#dock [data-action=interact]']
  .map(q=>document.querySelector(q)).filter(el=>el&&getComputedStyle(el).display!=='none').map(el=>el.getBoundingClientRect());
 const intersect=(a,b)=>a.left<b.right+6&&a.right>b.left-6&&a.top<b.bottom+6&&a.bottom>b.top-6;
 const allowed=(left,top)=>{
  const r={left,top,right:left+panel.offsetWidth,bottom:top+panel.offsetHeight};
  return !blocking().some(b=>intersect(r,b));
 };
 function relocate(left,top){
  const safe=window.visualViewport,screenWidth=safe?.width||innerWidth,screenHeight=safe?.height||innerHeight;
  const x=limit(left,4,screenWidth-panel.offsetWidth-4),y=limit(top,4,screenHeight-panel.offsetHeight-4);
  if(!allowed(x,y))return false;
  panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';
  panel.style.bottom='auto';panel.style.transform='none';return true;
 }
 const save=()=>{const r=panel.getBoundingClientRect();localStorage.setItem('temple-chat-position',JSON.stringify({left:r.left,top:r.top}));};
 toggle.onclick=()=>{expanded=!expanded;resize(expanded?Math.min(240,innerHeight*.45):118);toggle.textContent=expanded?'−':'＋';toggle.setAttribute('aria-expanded',String(expanded));};
 handle.addEventListener('pointerdown',e=>{
  if(e.target.closest('button')||active)return;
  e.preventDefault();
  const r=panel.getBoundingClientRect();
  active={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,height:r.height,mode:'pending'};
  handle.setPointerCapture(e.pointerId);
  timer=setTimeout(()=>{if(active&&active.id===e.pointerId)active.mode='move';},460);
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
 addEventListener('resize',()=>{
  resize(panel.getBoundingClientRect().height);
  if(panel.style.top){const r=panel.getBoundingClientRect();relocate(r.left,r.top);}
 });
 // Never restore old coordinates that now overlap joystick or action buttons.
 try{const saved=JSON.parse(localStorage.getItem('temple-chat-position')||'null');
  if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top))requestAnimationFrame(()=>{
   const key='temple-chat-raise-20261117',top=saved.top-(localStorage.getItem(key)?0:4);
   for(let rise=0;rise<=240;rise+=4)if(relocate(saved.left,top-rise)){
    localStorage.setItem('temple-chat-position',JSON.stringify({left:saved.left,top:top-rise}));
    localStorage.setItem(key,'1');break;
   }
  });
 }catch{}
}
