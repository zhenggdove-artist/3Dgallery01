export function replenishHearts(world,now){
 if(now<(world.nextHeartAt||0))return false;
 world.nextHeartAt=now+30000;
 const hearts=world.groundDrops.filter(d=>d.kind==='heart');
 if(hearts.length>=8)return false;
 for(const [i,position] of [[0,[12,.2,0]],[1,[-12,.2,0]],[2,[0,.2,54]],[3,[0,.2,-54]],[4,[54,.2,0]],[5,[-54,.2,0]]]){
  if(world.groundDrops.length>=ECONOMY.maxGroundDrops)break;
  if(hearts.some(h=>Math.hypot(h.position[0]-position[0],h.position[2]-position[2])<2))continue;
  world.groundDrops.push({id:`heart-${now}-${i}`,kind:'heart',amount:25,position,createdAt:now,expiresAt:now+90000});
 }
 return true;
}
import {ECONOMY} from './catalog.js';
