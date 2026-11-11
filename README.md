# Temple

Temple is a server-authoritative multiplayer Three.js art arena rebuilt from the Gallery artwork collection and isolated RELETTER gameplay patterns.

- 4 active fighters + 2 spectators per room
- 13 original Gallery artworks on data-driven platforms
- PvP, timed PvE monster, artwork throwing, ground loot and platform coins
- persistent inventory, equipment, fusion, fishing, buildings, message plants and four-character save codes
- Cloudflare Worker + SQLite Durable Object backend
- GitHub Pages frontend with a configurable cross-origin API URL

## Local development

```powershell
npm install
npm run dev:cloud
npm start
```

Open `http://127.0.0.1:8000`. The local frontend automatically uses `http://127.0.0.1:8787`.

## Verification

```powershell
npm run check
npm test
npm run test:api
npm run test:browser
```

## Deployment

The public client uses `https://temple-arena.zhenggdove-artist.workers.dev`. Deployment notes and isolation guarantees are in [`docs/temple/deployment.md`](docs/temple/deployment.md) and [`docs/temple/architecture-audit.md`](docs/temple/architecture-audit.md).

The GM credential is never stored in this repository. It must exist only as the Cloudflare Worker secret `TEMPLE_ADMIN_KEY`.
