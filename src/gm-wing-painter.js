import {renderPaintedWing} from './reletter/painted-wing-art.js';
import {normalizePaintedWing} from './shared/custom-wings.js';

// GM-only atelier. Each paint operation is stored in normalized image space.
// Undo snapshots are bounded, so mobile Safari does not retain huge bitmaps.
const safe=(v)=>String(v||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[ch]));
const copy=x=>structuredClone(x);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
// Retain the characteristic silhouette of a freehand contour without
// sending thousands of pointer samples to the durable room.
export function simplifyFreehandOutline(points,maxPoints=96){
 if(!Array.isArray(points)||points.length<=maxPoints)return points.map(p=>[...p]);
 const keep=new Set([0,points.length-1]),segments=[[0,points.length-1]];
 const deviation=(p,a,b)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
  const t=len?clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len,0,1):0;
  return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
 };
 while(keep.size<maxPoints){
  let best=-1,bestScore=-1,bestSegment=-1;
  for(let j=0;j<segments.length;j++){
   const [from,to]=segments[j];if(to-from<=1)continue;
   for(let i=from+1;i<to;i++){
    const score=deviation(points[i],points[from],points[to]);
    if(score>bestScore){bestScore=score;best=i;bestSegment=j;}
   }
  }
  if(best<0)break;
  const [from,to]=segments.splice(bestSegment,1)[0];
  segments.push([from,best],[best,to]);keep.add(best);
 }
 return [...keep].sort((a,b)=>a-b).map(i=>[...points[i]]);
}
export function mountWingPainter(ui,{personal=false,preview=false}={}){
 const admin=ui.self?.profile?.admin===true;
 if(preview&&!admin)return;
 const isGm=admin&&!personal&&!preview;
 const draftKey=preview?'wingPreviewDraft':isGm?'wingDraft':'wingPersonalDraft';
  if(!preview&&!isGm&&!(ui.world?.profile?.wingDesignCredits>0)){ui.content.textContent='沒有可用的自製翅膀權限';return;}
 const design=ui[draftKey]||{
  name:'',tier:4,color:'#dfd1bc',ability:'glide',shape:'freehand',drawRatePct:1,
  outline:[],strokes:[],scaleX:1,scaleY:1,
  impulse:11,gravity:.53,flapMs:300
 };
 ui[draftKey]=design;let tool=design.outline?.length>=3?'brush':'outline',pen='#1b1b22',
  size=12,opacity=1,mirrorX=false,mirrorY=false,zoom=1,
  pan=[0,0],active=null,pointerId=null,history=[],redo=[],pointers=new Map();
 ui.content.innerHTML=`<section class="wing-painter" aria-label="wing painting editor">
  <div class="wing-painter-tools">
   <label>翅膀名稱<input data-wing-field="name" value="${safe(design.name)}" maxlength="50" placeholder="請命名翅膀"></label>
   ${isGm?`<label>品質<select data-wing-field="tier">${['White','Green','Blue','Purple · Epic','Gold'].map((s,i)=>`<option value="${i+1}" ${design.tier===i+1?'selected':''}>${s}</option>`).join('')}</select></label>
   <label>單次中獎率（%）<input data-wing-field="drawRatePct" type="number" min="0" max="100" step=".001" value="${design.drawRatePct??1}"></label>
   <small>此為全服每次抽獎的絕對機率；所有自訂翅膀合計不得超過 100%。0% 代表不會抽中。剩餘機率按基本品質抽取。</small>`:'<small>個人翅膀固定使用平衡的裝飾數值；儲存一件消耗一次已付款權限，永不公開販售。</small>'}
   <div class="wing-outline-note">左翅專用畫布：從角色背後觀看，繪製畫面原圖會顯示在角色左翅；右翅由系統自動左右鏡像。按住滑鼠左鍵或手指自由畫出輪廓，放開後自動閉合。</div>
   <button type="button" class="wing-clear-outline" data-wing-clear-outline>清除輪廓／重新繪製</button>
   <div class="wing-tools-row" role="toolbar" aria-label="畫筆工具">
    <button type="button" data-wing-tool="outline" aria-pressed="${tool==='outline'}">自由畫輪廓</button>
    <button type="button" data-wing-tool="brush" aria-pressed="${tool==='brush'}">畫筆</button>
    <button type="button" data-wing-tool="eraser">橡皮擦</button>
    <button type="button" data-wing-tool="pan">移動翅膀輪廓圖</button>
    <button type="button" data-wing-undo>↶ Undo</button>
    <button type="button" data-wing-redo>↷ Redo</button>
   </div>
   <label>色盤<input data-wing-pen type="color" value="${pen}"></label>
   <label>畫筆尺寸<input data-wing-size type="range" min="1" max="90" value="12"><output data-wing-size-label>12px</output></label>
   <label>不透明度<input data-wing-opacity type="range" min=".1" max="1" step=".05" value="1"></label>
   <label><input data-wing-mirror-x type="checkbox"> 水平同步鏡像</label>
   <label><input data-wing-mirror-y type="checkbox"> 垂直同步鏡像</label>
   <div class="wing-tools-row"><button data-wing-zoom="-1">－</button><output data-wing-zoom-label>100%</output><button data-wing-zoom="1">＋</button><button data-wing-reset-view>置中</button></div>
   <label><input data-wing-ratio type="checkbox" checked> 等比例縮放</label>
   <label>寬度比例<input data-wing-scale="scaleX" type="range" min=".35" max="2" step=".05" value="${design.scaleX}"></label>
   <label>高度比例<input data-wing-scale="scaleY" type="range" min=".35" max="2" step=".05" value="${design.scaleY}"></label>
   <label>基底色<input data-wing-field="color" type="color" value="${design.color}"></label>
   ${isGm?`<label>附帶能力<select data-wing-field="ability"><option value="glide">滑翔減緩落下</option><option value="swift">移動速度提升</option><option value="aerial">跳躍能力提升</option><option value="guardian">防護力提升</option><option value="sparkle">魔法粉塵</option></select></label>
   <label>跳躍推力<input data-wing-field="impulse" type="number" step=".1" min="5" max="18" value="${design.impulse}"></label>
   <label>重力係數<input data-wing-field="gravity" type="number" step=".01" min=".2" max="1" value="${design.gravity}"></label>
   <label>翅膀拍動間隔（ms）<input data-wing-field="flapMs" type="number" min="180" max="900" step="10" value="${design.flapMs}"></label>
   `:``}
    <button type="button" class="panel-button" data-wing-publish>${isGm?(design.id?'儲存修改並重新上架':'儲存、上架並自動裝備'):'儲存至 BAG 並自動裝備 · 消耗一次權限'}</button>
   <small>以「自由畫輪廓」一筆畫出外形並放開自動閉合，之後可使用畫筆、橡皮擦、Undo／Redo 與清除重畫。滾輪縮放；使用「移動翅膀輪廓圖」調整檢視位置。玩家儲存後直接加入自己的背包並裝備，不會公開販售。</small>
  </div>
  <div class="wing-painter-stage"><div class="wing-left-wing-label"><strong>LEFT WING · 左翅原圖</strong><span>RIGHT WING · 自動鏡像</span></div><div class="wing-painter-checker">
   <canvas class="wing-painter-canvas" width="768" height="640" aria-label="可繪畫的翅膀畫布"></canvas>
   <span class="wing-attachment-note">右側：翅膀與手臂接合處</span>
  </div><small data-wing-status>畫布 768 × 640 · 操作記錄上限 60 步</small></div>
 </section>`;
 const root=ui.content.querySelector('.wing-painter'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
 let publishing=false;
 if(isGm)root.querySelector('[data-wing-field=ability]').value=design.ability||'glide';
 const report=t=>{root.querySelector('[data-wing-status]').textContent=t;};
 const snapshot=()=>{history.push(copy({outline:design.outline,strokes:design.strokes,scaleX:design.scaleX,scaleY:design.scaleY,shape:design.shape}));if(history.length>60)history.shift();redo.length=0;};
 const restore=value=>{Object.assign(design,copy(value));root.querySelectorAll('[data-wing-scale]').forEach(el=>el.value=design[el.dataset.wingScale]);draw();};
 function draw(){
  renderPaintedWing(canvas,design);
  if(active?.tool==='outline'&&active.points.length){
   ctx.save();ctx.lineWidth=4;ctx.strokeStyle='#16b7ff';ctx.fillStyle='#ffffff';ctx.setLineDash([9,5]);
   ctx.beginPath();
   active.points.forEach(([x,y],i)=>{const px=(.5+(x-.5)*(design.scaleX||1))*canvas.width,py=(.5+(y-.5)*(design.scaleY||1))*canvas.height;if(!i)ctx.moveTo(px,py);else ctx.lineTo(px,py);});
   ctx.stroke();ctx.setLineDash([]);
   for(const [x,y] of active.points){ctx.beginPath();ctx.arc((.5+(x-.5)*(design.scaleX||1))*canvas.width,(.5+(y-.5)*(design.scaleY||1))*canvas.height,2.5,0,Math.PI*2);ctx.fill();}
   ctx.restore();
  }
  canvas.style.transform=`translate(${pan[0]}px,${pan[1]}px) scale(${zoom})`;
  root.querySelector('[data-wing-zoom-label]').textContent=Math.round(zoom*100)+'%';
 }
 const imagePoint=event=>{
  const rect=canvas.getBoundingClientRect();
  return [clamp(.5+((event.clientX-rect.left)/rect.width-.5)/(design.scaleX||1),0,1),clamp(.5+((event.clientY-rect.top)/rect.height-.5)/(design.scaleY||1),0,1)];
 };
 const setZoom=value=>{zoom=clamp(value,.35,5);draw();};
 draw();
 root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.wingTool){
   if(!design.outline?.length&&b.dataset.wingTool!=='outline'&&b.dataset.wingTool!=='pan'){
    report('請先使用「自由畫輪廓」在畫布上繪製完整輪廓');return;
   }
   tool=b.dataset.wingTool;root.querySelectorAll('[data-wing-tool]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.wingTool===tool));return;
  }
  if(b.hasAttribute('data-wing-clear-outline')){
   snapshot();design.outline=[];design.shape='freehand';tool='outline';
   root.querySelectorAll('[data-wing-tool]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.wingTool===tool)));
   report('輪廓已清除，按住並拖曳畫出新輪廓');draw();return;
  }
  if(b.hasAttribute('data-wing-undo')){if(!history.length)return;redo.push(copy({outline:design.outline,strokes:design.strokes,scaleX:design.scaleX,scaleY:design.scaleY,shape:design.shape}));restore(history.pop());return;}
  if(b.hasAttribute('data-wing-redo')){if(!redo.length)return;history.push(copy({outline:design.outline,strokes:design.strokes,scaleX:design.scaleX,scaleY:design.scaleY,shape:design.shape}));restore(redo.pop());return;}
  if(b.dataset.wingZoom)setZoom(zoom*(b.dataset.wingZoom==='1'?1.25:.8));
  if(b.hasAttribute('data-wing-reset-view')){pan=[0,0];setZoom(1);}
  if(b.hasAttribute('data-wing-publish')){
   if(publishing)return;
   const input=copy(design);
   input.name=String(root.querySelector('[data-wing-field=name]').value||'').trim();
   input.tier=isGm?Number(root.querySelector('[data-wing-field=tier]').value):3;
   input.color=root.querySelector('[data-wing-field=color]').value;
   input.ability=isGm?root.querySelector('[data-wing-field=ability]').value:'glide';
   input.drawRatePct=isGm?Number(root.querySelector('[data-wing-field=drawRatePct]').value):0;
   if(isGm)for(const field of ['impulse','gravity','flapMs'])input[field]=Number(root.querySelector(`[data-wing-field="${field}"]`).value);
    else Object.assign(input,{impulse:10.15,gravity:.585,flapMs:300});
   if(input.name.length<1)return report('請先命名翅膀');
   if(!input.outline||input.outline.length<3)return report('必須先繪製封閉輪廓');
   if(!Number.isFinite(input.drawRatePct)||input.drawRatePct<0||input.drawRatePct>100)
    return report('中獎率必須為 0–100%');
   if(input.strokes.length>90)return report('筆畫超出 90 筆，請使用 Undo 減少筆畫');
   if(JSON.stringify({action:isGm?(design.id?'gm-wing-update':'gm-wing-publish'):'redeem-wing-design',wing:input}).length>280000)
    return report('繪圖資料超過上架容量，請減少筆畫');
   if(preview){try{normalizePaintedWing(input,'preview-wing');report('GM TEST：繪圖驗證通過；正式玩家將存入 BAG、自動裝備並消耗一次權限。測試不會上架、扣除或新增任何資料。');}catch(error){report('GM TEST：'+error.message);}return;}
   publishing=true;b.disabled=true;
   report('正在儲存翅膀至伺服器…');
   // A one-way server-action left this text on screen forever on errors.
   // Receive an explicit success/error callback and always unlock the button.
   const timeout=setTimeout(()=>{
    if(!publishing)return;
    publishing=false;b.disabled=false;
    report('儲存回覆逾時；請先檢查 BAG，再決定是否重新送出');
   },35000);
   ui.emit('wing-publish-request',{
    wing:input,wingId:isGm?design.id||null:null,personal:!isGm,
    resolve:result=>{
     clearTimeout(timeout);
     if(!publishing)return;
     publishing=false;b.disabled=false;
     report((isGm?(design.id?'已更新並上架：':'已上架並自動裝備：'):'已存入背包並裝備：')+(result?.wingName||input.name));
     ui[draftKey]=null;
    },
    reject:error=>{
     clearTimeout(timeout);
     publishing=false;b.disabled=false;
     report('儲存失敗：'+String(error?.message||error||'伺服器未回應'));
    }
   });
  }
 });
 root.addEventListener('input',event=>{
  const el=event.target;
  if(el.hasAttribute('data-wing-size')){size=+el.value;root.querySelector('[data-wing-size-label]').textContent=size+'px';}
  if(el.hasAttribute('data-wing-opacity'))opacity=+el.value;
  if(el.hasAttribute('data-wing-pen'))pen=el.value;
  if(el.hasAttribute('data-wing-mirror-x'))mirrorX=el.checked;
  if(el.hasAttribute('data-wing-mirror-y'))mirrorY=el.checked;
  if(el.dataset.wingField==='name')design.name=el.value;
  if(el.dataset.wingScale){snapshot();const axis=el.dataset.wingScale;design[axis]=+el.value;
   if(root.querySelector('[data-wing-ratio]').checked){
    const other=axis==='scaleX'?'scaleY':'scaleX';design[other]=design[axis];
    root.querySelector(`[data-wing-scale="${other}"]`).value=design[axis];}
   draw();}
  if(el.dataset.wingField==='color'){design.color=el.value;draw();}
 });
 // No predefined shapes: freehand vertices are the authoritative silhouette.
 const start=e=>{
  if(pointers.size>1)return;pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);
  if(tool==='pan'){active={start:[e.clientX,e.clientY],pan:[...pan]};return;}
  if(!design.outline?.length&&tool!=='outline'){report('請先畫出封閉輪廓');return;}
  snapshot();const point=imagePoint(e);
  if(tool==='outline')active={tool,points:[point]};
  else {const stroke={tool,color:pen,size,opacity,material:'ink',mirrorX,mirrorY,points:[point]};active=stroke;design.strokes.push(stroke);}
  draw();
 };
 let pinching=false,pinchDistance=0;
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();pointers.set(e.pointerId,[e.clientX,e.clientY]);canvas.setPointerCapture(e.pointerId);if(pointers.size===1&&!pinching)start(e);else if(pointers.size===2){if(active&&active.tool&&history.length)restore(history.pop());active=null;pointerId=null;pinching=true;const pair=[...pointers.values()];pinchDistance=Math.hypot(pair[0][0]-pair[1][0],pair[0][1]-pair[1][1]);draw();}});
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size===2){const pair=[...pointers.values()],distance=Math.hypot(pair[0][0]-pair[1][0],pair[0][1]-pair[1][1]);
   if(pinchDistance>0&&distance>0)setZoom(zoom*distance/pinchDistance);pinchDistance=distance;return;}
  if(e.pointerId!==pointerId||!active)return;
  if(tool==='pan'){pan=[active.pan[0]+e.clientX-active.start[0],active.pan[1]+e.clientY-active.start[1]];}
  else{
   const point=imagePoint(e),last=active.points.at(-1);
   if(Math.hypot(point[0]-last[0],point[1]-last[1])>.002&&active.points.length<(tool==='outline'?2048:96))active.points.push(point);
  }
  draw();
 });
 const stop=e=>{
  pointers.delete(e.pointerId);if(pointers.size<2)pinchDistance=0;if(!pointers.size)pinching=false;
  if(e.pointerId!==pointerId)return;
  if(tool==='outline'){
   if(active?.points.length>=3){
    design.outline=simplifyFreehandOutline(active.points,96);
    design.shape='freehand';
    tool='brush';
    root.querySelectorAll('[data-wing-tool]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.wingTool===tool)));
    report('已完成自由輪廓（'+design.outline.length+' 個節點），可以開始上色或重新繪製');
   }else report('輪廓過短，請按住並拖曳畫出完整外形');
  }
  active=null;pointerId=null;draw();
 };
 canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('lostpointercapture',stop);
 canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY>0?.9:1.1));},{passive:false});
}
