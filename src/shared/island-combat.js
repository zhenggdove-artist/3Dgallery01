import {spellContains} from '../reletter/enemy-spell-catalog.js';

// RELETTER Nangan normal-enemy scale and shockwave timing. Foreman is
// intentionally excluded: server/milk-encounter.js identifies it as 章萬安.
// Temple features only human-shaped island opponents; the AUNTIE and animal
// characters remain available to separate RELETTER content, not Temple.
export const ISLAND_ENEMIES=['uncle','flower'];
// Six times RELETTER's original character proportions, including hit zones.
export const ENEMY_HEIGHT=1.575*6;
export const ENEMY_RADIUS=.42*6; // Includes the sixfold humanoid's shoulders and arms.

export function advanceIslandEnemy(monster,targets,now,{move,hit,disabled=false,silenced=false,slow=0}){
 if(monster?.attackStyles)return advanceArenaMonster(monster,targets,now,{move,hit,disabled,silenced,slow});
 const dt=Math.min(.5,Math.max(0,(now-(monster.updatedAt??now-500))/1000));
 monster.updatedAt=now;monster.moving=false;monster.skills??=[];
 // A suspended/stunned caster cannot finish its warning or damage anybody.
 if(silenced)monster.skills=[]; // Electric paralysis silences, but allows walking.
 if(disabled||!targets.length){monster.skills=[];if(!targets.length){monster.aggroTarget=null;monster.aggroUntil=0;}return;}
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
 const aggro=monster.aggroTarget&&now<(monster.aggroUntil||0)?targets.find(a=>a.key===monster.aggroTarget):null;
 if(!aggro){monster.aggroTarget=null;monster.aggroUntil=0;}
 const target=aggro?{a:aggro,d:Math.hypot(aggro.position[0]-monster.position[0],aggro.position[2]-monster.position[2])}:targets.map(a=>({a,d:Math.hypot(a.position[0]-monster.position[0],a.position[2]-monster.position[2])})).filter(t=>t.d<18).sort((a,b)=>a.d-b.d)[0];
 if(!target||monster.skills.length)return;
 const motion=monster.attackStyles?['swipe','roar','charge'][(monster.attackCount||0)%3]:null;
 if(!silenced&&target.d<=(motion==='charge'?9:motion==='roar'?4:monster.attackRadius||2.2)&&now>=(monster.nextAttackAt||0)){
  monster.attackCount=(monster.attackCount||0)+1;
  monster.skills.push({id:crypto.randomUUID(),type:'shockwave',motion,origin:[...monster.position],aim:[...target.a.position],phase:'warning',start:now,end:now+1200,hit:[],radius:motion==='roar'?4:monster.attackRadius||2.2,height:1.2,damage:monster.damage||18,island:true});
  monster.nextAttackAt=now+5000;return;
 }
 if(target.d>1.25){move(target.a.position,(aggro?4.5:2.4)*(1-slow)*dt);monster.moving=true;}
}


const ARENA_MOTIONS=['swipe','charge','laser','slam','venom'];
const ATTACK_REACH={swipe:4.7,charge:22,laser:38,slam:8,venom:32};
const WINDUP={swipe:480,charge:850,laser:950,slam:850,venom:900};
const ACTIVE_MS={swipe:450,charge:1050,laser:1450,slam:750,venom:5600};
const pointSegment=(point,a,b)=>{
 const vx=b[0]-a[0],vy=b[1]-a[1],vz=b[2]-a[2],len=vx*vx+vy*vy+vz*vz||1;
 const t=Math.max(0,Math.min(1,((point[0]-a[0])*vx+(point[1]-a[1])*vy+(point[2]-a[2])*vz)/len));
 return Math.hypot(point[0]-a[0]-vx*t,point[1]-a[1]-vy*t,point[2]-a[2]-vz*t);
};
function hitbox(skill,target,mob,previous){
 const p=target.position,dist=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
 if(skill.motion==='swipe')return dist(p,skill.origin)<4.4&&
  (p[0]-skill.origin[0])*(skill.aim[0]-skill.origin[0])+
  (p[2]-skill.origin[2])*(skill.aim[2]-skill.origin[2])>=0&&Math.abs(p[1]-skill.origin[1])<2;
 if(skill.motion==='charge'){
  return Math.abs(p[1]-mob.position[1])<2.1&&
   pointSegment([p[0],0,p[2]],[previous[0],0,previous[2]],[mob.position[0],0,mob.position[2]])<2.5;
 }
 if(skill.motion==='laser')return pointSegment([p[0],p[1]+1.2,p[2]],skill.mouth,skill.aim)<1.35;
 if(skill.motion==='slam')return dist(p,skill.origin)<skill.radius&&Math.abs(p[1]-skill.origin[1])<2.5;
 if(skill.motion==='venom')return dist(p,skill.aim)<skill.radius&&Math.abs(p[1]-skill.aim[1])<2.5;
 return false;
}
// Server-authoritative four-skill perimeter AI. Telegraph and collision always
// use the same origin/aim/radius stored in each serialised world skill.
function advanceArenaMonster(monster,targets,now,{move,hit,disabled=false,silenced=false,slow=0}){
 const dt=Math.min(.5,Math.max(0,(now-(monster.updatedAt??now-500))/1000));
 monster.updatedAt=now;monster.moving=false;monster.skills??=[];
 if(disabled||silenced||!targets.length){
  monster.skills=[];if(!targets.length){monster.aggroTarget=null;monster.aggroUntil=0;}return;
 }
 for(const skill of monster.skills){
  if(skill.phase==='warning'&&now>=skill.end){
   skill.phase='active';skill.start=now;skill.end=now+ACTIVE_MS[skill.motion];
  }
  if(skill.phase!=='active'||now>=skill.end)continue;
  const previous=[...monster.position];
  if(skill.motion==='charge'){
   move(skill.aim,18*(1-slow)*dt);monster.moving=true;
  }
  for(const target of targets){
   if(!hitbox(skill,target,monster,previous))continue;
   if(skill.motion==='venom'){
    skill.lastHitAt??={};
    if(now-(skill.lastHitAt[target.key]??(skill.start-1000))<1000)continue;
    skill.lastHitAt[target.key]=now;
    hit(target,5,skill); // exactly 5 HP per one-second contact tick
   }else if(!skill.hit.includes(target.key)){
    skill.hit.push(target.key);
    hit(target,skill.damage,skill);
   }
  }
 }
 monster.skills=monster.skills.filter(s=>now<s.end);
 const inProgress=monster.skills.some(s=>s.phase==='warning'||s.motion!=='venom');
 const aggro=monster.aggroTarget&&now<(monster.aggroUntil||0)?targets.find(a=>a.key===monster.aggroTarget):null;
 if(!aggro){monster.aggroTarget=null;monster.aggroUntil=0;}
 const candidates=targets.map(a=>({a,d:Math.hypot(a.position[0]-monster.position[0],a.position[2]-monster.position[2])}));
 const target=aggro?candidates.find(c=>c.a===aggro):candidates.filter(c=>c.d<42).sort((a,b)=>a.d-b.d)[0];
 if(!target)return;
 const motion=ARENA_MOTIONS[(monster.attackCount||0)%ARENA_MOTIONS.length];
 if(!inProgress&&now>=monster.nextAttackAt&&target.d<=ATTACK_REACH[motion]){
  monster.attackCount=(monster.attackCount||0)+1;
  const ground=[...target.a.position];ground[1]=monster.position[1];
  const origin=[...monster.position],aim=motion==='venom'?ground:[...target.a.position];
  const mouth=[monster.position[0],monster.position[1]+ENEMY_HEIGHT*.73,monster.position[2]];
  if(motion==='laser')aim[1]=target.a.position[1]+1.2;
  monster.skills.push({
   id:crypto.randomUUID(),type:motion==='venom'?'venom-pool':motion==='laser'?'pulse-beam':'shockwave',
   motion,origin,aim,mouth,phase:'warning',start:now,end:now+WINDUP[motion],
   hit:[],lastHitAt:{},radius:motion==='venom'?5.5:motion==='slam'?7:motion==='charge'?2.5:3,
   height:motion==='laser'?ENEMY_HEIGHT:2.5,
   damage:motion==='slam'?Math.round((monster.damage||16)*1.1):motion==='laser'?Math.round((monster.damage||16)*.8):monster.damage||16,
   island:true
  });
  monster.nextAttackAt=now+2100;return;
 }
 if(target.d>3){move(target.a.position,(aggro?5.5:3.6)*(1-slow)*dt);monster.moving=true;}
}
