// Keep removed scene records recoverable; never discard messages or artwork edits.
export function cleanLegacyScene(world){
 if(world.sceneCleanupVersion>=3)return world;
 if(world.sceneCleanupVersion===2){
  const fishing=world.reletter?.fishing;
  if(fishing?.holes?.length){
   world.sceneArchive??={};
   world.sceneArchive.removedBlackFishingHoles=[...(world.sceneArchive.removedBlackFishingHoles||[]),...fishing.holes];
   const oldIds=new Set(fishing.holes.map(h=>h.id));fishing.holes=[];
   for(const [key,session] of Object.entries(fishing.sessions||{}))if(oldIds.has(session.hole))delete fishing.sessions[key];
   fishing.revision=(fishing.revision||0)+1;
  }
  world.sceneCleanupVersion=3;return world;
 }
 if(world.sceneCleanupVersion===1){
   // One-time archival of the GM's old excavated fishing hole(s); leave other
   // players' aquariums and saved fish untouched.
   const f=world.reletter?.fishing;
   if(f?.holes?.length){const removed=f.holes.filter(h=>world.profiles?.[h.owner]?.admin);if(removed.length){world.sceneArchive??={};world.sceneArchive.gmExcavations=[...(world.sceneArchive.gmExcavations||[]),...removed];f.holes=f.holes.filter(h=>!removed.includes(h));const ids=new Set(removed.map(h=>h.id));for(const [name,session] of Object.entries(f.sessions||{}))if(ids.has(session.hole))delete f.sessions[name];f.revision=(f.revision||0)+1;}}
   world.sceneCleanupVersion=2;return cleanLegacyScene(world);
 }
 const removed=(world.structures||[]).filter(s=>s.owner==='temple'||['tree','house'].includes(s.kind));
 const fishing=world.reletter?.fishing;
 world.sceneArchive={...(world.sceneArchive||{}),structures:removed,holes:fishing?.holes||[],ponds:fishing?.ponds||[]};
 world.structures=(world.structures||[]).filter(s=>!removed.includes(s));
 if(fishing){fishing.holes=[];fishing.ponds=[];fishing.sessions={};}
 world.sceneCleanupVersion=3;
 return world;
}
