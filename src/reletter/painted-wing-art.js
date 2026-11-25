import {wingContours} from '../shared/custom-wings.js';
// Compact, replayable 2-D wing artwork shared by GM editor and 3-D texture.
// Coordinates are normalized [0..1] so browser zoom/pan never alter the art.
const DEFAULT_OUTLINE=[[.07,.58],[.11,.36],[.19,.2],[.34,.09],[.57,.04],[.75,.08],[.89,.17],[.94,.31],[.88,.43],[.78,.48],[.91,.59],[.84,.7],[.76,.73],[.85,.97],[.72,.86],[.64,.76],[.52,.84],[.42,.79],[.30,.85],[.17,.75]];
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function presetWingOutline(shape='swallowtail'){
 if(shape==='rounded')return DEFAULT_OUTLINE.map(([x,y])=>[clamp(.5+(x-.5)*.91,0,1),clamp(.5+(y-.5)*.8,0,1)]);
 if(shape==='moth')return DEFAULT_OUTLINE.map(([x,y])=>[x,clamp(y*.84+.08,0,1)]);
 if(shape==='longtail')return DEFAULT_OUTLINE.map(([x,y])=>[x,y>.7?Math.min(1,y*1.11):y]);
 return DEFAULT_OUTLINE.map(p=>[...p]);
}
function pathFor(c,points,w,h,sx,sy,append=false){
 if(!points||points.length<3)return false;
 if(!append)c.beginPath();
 points.forEach(([x,y],i)=>{
  const px=(.5+(x-.5)*sx)*w,py=(.5+(y-.5)*sy)*h;
  if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
 });c.closePath();return true;
}
function pencilStamp(c,x,y,r,color,material,opacity){
 c.globalAlpha=opacity;
 if(material==='airbrush'||material==='watercolor'){
  const gradient=c.createRadialGradient(x,y,.1,x,y,r*2.5);
  gradient.addColorStop(0,color);
  gradient.addColorStop(material==='airbrush'?.27:.36,color+'55');
  gradient.addColorStop(1,color+'00');
  c.fillStyle=gradient;c.beginPath();c.arc(x,y,r*2.5,0,7);c.fill();
 }else if(material==='chalk'){
  c.fillStyle=color;
  for(let i=0;i<7;i++){
   const angle=i*2.3999+ x*.01+y*.03,amount=r*(i%4)/4;
   c.beginPath();c.arc(x+Math.cos(angle)*amount,y+Math.sin(angle)*amount,Math.max(.5,r*.25),0,7);c.fill();
  }
 }else if(material==='metallic'){
  c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,7);c.fill();
  c.fillStyle='#ffffff88';c.beginPath();c.arc(x-r*.24,y-r*.27,Math.max(.5,r*.27),0,7);c.fill();
 }else{
  c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,7);c.fill();
 }
}
function strokeOn(c,s,w,h){
 const points=s.points||[];if(!points.length)return;
 const r=clamp(s.size||4,1,90)/2,step=Math.max(1,r*.43);
 const reflections=[[false,false]];
 if(s.mirrorX)reflections.push([true,false]);
 if(s.mirrorY)reflections.push([false,true]);
 if(s.mirrorX&&s.mirrorY)reflections.push([true,true]);
 for(const [mx,my] of reflections){
  c.save();
  if(s.tool==='eraser')c.globalCompositeOperation='destination-out';
  let prev=null;
  for(const [u,v] of points){
   const x=(mx?1-u:u)*w,y=(my?1-v:v)*h;
   if(prev){
    const dist=Math.hypot(x-prev[0],y-prev[1]),count=Math.min(500,Math.ceil(dist/step));
    for(let j=1;j<=count;j++){
     const t=j/count;
     pencilStamp(c,prev[0]+(x-prev[0])*t,prev[1]+(y-prev[1])*t,r,s.tool==='eraser'?'#000000':s.color||'#171717',s.material||'ink',clamp(s.opacity??1,.05,1));
    }
   }else pencilStamp(c,x,y,r,s.tool==='eraser'?'#000000':s.color||'#171717',s.material||'ink',clamp(s.opacity??1,.05,1));
   prev=[x,y];
  }
  c.restore();
 }
}
export function renderPaintedWing(canvas,item){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 const sx=clamp(Number(item.scaleX)||1,.35,2),sy=clamp(Number(item.scaleY)||1,.35,2);
 // A new freehand design starts with a blank transparent canvas, not a
 // hidden template masquerading as a hand-drawn outline.
 const legacy=item.shape==='freehand'?null:presetWingOutline(item.shape);
 const contours=wingContours(item);
 const shapes=contours.length?contours:(legacy?[{points:legacy,color:'#26242a',size:8}]:[]);
 ctx.save();
 ctx.translate(w*(.5+(Number(item.offsetX)||0)),h*(.5+(Number(item.offsetY)||0)));ctx.scale(sx,sy);ctx.translate(-w/2,-h/2);
 if(!shapes.length){ctx.restore();return canvas;}
 // A nonzero union needs consistent winding, including hand-drawn clockwise
 // and counterclockwise loops. Independent circles remain separate islands.
 const oriented=points=>{let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}return area<0?[...points].reverse():points;};
 ctx.beginPath();for(const contour of shapes)pathFor(ctx,oriented(contour.points),w,h,1,1,true);
 ctx.fillStyle=item.color||'#e3cbb5';ctx.fill();
 ctx.save();ctx.clip();
 for(const stroke of item.strokes||[])strokeOn(ctx,stroke,w,h);
 ctx.restore();
 ctx.lineJoin='round';ctx.lineCap='round';
 for(const contour of shapes){pathFor(ctx,contour.points,w,h,1,1);ctx.strokeStyle=contour.color;ctx.lineWidth=contour.size;ctx.stroke();}
 ctx.restore();return canvas;
}
export function paintedWingCanvas(item){
 const c=document.createElement('canvas');c.width=768;c.height=640;
 return renderPaintedWing(c,item);
}
