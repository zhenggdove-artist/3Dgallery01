import * as THREE from 'three';
import {SpacePainter} from './space-painter.js';
import {cityPaintHit,structureSignPaintHit,ROOF_PAINT_RAY_RANGE,isRooftopPaintWall,paintPointInReach} from './shared/city-layout.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export class CityWallPainter{
 constructor({canvas,camera,scene,arena,renderer=null,controller,role,ownerKey=()=>null,isGM=()=>false,can3D=isGM,ui,send,loadRaster,beforeStart=()=>{}}){
  Object.assign(this,{canvas,camera,arena,controller,role,ownerKey,isGM,can3D,ui,send,beforeStart});
  this.space=new SpacePainter({scene,canvas,camera,send,ui,loadRaster,controller,arena,ownerKey,renderer});this.mode3D=false;this.access3D=false;
  this.spaceControls=document.getElementById('paint-3d-controls');this.spaceToggle=document.getElementById('paint-3d-toggle');this.spaceSettings=document.getElementById('paint-3d-settings');
  this.spaceToggle?.addEventListener('click',()=>this.setMode3D(!this.mode3D));
  const connect=document.getElementById('paint-3d-connect');
  if(connect){connect.checked=false;connect.addEventListener('change',()=>{if(!this.mode3D||this.paintTouches.size||!this.space.setConnected(connect.checked))connect.checked=this.space.connected;});}
  this.flightControls=document.getElementById('paint-3d-flight');this.flightPointers=new Map();
  const updateAxes=()=>{const axes=[0,0,0];for(const [axis,dir] of this.flightPointers.values())axes[axis]+=dir;const player=this.controller();if(player)player.paintAxes=axes.map(v=>clamp(v,-1,1));};
  this.clearFlight=()=>{this.flightPointers.clear();updateAxes();};
  for(const button of this.flightControls?.querySelectorAll('[data-paint-axis]')||[]){
   button.addEventListener('pointerdown',e=>{if(!this.active||this.role()!=='fighter'||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();e.stopPropagation();button.setPointerCapture(e.pointerId);this.flightPointers.set(e.pointerId,[Number(button.dataset.paintAxis),Number(button.dataset.paintDir)]);updateAxes();});
   for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>{if(this.flightPointers.delete(e.pointerId))updateAxes();e.stopPropagation();});
  }
  for(const button of this.flightControls?.querySelectorAll('[data-paint-turn]')||[]){
   button.addEventListener('click',e=>{e.stopPropagation();this.turn3D(Number(button.dataset.paintTurn));});
  }
  window.addEventListener('blur',this.clearFlight);
  document.getElementById('paint-3d-undo')?.addEventListener('click',()=>{if(this.mode3D)this.space.history(false);});
  document.getElementById('paint-3d-redo')?.addEventListener('click',()=>{if(this.mode3D)this.space.history(true);});
  this.thickness=.34;this.distance=12;
  for(const [id,key] of [['paint-3d-thickness','thickness'],['paint-3d-distance','distance']]){
   const input=document.getElementById(id),output=document.getElementById(id+'-value');if(!input)continue;
   const update=()=>{this[key]=Number(input.value);if(output)output.value=input.value;};
   if(key==='distance')for(const button of this.spaceSettings?.querySelectorAll('[data-paint-distance-step]')||[]){button.addEventListener('click',()=>{input.value=String(clamp(Number(input.value)+Number(button.dataset.paintDistanceStep),Number(input.min),Number(input.max)));update();});}
   input.addEventListener('input',update);let pointer=null;
   const slide=e=>{const rect=input.getBoundingClientRect(),t=clamp((e.clientX-rect.left)/Math.max(1,rect.width),0,1);input.value=String(Number(input.min)+(Number(input.max)-Number(input.min))*t);update();};
   input.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();e.stopPropagation();pointer=e.pointerId;input.setPointerCapture(pointer);slide(e);});
   input.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();e.stopPropagation();slide(e);}});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])input.addEventListener(type,e=>{if(e.pointerId!==pointer)return;if(type==='pointerup')slide(e);pointer=null;e.stopPropagation();});update();
  }
  this.active=false;this.tool='brush';this.color='#e73b33';this.size=.17;
  this.pointer=null;this.stroke=null;this.pending=Promise.resolve();
  this.paintTouches=new Map();this.touchCamera=false;this.touchDrawing=false;this.touchPair=null;this.mouseOrbit=null;this.guidePointer=null;
  this.button=document.getElementById('paint-button');
  this.toolbar=document.getElementById('paint-toolbar');
  this.brush=document.getElementById('paint-brush');
  this.eraser=document.getElementById('paint-eraser');
  this.eyedropper=document.getElementById('paint-3d-eyedropper');
  this.colorInput=document.getElementById('paint-color');
  this.sizeInput=document.getElementById('paint-size');
  this.button?.addEventListener('click',()=>this.setActive(!this.active));
  this.brush?.addEventListener('click',()=>this.setTool('brush'));
  this.eraser?.addEventListener('click',()=>this.setTool('eraser'));
  this.eyedropper?.addEventListener('click',()=>{if(this.mode3D&&this.can3D()&&this.space.pointer===null&&!this.paintTouches.size)this.setTool(this.tool==='eyedropper'?'brush':'eyedropper');});
  this.colorInput?.addEventListener('input',event=>{this.color=event.target.value;});
  const sizeLabel=document.getElementById('paint-size-value');
  const updateSize=()=>{this.size=clamp(Number(this.sizeInput.value),.04,.95);if(sizeLabel)sizeLabel.value=this.size.toFixed(2);};
  this.sizeInput?.addEventListener('input',updateSize);
  let sliderPointer=null;
  const slide=e=>{const r=this.sizeInput.getBoundingClientRect();const t=clamp((e.clientX-r.left)/Math.max(1,r.width),0,1);this.sizeInput.value=(.04+.91*t).toFixed(2);updateSize();};
  this.sizeInput?.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();e.stopPropagation();sliderPointer=e.pointerId;this.sizeInput.setPointerCapture(e.pointerId);slide(e);});
  this.sizeInput?.addEventListener('pointermove',e=>{if(e.pointerId===sliderPointer){e.preventDefault();e.stopPropagation();slide(e);}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])this.sizeInput?.addEventListener(type,e=>{if(e.pointerId!==sliderPointer)return;if(type==='pointerup')slide(e);sliderPointer=null;e.stopPropagation();});
  if(this.sizeInput)updateSize();
  this.toolbar?.querySelector('[data-paint-close]')?.addEventListener('click',()=>this.setActive(false));
  // Capture input before camera/attack handlers. Moving the game camera or
  // firing a gun during a stroke would permanently corrupt the paint coords.
  canvas.addEventListener('pointerdown',e=>this.down(e),true);
  canvas.addEventListener('pointermove',e=>this.move(e),true);
  canvas.addEventListener('pointerup',e=>this.up(e),true);
  canvas.addEventListener('pointercancel',e=>this.up(e),true);
  canvas.addEventListener('lostpointercapture',e=>this.up(e),true);
  canvas.addEventListener('contextmenu',e=>{if(this.active)e.preventDefault();});
  for(const type of ['touchend','touchcancel'])window.addEventListener(type,e=>this.reconcilePaintTouches(e),{capture:true,passive:true});
  window.addEventListener('blur',()=>{if(this.active){this.finishTouchStroke(false);this.resetPaintPointers();this.space.hideGuide();}});
  window.addEventListener('keydown',e=>{
   if(this.mode3D&&(e.ctrlKey||e.metaKey)&&!(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))&&['KeyZ','KeyY'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)this.space.history(e.code==='KeyY'||e.shiftKey);return;}
   if(this.active&&e.code==='Escape'){
    e.preventDefault();e.stopImmediatePropagation();this.setActive(false);
   }
  },true);
  this.setTool('brush');
 }
 turn3D(direction){
  if(!this.mode3D||!this.can3D()||this.space.pointer!==null||Math.abs(direction)!==1)return false;
  const player=this.controller();
  if(!player?.paintFlight||!player.enabled||player.role!=='fighter'||player.awaitingSpawn||player.status.freeze||player.status.root||performance.now()<(player.stunUntil||0)||performance.now()<(player.authorityHoldUntil||0)||player.panBlastFlight||player.vortexSpin||player.knockback||player.tidePush||player.whipPull)return false;
  const delta=direction*Math.PI/2;
  player.wantedArtworkView=null;
  player.yaw+=delta;player.root.rotation.y+=delta;
  player.updateCamera(0,true);return true;
 }
 sync3D(world){this.space.sync(world);this.refresh3D();}
 refresh3D(){
  const allowed=this.active&&this.can3D()&&this.role()==='fighter';if(allowed===this.access3D)return;
  this.access3D=allowed;if(this.spaceControls)this.spaceControls.hidden=!allowed;if(!allowed)this.setMode3D(false);
 }
 setMode3D(enabled){
  if(enabled&&(!this.active||!this.can3D()||this.role()!=='fighter'))return;
  if(enabled===this.mode3D)return;
  if(this.mode3D){if(!this.can3D())this.space.stroke=null;this.space.end();}else{this.finish();const pointer=this.pointer;this.pointer=null;if(pointer!==null&&this.canvas.hasPointerCapture(pointer))this.canvas.releasePointerCapture(pointer);}
  this.resetPaintPointers();this.space.hideGuide();this.mode3D=enabled;if(this.active)this.syncPaintFlight();this.spaceToggle?.classList.toggle('active',enabled);this.spaceToggle?.setAttribute('aria-pressed',String(enabled));if(this.spaceSettings)this.spaceSettings.hidden=!enabled;
  if(!enabled&&this.tool==='eyedropper')this.setTool('brush');
 }
 syncPaintFlight(){
  this.clearFlight();
  const active=this.active&&this.role()==='fighter';
  this.controller()?.setPaintFlight(active?(this.mode3D?true:'2d'):false);
  if(this.flightControls){
   this.flightControls.hidden=!active;
   const title=this.flightControls.querySelector('span');if(title)title.textContent=this.mode3D?'3D MOVE':'2D MOVE';
   for(const button of this.flightControls.querySelectorAll('[data-paint-turn]')){
    button.hidden=!this.mode3D;
    // Keep the existing grid layout and styling when returning to 3D.
    button.style.display=this.mode3D?'':'none';
   }
  }
 }
 setTool(tool){
  this.tool=tool;this.brush?.classList.toggle('active',tool==='brush');
  this.eraser?.classList.toggle('active',tool==='eraser');
  this.brush?.setAttribute('aria-pressed',String(tool==='brush'));
  this.eraser?.setAttribute('aria-pressed',String(tool==='eraser'));
  this.eyedropper?.classList.toggle('active',tool==='eyedropper');
  this.eyedropper?.setAttribute('aria-pressed',String(tool==='eyedropper'));
  if(tool==='eyedropper')this.space.hideGuide();
 }
 pick3DColor(event){
  if(!this.active||!this.mode3D||!this.can3D()||this.tool!=='eyedropper')return false;
  const color=this.space.pickColor(event);
  if(!color){this.ui.toast('Aim at an existing 3D stroke');return false;}
  this.color=color;if(this.colorInput)this.colorInput.value=color;
  this.setTool('brush');return true;
 }
 setActive(active){
  if(active&&this.role()!=='fighter'){this.ui.toast('Enter the arena to paint');return;}
  if(this.active===active)return;
  if(!active){this.active=false;this.setMode3D(false);this.finishTouchStroke(false);this.resetPaintPointers();this.space.hideGuide();}
  if(active)this.beforeStart();
  this.active=active;this.refresh3D();this.syncPaintFlight();
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
  const cityWall=cityPaintHit(origin,direction,18,this.arena.world?.cityDamage||{},ROOF_PAINT_RAY_RANGE),builtSign=structureSignPaintHit(this.arena.world?.structures,origin,direction,18,ROOF_PAINT_RAY_RANGE),hit=builtSign&&(!cityWall||builtSign.distance<cityWall.distance)?builtSign:cityWall,disc=this.arena.displayPlatforms?.paint.pick(origin,direction);const player=this.controller()?.root?.position;
  const wall=hit&&isRooftopPaintWall(hit.wall)&&!paintPointInReach(player?.toArray(),hit.position,hit.wall)?null:hit;
  const near=disc&&player&&disc.point.distanceTo(player.clone().add(new THREE.Vector3(0,1.4,0)))<=19;
  const existing=near&&(!wall||disc.distance<(wall.distance??Infinity))?disc:wall;
  const space=this.space.pickSurface(event,player);return space&&(!existing||space.distance<(existing.distance??Infinity))?space:existing;
 }
 consume(event){
  event.preventDefault();event.stopImmediatePropagation();
 }
 updateGuide(){
  if(!this.mode3D||this.tool!=='brush'){this.space.hideGuide();return;}
  const touch=!this.touchCamera&&this.paintTouches.size===1?this.paintTouches.values().next().value:null;
  const pointer=touch?(this.touchDrawing?touch.last:touch.start):this.guidePointer;
  this.space.updateGuide(pointer,{color:this.color,size:this.size,thickness:this.thickness,distance:this.distance},this.arena);
 }
 resetPaintPointers(){
  const ids=[...this.paintTouches.keys()];if(this.mouseOrbit)ids.push(this.mouseOrbit.id);
  this.paintTouches.clear();this.touchCamera=false;this.touchDrawing=false;this.touchPair=null;this.mouseOrbit=null;this.guidePointer=null;
  for(const id of ids)if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
 }
 finishTouchStroke(retainCapture=true){
  if(this.mode3D)this.space.end(null,retainCapture);
  else{const id=this.pointer;this.pointer=null;this.finish();if(!retainCapture&&id!==null&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}
  this.touchDrawing=false;
 }
 pairMetrics(){
  if(this.paintTouches.size!==2)return null;
  const [a,b]=[...this.paintTouches.values()].map(t=>t.last);
  return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2,span:Math.max(1,Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY))};
 }
 cameraGesture(pair){
  const player=this.controller(),previous=this.touchPair;this.touchPair=pair;
  if(!pair||!previous||!player?.enabled||player.status.freeze)return;
  player.distance=clamp(player.distance*previous.span/pair.span,3,50);
  player.orbitEditCamera(pair.x-previous.x,pair.y-previous.y);
 }
 touchDown(event){
  this.consume(event);this.guidePointer=null;
  if(this.paintTouches.has(event.pointerId)||this.mouseOrbit||(!this.paintTouches.size&&(this.pointer!=null||this.space.pointer!=null)))return;
  this.canvas.setPointerCapture(event.pointerId);
  this.paintTouches.set(event.pointerId,{start:event,last:event});
  if(this.paintTouches.size>1){
   if(!this.touchCamera&&this.touchDrawing)this.finishTouchStroke();
   this.touchCamera=true;this.touchPair=this.pairMetrics();
  }
 }
 touchMove(event){
  const touch=this.paintTouches.get(event.pointerId);if(!touch)return;
  this.consume(event);touch.last=event;
  if(this.touchCamera){this.cameraGesture(this.pairMetrics());return;}
  // Eyedropper samples only on release, never on the first finger of a pinch.
  if(this.mode3D&&this.tool==='eyedropper')return;
  if(!this.touchDrawing){
   if(Math.hypot(event.clientX-touch.start.clientX,event.clientY-touch.start.clientY)<3)return;
   this.touchDrawing=true;this.paintDown(touch.start,false);
  }
  this.paintMove(event);
 }
 touchUp(event){
  const touch=this.paintTouches.get(event.pointerId);if(!touch)return;
  this.consume(event);this.paintTouches.delete(event.pointerId);
  if(!this.touchCamera){
   if(this.mode3D&&this.tool==='eyedropper'){if(event.type==='pointerup')this.pick3DColor(event);}
   else{
    if(event.type==='pointerup'&&!this.touchDrawing)this.paintDown(touch.start,false);
    if(this.touchDrawing||event.type==='pointerup')this.paintUp(event);
   }
  }
  if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);
  this.touchPair=this.pairMetrics();
  if(!this.paintTouches.size){this.touchCamera=false;this.touchDrawing=false;this.touchPair=null;}
 }
 reconcilePaintTouches(event){
  if(!this.paintTouches.size)return;
  const live=[...event.touches].filter(t=>t.target===this.canvas);
  if(live.length>=this.paintTouches.size)return;
  const keep=new Set();
  for(const finger of live){
   let nearest=null,distance=Infinity;
   for(const [id,t] of this.paintTouches){
    if(keep.has(id))continue;
    const d=Math.hypot(finger.clientX-t.last.clientX,finger.clientY-t.last.clientY);
    if(d<distance){nearest=id;distance=d;}
   }
   if(nearest!==null)keep.add(nearest);
  }
  for(const [id,t] of [...this.paintTouches])if(!keep.has(id)){
   const ended={pointerId:id,pointerType:'touch',type:event.type==='touchend'?'pointerup':'pointercancel',clientX:t.last.clientX,clientY:t.last.clientY,preventDefault(){},stopImmediatePropagation(){}};
   this.touchUp(ended);
  }
 }
 down(event){
  if(!this.active)return;
  if(event.pointerType==='touch'){this.touchDown(event);return;}
  if(event.pointerType==='mouse'&&event.button===2){
   this.consume(event);if(this.pointer!==null||this.space.pointer!==null||this.paintTouches.size)return;
   this.mouseOrbit={id:event.pointerId,x:event.clientX,y:event.clientY};this.canvas.setPointerCapture(event.pointerId);return;
  }
  if(this.paintTouches.size||this.mouseOrbit){this.consume(event);return;}
  this.paintDown(event);
 }
 move(event){
  if(!this.active)return;
  if(event.pointerType==='touch'){this.touchMove(event);return;}
  if(event.pointerType==='mouse'||event.pointerType==='pen')this.guidePointer={clientX:event.clientX,clientY:event.clientY};
  if(this.mouseOrbit?.id===event.pointerId){
   this.consume(event);const orbit=this.mouseOrbit,player=this.controller();
   if(player?.enabled&&!player.status.freeze)player.orbitEditCamera(event.clientX-orbit.x,event.clientY-orbit.y);
   orbit.x=event.clientX;orbit.y=event.clientY;return;
  }
  this.paintMove(event);
 }
 up(event){
  if(event.pointerType==='touch'){this.touchUp(event);return;}
  if(this.mouseOrbit?.id===event.pointerId){
   this.consume(event);this.mouseOrbit=null;if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);return;
  }
  this.paintUp(event);
 }
 paintDown(event,capture=true){
  if(!this.active||this.pointer!==null)return;
  // Reserve middle mouse for GM camera orbit, not paint input swallowing.
  if(event.button!==0&&event.pointerType==='mouse')return;
  this.consume(event);
  if(this.mode3D){if(this.tool==='eyedropper'){this.pick3DColor(event);return;}this.space.down(event,{tool:this.tool,color:this.color,size:this.size,thickness:this.thickness,distance:this.distance},capture);return;}
  const hit=this.pick(event);
  if(!hit){this.ui.toast('Aim at a nearby wall, sign, pink disc or 3D surface');return;}
  this.pointer=event.pointerId;
  if(capture)this.canvas.setPointerCapture(event.pointerId);
  this.start(hit);
 }
 start(hit){
  this.stroke={lotId:hit.lotId,wall:hit.wall,tool:this.tool,owner:this.ownerKey(),...(this.tool==='eraser'?{eraseOwn:true}:{}),
   color:this.color,size:this.size,clientId:globalThis.crypto?.randomUUID?.()||('local-'+Date.now()+'-'+Math.random().toString(36).slice(2)),points:[]};
  if(hit.wall.startsWith('space:')){this.stroke.id=hit.lotId;this.stroke.chart=Number(hit.wall.slice(6));}
  this.append(hit);
 }
 append(hit){
  if(!this.stroke||!hit||hit.lotId!==this.stroke.lotId||hit.wall!==this.stroke.wall)return false;
  const p=[+hit.u.toFixed(4),+hit.v.toFixed(4)];
  const pts=this.stroke.points,last=pts.at(-1);
  if(this.stroke.id){
   let dv=last?p[1]-last[1]:0;if(this.stroke.chart===0)dv-=Math.round(dv);
   if(last&&Math.hypot((p[0]-last[0])*(this.stroke.chart===0?hit.info.total:hit.info.a*2),dv*(this.stroke.chart===0?hit.info.circumference:hit.info.b*2))<.008)return true;
   pts.push(p);this.space.previewSurface(this.stroke);return true;
  }
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
  (this.stroke.wall==='top'?this.arena.displayPlatforms.paint:this.arena.outerCity.wallPaint).preview(this.stroke);
  return true;
 }
 paintMove(event){
  if(this.mode3D){if(event.pointerId===this.space.pointer){this.consume(event);this.space.move(event);}return;}
  if(!this.active||event.pointerId!==this.pointer)return;
  if(event.pointerType==='mouse'&&(event.buttons&4))return;
  this.consume(event);
  const hit=this.pick(event);
  if(!this.stroke){if(hit)this.start(hit);return;}
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
 paintUp(event){
  if(this.mode3D){if(event.pointerId===this.space.pointer&&!(event.type==='pointerup'&&event.pointerType==='mouse'&&event.button!==0)){this.consume(event);this.space.end(event);}return;}
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
  if(stroke.id){this.space.queueSurface(stroke);this.pending=this.pending.catch(()=>{}).then(async()=>{let revision=null;try{const result=await this.send('paint-space-surface',{stroke});if(!result?.spaceSurfacePainted)throw Error('3D surface paint could not be saved');revision=result.spaceSurfaceRevision;}catch(error){this.ui.toast(error.message||'3D surface paint could not be saved');}finally{this.space.finishSurface(stroke,revision);}});return;}
  const paint=stroke.wall==='top'?this.arena.displayPlatforms?.paint:this.arena.outerCity?.wallPaint;
  // Move the finished segment into a local pending layer before starting
  // the next segment. Keep it visible throughout HTTP and snapshot latency.
  paint?.queuePreview(stroke);
  this.pending=this.pending.catch(()=>{}).then(async()=>{
   try{const result=await this.send(stroke.wall==='top'?'paint-disc':'paint-building',{stroke});if(!result?.paintStroke)throw Error('Paint could not be saved');paint?.ackPreview(stroke,result.paintStroke);}
   catch(error){paint?.rejectPreview(stroke);this.ui.toast(error?.message||'Paint could not be saved');}
  });
 }
}
