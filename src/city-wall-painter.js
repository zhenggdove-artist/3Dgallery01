import * as THREE from 'three';
import {cityPaintHit} from './shared/city-layout.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export class CityWallPainter{
 constructor({canvas,camera,arena,controller,role,ui,send,beforeStart=()=>{}}){
  Object.assign(this,{canvas,camera,arena,controller,role,ui,send,beforeStart});
  this.active=false;this.tool='brush';this.color='#e73b33';this.size=.17;
  this.pointer=null;this.stroke=null;this.pending=Promise.resolve();
  this.button=document.getElementById('paint-button');
  this.toolbar=document.getElementById('paint-toolbar');
  this.brush=document.getElementById('paint-brush');
  this.eraser=document.getElementById('paint-eraser');
  this.colorInput=document.getElementById('paint-color');
  this.sizeInput=document.getElementById('paint-size');
  this.button?.addEventListener('click',()=>this.setActive(!this.active));
  this.brush?.addEventListener('click',()=>this.setTool('brush'));
  this.eraser?.addEventListener('click',()=>this.setTool('eraser'));
  this.colorInput?.addEventListener('input',event=>{this.color=event.target.value;});
  this.sizeInput?.addEventListener('input',event=>{this.size=clamp(Number(event.target.value),.04,.95);});
  this.toolbar?.querySelector('[data-paint-close]')?.addEventListener('click',()=>this.setActive(false));
  // Capture input before camera/attack handlers. Moving the game camera or
  // firing a gun during a stroke would permanently corrupt the paint coords.
  canvas.addEventListener('pointerdown',e=>this.down(e),true);
  canvas.addEventListener('pointermove',e=>this.move(e),true);
  canvas.addEventListener('pointerup',e=>this.up(e),true);
  canvas.addEventListener('pointercancel',e=>this.up(e),true);
  canvas.addEventListener('lostpointercapture',e=>this.up(e),true);
  window.addEventListener('keydown',e=>{
   if(this.active&&e.code==='Escape'){
    e.preventDefault();e.stopImmediatePropagation();this.setActive(false);
   }
  },true);
  this.setTool('brush');
 }
 setTool(tool){
  this.tool=tool;this.brush?.classList.toggle('active',tool==='brush');
  this.eraser?.classList.toggle('active',tool==='eraser');
  this.brush?.setAttribute('aria-pressed',String(tool==='brush'));
  this.eraser?.setAttribute('aria-pressed',String(tool==='eraser'));
 }
 setActive(active){
  if(active&&this.role()!=='fighter'){this.ui.toast('Enter the arena to paint');return;}
  if(this.active===active)return;
  if(!active)this.finish();
  if(active)this.beforeStart();
  this.active=active;
  if(this.toolbar)this.toolbar.hidden=!active;
  // The menu otherwise stays over the palette and makes PAINT appear inert.
  if(active){
   this.ui.hud?.classList.remove('functions-open');
   document.getElementById('function-toggle')?.setAttribute('aria-expanded','false');
   this.button?.blur();
  }
  this.button?.setAttribute('aria-pressed',String(active));
  this.button?.classList.toggle('paint-active',active);
  document.body.classList.toggle('wall-paint-active',active);
  const player=this.controller();
  // Keep joystick/jump and keyboard movement functional while the canvas
  // captures painting strokes; only the canvas ray is in drawing mode.
  if(player)player.setEnabled(!this.ui.panelName);
 }
 stop(){this.setActive(false);}
 pick(event){
  if(!this.arena.outerCity||!this.controller())return null;
  const rect=this.canvas.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width*2-1;
  const y=1-(event.clientY-rect.top)/rect.height*2;
  this.camera.updateMatrixWorld(true);
  const origin=this.camera.position.toArray();
  const direction=new THREE.Vector3(x,y,.5).unproject(this.camera)
   .sub(this.camera.position).normalize().toArray();
  return cityPaintHit(origin,direction,18,this.arena.world?.cityDamage||{});
 }
 consume(event){
  event.preventDefault();event.stopImmediatePropagation();
 }
 down(event){
  if(!this.active||this.pointer!==null)return;
  // Reserve middle mouse for GM camera orbit, not paint input swallowing.
  if(event.button!==0&&event.pointerType==='mouse')return;
  this.consume(event);
  const hit=this.pick(event);
  if(!hit){this.ui.toast('Aim at a nearby building wall');return;}
  this.pointer=event.pointerId;
  this.canvas.setPointerCapture(event.pointerId);
  this.start(hit);
 }
 start(hit){
  this.stroke={lotId:hit.lotId,wall:hit.wall,tool:this.tool,
   color:this.color,size:this.size,points:[]};
  this.append(hit);
 }
 append(hit){
  if(!this.stroke||!hit||hit.lotId!==this.stroke.lotId||hit.wall!==this.stroke.wall)return false;
  const p=[+hit.u.toFixed(4),+hit.v.toFixed(4)];
  const pts=this.stroke.points,last=pts.at(-1);
  if(last&&Math.hypot((last[0]-p[0])*6,(last[1]-p[1])*6)<.008)return true;
  // Interpolate widely spaced pointer samples. This preserves continuous
  // handwriting on mobile where pointermove is often sparsely delivered.
  if(last){
   const dist=Math.hypot(p[0]-last[0],p[1]-last[1]);
   const count=Math.max(1,Math.ceil(dist/.018));
   for(let step=1;step<=count;step++){
    const t=step/count;
    pts.push([+(last[0]+(p[0]-last[0])*t).toFixed(4),
      +(last[1]+(p[1]-last[1])*t).toFixed(4)]);
   }
  }else pts.push(p);
  this.arena.outerCity.wallPaint.preview(this.stroke);
  return true;
 }
 move(event){
  if(!this.active||event.pointerId!==this.pointer||!this.stroke)return;
  if(event.pointerType==='mouse'&&(event.buttons&4))return;
  this.consume(event);
  const hit=this.pick(event);
  if(!hit||hit.lotId!==this.stroke.lotId||hit.wall!==this.stroke.wall){
   this.finish();
   if(hit)this.start(hit);
   return;
  }
  this.append(hit);
  if(this.stroke?.points.length>=100){
   this.finish();
   this.start(hit);
  }
 }
 up(event){
  if(!this.active&&this.pointer===null)return;
  if(event.pointerType==='mouse'&&event.type==='pointerup'&&event.button!==0)return;
  if(this.pointer!==event.pointerId)return;
  this.consume(event);
  try{if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);}catch{}
  this.pointer=null;this.finish();
 }
 finish(){
  if(!this.stroke)return;
  const stroke=this.stroke;this.stroke=null;
  if(stroke.points.length>130)stroke.points=stroke.points.slice(0,130);
  const paint=this.arena.outerCity?.wallPaint;
  this.pending=this.pending.catch(()=>{}).then(async()=>{
   try{await this.send('paint-building',{stroke});}
   catch(error){this.ui.toast(error?.message||'Paint could not be saved');}
   finally{paint?.endPreview(stroke.lotId,stroke.wall,stroke);}
  });
 }
}
