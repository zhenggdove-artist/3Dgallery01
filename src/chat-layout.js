// Three-step chat sizing: max -> two-line medium -> + only -> max.
// Tap + to change size; drag 5px or hold 180ms to move it. The expanded panel keeps its 1s hold.
// A new position key discards old placements that stranded chat high on iOS.
export function bindChatLayout(){
 const panel=document.getElementById('chat-hud');
 const handle=document.getElementById('chat-resize');
 const toggle=document.getElementById('chat-toggle');
 if(!panel||!handle||!toggle)return;
 const mobile=matchMedia('(pointer:coarse)').matches;
 // Suppress browser long-press selection menus only on non-interactive chat surfaces.
 panel.addEventListener('contextmenu',e=>{if(!e.target.closest('button,input,textarea,select,form'))e.preventDefault();});
 const STORAGE_KEY='temple-chat-position-v3';
 const DRAG_HOLD_MS=1000;
 const MINI_DRAG_HOLD_MS=180,MINI_DRAG_SLOP=5;
 const sizes=['max','medium','min'];
 let size='medium',active=null,timer=null,toggleTimer=null,ignoreClickUntil=0,manualPosition=false;
 const limit=(n,min,max)=>Math.max(min,Math.min(Math.max(min,max),n));
 const mediumHeight=92;
 const maxHeight=()=>Math.min(220,Math.max(114,innerHeight*.42));
 const blocking=()=>['#attack-button','#mobile-stick','#dock [data-action=jump]',
   '#dock [data-action=interact]','#dock #aim-button']
  .map(q=>document.querySelector(q))
  .filter(el=>el&&el.isConnected&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden')
  .map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
 const collide=(a,b)=>a.left<b.right+8&&a.right>b.left-8&&a.top<b.bottom+8&&a.bottom>b.top-8;
 const clearInline=()=>{for(const property of ['left','top','right','bottom','transform'])panel.style.removeProperty(property);};
 const resetPosition=()=>{
  manualPosition=false;clearInline();
  try{localStorage.removeItem(STORAGE_KEY);}catch{}
 };
 function relocate(left,top){
  const viewport=window.visualViewport,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
  const yMin=viewport?.offsetTop||0;
  const x=limit(left,4,width-panel.offsetWidth-4),y=limit(top,yMin+4,yMin+height-panel.offsetHeight-4);
  const r={left:x,top:y,right:x+panel.offsetWidth,bottom:y+panel.offsetHeight};
  // Explicit user drags may position CHAT anywhere within the viewport.
  panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';
  panel.style.setProperty('bottom','auto','important');panel.style.transform='none';
  return true;
 }
 const save=()=>{if(!manualPosition)return;try{const r=panel.getBoundingClientRect();
  localStorage.setItem(STORAGE_KEY,JSON.stringify({left:r.left,top:r.top}));}catch{}};
 // Shift only as far upward as necessary when an on-screen A, jump or stick
 // would otherwise intersect the chat. On resizing, first restore CSS's
 // lower anchor instead of inheriting a previous, unnecessarily high offset.
 function fitSafely(){
  if(manualPosition){const r=panel.getBoundingClientRect();relocate(r.left,r.top);return;}
  clearInline();
  let rect=panel.getBoundingClientRect();
  const obstacles=blocking(),viewTop=(window.visualViewport?.offsetTop||0)+6;
  if(!obstacles.some(b=>collide(rect,b)))return;
  for(let step=0;step<80;step++){
   const intersect=obstacles.filter(b=>collide(rect,b));
   if(!intersect.length)break;
   const nextTop=Math.max(viewTop,Math.min(...intersect.map(b=>b.top-rect.height-10),rect.top-8));
   if(nextTop>=rect.top-1)break;
   if(!relocate(rect.left,nextTop)){
    // relocate rejects overlap; use the geometry of the next candidate
    // rather than leaving a previous save at an unsafe position.
    const candidate={left:rect.left,right:rect.right,top:nextTop,bottom:nextTop+rect.height};
    if(obstacles.some(b=>collide(candidate,b))){rect=candidate;continue;}
   }
   rect=panel.getBoundingClientRect();
  }
  if(obstacles.some(b=>collide(panel.getBoundingClientRect(),b))&&!manualPosition)resetPosition();
 }
 function setSize(next,{hold=false}={}){
  size=next;
  panel.classList.toggle('chat-minimized',size==='min');
  panel.classList.toggle('chat-medium',size==='medium');
  panel.classList.toggle('chat-max',size==='max');
  panel.dataset.chatSize=size;
  panel.style.setProperty('--chat-height',(size==='medium'?mediumHeight:maxHeight())+'px');
  toggle.textContent=size==='max'?'−':'＋';
  toggle.setAttribute('aria-expanded',String(size!=='min'));
  toggle.setAttribute('aria-label',size==='min'?'Expand chat; hold to move':
   size==='medium'?'Minimize chat; drag to move':'Show two chat lines (hold to minimize)');
  toggle.title=size==='min'?'Open full chat; drag to move':size==='max'?'Show two lines':'Minimize chat; drag to move';
  if(hold)ignoreClickUntil=performance.now()+800;
  requestAnimationFrame(fitSafely);
 }
 setSize('medium');
 toggle.addEventListener('pointerdown',e=>{
  if(!mobile||e.pointerType==='mouse'||size!=='max')return;
  clearTimeout(toggleTimer);
  toggleTimer=setTimeout(()=>setSize('min',{hold:true}),1000);
 });
 const clearToggle=()=>{clearTimeout(toggleTimer);toggleTimer=null;};
 for(const event of ['pointerup','pointercancel','pointerleave'])toggle.addEventListener(event,clearToggle);
 toggle.addEventListener('contextmenu',e=>e.preventDefault());
 toggle.addEventListener('click',e=>{
  if(performance.now()<ignoreClickUntil){e.preventDefault();return;}
  const index=sizes.indexOf(size);
  setSize(sizes[(index+1)%sizes.length]);
 });
 // Both + states can be dragged. Motion immediately activates dragging;
 // a stationary 180ms hold also arms it. A quick tap still changes size.
 let miniDrag=null,miniTimer=null;
 toggle.addEventListener('pointerdown',e=>{
  if(size==='max'||e.button!==0||miniDrag)return;
  ignoreClickUntil=0;
  e.stopPropagation();
  const r=panel.getBoundingClientRect();
  miniDrag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,mode:'pending'};
  try{toggle.setPointerCapture(e.pointerId);}catch{}
  miniTimer=setTimeout(()=>{
   if(!miniDrag||miniDrag.id!==e.pointerId||miniDrag.mode!=='pending')return;
   miniDrag.mode='move';panel.classList.add('chat-dragging');
  },MINI_DRAG_HOLD_MS);
 });
 toggle.addEventListener('pointermove',e=>{
  if(!miniDrag||miniDrag.id!==e.pointerId)return;
  const dx=e.clientX-miniDrag.x,dy=e.clientY-miniDrag.y;
  if(miniDrag.mode==='pending'&&Math.hypot(dx,dy)>=MINI_DRAG_SLOP){
   clearTimeout(miniTimer);miniDrag.mode='move';panel.classList.add('chat-dragging');
  }
  if(miniDrag.mode==='move'){
   e.preventDefault();e.stopPropagation();
   if(relocate(miniDrag.left+dx,miniDrag.top+dy))manualPosition=true;
  }
 });
 const finishMini=e=>{
  if(!miniDrag||miniDrag.id!==e.pointerId)return;
  const mode=miniDrag.mode;clearTimeout(miniTimer);miniDrag=null;
  if(mode!=='pending')ignoreClickUntil=performance.now()+350;
  if(mode==='move')save();
  panel.classList.remove('chat-dragging');
  try{if(toggle.hasPointerCapture(e.pointerId))toggle.releasePointerCapture(e.pointerId);}catch{}
 };
 for(const type of ['pointerup','pointercancel','lostpointercapture'])toggle.addEventListener(type,finishMini);
 if(mobile){
  panel.addEventListener('touchstart',e=>{
   if(e.touches.length!==1||e.target.closest('button,input,textarea,select,form')||size==='min')return;
   const p=e.touches[0],r=panel.getBoundingClientRect();
   active={id:p.identifier,x:p.clientX,y:p.clientY,left:r.left,top:r.top,mode:'pending'};
   clearTimeout(timer);
   timer=setTimeout(()=>{if(active?.id===p.identifier){
    active.mode='move';panel.classList.add('chat-dragging');
   }},DRAG_HOLD_MS);
  },{passive:true});
  panel.addEventListener('touchmove',e=>{
   if(!active)return;
   const p=[...e.changedTouches].find(v=>v.identifier===active.id);if(!p)return;
   const dx=p.clientX-active.x,dy=p.clientY-active.y;
   if(active.mode==='pending'){
    if(Math.hypot(dx,dy)>11){clearTimeout(timer);active=null;}return;
   }
   e.preventDefault();e.stopPropagation();
   if(relocate(active.left+dx,active.top+dy))manualPosition=true;
  },{passive:false});
  const finish=e=>{
   if(!active)return;
   if(e.changedTouches&&![...e.changedTouches].some(t=>t.identifier===active.id))return;
   clearTimeout(timer);if(active.mode==='move')save();active=null;
   panel.classList.remove('chat-dragging');
  };
  for(const type of ['touchend','touchcancel'])panel.addEventListener(type,finish);
 }else{
  // Mouse users may hold anywhere on the CHAT window, not only the resize bar.
  // Ordinary buttons and the message input retain their native interactions.
  panel.addEventListener('pointerdown',e=>{
   if(e.button!==0||active||size==='min'||
      e.target.closest('button,input,textarea,select,form'))return;
   const r=panel.getBoundingClientRect();
   active={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,
    height:r.height,onHandle:handle.contains(e.target),mode:'pending'};
   try{panel.setPointerCapture(e.pointerId);}catch{}
   clearTimeout(timer);
   timer=setTimeout(()=>{if(active?.id===e.pointerId&&active.mode==='pending'){
    active.mode='move';panel.classList.add('chat-dragging');
   }},DRAG_HOLD_MS);
  });
  panel.addEventListener('pointermove',e=>{
   if(!active||active.id!==e.pointerId)return;
   const dx=e.clientX-active.x,dy=e.clientY-active.y;
   if(active.mode==='move'){
    e.preventDefault();
    if(relocate(active.left+dx,active.top+dy))manualPosition=true;
    return;
   }
   if(active.mode==='pending'&&Math.hypot(dx,dy)>8){
    clearTimeout(timer);
    // Preserve immediate vertical resizing from the small CHAT header.
    if(!active.onHandle){active=null;return;}
    active.mode='resize';
   }
   if(active?.mode==='resize'){
    setSize('max');panel.style.setProperty('--chat-height',
     limit(active.height-dy,112,Math.min(350,innerHeight*.5))+'px');
   }
  });
  const finish=e=>{
   if(!active||e.pointerId!==active.id)return;
   clearTimeout(timer);if(active.mode==='move')save();active=null;
   panel.classList.remove('chat-dragging');
   try{if(panel.hasPointerCapture(e.pointerId))panel.releasePointerCapture(e.pointerId);}catch{}
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])panel.addEventListener(type,finish);
 }
 addEventListener('resize',()=>{
  if(size==='max')panel.style.setProperty('--chat-height',maxHeight()+'px');
  requestAnimationFrame(fitSafely);
 });
 try{
  const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top)){
   requestAnimationFrame(()=>{
    manualPosition=true;
    if(!relocate(saved.left,saved.top)){resetPosition();fitSafely();}
   });
  }
 }catch{resetPosition();}
}
