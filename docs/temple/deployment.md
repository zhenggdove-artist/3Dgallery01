# Temple deployment

## Production services

- Frontend repository: `zhenggdove-artist/3Dgallery01`
- Frontend target: `https://zhenggdove-artist.github.io/3Dgallery01/`
- Multiplayer backend: `https://temple-arena.zhenggdove-artist.workers.dev`
- Health endpoint: `https://temple-arena.zhenggdove-artist.workers.dev/health`
- Worker: `temple-arena`
- Durable Object: `TempleRoom`
- Binding: `TEMPLE_ROOM`
- Room: `temple-main-v1`

This Worker is independent from RELETTER. The Worker bundle contains only the Temple API landing page and server modules; Gallery artworks remain GitHub Pages assets.

## Deploying the backend

```powershell
npm run deploy:cloud
npx wrangler secret put TEMPLE_ADMIN_KEY
```

Never place the administrator value in `temple-config.js`, HTML, source control, logs, or a public environment file.

## Deploying the frontend

The repository keeps the Pages entry point at the root `index.html`. Push a verified commit to the repository's Pages source branch, then verify that the public page connects to the Worker over WSS.

## Preflight

```powershell
npm run check
npm test
npm run build:cloud
git diff --check
```

Run `npm run test:api` with `TEMPLE_API` and `TEMPLE_ORIGIN` set to the production URLs for a six-seat production smoke test.
