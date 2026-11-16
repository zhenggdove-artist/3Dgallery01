// Shared across browser, Durable Object and visual effects.
// Holding a staff fires server-validated repeated pulses, not charge-on-release.
const STAFF_FAMILIES=new Set(['water','fire','ice','lightning','beam','petal','wave']);
export function isChannelStaff(item){
 return !!item&&item.slot==='weapon'&&(item.id==='clam'||!item.exotic&&STAFF_FAMILIES.has(item.family));
}
export function weaponQuality(item,fusion){
 const tier=Math.max(1,Math.min(5,Math.max(Number(item?.tier)||1,(Number(fusion?.layer)||0)+1)));
 const d=tier-1;
 return {tier,visual:1+d*.19,damage:1+d*.13,range:1+d*.065,
  radius:1+d*.16,duration:1+d*.22};
}
// A continuous spray's visible width is not the radial AoE of a charged
// explosion. Shared by the authoritative hit tube and warning #59.
export function channelVisualRadius(item,quality=weaponQuality(item),range=Number(item?.range)||10){
 if(item?.id==='clam')return +(1.45*quality.visual).toFixed(3);
 // Match thin visible streams: previous fire warning grew wider with range.
 const base={water:1.05,ice:.80,fire:1.05,lightning:.65,beam:.65,petal:.95,wave:1.0};
 return +((base[item?.family]||1)*quality.visual).toFixed(3);
}
export function forwardCastRadius(item,quality=weaponQuality(item),statsRadius=1,channel=false){
 if(channel)return channelVisualRadius(item,quality);
 // #31 is a slender forward-travelling three-crown projectile, not an AoE.
 if(item?.family==='palm')return +(1.35*quality.visual).toFixed(3);
 return +(statsRadius*quality.radius).toFixed(2);
}
export const channelReachMultiplier=item=>item?.family==='ice'?2:1;
export const STAFF_TAP_MAX_MS=500;
export const CAST_MOVE_FACTOR=.05;
export const MONSTER_WEAPON_DAMAGE_FACTOR=.1;
export function chargeProgress(heldMs,weaponChargeMs){return Math.max(0,Math.min(1,((Number(heldMs)||0)-STAFF_TAP_MAX_MS)/Math.max(1,Number(weaponChargeMs)||1500)));}
export function isStaffTap(item,heldMs){
 return isChannelStaff(item)&&Number.isFinite(heldMs)&&heldMs>=0&&heldMs<=STAFF_TAP_MAX_MS;
}
export function channelInterval(item){return Math.max(260,Number(item?.cooldown)||700);}
// One shared duration/radius for the visible giant fish and server-owned swept hitbox.
export const GOLDFISH_SWIM_MS=1600;
export const GOLDFISH_SWIM_RADIUS=2.1;
