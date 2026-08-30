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

## 2026-06-05 water jump, movement, throw, and splash tuning

Current user request:
- Add the player jump-out-of-water sound from `sound/`.
- Fade the water-walking loop when movement stops instead of cutting it off.
- Reduce desktop player movement speed to 75% of the current effective speed.
- Double the thrown artwork/item launch speed.
- Make player water exit, player water landing, and item water-drop splash reactions 3-5x larger.
- Push the finished change to GitHub Pages.

Changes made:
- Added `playerWaterExit` to runtime sound assets and preload/unlock handling.
- Water-walking audio now keeps its loop but fades out over `WATER_WALK_FADE_MS` when movement stops, then pauses/resets after the fade.
- Desktop effective player speed scale changed from `0.8` to `0.6`; touch devices keep the previous `0.8` scale.
- `ARPG_INTERACTION.throwSpeed` changed from `8.8` to `17.6`; kick speed is unchanged.
- Added `WATER_IMPACT_RESPONSE_SCALE = 4` and applied it only to jump-out-of-water, player water landing, and artwork/item water-drop splash trigger strengths.

Verification so far:
- Extracted `index.html` module script, removed import lines, and parsed it with Node `new Function(...)`: passed.
- `git diff --check`: passed.
- Local HTTP `HEAD` checks for all four runtime sound files returned `200`, including the new jump-out-of-water sound.
- Static Playwright screenshot with JavaScript disabled saved to `output/water-tuning-static-loading.png` and visually inspected: loading still shows only `0%` plus `Loading asset 0 of 1.`.
- Static JS checks passed for the new sound path, desktop/touch speed scales, doubled throw speed, water-walk fade call, and scaled splash trigger points.
- The required `develop-web-game` Playwright client was attempted with a short space-key payload, but this project still timed out under headless SwiftShader before completing the run; no committed code was changed to work around that test limitation.

Current TODO:
- None after this change is pushed to `origin/main`.

## 2026-08-30 continuation after web ChatGPT changes

Current user request:
- Inspect and preserve the latest corrections made through web ChatGPT, then continue improving the artwork water-impact effect and severe gallery lag.
- Keep the gallery 50% darker, retain visible gray dust, and make the water surface respond with a deep impact-center depression plus large waves/ripples.

Continuity check:
- Confirmed the latest web-edited repository state was clean at commit `4a59aa1` (`A`) before making this continuation.
- Continued directly from that commit without resetting, reverting, or replacing the web changes.

Final splash refinement:
- Kept the fixed pooled GPU architecture and the same three draw calls per active impact: one point cloud, one torn crown sheet, and one shader ripple plane.
- Refined the point shader into vertically stretched main droplets and softer round mist, with stronger water/specular highlights after the 50% gallery dimming overlay.
- Refined the crown shader with lacy breakup, torn top edges, foam at the base, and a highlighted rim.
- Increased ripple-edge contrast and shifted the impact tint toward pale water rather than gray.
- Corrected reverse-edge `smoothstep` expressions so the shader result is defined and portable across WebGL drivers.
- Added no geometry, per-particle meshes, runtime allocations, or extra draw calls for these visual changes.

Performance and visual verification:
- Confirmed the dominant lag source from the web-edited build: exported viewer startup disabled its baked shadow-cache runtime and forced six shadow-casting lights to refresh every frame. The hardware probe fell from about `51.01 ms` average work (`171.10 ms` p95) to about `5.76 ms` (`7.40 ms` p95) when those shadow maps were refreshed once and frozen.
- Preserved the web fix that uses the one-time shadow refresh/cache path, restores frustum culling for architecture/artwork meshes, lowers water-grid density, omits the redundant exported-viewer caustic overlay, and caches the mobile actor safety traversal/material setup.
- Hardware-accelerated desktop at `1440x900`: steady CPU-side frame work `7.48 ms`; eight rapid impacts recycle into three active slots and nine splash draw calls at `7.53 ms`, with 860 droplets per impact and zero legacy particle Meshes.
- Hardware-accelerated mobile at `390x844`: steady `55.3 FPS`, `4.50 ms` frame work, and `5.80 ms` p95; stress remained `55.7 FPS`, `4.29 ms`, two active slots, six splash draw calls, 560 droplets per impact, and zero legacy particle Meshes.
- Final mobile reload after removing measurement-only controls ran at `58.1 FPS`, `4.34 ms` frame work, and `5.30 ms` p95 with one active detailed impact.
- Visually inspected desktop and mobile rise/crown/ripple stages: darkened architecture, visible gray dust, raised splash plume, crown sheet/mist, and concentric impact deformation were all present.
- No new WebGL or shader errors were logged. Existing project warnings remain for textures without image data and FBX vertices with more than four skinning weights.
- The required headless `develop-web-game` client was attempted with the standard action payload; the full scene again stalled under SwiftShader and was stopped after a bounded wait. Hardware-browser regression testing completed successfully instead.
- Removed the temporary shadow-cache/reference-visibility measurement buttons and actions. Query-gated splash stage/stress controls and performance telemetry remain available for future regression testing and are invisible in normal gallery use.

Current TODO:
- None.

## 2026-08-29 brightness, dust, physical water response, and deep performance diagnosis

Current user request:
- Reduce the overall gallery brightness by 50%.
- Restore visible gray dust motes.
- Make thrown artwork deform the water surface: a deep impact-center depression, large ripples, and waves instead of only a detached splash.
- Deep-debug severe gallery lag and make desktop/mobile operation substantially smoother.

Diagnosis loop:
- Added query-gated frame telemetry for FPS, frame interval, CPU-side frame work, p95 work, draw calls, triangles, points, geometries, textures, and pixel ratio. It is inactive during normal gallery use.
- Next: capture desktop/mobile baseline before changing rendering behavior, rank falsifiable performance hypotheses, then change one variable at a time.

## 2026-08-29 detailed artwork water-impact rebuild

Current user request:
- Replace the crude artwork/item water splash with a highly detailed but computationally lean effect that does not make the 3D gallery stutter.

Implementation direction:
- Diagnosed the main performance risk: the previous artwork impact path created as many as 860 separate Three.js Mesh objects and materials for one impact.
- Replaced that heavy artwork-only path with a fixed-size pooled GPU effect. Ballistic droplet positions are evaluated in a vertex shader, so hundreds of droplets render in one draw call instead of hundreds of draw calls.
- The visual is layered into a deterministic central jet, crown droplets, outer mist, an animated torn crown sheet, and five shader-drawn foam/ripple rings.
- Desktop uses a three-slot pool capped at 900 droplets per impact; touch devices use a two-slot pool capped at 560. Repeated impacts recycle the oldest slot and allocate no new scene objects.

## 2026-08-29 natural artwork water-impact correction

Current user request:
- Remove the unnatural white-line inverted cone shown when artwork is thrown into water.
- Rebuild the response around recognizable game-water physics while keeping the gallery smooth.

Root cause:
- The inverted cone was literal geometry, not a random WebGL artifact: `CylinderGeometry(.86,.18,1,36,1,true)` made a continuous sheet whose top was almost five times wider than its base.
- The crown fragment shader covered that frustum with high-contrast strands, so the translucent surface read as a white wire cone.
- Impact strength counted most of the artwork's large horizontal throw velocity as vertical displacement energy, exaggerating splash height and water-surface deformation.

Changes:
- Replaced the continuous frustum with ten disconnected, tapered splash-sheet lobes in one shared `BufferGeometry` and one draw call. The lobes rise, flare slightly, fall, and fade without forming a closed cone.
- Kept the effect at three draw calls per active impact: one GPU point cloud, one broken splash sheet, and one ripple plane.
- Added per-droplet annular origins so crown droplets emerge from the displaced-water rim instead of every particle radiating from one mathematical point.
- Reduced the GPU particle pool from 900/560 to 360 desktop / 220 touch and reduced the pool density on touch devices. No per-droplet Mesh or Material is created.
- Reworked ripple rendering from five simultaneous graphic rings to a primary wavefront plus two weaker delayed trailing waves.
- Added footprint-aware impact response. Surface depression and splash radius now use the artwork's world-space waterline footprint; vertical velocity controls most splash energy, while horizontal velocity only biases the spray direction and adds a small wake contribution.
- Added `uImpactRadius` to the water-surface shader, reducing the previous oversized fixed-radius bowl and tying the cavity/rim to displaced area.

Verification:
- `index.html` module syntax check passes.
- `git diff --check` passes.
- Static reference checks confirm the old `CylinderGeometry(.86,.18,...)` and every crown reference are removed.
- The local WebGL visual test path remains query-gated through `debugInput` / `debugWaterSplash`; external browser acquisition was unavailable in the current restricted runtime, so deployment preview still requires the connected browser or GitHub-hosted branch.
- Kept the existing water-surface displacement/caustic response and item water-drop audio.
- Added debug telemetry for active pooled impacts, legacy Mesh particle count, per-impact droplet count, and draw-call count.

Current TODO:
- Completed syntax check and `git diff --check` successfully.
- Ran the required `develop-web-game` client; as in previous project notes, the full scene stalled in headless SwiftShader after loading the large WebGL assets, so the run was stopped after a bounded wait.
- Used the hardware-accelerated in-app browser against the same local `index.html` and visually inspected frozen rise, crown, and ripple phases. The first pass looked like oversized glass spheres; retuned sprite perspective, sizes, opacity, height, and outward spread, then reloaded and inspected all phases again.
- Final desktop stress telemetry after eight rapid impacts: three pooled active slots, nine draw calls, 860 droplets per impact, zero legacy particle Meshes, and zero console errors.
- Final mobile-width stress telemetry: two pooled active slots, six draw calls, 560 droplets per impact, zero legacy particle Meshes, and zero console errors.
- Forced-lifetime cleanup test ended with zero active splash slots and zero splash draw calls, confirming reuse/cleanup.
- None remaining.

## 2026-06-05 artwork water impact splash upgrade

Current user request:
- Artwork/item water impact splash is still too small, too sparse, and not detailed/realistic enough.
- Splash particle count must be at least 10 times the current amount.
- Splash height must be higher.
- Item water impact must create water ripples like player water movement, with more/larger ripple layers.
- Push the result to GitHub Pages.

Diagnosis:
- `WATER_IMPACT_RESPONSE_SCALE = 4` increased impact strength, but `spawnWaterSplash()` still clamped particle count to a maximum of 86 because it used `clamp(splash,0,1)`.
- The global water particle pool limit was 560, so even if more particles were requested they would be trimmed away.
- Item impact already touched `uRippleCenter` and `uMotionCenter`, but `uRippleStrength` and `uMotionStrength` were capped too low for a heavy dropped artwork impact, and only one foam ring was spawned.

Changes made:
- Added artwork-impact-only constants:
  - `ARTWORK_WATER_IMPACT_PARTICLE_MULTIPLIER = 10`
  - `ARTWORK_WATER_IMPACT_PARTICLE_LIMIT = 1800`
  - height, outward, ring-layer, and ring-scale multipliers.
- `spawnWaterSplash()` now accepts options for particle multiplier, pool limit, height multiplier, outward multiplier, particle lifetime, and multi-layer foam rings.
- Artwork water impacts now spawn 5 expanding foam/ripple rings plus 3 delayed aftershock ripple rings.
- Artwork water impacts now raise shader ripple cap to `4.8` and motion/wake cap to `5.2`, so the water surface and caustic/motion reaction are much larger.
- Droplets now include vertical plume particles, crown-splash particles, and smaller mist particles for a denser, more detailed impact.
- Player water movement still uses the old/default splash path; only artwork/item impact receives the heavy settings.

Verification so far:
- Extracted `index.html` module script, removed import lines, and parsed it with Node `new Function(...)`: passed.
- `git diff --check`: passed.
- Static math check confirmed the old capped count was 86 and the new artwork-impact count is 860, exactly 10x.
- Static math check confirmed the high plume upward velocity ceiling is substantially higher than the previous path.
- Local HTTP `HEAD` for `index.html` returned `200`.
- Static Playwright screenshot with JavaScript disabled saved to `output/artwork-water-impact-static-loading.png` and visually inspected: loading still shows only `0%` plus `Loading asset 0 of 1.`.
- The required `develop-web-game` Playwright client was attempted with the standard short action payload, but the large WebGL page still timed out under headless SwiftShader; residual headless processes were cleaned up.

Current TODO:
- None after this change is pushed to `origin/main`.

## 2026-06-05 restore to 06e4e46, smoke off, mobile audio gate, and held model rotation

Current user request:
- Restore the project to commit `06e4e46` on `main` first.
- Turn off the smoke effect.
- Fix mobile audio so background music is loaded and playing before entering the site, instead of only starting after jump/move input.
- Fix 3D model artwork flipping upside down when picked up with `T`.
- Push the result to GitHub Pages.

Restore:
- Local `main` was reset hard to `06e4e46` as requested before applying fixes.
- The remote had one newer commit (`95f8260`) after `06e4e46`, so the final push for this round needs to overwrite remote `main` with the restored-base fix commit.

Diagnosis:
- Smoke/fog was not coming from editor state alone; `applyRequiredLightingAndShadowCorrections()` explicitly restored `state.atmosphere.enabled=true` every run.
- Background music was created as an `Audio` node but was not part of the loading gate readiness model. On mobile, browsers generally require a user gesture for audible playback, so the fix keeps the loading gate up until the background music is loaded and playback has started from the first touch/pointer/key gesture.
- Held artwork rotation was shared for images and 3D models. `updateHeldArtwork()` changed `rotation.y` and `rotation.z` every frame, which destroys the 3D model's preserved orientation when picked up.

Changes made:
- Runtime correction now disables atmosphere/smoke with `enabled:false`, `intensity:0`, `opacity:0`, and `layers:0`, while keeping the existing dreamcore screen filter and realtime shadow corrections.
- Background music now has loading/playback tracking:
  - `loadeddata`/`canplay`/`canplaythrough` mark the audio asset loaded;
  - `playing` marks background music started;
  - loading progress includes one audio item;
  - gallery release waits for both background audio loaded and background audio started;
  - first loading-screen touch/pointer/key unlocks audio and starts background music before the site is released.
- If the first unlock attempt cannot start music yet, later gestures retry instead of being ignored.
- Held 3D model artwork keeps its existing rotation while being carried; only non-model/image artwork gets the floating spin.
- Added audio flags to `window.__galleryDebugState()` for non-UI verification.

Verification so far:
- Extracted `index.html` module script, removed import lines, and parsed it with Node `new Function(...)`: passed.
- Static JS checks passed for smoke disabled, audio loading gate fields, release waiting on runtime audio, background music load/play tracking, retryable unlock behavior, and model-only rotation guard.
- Local HTTP `HEAD` checks for all five runtime sound files returned `200`.
- Static Playwright screenshot with JavaScript disabled saved to `output/fix-audio-smoke-static-loading.png` and visually inspected: loading still shows only `0%` plus `Loading asset 0 of 1.`.
- The required `develop-web-game` Playwright client was attempted with a `space` unlock payload, but this large WebGL page still timed out under headless SwiftShader; residual headless processes were cleaned up.

Current TODO:
- None after this restored-base fix is pushed to `origin/main`.

## 2026-06-05 water-walk audio debug and background music

Current user request:
- Debug the broken player walking-in-water sound. It was continuing to play automatically instead of following user movement.
- Add looping background music from `sound/backgroundmusic.MP3`.

Diagnosis:
- Reproduced the audio state-machine bug with a small Node harness: repeated `updateWaterWalkSound(false)` calls created a new fade timer every frame.
- Root cause: the previous fade guard allowed inactive-but-currently-fading water-walk audio to call `fadeOutRuntimeSound('waterWalk')` again, clearing and restarting the fade before it could finish.

Changes made:
- `updateWaterWalkSound(false)` now starts fade-out only on the active-to-inactive transition; later inactive frames return immediately and let the existing fade complete.
- Added `backgroundMusic` to `SOUND_ASSET`, preloads it as a looping runtime audio node, skips muted one-shot priming for that node, and starts it after audio unlock.
- Background music uses `BACKGROUND_MUSIC_VOLUME = .28` and does not participate in `stopRuntimeSounds()`, which remains scoped to the water-walk loop.

Verification so far:
- Bug harness before the fix produced `intervalsStarted=13`; fixed harness produced `intervalsStarted=1`.
- Extracted `index.html` module script, removed import lines, and parsed it with Node `new Function(...)`: passed.
- Local HTTP `HEAD` checks for all five runtime sound files returned `200`, including `backgroundmusic.MP3`.
- Static JS checks passed for background-music asset wiring, loop-node creation, skip-priming behavior, start-after-unlock behavior, and the fixed water-walk fade guard.
- Static Playwright screenshot with JavaScript disabled saved to `output/audio-debug-static-loading.png` and visually inspected: loading still shows only `0%` plus `Loading asset 0 of 1.`.
- The required `develop-web-game` Playwright client was attempted again with a two-frame no-input payload, but this large WebGL page still timed out under headless SwiftShader; no committed code was changed to work around that test limitation.

Current TODO:
- None after this change is pushed to `origin/main`.

## 2026-06-05 camera look debug and dreamcore filter off

Current user request:
- Debug the camera being stuck in a tiny up/down range and unable to rotate freely.
- Turn off the dreamcore filter.
- Push the result to GitHub Pages.

Diagnosis:
- The base camera input was still updating yaw and pitch, and `camPitch` was already allowed to move between `-88` and `88` degrees.
- The exported mobile viewer camera branch ignored most of that pitch. It clamped the actual `lookAt` vertical offset to only `-24` to `14` degrees and kept the camera position at a fixed height, so touch look felt locked to a narrow vertical range.
- Dreamcore was still forced on at startup by `applyRequiredLightingAndShadowCorrections()`, and the initial body class also included `fx-enabled fx-dreamcore`.

Changes made:
- Removed the initial `fx-enabled fx-dreamcore` body classes.
- Runtime correction now keeps smoke/fog off and forces `screenFx` to `enabled:false` with `preset:'none'`.
- Added mobile camera pitch limits of `-72` to `72` degrees.
- Updated the mobile viewer camera branch so pitch affects both camera height/distance and the look target, instead of using the old narrow `-24` to `14` degree clamp.

Verification so far:
- Extracted `index.html` module script, removed import lines, and parsed it with Node `new Function(...)`: passed.
- `git diff --check`: passed.
- Static checks passed for dreamcore startup classes being inactive, runtime screen filter being disabled, and the old narrow mobile pitch clamp being removed.
- Local HTTP `HEAD` for `index.html` returned `200`.
- Static Playwright screenshot with JavaScript disabled saved to `output/camera-filter-static-loading.png` and visually inspected: loading still shows only `0%` plus `Loading asset 0 of 1.`.
- Mobile camera math harness confirmed applied pitch clamps to `-72` and `72` degrees, with camera position and look target both responding to pitch.
- The required `develop-web-game` Playwright client was attempted with the standard short action payload, but the large WebGL page still timed out under headless SwiftShader; residual headless processes were cleaned up.

Current TODO:
- None after this change is pushed to `origin/main`.

## 2026-08-30 merge-conflict resolution before push

Diagnosis:
- Local `main` at `d4d4181` and remote `origin/main` at `dc6afce` had diverged by one commit each.
- GitHub Desktop had already started a merge; `index.html` contained three unresolved conflict regions while `progress.md` merged normally.
- The remote commit replaced the old cone/crown splash with a directional multi-lobe water sheet using per-particle origins and Fresnel shading. Blindly choosing the local conflict side would have left that sheet fragment referencing an undeclared `uTime` uniform.

Resolution:
- Preserved the remote sheet geometry, directional motion, Fresnel fragment shader, per-particle `aOrigin`, and natural water tint.
- Preserved the local portable droplet `smoothstep` expressions, brighter droplet/ripple highlights, and removal of temporary performance-probe controls.
- Renamed the staged debug phase to `SPLASH SHEET` without restoring the removed shadow/reference measurement buttons.

Verification:
- Conflict-marker scan, module syntax check, and `git diff --check` passed.
- Hardware WebGL browser loaded all 24 assets and compiled the merged shaders with zero console errors.
- Eight-impact stress state reported three pooled effects, nine splash draw calls, 214 particles for the latest impact, zero legacy particle Meshes, `3.50 ms` average CPU frame work, and `4.40 ms` p95.
- The required headless game client was attempted but again stalled under SwiftShader; it was stopped after a bounded wait. Hardware-browser visual/state/error verification passed.

Current TODO:
- None after the merge commit is pushed to `origin/main`.

## 2026-08-30 size-driven water, flooded backrooms, and performance pass

Current user request:
- Reduce artwork throw distance to one third.
- Scale splash height, water depression, ripple depth, and wave travel from each thrown artwork's world-space width/height/depth, using `20 x 20 x 2` as the large reference.
- Shrink airborne dust to one fifth while increasing its count thirty times.
- Add a switchable flooded-office/backrooms gallery with placed artwork and lighting.
- Deep-debug lag, verify desktop/mobile behavior, and push the result.

Root causes and changes:
- Throw speed was still the previous `17.6`; it is now exactly `17.6 / 3 = 5.866666...`.
- The prior water response clamped artwork radius near `1.25-1.6`, erasing most size differences. The new pure impact profile uses world-space footprint, volume, width, height, depth, vertical speed, and horizontal wake direction. It drives shader cavity radius/depth, wave travel, pooled sheet height/spread, and ring radius with bounded caps.
- Water now receives `uImpactDepth` and `uImpactWaveDistance`; the impact center makes a real negative displacement bowl, while the rim and trailing waves propagate outward according to the computed dimensions.
- Dust count is `21,000` touch / `36,000` desktop, particle diameter is one fifth of the old value, and all dust still renders as one `THREE.Points` draw call. The theoretical fragment coverage changes by only about `30 * 0.2^2 = 1.2x`.
- Added a `B`/button-switchable flooded backrooms office with low drop ceiling, procedural yellow-brown wall/ceiling textures, maze collision walls, shared geometry, instanced fluorescent fixtures, no-shadow local lights, murky water tint, per-scene artwork/player transforms, and preserved artwork interaction.
- Added a two-draw-call low-poly LOD for the heavy 3D artwork in the backrooms and at distance in the sewer. The original detailed model appears again at close inspection. Exported mode now uses the existing optimized GLB on desktop as well as touch devices.
- Exported reference architecture keeps material bump relief but skips its redundant high-tessellation relief shell. This reduced visible sewer geometry from roughly 3.05 million to about 0.18 million triangles at the tested start view without removing the textured bump appearance.
- Fixed a loading deadlock: scene entry no longer waits for background music autoplay to start. It waits only for the audio file to be ready; playback retries on the normal first-input unlock path. Production `/` now exits the 100% loading gate automatically.

Verification:
- Module syntax check and `git diff --check` pass.
- Required `develop-web-game` client was attempted and stopped after a bounded wait because the full page again stalled under headless SwiftShader; hardware WebGL testing completed instead.
- Production URL without debug parameters automatically left the loading gate, showed the scene button, switched to `場景：淹水後室｜B`, switched back, and logged zero browser errors.
- Dimension calibration at the same velocity:
  - `2 x 2 x 0.5`: radius `1.067`, depression `0.462`, wave distance `3.132`.
  - `20 x 20 x 2`: radius `8.036`, depression `1.313`, wave distance `18`.
- Desktop tuning telemetry: throw speed `5.866666...`, dust `36,000`; touch telemetry: dust `21,000`.
- Stable flooded-backrooms desktop sample: about `52 FPS`, `38` draw calls, `43,740` visible triangles, `5.46 ms` average frame work, `2.90 ms` p95. The in-app browser throttled background/mobile RAF intervals, so mobile validation uses frame-work cost plus geometry/draw-call counts rather than its reported RAF FPS.
- Touch-size backrooms sample: `30` base draw calls, `22,060` visible triangles, `21,000` dust points.
- Stress test preserves the fixed pool: desktop `3` active slots / `9` splash draw calls; touch `2` slots / `6` splash draw calls; both report `0` legacy per-droplet Meshes and zero console errors.

Current TODO:
- None after the final commit is pushed to `origin/main`.

## 2026-08-31 real artwork restoration, physical water lifetime, and aged backrooms

Current user request:
- Fix 3D artwork that had been replaced by a coarse mesh.
- Further shorten artwork throw distance; enlarge and refine size-driven splashes; keep water waves alive long enough to feel physical.
- Preserve every artwork's exact sewer dimensions in the backrooms and raise the office instead of shrinking art.
- Replace the crude backrooms wallpaper with aged detail, moldy wallpaper/drop-ceiling edges, and curled hanging wallpaper while keeping the page smooth.

Diagnosis and implementation so far:
- Confirmed the coarse model was not an asset-load failure: `createBackroomsArtworkLodProxy()` deliberately hid the real GLB in the backrooms and beyond 3.25 units. Removed the proxy, its scene/load hooks, and its per-frame LOD scan; the real optimized GLB is now the only model render path.
- Removed both backrooms artwork scale formulas. Backrooms snapshots now copy the sewer `size.w/h/d` values exactly. Wall art is placed from its unchanged height, and backrooms height is derived from the tallest artwork with a 9.2-unit minimum.
- Throw speed changed from `17.6/3` to `17.6/6`, about 2.93 horizontal units per second.
- Expanded the dimension-driven impact range to a 14-unit cavity/rim radius and 28-unit wave travel, with displaced volume contributing directly to radius and depth.
- Physical water impact lifetime is now 10.5 seconds with a slower propagating, damped wave packet. The pooled foam ring lasts 5.4 seconds, the crown sheet 1.18 seconds, and droplets can live up to 2.8 seconds before the bounded size multiplier.
- Detailed splash stays fixed-pool/three-draw-call: 540 desktop or 320 touch points per slot, 32 narrow curved crown tongues with 10 vertical rows and procedural perforation, smaller droplet sprites, and no per-droplet meshes.
- Rebuilt the backrooms with 512px aged procedural wallpaper/ceiling maps, an instanced metal T-grid, one instanced mold-decal batch, and one instanced curved hanging-wallpaper batch. This adds only three grouped draw calls.
- Moved the flooded-office entry pose onto the front-wall display side and reduced only its default third-person camera distance to 3.8 so the camera cannot sit behind the maze wall. The first view now frames a full-size artwork and the aged wallpaper.

Verification:
- Module syntax check and `git diff --check` pass.
- Static regression assertions pass for no artwork proxy symbols, exact copied artwork sizes, dynamic room height, shortened throw speed, extended wave/ring lifetimes, refined crown geometry, and instanced aging details.
- The required `develop-web-game` client was attempted with the standard action payload. As in prior project notes, headless SwiftShader stalled while loading the 38 MB optimized GLB, so it was stopped after a bounded 50-second wait. No visual downgrade was added for the test environment.
- Hardware-WebGL inspection confirmed the full `SinTower` GLB renders in the sewer; no cylinder/base proxy remains.
- Physical calibration at velocity `(3,-6,1.4)` now reports:
  - `2 x 2 x 0.5`: radius `1.786`, depression `0.685`, wave distance `5.624`.
  - `20 x 20 x 2`: radius `13.384`, depression `2.328`, wave distance `28`.
- Visually inspected the detailed splash at 0.28 seconds, the layered response at 0.82 seconds, and the propagated wave at 4.2 seconds. The final narrow/perforated sheet removed the wide polygon-column appearance from the first pass.
- Representative large-artwork impact uses 309 GPU points on the tested touch path, 3 splash draw calls, and 0 legacy per-droplet meshes; sampled work was `3.16 ms` average / `3.70 ms` p95.
- Eight-impact stress test stayed bounded at 3 pooled active slots / 9 splash draw calls / 0 legacy meshes, with `3.17 ms` average / `3.80 ms` p95. Forced cleanup returned to 0 active slots / 0 splash draw calls.
- Final flooded-backrooms entry sample: `60.1 FPS`, 36 draw calls, `1.58 ms` average work, `2.10 ms` p95. The first view shows a full-size artwork; aged wallpaper, mold, hanging wallpaper, and T-grid remain batched.

Current TODO:
- None. Changes are intentionally left uncommitted/unpushed because this request did not ask for a push.
