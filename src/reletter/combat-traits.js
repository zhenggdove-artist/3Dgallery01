import {balanceTokenStats} from './token-balance.js';
import {equipmentById,DEFAULT_WEAPON} from './equipment-catalog.js';
export const AFFIXES=[
 ['exultant','高亢的','Movement speed +55%.',{speed:1.55}],
 ['dread','恐懼的','Hits cause panic flight for 2.4s (6s recovery).',{}],
 ['searing','灼熱的','Burn: 2 damage/s for 5s.',{}],
 ['venomous','劇毒的','Poison: 0.8 damage/s for 14s.',{}],
 ['glacial','凜冽的','Slow movement by 50% for 4s.',{}],
 ['thunderous','雷鳴的','Stun for 0.65s (4s recovery).',{}],
 ['vampiric','嗜血的','Heal 0.35 HP on a hit (2s cooldown).',{}],
 ['renewing','再生的','Hits restore 0.3 HP/s over 5s; refreshes.',{}],
 ['stalwart','堅毅的','Incoming damage -25%.',{defense:.75}],
 ['mighty','巨力的','Attack +30%; movement -10%.',{attack:1.3,speed:.9}],
 ['featherlight','輕盈的','Jump +35%; movement +10%.',{jump:1.35,speed:1.1}],
 ['swift','迅捷的','Attack cooldown -30%.',{cooldown:.7}],
 ['farseeing','遠見的','Attack range +35%.',{range:1.35}],
 ['vast','廣域的','Attack radius +50%.',{radius:1.5}],
 ['brutal','殘暴的','25% chance to deal 1.8x direct damage.',{}],
 ['sundering','破甲的','Target takes +20% damage for 5s.',{}],
 ['enfeebling','虛弱的','Target contact damage -35% for 5s.',{}],
 ['binding','纏繞的','Root target for 1.2s (5s recovery).',{}],
 ['avaricious','貪婪的','Monster hits grant 2 coins (3s cooldown).',{}],
 ['resonant','共鳴的','Consecutive hits: +8% attack, up to 5 stacks; lasts 6s.',{}]
].map(([id,name,description,stats])=>({id,name,description,stats}));
export const affixById=id=>AFFIXES.find(a=>a.id===id);
export const FAMILY_TRAITS={water:'Soak: contact damage -20% for 3s.',fire:'Burn for 5s; damage ticks every second.',swatter:'Poison for 12s; smaller damage ticks every second.',ice:'Chill: movement -40% for 4s.',lightning:'Shock: stun 0.4s, with 3s recovery.',beam:'Expose: target takes +15% damage for 4s.',saber:'Bleed for 6s.',pan:'Knock target back 2m on impact.',wave:'Stagger: root 0.5s, with 3s recovery.',petal:'While equipped: +2 max HP, +12% attack, +8% speed, +10% jump.',planter:'While equipped: +2 max HP, +12% attack, +8% speed, +10% jump.',palm:'While equipped: +2 max HP, +12% attack, +8% speed, +10% jump.',whip:'While equipped: +2 max HP, +12% attack, +8% speed, +10% jump.'};
// Rolled once by the server on death and persisted through pickup/equip/restart.
export function rollDropStats(item,level,rng=Math.random){
 level=Math.max(1,Math.min(300,Number(level)||1));const stats={},draw=(lo,hi)=>lo+(hi-lo)*Math.max(0,Math.min(1,rng())),round=v=>+v.toFixed(3),power=()=>draw(.65+level*.023,.9+level*.023),utility=()=>draw(.85+level*.004,1.05+level*.004);
 if(item.slot==='weapon'){stats.damage=round(item.damage*power());stats.chargeDamage=round(Math.max(stats.damage,item.chargeDamage*power()));for(const k of ['range','chargeRange','radius'])stats[k]=round(item[k]*utility());stats.cooldown=Math.max(100,Math.round(item.cooldown/draw(.9+level*.002,1.05+level*.002)));}
 if(item.bonuses)stats.bonuses=Object.fromEntries(Object.entries(item.bonuses).map(([k,v])=>[k,round(Math.min(k==='defense'?.65:Infinity,v*power()))]));
 if(item.slot==='wings'){stats.impulse=round(item.impulse*utility());stats.gravity=round(Math.max(.12,item.gravity/utility()));stats.flapMs=Math.max(160,Math.round(item.flapMs/utility()));}
 return {sourceLevel:level,rollVersion:1,stats};
}
export function itemAffixes(item){return [...new Set([...(item?.affixIds||[]),item?.affixId].filter(id=>affixById(id)))];}
export function affixStats(item){const out={};for(const id of itemAffixes(item))for(const [key,value]of Object.entries(affixById(id).stats))out[key]=(out[key]||1)*value;return out;}
export function rollRankedDrop(item,boss,rng=Math.random){const roll=rollDropStats(item,boss.level,rng);if(!['elite','boss'].includes(boss.rank))return roll;const draw=()=>Math.max(0,Math.min(.999999, rng())),quality=Math.min(9,Math.max(1,Math.floor((boss.level||1)/25)+1+Math.floor(draw()*3)+(boss.rank==='boss'?1:0))),count=Math.min(4,2+Math.floor((boss.level||1)/60)+(boss.rank==='boss'&&draw()>.5?1:0)),pool=AFFIXES.map(a=>a.id),affixIds=[];for(let i=0;i<count;i++)affixIds.push(pool.splice(Math.floor(draw()*pool.length),1)[0]);for(const k of ['damage','chargeDamage'])if(roll.stats[k])roll.stats[k]=+(roll.stats[k]*(1+quality*.18)).toFixed(3);if(roll.stats.bonuses)for(const k of Object.keys(roll.stats.bonuses))roll.stats.bonuses[k]=+Math.min(k==='defense'?.75:Infinity,roll.stats.bonuses[k]*(1+quality*.12)).toFixed(3);return {...roll,affixId:affixIds[0],affixIds,gambleQuality:quality,fusionCount:0,sourceRank:boss.rank};}
export function resolveItem(game,name,id){const instance=(game.weaponInstances?.[name]||[]).find(x=>x.id===id);if(!instance)return equipmentById(id);const catalog=equipmentById(instance.baseId),affix=affixById(instance.affixId);if(!catalog||instance.affixId&&!affix)return null;const base={...catalog,...instance.stats};if(catalog.bonuses)base.bonuses={...catalog.bonuses,...instance.stats?.bonuses};const s=affixStats(instance),result={...base,description:base.slot==='outfit'&&instance.stats?.bonuses?'Rolled outfit bonuses':base.description,gambleQuality:instance.gambleQuality,instanceId:instance.id,affixId:affix?.id,affixIds:itemAffixes(instance),sourceRank:instance.sourceRank,sourceLevel:instance.sourceLevel,rolled:!!instance.stats,fusionCount:instance.fusionCount||0,obtainedAt:instance.obtainedAt||0,fusionEffects:(instance.fusionEffects||[]).slice(0,2),fusionSources:instance.fusionSources||[],name:(instance.fusionSources?.length?'['+instance.fusionSources.map(x=>x.name+' 30%').join(' / ')+'] ':'')+itemAffixes(instance).map(id=>affixById(id).name+' ').join('')+base.name+(Number.isInteger(instance.gambleQuality)?' (+'+instance.gambleQuality+')':'')+(instance.fusionCount?' (+'+instance.fusionCount+')':'')};if(base.slot!=='weapon')return result;return balanceTokenStats({...result,cooldown:Math.round(base.cooldown*(s.cooldown||1)),range:base.range*(s.range||1),chargeRange:base.chargeRange*(s.range||1),radius:base.radius*(s.radius||1)});}
export function activeHead(game,name){const slots=game.equipment?.[name]||{};return resolveItem(game,name,slots.headInstance||slots.head);}
export function activeWeapon(game,name){const slots=game.equipment?.[name]||{},w=resolveItem(game,name,slots.weaponInstance||slots.weapon)||DEFAULT_WEAPON,h=activeHead(game,name),outfit=resolveItem(game,name,slots.outfitInstance||slots.outfit),s=affixStats(h),os=affixStats(outfit),extras=['wings','shield'].map(slot=>resolveItem(game,name,slots[slot+'Instance']||slots[slot])),es=extras.map(affixStats),extra=k=>es.reduce((n,v)=>n*(v[k]||1),1);return {...w,weaponAffixIds:itemAffixes(w),affixIds:[...new Set([...itemAffixes(w),...itemAffixes(h),...itemAffixes(outfit),...extras.flatMap(itemAffixes)])],cooldown:Math.round(w.cooldown*(s.cooldown||1)*(os.cooldown||1)*extra('cooldown')),range:w.range*(s.range||1)*(os.range||1)*extra('range'),chargeRange:w.chargeRange*(s.range||1)*(os.range||1)*extra('range'),radius:w.radius*(s.radius||1)*(os.radius||1)*extra('radius')};}

export function ownedBaseIds(game,name){return (game.inventories?.[name]||[]).map(id=>resolveItem(game,name,id)?.id||id);}
export function traitStats(game,name,now=Date.now()){
 const outfit=resolveItem(game,name,game.equipment?.[name]?.outfitInstance||game.equipment?.[name]?.outfit),o=outfit?.bonuses||{},os=affixStats(outfit);
 const head=activeHead(game,name),h=head?.bonuses||{},hs=affixStats(head);
 const w=activeWeapon(game,name),s=affixStats({affixIds:[...w.weaponAffixIds,...['wings','shield'].flatMap(slot=>itemAffixes(resolveItem(game,name,game.equipment?.[name]?.[slot+'Instance']||game.equipment?.[name]?.[slot]))) ]}),plant=['petal','planter','palm','whip'].includes(w.family),res=game.combatBuffs?.[name]?.resonance;
 return {hp:(plant?2:0)+(h.hp||0)+(o.hp||0),attack:(plant?1.12:1)*(s.attack||1)*(hs.attack||1)*(os.attack||1)*(1+(h.attack||0))*(1+(o.attack||0))*(w.affixIds.includes('resonant')&&res?.until>now?1+.08*res.stacks:1),speed:(plant?1.08:1)*(s.speed||1)*(hs.speed||1)*(os.speed||1)*(1+(h.speed||0))*(1+(o.speed||0)),jump:(plant?1.1:1)*(s.jump||1)*(hs.jump||1)*(os.jump||1)*(1+(h.jump||0))*(1+(o.jump||0)),defense:(s.defense||1)*(hs.defense||1)*(os.defense||1)*(1-(h.defense||0))*(1-(o.defense||0))};
}
