---
name: map-3d
description: >
  Invariants of the /map 3D war table in RS3 Equilibrium — WebGPU not WebGL, TSL not
  GLSL, the renderer WeakMap StrictMode trap, frameloop="demand" and the single
  MotionDriver heartbeat, the generated plate geometry and its build step, the fixed
  2-unit world frame, flush-at-rest sea level, the camera-never-tumbles ruling, and
  markers only for the framed region. Use before touching anything under src/map/,
  app/map/ or scripts/build-map-*.mjs, and before accepting any external plan that
  proposes changing the map's rendering stack.
---

# The 3D map

Everything below is already decided; a change that contradicts one of these is a
regression, not a refactor.

## Stack — settled, do not migrate

`three@0.185` + `@react-three/fiber@9`, importing from **`three/webgpu`**, rendering
through a **`WebGPURenderer`** with TSL node materials and MRT selective bloom
(`Effects.tsx`).

Any plan that opens with "migrate to Three.js" or proposes `WebGLRenderer`,
`EffectComposer`, `ShaderMaterial`, or GLSL chunks has misread the repo and is
describing a downgrade. Reject that part, keep the rest.

- **TSL, not GLSL.** Raw GLSL does not compile through the node pipeline. Three ships
  `mx_noise_float` / `mx_fractal_noise_float`; the materials use them. Never vendor a
  noise chunk.
- **`Node<"float">` from `three/webgpu`** is the type for a TSL expression. `float(1)`
  returns a narrower `VarNode` that will not accept one, so helper *parameters* must be
  typed `Node<"float">`, never `ReturnType<typeof float>`. `uniform()` loses its
  methods behind that alias too — close over the uniform instead of passing it.
- **`MeshBasicNodeMaterial` has no `emissiveNode`.** Anything that must reach the bloom
  pass uses `MeshStandardNodeMaterial` with a black `colorNode` and everything in
  `emissiveNode` — unlit in effect, and still in the emissive MRT target.
- **No WebGL fallback.** `MapScene` gates on a real adapter; absent one it renders
  `FlatBoard` plus the literal string `no WebGPU`, which e2e pins. Silent WebGL
  fallback is not acceptable — the honest unsupported state is the spec.
- Below 760px the 3D never mounts at all. `FlatBoard` is the planner there.

## The geometry is generated, not authored

The board's silhouette is the HD Wiki raster's own coastline. `npm run build:map`
(`scripts/build-map-terrain.mjs` + `build-poi-atlas.mjs`) reads
`public/map/world-surface-wiki.webp` and commits:

| Artifact | What it is |
|---|---|
| `public/map/region-plates.json` | per-region closed rings + seam polylines, in RuneScape surface coordinates |
| `public/map/terrain-field.webp` | RGBA data: R land coverage, G signed coast distance (0.5 = waterline), B inland water, A relief |
| `public/map/poi-atlas.webp` + `.json` | one sheet of real game icons, so a framed region's pins share one material |
| `scripts/.map-terrain-debug.png` | untracked partition render, for eyeballing |

The Wiki draws open water as **one flat colour** (`#7789A5`), which is why the
coastline is recoverable exactly rather than approximately. Region ownership is a
Euclidean partition seeded from the real place coordinates in `gameCoords.ts` plus the
supplemental hints in `data/map/region-seeds.json` — **never** hand-drawn polygons in
uv. An earlier set of authored uv rings survived a change of base raster and silently
landed in open ocean; that is the failure this replaced.

Two gates run inside the build and must stay green: plate rings scan-converted back
against their own mask (largest connected divergence under `MAX_DIVERGENCE`), and seam
parity. `src/map/data/plates.test.ts` re-checks the shipped artifact.

**Shared seams.** A border is a run of lattice edges simplified **once** from a
canonical key covering the whole path, so both neighbours carry byte-identical points
and plates cannot crack apart when one rises. Three rules keep that true, and all
three were bugs first:

- key on the *whole* path, not its endpoints — a ragged frontier can split into
  different runs on the two sides;
- check sharing *before* the closed-ring branch, or a run that returns to its own start
  takes a simplification the neighbour never sees;
- emit a seam only where both sides actually drew geometry, or debug would draw a
  border against a plate that was filtered out as a sliver.

Runs that cannot be reconciled ship unsimplified — denser, but identical.

## The renderer WeakMap

`MapScene.tsx` caches the renderer *promise* in a `WeakMap` keyed by canvas.

A ref cannot do this job: StrictMode's dev replay remounts on a fresh fiber, so a
second `WebGPURenderer` gets built over the same canvas, the second
`getContext('webgpu')` displaces the first, and you get a board that renders perfectly
and cannot be hovered or clicked — dev only, production always fine. If you are
debugging "the map draws but does not respond", start here.

## frameloop="demand" — one heartbeat

The loop sleeps unless something calls `invalidate()`. `MotionDriver` owns the only
timer: 30Hz, stopped by reduced motion, an offscreen canvas (IntersectionObserver) or a
hidden tab, and it advances the single shared `mapClock` in `materials/shared.ts`.
Everything else that animates — river flow, lock glow, marker gems — rides frames that
already happen and **must not** invalidate at rest. Do not add a second driver.

The throttle is a timer and not a frame accumulator. Accumulating delta inside
`useFrame` looks equivalent and is not: under demand the sea would be the only thing
keeping the sea awake, and the frame its own invalidate produced arrives one rAF later,
far short of 1/30, so the loop sleeps for good.

Transitions (lock, unlock sweep, plate raise, marker reveal) invalidate while moving
and stop when settled. `e2e/map-ocean.spec.ts` counts the ticks in both directions.

## World frame and sea level — fixed

`MAP_WORLD` is 2 units wide. Every uv anchor and the camera solve live in it and are
unit-tested there. **Never re-normalise it.** On-screen size is a function of canvas
pixels and the camera solve, not world units.

Sea level is `y = 0` and **at rest every coast meets it** — a plate's cap clears the
water by `REST_CLEARANCE` (currently `0.009`), which must stay greater than the
ocean's `SWELL` (`0.0014`) or waves wash over Gielinor. The margin also has to clear
depth-buffer fight against the swell under the overview camera. At rest the board has
to read as the actual RuneScape world map. Only the framed region rises (`FOCUS_LIFT`),
and that is the whole reveal; a sidelined region recedes through its material, never by
sinking. Seed each plate's `position.y` before the first paint (layout / first frame) —
do not ease from `0` on mount.

## Rivers — measured, and not yet solved

Do not start from "the inland-water channel must be broken". It is doing exactly
what it was written to do; the definition is wrong for this raster.

- **The Wiki paints rivers in the open-sea colour.** 97% of every bluish pixel on
  `world-surface-wiki.webp` is the one value `#7789a5`. There is no second colour
  to key a river off.
- **So the ocean flood runs up every river.** The Lum and the Salve are reachable
  from the frame edge, get classified as sea, and are cut out of the land mask.
  That means rivers already *are* channels through the plates — they are inlets in
  the outer ring, not holes.
- **Which is why the B channel is nearly empty.** It marks water the coastline
  encloses; almost nothing qualifies. Measured: 3.1% of land area, and 11 of 12
  real river probes read zero. The terrain shader's flow code is correct and is
  simply handed an empty mask.
- **Emitting hole rings does almost nothing** — one hole across all eleven regions,
  because enclosed water is rare. Tried, measured, reverted.
- **Width alone does not separate a river from a cove.** Requiring land on
  opposing banks within 7 tiles catches the Lum, the Salve and the Elid correctly
  *and* outlines most of the coastline, because a narrow bay satisfies it too.
  Tried at reach 11 and 7, rendered both, reverted.

Whatever finally works has to separate "long and thin" from "narrow opening to
the sea" — component shape, not local width. And since rivers are cut out rather
than painted, the flow belongs in the **ocean** material reading the field, not
in the terrain material.

## Materials

`positionWorld.xz -> map uv` (`mapUvFrom`) is the single geographic transform. Every
layer samples the raster and the field through it, which is what keeps Varrock on the
same pixel whether its plate is resting, raised or framed. Never derive terrain uv from
per-plate geometry uv.

Albedo is brightened **before** lighting (`ALBEDO_GAIN`): a lit surface returns roughly
albedo × irradiance, so feeding it the value you want back gives you something much
darker. That mistake is why an earlier board rendered near-black.

**Canvas is `flat` (NoToneMapping).** R3F's default ACES filmic crush midtones on LDR
wiki albedos under the sparse light rig — FlatBoard stayed bright, the 3D path went
muddy. Do not re-enable ACES without re-tuning gains and lights.

**Field texture has no mipmaps.** `asDataTexture` must stay `LinearFilter` only — trilinear
mips on coast-distance/inland-water channels crawl as shimmering bands under camera
motion. Albedo keeps mips; the data field does not.

**Cap materials use `polygonOffset`.** Neighbouring plates share byte-identical seams at
the same rest height; without a depth bias the caps z-fight.

`ExtrudeGeometry`'s bevel is added *outside* the requested depth, so a cap's real top is
`depth + bevelThickness`. Anything laid on a cap must clear it.

The sea is unlit and stylised. Its shading normal is deliberately steeper than its
mesh (`NORMAL_RELIEF` vs `SWELL`): a surface displaced two tiles over a two-unit board
is flat to within a degree, and a flat mirror turns the sun into one enormous blob
across half the ocean. Keep the specular gated by fresnel, and keep the noise warp high
frequency and low amplitude — a slow large warp marbles the whole sea into an oil slick.

**No border vine layer.** Locked regions are material-only (`TerrainMaterial` drain +
soft lock glow on the plate cutout). Do not reintroduce `BorderVines` / `VineMaterial`.
Seams remain for plate parity and MapDebug only.

## Camera — never tumbles

No free `OrbitControls` / unlimited sandbox. Every shot is still four spherical scalars
plus a target (azimuth, elevation, radius, look-at), damped toward a designed framing.
**Restricted mouse** is allowed inside hard clamps only:

- LMB drag: orbit (azimuth / elevation) with max offsets
- RMB / MMB / Shift+LMB: pan the look target on the board plane, clamped to map extents
- Wheel / UI ±: discrete zoom steps (`ZOOM_MIN`…`ZOOM_MAX`), never infinite dolly
- Elevation floor + max: never under the board, never straight-up spin lock
- Focus / place changes clear manual offsets so the designed shot wins again

Never a free cartesian fly-cam. Cartesian position lerps between shots are still banned
(they cut through Kandarin). Soft pointer parallax stays tiny and disables while dragging.

## Picking

R3F raycasts in NDC with fresh rects. Hit-testing bugs here are never stale
`getBoundingClientRect` — they are the pick set.

- **Decorative meshes opt out** with `raycast={() => null}` (marker stems and feet).
- **Invisible hit targets use `colorWrite: false`, never `visible={false}`** — three's
  raycaster skips invisible objects. A marker's hit plane is wider than the painted
  flag; the painted face itself does not take rays.
- Marker handlers must `stopPropagation()`, or the click falls through to the plate.
- **A board click focuses. It never mutates the build.** Picking a region is an explicit
  button, in `RegionPicker` and in the inspector header. A click that both framed and
  toggled meant every misaimed poke at a marker silently edited persisted state.
  `e2e/map-places.spec.ts` pins this.
- Anything the frame loop owns (`position.y`, `visible`, `scale`) must **not** also be a
  JSX prop — R3F reapplies the prop in the same commit that changes it, and the
  transition teleports instead of easing.

## Markers

Only for the region currently framed — eleven regions at once is noise on a 2-unit
board, and the region crests carry the overview. Site pins are a second tier that
arrives once a place is selected.

**Crest stakes, not screen billboards.** Each pin is a planted foot + shaft + flag
face with a **fixed world size** and a slight table-facing tilt — never
`quaternion.copy(camera)` and never CSS-pixel constant screen size. Soft transparent
medallions, contact shadows and per-pin `Html` labels were the flicker source under the
30Hz demand loop; do not reintroduce them.

- Face material: binary disc cut (`alphaTest` / `depthWrite: true`), atlas icon, thin
  brass rim; **emissive only when lit** (gem). Idle stakes write black emissive.
- Foot/stem: fully opaque. Hit proxy is a wider invisible plane (`colorWrite: false`).
- Pose matrices rewrite only on reveal spring, plate-Y spring, or lit change — not on
  every water tick.
- Names live on the ledger chips, not canvas DOM overlays.

Geometry is one face quad per pin (atlas cell in `uv`, hover/site in `aState`) plus
instanced feet/stems.

Anchors are hand-authored map coordinates in `gameCoords.ts` / `placeAnchors.ts` and
gated by tests: the name must resolve against real catalog data, and the point must land
inside its region's plate (two known offshore exceptions are named in `plates.test.ts`).
**Never fall back to a region centroid** for rows whose location is unknown; they go
unpinned and the inspector states `N of M pinned`.

## Dev flags

`src/map/mapQuality.ts`, query string only, no settings UI:
`?debugGeometry=1` (outlines, seams, anchors, ids over the raster), `?topDown=1`,
`?wireframe=1`, `?no=water,relief,markers,bloom`.
Prove geometry with `debugGeometry` before polishing anything.

## Accessibility surface

`RegionPicker` owns the route's keyboard and screen-reader surface, and every assertion
in `e2e/map.spec.ts`. Nothing inside the canvas is focusable and nothing there carries a
region's accessible name — a second match is a Playwright strict-mode failure. The
inspector's place chips are the keyboard route to every pin; do not build a third list.

Canvas-hosted `<Html>` chips are `aria-hidden` and `pointer-events: none`, always.

## Verifying

Headless Chromium has **no WebGPU adapter**, so every 3D assertion in the default
Playwright config takes its honest skip and the board goes unverified. Run
`npx playwright test -c playwright.webgpu.config.ts e2e/map-board.spec.ts` for the pass
that actually renders. Use Playwright for browser work in this repo — never the Claude
browser pane, and never leave a dev server running in the background.
