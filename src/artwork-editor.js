import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {artworkDefinitions,artworkAppearanceDefaults,isArtwork22} from './shared/artwork-library.js';
import {applyArtworkAppearance,addArtworkTitlePlate} from './artwork-surface.js';
import {editorPanelMarkup} from './art-editor-panel.js';

const handleCoordinates=[[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0]];
export class ArtworkEditor{
  constructor({scene,camera,canvas,arena,player,isGM,send,control,toast}){
    Object.assign(this,{scene,camera,canvas,arena,player,isGM,send,control,toast});this.selected=null;this.mode=null;this.dirty=false;this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.box=new THREE.Box3();this.panel=document.getElementById('art-editor');this.handles=document.getElementById('art-handles');
    this.handles.innerHTML='<svg aria-hidden="true"><polygon/></svg>'+handleCoordinates.map(([x,y],i)=>`<button type="button" class="art-handle ${x*y===0?'midpoint':''}" data-handle="${i}" aria-label="${x*y===0?'非等比':'等比'} resize ${i+1}"></button>`).join('');this.polygon=this.handles.querySelector('polygon');
    this.gizmo=new TransformControls(camera,canvas);this.gizmo.setSpace('local');this.gizmo.setSize(.8);scene.add(this.gizmo);this.gizmo.addEventListener('dragging-changed',e=>this.control(!e.value&&!this.mode));this.gizmo.addEventListener('objectChange',()=>{this.dirty=true;this.status('尚未儲存');this.updateFields();});
    let press=null;canvas.addEventListener('pointerdown',e=>{if(this.isGM()&&e.button===0)press={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',e=>{if(!press||!this.isGM())return;const distance=Math.hypot(press.x-e.clientX,press.y-e.clientY);press=null;if(distance>4||this.gizmo.axis||this.mode)return;this.raycast(e);const hits=this.ray.intersectObjects([...arena.artworks.values()].filter(o=>o.visible),true);for(const hit of hits){let root=hit.object;while(root&&!root.userData.platformId)root=root.parent;if(root){this.select(root);break;}}});
    addEventListener('keydown',e=>{if(!this.isGM()||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;if(e.shiftKey&&['KeyT','KeyR','KeyG'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(!this.selected)return this.toast('請先點選作品');this.edit({KeyT:'scale',KeyR:'rotate',KeyG:'translate'}[e.code]);}if(e.code==='Escape'&&this.selected){e.stopImmediatePropagation();this.close();}},{capture:true});
    this.handles.addEventListener('pointerdown',e=>this.beginResize(e));this.handles.addEventListener('pointermove',e=>this.resize(e));this.handles.addEventListener('pointerup',()=>this.drag=null);this.handles.addEventListener('pointercancel',()=>this.drag=null);
    this.panel.addEventListener('click',e=>{const action=e.target.dataset.action;if(action==='follow'){if(this.mode==='follow'){this.mode=null;this.control(true);}else if(this.selected&&this.player()){this.followOffset=this.selected.position.clone().sub(this.player().position);this.mode='follow';this.gizmo.detach();this.handles.hidden=true;this.control(true);}this.status(this.mode==='follow'?'正在跟隨 GM · 再次點擊停止':'已停止跟隨');}if(action==='save')this.save();if(action==='cancel')this.close();if(['scale','rotate','translate'].includes(action))this.edit(action);if(action==='export')this.export();});
    this.panel.addEventListener('input',e=>{
     if(!this.selected||!e.target.hasAttribute('data-art-title'))return;
     this.title=e.target.value.slice(0,120);
     this.selected.userData.editTitleDraft=this.title;
     addArtworkTitlePlate(this.selected,this.title,this.appearance.labelBackground);
     this.panel.querySelector('[data-art-name]').textContent=this.title||'未命名作品';
     this.dirty=true;this.status('作品名稱尚未儲存');
    });
    this.panel.addEventListener('change',e=>{if(!this.selected)return;if(e.target.hasAttribute('data-platform-radius')){const n=Number(e.target.value);if(!Number.isFinite(n)||n<1.5||n>14){this.status('圓盤半徑限 1.5–14');return;}this.platformRadius=n;this.selected.userData.previewPlatformRadius=n;this.arena.displayPlatforms.sync();this.dirty=true;this.status('圓盤尺寸尚未儲存');return;}if(e.target.dataset.appearance){this.appearance[e.target.dataset.appearance]=e.target.type==='color'?e.target.value:Number(e.target.value);applyArtworkAppearance(this.selected,this.appearance);this.dirty=true;this.status('尚未儲存');return;}if(!e.target.dataset.axis)return;const [prop,index]=e.target.dataset.axis.split('-'),n=Number(e.target.value);if(!Number.isFinite(n))return;this.selected[prop].setComponent?this.selected[prop].setComponent(+index,n):this.selected.rotation[['x','y','z'][index]]=THREE.MathUtils.degToRad(n);this.dirty=true;this.status('尚未儲存');});
  }
  raycast(e){const rect=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);}
  select(root){if(this.selected===root)return;if(this.dirty)return this.toast('請先儲存或取消目前編輯');this.close();this.selected=root;const platform=artworkDefinitions(this.arena.world).find(p=>p.id===root.userData.platformId),layout=this.arena.world?.artworkLayout?.[platform.id]||this.arena.defaultLayout[platform.id]||{position:platform.artPosition,rotation:[0,platform.artYaw,0],scale:[1,1,1]};this.expectedRevision=this.arena.world?.artworkLayout?.[platform.id]?.revision||0;this.original=structuredClone(layout);this.supportsPlatform=!(this.arena.world?.customArtworks||[]).some(a=>a.id===platform.id);this.platformRadius=layout.platformRadius??this.arena.displayPlatforms.discs.find(d=>d.display&&d.artwork===platform.id)?.radius??3;this.appearance={...artworkAppearanceDefaults(root.userData.record),...layout.appearance};this.title=String(layout.title??root.userData.record.title??'').slice(0,120);this.originalTitle=String(root.userData.record.title??'');root.userData.editTitleDraft=this.title;root.userData.editing=true;root.position.fromArray(layout.position);root.rotation.set(...layout.rotation);root.scale.fromArray(layout.scale);root.updateMatrixWorld(true);addArtworkTitlePlate(root,this.title,this.appearance.labelBackground);
    const inverse=root.matrixWorld.clone().invert();this.box.makeEmpty();root.traverse(o=>{if(!o.geometry)return;o.geometry.computeBoundingBox();this.box.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)));});
    this.panel.hidden=false;this.panel.innerHTML=editorPanelMarkup(this.appearance,this.platformRadius,this.supportsPlatform,this.title);this.panel.querySelector('[data-art-name]').textContent=this.title;this.updateFields();this.toast('已選取作品 · Shift+T 縮放／Shift+R 旋轉');
  }
  edit(mode){if(!this.selected||!this.isGM())return;this.mode=mode;this.control(false);this.handles.hidden=mode!=='scale';if(mode==='scale')this.gizmo.detach();else{this.gizmo.attach(this.selected);this.gizmo.setMode(mode);}this.status(mode==='scale'?'四角：等比縮放 · 邊中點：單軸拉伸':mode==='rotate'?'拖曳紅／綠／藍圓環以三軸旋轉':'拖曳紅／綠／藍箭頭移動');this.update();}
  point(index){const [x,y]=handleCoordinates[index],center=this.box.getCenter(new THREE.Vector3());return new THREE.Vector3(x<0?this.box.min.x:x>0?this.box.max.x:center.x,y<0?this.box.min.y:y>0?this.box.max.y:center.y,this.box.max.z);}
  beginResize(e){if(this.mode!=='scale'||!e.target.dataset.handle)return;e.preventDefault();const i=+e.target.dataset.handle,p=this.point(i),anchor=this.point((i+4)%8),root=this.selected;root.updateMatrixWorld(true);const q=root.getWorldQuaternion(new THREE.Quaternion()),normal=new THREE.Vector3(0,0,1).applyQuaternion(q);this.drag={i,p,anchor,scale:root.scale.clone(),matrix:root.matrixWorld.clone(),inverse:root.matrixWorld.clone().invert(),quaternion:q,anchorWorld:anchor.clone().applyMatrix4(root.matrixWorld),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,p.clone().applyMatrix4(root.matrixWorld)),pointer:e.pointerId};e.target.setPointerCapture(e.pointerId);}
  resize(e){const drag=this.drag;if(!drag||e.pointerId!==drag.pointer)return;this.raycast(e);const hit=this.ray.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!hit)return;hit.applyMatrix4(drag.inverse);const [x,y]=handleCoordinates[drag.i],rx=x?(hit.x-drag.anchor.x)/(drag.p.x-drag.anchor.x):1,ry=y?(hit.y-drag.anchor.y)/(drag.p.y-drag.anchor.y):1,scale=drag.scale.clone();if(x&&y){const factor=Math.max(.05,(rx+ry)/2);scale.multiplyScalar(factor);}else if(x)scale.x*=Math.max(.05,rx);else scale.y*=Math.max(.05,ry);scale.clampScalar(.05,20);this.selected.scale.copy(scale);this.selected.position.copy(drag.anchorWorld).sub(drag.anchor.clone().multiply(scale).applyQuaternion(drag.quaternion));this.dirty=true;this.status('尚未儲存');this.updateFields();}
  update(){if(this.selected&&this.mode==='follow'&&this.player()){this.selected.position.copy(this.player().position).add(this.followOffset);this.dirty=true;this.updateFields();return;}if(!this.selected||this.mode!=='scale')return;this.selected.updateMatrixWorld(true);const points=handleCoordinates.map((_,i)=>this.point(i).applyMatrix4(this.selected.matrixWorld).project(this.camera));const visible=points.every(p=>p.z>-1&&p.z<1);this.handles.hidden=!visible;if(!visible)return;const rect=this.canvas.getBoundingClientRect();points.forEach((p,i)=>{const element=this.handles.querySelector(`[data-handle="${i}"]`);element.style.left=`${rect.left+(p.x+1)*rect.width/2}px`;element.style.top=`${rect.top+(1-p.y)*rect.height/2}px`;});this.polygon.setAttribute('points',[0,2,4,6].map(i=>`${rect.left+(points[i].x+1)*rect.width/2},${rect.top+(1-points[i].y)*rect.height/2}`).join(' '));}
  updateFields(){if(!this.selected)return;for(const input of this.panel.querySelectorAll('[data-axis]')){if(document.activeElement===input)continue;const [property,index]=input.dataset.axis.split('-'),value=this.selected[property][['x','y','z'][index]];input.value=(property==='rotation'?THREE.MathUtils.radToDeg(value):value).toFixed(3);}}
  status(text){const target=this.panel.querySelector('[data-status]');if(target)target.textContent=text;}
  async save(){
    if(!this.selected||this.saving)return;
    if(!this.title?.trim())return this.status('作品名稱不可留空');
    this.saving=true;
    if(this.mode==='follow'){this.mode=null;this.control(true);}
    this.status('正在儲存到伺服器…');
    const root=this.selected,platformId=root.userData.platformId;
    const isStuck22=isArtwork22(root.userData.record)||
      (this.arena.world?.customArtworks||[]).some(a=>a.id===platformId&&isArtwork22(a));
    const sendLayout=()=>this.send('set-artwork-layout',{
      platformId,expectedRevision:this.expectedRevision,
      layout:{position:root.position.toArray(),
        rotation:[root.rotation.x,root.rotation.y,root.rotation.z],
        scale:root.scale.toArray(),appearance:this.appearance,
        title:this.title.trim(),...(this.supportsPlatform?{platformRadius:this.platformRadius}:{})}
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
      if(this.supportsPlatform){root.userData.titleOverride=this.title.trim();}else{this.originalTitle=this.title.trim();root.userData.record.title=this.originalTitle;}root.userData.editTitleDraft=this.title.trim();
      delete root.userData.previewPlatformRadius;
      this.arena.displayPlatforms.sync();
      this.dirty=false;
      this.status('已儲存，所有玩家及下次進入皆生效');
    }catch(error){
      const reason=error?.message||'Unknown server error';
      this.status('儲存失敗：'+reason);
      this.toast('GM 作品儲存失敗：'+reason);
    }finally{this.saving=false;}
  }
  close(){this.gizmo.detach();this.drag=null;if(this.selected){this.selected.position.fromArray(this.original.position);this.selected.rotation.set(...this.original.rotation);this.selected.scale.fromArray(this.original.scale);this.selected.userData.record.title=this.originalTitle;this.selected.userData.titleOverride=this.original.title;delete this.selected.userData.editTitleDraft;applyArtworkAppearance(this.selected,this.original.appearance);this.selected.userData.editing=false;delete this.selected.userData.previewPlatformRadius;this.arena.displayPlatforms.sync();}this.selected=null;this.mode=null;this.dirty=false;this.handles.hidden=this.panel.hidden=true;this.control(true);}
  export(){if(this.dirty)return this.toast('請先儲存修改');const layout={...this.arena.defaultLayout,...this.arena.world?.artworkLayout},blob=new Blob([JSON.stringify({version:1,artworkLayout:layout,floatingPlatforms:this.arena.world?.floatingPlatforms||[]},null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='temple-artwork-layout.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}
  state(){return {selected:this.selected?.userData.platformId||null,mode:this.mode,dirty:this.dirty,handles:this.mode==='scale'?8:0};}
}
