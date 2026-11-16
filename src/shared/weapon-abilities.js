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
export function channelInterval(item){return Math.max(260,Number(item?.cooldown)||700);}
