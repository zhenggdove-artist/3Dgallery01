import {ARENA_RADIUS,insideArtSanctuary} from './arena.js';

// Deterministic server-authoritative roaming; monsters orbit the playable
// exterior instead of waiting at fixed edge spawn points for a nearby fighter.
export function patrolMonster(mob,now,rng=Math.random,move=()=>{}){
  if(!mob?.active||mob.skills?.length)return false;
  const dt=Math.max(0,Math.min(.5,(now-(mob.patrolUpdatedAt??now-500))/1000));
  mob.patrolUpdatedAt=now;
  const p=mob.position;
  const distance=mob.patrolTarget?Math.hypot(p[0]-mob.patrolTarget[0],p[2]-mob.patrolTarget[2]):0;
  if(!mob.patrolTarget||distance<2.5||now>=(mob.nextPatrolAt||0)){
    const angle=Math.atan2(p[2],p[0]);
    const sign=rng()<.5?-1:1;
    const arc=.36+Math.max(0,Math.min(1,rng()))*.5;
    const radius=67+Math.max(0,Math.min(1,rng()))*15;
    const a=angle+arc*sign;
    mob.patrolTarget=[Math.cos(a)*radius,0,Math.sin(a)*radius];
    mob.nextPatrolAt=now+7000+Math.floor(rng()*9000);
  }
  const old=[...p];
  move(mob.patrolTarget,2.8*dt);
  const moved=Math.hypot(p[0]-old[0],p[2]-old[2]);
  if(moved<.02){
    // Prefer changing course over pushing against the arena boundary.
    mob.patrolTarget=null;
    mob.nextPatrolAt=now;
  }
  mob.moving=moved>.02;
  return mob.moving&&!insideArtSanctuary(p)&&Math.hypot(p[0],p[2])<ARENA_RADIUS;
}
