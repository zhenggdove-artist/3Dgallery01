import {ECONOMY} from './catalog.js';

const SPAWNS=[[12,.2,0],[-12,.2,0],[0,.2,54],[0,.2,-54],[54,.2,0],[-54,.2,0]];
const separation=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);

// Ensure at most one distinct pickup in any 4-metre radius, even if a
// persisted room contains older duplicate heart records.
export function dedupeHealingHearts(world){
 const encountered=[],before=world.groundDrops.length;
 world.groundDrops=world.groundDrops.filter(drop=>{
  if(drop.kind!=='heart')return true;
  if(!Array.isArray(drop.position)||encountered.some(heart=>separation(heart.position,drop.position)<4))return false;
  encountered.push(drop);return true;
 });
 return before!==world.groundDrops.length;
}

export function replenishHearts(world,now){
 let changed=dedupeHealingHearts(world);
 if(now<(world.nextHeartAt||0))return changed;
 world.nextHeartAt=now+30000;
 const hearts=world.groundDrops.filter(d=>d.kind==='heart');
 if(hearts.length>=8)return changed;
 for(const [i,position] of SPAWNS.entries()){
  if(world.groundDrops.length>=ECONOMY.maxGroundDrops)break;
  // Do not stack with any current item, not only with the heart list
  // captured before this loop. New hearts enter this same live list.
  if(world.groundDrops.some(d=>Array.isArray(d.position)&&separation(d.position,position)<4))continue;
  const heart={id:`heart-${now}-${i}`,kind:'heart',amount:25,position:[...position],createdAt:now,expiresAt:now+90000};
  world.groundDrops.push(heart);hearts.push(heart);changed=true;
 }
 return changed;
}
