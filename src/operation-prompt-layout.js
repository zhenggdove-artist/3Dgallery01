import {viewWidth,viewHeight,gmMobilePreviewActive} from './gm-mobile-preview.js';
import {operationPromptLayout,promptPlacement,PROMPT_LIMITS} from './shared/operation-prompt.js';

const $=id=>document.getElementById(id);
const device=()=>gmMobilePreviewActive()||matchMedia('(max-width:720px),(pointer:coarse)').matches?'mobile':'desktop';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function anchor(){
 const r=$('attack-button')?.getBoundingClientRect();
 return r?.width&&r?.height?r:{left:viewWidth()-116,top:Math.max(16,viewHeight()-96),width:64,height:64};
}
const viewport=()=>({width:viewWidth(),height:viewHeight()});
function setPosition(node,p){
 node.style.setProperty('--operation-x',p.x+'px');
 node.style.setProperty('--operation-y',p.y+'px');
 node.style.setProperty('--operation-scale',String(p.scale));
 node.style.setProperty('--operation-opacity',String(p.opacity));
}
function prepare(node){
 node.style.maxWidth=Math.max(40,viewWidth()-12)+'px';
 return {width:node.offsetWidth,height:node.offsetHeight};
}
export class OperationPromptLayout{
 constructor(ui){this.ui=ui;this.frame=0;this.editor=null;}
 schedule(){
  if(this.frame)return;
  this.frame=requestAnimationFrame(()=>{this.frame=0;this.layout();});
 }
 layout(){
  if(!this.ui.self||this.ui.hud.hidden)return;
  const p=operationPromptLayout(this.ui.world?.artworkPromptPositions?.[device()]);
  const prompt=$('prompt'),toast=$('toast'),purchase=$('purchase-notice');
  const nodes=[prompt,toast,purchase].filter(n=>n&&!n.hidden&&n.classList.contains('visible')&&n.offsetHeight>0&&!(n===prompt&&this.ui.panelName&&this.ui.panelName!=='operation-prompt-layout'&&!this.ui.panel.classList.contains('build-floating')));
  const boxes=nodes.map(prepare),placements=promptPlacement(anchor(),viewport(),p,boxes);
  nodes.forEach((n,i)=>setPosition(n,placements[i]));
  if(this.editor)this.editor.render();
 }
 edit(){
  if(!this.ui.self?.profile?.admin||this.editor)return;
  this.ui.closePanel();
  const overlay=document.createElement('section');overlay.id='operation-prompt-editor';overlay.setAttribute('aria-label','GM 操作提示編輯');
  overlay.innerHTML='<div class="operation-editor-tools"><strong>全服操作提示</strong><small>拖曳提示框移動；拖曳右下角縮放。</small><label>透明度 <input aria-label="透明度" type="range" min=".1" max="1" step=".01" data-prompt-opacity></label><div><button type="button" data-device="mobile">手機／平板</button><button type="button" data-device="desktop">電腦</button></div><div><button type="button" data-save="all">儲存至所有裝置</button><button type="button" data-save="current">僅儲存所選裝置</button><button type="button" data-cancel>取消</button></div><small data-status role="status"></small></div><div class="operation-editor-sample"><div class="operation-sample-content">A · TAKE ARTWORK<br>Equipped · Light Saber</div><button type="button" class="operation-resize" aria-label="拖曳調整提示尺寸"></button></div>';
  document.body.append(overlay);
  const sample=overlay.querySelector('.operation-editor-sample'),content=sample.firstElementChild,handle=overlay.querySelector('.operation-resize'),slider=overlay.querySelector('[data-prompt-opacity]'),status=overlay.querySelector('[data-status]');
  let selected=device(),drafts={},drag=null,busy=false;
  const load=key=>drafts[key]??=(operationPromptLayout(this.ui.world?.artworkPromptPositions?.[key]));
  const render=()=>{
   const p=load(selected);slider.value=String(p.opacity);content.style.opacity=String(p.opacity);
   for(const b of overlay.querySelectorAll('[data-device]'))b.setAttribute('aria-pressed',String(b.dataset.device===selected));
   const box=prepare(sample),[place]=promptPlacement(anchor(),viewport(),p,[box]);setPosition(sample,place);
  };
  const stop=()=>{if(!this.editor)return;overlay.remove();this.editor=null;this.ui.panelName='';this.ui.emit('panel',{open:false});this.ui.openPanel('gm');};
  this.editor={render,cancel:()=>{if(!busy)stop();}};this.ui.panelName='operation-prompt-layout';this.ui.emit('panel',{open:true,name:'operation-prompt-layout'});
  slider.addEventListener('input',()=>{load(selected).opacity=Number(slider.value);render();});
  sample.addEventListener('pointerdown',e=>{
   if(busy||drag||e.button!==0)return;
   e.preventDefault();e.stopPropagation();sample.setPointerCapture(e.pointerId);
   const p=load(selected);drag={id:e.pointerId,x:e.clientX,y:e.clientY,layout:{...p},resize:e.target===handle,width:Math.max(1,sample.offsetWidth)};
  });
  sample.addEventListener('pointermove',e=>{
   if(!drag||drag.id!==e.pointerId||busy)return;
   e.preventDefault();e.stopPropagation();const p=load(selected),dx=e.clientX-drag.x,dy=e.clientY-drag.y;
   if(drag.resize)p.scale=clamp(drag.layout.scale+(dx+dy*.5)/drag.width,...PROMPT_LIMITS.scale);
   else{p.x=clamp(drag.layout.x+dx/viewWidth(),...PROMPT_LIMITS.x);p.gap=clamp(drag.layout.gap-dy/viewHeight(),...PROMPT_LIMITS.gap);}
   render();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])sample.addEventListener(type,e=>{if(drag?.id===e.pointerId)drag=null;});
  overlay.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b||busy)return;
   if(b.hasAttribute('data-cancel')){stop();return;}
   if(b.dataset.device){selected=b.dataset.device;render();return;}
   if(!b.dataset.save)return;
   busy=true;status.textContent='儲存中…';for(const button of overlay.querySelectorAll('button'))button.disabled=true;slider.disabled=true;
   this.ui.emit('operation-prompt-save',{device:b.dataset.save==='all'?'all':selected,layout:{...load(selected)},complete:error=>{
    if(error){busy=false;status.textContent=error;for(const button of overlay.querySelectorAll('button'))button.disabled=false;slider.disabled=false;return;}
    stop();
   }});
  });
  render();
 }
}
