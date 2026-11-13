# 00GameDevs weapon visuals

All normal attacks, charged attacks, charging and fusion accents now use
locally vendored 00GameDevs scene effects. Character poses, gun aiming,
damage, cooldowns and collision rules remain game-owned.

Source: https://00gamedevs.com/zh-TW/
License: MIT, retained in every source module.
Manifest: vendor/00gamedevs/manifest.json contains original URLs and SHA-256.
18 original downloads share an identical runtime; the vendoring script factors
that runtime once without changing its implementation or preset definitions.

Mappings are explicit in src/weapon-vfx.js: sword/whip sweeps and blade trails;
water/ice/arcane projectiles; cat-gun pulse and charged beams; lightning arcs;
fire fields; tidal/wind waves; thorn and astral bursts. Every catalog weapon
must have normal and charged mappings (enforced by tests).

Compatibility: source targets Three.js r187. These selected scene effects were
tested with this game's r160 WebGL renderer, avoiding an unrelated engine
upgrade or a second Three.js instance. No source-only custom postprocess hooks
are used. The existing VHS renderer remains in place.

Shaders warm before entry. Instances reset/replay from bounded pools, with
24 active entries maximum and up to two idle instances per effect. Repeated
melee swings extend the existing weapon trail instead of stacking trails.
Visual startup is advanced when an already-authorized shot fires, so library
wind-up does not delay a game's instant hit. Hit points come from server results.
Neither visual completion nor pool eviction applies damage.

Tests: npm test; node tests/weapon-vfx-browser.mjs;
node tests/reletter-complete.mjs. Screenshots and GPU console errors are checked,
including normal/charged stop, replay and cleanup. Low library load labels are
not treated as device-independent FPS guarantees.
