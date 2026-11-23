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
export function goldfishSchoolPosition(center,direction,index){
 const o=GOLDFISH_SCHOOL_OFFSETS[index],length=Math.hypot(direction[0],direction[2])||1;
 const dx=direction[0]/length,dz=direction[2]/length;
 return [center[0]+dz*o[0]+dx*o[2],center[1]+o[1],center[2]-dx*o[0]+dz*o[2]];
}

// Goldfish can home toward enemies, but must retain a strong component of
// its ORIGINAL launch vector. Never allow a U-turn toward the caster.
export function advanceGoldfishSchool(fx,target,elapsedMs,flightMs){
 if(!Array.isArray(fx.position))fx.position=[...fx.origin];
 const dt=Math.max(0,Math.min(2500,Number(elapsedMs)||0))/1000;
 const launch=fx.launchDirection||fx.direction;
 const launchLength=Math.hypot(launch[0],launch[2])||1;
 const forward=[launch[0]/launchLength,launch[2]/launchLength];
 let dx=fx.direction[0],dz=fx.direction[2];
 const length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
 if(Array.isArray(target?.position)){
  const tx=target.position[0]-fx.position[0],tz=target.position[2]-fx.position[2];
  const distance=Math.hypot(tx,tz);
  if(distance>.001&&tx*forward[0]+tz*forward[1]>0){
   const steer=1-Math.exp(-3.5*dt);
   dx=dx*(1-steer)+tx/distance*steer;
   dz=dz*(1-steer)+tz/distance*steer;
   const n=Math.hypot(dx,dz)||1;dx/=n;dz/=n;
  }
 }
 // Constrain the heading to +/-45.57 degrees from launch.
 const dot=dx*forward[0]+dz*forward[1];
 if(dot<.70){
  const sideX=-forward[1],sideZ=forward[0];
  const sign=Math.sign(dx*sideX+dz*sideZ)||1;
  dx=forward[0]*.70+sideX*sign*Math.sqrt(1-.70**2);
  dz=forward[1]*.70+sideZ*sign*Math.sqrt(1-.70**2);
 }
 const remaining=Math.max(0,fx.range-(fx.travelled||0));
 const step=Math.min(remaining,Math.max(0,fx.range)*dt/(Math.max(1,flightMs)/1000));
 fx.direction=[dx,0,dz];
 fx.position=[fx.position[0]+dx*step,fx.position[1],fx.position[2]+dz*step];
 fx.travelled=(fx.travelled||0)+step;
 return fx.position;
}
