import {spellContains} from '../reletter/enemy-spell-catalog.js';

// RELETTER Nangan normal-enemy scale and shockwave timing. Foreman is
// intentionally excluded: server/milk-encounter.js identifies it as 章萬安.
export const ISLAND_ENEMIES=['uncle','flower','chimera-centipede-saint','chimera-bell-devourer','chimera-moth-reliquary'];
// Six times RELETTER's original character proportions, including hit zones.
export const ENEMY_HEIGHT=1.575*6;
export const ENEMY_RADIUS=.32*6;

export function advanceIslandEnemy(monster,targets,now,{move,hit,disabled=false,slow=0,rng=Math.random}){
 const dt=Math.min(.5,Math.max(0,(now-(monster.updatedAt??now-500))/1000));
 monster.updatedAt=now;monster.moving=false;monster.skills??=[];
 // A suspended/stunned caster cannot finish its warning or damage anybody.
 if(disabled){monster.skills=[];return;}
 for(const s of monster.skills){
  if(s.phase==='warning'&&now>=s.end){s.phase='active';s.start=now;s.end=now+1200;}
  const previous=[...monster.position];
  if(s.phase==='active'&&s.motion==='charge'){move(s.aim,9*(1-slow)*dt);monster.moving=true;}
  if(s.phase==='active')for(const target of targets){
   // Temple snapshots run at 2 Hz; sample the original expanding-ring predicate
   // over this tick so the narrow .25m wavefront cannot skip a stationary target.
   const from=Math.max(s.start,now-dt*1000);let contains=false;
   for(let at=from;at<=Math.min(now,s.end-1);at+=50)if(spellContains(s,target.position,at)){contains=true;break;}
   if(s.motion==='swipe'){
    const dx=target.position[0]-s.origin[0],dz=target.position[2]-s.origin[2],ax=s.aim[0]-s.origin[0],az=s.aim[2]-s.origin[2];
    contains=Math.hypot(dx,dz)<2.4&&dx*ax+dz*az>=0&&Math.abs(target.position[1]-s.origin[1])<1.2;
   }
   if(s.motion==='charge'){
    const dx=monster.position[0]-previous[0],dz=monster.position[2]-previous[2],len=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((target.position[0]-previous[0])*dx+(target.position[2]-previous[2])*dz)/(len||1)));
    contains=Math.hypot(target.position[0]-previous[0]-t*dx,target.position[2]-previous[2]-t*dz)<.85&&Math.abs(target.position[1]-monster.position[1])<1.2;
   }
   if(!s.hit.includes(target.key)&&contains){
    s.hit.push(target.key);hit(target,s.damage);
   }
  }
 }
 monster.skills=monster.skills.filter(s=>now<s.end);
 const target=targets.map(a=>({a,d:Math.hypot(a.position[0]-monster.position[0],a.position[2]-monster.position[2])})).filter(t=>t.d<24).sort((a,b)=>a.d-b.d)[0];
 if(monster.skills.length)return;
 if(target){
  monster.patrolGoal=null;
  const motion=monster.attackStyles?['swipe','roar','charge'][(monster.attackCount||0)%3]:null;
  if(target.d<=(motion==='charge'?9:motion==='roar'?4:monster.attackRadius||2.2)&&now>=(monster.nextAttackAt||0)){
   monster.attackCount=(monster.attackCount||0)+1;
   monster.skills.push({id:crypto.randomUUID(),type:'shockwave',motion,origin:[...monster.position],aim:[...target.a.position],phase:'warning',start:now,end:now+1200,hit:[],radius:motion==='roar'?4:monster.attackRadius||2.2,height:1.2,damage:monster.damage||18,island:true});
   monster.nextAttackAt=now+5000;return;
  }
  if(target.d>1.25)monster.moving=move(target.a.position,2.4*(1-slow)*dt)!==false;
  return;
 }
 // Self-directed patrol has no dependency on nearby players.
 const radius=Math.hypot(monster.position[0],monster.position[2]),goal=monster.patrolGoal;
 if(!goal||now>=(monster.nextPatrolAt||0)||Math.hypot(goal[0]-monster.position[0],goal[2]-monster.position[2])<2.5){
  const a=Math.atan2(monster.position[2],monster.position[0])+(rng()-.5)*2.5;
  const r=Math.max(14,Math.min(83,radius+(rng()-.5)*43));
  monster.patrolGoal=[Math.cos(a)*r,0,Math.sin(a)*r];
  monster.nextPatrolAt=now+8000+Math.floor(rng()*8500);
 }
 if(dt>0){
  monster.moving=move(monster.patrolGoal,1.9*(1-slow)*dt)!==false;
  if(!monster.moving){monster.patrolGoal=null;monster.nextPatrolAt=now;}
 }
}
