// A narrow server-authoritative ordinary strike: model reach + ten screen
// pixels at 7m camera distance, 60deg vertical FOV, 1080px viewport.
// The actual client's viewport is not trusted as an arbitrary hitbox multiplier.
export const MELEE_TEN_PIXEL_MARGIN=2*7*Math.tan(Math.PI/6)*10/1080;
const MELEE_FAMILIES=new Set(['whip','swatter','pan','planter','palm']);
export function normalMeleeFootprint(item){
 if(!item||item.exotic||!MELEE_FAMILIES.has(item.family))return null;
 const tier=Math.max(1,Math.min(5,Math.floor(Number(item.tier)||1))),scale=1+(tier-1)*.17;
 const extent={
  whip:1.3+3.4+(tier-1)*1.5+.55,
  swatter:1.25+.375*scale+.55,
  pan:1.12+.48*scale+.55,
  planter:1.5*scale+.55,
  palm:3.8*scale+.55
 }[item.family];
 return {range:+(extent+MELEE_TEN_PIXEL_MARGIN).toFixed(3),radius:+MELEE_TEN_PIXEL_MARGIN.toFixed(4)};
}
