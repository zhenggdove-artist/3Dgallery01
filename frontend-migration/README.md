# GGTEMPLE frontend isolation — staging only

Do not merge or make the original repository private yet. The existing production
game, Worker, Durable Object class/binding/room, payment callback, assets and
GitHub Pages remain unchanged. This branch changes no game files. It prepares
a byte-identical frontend deployment, not the subsequent bundling/minification
phase. The conservative directory allowlist still contains some legacy browser
assets; pruning and source minimization must be tested independently.

## Staging
1. Rebase this branch on the latest production main, check only these migration
   paths differ, and run the staging validation workflow. Do not deploy an old
   game revision. Local staging uses an independent Wrangler state; never
   test GM operations or purchases against the live room.
2. The build command is `node frontend-migration/build.mjs` after npm ci.
   Only frontend paths are copied. Files above 25 MiB are copied byte for byte
   to a separate non-public directory; Pages Functions stream the same bytes
   from content-addressed R2 keys on the original relative URLs. No asset
   quality or model changes. Do not publish the entire .build directory.
3. In Cloudflare create a new private R2 bucket and an independent Pages project,
   both named ggtemple-client-staging if available. If unavailable, choose a new
   name and update ONLY frontend-migration/wrangler.jsonc. Never replace the
   existing temple-arena Worker or its Durable Object configuration.
4. With authorized Cloudflare Pages/R2 credentials:
   `node frontend-migration/transfer-large.mjs --remote ggtemple-client-staging`.
   This uploads and downloads the unique oversized objects to verify hashes.
   Then `npx wrangler pages deploy frontend-migration/.build/pages --config frontend-migration/wrangler.jsonc --project-name ggtemple-client-staging --branch staging`.
   Configure/verify the exact R2 binding GGTEMPLE_LARGE_ASSETS for the preview.
   The preview is not ready merely because its landing page loads.
5. Run `PAGES_TEST_URL=https://YOUR-PREVIEW node frontend-migration/test-delivery.mjs`
   against the preview. Verify every static asset and large binary by SHA-256,
   HTTP status, range behavior, MIME and absence of server/repository files.
   Check mobile Safari and desktop Chromium; compare startup, FPS, input and
   latency with the same main revision. This branch does not certify live login.
6. Add only the exact new origin to the existing TEMPLE_ALLOWED_ORIGINS while
   retaining all currently configured values; add the hostname in Firebase
   Authentication Authorized domains. Do not reset variables or secrets.
   Verify Google existing/new accounts, GM identity, guest sessions, WSS,
   role changes and inventory, art, graffiti, wings, combat and multiplayer
   behavior. Use controlled accounts and payment sandbox, not real charges.
   Browser storage is origin-scoped: do not promise seamless local preferences
   or cached login; design/test migration before public cutover.
7. ECPay TEMPLE_GAME_URL defaults to the original GitHub Pages URL. Verify actual
   checkout and return behavior; retain the production notify callback and
   reconcile pending orders before changing the return URL. Do not switch
   payment provider or reset credentials.
8. Cut over only after all tests pass and private repository deployment access
   is confirmed. Keep original site active during staging. The original
   github.io project URL may cease serving when repository visibility changes,
   especially on GitHub Free. A dedicated stable link/redirect requires separate
   planning (and a public redirect repository must never contain original
   code/history). Do not claim the old URL is preserved without testing.
9. Validate production health and compare known controlled account data before
   and after cutover. Keep the original backend exactly as-is except reviewed
   additive origin/return URL configuration. If any check fails, stop; keep
   serving the old site, roll back Pages deployment/config changes independently.
10. Only after new public frontend and old-link plan pass, make the source
    repository private. Existing public copies cannot be recalled. Audit git
    history for exposed secrets and rotate confirmed exposed credentials; do not
    blindly rotate live secrets. Verify ongoing CI access and backend deployments.
    Perform production bundling/minification as a later separate change;
    no source maps, no heavy obfuscation, no changes to runtime behavior.

The local CI workflow has no remote deployment steps or cloud credentials.
