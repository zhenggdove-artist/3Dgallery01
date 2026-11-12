// Numeric IDs match the original damage-number lane/deduplication contract.
export function recordTempleDamage(world,{amount,position,owner=null,target,kind='normal'},now){
 if(!(amount>0))return;
 world.damageSequence=(world.damageSequence||0)+1;
 world.damageEvents=(world.damageEvents||[]).filter(e=>now-e.time<8000).slice(-127);
 world.damageEvents.push({id:world.damageSequence,time:now,amount:+amount.toFixed(2),position:[...position],owner,target,kind});
}
