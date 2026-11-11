# Temple architecture audit

## Sources inspected

- GALLERY `3Dgallery01` at commit `25cf88b`, including `state.min.json`, `asset_manifest_full.json`, all artwork assets, the full and mobile SinTower GLBs, and the existing single-file Three.js runtime.
- RELETTER GitHub `main` at `18b310da030c5835422b057d6506aa45d1888dc9`, including its client modules, shared server rules, Cloudflare SQLite Durable Object, tests, `character.glb`, `monster.glb`, and the original `playermodel/COIN/coin_small.glb`.
- MatsuIslands GitHub `main`. Its published repository is a packaged runtime rather than reusable source. The useful procedural building, collision, forest and destruction source is present in RELETTER's `nangan-*` and `server/world-rules.js` modules, so Temple reuses those design patterns instead of importing the packaged map.

## Reused directly

- RELETTER skinned player GLB and its embedded idle/walk/run/jump/fall clips.
- RELETTER monster GLB and embedded chase/walk clips.
- RELETTER original coin GLB without geometric substitution.
- GALLERY's 13 artwork records and original image/model files. SinTower uses a Temple-specific 119,990-triangle Draco derivative with 1536 px WebP textures; the original 38.7 MB / 599k-triangle model remains untouched.
- Locally vendored Three.js r160, GLTFLoader, SkeletonUtils and the Draco decoder, removing runtime CDN and decoder failures from the GitHub Pages path.
- RELETTER's authoritative action pattern, idempotent request receipts, equipment slots, fusion constraints, WebSocket state broadcast, and SQLite-backed Durable Object deployment shape.

## Reimplemented for Temple

- Dynamic player identities, four fighter seats plus two spectator seats; no Ely/Rae identity branching.
- Independent Temple room, cookies/tokens, database tables, chat, plants, saves and Worker bindings.
- Data-driven arena/platform layout, artwork pickup/throw/respawn, platform coins, timed monster pool, and ground loot.
- GitHub Pages transport with a configurable cross-origin backend URL.
- Economy calibrated around platform-coin earning time, with meaningful sinks and bounded loot generation.
- Low-draw-call instancing for coins, drops, structures, trees, houses, dust and message plants; pooled artwork lights; mobile pixel-ratio and particle reductions.

## Isolation guarantees

- No RELETTER deployment files or database payloads are copied.
- Worker name is `temple-arena`, Durable Object class is `TempleRoom`, binding is `TEMPLE_ROOM`, and room ID is `temple-main-v1`.
- Admin access is read only from the `TEMPLE_ADMIN_KEY` Worker secret. No administrator key is emitted into public assets.
- The original Gallery state is retained on `codex/gallery-pre-temple-20261111` before Temple development.
