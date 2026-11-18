import {renderPaintedWing,presetWingOutline} from './reletter/painted-wing-art.js';

// GM-only atelier. Each paint operation is stored in normalized image space.
// Undo snapshots are bounded, so mobile Safari does not retain huge bitmaps.
const safe=(v)=>String(v||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[ch]));
const copy=x=>structuredClone(x);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function mountWingPainter(ui){
 if(!ui.self?.profile?.admin){ui.content.textContent='GM only';return;}
 const design=ui.wingDraft||{
  name:'',tier:4,color:'#dfd1bc',ability:'glide',shape:'swallowtail',
  outline:presetWingOutline(),strokes:[],scaleX:1,scaleY:1,
  impulse:11,gravity:.53,flapMs:300
 };
 ui.wingDraft=design;let tool='brush',material='ink',pen='#1b1b22',
  size=12,opacity=1,mirrorX=false,mirrorY=false,zoom=1,
  pan=[0,0],active=null,pointerId=null,history=[],redo=[],pointers=new Map();
 ui.content.innerHTML=`<section class="wing-painter" aria-label="GM wing painting editor">
  <div class="wing-painter-tools">
   <label>翅膀名稱<input data-wing-field="name" value="${safe(design.name)}" maxlength="50" placeholder="請命名翅膀"></label>
   <label>品質<select data-wing-field="tier">${['White','Green','Blue','Purple · Epic','Gold'].map((s,i)=>`<option value="${i+1}" ${design.tier===i+1?'selected':''}>${s}</option>`).join('')}</select></label>
   <label>輪廓<select data-wing-shape><option value="swallowtail">燕尾蝶</option><option value="rounded">圓翅</option><option value="moth">飛蛾</option><option value="longtail">長尾</option></select></label>
   <div class="wing-tools-row" role="toolbar" aria-label="畫筆工具">
    <button type="button" data-wing-tool="outline">畫輪廓</button>
    <button type="button" data-wing-tool="brush" aria-pressed="true">畫筆</button>
    <button type="button" data-wing-tool="eraser">橡皮擦</button>
    <button type="button" data-wing-tool="pan">拖曳畫布</button>
    <button type="button" data-wing-undo>↶ Undo</button>
    <button type="button" data-wing-redo>↷ Redo</button>
   </div>
   <label>筆頭材質<select data-wing-material><option value="ink">實心墨水</option><option value="airbrush">柔霧噴槍</option><option value="chalk">粉彩顆粒</option><option value="watercolor">水彩暈染</option><option value="metallic">金屬光澤</option></select></label>
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
   <label>附帶能力<select data-wing-field="ability"><option value="glide">滑翔減緩落下</option><option value="swift">移動速度提升</option><option value="aerial">跳躍能力提升</option><option value="guardian">防護力提升</option><option value="sparkle">魔法粉塵</option></select></label>
   <label>跳躍推力<input data-wing-field="impulse" type="number" step=".1" min="5" max="18" value="${design.impulse}"></label>
   <label>重力係數<input data-wing-field="gravity" type="number" step=".01" min=".2" max="1" value="${design.gravity}"></label>
   <label>翅膀拍動間隔（ms）<input data-wing-field="flapMs" type="number" min="180" max="900" step="10" value="${design.flapMs}"></label>
   <button type="button" class="panel-button" data-wing-publish>儲存並立即上架</button>
   <small>先以「畫輪廓」圍成封閉形狀，再在輪廓內作畫。滾輪縮放，拖曳畫布工具移動；雙指縮放。儲存後自動加入 GM 背包。</small>
  </div>
  <div class="wing-painter-stage"><div class="wing-painter-checker">
   <canvas class="wing-painter-canvas" width="768" height="640" aria-label="可繪畫的翅膀畫布"></canvas>
  </div><small data-wing-status>畫布 768 × 640 · 操作記錄上限 60 步</small></div>
 </section>`;
 const root=ui.content.querySelector('.wing-painter'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
 root.querySelector('[data-wing-field=ability]').value=design.ability||'glide';
 const report=t=>{root.querySelector('[data-wing-status]').textContent=t;};
 const snapshot=()=>{history.push(copy({outline:design.outline,strokes:design.strokes,scaleX:design.scaleX,scaleY:design.scaleY,shape:design.shape}));if(history.length>60)history.shift();redo.length=0;};
 const restore=value=>{Object.assign(design,copy(value));root.querySelectorAll('[data-wing-scale]').forEach(el=>el.value=design[el.dataset.wingScale]);draw();};
 function draw(){
  renderPaintedWing(canvas,design);
  if(active?.tool==='outline'&&active.points.length){
   ctx.save();ctx.lineWidth=4;ctx.strokeStyle='#16b7ff';ctx.fillStyle='#ffffff';ctx.setLineDash([9,5]);
   ctx.beginPath();
   active.points.forEach(([x,y],i)=>{if(!i)ctx.moveTo(x*canvas.width,y*canvas.height);else ctx.lineTo(x*canvas.width,y*canvas.height);});
   ctx.stroke();ctx.setLineDash([]);
   for(const [x,y] of active.points){ctx.beginPath();ctx.arc(x*canvas.width,y*canvas.height,2.5,0,Math.PI*2);ctx.fill();}
   ctx.restore();
  }
  canvas.style.transform=`translate(${pan[0]}px,${pan[1]}px) scale(${zoom})`;
  root.querySelector('[data-wing-zoom-label]').textContent=Math.round(zoom*100)+'%';
 }
 const imagePoint=event=>{
  const rect=canvas.getBoundingClientRect();
  return [clamp((event.clientX-rect.left)/rect.width,0,1),clamp((event.clientY-rect.top)/rect.height,0,1)];
 };
 const setZoom=value=>{zoom=clamp(value,.35,5);draw();};
 draw();
 root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.wingTool){tool=b.dataset.wingTool;root.querySelectorAll('[data-wing-tool]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.wingTool===tool));return;}
  if(b.hasAttribute('data-wing-undo')){if(!history.length)return;redo.push(copy({outline:design.outline,strokes:design.strokes,scaleX:design.scaleX,scaleY:design.scaleY,shape:design.shape}));restore(history.pop());return;}
  if(b.hasAttribute('data-wing-redo')){if(!redo.length)return;history.push(copy({outline:design.outline,strokes:design.strokes,scaleX:design.scaleX,scaleY:design.scaleY,shape:design.shape}));restore(redo.pop());return;}
  if(b.dataset.wingZoom)setZoom(zoom*(b.dataset.wingZoom==='1'?1.25:.8));
  if(b.hasAttribute('data-wing-reset-view')){pan=[0,0];setZoom(1);}
  if(b.hasAttribute('data-wing-publish')){
   const input={...design};input.name=String(root.querySelector('[data-wing-field=name]').value||'').trim();
   input.tier=Number(root.querySelector('[data-wing-field=tier]').value);
   input.color=root.querySelector('[data-wing-field=color]').value;
   input.ability=root.querySelector('[data-wing-field=ability]').value;
   for(const field of ['impulse','gravity','flapMs'])input[field]=Number(root.querySelector(`[data-wing-field="${field}"]`).value);
   if(input.name.length<1)return report('請先命名翅膀');
   if(!input.outline||input.outline.length<3)return report('必須先繪製封閉輪廓');
   report('正在儲存翅膀至伺服器…');ui.emit('server-action',{action:'gm-wing-publish',wing:input});
  }
 });
 root.addEventListener('input',event=>{
  const el=event.target;
  if(el.hasAttribute('data-wing-size')){size=+el.value;root.querySelector('[data-wing-size-label]').textContent=size+'px';}
  if(el.hasAttribute('data-wing-opacity'))opacity=+el.value;
  if(el.hasAttribute('data-wing-pen'))pen=el.value;
  if(el.hasAttribute('data-wing-mirror-x'))mirrorX=el.checked;
  if(el.hasAttribute('data-wing-mirror-y'))mirrorY=el.checked;
  if(el.dataset.wingMaterial)material=el.value;
  if(el.dataset.wingScale){snapshot();const axis=el.dataset.wingScale;design[axis]=+el.value;
   if(root.querySelector('[data-wing-ratio]').checked){
    const other=axis==='scaleX'?'scaleY':'scaleX';design[other]=design[axis];
    root.querySelector(`[data-wing-scale="${other}"]`).value=design[axis];}
   draw();}
  if(el.dataset.wingField==='color'){design.color=el.value;draw();}
 });
 root.querySelector('[data-wing-shape]').value=design.shape;
 root.querySelector('[data-wing-shape]').addEventListener('change',event=>{
  snapshot();design.shape=event.target.value;design.outline=presetWingOutline(design.shape);draw();
 });
 const start=e=>{
  if(pointers.size>1)return;pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);
  if(tool==='pan'){active={start:[e.clientX,e.clientY],pan:[...pan]};return;}
  snapshot();const point=imagePoint(e);
  if(tool==='outline')active={tool,points:[point]};
  else {const stroke={tool,color:pen,size,opacity,material,mirrorX,mirrorY,points:[point]};active=stroke;design.strokes.push(stroke);}
  draw();
 };
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===1)start(e);});
 canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size===2){const pair=[...pointers.values()],distance=Math.hypot(pair[0][0]-pair[1][0],pair[0][1]-pair[1][1]);
   if(!ui._pinchDistance)ui._pinchDistance=distance;
   else{setZoom(zoom*distance/ui._pinchDistance);ui._pinchDistance=distance;}return;}
  if(e.pointerId!==pointerId||!active)return;
  if(tool==='pan'){pan=[active.pan[0]+e.clientX-active.start[0],active.pan[1]+e.clientY-active.start[1]];}
  else{
   const point=imagePoint(e),last=active.points.at(-1);
   if(Math.hypot(point[0]-last[0],point[1]-last[1])>.002&&active.points.length<96)active.points.push(point);
  }
  draw();
 });
 const stop=e=>{
  pointers.delete(e.pointerId);if(pointers.size<2)ui._pinchDistance=0;
  if(e.pointerId!==pointerId)return;
  if(tool==='outline'&&active?.points.length>=3)design.outline=copy(active.points);
  active=null;pointerId=null;draw();
 };
 canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
 canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY>0?.9:1.1));},{passive:false});
}
