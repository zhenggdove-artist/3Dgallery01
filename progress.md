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

## 2026-06-04 follow-up

- Added a mobile-only runtime GLB for the largest artwork model (`models/model_0004.mobile.glb`). Desktop still loads the original `models/model_0004.glb`.
- Fixed the low-FPS movement bug by letting player physics catch up in small substeps instead of discarding elapsed time when mobile frames are slow.
- Swapped the exported placement data for `2-processed` / `assets/asset_0011.png` and `1-processed` / `assets/asset_0014.png`.
- Cleaned touch-event cancellation so mobile browsers no longer spam non-cancelable `touchmove` errors.
- Verified with Playwright/CDP:
  - mobile loads `models/model_0004.mobile.glb`, keeps WebGL context alive, and releases the loading gate at `23/23`;
  - mobile joystick holds `w=true` and moves player from `z=5.8` to `z=-3.99`;
  - mobile touch look changes yaw from `0` to `0.306`;
  - mobile placement has `2-processed` at `(-8.14, 3, -4.46)` and `1-processed` at `(-11.24, 3.2, -1.82)`;
  - desktop still loads `models/model_0004.glb`, keeps SinTower at `1,999,908` triangles, and left-drag look changes yaw from `0` to `0.442`.
