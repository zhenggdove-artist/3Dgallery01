# Temple architecture audit

## Sources inspected

- GALLERY `3Dgallery01` at commit `25cf88b`, including `state.min.json`, `asset_manifest_full.json`, all artwork assets, the full and mobile SinTower GLBs, and the existing single-file Three.js runtime.
- MatsuIslands GitHub `main`. Its published repository is a packaged runtime rather than reusable source. Temple implements its procedural building, collision, forest and destruction systems as scene modules without importing the packaged map.

## Project assets and runtime components

- Skinned player GLB and its embedded idle/walk/run/jump/fall clips.
- Monster GLB and embedded chase/walk clips.
- Original coin GLB without geometric substitution.
- GALLERY's 13 artwork records and original image/model files. SinTower uses a Temple-specific 119,990-triangle Draco derivative with 1536 px WebP textures; the original 38.7 MB / 599k-triangle model remains untouched.
- Locally vendored Three.js r160, GLTFLoader, SkeletonUtils and the Draco decoder, removing runtime CDN and decoder failures from the GitHub Pages path.
- Server-authoritative action validation, idempotent request receipts, equipment slots, fusion constraints, WebSocket state broadcast, and SQLite-backed Durable Object deployment.

## Reimplemented for Temple

- Dynamic player identities, four fighter seats plus two spectator seats; no Ely/Rae identity branching.
- Independent Temple room, cookies/tokens, database tables, chat, plants, saves and Worker bindings.
- Data-driven arena/platform layout, artwork pickup/throw/respawn, platform coins, timed monster pool, and ground loot.
- GitHub Pages transport with a configurable cross-origin backend URL.
- Economy calibrated around platform-coin earning time, with meaningful sinks and bounded loot generation.
- Low-draw-call instancing for coins, drops, structures, trees, houses, dust and message plants; pooled artwork lights; mobile pixel-ratio and particle reductions.

## Isolation guarantees

- Production uses isolated Worker resources and does not bundle external runtime database payloads.
- Worker name is `temple-arena`, Durable Object class is `TempleRoom`, binding is `TEMPLE_ROOM`, and room ID is `temple-main-v1`.
- Admin access is read only from the `TEMPLE_ADMIN_KEY` Worker secret. No administrator key is emitted into public assets.
- The original Gallery state is retained on `codex/gallery-pre-temple-20261111` before Temple development.
