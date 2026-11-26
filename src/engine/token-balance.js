// Effective limits preserve stored rolls while preventing legacy exponential boss loot from dominating.
export const TOKEN_DURATION=2000;
export function balanceTokenStats(item){
 if(item.id!=='chiang-token')return item;
 const level=Math.max(1,Math.min(400,item.sourceLevel||50)),fusion=Math.max(0,Math.min(20,item.fusionCount||0));
 const knee=12*(1+level*.012)*(1+.22*Math.sqrt(fusion));
 const soften=(v,k)=>v<=k?v:k+k*(1-Math.exp(-(v-k)/k));
 return {...item,damage:+soften(item.damage,knee).toFixed(3),chargeDamage:+soften(item.chargeDamage,knee*3).toFixed(3),cooldown:Math.max(380,item.cooldown)};
}
export function tokenAttackDamage(base,multiplier){return +(base*Math.min(4,1+Math.log2(Math.max(1,multiplier)))).toFixed(2);}
export function tokenLootMultiplier(power){return 1+Math.min(1,Math.log2(Math.max(1,power))*.08);}
