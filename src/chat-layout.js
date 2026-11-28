import {viewWidth,viewHeight,viewVisualViewport,gmMobilePreviewActive} from './gm-mobile-preview.js';
// Three-step chat sizing: max -> two-line medium -> + only -> max.
// Tap + to expand and − to reduce size; drag 5px or hold 180ms to move it. The expanded panel keeps its 1s hold.
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
 let size='medium',active=null,timer=null,ignoreClickUntil=0,manualPosition=false,manualAnchor=null,globalDefault=null,globalRevision=-1,previewChatState=null;
 const limit=(n,min,max)=>Math.max(min,Math.min(Math.max(min,max),n));
 const mediumHeight=92;
 const maxHeight=()=>Math.min(220,Math.max(114,viewHeight()*.42));
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
  const v=viewVisualViewport();
  const left=(v?.offsetLeft||0)+8,top=(v?.offsetTop||0)+8;
  return {left,top,right:Math.max(left,(v?.offsetLeft||0)+(v?.width||viewWidth())-panel.offsetWidth-8),
   bottom:Math.max(top,(v?.offsetTop||0)+(v?.height||viewHeight())-panel.offsetHeight-8)};
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
  if(!gmMobilePreviewActive())localStorage.setItem(STORAGE_KEY,JSON.stringify({...manualAnchor,revision:globalRevision}));}catch{}};
 function fitSafely(){
  if(!panel.offsetWidth||!panel.offsetHeight||panel.closest('[hidden]')||getComputedStyle(panel).visibility==='hidden')return;
  if(active?.mode==='move'||miniDrag?.mode==='move')return;
  if(document.body.classList.contains('chat-typing')){const b=bounds(),r=panel.getBoundingClientRect();panel.style.setProperty('left',limit(r.left,b.left,b.right)+'px','important');panel.style.setProperty('top',limit(r.top,b.top,b.bottom)+'px','important');panel.style.setProperty('bottom','auto','important');panel.style.right='auto';panel.style.transform='none';return;}
  const anchor=manualPosition?manualAnchor:globalDefault;
  // Fit must never change the selected size or search for a different HUD
  // position. The saved GM/user anchor (or the original CSS default) wins.
  // Obstacle avoidance remains available only during an explicit drag.
  if(!anchor){clearInline();return;}
  const b=bounds();
  panel.style.setProperty('left',(b.left+(b.right-b.left)*anchor.x)+'px','important');
  panel.style.setProperty('top',(b.top+(b.bottom-b.top)*anchor.y)+'px','important');
  panel.style.right='auto';panel.style.setProperty('bottom','auto','important');panel.style.transform='none';
 }
 function applyDefault(value){
  const revision=Number(value?.revision)||0;
  if(revision===globalRevision)return;
  globalRevision=revision;
  globalDefault=value&&Number.isFinite(value.x)&&Number.isFinite(value.y)?{x:limit(value.x,0,1),y:limit(value.y,0,1)}:null;
  if(gmMobilePreviewActive()){manualPosition=false;manualAnchor=null;requestAnimationFrame(fitSafely);return;}
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
   manualPosition=!!saved&&saved.revision===revision&&Number.isFinite(saved.x)&&Number.isFinite(saved.y);
   manualAnchor=manualPosition?{x:limit(saved.x,0,1),y:limit(saved.y,0,1)}:null;
   if(!manualPosition)localStorage.removeItem(STORAGE_KEY);
  }catch{manualPosition=false;manualAnchor=null;}
  requestAnimationFrame(fitSafely);
 }
 function setSize(next){
  size=next;
  panel.classList.toggle('chat-minimized',size==='min');
  panel.classList.toggle('chat-medium',size==='medium');
  panel.classList.toggle('chat-max',size==='max');
  panel.dataset.chatSize=size;
  panel.style.setProperty('--chat-height',(size==='medium'?mediumHeight:maxHeight())+'px');
  toggle.textContent=size==='min'?'＋':'－';
  toggle.setAttribute('aria-expanded',String(size!=='min'));
  toggle.setAttribute('aria-label',size==='min'?'Expand chat; hold to move':
   size==='medium'?'Minimize chat; drag to move':'Show two chat lines; hold to move');
  toggle.title=size==='min'?'Open full chat; drag to move':size==='max'?'Show two lines; hold to move':'Minimize chat; drag to move';
  requestAnimationFrame(fitSafely);
 }
 setSize('medium');
 const cycleSize=()=>setSize(sizes[(sizes.indexOf(size)+1)%sizes.length]);
 toggle.addEventListener('contextmenu',e=>e.preventDefault());
 // A captured pointer release is the only pointer activation. Suppress its
 // later synthetic click, which can otherwise advance a second time on iOS.
 // Keyboard/assistive clicks without a pointer still work.
 toggle.addEventListener('click',e=>{
  if(performance.now()<ignoreClickUntil){e.preventDefault();return;}
  cycleSize();
 });
 // The same + control works at all three sizes. The compact states retain
 // their quick drag response; the expanded state retains its one-second hold.
 let miniDrag=null,miniTimer=null;
 toggle.addEventListener('pointerdown',e=>{
  if(e.button!==0||miniDrag)return;
  e.preventDefault();e.stopPropagation();
  const r=panel.getBoundingClientRect();
  miniDrag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,mode:'pending',expanded:size==='max',startedAt:performance.now(),moved:false};
  try{toggle.setPointerCapture(e.pointerId);}catch{}
  miniTimer=setTimeout(()=>{
   if(!miniDrag||miniDrag.id!==e.pointerId||miniDrag.mode!=='pending')return;
   miniDrag.mode='move';panel.classList.add('chat-dragging');
  },miniDrag.expanded?DRAG_HOLD_MS:MINI_DRAG_HOLD_MS);
 });
 toggle.addEventListener('pointermove',e=>{
  if(!miniDrag||miniDrag.id!==e.pointerId)return;
  const dx=e.clientX-miniDrag.x,dy=e.clientY-miniDrag.y;
  if(Math.hypot(dx,dy)>=MINI_DRAG_SLOP)miniDrag.moved=true;
  if(!miniDrag.expanded&&miniDrag.mode==='pending'&&Math.hypot(dx,dy)>=MINI_DRAG_SLOP){
   clearTimeout(miniTimer);miniDrag.mode='move';panel.classList.add('chat-dragging');
  }
  if(miniDrag.mode==='move'&&miniDrag.moved){
   e.preventDefault();e.stopPropagation();
   if(relocate(miniDrag.left+dx,miniDrag.top+dy))manualPosition=true;
  }
 });
 const finishMini=e=>{
  if(!miniDrag||miniDrag.id!==e.pointerId)return;
  const drag=miniDrag;clearTimeout(miniTimer);miniDrag=null;
  ignoreClickUntil=performance.now()+800;
  // A normal tap can last longer than the 180ms drag-arm timer. Only actual
  // movement or a one-second hold should consume it without changing size.
  if(e.type==='pointerup'&&!drag.moved&&performance.now()-drag.startedAt<DRAG_HOLD_MS)cycleSize();
  if(drag.mode==='move'&&drag.moved){save();requestAnimationFrame(fitSafely);}
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
    mode:'pending'};
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
    // Resizing is exclusively the three-step + button. A short header
    // drag must not change size or position before the long-press threshold.
    active=null;return;
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
 let fitFrame=0;
 const scheduleFit=()=>{if(!fitFrame)fitFrame=requestAnimationFrame(()=>{fitFrame=0;fitSafely();});};
 const onViewportResize=()=>{
  if(gmMobilePreviewActive()&&!previewChatState){previewChatState={manualPosition,manualAnchor,revision:globalRevision};manualPosition=false;manualAnchor=null;}
  else if(!gmMobilePreviewActive()&&previewChatState){manualPosition=previewChatState.revision===globalRevision&&previewChatState.manualPosition;manualAnchor=manualPosition?previewChatState.manualAnchor:null;previewChatState=null;}
  if(size==='max')panel.style.setProperty('--chat-height',maxHeight()+'px');
  scheduleFit();
 };
 addEventListener('resize',onViewportResize);
 window.visualViewport?.addEventListener('resize',onViewportResize);
 // The HUD starts hidden at login. Refit only when layout dimensions change,
 // not on world snapshots or game frames.
 if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(scheduleFit);observer.observe(panel);for(const el of document.querySelectorAll(obstacleSelector))observer.observe(el);}
 if(typeof MutationObserver==='function'){const observer=new MutationObserver(scheduleFit);for(const el of [document.body,document.getElementById('hud'),...document.querySelectorAll(obstacleSelector)])if(el)observer.observe(el,{attributes:true,attributeFilter:el===document.body||el.id==='hud'?['hidden','class']:['hidden']});}
 return {applyDefault,refit:scheduleFit,position:()=>{const r=panel.getBoundingClientRect();return anchorAt(r.left,r.top);},prepare:()=>{setSize('medium');}};
}
