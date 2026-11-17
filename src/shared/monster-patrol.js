import {ARENA_RADIUS,insideArtSanctuary} from './arena.js';

// Server-authoritative ambient behaviour. Non-aggro humanoids STROLL, choose
// short random headings, and pause to look around. No permanent orbit/running.
// Persistent targets/pause timestamps keep every client on the same schedule.
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function patrolMonster(mob,now,rng=Math.random,move=()=>{}){
 if(!mob?.active||mob.skills?.length){if(mob)mob.patrolling=false;return false;}
 const dt=Math.max(0,Math.min(.5,(now-(mob.patrolUpdatedAt??now-500))/1000));
 mob.patrolUpdatedAt=now;mob.patrolling=true;
 const p=mob.position;
 const stop=()=>{
  mob.patrolTarget=null;mob.moving=false;
  mob.patrolPauseUntil=now+1300+Math.floor(clamp(rng(),0,1)*5000);
  mob.nextPatrolAt=mob.patrolPauseUntil;
  return false;
 };
 if(!mob.patrolTarget){
  // Standing still between short walks is intentional (also at first spawn).
  mob.patrolPauseUntil??=now+1200+Math.floor(clamp(rng(),0,1)*1900);
  if(now<mob.patrolPauseUntil){mob.moving=false;return false;}
  let chosen=null;
  for(let i=0;i<12;i++){
   const theta=clamp(rng(),0,.999999)*Math.PI*2;
   const length=4+clamp(rng(),0,1)*12;
   const r=Math.hypot(p[0]+Math.cos(theta)*length,p[2]+Math.sin(theta)*length);
   const target=[p[0]+Math.cos(theta)*length,0,p[2]+Math.sin(theta)*length];
   if(r<ARENA_RADIUS-4&&r>57&&!insideArtSanctuary(target)){chosen=target;break;}
  }
  if(!chosen)return stop();
  mob.patrolTarget=chosen;mob.patrolPauseUntil=0;
  mob.patrolStride=1.15+clamp(rng(),0,1)*.60; // walking, not combat running
  mob.nextPatrolAt=now+4300+Math.floor(clamp(rng(),0,1)*4300);
 }
 const distance=Math.hypot(p[0]-mob.patrolTarget[0],p[2]-mob.patrolTarget[2]);
 if(distance<1.3||now>=mob.nextPatrolAt)return stop();
 const x=p[0],z=p[2];
 move(mob.patrolTarget,(mob.patrolStride||1.45)*dt);
 const moved=Math.hypot(p[0]-x,p[2]-z);
 if(moved<.02)return stop();
 mob.moving=true;
 return !insideArtSanctuary(p);
}
