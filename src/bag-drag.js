// Touch-native BAG gestures: a short swipe scrolls naturally; a 280ms
// stationary press lifts an item for vertical/horizontal drag. Scrolling and
// drop target detection use the ACTUAL #bag-items viewport, not #panel-content.
// Native HTML drag/drop remains available to desktop mouse users.
export function bindBagDrag(ui){
 const area=ui.content;
 let held=null,blockUntil=0;
 const itemGrid=()=>area.querySelector('#bag-items:not(.equipment-view)');
 const itemAt=(x,y)=>{
  const grid=itemGrid(),cell=document.elementFromPoint(x,y)?.closest?.('[data-inventory-index]');
  return grid&&cell&&grid.contains(cell)?cell:null;
 };
 const exchange=(source,target)=>{
  if(!target||source.index===target.index)return;
  if(ui.bagFusionMode){
   if(source.itemId===target.dataset.bagItem)return;
   ui.emit('server-action',{action:'fuse',sourceId:source.itemId,
     targetId:target.dataset.bagItem,requestId:crypto.randomUUID()});
  }else{
   ui.emit('server-action',{action:'swap-inventory',fromIndex:source.index,
     toIndex:Number(target.dataset.inventoryIndex)});
  }
 };
 const clear=()=>{
  if(!held)return;
  clearTimeout(held.timer);
  cancelAnimationFrame(held.frame||0);
  held.ghost?.remove();
  held=null;
 };
 // Suppress the synthetic click when a long-touch gesture has completed.
 area.addEventListener('click',e=>{
  if(performance.now()<blockUntil){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 const pulseScroll=()=>{
  const h=held;
  if(!h||!h.ready)return;
  const grid=itemGrid();
  if(!grid){clear();return;}
  const r=grid.getBoundingClientRect(),edge=Math.min(62,r.height*.22);
  // Scroll faster nearer the edge; continue even when the finger is stationary.
  const above=r.top+edge-h.y,below=h.y-(r.bottom-edge);
  if(h.x>=r.left-24&&h.x<=r.right+24){
   const delta=above>0?-Math.min(30,6+above*.45):
    below>0?Math.min(30,6+below*.45):0;
   if(delta)grid.scrollTop+=delta;
  }
  h.frame=requestAnimationFrame(pulseScroll);
 };
 const pickTouch=(list,id)=>Array.from(list||[]).find(t=>t.identifier===id);
 const start=e=>{
  if(ui.panelName!=='bag'||held||e.touches.length!==1)return;
  const grid=itemGrid(),cell=e.target.closest?.('[data-inventory-index]');
  if(!grid||!cell||!grid.contains(cell))return;
  const t=e.changedTouches[0],r=cell.getBoundingClientRect();
  const h={id:t.identifier,itemId:cell.dataset.bagItem,
   index:Number(cell.dataset.inventoryIndex),x:t.clientX,y:t.clientY,
   sx:t.clientX,sy:t.clientY,rect:r,ready:false,ghost:null,frame:0,timer:0};
  held=h;
  h.timer=setTimeout(()=>{
   if(held!==h)return;
   h.ready=true;
   const ghost=cell.cloneNode(true);
   ghost.removeAttribute('data-bag-item');
   ghost.removeAttribute('data-inventory-index');
   ghost.removeAttribute('draggable');
   ghost.style.cssText='position:fixed;pointer-events:none;z-index:10000;'+
    'opacity:.90;background:#f0e4ff;border:2px solid #bc90e5;'+
    'box-sizing:border-box;overflow:hidden;left:'+r.left+'px;top:'+r.top+
    'px;width:'+r.width+'px;height:'+r.height+'px;';
   document.body.append(ghost);h.ghost=ghost;
   pulseScroll();
  },280);
 };
 const move=e=>{
  const h=held;if(!h)return;
  const t=pickTouch(e.touches,h.id);if(!t)return;
  h.x=t.clientX;h.y=t.clientY;
  if(!h.ready){
   // Before hold activation, never prevent native vertical scrolling.
   if(Math.hypot(h.x-h.sx,h.y-h.sy)>11)clear();
   return;
  }
  e.preventDefault();
  if(h.ghost){
   h.ghost.style.left=h.rect.left+h.x-h.sx+'px';
   h.ghost.style.top=h.rect.top+h.y-h.sy+'px';
  }
 };
 const end=e=>{
  const h=held;if(!h||!pickTouch(e.changedTouches,h.id))return;
  if(h.ready){
   e.preventDefault();
   blockUntil=performance.now()+520;
   exchange(h,itemAt(h.x,h.y));
  }
  clear();
 };
 // Touch Events deliberately outlive pointercancel when the browser takes
 // ownership of pan-y. preventDefault() after the long hold keeps drag active.
 area.addEventListener('touchstart',start,{passive:true});
 document.addEventListener('touchmove',move,{passive:false,capture:true});
 document.addEventListener('touchend',end,{passive:false,capture:true});
 document.addEventListener('touchcancel',e=>{
  if(held&&pickTouch(e.changedTouches,held.id))clear();
 },{capture:true});
}
