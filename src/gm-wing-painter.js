import {renderPaintedWing} from './reletter/painted-wing-art.js';
import {normalizePaintedWing,wingContours,MAX_WING_CONTOURS} from './shared/custom-wings.js';

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
// Bounds and handles are in normalized canvas space, independent of CSS size.
export function wingBounds(art){
 const pts=wingContours(art).flatMap(c=>c.points),xs=pts.map(q=>.5+(art.offsetX||0)+(q[0]-.5)*(art.scaleX||1)),ys=pts.map(q=>.5+(art.offsetY||0)+(q[1]-.5)*(art.scaleY||1));
 return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
}
export function wingHandles(b){
 const mx=(b.left+b.right)/2,my=(b.top+b.bottom)/2;
 return [[-1,-1,b.left,b.top],[0,-1,mx,b.top],[1,-1,b.right,b.top],[-1,0,b.left,my],[1,0,b.right,my],[-1,1,b.left,b.bottom],[0,1,mx,b.bottom],[1,1,b.right,b.bottom]].map(([hx,hy,x,y])=>({hx,hy,x,y}));
}
export function wingScaleFromDrag(art,b,h,start,point){
 const sx=art.scaleX||1,sy=art.scaleY||1,ox=art.offsetX||0,oy=art.offsetY||0;
 const w=Math.max(.0001,b.right-b.left),height=Math.max(.0001,b.bottom-b.top);
 const ax=h.hx<0?b.right:b.left,ay=h.hy<0?b.bottom:b.top;
 const dx=point[0]-start[0],dy=point[1]-start[1];
 let fx=h.hx?1+dx*h.hx/w:1,fy=h.hy?1+dy*h.hy/height:1;
 const capX=h.hx?Math.max(1,(h.hx<0?ax:1-ax)/w):1,capY=h.hy?Math.max(1,(h.hy<0?ay:1-ay)/height):1;
 if(h.hx&&h.hy){
  const f=1+(dx*h.hx*w+dy*h.hy*height)/(w*w+height*height);
  fx=fy=clamp(f,Math.max(.35/sx,.35/sy),Math.min(2/sx,2/sy,capX,capY));
 }else{
  if(h.hx)fx=clamp(fx,.35/sx,Math.min(2/sx,capX));
  if(h.hy)fy=clamp(fy,.35/sy,Math.min(2/sy,capY));
 }
 return {scaleX:sx*fx,scaleY:sy*fy,offsetX:h.hx?ax+(.5+ox-ax)*fx-.5:ox,offsetY:h.hy?ay+(.5+oy-ay)*fy-.5:oy};
}
// Display-side reflection is reversible and includes offsets, contours and ink.
export function reflectWingArtwork(art){
 const flip=points=>(points||[]).map(([x,y])=>[1-x,y]);
 return {...art,outline:flip(art.outline),...(Array.isArray(art.contours)?{contours:art.contours.map(c=>({...c,points:flip(c.points)}))}:{}),strokes:(art.strokes||[]).map(stroke=>({...stroke,points:flip(stroke.points)})),offsetX:-(art.offsetX||0)};
}
export function pinchWingView(start,mid,distance,baseCenter){
 const zoom=clamp(start.zoom*distance/Math.max(1,start.distance),.65,5);
 const ratio=zoom/start.zoom;
 return {zoom,pan:[mid[0]-baseCenter[0]-(start.mid[0]-baseCenter[0]-start.pan[0])*ratio,mid[1]-baseCenter[1]-(start.mid[1]-baseCenter[1]-start.pan[1])*ratio]};
}
export function mountWingPainter(ui,{personal=false,preview=false}={}){
 const admin=ui.self?.profile?.admin===true;
 if(preview&&!admin)return;
 const isGm=admin&&!personal&&!preview;
 const draftKey=preview?'wingPreviewDraft':isGm?'wingDraft':'wingPersonalDraft';
  if(!preview&&!isGm&&!(ui.world?.profile?.wingDesignCredits>0)){ui.content.textContent='沒有可用的自製翅膀權限';return;}
 const design=ui[draftKey]||{
  name:'',tier:4,color:'#dfd1bc',ability:'glide',shape:'freehand',drawRatePct:1,
  outline:[],contours:[],strokes:[],scaleX:1,scaleY:1,
  impulse:11,gravity:.53,flapMs:300
 };
 design.contours=wingContours(design);ui[draftKey]=design;let tool=design.contours.length?'brush':'outline',pen='#1b1b22',outlinePen='#26242a',outlineSize=8,
  size=12,opacity=1,
  pan=[0,0],zoom=1,side=design.editorSide==='right'?'right':'left',active=null,pointerId=null,history=[],redo=[],touches=new Map(),pinch=null,gestureConsumed=false,strokeBefore=null;
 ui.content.innerHTML=`<section class="wing-painter" aria-label="wing painting editor">
  <div class="wing-painter-tools">
   <label>翅膀名稱<input data-wing-field="name" value="${safe(design.name)}" maxlength="50" placeholder="請命名翅膀"></label>
   <div class="wing-outline-note">繪製左翅或右翅後系統會自動鏡像</div>
   <div class="wing-side-switch"><button type="button" data-wing-side="left" aria-pressed="${side==='left'}">左翅</button><button type="button" data-wing-side="right" aria-pressed="${side==='right'}">右翅</button></div>
   <div class="wing-view-tools"><button type="button" data-wing-zoom="out">−</button><button type="button" data-wing-zoom="reset">100%</button><button type="button" data-wing-zoom="in">＋</button></div>
   ${isGm?`<details class="wing-gm-options"><summary>GM 屬性設定</summary><div class="wing-gm-options-body"><label>品質<select data-wing-field="tier">${['White','Green','Blue','Purple · Epic','Gold'].map((s,i)=>`<option value="${i+1}" ${design.tier===i+1?'selected':''}>${s}</option>`).join('')}</select></label>
   <label>單次中獎率（%）<input data-wing-field="drawRatePct" type="number" min="0" max="100" step=".001" value="${design.drawRatePct??1}"></label>
   <small>所有自訂翅膀機率合計不得超過 100%。</small>
   <fieldset class="wing-ability-options"><legend>附加能力（可複選）</legend>${[['glide','滑翔'],['swift','移速'],['aerial','跳躍'],['guardian','防護'],['sparkle','粉塵']].map(([value,label])=>`<label><input type="checkbox" data-wing-ability value="${value}" ${(design.abilities??[design.ability||'glide']).includes(value)?'checked':''}> ${label}</label>`).join('')}</fieldset>
   <label>跳躍推力<input data-wing-field="impulse" type="number" step=".1" min="5" max="18" value="${design.impulse}"></label>
   <label>重力係數<input data-wing-field="gravity" type="number" step=".01" min=".2" max="1" value="${design.gravity}"></label>
   <label>拍動間隔<input data-wing-field="flapMs" type="number" min="180" max="900" step="10" value="${design.flapMs}"></label></div></details>`:'<small class="wing-personal-note" hidden>個人翅膀固定使用平衡的裝飾數值，並自帶粒子粉塵；儲存一件消耗一次權限。</small>'}
   <button type="button" class="wing-clear-outline" data-wing-clear-outline>清除輪廓／重新繪製</button>
   <div class="wing-tools-row" role="toolbar" aria-label="畫筆工具">
    <button type="button" data-wing-tool="outline" aria-pressed="${tool==='outline'}">繪製翅膀輪廓</button>
    <button type="button" data-wing-tool="brush" aria-pressed="${tool==='brush'}" aria-disabled="${!design.contours.length}">翅膀紋路畫筆</button>
    <button type="button" data-wing-tool="eraser">橡皮擦</button>
    <button type="button" data-wing-tool="pan">移動翅膀輪廓圖</button>
    <button type="button" data-wing-tool="scale">縮放</button>
    <button type="button" data-wing-undo>↶ Undo</button>
    <button type="button" data-wing-redo>↷ Redo</button>
   </div>
   <label><span data-wing-color-label>${tool==='outline'?'外框線顏色':'紋路顏色'}</span><input data-wing-pen type="color" value="${tool==='outline'?outlinePen:pen}"></label>
   <label><span data-wing-width-label>${tool==='outline'?'外框線粗細':'畫筆尺寸'}</span><input data-wing-size type="range" min="1" max="90" value="${tool==='outline'?outlineSize:size}"><output data-wing-size-label>${tool==='outline'?outlineSize:size}px</output></label>
   <label>不透明度<input data-wing-opacity type="range" min=".1" max="1" step=".05" value="1"></label>
   <label>基底色<input data-wing-field="color" type="color" value="${design.color}"></label>
    <button type="button" class="panel-button" data-wing-publish>${isGm?(design.id?'儲存修改並重新上架':'儲存、上架並自動裝備'):'儲存至 BAG'}</button>

  </div>
  <div class="wing-painter-stage"><div class="wing-left-wing-label"><strong data-wing-side-label>${side==='left'?'LEFT WING · 左翅':'RIGHT WING · 右翅'}</strong><span>雙指縮放</span></div><div class="wing-painter-checker">
   <canvas class="wing-painter-canvas" width="768" height="640" aria-label="可繪畫的翅膀畫布"></canvas>
   <div class="wing-tool-hint" data-wing-hint role="status" hidden></div><span class="wing-attachment-note" data-wing-attachment style="right:${side==='left'?'5px':'auto'};left:${side==='right'?'5px':'auto'}">接合處</span>
  </div><small data-wing-status>畫布 768 × 640 · 操作記錄上限 60 步</small></div>
 </section>`;
 const root=ui.content.querySelector('.wing-painter'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
 let publishing=false;
 const artState=()=>copy({outline:design.outline,contours:design.contours,strokes:design.strokes,scaleX:design.scaleX,scaleY:design.scaleY,offsetX:design.offsetX||0,offsetY:design.offsetY||0,shape:design.shape});
 const report=t=>{root.querySelector('[data-wing-status]').textContent=t;};
 const snapshot=()=>{history.push(artState());if(history.length>60)history.shift();redo.length=0;};
 const restore=value=>{Object.assign(design,copy(value));if(!design.contours.length&&['brush','eraser','scale'].includes(tool))tool='outline';syncTools();draw();};
 const hasContour=()=>design.contours.length>0;
 let hintTimer;
 const hint=()=>{const el=root.querySelector('[data-wing-hint]');el.textContent='請先畫出翅膀輪廓';el.hidden=false;clearTimeout(hintTimer);hintTimer=setTimeout(()=>{el.hidden=true;},1800);report('請先畫出翅膀輪廓');};
 function syncTools(){
  root.querySelectorAll('[data-wing-tool]').forEach(el=>{el.setAttribute('aria-pressed',String(el.dataset.wingTool===tool));if(['brush','eraser','scale'].includes(el.dataset.wingTool))el.setAttribute('aria-disabled',String(!hasContour()));});
  const outline=tool==='outline';root.querySelector('[data-wing-color-label]').textContent=outline?'外框線顏色':'紋路顏色';root.querySelector('[data-wing-width-label]').textContent=outline?'外框線粗細':'畫筆尺寸';root.querySelector('[data-wing-pen]').value=outline?outlinePen:pen;root.querySelector('[data-wing-size]').value=outline?outlineSize:size;root.querySelector('[data-wing-size-label]').textContent=(outline?outlineSize:size)+'px';
 }
 function draw(){
  renderPaintedWing(canvas,design);
  if(active?.tool==='outline'&&active.points.length){
   ctx.save();ctx.lineWidth=active.size*Math.sqrt((design.scaleX||1)*(design.scaleY||1));ctx.strokeStyle=active.color;ctx.lineCap='round';ctx.lineJoin='round';
   ctx.beginPath();
   active.points.forEach(([x,y],i)=>{const px=(.5+(design.offsetX||0)+(x-.5)*(design.scaleX||1))*canvas.width,py=(.5+(design.offsetY||0)+(y-.5)*(design.scaleY||1))*canvas.height;if(!i)ctx.moveTo(px,py);else ctx.lineTo(px,py);});
   ctx.stroke();
   ctx.restore();
  }
  canvas.style.transform=`translate(${pan[0]}px,${pan[1]}px) scale(${zoom})`;
  root.querySelector('[data-wing-zoom=reset]').textContent=Math.round(zoom*100)+'%';
  canvas.style.cursor=tool==='pan'?'move':tool==='scale'?'default':'crosshair';
  if(tool==='scale'&&hasContour()){
   const b=wingBounds(design),w=canvas.width,h=canvas.height,r=canvas.getBoundingClientRect();
   const rx=6*w/Math.max(1,r.width),ry=6*h/Math.max(1,r.height);
   ctx.save();ctx.strokeStyle='#087df5';ctx.fillStyle='#fff';ctx.lineWidth=2*w/Math.max(1,r.width);
   ctx.strokeRect(b.left*w,b.top*h,(b.right-b.left)*w,(b.bottom-b.top)*h);
   for(const q of wingHandles(b)){ctx.fillRect(q.x*w-rx,q.y*h-ry,2*rx,2*ry);ctx.strokeRect(q.x*w-rx,q.y*h-ry,2*rx,2*ry);}
   ctx.restore();
  }
 }
 const imagePoint=event=>{
  const rect=canvas.getBoundingClientRect();
  return [clamp(.5+((event.clientX-rect.left)/rect.width-.5-(design.offsetX||0))/(design.scaleX||1),0,1),clamp(.5+((event.clientY-rect.top)/rect.height-.5-(design.offsetY||0))/(design.scaleY||1),0,1)];
 };
 const viewPoint=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];};
 syncTools();draw();
 root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.wingSide){
   const next=b.dataset.wingSide;if(next===side)return;
   Object.assign(design,reflectWingArtwork(design));history=history.map(reflectWingArtwork);redo=redo.map(reflectWingArtwork);
   side=design.editorSide=next;
   root.querySelectorAll('[data-wing-side]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.wingSide===side)));
   root.querySelector('[data-wing-side-label]').textContent=side==='left'?'LEFT WING · 左翅':'RIGHT WING · 右翅';
   const note=root.querySelector('[data-wing-attachment]');note.style.right=side==='left'?'5px':'auto';note.style.left=side==='right'?'5px':'auto';draw();return;
  }
  if(b.dataset.wingZoom){if(b.dataset.wingZoom==='reset'){zoom=1;pan=[0,0];}else zoom=clamp(zoom*(b.dataset.wingZoom==='in'?1.25:.8),.65,5);draw();return;}
  if(b.dataset.wingTool){
   if(!hasContour()&&['brush','eraser','scale'].includes(b.dataset.wingTool)){hint();return;}
   tool=b.dataset.wingTool;syncTools();draw();return;
  }
  if(b.hasAttribute('data-wing-clear-outline')){
   snapshot();design.outline=[];design.contours=[];design.strokes=[];design.shape='freehand';tool='outline';
   syncTools();
   report('輪廓已清除，按住並拖曳畫出新輪廓');draw();return;
  }
  if(b.hasAttribute('data-wing-undo')){if(!history.length)return;redo.push(artState());restore(history.pop());return;}
  if(b.hasAttribute('data-wing-redo')){if(!redo.length)return;history.push(artState());restore(redo.pop());return;}
  if(b.hasAttribute('data-wing-publish')){
   if(publishing)return;
   const input=side==='right'?reflectWingArtwork(copy(design)):copy(design);delete input.editorSide;
   input.name=String(root.querySelector('[data-wing-field=name]').value||'').trim();
   input.tier=isGm?Number(root.querySelector('[data-wing-field=tier]').value):3;
   input.color=root.querySelector('[data-wing-field=color]').value;
   input.abilities=isGm?[...root.querySelectorAll('[data-wing-ability]:checked')].map(el=>el.value):['glide','sparkle'];
   input.ability=input.abilities[0]||'glide';
   input.drawRatePct=isGm?Number(root.querySelector('[data-wing-field=drawRatePct]').value):0;
   if(isGm)for(const field of ['impulse','gravity','flapMs'])input[field]=Number(root.querySelector(`[data-wing-field="${field}"]`).value);
    else Object.assign(input,{impulse:10.15,gravity:.585,flapMs:300});
   if(input.name.length<1)return report('請先命名翅膀');
   if(!wingContours(input).length)return hint();
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
   const payload=JSON.stringify(input);if(ui.wingSaveAttempt?.payload!==payload)ui.wingSaveAttempt={payload,requestId:crypto.randomUUID()};
   ui.emit('wing-publish-request',{
    requestId:ui.wingSaveAttempt.requestId,wing:input,wingId:isGm?design.id||null:null,personal:!isGm,
    resolve:result=>{
     clearTimeout(timeout);
     if(!publishing)return;
     publishing=false;b.disabled=false;
     report((isGm?(design.id?'已更新並上架：':'已上架並自動裝備：'):'已存入背包並裝備：')+(result?.wingName||input.name));
     ui[draftKey]=null;ui.wingSaveAttempt=null;
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
  if(el.hasAttribute('data-wing-size')){if(tool==='outline')outlineSize=+el.value;else size=+el.value;root.querySelector('[data-wing-size-label]').textContent=el.value+'px';}
  if(el.hasAttribute('data-wing-opacity'))opacity=+el.value;
  if(el.hasAttribute('data-wing-pen')){if(tool==='outline')outlinePen=el.value;else pen=el.value;}
  if(el.dataset.wingField==='name')design.name=el.value;
  if(el.hasAttribute('data-wing-ability')){design.abilities=[...root.querySelectorAll('[data-wing-ability]:checked')].map(e=>e.value);design.ability=design.abilities[0]||'glide';}
  if(el.dataset.wingField==='color'){design.color=el.value;draw();}
 });
 // No predefined shapes: freehand vertices are the authoritative silhouette.
 const start=e=>{
  if(pointerId!==null)return;pointerId=e.pointerId;try{checker.setPointerCapture(e.pointerId);}catch{};strokeBefore=artState();
  if(tool==='pan'){active={start:[e.clientX,e.clientY],pan:[...pan]};return;}
  if(tool==='scale'){const r=canvas.getBoundingClientRect(),point=viewPoint(e),b=wingBounds(design);const q=wingHandles(b).map(h=>({...h,dist:Math.hypot((h.x-point[0])*r.width,(h.y-point[1])*r.height)})).sort((a,b)=>a.dist-b.dist)[0];if(!q||q.dist>22)return;snapshot();active={tool,handle:q,bounds:b,original:artState(),start:point};return;}
  if(!hasContour()&&tool!=='outline'){hint();return;}
  if(tool==='outline'&&design.contours.length>=MAX_WING_CONTOURS){report('輪廓上限 24 個');return;}
  snapshot();const point=imagePoint(e);
  if(tool==='outline')active={tool,points:[point],color:outlinePen,size:outlineSize};
  else {const stroke={tool,color:pen,size,opacity,material:'ink',points:[point]};active=stroke;design.strokes.push(stroke);}
  draw();
 };
 const checker=root.querySelector('.wing-painter-checker');
 const pair=()=>{const [a,b]=[...touches.values()];return {mid:[(a[0]+b[0])/2,(a[1]+b[1])/2],distance:Math.hypot(a[0]-b[0],a[1]-b[1])};};
 const cancelStroke=()=>{if(active&&strokeBefore&&tool!=='pan'){Object.assign(design,strokeBefore);history.pop();}active=null;pointerId=null;strokeBefore=null;};
 checker.addEventListener('pointerdown',e=>{
  e.preventDefault();if(e.pointerType==='touch'){
   touches.set(e.pointerId,[e.clientX,e.clientY]);try{checker.setPointerCapture(e.pointerId);}catch{}
   if(touches.size>=2){cancelStroke();pinch={...pair(),zoom,pan:[...pan]};gestureConsumed=true;draw();return;}
   if(gestureConsumed)return;
  }
  start(e);
 });
 checker.addEventListener('pointermove',e=>{
  if(touches.has(e.pointerId)){touches.set(e.pointerId,[e.clientX,e.clientY]);
   if(pinch&&touches.size>=2){const r=checker.getBoundingClientRect(),v=pair(),next=pinchWingView(pinch,v.mid,v.distance,[r.left+r.width/2,r.top+r.height/2]);zoom=next.zoom;pan=next.pan;draw();return;}
   if(gestureConsumed)return;
  }
  if(e.pointerId!==pointerId||!active)return;
  if(tool==='pan'){pan=[active.pan[0]+e.clientX-active.start[0],active.pan[1]+e.clientY-active.start[1]];}
  else if(active.tool==='scale'){Object.assign(design,wingScaleFromDrag(active.original,active.bounds,active.handle,active.start,viewPoint(e)));}
  else{
   const point=imagePoint(e),last=active.points.at(-1);
   if(Math.hypot(point[0]-last[0],point[1]-last[1])>.002&&active.points.length<(tool==='outline'?2048:96))active.points.push(point);
  }
  draw();
 });
 const stop=e=>{
  if(touches.has(e.pointerId)){touches.delete(e.pointerId);if(gestureConsumed){pinch=null;if(!touches.size)gestureConsumed=false;return;}}
  if(e.pointerId!==pointerId)return;
  if(e.type==='pointercancel'){cancelStroke();draw();return;}
  if(tool==='outline'){
   if(active?.points.length>=3){
    const points=simplifyFreehandOutline(active.points,96);
    design.contours.push({points,color:active.color,size:active.size});
    design.outline=design.contours[0].points;
    design.shape='freehand';
    syncTools();
    report('已完成 '+design.contours.length+' 個輪廓；可繼續新增輪廓或切換紋路畫筆');
   }else if(active){history.pop();report('輪廓過短，請按住並拖曳畫出完整外形');}
  }
  active=null;pointerId=null;strokeBefore=null;draw();
 };
 checker.addEventListener('pointerup',stop);checker.addEventListener('pointercancel',stop);checker.addEventListener('lostpointercapture',stop);

}
