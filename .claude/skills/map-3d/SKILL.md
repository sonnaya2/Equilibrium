---
name: map-3d
description: >
  Invariants of the /map 3D war table in RS3 Equilibrium — WebGPU not WebGL, TSL not
  GLSL, the renderer WeakMap StrictMode trap, frameloop="demand" invalidate discipline,
  the fixed 2-unit world frame, shared border-node seams, the camera-never-tumbles
  ruling, the explicit pick set, and markers-only-for-the-framed-region. Use before
  touching anything under src/map/ or app/map/, and before accepting any external plan
  that proposes changing the map's rendering stack.
---

# The 3D map

Fourteen files under `src/map/`. Everything below is already decided; a change that
contradicts one of these is a regression, not a refactor.

## Stack — settled, do not migrate

`three@0.185` + `@react-three/fiber@9`, importing from **`three/webgpu`**, rendering
through a **`WebGPURenderer`** with TSL node materials and MRT selective bloom
(`Effects.tsx`).

Any plan that opens with "migrate to Three.js" or proposes `WebGLRenderer`,
`EffectComposer`, `ShaderMaterial`, or GLSL chunks has misread the repo and is
describing a downgrade. Reject that part, keep the rest.

- **TSL, not GLSL.** Raw GLSL does not compile through the node pipeline. Three ships
  `mx_noise_float` / `mx_fractal_noise_float`; `slabMaterials.ts` and `vineOverlay.ts`
  use them. Never vendor a noise chunk.
- **No WebGL fallback.** `MapScene` gates on a real adapter; absent one it renders
  `FlatBoard` plus the literal string `no WebGPU`, which e2e pins. Silent WebGL
  fallback is not acceptable — the honest unsupported state is the spec.
- Below 760px the 3D never mounts at all. `FlatBoard` is the planner there.

## The renderer WeakMap

`MapScene.tsx` caches the renderer *promise* in a `WeakMap` keyed by canvas.

A ref cannot do this job: StrictMode's dev replay remounts on a fresh fiber, so a
second `WebGPURenderer` gets built over the same canvas, the second
`getContext('webgpu')` displaces the first, and you get a board that renders
perfectly and cannot be hovered or clicked — dev only, production always fine.
If you are debugging "the map draws but does not respond", start here.

## frameloop="demand"

The loop sleeps unless something calls `invalidate()`. Two consequences:

- Any store change that affects the scene must invalidate, or a stale frame stays on
  screen. `InvalidateOnBuild` does this for build mutations.
- **A material that animates must not invalidate at rest.** `Ocean` is the only thing
  driving idle frames: 30Hz, gated by `IntersectionObserver` and reduced motion.
  `vineOverlay` advances its clock inside `RegionSlab`'s existing `useFrame` and
  deliberately does *not* invalidate — it rides frames that already happen and freezes
  when the ocean freezes. Copy that pattern; do not add a second idle driver.

Transitions (lock, unlock sweep, vine growth, slab raise) invalidate while moving and
stop when settled.

## World frame — fixed

`MAP_WORLD` is 2 units wide. Every uv anchor, every border node and all eleven authored
framings live in it and are unit-tested there. **Never re-normalise it.** On-screen size
is a function of canvas pixels and the camera solve, not world units — `CameraRig`
solves radius from the live aspect. If a board looks small, the fix is in the CSS box or
the fit maths, never in `MAP_WORLD`.

`FitProbe.tsx` (dev only, tree-shaken in production) exposes `window.__mapFitProbe()`,
which projects each region's ring through the live camera and reports CSS-pixel widths.
Measure with it rather than asserting.

## Geometry — shared border nodes

Regions index into `BORDER_NODES` rather than carrying their own coordinates, so an
interior seam is literally the same two nodes in both neighbours and slabs cannot drift
or z-fight along a shared edge. `regionShapes.test.ts` holds that invariant. There is no
SVG anywhere; `SVGLoader` / earcut advice does not apply.

`ExtrudeGeometry`'s bevel is added *outside* the requested depth, so a cap's real top is
`depth + bevelThickness`. Anything laid on a cap must clear it.

Materials read the lattice and the vines from `positionWorld.xz`, not per-slab uv — that
is what makes two locked neighbours share one continuous overlay. Write positive modulo
by hand (`p.sub(span.mul(p.div(span).floor()))`); WGSL's `%` keeps the dividend's sign
and tears at x=0/z=0, which is the board's own centre.

## Camera — never tumbles

No `OrbitControls`, no `MapControls`, no free pan/zoom, no orthographic top-down. Every
shot is an authored `Framing` and moves are a damped lerp of the four spherical scalars
plus target and fov — never a cartesian position lerp, which cuts through the board on
long moves. Selecting a place reuses its region's framing with the target swapped and
radius ×0.6; it does not introduce a new camera path.

## Picking

R3F raycasts in NDC with fresh rects. Hit-testing bugs here are never stale
`getBoundingClientRect` — they are the pick set.

- **Decorative meshes opt out** with `raycast={() => null}` (barrier lattice, vines,
  crest decal, marker ring and dot).
- **Invisible hit targets use `colorWrite: false`, never `visible={false}`** — three's
  raycaster skips invisible objects, so the obvious spelling produces something that
  cannot be clicked. `PlaceMarkers`' pick disc is the example.
- Marker handlers must `stopPropagation()`, or the click falls through to the slab.
- **A board click focuses. It never mutates the build.** Picking a region is an explicit
  button, in `RegionLedger` and in the inspector header. A click that both framed and
  toggled meant every misaimed poke at a marker silently edited persisted state.

## Markers

Only for the region currently framed — eleven regions at once is noise on a 2-unit
board. Geometries are shared and memoised per region; inline `<ringGeometry>` props
rebuild one geometry per marker per hover.

Anchors are hand-authored map-uv in `data/placeAnchors.ts` and gated by
`placeAnchors.test.ts`: the name must resolve against real catalog data (an `areas`
entry, or — for `site: true` — some content/upgrade row), and the point must land inside
its region ring. **Never fall back to a region centroid** for rows whose location is
unknown; they go unpinned and the inspector states `N of M pinned`.

## Accessibility surface

`RegionLedger` owns the route's keyboard and screen-reader surface, and every assertion
in `e2e/map.spec.ts`. Nothing inside the canvas is focusable and nothing there carries a
region's accessible name — a second match is a Playwright strict-mode failure. The
inspector's place chips are the keyboard route to every pin; do not build a third list.

Canvas-hosted `<Html>` chips are `aria-hidden` and `pointer-events: none`, always.
