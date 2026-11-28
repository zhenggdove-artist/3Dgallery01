# GGTEMPLE repository instructions

Read this file before any code or asset changes, including work started in a new chat, Codex session, or another agent. The current main branch is the source of truth; do not rely on a previous conversation alone.

## Non-negotiable scope

- Preserve existing gameplay rules, stats, collision, authoritative networking, UI, controls, animation, materials, model detail, rendering quality and timing unless the user explicitly requests the specific change.
- Never trade lower visual quality, fewer effects, reduced update rates or slower input/damage feedback for performance. Find root causes and make the smallest independently reversible change.
- Inspect relevant dependencies and git diff. Run syntax, unit and applicable browser/Worker regressions. Do not describe an unmeasured performance gain as a benchmark or a commit as deployment.

## Mandatory common wearable production pipeline

The user calls head-slot items headwear, headgear, or HEAD. All future outfits and headwear MUST extend the existing pipeline, not establish a competing one.

1. Catalog: use src/reletter/outfit-catalog.js or src/reletter/headgear-catalog.js and src/shared/catalog.js. Preserve the existing shop, BAG, EQUIP, rarity/group, GM removal and ownership semantics. No visual-only catalog bypass.
2. Geometry and rig: use src/reletter/outfit-model.js (attachOutfit / buildOutfit / disposeOutfit) or src/reletter/headgear-model.js (createHeadgear / attachHeadgear / disposeHeadgear). Use the original anatomical attachment, scale, face opening and coordinate conventions. Distinct artistic designs are allowed; a unified pipeline does not mean identical appearances. Street props and dynamic surfaces extend street-outfits.js and street-outfit-motion.js. Matching hoods are nested headwear owners.
3. Lifecycle: all production models must be registered through registerWearable in src/shared-render-resources.js and released through releaseWearable / disposeWearableParts. Create standard materials using wearableMaterial or explicitly track specialized materials with their owner. Restore borrowed avatar geometry/material before releasing outfit-owned replacements. Never dispose borrowed skeleton/body/portrait clone assets as if they were owned. Nested headwear must be disposed via disposeHeadgear, not merely removed from the scene. Disposing twice must be harmless.
4. Immutable textures: use the existing SharedRenderResources singleton (acquireOutfitTexture / releaseOutfitTexture) for identical reusable pixels, with a stable namespaced key including every visual input and revision. Reference counting must keep resources alive until the final owner releases them. No separate global cache. Never share mutable per-player uniforms, geometry, live canvases, or animated state. Unique textures and pending async image loads belong to the wearable and must be canceled/released when destroyed. Retain staticPaintTexture's Apple-compatible lossless path.
5. Animation: extend animateOutfit / animateHeadgear via the existing presentation frame. Reuse scratch math objects, typed buffers and particle pools; allocate during creation, not every frame. No per-item RAF, interval, global listeners or background workers. Update only applicable active effects; preserve authored motion and timing.
6. Previews: use src/item-preview.js and the existing equipment portrait paths; do not create a separate renderer loop, downgrade image quality, or produce substitute icons. Cache PNGs by the existing visual key; invalidate only affected items when their portrait changes. Preview and ground-loot headwear must use the same disposal path as equipped headwear.
7. Memory diagnostics: src/render-residency.js is the common maintenance coordinator. Shared texture accounting and wearable owner counts feed its snapshot. New resources must use existing ownership/retirement conventions; no competing memory manager. Counts are diagnostic, not measured VRAM. Do not evict active assets or warmed reserves to meet an arbitrary cap.
8. Every new wearable needs tests covering catalog and actual model construction, finite geometry, attach/animate/unequip, repeated disposal, shared ownership, and applicable SHOP/BAG/EQUIP/ground-loot rendering. Add regression coverage for special effects. Validate on desktop and mobile/WebKit when possible. Update this contract and the existing helpers if a new resource type is necessary; do not silently bypass them.

## Mandatory common render asset pipeline (V149+)

Applies to every future wing, outfit, headwear, held weapon, projectile, skill, fused effect, shield, pickup and other reusable render object. Use one owner registry and one maintenance coordinator, not new per-item caches or independent loops. Preserve authored geometry, shaders, effects, collision and timing.

- Register standalone weapon and wing roots through registerRenderOwner (the same registry as registerWearable). Use acquireRootTexture for identical immutable pixels and stable namespaced visual keys. Never dispose a borrowed avatar/scene texture or geometry; use explicit ownership.
- Equipped models, SHOP/BAG previews and ground drops use the same factories and disposeOwnedVisual / owner-specific adapter. Native effects use manageNativeEffect, which retains the vendor disposer (including its private render targets) and releases instance buffers and owned skeletons once. Keep specialized animation and material behavior; unification is a lifecycle contract, not identical geometry.
- Use runtimeResource for live Object3D, material, texture and animation references in userData, so portrait clones cannot serialize them.
- Every idle VFX pool exposes idlePoolGroups to RenderMemoryManager; preserve existing prewarmed reserves, effect counts and active cadence. Record owner counts and pool memory. Test repeated actual WebGL allocate/draw/dispose and confirm shared resources survive until last release.

## Release verification

For runtime changes, update the visible release and import-map token in index.html, including any new first-party modules in the manifest. Run npm run check and npm test; use the existing GitHub Pages and Cloudflare deployment workflow. Verify the exact commit's Worker health and Pages deployment before claiming success; distinguish automated testing from real-device visual/profiling verification.
