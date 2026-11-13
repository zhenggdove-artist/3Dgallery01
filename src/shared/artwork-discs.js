// RELETTER index.html floating platforms: three routes, 25 discs per route.
// Seeded randomness keeps server collision and every client on identical geometry.
let seed=73917;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
export const ARTWORK_DISCS=[];
for(let route=0;route<3;route++){
 let y=2,angle=Math.PI*2*route/3+random()*.3;
 for(let i=0;i<25;i++){
  const last=i===24,radius=last?4:2.4+random()*1.6,dist=30+route*8+i*.3+random()*1.5;
  if(last)y+=1.2;
  ARTWORK_DISCS.push({route,step:i,position:[Math.cos(angle)*dist,y,Math.sin(angle)*dist],radius,top:y+.2,blue:last});
  y+=.7+random()*.4;angle+=.06+random()*.08;
 }
}
export function discGroundHeight(x,z,y=0){let height=0;for(const d of ARTWORK_DISCS)if(Math.hypot(x-d.position[0],z-d.position[2])<d.radius&&y>=d.top-.5)height=Math.max(height,d.top);return height;}
export const ART_DISPLAY_DISCS=ARTWORK_DISCS.filter(d=>[6,12,18,24].includes(d.step));
