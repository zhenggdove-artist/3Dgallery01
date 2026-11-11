(function configureTemple(global) {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const stored = localStorage.getItem('temple-backend-url') || '';
  global.TEMPLE_CONFIG = Object.freeze({
    backendUrl: stored || (local ? 'http://127.0.0.1:8787' : 'https://temple-arena.zhenggdove-artist.workers.dev'),
    roomId: 'temple-main-v1',
    protocolVersion: 1
  });
})(window);
