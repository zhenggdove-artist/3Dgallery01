import {spellContains} from '../reletter/enemy-spell-catalog.js';

// RELETTER Nangan normal-enemy scale and shockwave timing. Foreman is
// intentionally excluded: server/milk-encounter.js identifies it as 章萬安.
// Temple features only human-shaped island opponents; the AUNTIE and animal
// characters remain available to separate RELETTER content, not Temple.
export const ISLAND_ENEMIES=['uncle','flower'];
// Six times RELETTER's original character proportions, including hit zones.
export const ENEMY_HEIGHT=1.575*6;
export const ENEMY_RADIUS=.42*6; // Includes the sixfold humanoid's shoulders and arms.

// All monster skills are server authoritative. Rendering uses the same warning/active schedule.
// This module is shared by the Worker and browser, so it cannot import Three.js.
const SKILLS=Object.freeze({
 swipe:{warning:480,active:500,range:4.8,radius:4.2},
 charge:{warning:850,active:800,range:19,radius:2.35},
 beam:{warning:750,active:1250,range:38,radius:1.65},
 stomp:{warning:1000,active:650,range:8,radius:7},
 venom:{warning:850,active:5100,range:27,radius:5.2}
});
export const MONSTER_SKILLS=SKILLS;
const flatDistance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const segmentDistance=(p,a,b)=>{
 const dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz;
 const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/l)):0;
 return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);
};
export function monsterSkillContains(skill,p,now,origin=skill.origin){
 if(skill.phase!=='active'||now>=skill.end)return false;
 const config=SKILLS[skill.motion];if(!config)return false;
 // Ground AoEs can be jumped; all attacks must respect vertical separation.
 const vertical=Math.abs((p[1]||0)-(origin[1]||0));
 if(vertical>(skill.motion==='beam'?9.2:skill.motion==='charge'?3.2:skill.motion==='swipe'?3.2:2.2))return false;
 if(skill.motion==='venom'||skill.motion==='stomp')return flatDistance(p,skill.aim)<=config.radius;
 if(skill.motion==='swipe') {
  const dx=p[0]-origin[0],dz=p[2]-origin[2],fx=skill.aim[0]-origin[0],fz=skill.aim[2]-origin[2];
  return Math.hypot(dx,dz)<=config.radius&&dx*fx+dz*fz>0;
 }
 if(skill.motion==='beam') {
  // The ray starts at the giant monster's mouth and extends toward its locked aim.
  const dx=skill.aim[0]-skill.origin[0],dz=skill.aim[2]-skill.origin[2],dist=Math.hypot(dx,dz)||1;
  const end=[skill.origin[0]+dx/dist*38,0,skill.origin[2]+dz/dist*38];
  return segmentDistance(p,skill.origin,end)<=config.radius;
 }
 return segmentDistance(p,skill.origin,skill.aim)<=config.radius;
}
export function advanceIslandEnemy(monster,targets,now,{move,hit,disabled=false,silenced=false,slow=0}){
 const dt=Math.min(.5,Math.max(0,(now-(monster.updatedAt??now-500))/1000));
 monster.updatedAt=now;monster.moving=false;monster.skills??=[];
 if(disabled||silenced){monster.skills=[];return;}
 // Expired warnings become active on the server even if the room tick is late.
 for(const s of monster.skills){
  if(s.phase==='warning'&&now>=s.end){s.phase='active';s.start=s.end;s.end=s.start+(SKILLS[s.motion]?.active||800);s.lastTick={};}
  if(s.phase!=='active'||now>=s.end)continue;
  if(s.motion==='charge'){
   // A fixed marked path, not homing after the warning has been shown.
   const duration=Math.max(.1,(s.end-s.start)/1000);
   const step=flatDistance(monster.position,s.aim)*Math.min(1,dt/duration*1.7);
   if(step>.001){move(s.aim,Math.max(2,step)*(1-slow));monster.moving=true;}
  }
  for(const target of targets){
   const key=target.key;
   if(s.motion==='venom'){
    if(!monsterSkillContains(s,target.position,now))continue;
    // Do not multiply ticks when the simulation catches up from 2Hz.
    const last=s.lastTick[key]??(s.start-1000);
    if(now-last>=1000){s.lastTick[key]=now;hit(target,5,s);}
    continue;
   }
   if(s.hit.includes(key)||!monsterSkillContains(s,target.position,now))continue;
   s.hit.push(key);hit(target,s.damage,s);
  }
 }
 monster.skills=monster.skills.filter(s=>now<s.end);
 if(!targets.length){monster.aggroTarget=null;monster.aggroUntil=0;return;}
 const aggro=monster.aggroTarget&&now<(monster.aggroUntil||0)?targets.find(a=>a.key===monster.aggroTarget):null;
 const ranked=targets.map(a=>({a,d:flatDistance(a.position,monster.position)})).sort((a,b)=>a.d-b.d);
 const target=aggro?ranked.find(t=>t.a.key===aggro.key):ranked.find(t=>t.d<40);
 if(!target||monster.skills.some(s=>s.phase==='warning'||s.motion!=='venom'))return;
 const order=['swipe','beam','charge','venom','stomp'];
 const count=monster.attackCount||0;
 // Prefer a usable ability at distance: the outer mobs MUST engage at range.
 const choices=target.d>12?['beam','venom','charge']:target.d>6?['charge','beam','venom','stomp']:['swipe','stomp','venom','beam','charge'];
 const motion=choices[count%choices.length],config=SKILLS[motion];
 if(now>=(monster.nextAttackAt||0)&&target.d<=config.range){
  monster.attackCount=count+1;monster.aggroTarget=target.a.key;monster.aggroUntil=now+9000;
  const aim=[...target.a.position];aim[1]=0;
  const id=crypto.randomUUID();
  const s={id,type:'shockwave',motion,origin:[...monster.position],aim,phase:'warning',start:now,end:now+config.warning,hit:[],radius:config.radius,height:1.3,damage:motion==='venom'?5:motion==='stomp'?12:motion==='beam'?8:monster.damage||12,island:true,lastTick:{}};
  monster.skills.push(s);
  monster.nextAttackAt=now+1900+(monster.slot||0)*140;
  return;
 }
 if(target.d>4.2){move(target.a.position,(aggro?5:3.6)*(1-slow)*dt);monster.moving=true;}
}
