// One deterministic school layout is shared by the Worker damage sweeps and
// the 30-instanced-fish client. Local +Z is the initial travel direction.
// A sparse nose/tail and dense middle form an irregular spindle, not a grid.
export const GOLDFISH_TRAVEL_SCALE=.5; // Charged school moves half its former distance; normal shot unchanged.
export const GOLDFISH_SCHOOL_COUNT=30;
export const GOLDFISH_DAMAGE_PER_FISH=.05;
// Absolute T1 direct-hit budget for any single target across all 30 fish.
export const GOLDFISH_T1_DAMAGE_PER_FISH=.75;
export const GOLDFISH_T1_TOTAL_MAX=GOLDFISH_SCHOOL_COUNT*GOLDFISH_T1_DAMAGE_PER_FISH;
export const goldfishDirectHitBudget=(tier=1,echo=false)=>GOLDFISH_T1_TOTAL_MAX*Math.max(1,Math.min(5,tier))*(echo?.2:1);
export const GOLDFISH_FISH_SCALE=.21; // Matches the ordinary dark-blue .35m cannonball silhouette.
export const GOLDFISH_SCHOOL_RADIUS=2.25;
export const GOLDFISH_CONTACT_RADIUS=.32;
const fract=n=>n-Math.floor(n);
export const GOLDFISH_SCHOOL_OFFSETS=Object.freeze(Array.from({length:GOLDFISH_SCHOOL_COUNT},(_,i)=>{
 const t=(i+.5)/GOLDFISH_SCHOOL_COUNT;
 // Arcsine spacing: fewer fish at the pointed front/back, most in the middle.
 const longitudinal=3.25*(2/Math.PI)*Math.asin(2*t-1);
 const envelope=Math.sqrt(Math.max(0,1-Math.pow(longitudinal/3.25,2)));
 const x=(fract((i+1)*.61803398875)-.5)*2*(.2+1.43*envelope);
 const y=(fract((i+1)*.7548776662)-.5)*2*(.10+.54*envelope);
 return Object.freeze([x,y,longitudinal]);
}));
export function goldfishSchoolPosition(center,direction,index,radiusScale=1){
 const o=GOLDFISH_SCHOOL_OFFSETS[index],length=Math.hypot(direction[0],direction[2])||1;
 const dx=direction[0]/length,dz=direction[2]/length;
 return [center[0]+(dz*o[0]+dx*o[2])*radiusScale,center[1]+o[1]*radiusScale,center[2]+(-dx*o[0]+dz*o[2])*radiusScale];
}

// Home in all directions, including enemies to either side or behind the
// launch. Caster exclusion and safe-zone rules are enforced by the Worker.
export function advanceGoldfishSchool(fx,target,elapsedMs,flightMs){
 if(!Array.isArray(fx.position))fx.position=[...fx.origin];
 const dt=Math.max(0,Math.min(2500,Number(elapsedMs)||0))/1000;
 let dx=fx.direction[0],dz=fx.direction[2],dy=0;
 const length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
 const remaining=Math.max(0,fx.range-(fx.travelled||0));
 const step=Math.min(remaining,Math.max(0,fx.range)*dt/(Math.max(1,flightMs)/1000));
 if(Array.isArray(target?.position)){
  const tx=target.position[0]-fx.position[0],tz=target.position[2]-fx.position[2];
  const distance=Math.hypot(tx,tz);
  // Angle interpolation handles a target directly behind without a zero-vector
  // singularity. First acquisition aims immediately; later turns stay smooth.
  if(distance>.001){
   const from=Math.atan2(dx,dz),to=Math.atan2(tx,tz);
   const delta=Math.atan2(Math.sin(to-from),Math.cos(to-from));
   const angle=from+delta*(fx.travelled?1-Math.exp(-12*dt):1);
   dx=Math.sin(angle);dz=Math.cos(angle);
  }
  const targetY=target.position[1]+(target.bodyHeight?target.bodyHeight*.5:1.05);
  dy=Math.max(-step,Math.min(step,(targetY-fx.position[1])*(1-Math.exp(-10*dt))));
 }
 fx.direction=[dx,0,dz];
 fx.position=[fx.position[0]+dx*step,fx.position[1]+dy,fx.position[2]+dz*step];
 fx.travelled=(fx.travelled||0)+step;
 return fx.position;
}
