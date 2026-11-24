import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {artworkDefinitions,artworkAppearanceDefaults,isArtwork22} from './shared/artwork-library.js';
import {applyArtworkAppearance,addArtworkTitlePlate,updateArtworkTitleVisibility} from './artwork-surface.js';
import {editorPanelMarkup} from './art-editor-panel.js';
import {FloatingGmEditorPanel} from './gm-floating-panel.js';

const handleCoordinates=[[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0]];
export const LABEL_LONG_PRESS_MS=600;
// Solve 2D projected screen movement against the artwork's local XY axes.
// This remains accurate under artwork rotation and non-uniform scale.
export function labelLocalDeltaFromScreen(dx,dy,basis){
 const det=basis.ax*basis.by-basis.ay*basis.bx;
 if(!Number.isFinite(det)||Math.abs(det)<1e-5)return null;
 return {x:(dx*basis.by-dy*basis.bx)/det,
         y:(basis.ax*dy-basis.ay*dx)/det};
}
export class ArtworkEditor{
  constructor({scene,camera,canvas,arena,player,isGM,ownerKey=()=>null,send,control,toast,focusArtwork=()=>{}}){
    Object.assign(this,{scene,camera,canvas,arena,player,isGM,ownerKey,send,control,toast,focusArtwork});this.selected=null;this.mode=null;this.dirty=false;this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.box=new THREE.Box3();this.panel=document.getElementById('art-editor');this.handles=document.getElementById('art-handles');this.labelHandles=document.getElementById('art-label-handles');this.floatingPanel=new FloatingGmEditorPanel(this.panel);
    this.handles.innerHTML='<svg aria-hidden="true"><polygon/></svg><div class="art-drag-target" data-art-drag-target aria-label="長按拖曳作品"></div>'+handleCoordinates.map(([x,y],i)=>`<button type="button" class="art-handle ${x*y===0?'midpoint':''}" data-handle="${i}" aria-label="${x*y===0?'非等比':'等比'} resize ${i+1}"></button>`).join('');this.polygon=this.handles.querySelector('polygon');this.artDragSurface=this.handles.querySelector('[data-art-drag-target]');
    this.labelHandles.innerHTML='<svg aria-hidden="true"><polygon/></svg><div class="label-drag-target" data-label-drag-target title="長按約 0.6 秒，拖曳移動名稱框" aria-label="長按拖曳移動作品名稱條"></div>'+handleCoordinates.map(([x,y],i)=>`<button type="button" class="label-handle ${x*y===0?'midpoint':''}" data-label-handle="${i}" aria-label="${x*y===0?'單邊':'等比'} 調整名稱底色框"></button>`).join('');this.labelPolygon=this.labelHandles.querySelector('polygon');this.labelDragSurface=this.labelHandles.querySelector('[data-label-drag-target]');
    this.gizmo=new TransformControls(camera,canvas);this.gizmo.setSpace('local');this.gizmo.setSize(.8);scene.add(this.gizmo);this.gizmo.addEventListener('dragging-changed',e=>this.control(!e.value&&!this.mode));this.gizmo.addEventListener('objectChange',()=>{this.dirty=true;this.status('尚未儲存');this.updateFields();});
    let press=null;canvas.addEventListener('pointerdown',e=>{if(this.isGM()&&e.button===0)press={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',e=>{if(!press||!this.isGM())return;const distance=Math.hypot(press.x-e.clientX,press.y-e.clientY);press=null;if(distance>4||this.gizmo.axis||this.mode)return;this.raycast(e);const hits=this.ray.intersectObjects([...arena.artworks.values()].filter(o=>o.visible),true);for(const hit of hits){let root=hit.object;while(root&&!root.userData.platformId)root=root.parent;if(root){const clickedLabel=hit.object===root.userData.titlePlate||hit.object.parent===root.userData.titlePlate;this.select(root);if(clickedLabel)this.edit('label');break;}}});
    addEventListener('keydown',e=>{if((!this.isGM()&&!this.selected)||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;if(e.shiftKey&&['KeyT','KeyR','KeyG'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(!this.selected)return this.toast('請先點選作品');this.edit({KeyT:'scale',KeyR:'rotate',KeyG:'translate'}[e.code]);}if(e.code==='Escape'&&this.selected){e.stopImmediatePropagation();this.close();}},{capture:true});
    this.handles.addEventListener('pointerdown',e=>this.beginArtworkMove(e));this.handles.addEventListener('pointermove',e=>this.dragArtworkMove(e));for(const type of ['pointerup','pointercancel','lostpointercapture'])this.handles.addEventListener(type,e=>this.endArtworkMove(e));
    this.handles.addEventListener('pointerdown',e=>this.beginResize(e));this.handles.addEventListener('pointermove',e=>this.resize(e));this.handles.addEventListener('pointerup',()=>this.drag=null);this.handles.addEventListener('pointercancel',()=>this.drag=null);
    this.labelHandles.addEventListener('pointerdown',e=>this.beginLabelMove(e));
    this.labelHandles.addEventListener('pointermove',e=>this.dragLabelMove(e));
    for(const type of ['pointerup','pointercancel','lostpointercapture'])
     this.labelHandles.addEventListener(type,e=>this.endLabelMove(e));
    this.labelHandles.addEventListener('pointerdown',e=>this.beginLabelResize(e));
    this.labelHandles.addEventListener('pointermove',e=>this.resizeLabel(e));
    for(const type of ['pointerup','pointercancel','lostpointercapture'])
     this.labelHandles.addEventListener(type,()=>{this.labelDrag=null;});
    this.panel.addEventListener('click',e=>{const action=e.target.dataset.action;if(action==='follow'){if(this.mode==='follow'){this.mode=null;this.control(true);}else if(this.selected&&this.player()){this.followOffset=this.selected.position.clone().sub(this.player().position);this.mode='follow';this.gizmo.detach();this.handles.hidden=true;this.control(true);}this.status(this.mode==='follow'?'正在跟隨 GM · 再次點擊停止':'已停止跟隨');}if(action==='save')this.save();if(action==='apply-own-labels')void this.applyOwnLabels();if(action==='label-resize')this.edit('label');if(action==='label-center')this.centerLabel();if(action==='cancel')this.close();if(['scale','rotate','translate','move'].includes(action))this.edit(action);if(action==='export')this.export();});
    this.panel.addEventListener('input',e=>{
     if(!this.selected)return;
     const target=e.target;
     if(target.hasAttribute('data-art-title')){
      this.title=target.value.slice(0,120);
      this.selected.userData.editTitleDraft=this.title;
      applyArtworkAppearance(this.selected,this.appearance);
      this.panel.querySelector('[data-art-name]').textContent=this.title||'未命名作品';
      this.dirty=true;this.status('作品名稱尚未儲存');return;
     }
     if(target.hasAttribute('data-art-author')){this.author=target.value.slice(0,100);this.selected.userData.editAuthorDraft=this.author;applyArtworkAppearance(this.selected,this.appearance);this.dirty=true;this.status('作者姓名尚未儲存');return;}
     const key=target.dataset.appearance;
     if(!key)return;
     const value=target.type==='color'?target.value:Number(target.value);
     if(target.type==='number'&&(target.value===''||!Number.isFinite(value)))return;
     this.appearance[key]=value;
     applyArtworkAppearance(this.selected,this.appearance); // live drag/color-wheel preview
     if(key==='labelFontSize'){
      const output=this.panel.querySelector('[data-label-font-output]');
      if(output)output.textContent=value+'px';
     }
     if(key==='labelRevealDistance'){
      const output=this.panel.querySelector('[data-label-distance-output]');
      if(output)output.textContent=value+' m';
     }
     if(key==='labelNearFadeDistance'){
       const output=this.panel.querySelector('[data-label-near-output]');if(output)output.textContent=value+' m';
      }
      if(key==='labelNearMinOpacity'){
       const output=this.panel.querySelector('[data-label-opacity-output]');if(output)output.textContent=Math.round(value*100)+'%';
      }
      this.dirty=true;this.status(key==='labelNearFadeDistance'||key==='labelNearMinOpacity'?'近距離淡出已調整 · 儲存並關閉後生效':'名稱及外觀即時預覽 · 尚未儲存');
     if(this.mode==='label')this.updateLabelHandles();
    });
    this.panel.addEventListener('change',e=>{if(!this.selected)return;if(e.target.hasAttribute('data-platform-radius')){const n=Number(e.target.value);if(!Number.isFinite(n)||n<1.5||n>14){this.status('圓盤半徑限 1.5–14');return;}this.platformRadius=n;this.selected.userData.previewPlatformRadius=n;this.arena.displayPlatforms.sync();this.dirty=true;this.status('圓盤尺寸尚未儲存');return;}if(e.target.dataset.appearance)return;if(!e.target.dataset.axis)return;const [prop,index]=e.target.dataset.axis.split('-'),n=Number(e.target.value);if(!Number.isFinite(n))return;this.selected[prop].setComponent?this.selected[prop].setComponent(+index,n):this.selected.rotation[['x','y','z'][index]]=THREE.MathUtils.degToRad(n);this.dirty=true;this.status('尚未儲存');});
  }
  raycast(e){const rect=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);}
  canEdit(root){return !!root&&(this.isGM()||(this.arena.world?.customArtworks||[]).some(a=>a.id===root.userData.platformId&&a.owner===this.ownerKey()));}
  select(root){if(!this.canEdit(root))return this.toast('只能編輯自己上傳的作品');if(this.selected===root)return;const state=this.arena.world?.artworks?.[root.userData.platformId];if(!this.isGM()&&(state?.holder||state?.availableAt>Date.now()))return this.toast('作品返回後再編輯');if(this.dirty)return this.toast('請先儲存或取消目前編輯');this.close();this.selected=root;const platform=artworkDefinitions(this.arena.world).find(p=>p.id===root.userData.platformId),layout=this.arena.world?.artworkLayout?.[platform.id]||this.arena.defaultLayout[platform.id]||{position:platform.artPosition,rotation:[0,platform.artYaw,0],scale:[1,1,1]};this.expectedRevision=this.arena.world?.artworkLayout?.[platform.id]?.revision||0;this.original=structuredClone(layout);this.supportsPlatform=!(this.arena.world?.customArtworks||[]).some(a=>a.id===platform.id);this.platformRadius=layout.platformRadius??this.arena.displayPlatforms.discs.find(d=>d.display&&d.artwork===platform.id)?.radius??3;this.appearance={...artworkAppearanceDefaults(root.userData.record),...layout.appearance};this.title=String(layout.title??root.userData.record.title??'').slice(0,120);this.originalTitle=String(root.userData.record.title??'');this.originalAuthor=String(root.userData.record.author??'');this.author=String(layout.author??this.originalAuthor).slice(0,100);root.userData.editAuthorDraft=this.author;root.userData.editTitleDraft=this.title;root.userData.editing=true;root.position.fromArray(layout.position);root.rotation.set(...layout.rotation);root.scale.fromArray(layout.scale);root.updateMatrixWorld(true);addArtworkTitlePlate(root,this.title,this.appearance.labelBackground,this.appearance);
    const inverse=root.matrixWorld.clone().invert();this.box.makeEmpty();root.traverse(o=>{if(!o.geometry||o.isSprite)return;o.geometry.computeBoundingBox();this.box.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));});
    this.panel.hidden=false;this.panel.classList.toggle('player-art-editor',!this.isGM());this.floatingPanel.force=!this.isGM();this.panel.innerHTML=editorPanelMarkup(this.appearance,this.platformRadius,this.supportsPlatform,this.title,this.author,!this.isGM());this.panel.querySelector('[data-art-name]').textContent=this.title;this.floatingPanel.open();if(!this.isGM()){this.floatingPanel.setCollapsed(false);this.focusArtwork(root);this.edit('scale',false);}updateArtworkTitleVisibility(root,this.camera.position,true);this.updateFields();this.toast('已選取作品 · Shift+T 縮放／Shift+R 旋轉');
  }
  edit(mode,collapse=true){if(!this.canEdit(this.selected))return;this.endLabelMove();this.endArtworkMove();this.mode=mode;this.control(false);this.handles.hidden=!['scale','move'].includes(mode);this.labelHandles.hidden=mode!=='label';if(['scale','label','move'].includes(mode))this.gizmo.detach();else{this.gizmo.attach(this.selected);this.gizmo.setMode(mode);}this.status(mode==='move'?'長按作品約 0.6 秒後拖曳移動':mode==='label'?'名稱底色框：四角等比、四邊中點單邊拉伸；文字保持置中':mode==='scale'?'四角：等比縮放 · 邊中點：單軸拉伸':mode==='rotate'?'拖曳紅／綠／藍圓環以三軸旋轉':'拖曳紅／綠／藍箭頭移動');if(collapse&&this.isGM())this.floatingPanel.collapseForScene();this.update();}
  point(index){const [x,y]=handleCoordinates[index],center=this.box.getCenter(new THREE.Vector3());return new THREE.Vector3(x<0?this.box.min.x:x>0?this.box.max.x:center.x,y<0?this.box.min.y:y>0?this.box.max.y:center.y,this.box.max.z);}
  // The title sprite is camera-facing. Project its four billboard corners
  // rather than using artwork geometry: handle positions match the actual
  // painted rectangle even when the artwork itself has been transformed.
  labelRect(){
    const plate=this.selected?.userData.titlePlate;
    if(!plate||!plate.visible)return null;
    const center=plate.getWorldPosition(new THREE.Vector3());
    const scale=plate.getWorldScale(new THREE.Vector3());
    const right=new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion);
    const up=new THREE.Vector3(0,1,0).applyQuaternion(this.camera.quaternion);
    const rect=this.canvas.getBoundingClientRect();
    const screen=(p)=>{
     const ndc=p.clone().project(this.camera);
     return {x:rect.left+(ndc.x+1)*rect.width/2,
      y:rect.top+(1-ndc.y)*rect.height/2,z:ndc.z};
    };
    const points=handleCoordinates.map(([x,y])=>screen(center.clone()
      .addScaledVector(right,scale.x*x/2)
      .addScaledVector(up,scale.y*y/2)));
    const width=Math.hypot(points[2].x-points[0].x,points[2].y-points[0].y);
    const height=Math.hypot(points[0].x-points[6].x,points[0].y-points[6].y);
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<2||height<2)return null;
    return {points,width,height,right,up,rootScale:this.selected.getWorldScale(new THREE.Vector3()),
      rootQuaternion:this.selected.getWorldQuaternion(new THREE.Quaternion())};
  }
  updateLabelHandles(){
   if(!this.selected||this.mode!=='label')return;
   const rect=this.labelRect();
   if(!rect||rect.points.some(p=>p.z<=-1||p.z>=1)){
    this.labelHandles.hidden=true;return;
   }
   this.labelHandles.hidden=false;
   for(let i=0;i<8;i++){
    const el=this.labelHandles.querySelector('[data-label-handle="'+i+'"]');
    el.style.left=rect.points[i].x+'px';el.style.top=rect.points[i].y+'px';
   }
   this.labelPolygon.setAttribute('points',[0,2,4,6].map(i=>
    rect.points[i].x+','+rect.points[i].y).join(' '));
   const centerX=(rect.points[0].x+rect.points[4].x)/2;
   const centerY=(rect.points[0].y+rect.points[4].y)/2;
   this.labelDragSurface.style.left=centerX+'px';
   this.labelDragSurface.style.top=centerY+'px';
   this.labelDragSurface.style.width=rect.width+'px';
   this.labelDragSurface.style.height=rect.height+'px';
  }
  labelMoveBasis(){
   const root=this.selected,plate=root?.userData.titlePlate;
   if(!root||!plate)return null;
   root.updateMatrixWorld(true);this.camera.updateMatrixWorld();
   const rect=this.canvas.getBoundingClientRect();
   const screen=point=>{
    const p=point.project(this.camera);
    return {x:rect.left+(p.x+1)*rect.width/2,
            y:rect.top+(1-p.y)*rect.height/2};
   };
   const center=screen(plate.getWorldPosition(new THREE.Vector3()));
   const x=screen(root.localToWorld(plate.position.clone().add(new THREE.Vector3(1,0,0))));
   const y=screen(root.localToWorld(plate.position.clone().add(new THREE.Vector3(0,1,0))));
   return {ax:x.x-center.x,ay:x.y-center.y,bx:y.x-center.x,by:y.y-center.y};
  }
  beginLabelMove(e){
   if(this.mode!=='label'||!this.selected||
      !e.target.closest('[data-label-drag-target]')||
      e.target.closest('[data-label-handle]')||this.labelMove)return;
   if(e.button!==0)return;
   const basis=this.labelMoveBasis();
   if(!basis)return;
   e.preventDefault();e.stopPropagation();
   const target=e.target;
   this.labelMove={pointer:e.pointerId,x:e.clientX,y:e.clientY,
    startX:this.appearance.labelOffsetX??0,
    startY:this.appearance.labelOffsetY??0,
    basis,active:false,moved:false,target,timer:null};
   try{target.setPointerCapture(e.pointerId);}catch{}
   const pending=this.labelMove;
   pending.timer=setTimeout(()=>{
    if(this.labelMove!==pending||this.mode!=='label')return;
    pending.active=true;
    this.labelDragSurface.classList.add('label-moving');
    this.status('拖曳名稱條：上下／左右移動 · 尚未儲存');
   },LABEL_LONG_PRESS_MS);
  }
  dragLabelMove(e){
   const move=this.labelMove;
   if(!move||move.pointer!==e.pointerId)return;
   const dx=e.clientX-move.x,dy=e.clientY-move.y;
   if(!move.active){
    if(Math.hypot(dx,dy)>10)this.endLabelMove(e);
    return;
   }
   e.preventDefault();e.stopPropagation();
   const delta=labelLocalDeltaFromScreen(dx,dy,move.basis);
   if(!delta)return;
   const x=THREE.MathUtils.clamp(move.startX+delta.x,-10,10);
   const y=THREE.MathUtils.clamp(move.startY+delta.y,-10,10);
   this.appearance.labelOffsetX=x;
   this.appearance.labelOffsetY=y;
   const plate=this.selected?.userData.titlePlate;
   if(plate){
    plate.position.x=x;
    plate.position.y=(this.selected.userData.titlePlateBaseY??-1.5)-
      (this.appearance.labelHeight??.492)/2-.13+y;
   }
   move.moved=true;
   this.dirty=true;
   this.status('已移動作品名稱條 · 尚未儲存');
   this.updateLabelHandles();
  }
  endLabelMove(e){
   const move=this.labelMove;
   if(!move||e&&move.pointer!==e.pointerId)return;
   clearTimeout(move.timer);
   this.labelMove=null;
   this.labelDragSurface?.classList.remove('label-moving');
   try{if(move.target.hasPointerCapture?.(move.pointer))
    move.target.releasePointerCapture(move.pointer);}catch{}
   if(move.moved&&this.selected){
    // Rebase the cached material/geometry signature ONCE after the gesture,
    // not on every touchmove frame.
    applyArtworkAppearance(this.selected,this.appearance);
    updateArtworkTitleVisibility(this.selected,this.camera.position,true);
    this.updateLabelHandles();
   }
  }
  centerLabel(){
   if(!this.selected)return;
   this.appearance.labelOffsetX=0;
   // Keep vertical position as edited; reset only horizontal artwork centering.
   applyArtworkAppearance(this.selected,this.appearance);
   updateArtworkTitleVisibility(this.selected,this.camera.position,true);
   this.dirty=true;this.status('名稱條已水平對齊作品中心 · 尚未儲存');
   if(this.mode==='label')this.updateLabelHandles();
  }
  beginLabelResize(e){
   const el=e.target.closest('[data-label-handle]');
   if(!el||this.mode!=='label'||!this.selected)return;
   e.preventDefault();e.stopPropagation();
   const rect=this.labelRect();if(!rect)return;
   this.labelDrag={pointer:e.pointerId,index:Number(el.dataset.labelHandle),
    x:e.clientX,y:e.clientY,rect,style:{...this.appearance}};
   el.setPointerCapture(e.pointerId);
  }
  resizeLabel(e){
   const drag=this.labelDrag;
   if(!drag||drag.pointer!==e.pointerId)return;
   e.preventDefault();e.stopPropagation();
   const [x,y]=handleCoordinates[drag.index],s=drag.style;
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
   let width=s.labelWidth??3.5,height=s.labelHeight??.492;
   const oldWidth=width,oldHeight=height;
   if(x&&y){
    // Apply the SAME factor to both dimensions, including at the min/max
    // limits. Independent clamping would break equal-proportion corners.
    const factor=THREE.MathUtils.clamp(
     1+(x*dx/drag.rect.width-y*dy/drag.rect.height)/2,
     Math.max(.5/oldWidth,.18/oldHeight),
     Math.min(12/oldWidth,4/oldHeight));
    width=oldWidth*factor;height=oldHeight*factor;
   }else if(x)width=THREE.MathUtils.clamp(
    oldWidth*(1+x*dx/drag.rect.width),.5,12);
   else height=THREE.MathUtils.clamp(
    oldHeight*(1-y*dy/drag.rect.height),.18,4);
   const dw=width-oldWidth,dh=height-oldHeight;
   // A corner keeps the opposite corner anchored; a midpoint keeps its
   // opposite edge anchored. Convert camera-plane movement to local units.
   const moveWorld=drag.rect.right.clone().multiplyScalar(x*dw*drag.rect.rootScale.x/2)
    .addScaledVector(drag.rect.up,y*dh*drag.rect.rootScale.y/2);
   const moveLocal=moveWorld.applyQuaternion(drag.rect.rootQuaternion.clone().invert());
   moveLocal.divide(drag.rect.rootScale);
   this.appearance.labelWidth=width;this.appearance.labelHeight=height;
   this.appearance.labelOffsetX=THREE.MathUtils.clamp(
    (s.labelOffsetX??0)+moveLocal.x,-10,10);
   // Title plates anchor below the artwork by their top edge, so compensate
   // for their half-height when moving the centre.
   this.appearance.labelOffsetY=THREE.MathUtils.clamp(
    (s.labelOffsetY??0)+moveLocal.y+dh/2,-10,10);
   applyArtworkAppearance(this.selected,this.appearance);
   for(const key of ['labelWidth','labelHeight']){
    const input=this.panel.querySelector('[data-appearance="'+key+'"]');
    if(input)input.value=String(Number(this.appearance[key].toFixed(3)));
   }
   this.dirty=true;this.status('名稱底色框即時變形 · 尚未儲存');
   this.updateLabelHandles();
  }
  async applyOwnLabels(){
   if(!this.selected||this.saving)return;
   const keys=['labelBackground','labelColor','labelFontSize','labelWidth','labelHeight'];
   const style=Object.fromEntries(keys.map(key=>[key,this.appearance[key]]));
   // A style source may be an original exhibit OR another player's artwork.
   // Bulk apply must NEVER save or mutate the source artwork incidentally.
   try{
    const result=await this.send('apply-my-artwork-label-style',{style},{throwOnError:true});
    const record=(this.arena.world?.customArtworks||[]).find(
     a=>a.id===this.selected.userData.platformId);
    if(record&&record.owner===this.ownerKey()){
     // This artwork was updated by the batch. Rebase the editor so that
     // closing does not roll back the successfully committed name colours.
     this.expectedRevision++;
     this.original.appearance={...this.original.appearance,...style};
    }
    this.status('已套用名稱樣式至自己上傳的 '+result.updatedCount+' 件作品');
   }catch(error){this.status('批次套用失敗：'+(error?.message||'未知錯誤'));}
  }

  beginArtworkMove(e){
   if(!this.selected||!['scale','move'].includes(this.mode)||!e.target.closest('[data-art-drag-target]')||e.button!==0||this.artMove)return;
   e.preventDefault();e.stopPropagation();this.raycast(e);
   const origin=this.selected.position.clone(),normal=this.camera.getWorldDirection(new THREE.Vector3());
   const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,origin),hit=this.ray.ray.intersectPlane(plane,new THREE.Vector3());
   if(!hit)return;
   const move=this.artMove={pointer:e.pointerId,x:e.clientX,y:e.clientY,origin,plane,hit,target:e.target,active:false};
   try{move.target.setPointerCapture(e.pointerId);}catch{}
   move.timer=setTimeout(()=>{if(this.artMove===move){move.active=true;this.status('拖曳移動作品');}},LABEL_LONG_PRESS_MS);
  }
  dragArtworkMove(e){
   const move=this.artMove;if(!move||move.pointer!==e.pointerId)return;
   if(!move.active){if(Math.hypot(e.clientX-move.x,e.clientY-move.y)>10)this.endArtworkMove(e);return;}
   e.preventDefault();e.stopPropagation();this.raycast(e);
   const hit=this.ray.ray.intersectPlane(move.plane,new THREE.Vector3());if(!hit)return;
   this.selected.position.copy(move.origin).add(hit.sub(move.hit));this.dirty=true;this.status('作品位置尚未儲存');this.updateFields();
  }
  endArtworkMove(e){
   const move=this.artMove;if(!move||e&&e.pointerId!==move.pointer)return;
   this.artMove=null;clearTimeout(move.timer);try{if(move.target.hasPointerCapture(move.pointer))move.target.releasePointerCapture(move.pointer);}catch{}
  }
  beginResize(e){if(this.mode!=='scale'||!e.target.dataset.handle)return;e.preventDefault();const i=+e.target.dataset.handle,p=this.point(i),anchor=this.point((i+4)%8),root=this.selected;root.updateMatrixWorld(true);const q=root.getWorldQuaternion(new THREE.Quaternion()),normal=new THREE.Vector3(0,0,1).applyQuaternion(q);this.drag={i,p,anchor,scale:root.scale.clone(),matrix:root.matrixWorld.clone(),inverse:root.matrixWorld.clone().invert(),quaternion:q,anchorWorld:anchor.clone().applyMatrix4(root.matrixWorld),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,p.clone().applyMatrix4(root.matrixWorld)),pointer:e.pointerId};e.target.setPointerCapture(e.pointerId);}
  resize(e){const drag=this.drag;if(!drag||e.pointerId!==drag.pointer)return;this.raycast(e);const hit=this.ray.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!hit)return;hit.applyMatrix4(drag.inverse);const [x,y]=handleCoordinates[drag.i],rx=x?(hit.x-drag.anchor.x)/(drag.p.x-drag.anchor.x):1,ry=y?(hit.y-drag.anchor.y)/(drag.p.y-drag.anchor.y):1,scale=drag.scale.clone();const bomb=(this.arena.world?.customArtworks||[]).some(a=>a.id===this.selected.userData.platformId&&a.bomb),min=bomb?1:.05,max=bomb?3:20;if(x&&y){const factor=THREE.MathUtils.clamp((rx+ry)/2,min/Math.min(scale.x,scale.y,scale.z),max/Math.max(scale.x,scale.y,scale.z));scale.multiplyScalar(factor);}else if(x)scale.x=THREE.MathUtils.clamp(scale.x*Math.max(.05,rx),min,max);else scale.y=THREE.MathUtils.clamp(scale.y*Math.max(.05,ry),min,max);this.selected.scale.copy(scale);this.selected.position.copy(drag.anchorWorld).sub(drag.anchor.clone().multiply(scale).applyQuaternion(drag.quaternion));this.dirty=true;this.status('尚未儲存');this.updateFields();}
  update(){if(this.selected)updateArtworkTitleVisibility(this.selected,this.camera.position,true);if(this.selected&&this.mode==='follow'&&this.player()){this.selected.position.copy(this.player().position).add(this.followOffset);this.dirty=true;this.updateFields();return;}if(!this.selected)return;if(this.mode==='label'){this.updateLabelHandles();return;}if(!['scale','move'].includes(this.mode))return;this.selected.updateMatrixWorld(true);const points=handleCoordinates.map((_,i)=>this.point(i).applyMatrix4(this.selected.matrixWorld).project(this.camera));const visible=points.every(p=>p.z>-1&&p.z<1);this.handles.hidden=!visible;if(!visible)return;const rect=this.canvas.getBoundingClientRect();points.forEach((p,i)=>{const element=this.handles.querySelector(`[data-handle="${i}"]`);element.hidden=this.mode==='move';element.style.left=`${rect.left+(p.x+1)*rect.width/2}px`;element.style.top=`${rect.top+(1-p.y)*rect.height/2}px`;});const xs=points.map(p=>rect.left+(p.x+1)*rect.width/2),ys=points.map(p=>rect.top+(1-p.y)*rect.height/2);Object.assign(this.artDragSurface.style,{left:Math.min(...xs)+'px',top:Math.min(...ys)+'px',width:(Math.max(...xs)-Math.min(...xs))+'px',height:(Math.max(...ys)-Math.min(...ys))+'px'});this.polygon.setAttribute('points',[0,2,4,6].map(i=>`${rect.left+(points[i].x+1)*rect.width/2},${rect.top+(1-points[i].y)*rect.height/2}`).join(' '));}
  updateFields(){if(!this.selected)return;for(const input of this.panel.querySelectorAll('[data-axis]')){if(document.activeElement===input)continue;const [property,index]=input.dataset.axis.split('-'),value=this.selected[property][['x','y','z'][index]];input.value=(property==='rotation'?THREE.MathUtils.radToDeg(value):value).toFixed(3);}}
  status(text){const target=this.panel.querySelector('[data-status]');if(target)target.textContent=text;}
  async save(){
    if(!this.canEdit(this.selected)||this.saving)return;
    if(!this.title?.trim())return this.status('作品名稱不可留空');
    this.saving=true;
    if(this.mode==='follow'){this.mode=null;this.control(true);}
    this.status('正在儲存到伺服器…');
    const root=this.selected,platformId=root.userData.platformId;
    const isStuck22=this.isGM()&&(isArtwork22(root.userData.record)||
      (this.arena.world?.customArtworks||[]).some(a=>a.id===platformId&&isArtwork22(a)));
    const sendLayout=()=>this.send('set-artwork-layout',{
      platformId,expectedRevision:this.expectedRevision,
      layout:{position:root.position.toArray(),
        rotation:[root.rotation.x,root.rotation.y,root.rotation.z],
        scale:root.scale.toArray(),appearance:this.appearance,
        title:this.title.trim(),author:this.author.trim(),...(this.supportsPlatform?{platformRadius:this.platformRadius}:{})}
    },{throwOnError:true});
    try{
      let result;
      try{result=await sendLayout();}
      catch(error){
        if(!isStuck22)throw error;
        // Existing rooms may retain an orphan holder, an invalid transform,
        // or a revision recorded before the client received the migration.
        // This is a GM-only, single-artwork repair; all others remain intact.
        const repaired=await this.send('repair-artwork',{
          platformId,position:root.position.toArray()
        },{throwOnError:true});
        if(!repaired?.artworkLayout)throw error;
        this.expectedRevision=repaired.artworkLayout.revision;
        result=await sendLayout();
      }
      if(!result?.artworkLayout)throw new Error('伺服器沒有確認作品配置已儲存');
      this.expectedRevision=result.artworkLayout.revision;
      this.original=structuredClone(result.artworkLayout);
      if(this.supportsPlatform){root.userData.titleOverride=this.title.trim();}else{this.originalTitle=this.title.trim();root.userData.record.title=this.originalTitle;}root.userData.editTitleDraft=this.title.trim();this.originalAuthor=this.author.trim();root.userData.record.author=this.originalAuthor;root.userData.editAuthorDraft=this.originalAuthor;
      delete root.userData.previewPlatformRadius;
      this.arena.displayPlatforms.sync();
      this.dirty=false;
      this.status('已儲存，所有玩家及下次進入皆生效');
      return result;
    }catch(error){
      const reason=error?.message||'Unknown server error';
      this.status('儲存失敗：'+reason);
      this.toast('作品儲存失敗：'+reason);
    }finally{this.saving=false;}
  }
  close(){this.endLabelMove();this.endArtworkMove();this.gizmo.detach();this.drag=null;if(this.selected){this.selected.position.fromArray(this.original.position);this.selected.rotation.set(...this.original.rotation);this.selected.scale.fromArray(this.original.scale);this.selected.userData.record.title=this.originalTitle;this.selected.userData.titleOverride=this.original.title;delete this.selected.userData.editTitleDraft;this.selected.userData.record.author=this.originalAuthor;this.selected.userData.authorOverride=this.original.author;delete this.selected.userData.editAuthorDraft;applyArtworkAppearance(this.selected,this.original.appearance);this.selected.userData.editing=false;delete this.selected.userData.previewPlatformRadius;this.arena.displayPlatforms.sync();}this.selected=null;this.mode=null;this.dirty=false;this.handles.hidden=this.labelHandles.hidden=this.panel.hidden=true;this.focusArtwork(null);this.control(true);}
  export(){if(!this.isGM())return;if(this.dirty)return this.toast('請先儲存修改');const layout={...this.arena.defaultLayout,...this.arena.world?.artworkLayout},blob=new Blob([JSON.stringify({version:1,artworkLayout:layout,floatingPlatforms:this.arena.world?.floatingPlatforms||[]},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='temple-artwork-layout.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
  state(){return {selected:this.selected?.userData.platformId||null,mode:this.mode,dirty:this.dirty,handles:this.mode==='scale'?8:0};}
}
