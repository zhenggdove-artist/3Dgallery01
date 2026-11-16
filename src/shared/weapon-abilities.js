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
export const STAFF_TAP_MAX_MS=750;
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
