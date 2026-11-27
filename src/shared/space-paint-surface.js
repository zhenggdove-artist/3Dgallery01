// Stable UV charts for the original 12-sided tube. Side seam and both caps
// have separate coordinates; the render mesh need not gain extra draw calls.
export const SPACE_PAINT_SIDES=12;
export const SURFACE_POINT_BUDGET=16384,SURFACE_STROKE_BUDGET=1024;
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
export function surfaceInfo(s){
 let points=s.points;
 if(points.length===1){
  const n=s.normal,axis=Math.abs(n[0])<.995?[1,0,0]:[0,1,0],q=axis.map((v,i)=>v-dot(axis,n)*n[i]),d=Math.hypot(...q),p=points[0];
  points=[p.map((v,i)=>v-q[i]/d*s.size*.999),p,p.map((v,i)=>v+q[i]/d*s.size*.999)];
 }
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(...points[i].map((v,j)=>v-points[i-1][j])));
 const total=lengths.at(-1)||.001,a=s.size,b=s.thickness/2;
 const circumference=Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)));
 return {points,lengths:lengths.map(v=>v/total),total,circumference,a,b,sideFaces:(points.length-1)*24};
}
const capUV=j=>[.5+.5*Math.cos(j*Math.PI/6),.5+.5*Math.sin(j*Math.PI/6)];
export function surfaceFace(info,face){
 if(face<0||face>=info.sideFaces+24)return null;
 if(face<info.sideFaces){
  const ring=Math.floor(face/24),j=Math.floor(face%24/2),a=info.lengths[ring],b=info.lengths[ring+1],v=j/12,w=(j+1)/12;
  return {chart:0,uv:face%2?[[a,w],[b,w],[b,v]]:[[a,v],[a,w],[b,v]]};
 }
 const i=face-info.sideFaces,j=Math.floor(i/2),end=i%2;
 return {chart:end?2:1,uv:[[.5,.5],capUV(j+(end?0:1)),capUV(j+(end?1:0))]};
}
export function surfaceNear(s,info,chart,p,position){
 if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return false;
 let center=chart===1?info.points[0]:info.points.at(-1);
 if(chart===0){
  let i=1;while(i<info.lengths.length-1&&info.lengths[i]<p[0])i++;
  const a=info.lengths[i-1],b=info.lengths[i],t=b>a?(p[0]-a)/(b-a):0;
  center=info.points[i-1].map((v,j)=>v+(info.points[i][j]-v)*t);
 }
 return Math.hypot(center[0]-position[0],center[1]-position[1]-1.4,center[2]-position[2])<=19+Math.max(s.size,s.thickness/2);
}
export function normalizeSurfaceStroke(raw,s,position=null){
 if(!raw||!['brush','eraser'].includes(raw.tool)||!Number.isInteger(raw.chart)||raw.chart<0||raw.chart>2||
  !Number.isFinite(raw.size)||raw.size<.04||raw.size>.95||typeof raw.color!=='string'||!/^#[0-9a-f]{6}$/i.test(raw.color)||
  !Array.isArray(raw.points)||raw.points.length<1||raw.points.length>130)return null;
 const info=surfaceInfo(s),points=[];
 for(const p of raw.points){
  if(!Array.isArray(p)||p.length!==2||!p.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||position&&!surfaceNear(s,info,raw.chart,p,position))return null;
  points.push(p.map(v=>+v.toFixed(5)));
 }
 return {chart:raw.chart,tool:raw.tool,size:raw.size,color:raw.color.toLowerCase(),points};
}
export function surfaceBudget(map){
 let strokes=0,points=0;for(const list of Object.values(map)){strokes+=list.length;for(const s of list)points+=s.points.length;}
 return strokes<=SURFACE_STROKE_BUDGET&&points<=SURFACE_POINT_BUDGET;
}
