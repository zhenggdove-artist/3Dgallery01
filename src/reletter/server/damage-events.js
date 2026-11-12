// Resolved server-authoritative damage, including overkill, produces combat text.
export function recordDamage(g,target,amount,kind,owner,now,position){
 amount=+Math.max(0,amount).toFixed(2);if(!amount||!Number.isFinite(amount))return;
 g.damageSequence=(g.damageSequence||0)+1;g.damageEvents??=[];
 g.damageEvents.push({id:g.damageSequence,time:now,amount,kind,owner,target:target.id||target.kind||'auntie',position:position?[...position]:[target.position[0],target.position[1]+(target.island?.6:18),target.position[2]]});
 g.damageEvents=g.damageEvents.filter(e=>now-e.time<8000).slice(-256);
}
export function damageView(g,now=Date.now()){return (g.damageEvents||[]).filter(e=>now-e.time<8000);}
