// Normalized, device-independent offsets from the existing A button.
export const PROMPT_DEFAULT=Object.freeze({x:0,gap:0,scale:.7,opacity:.5});
export const PROMPT_LIMITS=Object.freeze({x:[-.4,.4],gap:[0,.6],scale:[.4,1.8],opacity:[.1,1]});
export function validPromptLayout(value){
 return !!value&&Object.entries(PROMPT_LIMITS).every(([key,[min,max]])=>Number.isFinite(value[key])&&value[key]>=min&&value[key]<=max);
}
export function operationPromptLayout(value){
 const out={...PROMPT_DEFAULT};
 for(const [key,[min,max]] of Object.entries(PROMPT_LIMITS))if(Number.isFinite(value?.[key]))out[key]=Math.max(min,Math.min(max,value[key]));
 return out;
}
// The visible box is anchored by its bottom centre, not its unscaled top.
export function promptPlacement(anchor,viewport,layout,boxes){
 const {width:w,height:h}=viewport,p=operationPromptLayout(layout);
 const available=Math.max(1,Math.min(h-8,anchor.top-8)-4);
 const total=boxes.reduce((sum,b)=>sum+b.height,0);
 const gaps=Math.max(0,boxes.length-1)*4;
 const scale=Math.min(p.scale,(available-gaps>0?available-gaps:1)/Math.max(1,total),...boxes.map(b=>(w-8)/Math.max(1,b.width)));
 const bottom=Math.max(4+total*scale+gaps,Math.min(h-4,anchor.top-8-p.gap*h));
 let cursor=Math.min(anchor.top-8,bottom);
 return boxes.map(b=>{
  const half=Math.min(w/2,Math.max(0,b.width*scale/2+4)),x=Math.max(half,Math.min(w-half,anchor.left+anchor.width/2+p.x*w));
  const result={x,y:cursor,scale,opacity:p.opacity};cursor-=b.height*scale+4;return result;
 });
}
