import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {ARENA_RADIUS} from './shared/arena.js';

// GM platform editor: local blue 3D manipulation preview followed by an
// authoritative save. Never mutate physics / shared world during a drag.
export class PlatformDeleteEditor {
 constructor({canvas,camera,arena,ui,editor,isGM,send,controller,cancelBuild}){
  Object.assign(this,{canvas,camera,arena,ui,editor,isGM,send,controller,cancelBuild});
  this.active=false;this.mode=null;this.kind='disc';this.selectedKey=null;
  this.draft=null;this.follow=false;this.saving=false;this.dragging=false;
  this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  this.proxy=null;this.frame=null;this.gizmoMode='translate';
  this.gizmo=new TransformControls(camera,canvas);
  this.gizmo.setSpace('world');this.gizmo.setSize(.9);this.gizmo.visible=false;
  arena.scene.add(this.gizmo);
  this.gizmo.addEventListener('dragging-changed',event=>{
   this.dragging=!!event.value;
   this.controller()?.setEnabled(false);
  });
  this.gizmo.addEventListener('objectChange',()=>{
   if(!this.proxy||!this.draft||this.mode!=='edit')return;
   const proxy=this.proxy;
   // The server validates the same arena bounds on SAVE. Keep the handles
   // within that range, including the platform's non-negative base altitude.
   const p=proxy.position;
   const radius=Math.hypot(p.x,p.z);
   if(radius>ARENA_RADIUS){p.x*=ARENA_RADIUS/radius;p.z*=ARENA_RADIUS/radius;}
   p.y=THREE.MathUtils.clamp(p.y,0,60);
   this.draft.position=p.toArray().map(n=>+n.toFixed(3));
   if(this.gizmoMode==='scale'){
    const x=proxy.scale.x,z=proxy.scale.z,old=this.draft.radius;
    const next=Math.abs(x-old)>Math.abs(z-old)?x:z;
    this.draft.radius=+THREE.MathUtils.clamp(Math.abs(next),.6,16).toFixed(3);
    if(this.selectedKey.startsWith('pedestal:'))
     this.draft.height=+THREE.MathUtils.clamp(Math.abs(proxy.scale.y),.2,16).toFixed(3);
    proxy.scale.set(this.draft.radius,this.selectedKey.startsWith('pedestal:')?this.draft.height:1,this.draft.radius);
   }
   this.refreshPreview();
   this.setStatus('UNSAVED · Drag an axis, then SAVE');
  });
  this.overlay=document.createElement('aside');
  this.overlay.id='gm-platform-overlay';
  this.overlay.style.cssText='position:fixed;right:12px;top:70px;z-index:1200;width:min(310px,calc(100vw - 24px));max-height:calc(100vh - 90px);overflow:auto;padding:12px;background:rgba(18,21,35,.95);color:white;border:1px solid #7186bb;border-radius:8px;font:13px system-ui;box-shadow:0 5px 25px #0009';
  this.overlay.hidden=true;document.body.append(this.overlay);
  const typing=e=>/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)||e.target?.isContentEditable;
  addEventListener('keydown',e=>{
   if(!this.isGM()||typing(e))return;
   if(e.shiftKey&&e.code==='KeyD'&&!e.repeat){
    e.preventDefault();e.stopImmediatePropagation();
    if(this.active)this.cancel();else this.begin('edit');return;
   }
   if(!this.active)return;
   if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.cancel();return;}
   if((e.code==='Delete'||e.code==='Backspace')&&this.mode==='edit'&&!e.repeat){
    e.preventDefault();e.stopImmediatePropagation();void this.removeSelected();return;
   }
   if(this.mode==='edit'&&this.selectedKey&&!e.repeat&&['KeyG','KeyT'].includes(e.code)){
    e.preventDefault();e.stopImmediatePropagation();this.setGizmoMode(e.code==='KeyG'?'translate':'scale');return;
   }
   if(['Enter','NumpadEnter','KeyE'].includes(e.code)&&!e.repeat){
    e.preventDefault();e.stopImmediatePropagation();
    if(this.mode==='place')void this.place();
    else if(this.selectedKey)void this.saveSelected();
   }
  },{capture:true});
  // TransformControls must receive pointerdown BEFORE scene picking.
  // The previous capture-phase stopImmediatePropagation blocked all dragging.
  let press=null;
  canvas.addEventListener('pointerdown',e=>{
   if(!this.active||this.mode!=='edit'||e.button!==0)return;
   press={x:e.clientX,y:e.clientY};
  },{capture:true});
  canvas.addEventListener('pointerup',e=>{
   if(!this.active||this.mode!=='edit'||e.button!==0||!press)return;
   const moved=Math.hypot(e.clientX-press.x,e.clientY-press.y);
   press=null;
   if(moved>5||this.dragging||this.gizmo.axis)return;
   const bounds=canvas.getBoundingClientRect();
   this.pointer.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);
   this.ray.setFromCamera(this.pointer,this.camera);
   const selected=this.arena.displayPlatforms?.pick(this.ray);
   if(selected){e.preventDefault();e.stopImmediatePropagation();this.select(selected);}
  },{capture:true});
  this.overlay.addEventListener('click',e=>{
   const command=e.target.closest('[data-platform-command]')?.dataset.platformCommand;
   if(!command)return;
   if(command==='close')this.cancel();
   else if(command==='save')void this.saveSelected();
   else if(command==='delete')void this.removeSelected();
   else if(command==='place')void this.place();
   else if(command==='translate'||command==='scale')this.setGizmoMode(command);
  });
  ui.addEventListener('panel',e=>{if(e.detail.open&&this.active)this.cancel();});
 }
 setStatus(message){
  const status=this.overlay.querySelector('[data-platform-status]');
  if(status)status.textContent=message;
 }
 setGizmoMode(mode){
  if(!this.proxy)return;
  this.gizmoMode=mode==='scale'?'scale':'translate';
  this.gizmo.setMode(this.gizmoMode);
  for(const button of this.overlay.querySelectorAll('[data-platform-command="translate"],[data-platform-command="scale"]')){
   const chosen=button.dataset.platformCommand===this.gizmoMode;
   button.style.background=chosen?'#186de3':'#2d3547';
   button.style.color='#fff';
   button.setAttribute('aria-pressed',String(chosen));
  }
  this.setStatus(this.gizmoMode==='scale'?'DRAG AXIS CUBES · X/Z: radius · Y: pedestal height':'DRAG RED / GREEN / BLUE ARROWS · X / Y / Z');
 }
 destroyProxy(){
  this.gizmo.detach();this.gizmo.visible=false;this.dragging=false;
  if(this.frame){this.frame.removeFromParent();this.frame.geometry.dispose();this.frame.material.dispose();this.frame=null;}
  if(this.proxy){
   const material=this.proxy.children[0]?.material;
   this.proxy.removeFromParent();
   material?.dispose();
   this.proxy=null;
  }
 }
 attachProxy(disc){
  this.destroyProxy();
  const cone=disc.key.startsWith('pedestal:');
  const geometry=cone?this.arena.displayPlatforms.coneGeometry:this.arena.displayPlatforms.geometry;
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0x247fff,transparent:true,opacity:.83,depthWrite:false,depthTest:true}));
  mesh.position.y=cone?.5:-.2;
  mesh.name=cone?'Selected pedestal editable mesh':'Selected disc editable mesh';
  const proxy=new THREE.Group();proxy.name='GM platform transform';
  proxy.add(mesh);proxy.position.fromArray(this.draft.position);
  proxy.scale.set(this.draft.radius,cone?this.draft.height:1,this.draft.radius);
  this.arena.scene.add(proxy);this.proxy=proxy;
  this.frame=new THREE.BoxHelper(proxy,0x65d4ff);this.arena.scene.add(this.frame);
  this.arena.displayPlatforms?.previewSelected(disc.key,this.draft.position,this.draft.radius,this.draft.height);
  this.gizmo.attach(proxy);this.gizmo.visible=true;
  this.setGizmoMode('translate');
 }
 begin(mode='edit',kind='disc'){
  if(!this.isGM())return;
  if(this.editor.dirty){this.ui.toast('請先儲存或取消作品編輯');return;}
  if(this.editor.selected)this.editor.close();
  if(this.ui.buildKind)this.cancelBuild?.();
  if(this.ui.panelName)this.ui.closePanel();
  this.cancel(false);
  this.active=true;this.mode=mode;this.kind=kind;
  this.ui.platformDeleteMode=mode==='edit';
  this.ui.platformToolMode=mode;
  this.controller()?.setEnabled(mode==='place');
  this.overlay.hidden=false;
  if(mode==='place'){
   this.draft={position:[0,0,0],radius:kind==='disc'?2.5:.6,height:.62};
   this.overlay.innerHTML=`<b>GM · ${kind==='disc'?'新增桃紅色圓盤':'新增灰色三角檯座'}</b>
    <p>物件跟隨角色前方。移動角色後按 PLACE / ENTER 固定，ESC 取消。</p>
    <button type="button" data-platform-command="place">PLACE</button>
    <button type="button" data-platform-command="close">取消</button>`;
   this.update();
  }else{
   this.overlay.innerHTML='<b>GM · 編輯展示物件</b><p>直接點選桃紅圓盤或灰色三角檯座。點選後顯示藍色拖曳框與三軸。Shift+D / ESC 離開。</p><button type="button" data-platform-command="close">關閉</button>';
  }
 }
 select(disc){
  if(!this.active||this.mode!=='edit')return;
  this.follow=false;this.controller()?.setEnabled(false);
  this.arena.displayPlatforms?.clearPreview();
  this.selectedKey=disc.key;
  this.draft={position:[...(disc.editPosition||[disc.position[0],disc.top||0,disc.position[2]])],
   radius:disc.radius,height:disc.height||.62};
  this.arena.displayPlatforms?.select(disc.key);
  const cone=disc.key.startsWith('pedestal:');
  this.overlay.innerHTML=`<b>GM · ${cone?'灰色三角檯座':'桃紅色圓盤'}（藍色選取框）</b>
   <small style="display:block;overflow-wrap:anywhere;margin:5px 0">${disc.key}</small>
   <p style="margin:9px 0">拖曳紅、綠、藍三軸箭頭移動。切換尺寸後拖曳三軸方塊縮放，不需輸入數值。</p>
   <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
    <button type="button" data-platform-command="translate">MOVE · G</button>
    <button type="button" data-platform-command="scale">RESIZE · T</button>
    <button type="button" data-platform-command="save">SAVE · ENTER</button>
    <button type="button" data-platform-command="delete">DELETE</button>
    <button type="button" data-platform-command="close">CLOSE</button>
   </div>
   <p data-platform-status role="status" style="font:12px system-ui;margin:8px 0 0;color:#a5d3ff"></p>`;
  this.attachProxy(disc);
 }
 refreshPreview(){
  if(!this.selectedKey||!this.draft)return;
  if(this.proxy){
   this.proxy.position.fromArray(this.draft.position);
   this.proxy.scale.set(this.draft.radius,this.selectedKey.startsWith('pedestal:')?this.draft.height:1,this.draft.radius);
   this.frame?.update();
  }
  this.arena.displayPlatforms?.previewSelected(this.selectedKey,this.draft.position,this.draft.radius,this.draft.height);
 }
 update(){
  if(this.proxy&&this.frame)this.frame.update();
  if(!this.active||!this.controller())return;
  if(this.mode==='place'){
   const placement=this.controller().buildPosition(4);
   if(!placement||!placement.every(Number.isFinite))return;
   this.draft.position=[placement[0],Math.max(0,placement[1]),placement[2]];
   this.arena.displayPlatforms?.previewPlacement(this.kind,this.draft.position,this.draft.radius,this.draft.height);
  }
 }
 async place(){
  if(!this.active||this.mode!=='place'||this.saving)return;
  this.saving=true;
  try{
   const result=await this.send('create-platform',{kind:this.kind,...this.draft});
   if(result?.platformId){this.ui.toast('已固定展示物件位置');this.cancel();}
  }finally{this.saving=false;}
 }
 async saveSelected(){
  if(!this.active||this.mode!=='edit'||!this.selectedKey||this.saving)return;
  this.saving=true;
  const key=this.selectedKey;
  try{
   const result=await this.send('update-platform',{platformId:key,...this.draft});
   if(result?.platformId===key){
    this.setStatus('SAVED · Changes synced to all players');
    this.refreshPreview();
   }else this.setStatus('SAVE FAILED · Changes remain local');
  }catch(error){
   this.setStatus('SAVE FAILED · '+(error?.message||'Server error'));
  }finally{this.saving=false;}
 }
 async removeSelected(){
  if(!this.active||this.mode!=='edit'||!this.selectedKey||this.saving)return;
  this.saving=true;const key=this.selectedKey;
  try{
   const result=await this.send('delete-platform',{platformId:key});
   if(result?.platformId===key){
    this.arena.displayPlatforms?.clearPreview();
    this.arena.displayPlatforms?.select(null);
    this.destroyProxy();
    this.selectedKey=null;this.draft=null;
    this.overlay.innerHTML='<b>GM · 編輯展示物件</b><p>已刪除。點選下一個圓盤或三角檯座繼續編輯。</p><button type="button" data-platform-command="close">關閉</button>';
   }
  }finally{this.saving=false;}
 }
 cancel(notify=true){
  const wasActive=this.active;
  this.active=false;this.mode=null;this.follow=false;
  this.selectedKey=null;this.draft=null;
  this.ui.platformDeleteMode=false;this.ui.platformToolMode='';
  this.arena.displayPlatforms?.clearPreview();
  this.arena.displayPlatforms?.stopPlacement();
  this.arena.displayPlatforms?.select(null);
  this.destroyProxy();
  this.overlay.hidden=true;
  this.controller()?.setEnabled(!this.ui.panelName&&!this.editor.mode);
  if(notify&&wasActive)this.ui.toast('已退出 GM 展示物件編輯');
 }
}
