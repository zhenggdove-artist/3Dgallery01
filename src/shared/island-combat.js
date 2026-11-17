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
 freeze:{warning:850,active:5200,range:22,radius:5.2},
 beam:{warning:750,active:5000,range:38,radius:4.95},
 stomp:{warning:1000,active:1500,range:8,radius:7},
 venom:{warning:850,active:5100,range:27,radius:5.2}
});
export const MONSTER_SKILLS=SKILLS;
const flatDistance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const segmentDistance=(p,a,b)=>{
 const dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz;
 const t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/l)):0;
 return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);
};
// Browser and server share the same near-to-far 5s sweep.
export function monsterBeamEndpoint(skill,now,origin=skill.origin){
 const dx=skill.aim[0]-skill.origin[0],dz=skill.aim[2]-skill.origin[2];
 const length=Math.hypot(dx,dz)||1,ux=dx/length,uz=dz/length;
 if(skill.phase!=='active')return [origin[0]+ux*length,origin[1]||0,origin[2]+uz*length];
 const t=Math.max(0,Math.min(1,(now-skill.start)/Math.max(1,skill.end-skill.start)));
 const reach=length*(.24+.76*t),pan=Math.sin(t*Math.PI*1.65)*.12*reach;
 return [origin[0]+ux*reach-uz*pan,origin[1]||0,origin[2]+uz*reach+ux*pan];
}
// Predict a fixed charge path from the same timestamps on server and client.
export function monsterChargePosition(skill,now){
 const t=Math.max(0,Math.min(1,(now-skill.start)/Math.max(1,skill.end-skill.start)));
 return [skill.origin[0]+(skill.aim[0]-skill.origin[0])*t,
  skill.origin[1]||0,skill.origin[2]+(skill.aim[2]-skill.origin[2])*t];
}
export function monsterSkillContains(skill,p,now,origin=skill.origin){
 if(skill.phase!=='active'||now>=skill.end)return false;
 const config=SKILLS[skill.motion];if(!config)return false;
 // Ground AoEs can be jumped; all attacks must respect vertical separation.
 const vertical=Math.abs((p[1]||0)-(origin[1]||0));
 if(vertical>(skill.motion==='beam'?9.2:skill.motion==='freeze'?2.2:skill.motion==='swipe'?3.2:2.2))return false;
 if(skill.motion==='stomp'){
  // The shockwave must hit on landing, not during the jump.
  if(now<skill.start+(skill.end-skill.start)*.76)return false;
  return flatDistance(p,skill.aim)<=config.radius;
 }
 if(skill.motion==='venom'||skill.motion==='freeze')return flatDistance(p,skill.aim)<=config.radius;
 if(skill.motion==='swipe') {
  const dx=p[0]-origin[0],dz=p[2]-origin[2],fx=skill.aim[0]-origin[0],fz=skill.aim[2]-origin[2];
  return Math.hypot(dx,dz)<=config.radius&&dx*fx+dz*fz>0;
 }
 if(skill.motion==='beam'){
  // Same corridor as the rendered moving laser.
  return segmentDistance(p,origin,monsterBeamEndpoint(skill,now,origin))<=config.radius;
 }
 return segmentDistance(p,skill.origin,skill.aim)<=config.radius;
}
export function advanceIslandEnemy(monster,targets,now,{move,hit,disabled=false,silenced=false,slow=0}){
 const dt=Math.min(.5,Math.max(0,(now-(monster.updatedAt??now-500))/1000));
 monster.updatedAt=now;monster.moving=false;monster.patrolling=false;monster.skills??=[];
 // Eliminate persisted dashes before collision and skill gating.
 monster.skills=monster.skills.filter(s=>SKILLS[s.motion]&&now<s.end);
 if(disabled||silenced){monster.skills=[];return;}
 // Expired warnings become active on the server even if the room tick is late.
 for(const s of monster.skills){
  if(!SKILLS[s.motion])continue; // discard pre-update persistent spell snapshots
  s.hit??=[];s.lastTick??={};
  if(s.phase==='warning'&&now>=s.end){s.phase='active';s.start=s.end;s.end=s.start+(SKILLS[s.motion]?.active||800);s.lastTick={};}
  if(s.phase!=='active'||now>=s.end)continue;
  if(s.motion==='beam'){
    // Walking side-step while spraying, speed at most .85m/s.
    const duration=Math.max(1,s.end-s.start),t=Math.max(0,Math.min(1,(now-s.start)/duration));
    const dx=s.aim[0]-s.origin[0],dz=s.aim[2]-s.origin[2],len=Math.hypot(dx,dz)||1;
    const offset=.9*Math.sin(t*Math.PI*2);
    const position=[s.origin[0]-dz/len*offset,monster.position[1],s.origin[2]+dx/len*offset];
    const remaining=flatDistance(monster.position,position);
    if(remaining>.01&&dt>0){move(position,Math.min(remaining,.85*dt));monster.moving=true;monster.patrolling=true;}
   }
  for(const target of targets){
   const key=target.key;
   if(s.motion==='venom'||s.motion==='beam'){
    if(!monsterSkillContains(s,target.position,now,s.motion==='beam'?monster.position:s.origin))continue;
    // Continuous contact: one hit per second, never catch-up burst damage.
    const last=s.lastTick[key]??(s.start-1000);
    if(now-last>=1000){s.lastTick[key]=now;hit(target,s.motion==='venom'?5:s.damage,s);}
    continue;
   }
   if(s.hit.includes(key)||!monsterSkillContains(s,target.position,now))continue;
   s.hit.push(key);hit(target,s.damage,s);
  }
 }
 monster.skills=monster.skills.filter(s=>SKILLS[s.motion]&&now<s.end);
 if(!targets.length){monster.aggroTarget=null;monster.aggroUntil=0;return;}
 const aggro=monster.aggroTarget&&now<(monster.aggroUntil||0)?targets.find(a=>a.key===monster.aggroTarget):null;
 const ranked=targets.map(a=>({a,d:flatDistance(a.position,monster.position)})).sort((a,b)=>a.d-b.d);
 const target=aggro?ranked.find(t=>t.a.key===aggro.key):ranked.find(t=>t.d<40);
 if(!target||monster.skills.some(s=>s.phase==='warning'||s.motion!=='venom'))return;
 const count=monster.attackCount||0;
 // Prefer a usable ability at distance: the outer mobs MUST engage at range.
 const choices=(target.d>12?['beam','freeze','venom']:target.d>6?['freeze','beam','venom','stomp']:['swipe','stomp','venom','freeze','beam'])
  .filter(motion=>target.d<=SKILLS[motion].range);
 if(!choices.length)return;
 const motion=choices[count%choices.length],config=SKILLS[motion];
 // Even while preparing a warning the enemy continues to pursue its attacker.
 if(target.d>3.2){move(target.a.position,(aggro?5:3.6)*(1-slow)*dt);monster.moving=true;}
 if(now>=(monster.nextAttackAt||0)&&target.d<=config.range){
  monster.attackCount=count+1;monster.aggroTarget=target.a.key;monster.aggroUntil=now+9000;
  const aim=[...target.a.position];aim[1]=0;
  // Lock both warning and actual strike to the full-range path, not target distance.
  if(motion==='beam'){
   const x=aim[0]-monster.position[0],z=aim[2]-monster.position[2],length=Math.hypot(x,z)||1;
   aim[0]=monster.position[0]+x/length*config.range;
   aim[2]=monster.position[2]+z/length*config.range;
  }
  const id=crypto.randomUUID();
  const s={id,type:'shockwave',motion,origin:[...monster.position],aim,phase:'warning',start:now,end:now+config.warning,hit:[],radius:config.radius,height:1.3,damage:motion==='venom'?5:motion==='stomp'?12:motion==='beam'?8:motion==='freeze'?8:monster.damage||12,island:true,lastTick:{}};
  monster.skills.push(s);
  monster.nextAttackAt=now+1900+(monster.slot||0)*140;
  return;
 }
 // Movement is handled before windup to keep persistent aggro responsive.
}
