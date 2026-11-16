// The same ten pellet lanes drive authoritative hits and the calico GPU shader.
// Each pellet is a separate ray with its own damage event, never a single cone
// hit disguised as ten decorative coloured particles.
export const CALICO_PELLET_COUNT=10;
export function calicoPellets(direction,charged=false){
 const length=Math.hypot(...direction)||1,f=direction.map(v=>v/length);
 let right=[f[2],0,-f[0]],rLength=Math.hypot(...right);
 if(rLength<1e-5){right=[1,0,0];rLength=1;}
 right=right.map(v=>v/rLength);
 const up=[f[1]*right[2]-f[2]*right[1],f[2]*right[0]-f[0]*right[2],f[0]*right[1]-f[1]*right[0]];
 const spreadX=charged?.16:.12,spreadY=charged?.10:.055;
 return Array.from({length:CALICO_PELLET_COUNT},(_,i)=>{
  const col=(i%5)-2,row=Math.floor(i/5)*2-1;
  const d=f.map((v,j)=>v+right[j]*col*spreadX+up[j]*row*spreadY);
  const n=Math.hypot(...d);
  return {index:i,direction:d.map(v=>v/n),radius:charged?.58:.42};
 });
}
