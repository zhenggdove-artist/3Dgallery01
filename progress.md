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
