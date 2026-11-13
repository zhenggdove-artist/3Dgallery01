# GGTemple artwork publishing

GM login → Shift+Y → UPLOAD ARTWORK → VALIDATE & PUBLISH.
Select the artwork, adjust its SURFACE controls, then SAVE DEFAULT.
Publishing stores the file and layout in GGTemple's persistent service. The
GitHub Pages client loads that shared library on entry; no GitHub token is
exposed in the browser.

Supported inputs:
- PNG / JPEG / WebP; alpha is retained. Images larger than 4096 px are resized.
- MP4 with a browser-supported codec (H.264 recommended), or WebM (VP9 recommended).
- GLB / glTF / FBX. Select external textures and BIN files together with the
  model. Missing dependencies are rejected before publishing. Models are
  converted to self-contained GLB; textures are capped at 2048 px.

Limits: 64 MB selected input, 32 MB prepared file, 500,000 triangles and 200
mesh objects per model, 4K video, 64 uploaded artworks, 256 MB total library.
Unsupported codecs, malformed files and models requiring unavailable glTF
extensions produce an error rather than a knowingly broken gallery entry.
Keep source originals; conversion is for web delivery.

PNG thickness follows the alpha silhouette (128-sample contour). Thickness,
brightness, contrast, saturation, black point and color tint are saved with
the layout. Model thickness is controlled with XYZ scale, not image extrusion.

Regression commands:
    npm test
    node tests/fidelity-browser.mjs
    node tests/artwork-formats-browser.mjs
    node tests/artwork-upload-browser.mjs
    node tests/vitals-browser.mjs

Browser tests use local static :8000 and Worker :8788. Upload tests create
test artworks only in that local database, never the production gallery.
