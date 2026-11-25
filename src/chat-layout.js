// Three-step chat sizing: max -> two-line medium -> + only -> max.
// Tap + to change size; drag 5px or hold 180ms to move it. The expanded panel keeps its 1s hold.
// The manual-position key is stable across game releases. Default placement
// is CSS-anchored above the quickbar and never stored as a manual drag.
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
 let size='medium',active=null,timer=null,toggleTimer=null,ignoreClickUntil=0,manualPosition=false,manualAnchor=null,globalDefault=null,globalRevision=-1;
 const limit=(n,min,max)=>Math.max(min,Math.min(Math.max(min,max),n));
 const mediumHeight=92;
 const maxHeight=()=>Math.min(220,Math.max(114,innerHeight*.42));
 const obstacleSelector='#dock button,#mobile-stick,#comfort-hotbar,#map-cluster,#gm-menu,#gm-help,#gm-spectator-test-exit,#identity,#player-roster,#vitals,#shield-readout,#spectator-fly-controls,#gallery-guide,#paint-toolbar,#build-mode';
 const blocking=()=>[...document.querySelectorAll(obstacleSelector)]
  .filter(el=>el&&el.isConnected&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden')
  .map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
 const collide=(a,b)=>a.left<b.right+8&&a.right>b.left-8&&a.top<b.bottom+8&&a.bottom>b.top-8;
 const clearInline=()=>{for(const property of ['left','top','right','bottom','transform'])panel.style.removeProperty(property);};
 const resetPosition=()=>{
  manualPosition=false;manualAnchor=null;clearInline();
  try{localStorage.removeItem(STORAGE_KEY);}catch{}
 };
 function bounds(){
  const v=window.visualViewport;
  const left=(v?.offsetLeft||0)+8,top=(v?.offsetTop||0)+8;
  return {left,top,right:Math.max(left,(v?.offsetLeft||0)+(v?.width||innerWidth)-panel.offsetWidth-8),
   bottom:Math.max(top,(v?.offsetTop||0)+(v?.height||innerHeight)-panel.offsetHeight-8)};
 }
 function anchorAt(left,top){
  const b=bounds();return {x:limit((left-b.left)/Math.max(1,b.right-b.left),0,1),y:limit((top-b.top)/Math.max(1,b.bottom-b.top),0,1)};
 }
 function relocate(left,top){
  if(!panel.offsetWidth||!panel.offsetHeight)return false;
  const b=bounds(),w=panel.offsetWidth,h=panel.offsetHeight,obs=blocking();
  const x=limit(left,b.left,b.right),y=limit(top,b.top,b.bottom);
  const xs=[x,b.left,b.right],ys=[y,b.top,b.bottom];
  for(const o of obs){xs.push(limit(o.left-w-9,b.left,b.right),limit(o.right+9,b.left,b.right));ys.push(limit(o.top-h-9,b.top,b.bottom),limit(o.bottom+9,b.top,b.bottom));}
  let best=null,distance=Infinity;
  for(const px of xs)for(const py of ys){
   const r={left:px,top:py,right:px+w,bottom:py+h};
   if(obs.some(o=>collide(r,o)))continue;
   const d=(px-x)**2+(py-y)**2;if(d<distance){best=r;distance=d;}
  }
  if(!best)return false;
  panel.style.setProperty('left',best.left+'px','important');panel.style.setProperty('top',best.top+'px','important');panel.style.right='auto';
  panel.style.setProperty('bottom','auto','important');panel.style.transform='none';
  return true;
 }
 const save=()=>{if(!manualPosition)return;try{const r=panel.getBoundingClientRect();
  manualAnchor=anchorAt(r.left,r.top);
  localStorage.setItem(STORAGE_KEY,JSON.stringify({...manualAnchor,revision:globalRevision}));}catch{}};
 function fitSafely(){
  if(!panel.offsetWidth||!panel.offsetHeight||panel.closest('[hidden]')||getComputedStyle(panel).visibility==='hidden')return;
  if(active?.mode==='move'||miniDrag?.mode==='move')return;
  const anchor=manualPosition?manualAnchor:globalDefault;
  let left,top;
  if(anchor){const b=bounds();left=b.left+(b.right-b.left)*anchor.x;top=b.top+(b.bottom-b.top)*anchor.y;}
  else{clearInline();const r=panel.getBoundingClientRect();left=r.left;top=r.top;}
  if(!relocate(left,top)&&size!=='min')setSize(size==='max'?'medium':'min');
 }
 function applyDefault(value){
  const revision=Number(value?.revision)||0;
  if(revision===globalRevision)return;
  globalRevision=revision;
  globalDefault=value&&Number.isFinite(value.x)&&Number.isFinite(value.y)?{x:limit(value.x,0,1),y:limit(value.y,0,1)}:null;
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
   manualPosition=!!saved&&saved.revision===revision&&Number.isFinite(saved.x)&&Number.isFinite(saved.y);
   manualAnchor=manualPosition?{x:limit(saved.x,0,1),y:limit(saved.y,0,1)}:null;
   if(!manualPosition)localStorage.removeItem(STORAGE_KEY);
  }catch{manualPosition=false;manualAnchor=null;}
  requestAnimationFrame(fitSafely);
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
  if(mode==='move')requestAnimationFrame(fitSafely);
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
 const onViewportResize=()=>{
  if(size==='max')panel.style.setProperty('--chat-height',maxHeight()+'px');
  requestAnimationFrame(fitSafely);
 };
 addEventListener('resize',onViewportResize);
 window.visualViewport?.addEventListener('resize',onViewportResize);
 // The HUD starts hidden at login. Refit only when layout dimensions change,
 // not on world snapshots or game frames.
 if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(()=>requestAnimationFrame(fitSafely));observer.observe(panel);for(const el of document.querySelectorAll(obstacleSelector))observer.observe(el);}
 if(typeof MutationObserver==='function'){let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;fitSafely();});});for(const el of [document.body,document.getElementById('hud'),...document.querySelectorAll(obstacleSelector)])if(el)observer.observe(el,{attributes:true,attributeFilter:el===document.body||el.id==='hud'?['hidden','class']:['hidden']});}
 return {applyDefault,position:()=>{const r=panel.getBoundingClientRect();return anchorAt(r.left,r.top);},prepare:()=>{setSize('medium');}};
}
