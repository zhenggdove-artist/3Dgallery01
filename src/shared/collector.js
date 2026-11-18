import {ARENA_RADIUS,PLATFORMS,distance2d,insideArena,insideSafeZone} from './arena.js';

export const COLLECTOR_INTERVAL_MS=30_000;
export const COLLECTOR_RADIUS=2.8;
export const COLLECTOR_PRICES=Object.freeze([1000,2000,3000,4000,5000]);
export const COLLECTOR_REVIEWS=Object.freeze([
 'An interesting idea, though it has yet to win me over.',
 'There is something genuinely compelling about this piece.',
 'Extraordinary! This work has completely captured my imagination.',
 'A flawless work of art. I would be proud to add it to my collection.',
 'A legendary masterpiece. This belongs among the greatest treasures of art.'
]);

export function initialCollector(now=Date.now()){
 return {active:false,position:null,spawnedAt:0,nextSpawnAt:now};
}

function collectorPosition(world,rng){
 // Generate a walkable spot, not a raised gallery disc or the WRITE hub.
 for(let attempt=0;attempt<48;attempt++){
  const angle=Math.max(0,Math.min(.999999,Number(rng())||0))*Math.PI*2;
  const radial=Math.max(0,Math.min(.999999,Number(rng())||0));
  const radius=14+Math.sqrt(radial)*(ARENA_RADIUS-22);
  const p=[Math.cos(angle)*radius,0,Math.sin(angle)*radius];
  if(!insideArena(p,-6)||insideSafeZone(p))continue;
  if(PLATFORMS.some(display=>distance2d(p,display.position)<Math.max(3.5,display.size[0]/2+2.8)))continue;
  if((world.structures||[]).some(s=>distance2d(p,s.position)<(s.kind==='house'?6:3.6)))continue;
  return p.map(n=>+n.toFixed(2));
 }
 return [20,0,-34];
}

// The Durable Object decides proximity, ownership and payment. A client
// never supplies an artwork ID, sale price, or minted currency.
export function tickCollector(world,actors,now=Date.now(),rng=Math.random){
 world.collector??=initialCollector(now);
 const collector=world.collector;
 if(collector.active&&Array.isArray(collector.position)){
  for(const actor of actors){
   if(actor.role!=='fighter')continue;
   const profile=world.profiles?.[actor.key];
   if(!profile||profile.hp<=0||profile.deadUntil>now)continue;
   if(!Array.isArray(actor.position)||!insideArena(actor.position))continue;
   if(distance2d(actor.position,collector.position)>COLLECTOR_RADIUS||
      Math.abs(actor.position[1]-collector.position[1])>3.2)continue;
   const entry=Object.entries(world.artworks||{}).find(([,art])=>art.holder===actor.key);
   if(!entry)continue;
   const [artworkId,art]=entry;
   const price=COLLECTOR_PRICES[Math.min(4,Math.max(0,Math.floor((Number(rng())||0)*5)))];
   if(!profile.admin)profile.wallet+=price;
   world.activity??={coinMinted:0,coinBurned:0,itemsSpawned:0,itemsClaimed:0};
   world.activity.coinMinted+=price;
   art.holder=null;
   art.throwEvent=null;
   // Sold art vanishes and follows the existing 30s art respawn cycle.
   art.availableAt=now+30_000;
   collector.active=false;
   collector.position=null;
   collector.nextSpawnAt=now+COLLECTOR_INTERVAL_MS;
   world.lastCollectorSale={
    id:crypto.randomUUID(),buyer:actor.key,artworkId,price,
    review:COLLECTOR_REVIEWS[price/1000-1],time:now
   };
   return true;
  }
 }
 // If no artwork was sold, relocate to a new random spot every 30s.
 if(now>=collector.nextSpawnAt){
  collector.active=true;
  collector.position=collectorPosition(world,rng);
  collector.spawnedAt=now;
  collector.nextSpawnAt=now+COLLECTOR_INTERVAL_MS;
  return true;
 }
 return false;
}
