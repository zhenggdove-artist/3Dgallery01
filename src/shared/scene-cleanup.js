// Keep removed scene records recoverable; never discard messages or artwork edits.
export function cleanLegacyScene(world){
 if(world.sceneCleanupVersion===1)return world;
 const removed=(world.structures||[]).filter(s=>s.owner==='temple'||['tree','house'].includes(s.kind));
 const fishing=world.reletter?.fishing;
 world.sceneArchive={...(world.sceneArchive||{}),structures:removed,holes:fishing?.holes||[],ponds:fishing?.ponds||[]};
 world.structures=(world.structures||[]).filter(s=>!removed.includes(s));
 if(fishing){fishing.holes=[];fishing.ponds=[];fishing.sessions={};}
 world.sceneCleanupVersion=1;
 return world;
}
