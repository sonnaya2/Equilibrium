# Map remaster R2 — WebGPU skins

CSS fixture mocks (R1) looked toy next to production. R2 ships one shared board:

- **Geometry:** production `REGION_SHAPES` / `smoothRing` / `SEAMS` / `MAP_WORLD` (1.31:1 frame)
- **Stack:** `three/webgpu` + R3F, same WeakMap renderer pattern as `/map`
- **Camera:** authored framings + aspect fit (larger on-screen regions; MAP_WORLD not re-normalized)
- **Vines:** `TubeGeometry` stems + instanced leaf cards on real seams
- **Water:** lit multi-swell `MeshStandardNodeMaterial`, 30Hz idle timer
- **Skins:** daylit / crystal / cartographer / boardsky / raised — light, lift, exposure, ocean, vine palette only
- **UI:** Board Sky DOM shell; pin → content/drops dossier (concept-labeled)

Production `/map` still unchanged until skin sign-off.
