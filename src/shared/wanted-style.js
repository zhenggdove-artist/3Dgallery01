export const ZALGO_DEFAULTS=Object.freeze({speed:42,mutation:5,marks:5,size:13,spacing:11,radius:8,squeeze:45,color:'#c3d2ff'});
export const ZALGO_FIELDS=Object.freeze([['speed','流動速度 (px/s)',0,180,1],['mutation','字元變換 (次/秒)',0,15,1],['marks','亂碼疊加密度',0,10,1],['size','字體尺寸 (px)',8,24,1],['spacing','字元間距 (px)',6,30,1],['radius','轉角弧度 (px)',3,22,1],['squeeze','轉角擠壓 (%)',0,85,1]]);
export function normalizeZalgo(value){const s={...ZALGO_DEFAULTS};for(const [key,,min,max] of ZALGO_FIELDS)if(typeof value?.[key]==='number'&&Number.isFinite(value[key]))s[key]=Math.max(min,Math.min(max,Math.round(value[key])));if(typeof value?.color==='string'&&/^#[0-9a-f]{6}$/i.test(value.color))s.color=value.color.toLowerCase();return s;}
export function normalizeWantedLabel(value){return typeof value==='string'?value.replace(/\r\n?/g,'\n'):'';}
export function validWantedLabel(value){return typeof value==='string'&&value.trim().length>0&&value.length<=96&&value.split('\n').length<=6&&!/[\x00-\x09\x0b-\x1f\x7f]/.test(value);}
export function normalizeWantedAlign(v){return ['left','center','right'].includes(v)?v:'center';}
// A single clockwise path: top -> right downward -> bottom leftward -> left upward.
export function roundedPerimeter(w,h,inset,radius){
 const x=inset,y=inset,W=Math.max(1,w-2*inset),H=Math.max(1,h-2*inset),r=Math.min(Math.max(0.1,radius),W/2,H/2);
 const a=W-2*r,b=H-2*r,q=Math.PI*r/2,total=2*a+2*b+4*q;
 const pieces=[['line',x+r,y,0,a],['arc',x+W-r,y+r,-Math.PI/2,q],['line',x+W,y+r,Math.PI/2,b],['arc',x+W-r,y+H-r,0,q],['line',x+W-r,y+H,Math.PI,a],['arc',x+r,y+H-r,Math.PI/2,q],['line',x,y+H-r,-Math.PI/2,b],['arc',x+r,y+r,Math.PI,q]];
 return {total,at(distance){let d=((distance%total)+total)%total;for(const [kind,cx,cy,angle,len] of pieces){if(d<=len){if(kind==='line')return {x:cx+Math.cos(angle)*d,y:cy+Math.sin(angle)*d,angle,corner:false};const t=angle+d/r;return {x:cx+Math.cos(t)*r,y:cy+Math.sin(t)*r,angle:t+Math.PI/2,corner:true,bend:Math.sin(Math.PI*d/q)};}d-=len;}return {x:x+r,y,angle:0,corner:false};}};
}
