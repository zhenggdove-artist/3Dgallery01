// Server/client shared deterministic NON-GRID spread of exactly ten 3-D
// sphere trajectories. The original 2x5 arrangement was visually synthetic.
export const CALICO_PELLET_COUNT=10;
export function calicoPellets(direction,charged=false,seed=0){
 const length=Math.hypot(...direction)||1,forward=direction.map(v=>v/length);
 let right=[forward[2],0,-forward[0]],rLength=Math.hypot(...right);
 if(rLength<1e-5){right=[1,0,0];rLength=1;}
 right=right.map(v=>v/rLength);
 const up=[forward[1]*right[2]-forward[2]*right[1],forward[2]*right[0]-forward[0]*right[2],forward[0]*right[1]-forward[1]*right[0]];
 let randomSeed=((Math.trunc(Number(seed)||0)>>>0)^0x9e3779b9^(charged?0x41c64e6d:0))>>>0;
 const random=()=>{randomSeed^=randomSeed<<13;randomSeed^=randomSeed>>>17;randomSeed^=randomSeed<<5;return (randomSeed>>>0)/4294967296;};
 const rotation=random()*Math.PI*2;
 return Array.from({length:CALICO_PELLET_COUNT},(_,index)=>{
  // Irregular angular offsets + jittered concentric distances, never rows.
  const theta=rotation+index*2.399963229728653+(.5-random())*1.15;
  const distance=Math.sqrt((index+.18+random()*.55)/CALICO_PELLET_COUNT);
  const jitterX=Math.cos(theta)*distance*(charged?.245:.15);
  const jitterY=Math.sin(theta)*distance*(charged?.18:.105);
  const vector=forward.map((v,j)=>v+right[j]*jitterX+up[j]*jitterY);
  const n=Math.hypot(...vector);
  return {index,direction:vector.map(v=>v/n),radius:charged?.58:.42};
 });
}
