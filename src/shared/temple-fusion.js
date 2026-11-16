import {itemById,ECONOMY} from './catalog.js';
import {equippedItem} from './fusion-adapter.js';

// Only the server mutates inventory, spending, fusion properties and ultimate echoes.
export function fuseTemple(world,profile,body){
 const source=itemById(body.sourceId),target=itemById(body.targetId),requestId=String(body.requestId||'');
 if(requestId.length<8||requestId.length>80)return {error:'Missing fusion request ID'};
 profile.fusionReceipts??={};
 if(profile.fusionReceipts[requestId])return structuredClone(profile.fusionReceipts[requestId]);
 const equip=new Set(['weapon','head','armor','outfit','wings','shield']);
 if(!source||!target||!equip.has(target.slot)||!(equip.has(source.slot)||source.slot==='material'))
  return {error:'Select any rarity of weapon or equipment, including shop purchases'};
 const sourceIndex=profile.inventory.indexOf(source.id),targetIndex=profile.inventory.indexOf(target.id);
 if(sourceIndex<0||targetIndex<0||(source.id===target.id&&profile.inventory.filter(id=>id===source.id).length<2))
  return {error:'Both items must be owned (identical IDs require two copies)'};
 const old=profile.fusion[target.id]||{},layer=(old.layer||0)+1;
 if(layer>20)return {error:'Fusion limit reached (20)'};
 const cost=ECONOMY.fusionBaseCost*layer;
 if(!profile.admin&&profile.wallet<cost)return {error:'Not enough coins for fusion'};
 const main=equippedItem(profile,target),material=equippedItem(profile,source),stats={...(old.templeStats||{})};
 const keys=['damage','chargeDamage','range','chargeRange','radius','defense','capacity','impulse','speed','jump'];
 for(const key of keys){
  const a=Number(material[key]),b=Number(main[key]);
  if(!(a>0)||!(b>0))continue;
  const cap=['range','chargeRange'].includes(key)?400:key==='radius'?80:key==='defense'?300:100000;
  stats[key]=+Math.min(cap,b+a*.3).toFixed(3);
 }
 if(source.slot==='material'&&target.slot==='weapon'){
  const extra={'wet-stone':3.5,'signal-wire':6,'temple-resin':10}[source.id]||0;
  stats.damage=+(Number(stats.damage??main.damage??0)+extra).toFixed(3);
 }
 if(!profile.admin){profile.wallet-=cost;world.activity.coinBurned+=cost;}
 profile.inventory.splice(sourceIndex,1);
 if(source.id!==target.id&&profile.equipment[source.slot]===source.id)profile.equipment[source.slot]=null;
 const effects=(old.effects||[]).filter(id=>itemById(id)?.slot==='weapon').slice(0,2);
 const grantsEcho=target.slot==='weapon'&&source.slot==='weapon'&&effects.length<2;
 if(grantsEcho)effects.push(source.id);
 profile.fusion[target.id]={...old,layer,templeStats:stats,effects,
  sources:[...(old.sources||[]),{id:source.id,name:source.name,statPercent:30,echo:grantsEcho}]};
 const result={notice:'FUSION SUCCESS · '+target.name+' +'+layer+
  (grantsEcho?' · ULTIMATE ECHO '+effects.length+'/2':' · STATS +30%'),
  fusion:{success:true,target:target.id,layer,cost,effects:[...effects]}};
 profile.fusionReceipts[requestId]=structuredClone(result);
 const receipts=Object.keys(profile.fusionReceipts);
 if(receipts.length>64)delete profile.fusionReceipts[receipts[0]];
 return result;
}
