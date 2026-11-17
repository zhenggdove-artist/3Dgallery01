// Shared, deterministic four-arc explosion trajectory:
// one high launch, followed by exactly three progressively smaller bounces.
// The server samples these arcs for human-shaped monsters; fighters integrate
// the same launch velocities against the actual walkable ground below them.
export const PAN_BLAST_GRAVITY=25;
export const PAN_BLAST_LAUNCH_SPEED=13.5;
// Preserve each rebound's original peak height while compressing all three
// ground-bounce arcs to 30% of their former combined duration.
export const PAN_BLAST_BOUNCE_TIME_SCALE=.3;
export const PAN_BLAST_BOUNCE_GRAVITY=PAN_BLAST_GRAVITY/(PAN_BLAST_BOUNCE_TIME_SCALE**2);
export const PAN_BLAST_BOUNCE_SPEEDS=Object.freeze([7.5,4.5,2.5].map(speed=>speed/PAN_BLAST_BOUNCE_TIME_SCALE));
export const PAN_BLAST_INITIAL_DURATION=2*PAN_BLAST_LAUNCH_SPEED/PAN_BLAST_GRAVITY;
export const PAN_BLAST_BOUNCE_DURATION=PAN_BLAST_BOUNCE_SPEEDS.reduce(
 (sum,v)=>sum+2*v/PAN_BLAST_BOUNCE_GRAVITY,0);
export const PAN_BLAST_TOTAL_DURATION=PAN_BLAST_INITIAL_DURATION+PAN_BLAST_BOUNCE_DURATION;

export function samplePanBlastArc(elapsedMs){
 const t=Math.max(0,Number(elapsedMs)||0)/1000;
 let remaining=t;
 const velocities=[PAN_BLAST_LAUNCH_SPEED,...PAN_BLAST_BOUNCE_SPEEDS];
 for(let index=0;index<velocities.length;index++){
  const velocity=velocities[index],gravity=index===0?PAN_BLAST_GRAVITY:PAN_BLAST_BOUNCE_GRAVITY;
  const duration=2*velocity/gravity;
  if(remaining<duration){
   return {
    height:Math.max(0,velocity*remaining-.5*gravity*remaining**2),
    horizontalProgress:Math.min(1,t/PAN_BLAST_INITIAL_DURATION),
    bounceIndex:index,completed:false
   };
  }
  remaining-=duration;
 }
 return {height:0,horizontalProgress:1,bounceIndex:3,completed:true};
}

export function samplePanBlastPosition(flight,now){
 const sample=samplePanBlastArc(now-flight.startAt);
 const origin=flight.origin,vector=flight.vector,distance=flight.distance;
 return {
  ...sample,
  position:[origin[0]+vector[0]*distance*sample.horizontalProgress,
   origin[1]+sample.height,
   origin[2]+vector[2]*distance*sample.horizontalProgress]
 };
}
