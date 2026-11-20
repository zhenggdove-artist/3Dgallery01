// Deterministic server-owned homing, shared with 2-second victim motion.
export const VORTEX_FLIGHT_MS=4200;
export const VORTEX_DAMAGE_INTERVAL_MS=500;
export const VORTEX_SPIN_MS=2000;
export const VORTEX_SPIN_LOCK_MS=5000;
export function advanceHomingVortex(fx,target,elapsedMs,flightMs=VORTEX_FLIGHT_MS){
 if(!Array.isArray(fx.position))fx.position=[...fx.origin];
 const dt=Math.max(0,Math.min(500,Number(elapsedMs)||0))/1000;
 let dx=fx.direction[0],dz=fx.direction[2];
 const length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
 if(Array.isArray(target?.position)){
  const tx=target.position[0]-fx.position[0],tz=target.position[2]-fx.position[2];
  const distance=Math.hypot(tx,tz);
  if(distance>.001){
   const steer=1-Math.exp(-7*dt);
   dx=dx*(1-steer)+tx/distance*steer;
   dz=dz*(1-steer)+tz/distance*steer;
   const n=Math.hypot(dx,dz)||1;dx/=n;dz/=n;
  }
 }
 const remaining=Math.max(0,fx.range-(fx.travelled||0));
 const step=Math.min(remaining,Math.max(0,fx.range)*dt/(Math.max(1,flightMs)/1000));
 fx.direction=[dx,0,dz];
 fx.position=[fx.position[0]+dx*step,fx.position[1],fx.position[2]+dz*step];
 fx.travelled=(fx.travelled||0)+step;
 return fx.position;
}
export function vortexSpinPoint(spin,now){
 if(!Array.isArray(spin?.start)||!Array.isArray(spin?.center))return null;
 const progress=Math.max(0,Math.min(1,(now-spin.time)/VORTEX_SPIN_MS));
 const dx=spin.start[0]-spin.center[0],dz=spin.start[2]-spin.center[1];
 const startingRadius=Math.max(.35,Math.min(2,Math.hypot(dx,dz)));
 const angle=Math.atan2(dz,dx)+Math.PI*4*progress;
 const radius=startingRadius*(1-.85*progress);
 return [spin.center[0]+Math.cos(angle)*radius,spin.start[1],spin.center[1]+Math.sin(angle)*radius];
}
