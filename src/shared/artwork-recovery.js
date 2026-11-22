import {PLATFORMS} from './arena.js';
// Server-authoritative reset for held and thrown artworks. Do not alter GM layouts.
export function recoverArtworks(world, isGM = false) {
  if (!isGM) return { error: 'GM only' };
  let recovered = 0;
  for (const art of Object.values(world.artworks || {})) {
    if (!art || typeof art !== 'object') continue;
    if (art.holder == null && art.throwEvent == null && !(art.availableAt > 0)) continue;
    art.holder = null;
    art.throwEvent = null;
    art.availableAt = 0;
    recovered++;
  }
  if (recovered) world.revision = (world.revision || 0) + 1;
  return {
    ok: true,
    recovered,
    notice: recovered ? `已復原 ${recovered} 件藝術作品` : '所有藝術作品已位於預設展示位置'
  };
}

/**
 * Restore a GM artwork hidden by an accidental -100 position edit.
 * Do not touch inventory/throws, image settings, scale or other artworks.
 * Recent edits can undo exactly from history; pre-history artwork recovers
 * only the damaged coordinate using its original exhibit anchor.
 */
export function recoverMisplacedArtworkPosition(world,isGM,platformId='',now=Date.now()){
 if(!isGM)return {error:'GM only'};
 const layouts=world.artworkLayout||{};
 const misplaced=Object.entries(layouts).filter(([id,layout])=>
  Array.isArray(layout?.position)&&
  layout.position.some(value=>Number.isFinite(value)&&Math.abs(value+100)<.0001));
 const candidates=platformId?misplaced.filter(([id])=>id===platformId):misplaced;
 if(!candidates.length)return {error:platformId?'指定作品沒有 -100 座標':'沒有發現位置為 -100 的作品'};
 if(candidates.length!==1)return {error:'偵測到多件作品座標為 -100，請個別指定作品'};
 const [id,layout]=candidates[0];
 const previous=Array.isArray(world.artworkLayoutHistory?.[id])?
  world.artworkLayoutHistory[id].at(-1):null;
 const original=PLATFORMS.find(p=>p.id===id)?.artPosition||
  world.customArtworks?.find(a=>a.id===id)?.position;
 if(!previous&&(!Array.isArray(original)||original.length!==3))
  return {error:'作品沒有可用的原始展示座標，未修改任何資料'};
 const from=[...layout.position];
 const restoreExact=previous?.position?.length===3&&
  previous.position.every(Number.isFinite)&&
  !previous.position.some(v=>Math.abs(v+100)<.0001);
 const next=restoreExact?[...previous.position]:layout.position.map((value,axis)=>
  Math.abs(value+100)<.0001?original[axis]:value);
 if(!next.every(Number.isFinite))return {error:'還原座標無效，未修改任何資料'};
 if(restoreExact){
  const history=world.artworkLayoutHistory[id];
  history.pop();
 }
 layouts[id]={...layout,position:next,revision:(layout.revision||0)+1,updatedAt:now};
 world.revision=(world.revision||0)+1;
 return {ok:true,platformId:id,from,position:next,exact:!!restoreExact,
  notice:restoreExact?'已恢復作品上一筆儲存座標':
   '已將 -100 座標恢復至原始展示位置（其他編輯保持不變）'};
}
