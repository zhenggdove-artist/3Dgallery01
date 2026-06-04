Original prompt: Debug the exported 3D gallery. Fix artwork asset/placement confusion, invisible smoke, too-fast look controls, mobile forward movement, and performance without reducing visual quality.

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
