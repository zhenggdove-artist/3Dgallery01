// Deterministic server-owned homing, shared with 2-second victim motion.
export const VORTEX_FLIGHT_MS=2100;
export const VORTEX_VISUAL_SPIN_RATE=4;
export const VORTEX_DAMAGE_INTERVAL_MS=500;
export const VORTEX_SPIN_MS=2000;
export const VORTEX_SPIN_LOCK_MS=5000;
export function advanceHomingVortex(fx,target,elapsedMs,flightMs=VORTEX_FLIGHT_MS){
 if(!Array.isArray(fx.position))fx.position=[...fx.origin];
 if(fx.locked)return fx.position;
 const dt=Math.max(0,Math.min(2500,Number(elapsedMs)||0))/1000;
 let dx=fx.direction[0],dz=fx.direction[2];
 const length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
 if(Array.isArray(target?.position)){
  const tx=target.position[0]-fx.position[0],tz=target.position[2]-fx.position[2];
  const distance=Math.hypot(tx,tz);
  if(distance>.001){
   const from=Math.atan2(dx,dz),to=Math.atan2(tx,tz);
   const turn=Math.atan2(Math.sin(to-from),Math.cos(to-from));
   const angle=from+turn*(1-Math.exp(-7*dt));dx=Math.sin(angle);dz=Math.cos(angle);
  }
 }
 const remaining=Math.max(0,fx.range-(fx.travelled||0));
 const step=Math.min(remaining,Math.max(0,fx.range)*dt/(Math.max(1,flightMs)/1000));
 fx.direction=[dx,0,dz];
 fx.position=[fx.position[0]+dx*step,fx.position[1],fx.position[2]+dz*step];
 fx.travelled=(fx.travelled||0)+step;
 return fx.position;
}
// Swept horizontal contact prevents a faster vortex crossing a target
// between Worker ticks without registering the visible collision.
export function vortexSegmentDistance(start,end,point){
 const dx=end[0]-start[0],dz=end[2]-start[2],len2=dx*dx+dz*dz;
 const t=len2>1e-9?Math.max(0,Math.min(1,((point[0]-start[0])*dx+(point[2]-start[2])*dz)/len2)):0;
 return Math.hypot(point[0]-start[0]-dx*t,point[2]-start[2]-dz*t);
}
export function vortexSpinPoint(spin,now){
 if(!Array.isArray(spin?.start)||!Array.isArray(spin?.center))return null;
 const progress=Math.max(0,Math.min(1,(now-spin.time)/Math.max(1,spin.durationMs??VORTEX_SPIN_MS)));
 const dx=spin.start[0]-spin.center[0],dz=spin.start[2]-spin.center[1];
 const distance=Math.hypot(dx,dz);
 const startingRadius=Math.max(.35,Math.min(2,distance));
 const angle=Math.atan2(dz,dx)+Math.PI*4*progress;
 // A victim captured exactly at the vortex center moves outward into a
 // visible orbit, then returns to the center without an initial teleport.
 const radius=(distance<.1?1.65*Math.sin(Math.PI*progress):startingRadius*(1-.85*progress))*(spin.power??1);
 return [spin.center[0]+Math.cos(angle)*radius,spin.start[1],spin.center[1]+Math.sin(angle)*radius];
}
