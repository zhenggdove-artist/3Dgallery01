// Shared deterministic swept collision, cached per immutable stroke archive.
const cache=new WeakMap(),EMPTY=[];
const R=.218,H=.75,C=.968,EPS=.003;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);return n>1e-8?a.map(v=>v/n):null;};
function segment(a,b,s,pointA=null,pointB=null){
 const normal=unit(s.normal),d=sub(b,a);if(!normal)return null;
 let tangent=unit(d.map((v,i)=>v-dot(d,normal)*normal[i]));
 if(!tangent)tangent=unit(cross(normal,Math.abs(normal[0])<.8?[1,0,0]:[0,1,0]));
 const side=unit(cross(normal,tangent)),axes=[tangent,side,normal],center=a.map((v,i)=>(v+b[i])/2);
 // Conservative oriented prism encloses visible elliptical section.
 const radial=(axis,point)=>point?Math.abs(dot(axis,point))*s.size:s.size;
 const ext=[Math.hypot(...d)/2+Math.max(radial(tangent,pointA),radial(tangent,pointB)),Math.max(radial(side,pointA),radial(side,pointB)),s.thickness/2];
 const half=ext.map((v,i)=>v+R+H*Math.abs(axes[i][1]));
 const spread=center.map((_,i)=>axes.reduce((n,axis,j)=>n+Math.abs(axis[i])*half[j],0));
 return {center,axes,half,min:center.map((v,i)=>v-spread[i]),max:center.map((v,i)=>v+spread[i])};
}
function build(items){
 if(!items.length)return null;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const box of items)for(let i=0;i<3;i++){min[i]=Math.min(min[i],box.min[i]);max[i]=Math.max(max[i],box.max[i]);}
 if(items.length<=8)return {min,max,items};
 const axis=[0,1,2].sort((a,b)=>(max[b]-min[b])-(max[a]-min[a]))[0];
 items.sort((a,b)=>a.center[axis]-b.center[axis]);const mid=items.length>>1;
 return {min,max,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
}
function index(list){
 if(!list?.length)return null;if(cache.has(list))return cache.get(list);
 const boxes=[];
 for(const s of list){
  const p=s.points;if(!p?.length)continue;
  if(p.length===1){const box=segment(p[0],p[0],s);if(box)boxes.push(box);continue;}
  const n=unit(s.normal);if(!n)continue;
  const sides=p.map((q,i)=>{const project=d=>unit(d.map((v,j)=>v-dot(d,n)*n[j]));const t=project(sub(p[Math.min(p.length-1,i+1)],p[Math.max(0,i-1)]))||project(sub(p[Math.min(p.length-1,i+1)],q))||project(sub(q,p[Math.max(0,i-1)]));return t?unit(cross(n,t)):null;});
  for(let i=1;i<p.length;i++){const box=segment(p[i-1],p[i],s,sides[i-1],sides[i]);if(box)boxes.push(box);}
 }
 const tree=build(boxes);cache.set(list,tree);return tree;
}
function overlaps(node,a,b){return [0,1,2].every(i=>Math.max(a[i],b[i])>=node.min[i]&&Math.min(a[i],b[i])<=node.max[i]);}
function contact(box,a,b){
 const offset=sub(a,box.center),delta=sub(b,a);let enter=0,exit=1,inside=true;
 for(let i=0;i<3;i++){
  const p=dot(offset,box.axes[i]),v=dot(delta,box.axes[i]),h=box.half[i]-EPS;
  if(Math.abs(p)>=h-1e-7)inside=false;
  if(Math.abs(v)<1e-9){if(Math.abs(p)>=h)return 1;continue;}
  let lo=(-h-p)/v,hi=(h-p)/v;if(lo>hi)[lo,hi]=[hi,lo];
  enter=Math.max(enter,lo);exit=Math.min(exit,hi);if(enter>=exit)return 1;
 }
 // Do not imprison an actor when GM creates a stroke around them.
 return inside||exit<=0||enter>=1?1:Math.max(0,enter);
}
export function spacePaintMoveFraction(list=EMPTY,from,to){
 if(!list.length)return 1;const tree=index(list);if(!tree)return 1;
 const a=[from[0],from[1]+C,from[2]],b=[to[0],to[1]+C,to[2]];let best=1;
 function visit(node){if(!node||best===0||!overlaps(node,a,b))return;
  if(node.items){for(const box of node.items)if(overlaps(box,a,b))best=Math.min(best,contact(box,a,b));}
  else{visit(node.left);visit(node.right);}
 }
 visit(tree);
 return best===1?1:Math.max(0,best-EPS/Math.max(EPS,Math.hypot(...sub(to,from))));
}
export function spacePaintFloor(list,x,z,y){
 if(!list?.length)return -Infinity;
 const from=[x,y+.035,z],to=[x,-4,z];if(from[1]<=to[1])return -Infinity;
 const t=spacePaintMoveFraction(list,from,to);
 return t<1?from[1]+(to[1]-from[1])*t:-Infinity;
}
export const SPACE_PAINT_FLIGHT_LIMIT=150;
export const SPACE_PAINT_FLIGHT_SPEED=8.64;
