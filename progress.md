Original prompt: Debug the exported 3D gallery. Fix artwork asset/placement confusion, invisible smoke, too-fast look controls, mobile forward movement, and performance without reducing visual quality.

## 2026-06-04 current `index.html` correction

- User explicitly requested that the primary file is `index.html`; no other HTML entry should be treated as the target for this round.
- Re-read the actual exported state and asset images. The white rectangular artwork shown in the user's Image #2 is `project-01` / `assets/asset_0005.png`, not `1-processed` / `asset_0014.png`.
- The requested replacement artwork in the user's Image #3 is `S__82264084-processed` / `assets/asset_0007.png`, not `2-processed` / `asset_0011.png`.
- Directly updated the embedded `EXPORTED_STATE` in `index.html`:
  - removed `project-01` / `asset_0005.png`;
  - placed `S__82264084-processed` / `asset_0007.png` at the old white artwork position `(-17.612000002384185, 3, -3.9325752019256663)` with rotation `{x:0, y:90, z:0}`;
  - kept total artwork count at 12 and kept the replacement artwork's own size/material.
- Updated the runtime correction guards so future stale state removes only `project-01` / `asset_0005.png` and uses only `S__82264084-processed` / `asset_0007.png` as the replacement.
- Mobile camera/control changes in `index.html`:
  - mobile default camera distance is `15.5`;
  - mobile FOV is `66`;
  - mobile camera follow now copies directly to the target camera position instead of lagging behind the player;
  - mobile shoulder offset is `0`, with a lifted aim target so the actor stays in the lower-middle screen area;
  - touch look now passes `dx` directly into `applyCameraLookDelta`, so rightward swipe turns the view right;
  - pinch handlers are bound on both `canvas` and `document`;
  - obstruction fade now uses cached world bounding boxes instead of expensive geometry raycasts.
- Verification:
  - module syntax check passed for `index.html`;
  - mobile debug state reports `cameraDistance=15.5`, `cameraFov=66`, `hasWrongWhiteArtwork=false`;
  - debug state reports exactly one target artwork: `assets/asset_0007.png` at `(-17.612000002384185, 3, -3.9325752019256663)`;
  - look test: `dx=150` changes yaw from `0` to `-0.51`, matching rightward view movement;
  - pinch out test changes camera distance from `15.5` to `7.5405`; pinch in returns it to `15.5`;
  - forward mobile movement after 1.2s keeps `playerScreen.ndcX` effectively `0` and `effectiveMove.forward=1`.

## 2026-06-04

- Added cache-busting for local `assets/` and `models/` in exported viewer mode so GitHub Pages/mobile browsers do not reuse stale artwork, wall texture, or actor files.
- Split mobile joystick state from keyboard state; movement now uses a composed input vector.
- Reduced look sensitivity for mouse and touch.
- Made atmosphere visible through shader fog while reducing particle count.
- Tightened the loading gate so expected assets must be loaded before input is released.
- Verified with Playwright/CDP:
  - mobile joystick forward sets `effectiveMove.forward=1` and moves player z from `5.8` to `4.67`;
  - mobile touch look changes yaw from `0` to `0.238`;
  - desktop W moves player z from `5.8` to `2.91`;
  - desktop left-drag changes yaw from `0` to `0.408`;
  - actor FBX is loaded and proxy actor is hidden;
  - `2-processed` maps to `assets/asset_0011.png`, `1-processed` maps to `assets/asset_0014.png`.

TODO:
- None.

## 2026-06-04 handoff update after forced-entry fix

Latest user complaint:
- The user still saw the wrong white/tall artwork in the scene and reported that mobile camera distance, horizontal look direction, and player centering were still wrong.
- The user was not asking about browser cache; do not answer by blaming cache.

Root cause found:
- The deployed project has more than one reachable HTML entry.
- Previous fixes were mostly in `index.html`.
- The tracked file `光照烘焙_輸出純遊玩模式_手機優化修正版.html` is also served by GitHub Pages and did not contain the latest artwork/mobile-control fixes.
- That large Chinese HTML has `EXPORTED_STATE = null` and loads scene state from IndexedDB key `state.v12.referenceArchitectureReliefGapPerformanceFixed`, so old local scene data can still contain `1-processed` / `asset_0014.png`.
- `galleryOUTPUT.html` exists locally but is ignored by Git and is not the pushed GitHub Pages source.

Latest commit pushed:
- `4e48524 Fix mobile gallery controls and forced artwork swap`
- Pushed to `origin/main`.

Files changed in latest commit:
- `index.html`
- `光照烘焙_輸出純遊玩模式_手機優化修正版.html`

What was implemented:
- Added `applyRequiredArtworkCorrections(state)` to both HTML entries.
- The correction runs after state load, not only in exported viewer mode.
- It removes any artwork matching:
  - title `1-processed`
  - `assets/asset_0014.png`
  - `assets/1-processed.png`
- It finds replacement artwork matching:
  - title `2-processed`
  - `assets/asset_0011.png`
  - `assets/2-processed.png`
- If both exist, it copies the removed artwork's placement fields onto the replacement:
  - `wall`, `offset`, `y`, `gap`, `position`, `rotation`, `manualRotation`, `snapToWall`
- Verified target placement is `position: {x:-8.14, y:3, z:-4.46}` and `rotation.y:-361.706...`.
- Mobile default camera distance is now `12`, including the non-exported Chinese entry.
- Mobile shoulder offset is `0`, camera height offset is `.82`, and follow lerp is faster on touch devices.
- Mobile obstruction fade was added to the Chinese entry as a temporary material clone on blocking room/reference/custom-wall meshes only.
- Mobile input in the Chinese entry was upgraded:
  - separate `mobileMoveKeys` from keyboard `keys`;
  - joystick touch/pointer handling no longer interferes with camera look;
  - single-finger look uses `applyTouchCameraLookDelta(dx, dy)` so horizontal direction matches the user request;
  - pinch zoom uses `zoomCameraByScale(d / pinchDistance)`;
  - joystick reset also listens on document/window touch end/cancel/blur.
- Added `window.__galleryDebugState()` and `window.render_game_to_text()` to the Chinese entry for future browser-state debugging.

Verification performed locally:
- Started local server at `http://127.0.0.1:8097/`, then stopped it.
- JS syntax check passed for:
  - `index.html`
  - `光照烘焙_輸出純遊玩模式_手機優化修正版.html`
- Browser/CDP checks with mobile emulation:
  - `index.html`: `removedCount: 0`, replacement `2-processed` at `(-8.14, 3, -4.46)`, `cameraDistance: 12`, actor FBX loaded.
  - Chinese entry with manually injected old IndexedDB state: `removedCount: 0`, replacement `2-processed` at `(-8.14, 3, -4.46)`, `cameraDistance: 12`, `yawDelta: +0.306` after rightward touch drag.
  - Chinese entry joystick test: pushing up set `effectiveMove.forward = 1`, `mobileMoveKeys.w = true`, and moved player `z` from `5.8` to `5.400832`.

Known notes for the next AI:
- Do not edit `galleryOUTPUT.html` expecting it to deploy; it is ignored and over 100 MB.
- If the user reports the same wrong artwork again, inspect which URL they opened first. The Chinese HTML and `index.html` both now include forced correction, but GitHub Pages propagation may take a short time after push.
- Be careful with `rg` on `index.html`; it contains a huge inline exported state and can flood the terminal.
- The latest fix deliberately does not reduce visual quality: no texture downscaling, no wall relief removal, no lighting downgrade.
- There are many existing Chrome processes on the machine; if Playwright becomes slow, use a fresh browser context and avoid waiting on heavy full asset loading unless the check needs it.

Current TODO:
- None known after commit `4e48524`.

## 2026-06-04 revert and mobile-control fix

- Reverted commit `1e79ce8` because it changed the visual feel of the gallery and made parts of the architecture look transparent.
- Kept the visual path narrow: no water transparency rewrite, no reference architecture relief removal, no player depth override.
- Found the mobile control failure was mostly performance/gating, not inverted joystick math:
  - DPR=1 mobile test: joystick up sets `effectiveMove.forward=1` and moves player from `z=5.8` to `z=-1.05`;
  - touch drag left/up changes yaw by `+0.272` and pitch by `+0.168`, matching left/up look.
- Added mobile-only runtime loading for `models/model_0004.mobile.glb`; desktop still loads the original `models/model_0004.glb`.
- Added player physics substeps so slow mobile frames no longer discard elapsed movement time.
- Added a retry path to the loading gate when `DefaultLoadingManager.onLoad` does not fire immediately.
- Capped only the mobile screen-FX render target to reduce DPR=3 post-processing pressure while keeping scene materials and geometry behavior intact.
- Verified:
  - mobile DPR=3 loads `models/model_0004.mobile.glb`, reaches `23/23`, has no console errors, and joystick movement works;
  - desktop loads `models/model_0004.glb`, actor FBX is loaded, proxy actor is hidden, and left-drag changes yaw from `0` to `0.442`.

## 2026-06-04 artwork swap and mobile camera/control fix

- Added an exported-viewer runtime correction that removes `assets/asset_0014.png` (`1-processed`) from `STATE.artworks` and moves `assets/asset_0011.png` (`2-processed`) to the removed artwork's position/rotation `(-8.14, 3, -4.46)` / `y=-361.706...`, while preserving the stone artwork's own size/material.
- Fixed a loading-gate edge case: if a late large asset updates `itemsLoaded` after `managerIdle=true`, `onProgress` now re-runs `maybeReleaseGalleryLoadingGate()`.
- Mobile camera changes are deliberately limited to exported touch devices:
  - default mobile camera distance is now `9.2` instead of `4.35`;
  - shoulder offset is `0` on mobile so the actor stays horizontally centered;
  - mobile camera follow lerp is faster to keep the actor from drifting away from center;
  - camera-obstructing room/reference/custom-wall meshes are temporarily faded using cloned per-mesh materials only on mobile, then restored.
- Mobile input changes:
  - touch horizontal look uses a mobile-only inverted yaw path, leaving desktop mouse look unchanged;
  - pinch zoom now uses distance ratio (`zoomCameraByScale`) and cancels active single-finger look while pinching;
  - joystick reset is also bound at `window` level for `touchend`/`touchcancel`/`blur` to avoid stuck movement.
- Verified with Playwright/CDP:
  - mobile DPR=1 loading releases with `cameraDistance=9.2`, `asset_0014.png` absent, and `asset_0011.png` at the requested position;
  - left swipe changes yaw from `0` to `-0.272`;
  - pinch out changes camera distance from `9.2` to `5.75`;
  - joystick forward sets `effectiveMove.forward=1` and moves the player; after touch end, `effectiveMove` returns to `0`;
  - player screen center after movement is effectively centered (`ndcX ~= 0`);
  - desktop route still loads original `models/model_0004.glb`, releases the loading gate, and does not include `asset_0014.png`.

TODO:
- None.

## 2026-06-05 documentation catch-up and audio/loading update

Current user request:
- Read the project Markdown, supplement missing records for user-edited content, change the loading page to English, hide every resource name/file name/path from loading, show only percentage plus `Loading asset X of Y.`, add water-movement and water-impact sounds, then push to GitHub Pages.

Unrecorded project state found after the last handoff notes:
- `index.html` is still the GitHub Pages entry point. `README.txt` confirms Pages root must contain `index.html`, `state.min.json`, `asset_manifest_full.json`, `assets/`, and `models/`.
- Several commits after `132e26c` changed `index.html` without updating this Markdown. Current runtime includes expanded mobile controls: joystick movement plus `T` take, `K` attack, and `J` jump buttons.
- Current runtime includes ARPG-style artwork interaction: `startTakeArtwork()`, `throwHeldArtwork()`, and `attackArtwork()` let the player pick up artwork, hold it in front of the camera, throw it, or kick it; thrown/kicked artworks use physics and can float on water.
- Current runtime includes water-body gameplay and editing support: water bodies have container/material settings, water-level/wave/caustic/motion-distortion/splash values, player wading/swimming state, ripples, foam rings, splash particles, and water container collision.
- Current runtime includes screen FX and lighting/shadow corrections that were not recorded before: `applyRequiredLightingAndShadowCorrections()` keeps smoke/dreamcore FX, disables flat ambient/hemisphere fill, disables stale baked light data, and tags `lightingDebugMarker = 20260605_disable_flat_environment_light_restore_smoke_fx_realtime_shadows`.
- Current runtime includes shadow-cache/light-bake controls that preserve current light/shadow shape in play mode while stopping shadow-map recalculation, plus forced shadow-map refresh before baking.
- Current mobile viewer state uses `models/model_0004.mobile.glb`, `VIEWER_MOBILE_CAMERA_DISTANCE = 7.2`, `MOBILE_VIEWER_START_POSE = {x:-1.6, y:0, z:1.95, yaw:0, pitchDeg:-10}`, and camera obstruction fade for blocking architecture/walls.
- Asset binaries `assets/22.png`, `assets/asset_0015.png`, and `assets/stone13.png` were updated after the previous notes.
- New sound files already existed in `sound/` for water walking, player water landing, and item water drop.

Changes made in this round:
- Loading gate visible text is now English-only and limited to:
  - percentage, e.g. `37%`;
  - `Loading asset X of Y.`
- Loading no longer displays resource names, file names, paths, current URLs, or failure file labels. The old detail/item UI is hidden or overwritten by the asset count line.
- Added a small runtime audio manager:
  - unlocks/prepares audio from first pointer, touch, or keyboard input;
  - cache-busts local sound URLs with the existing `ASSET_CACHE_VERSION`;
  - stops the looping walk sound when the viewer is not ready or the window blurs.
- Added sound triggers:
  - water walking loop plays while the player is moving inside water and not head-submerged;
  - player water-landing sound plays once when falling crosses the water surface;
  - artwork water-drop sound plays once when thrown/kicked artwork first touches water.

Verification so far:
- Extracted `index.html` module script, removed import lines, and parsed it with Node `new Function(...)`: passed.
- Loading DOM check at `http://127.0.0.1:8098/index.html?debugInput`: visible text was exactly two lines (`0%` and `Loading asset 0 of 1.`), with no `assets/`, `models/`, `sound/`, file extensions, or `ESC` hint.
- Static Playwright screenshot saved to `output/loading-static-check.png` and visually inspected: only percentage, progress bar, and `Loading asset 0 of 1.` are visible.
- Local HTTP checks for all three sound files returned `200`.

Current TODO:
- None after this change is pushed to `origin/main` for GitHub Pages.
