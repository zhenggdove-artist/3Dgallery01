// Movable, resizable GM artwork inspector. Mobile starts as a compact
// floating tool window instead of the legacy full-viewport modal.
const STORAGE_KEY='temple-gm-artwork-floating-v1';
const EDGE=8;
const MIN_WIDTH=192,MIN_HEIGHT=148,COLLAPSED_HEIGHT=44;

const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function defaultFloatingPanelLayout(view){
 const width=clamp(Math.min(244,view.width*.62),Math.min(MIN_WIDTH,view.width-EDGE*2),view.width-EDGE*2);
 const height=clamp(Math.min(246,view.height*.35),Math.min(MIN_HEIGHT,view.height-EDGE*2),view.height-EDGE*2);
 return {x:view.x+EDGE,y:view.y+Math.min(60,view.height*.12),width,height};
}
export function clampFloatingPanelLayout(layout,view,collapsed=false){
 const availableWidth=Math.max(1,view.width-EDGE*2);
 const availableHeight=Math.max(1,view.height-EDGE*2);
 const width=clamp(finite(layout.width,244),Math.min(MIN_WIDTH,availableWidth),availableWidth);
 const height=clamp(finite(layout.height,246),Math.min(MIN_HEIGHT,availableHeight),availableHeight);
 const visibleHeight=collapsed?Math.min(COLLAPSED_HEIGHT,availableHeight):height;
 return {
  x:clamp(finite(layout.x,view.x+EDGE),view.x+EDGE,view.x+view.width-width-EDGE),
  y:clamp(finite(layout.y,view.y+EDGE),view.y+EDGE,view.y+view.height-visibleHeight-EDGE),
  width,height
 };
}

export class FloatingGmEditorPanel{
 constructor(panel,{host=window,store=window.localStorage,storageKey=STORAGE_KEY,force=false}={}){
  this.panel=panel;this.host=host;this.store=store;this.storageKey=storageKey;this.force=force;
  this.mobile=false;this.pointer=null;
  this.layout=null;this.collapsed=false;
  try{
   const saved=JSON.parse(store?.getItem(this.storageKey)||'null');
   if(saved&&typeof saved==='object'){
    this.layout={x:saved.x,y:saved.y,width:saved.width,height:saved.height};
    this.collapsed=!!saved.collapsed;
   }
  }catch{}
  panel.addEventListener('pointerdown',e=>this.start(e),{capture:true});
  panel.addEventListener('pointermove',e=>this.move(e));
  for(const type of ['pointerup','pointercancel','lostpointercapture'])
   panel.addEventListener(type,e=>this.end(e));
  panel.addEventListener('click',e=>{
   if(e.target.closest('[data-gm-panel-toggle]')){
    e.preventDefault();this.setCollapsed(!this.collapsed);return;
   }
   if(e.target.closest('[data-gm-panel-reset]')){
    e.preventDefault();this.reset();
   }
  });
  host.addEventListener('resize',()=>this.reflow());
  host.addEventListener('orientationchange',()=>this.reflow());
  host.visualViewport?.addEventListener('resize',()=>this.reflow());
  host.visualViewport?.addEventListener('scroll',()=>this.reflow());
 }
 viewport(){
  const vv=this.host.visualViewport;
  // iOS keyboard and browser chrome affect the visual viewport, not always
  // innerHeight. Keep the header reachable when either changes.
  return {
   x:finite(vv?.offsetLeft,0),y:finite(vv?.offsetTop,0),
   width:Math.max(1,finite(vv?.width,this.host.innerWidth)),
   height:Math.max(1,finite(vv?.height,this.host.innerHeight))
  };
 }
 isMobile(){
  return this.host.matchMedia?.('(max-width: 720px), (pointer: coarse)').matches||
   this.host.innerWidth<=720;
 }
 open(){
  this.mobile=this.force||!!this.isMobile();
  this.panel.classList.toggle('gm-mobile-floating',this.mobile);
  if(!this.mobile)return;
  this.layout??=defaultFloatingPanelLayout(this.viewport());
  this.reflow();
 }
 reflow(){
  if(!this.mobile)return;
  this.layout=clampFloatingPanelLayout(this.layout||defaultFloatingPanelLayout(this.viewport()),
   this.viewport(),this.collapsed);
  const {x,y,width,height}=this.layout;
  this.panel.style.setProperty('--gm-editor-x',x+'px');
  this.panel.style.setProperty('--gm-editor-y',y+'px');
  this.panel.style.setProperty('--gm-editor-width',width+'px');
  this.panel.style.setProperty('--gm-editor-height',height+'px');
  this.panel.dataset.gmCollapsed=String(this.collapsed);
  const toggle=this.panel.querySelector('[data-gm-panel-toggle]');
  if(toggle){
   toggle.textContent=this.collapsed?'展開':'收合';
   toggle.setAttribute('aria-expanded',String(!this.collapsed));
  }
 }
 setCollapsed(value){
  if(!this.mobile)return;
  this.collapsed=!!value;
  this.reflow();this.persist();
 }
 collapseForScene(){
  if(this.mobile)this.setCollapsed(true);
 }
 reset(){
  if(!this.mobile)return;
  this.layout=defaultFloatingPanelLayout(this.viewport());
  this.collapsed=false;
  this.reflow();this.persist();
 }
 persist(){
  if(!this.mobile||!this.layout)return;
  try{this.store?.setItem(this.storageKey,JSON.stringify({...this.layout,collapsed:this.collapsed}));}catch{}
 }
 start(e){
  if(!this.mobile||e.button!==0||this.pointer)return;
  const grip=e.target.closest('[data-gm-panel-resize]');
  const title=e.target.closest('[data-gm-panel-drag]');
  // BUILD can be resized from any outer edge, using the same controller
  // and viewport constraints as the GM floating panel.
  const rect=this.panel.getBoundingClientRect(),edge=7;
  const edgeX=this.force?(e.clientX-rect.left<=edge?-1:rect.right-e.clientX<=edge?1:0):0;
  const edgeY=this.force?(e.clientY-rect.top<=edge?-1:rect.bottom-e.clientY<=edge?1:0):0;
  if(!title&&!grip&&!edgeX&&!edgeY)return;
  if(!grip&&e.target.closest('button,input,select,textarea'))return;
  e.preventDefault();e.stopPropagation();
  this.pointer={id:e.pointerId,type:grip||edgeX||edgeY?'resize':'drag',edgeX:grip?1:edgeX,edgeY:grip?1:edgeY,x:e.clientX,y:e.clientY,
   layout:{...this.layout}};
  try{this.panel.setPointerCapture(e.pointerId);}catch{}
 }
 move(e){
  const p=this.pointer;if(!p||p.id!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();
  const dx=e.clientX-p.x,dy=e.clientY-p.y;
  const candidate={...p.layout};
  if(p.type==='drag'){candidate.x+=dx;candidate.y+=dy;}
  else{
   if(p.edgeX>0)candidate.width+=dx;
   if(p.edgeX<0){candidate.width=Math.max(MIN_WIDTH,p.layout.width-dx);candidate.x=p.layout.x+p.layout.width-candidate.width;}
   if(p.edgeY>0)candidate.height+=dy;
   if(p.edgeY<0){candidate.height=Math.max(MIN_HEIGHT,p.layout.height-dy);candidate.y=p.layout.y+p.layout.height-candidate.height;}
  }
  this.layout=clampFloatingPanelLayout(candidate,this.viewport(),this.collapsed);
  this.reflow();
 }
 end(e){
  if(!this.pointer||this.pointer.id!==e.pointerId)return;
  this.pointer=null;this.persist();
  try{if(this.panel.hasPointerCapture(e.pointerId))this.panel.releasePointerCapture(e.pointerId);}catch{}
 }
}
