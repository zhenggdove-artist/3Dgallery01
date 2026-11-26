import {attackStats,itemById} from './catalog.js';
import {weaponQuality,isChannelStaff,channelReachMultiplier,forwardCastRadius,GOLDFISH_SWIM_RADIUS} from './weapon-abilities.js';
import {equipmentTuning,tunedEquipment,applySkillAreaScale} from './equipment-tuning.js';
import {chargedArea,spellGroundHeight,spellFootprint,scaleUltimateFootprint,fusionEchoAnchor} from './charge-area.js';
import {GOLDFISH_TRAVEL_SCALE,GOLDFISH_SCHOOL_RADIUS} from './goldfish-school.js';
import {projectileFlightMs} from './combat-balance.js';
// Presentation only. No health, collision, mana or inventory mutations.
export function chargedVisualData(world,item,sample,owner,channel=false){
 const record=world?.profile?.fusion?.[item.id],quality=weaponQuality(item,record),stats=attackStats(item,1);
 if(channel||item.family==='ice')stats.range=Math.max(stats.range,item.id==='clam'?10:Math.min(18,item.range))*channelReachMultiplier(item);
 stats.range=+(stats.range*quality.range).toFixed(2);
 stats.radius=forwardCastRadius(item,quality,stats.radius,channel||item.family==='ice');
 if(item.id==='jellybrella')stats.radius=Math.max(10,stats.radius*2);
 if(item.id==='goldfish')stats.radius=GOLDFISH_SWIM_RADIUS*quality.visual;
 scaleUltimateFootprint(stats,item,quality);
 if(item.id==='goldfish'){stats.range=+(stats.range*GOLDFISH_TRAVEL_SCALE).toFixed(3);stats.radius=GOLDFISH_SCHOOL_RADIUS*quality.visual;}
 if(item.id==='giraffe'){stats.range=+(item.chargedRange*quality.range).toFixed(2);stats.radius=Math.max(stats.radius,5.9*quality.visual);}
 const tuning=equipmentTuning(world,item);stats.range*=tuning.rangeScale??1;applySkillAreaScale(stats,item,tuning);
 const origin=sample.origin,direction=sample.direction,ground=(x,z,y)=>spellGroundHeight(world,x,z,y);
 const area=item.id==='goldfish'||item.family==='wave'?null:chargedArea(item,origin,direction,stats,ground,channel||item.family==='ice');
 const flat=Math.hypot(direction[0],direction[2])||1;
 const result={...stats,weapon:item.id,owner,origin:item.id==='goldfish'?[origin[0],origin[1]+2,origin[2]]:origin,direction:item.id==='goldfish'?[direction[0]/flat,0,direction[2]/flat]:direction,area,charge:1,ultimate:true,channel,combo:6,qualityTier:quality.tier,qualityScale:quality.visual,qualityDuration:quality.duration,skillRadiusScale:tuning.radiusScale??1,flightMs:projectileFlightMs(item,true,stats.range),time:Date.now(),fusionEchoes:[]};
 const footprint=spellFootprint(item,origin,direction,stats,area,ground);
 for(const [fusionSlot,id] of (record?.effects||[]).filter(id=>id!=='black-cat').slice(0,2).entries()){
  const source=tunedEquipment(world,itemById(id));if(source?.slot!=='weapon')continue;
  const q=weaponQuality(source),full=attackStats(source,1),echoTuning=equipmentTuning(world,source),echoChannel=channel&&isChannelStaff(source);
  const native={...full,range:full.range*q.range,radius:forwardCastRadius(source,q,full.radius,echoChannel)};
  scaleUltimateFootprint(native,source,q);applySkillAreaScale(native,source,echoTuning);
  const anchor=fusionEchoAnchor(footprint,origin),secondary={...native,range:source.id==='goldfish'?anchor.distance*GOLDFISH_TRAVEL_SCALE:anchor.distance};
  const echoArea=source.id==='goldfish'||source.family==='wave'?null:chargedArea(source,origin,direction,secondary,ground,echoChannel,true);
  if(echoArea?.mode==='area'&&echoArea.shape!=='ice-line'){
   const y=Math.max(0,ground(anchor.x,anchor.z,origin[1]));Object.assign(echoArea,{center:[anchor.x,y+.12,anchor.z],visualCenter:[anchor.x,y+.16,anchor.z],travel:anchor.distance,range:anchor.distance,radius:secondary.radius});
  }
  result.fusionEchoes.push({weapon:id,owner,origin,direction,area:echoArea,parentFootprint:footprint,charge:1,ultimate:true,channel:echoChannel,range:secondary.range,radius:secondary.radius,qualityTier:q.tier,qualityScale:q.visual*.5,qualityDuration:q.duration,skillRadiusScale:echoTuning.radiusScale??1,fusionSlot,fusionEcho:true,time:result.time});
 }
 return result;
}
