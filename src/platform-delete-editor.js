import * as THREE from 'three';

// Explicit GM-only mode: select an instanced circular platform, highlight blue,
// DELETE on the authoritative server, ESC to restore normal game interaction.
export class PlatformDeleteEditor {
 constructor({canvas,camera,arena,ui,editor,isGM,send,controller}){
  Object.assign(this,{canvas,camera,arena,ui,editor,isGM,send,controller});
  this.active=false;this.selectedKey=null;this.deleting=false;
  this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  const typing=e=>/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)||e.target?.isContentEditable;
  addEventListener('keydown',e=>{
   if(!this.isGM()||typing(e))return;
   if(e.shiftKey&&e.code==='KeyD'&&!e.repeat){
    e.preventDefault();e.stopImmediatePropagation();
    if(this.active)this.cancel();
    else this.begin();
    return;
   }
   if(!this.active)return;
   if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.cancel();return;}
   if((e.code==='Delete'||e.code==='Backspace')&&!e.repeat){
    e.preventDefault();e.stopImmediatePropagation();void this.removeSelected();
   }
  },{capture:true});
  // Consume pointer input before the avatar camera and artwork transform editor.
  canvas.addEventListener('pointerdown',e=>{
   if(!this.active||e.button!==0)return;
   e.preventDefault();e.stopImmediatePropagation();
  },{capture:true});
  canvas.addEventListener('pointerup',e=>{
   if(!this.active||e.button!==0)return;
   e.preventDefault();e.stopImmediatePropagation();
   const bounds=canvas.getBoundingClientRect();
   this.pointer.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);
   this.ray.setFromCamera(this.pointer,this.camera);
   const selected=this.arena.displayPlatforms?.pick(this.ray);
   this.selectedKey=selected?.key||null;
   this.arena.displayPlatforms?.select(this.selectedKey);
   this.ui.toast(this.selectedKey?'圓盤已選取（藍色） · DELETE 刪除':'未點選圓盤 · ESC 離開');
  },{capture:true});
  ui.addEventListener('panel',e=>{if(e.detail.open&&this.active)this.cancel();});
 }
 begin(){
  if(this.editor.dirty){this.ui.toast('請先儲存或取消作品編輯');return;}
  if(this.editor.selected)this.editor.close();
  if(this.ui.panelName)this.ui.closePanel();
  this.active=true;this.selectedKey=null;this.ui.platformDeleteMode=true;
  this.controller()?.setEnabled(false);
  this.ui.toast('GM 圓盤刪除 · 點選變藍 · DELETE 刪除 · ESC 離開');
 }
 async removeSelected(){
  if(!this.active||this.deleting)return;
  const key=this.selectedKey;
  if(!key){this.ui.toast('請先點選要刪除的圓盤');return;}
  this.deleting=true;
  try{
   const result=await this.send('delete-platform',{platformId:key});
   if(result?.platformId===key){
    this.selectedKey=null;this.arena.displayPlatforms?.select(null);
   }
  }finally{this.deleting=false;}
 }
 cancel(){
  this.active=false;this.selectedKey=null;this.ui.platformDeleteMode=false;
  this.arena.displayPlatforms?.select(null);
  this.controller()?.setEnabled(!this.ui.panelName&&!this.editor.mode);
  this.ui.toast('已退出圓盤刪除模式');
 }
}
