import {itemById} from './catalog.js';

export const FLOWER_HEAL_INTERVAL_MS=1000;
export const FLOWER_CHANNEL_TIMEOUT_MS=2400;

// Healing is strictly server-authoritative. It is awarded only while
// the equipped flower-crown staff is STILL channeling, never on normal taps.
// Individual projectiles do not each trigger healing.
export function tickFlowerChannelHealing(profile,now){
 const item=itemById(profile?.channelWeapon);
 const valid=item?.family==='petal'&&item.id===profile.equipment?.weapon&&
  profile.hp>0&&profile.deadUntil<=now&&profile.channelStartedAt>0&&
  profile.lastChannelPulseAt>0&&now-profile.lastChannelPulseAt<=FLOWER_CHANNEL_TIMEOUT_MS;
 if(!valid){
  if(profile)profile.flowerHealNextAt=0;
  return false;
 }
 if(!profile.flowerHealNextAt)profile.flowerHealNextAt=now+FLOWER_HEAL_INTERVAL_MS;
 if(now<profile.flowerHealNextAt)return false;
 // Prevent catch-up healing after lag, disconnects, or paused room ticks.
 const ticks=Math.min(2,1+Math.floor((now-profile.flowerHealNextAt)/FLOWER_HEAL_INTERVAL_MS));
 profile.flowerHealNextAt=now+FLOWER_HEAL_INTERVAL_MS;
 const hp=Math.min(profile.maxHp,profile.hp+ticks);
 if(hp<=profile.hp)return false;
 profile.hp=hp;
 return true;
}
