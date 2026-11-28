// Shared across browser, Durable Object and visual effects.
// Holding a staff fires server-validated repeated pulses, not charge-on-release.
const STAFF_FAMILIES=new Set(['water','fire','ice','lightning','beam','petal','wave']);
export function isChannelStaff(item){
 return !!item&&item.slot==='weapon'&&(item.id==='clam'||!item.exotic&&STAFF_FAMILIES.has(item.family));
}
export function weaponQuality(item,fusion){
 const tier=Math.max(1,Math.min(5,Math.max(Number(item?.tier)||1,(Number(fusion?.layer)||0)+1)));
 const d=tier-1;
 return {tier,visual:[1,1.4,1.85,2.4,3.05][d],damage:1+d*.13,range:[1,1.14,1.32,1.54,1.8][d],radius:[1,1.45,2.05,2.8,3.7][d],duration:1+d*.22};
}
// A continuous spray's visible width is not the radial AoE of a charged
// explosion. Shared by the authoritative hit tube and warning #59.
export function channelVisualRadius(item,quality=weaponQuality(item),range=Number(item?.range)||10){
 if(item?.id==='clam')return +(1.45*quality.visual).toFixed(3);
 // Match thin visible streams: previous fire warning grew wider with range.
 const base={water:1.05,ice:.80,fire:1.05,lightning:.65,beam:.65,petal:.95,wave:1.0};
 const tideScale=/^tide-[1-5]$/.test(item?.id||'')?3:1;
 return +((base[item?.family]||1)*quality.visual*tideScale).toFixed(3);
}
export function forwardCastRadius(item,quality=weaponQuality(item),statsRadius=1,channel=false){
 if(channel)return item?.family==='ice'?+(statsRadius*quality.radius).toFixed(2):channelVisualRadius(item,quality);
 // #31 is a slender forward-travelling three-crown projectile, not an AoE.
 if(item?.family==='palm')return +(1.35*quality.visual).toFixed(3);
 return +(statsRadius*quality.radius).toFixed(2);
}
// Nova taps are the small, straight elemental orb, not the charged vortex.
export const isNovaStaff=item=>!!item&&!item.exotic&&/^nova-[1-5]$/.test(item.id);
export const STAFF_ORB_SHELL_RADIUS=.47,STAFF_ORB_SHELL_PULSE=.18;
export const staffOrbVisualScale=qualityScale=>Math.max(.7,Math.min(1.6,Number(qualityScale)||1));
export function normalCastRadius(item,quality,statsRadius){
 // Match the existing visible shell at its maximum pulse; never inherit
 // the old wave area radius (up to 36.63m) on an ordinary Nova projectile.
 if(isNovaStaff(item))return STAFF_ORB_SHELL_RADIUS*(1+STAFF_ORB_SHELL_PULSE)*staffOrbVisualScale(quality.visual);
 return forwardCastRadius(item,quality,statsRadius,false);
}
export const channelReachMultiplier=item=>item?.family==='ice'?2:1;
export const STAFF_TAP_MAX_MS=250;
export const CAST_MOVE_FACTOR=.05;
// Whip tiers 4 and 5 share the maximum 0.8-second pull duration.
export const WHIP_PULL_SPEED=8.64*.5;
export function whipPullDurationMs(tier){
 return [200,400,600,800,800][Math.max(0,Math.min(4,(Math.floor(Number(tier))||1)-1))];
}
export const MONSTER_WEAPON_DAMAGE_FACTOR=.1;
export function chargeProgress(heldMs,weaponChargeMs){return Math.max(0,Math.min(1,((Number(heldMs)||0)-STAFF_TAP_MAX_MS)/Math.max(1,Number(weaponChargeMs)||1500)));}
export function isStaffTap(item,heldMs){
 return isChannelStaff(item)&&Number.isFinite(heldMs)&&heldMs>=0&&heldMs<=STAFF_TAP_MAX_MS;
}
// Native tiered staffs: single-target direct HP/s at blue grade, before
// affixes, character ATK, defense, criticals and existing elemental effects.
// Normal shots and sustained contacts use their own unchanged cadence.
const STAFF_BASE=Object.freeze({fire:[30,1000,1000],lightning:[28,700,1500],beam:[26,1400,250],wave:[24,1600,500],water:[22,650,200],petal:[20,800,1650],ice:[20,900,0]});
export function isBalancedStaff(item){return !!item&&!item.exotic&&/^(ember|storm|prism|nova|tide|bloom|frost)-[1-5]$/.test(item.id)&&!!STAFF_BASE[item.family];}
export function staffBaseDps(item,quality=weaponQuality(item)){return isBalancedStaff(item)?STAFF_BASE[item.family][0]*quality.damage/1.26:null;}
export function staffBaseDamage(item,ultimate=false,quality=weaponQuality(item)){
 if(!isBalancedStaff(item))return null;
 const [dps,cooldown,contact]=STAFF_BASE[item.family],grade=Math.max(1,Math.min(5,Number(item.tier)||1)),scale=quality.damage/1.26;
 return +(ultimate?(contact?dps*scale*contact/1000:25*scale):dps*scale*(cooldown-(grade-1)*35)/1000).toFixed(6);
}
// Sustained spells only. Lightning and wind share the second-shortest mana budget.
// Hit power is per native damage contact, before quality, equipment and target effects.
const CHANNEL_BALANCE=Object.freeze({
 fire:Object.freeze({initial:20,mpPerSecond:20,hit:16}),
 lightning:Object.freeze({initial:20,mpPerSecond:13,hit:12}),
 wave:Object.freeze({initial:20,mpPerSecond:13,hit:3}),
 beam:Object.freeze({initial:20,mpPerSecond:10,hit:4}),
 water:Object.freeze({initial:20,mpPerSecond:7,hit:1.5}),
 petal:Object.freeze({initial:20,mpPerSecond:9,hit:3.5})
});
export function sustainedSpellBalance(item){
 if(!isChannelStaff(item)||item.family==='ice')return null;
 const base=CHANNEL_BALANCE[item.id==='clam'?'water':item.family]||null;
 if(!base||!isBalancedStaff(item))return base;
 return {...base,hit:staffBaseDamage(item,true)/weaponQuality(item).damage};
}
export const ICE_FREEZE_INTERVAL_MS=6000;
export function channelInterval(item){return item?.family==='ice'?ICE_FREEZE_INTERVAL_MS:Math.max(260,Number(item?.cooldown)||700);}
// One shared duration/radius for the visible giant fish and server-owned swept hitbox.
// Triple duration keeps the original swimming speed over the tripled reach.
export const GOLDFISH_SWIM_MS=2400; // Twice the swimming speed, unchanged travel budget.
export const TIDE_PUSH_INTERVAL_MS=3000,TIDE_PUSH_DURATION_MS=1000,TIDE_PUSH_DISTANCE=3;
export const TIDE_DAMAGE_TICK_MS=200;
export const GOLDFISH_SWIM_RADIUS=1.05; // Halved to follow the halved fish mesh, including collision.
