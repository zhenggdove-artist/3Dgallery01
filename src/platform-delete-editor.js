import * as THREE from 'three';

// GM scene editor: authoritative saves; blue visual preview stays local until
// SAVE/PLACE. Existing exhibition artworks are never deleted with a support.
export class PlatformDeleteEditor {
 constructor({canvas,camera,arena,ui,editor,isGM,send,controller,cancelBuild}){
  Object.assign(this,{canvas,camera,arena,ui,editor,isGM,send,controller,cancelBuild});
  this.active=false;this.mode=null;this.kind='disc';this.selectedKey=null;
  this.draft=null;this.follow=false;this.saving=false;
  this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();
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
   if(['Enter','NumpadEnter','KeyE'].includes(e.code)&&!e.repeat){
    e.preventDefault();e.stopImmediatePropagation();
    if(this.mode==='place')void this.place();
    else if(this.follow)void this.saveSelected();
   }
  },{capture:true});
  canvas.addEventListener('pointerdown',e=>{
   if(this.active&&this.mode==='edit'&&e.button===0){
    e.preventDefault();e.stopImmediatePropagation();
   }
  },{capture:true});
  canvas.addEventListener('pointerup',e=>{
   if(!this.active||this.mode!=='edit'||e.button!==0)return;
   e.preventDefault();e.stopImmediatePropagation();
   const bounds=canvas.getBoundingClientRect();
   this.pointer.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);
   this.ray.setFromCamera(this.pointer,this.camera);
   const selected=this.arena.displayPlatforms?.pick(this.ray);
   if(selected)this.select(selected);
   else this.ui.toast('點選桃紅色圓盤或灰色三角檯座');
  },{capture:true});
  this.overlay.addEventListener('input',e=>{
   const input=e.target.closest('[data-platform-field]');
   if(!input||!this.draft||this.saving)return;
   const value=Number(input.value);if(!Number.isFinite(value))return;
   const field=input.dataset.platformField;
   if(field.startsWith('p'))this.draft.position[Number(field.slice(1))]=value;
   else this.draft[field]=value;
   this.refreshPreview();
  });
  this.overlay.addEventListener('click',e=>{
   const command=e.target.closest('[data-platform-command]')?.dataset.platformCommand;
   if(!command)return;
   if(command==='close')this.cancel();
   if(command==='save')void this.saveSelected();
   if(command==='delete')void this.removeSelected();
   if(command==='place')void this.place();
   if(command==='follow'){
    this.follow=!this.follow;
    this.controller()?.setEnabled(this.follow);
    this.overlay.querySelector('[data-platform-command="follow"]').textContent=this.follow?'停止跟隨 GM':'跟隨 GM 移動';
    if(this.follow)this.ui.toast('移動 GM 到目標位置，再按 PLACE 或 ENTER');
   }
  });
  ui.addEventListener('panel',e=>{if(e.detail.open&&this.active)this.cancel();});
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
   this.overlay.innerHTML='<b>GM · 編輯展示物件</b><p>直接點選圓盤或三角檯座。選取後變成藍色，能修改位置、尺寸或刪除。Shift+D / ESC 離開。</p><button type="button" data-platform-command="close">關閉</button>';
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
  const axis=['X','Y','Z'].map((name,i)=>`<label style="display:flex;justify-content:space-between;gap:8px;margin:5px 0">${name} <input data-platform-field="p${i}" type="number" step=".1" value="${this.draft.position[i].toFixed(3)}" style="width:125px"></label>`).join('');
  this.overlay.innerHTML=`<b>GM · ${cone?'灰色三角檯座':'桃紅色圓盤'}（已選取：藍色）</b>
   <small style="display:block;overflow-wrap:anywhere">${disc.key}</small>
   ${axis}
   <label style="display:flex;justify-content:space-between;gap:8px;margin:5px 0">半徑 <input data-platform-field="radius" type="number" min=".6" max="16" step=".1" value="${this.draft.radius.toFixed(3)}" style="width:125px"></label>
   ${cone?`<label style="display:flex;justify-content:space-between;gap:8px;margin:5px 0">高度 <input data-platform-field="height" type="number" min=".2" max="16" step=".1" value="${this.draft.height.toFixed(3)}" style="width:125px"></label>`:''}
   <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
    <button type="button" data-platform-command="follow">跟隨 GM 移動</button>
    <button type="button" data-platform-command="save">SAVE / PLACE</button>
    <button type="button" data-platform-command="delete">刪除</button>
    <button type="button" data-platform-command="close">關閉</button>
   </div>`;
 }
 refreshPreview(){
  if(!this.selectedKey||!this.draft)return;
  this.arena.displayPlatforms?.previewSelected(this.selectedKey,this.draft.position,this.draft.radius,this.draft.height);
 }
 update(){
  if(!this.active||!this.controller())return;
  if(this.mode==='place'||this.follow){
   const placement=this.controller().buildPosition(4);
   if(!placement||!placement.every(Number.isFinite))return;
   this.draft.position=[placement[0],Math.max(0,placement[1]),placement[2]];
   if(this.mode==='place')this.arena.displayPlatforms?.previewPlacement(this.kind,this.draft.position,this.draft.radius,this.draft.height);
   else{
    for(let i=0;i<3;i++){
     const field=this.overlay.querySelector(`[data-platform-field="p${i}"]`);
     if(field&&document.activeElement!==field)field.value=this.draft.position[i].toFixed(3);
    }
    this.refreshPreview();
   }
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
    this.follow=false;this.controller()?.setEnabled(false);
    this.arena.displayPlatforms?.clearPreview();
    this.arena.displayPlatforms?.select(key);
    const button=this.overlay.querySelector('[data-platform-command="follow"]');
    if(button)button.textContent='跟隨 GM 移動';
   }
  }finally{this.saving=false;}
 }
 async removeSelected(){
  if(!this.active||this.mode!=='edit'||!this.selectedKey||this.saving)return;
  this.saving=true;const key=this.selectedKey;
  try{
   const result=await this.send('delete-platform',{platformId:key});
   if(result?.platformId===key){
    this.follow=false;this.controller()?.setEnabled(false);
    this.arena.displayPlatforms?.clearPreview();this.arena.displayPlatforms?.select(null);
    this.selectedKey=null;this.draft=null;
    this.overlay.innerHTML='<b>GM · 編輯展示物件</b><p>物件已刪除。點選下一個展示物件繼續編輯。</p><button type="button" data-platform-command="close">關閉</button>';
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
  this.overlay.hidden=true;
  this.controller()?.setEnabled(!this.ui.panelName&&!this.editor.mode);
  if(notify&&wasActive)this.ui.toast('已退出 GM 展示物件編輯');
 }
}
