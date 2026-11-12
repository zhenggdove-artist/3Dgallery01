import {spellContains} from '../reletter/enemy-spell-catalog.js';

// RELETTER Nangan normal-enemy scale and shockwave timing. Foreman is
// intentionally excluded: server/milk-encounter.js identifies it as 章萬安.
export const ISLAND_ENEMIES=['auntie','uncle','flower','cow','deer','fox'];
export const ENEMY_HEIGHT=1.575;
export const ENEMY_RADIUS=.32;

export function advanceIslandEnemy(monster,targets,now,{move,hit,disabled=false,slow=0}){
 const dt=Math.min(.5,Math.max(0,(now-(monster.updatedAt??now-500))/1000));
 monster.updatedAt=now;monster.moving=false;monster.skills??=[];
 // A suspended/stunned caster cannot finish its warning or damage anybody.
 if(disabled){monster.skills=[];return;}
 for(const s of monster.skills){
  if(s.phase==='warning'&&now>=s.end){s.phase='active';s.start=now;s.end=now+1200;}
  if(s.phase==='active')for(const target of targets){
   // Temple snapshots run at 2 Hz; sample the original expanding-ring predicate
   // over this tick so the narrow .25m wavefront cannot skip a stationary target.
   const from=Math.max(s.start,now-dt*1000);let contains=false;
   for(let at=from;at<=Math.min(now,s.end-1);at+=50)if(spellContains(s,target.position,at)){contains=true;break;}
   if(!s.hit.includes(target.key)&&contains){
    s.hit.push(target.key);hit(target,s.damage);
   }
  }
 }
 monster.skills=monster.skills.filter(s=>now<s.end);
 const target=targets.map(a=>({a,d:Math.hypot(a.position[0]-monster.position[0],a.position[2]-monster.position[2])})).filter(t=>t.d<18).sort((a,b)=>a.d-b.d)[0];
 if(!target||monster.skills.length)return;
 if(target.d<=(monster.attackRadius||2.2)&&now>=(monster.nextAttackAt||0)){
  monster.skills.push({id:crypto.randomUUID(),type:'shockwave',origin:[...monster.position],aim:[...target.a.position],phase:'warning',start:now,end:now+1200,hit:[],radius:monster.attackRadius||2.2,height:1.2,damage:monster.damage||18,island:true});
  monster.nextAttackAt=now+5000;return;
 }
 if(target.d>1.25){move(target.a.position,2.4*(1-slow)*dt);monster.moving=true;}
}
