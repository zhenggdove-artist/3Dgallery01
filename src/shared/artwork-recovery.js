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
