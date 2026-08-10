# Map rendering

The `/map` route is an interactive region planner. The **good** experience is a
WebGPU war table under `src/map/`; region planning is complete without it via the
flat board. Geometry is generated offline and committed — the app never
vectorizes the world map at runtime.

Related implementation: `src/map/**`, `app/map/page.tsx`,
`scripts/build-map-terrain.mjs`, `scripts/build-poi-atlas.mjs`,
`e2e/map*.spec.ts`, `playwright.webgpu.config.ts`.

## Stack (settled)

| Layer | Choice |
| --- | --- |
| Packages | `three@0.185`, `@react-three/fiber@9`, React `19.2.8` |
| Renderer | `WebGPURenderer` via `three/webgpu` |
| Materials | TSL node materials + MRT selective bloom (`Effects.tsx`) |
| Frame loop | R3F `frameloop="demand"`; single `MotionDriver` heartbeat |
| Entry | `MapLoader` → `next/dynamic(() => import("./MapScene"), { ssr: false })` |

Do not migrate to `WebGLRenderer`, `EffectComposer`, raw `ShaderMaterial`, or
hand-written GLSL chunks. TSL expressions are the material language; Three’s
built-in `mx_noise_float` / `mx_fractal_noise_float` cover noise — do not vendor
noise shaders.

**TSL typing notes that bite:**

- Helper parameters that accept TSL floats must be typed `Node<"float">` from
  `three/webgpu`, not `ReturnType<typeof float>` (`float(1)` returns a narrower
  `VarNode`).
- Prefer closing over `uniform()` values rather than passing them through typed
  aliases that strip methods.
- `MeshBasicNodeMaterial` has no `emissiveNode`. Bloom-bound surfaces use
  `MeshStandardNodeMaterial` with a black `colorNode` and content in
  `emissiveNode`.

There is **no silent WebGL fallback**. When WebGPU is unavailable (or the
viewport is narrow — see below), the UI shows the flat board and visible copy
containing the substring `no WebGPU`. That string is part of the frozen contract.

## Bundle fence

Three.js and friends must not enter the shared app chunk:

- All canvas work lives under `src/map/` and is loaded only through `MapLoader`’s
  client-only dynamic import with `ssr: false`.
- Shared layout, other routes, and server components must not import
  `three`, `three/webgpu`, `@react-three/fiber`, or `@react-three/drei`.
- `app/map/page.tsx` may import planner data helpers and `RegionPlanner`; it must
  not import `MapScene` directly.
- Data-only map modules used outside `/map` (for example
  `src/map/data/regionAnchors.ts` from `/build`) stay free of Three imports.

If `three` lands in a shared chunk, every other route pays for it.

## Layout and 2D fallback

`RegionPlanner` composes:

```text
board (scene + toolbar)
  └── under stack: RegionPicker ledger · PlaceList · RegionDetails
```

There is **no side inspector**. Region detail sits under the board/ledger stack
in a `section[aria-label="Region detail"]` with `aria-live="polite"`.

| Mode | When | Surface |
| --- | --- | --- |
| WebGPU canvas | Adapter present, width > 760px, user has not forced flat | `MapScene` + `Canvas` |
| Flat board | Loading, adapter missing, init failure, `max-width: 760px`, or user toggle | SVG `FlatBoard` + crest pins |
| Forced flat | Toolbar / local preference via `useMapFocus` | Same as flat board |

Below 760px the 3D path never mounts; the flat board is the planner. While the
WebGPU adapter probe is pending, the flat board remains visible so the board cell
does not jump.

The flat board is planner-complete: same regions, same elective pick rules, zero
3D cost. The 3D board is the upgraded experience, not a dependency of planning.

## Generated geometry pipeline

`npm run build:map` rebuilds data, then runs:

1. `scripts/build-map-terrain.mjs` — plate rings, seams, terrain field
2. `scripts/build-poi-atlas.mjs` — POI icon atlas

Source raster: `public/map/world-surface-wiki.webp` (HD Wiki world surface).

| Artifact | Role |
| --- | --- |
| `public/map/region-plates.json` | Per-region closed rings + shared seam polylines (RuneScape surface coordinates) |
| `public/map/terrain-field.webp` | RGBA field: R land coverage, G signed coast distance (0.5 = waterline), B inland water, A relief |
| `public/map/poi-atlas.webp` + `.json` | Shared icon sheet for framed-region place pins |
| `scripts/.map-terrain-debug.png` | Untracked partition preview for local inspection |

The Wiki paints open water as one flat colour (`#7789A5`), so coastlines recover
exactly from the raster. Region ownership is a Euclidean partition from real
place coordinates (`gameCoords.ts` / anchors) plus build-time seeds — **never**
hand-authored UV polygons. A previous hand-drawn set drifted when the base
raster changed and drew borders in open ocean.

Build gates (must stay green):

- Plate rings scan-converted against their own mask (largest connected
  divergence under `MAX_DIVERGENCE`)
- Seam parity between neighbouring plates
- `src/map/data/plates.test.ts` re-checks the shipped `region-plates.json`

**Shared seams.** Each border is simplified once from a canonical key over the
whole path so both neighbours store byte-identical points and raised plates do
not crack. Rules that keep parity:

- Key the whole path, not endpoints only
- Check sharing before the closed-ring branch
- Emit a seam only where both sides actually drew geometry

Runs that cannot be reconciled ship unsimplified (denser, still identical).

Re-run `npm run build:map` after changing the surface raster, region seeds, or
anchor data that feeds the partition; commit the regenerated `public/map/`
outputs with the change.

### Map asset ownership

| Path | Ownership |
| --- | --- |
| `public/map/world-surface-wiki.webp` | Source raster (wiki-derived); input to `build:map` |
| `public/map/region-plates.json`, `terrain-field.webp`, `poi-atlas.*` | Generated by `build:map`; committed for deploy |
| `public/map/world-1600.webp`, `world-3200.webp` | Resolution variants used by the app |
| `public/game/regions/*.webp` | Region crests (flat board + UI); not produced by map build |
| `src/map/data/gameCoords.ts`, `placeAnchors.ts`, `regionAnchors.ts` | Hand-authored anchors; unit-tested against plates |
| `.generated/documents/map/` | Build-time seeds/docs (generated tree; not served as static URLs) |

Do not hand-edit plate rings or the terrain field to “fix” a border. Fix seeds
or the generator and regenerate.

## World frame, sea level, materials

`MAP_WORLD` is **2 units** wide. All UV anchors and camera solves live in that
frame and are unit-tested there. Do not re-normalise world units; on-screen size
comes from canvas pixels and the camera solve.

- Sea level is `y = 0`. At rest every coast meets it.
- Resting plate caps clear water by `REST_CLEARANCE` (`0.009`), which must stay
  above ocean `SWELL` (`0.0014`) or waves wash over land.
- Only the framed region lifts (`FOCUS_LIFT`). Sidelined regions recede in the
  material, not by sinking.
- Seed each plate’s `position.y` before first paint; do not ease from `0` on mount.

**Geographic UV:** `positionWorld.xz → map UV` (`mapUvFrom`) is the single
transform. Every layer samples the surface raster and terrain field through it so
Varrock stays on the same pixel whether a plate is resting or raised. Never
derive terrain UV from per-plate geometry UV.

**Rendering invariants:**

- Canvas is `flat` (no ACES tone mapping). Default filmic mapping muddies LDR
  wiki albedos under the sparse light rig.
- Terrain field textures use linear filtering **without** mipmaps (data channels
  shimmer under motion if mipped). Albedo may keep mips.
- Cap materials use `polygonOffset` so shared seams at rest height do not z-fight.
- `ExtrudeGeometry` bevel sits outside requested depth; anything laid on a cap
  must clear `depth + bevelThickness`.
- Albedo is brightened before lighting (`ALBEDO_GAIN`).
- Locked regions are material-only (drain + soft lock glow). Do not reintroduce
  a border vine layer. Seams remain for parity and debug.

### Rivers (known limitation)

The Wiki paints rivers in the open-sea colour, so the ocean flood classifies most
river pixels as sea and cuts them from the land mask. The terrain field’s inland
water (B) channel is therefore nearly empty; flow code that samples it is correct
but underfed. Width-based river recovery also tags narrow bays. A durable fix
needs component shape (“long and thin” vs “narrow opening to the sea”) and
likely belongs in the **ocean** material reading the field, not ad-hoc terrain
holes. Do not assume the channel mask is broken because rivers look open.

## Frame loop and StrictMode renderer cache

The demand loop sleeps until something calls `invalidate()`. **`MotionDriver`**
owns the only continuous timer (idle/active Hz bands). It stops under reduced
motion, an off-screen canvas (IntersectionObserver), or a hidden tab, and
advances the shared `mapClock` in `materials/shared.ts`.

- Idle animations (river flow, lock glow, marker gems) must ride frames that
  already happen — they must not invalidate at rest.
- Do not add a second driver. Do not throttle by accumulating delta inside
  `useFrame` under demand (the sea would only wake itself one rAF late and then
  sleep permanently).
- Transitions invalidate while moving and stop when settled.
  `e2e/map-ocean.spec.ts` covers tick behaviour when WebGPU is available.

**Renderer WeakMap + deferred dispose:** `MapScene` caches the `WebGPURenderer`
*promise* in a `WeakMap` keyed by canvas. React StrictMode remounts cannot rely
on a ref alone: a second `WebGPURenderer` on the same canvas displaces the first
context and yields a board that draws but does not receive pointer events
(dev-only). If the map paints but ignores hover/click, start here.

R3F never disposes a custom `gl`, and `WebGPURenderer` has no `forceContextLoss`.
WeakMap GC alone does not free GPU resources. `DisposeGlOnUnmount` schedules
`renderer.dispose()` on a 0ms timer after the canvas fiber leaves; a remount on
the same canvas cancels that timer. Route leave / flat switch must free the
renderer or each `/map` visit leaks roughly half a megabyte.

Anything the frame loop owns (`position.y`, `visible`, `scale`) must not also be
driven as a JSX prop — R3F re-applies the prop and teleports the transition.

## Camera and picking

No free `OrbitControls` / fly-cam. Every shot is four spherical scalars plus a
look target (azimuth, elevation, radius, look-at), damped toward a designed
framing. Restricted pointer input only:

| Input | Effect |
| --- | --- |
| LMB drag | Orbit within max azimuth / elevation offsets |
| RMB / MMB / Shift+LMB | Pan look target on the board plane (map extents) |
| Wheel / toolbar ± | Discrete zoom steps (`ZOOM_MIN`…`ZOOM_MAX`) |

Elevation stays above the board; focus / place changes clear manual offsets so
designed shots win. Cartesian position lerps between shots are banned (they cut
through the world). Soft pointer parallax stays tiny and disables while dragging.

**Picking rules:**

- Decorative meshes opt out with `raycast={() => null}` (stems, feet).
- Invisible hit targets use `colorWrite: false`, never `visible={false}` (the
  raycaster skips invisible objects).
- Marker handlers `stopPropagation()` so clicks do not fall through to plates.
- **A board click focuses a region. It never mutates elective picks.** Picking
  for the build is an explicit control in `RegionPicker` (and related inspector
  actions). `e2e/map-places.spec.ts` pins this.
- Canvas-hosted HTML overlays are `aria-hidden` and `pointer-events: none`.

## Markers

Pins appear only for the **currently framed** region. Overview uses region
crests; site pins are a second tier after a place is selected.

- Crest stakes in fixed world size with a slight table-facing tilt — not camera
  billboards, not CSS-pixel constant size, not soft medallions / contact shadows /
  per-pin DOM labels (those flickered under the demand loop).
- Face: binary disc cut, atlas icon, brass rim; emissive only when lit (gem).
- Hit proxy is a wider invisible plane.
- Names live on ledger chips, not canvas DOM labels.
- Anchors are authored coordinates gated by tests: catalog name resolution and
  plate containment (named offshore exceptions only). **Never** fall back to a
  region centroid for unknown locations — leave unpinned and report `N of M
  pinned` in the detail panel.

## Dev query flags

Read once from the query string in `mapQuality.ts` (not a settings UI):

| Flag | Effect |
| --- | --- |
| `?debugGeometry=1` | Outlines, seams, anchors, ids over the raster |
| `?topDown=1` | Overhead camera for raster comparison |
| `?wireframe=1` | Wireframe |
| `?no=water,relief,markers,bloom` | Disable named layers |

Prove geometry with `debugGeometry` before polishing materials.

## Accessibility (map-specific)

- `RegionPicker` owns keyboard and screen-reader region names. Nothing inside the
  canvas is focusable or carries a region’s accessible name (duplicate names break
  Playwright strict mode).
- Inspector place chips are the keyboard path to pins; do not add a third list.
- Region detail: `section[aria-label="Region detail"]` under the board stack,
  `aria-live="polite"`, source line matching `sources · verified YYYY-MM-DD`.
- Elective counter uses literal `0/3` … `3/3`; fourth elective is
  `aria-disabled="true"` but remains focusable; `Clear picks` is always present
  (disabled when empty).
- Region chip accessible names **start with** the display name; decorative crest
  images need empty alt so the name is not polluted.

Full site frozen contracts: [`ui-contracts.md`](./ui-contracts.md).

## Verification

Headless Chromium has **no WebGPU adapter**. Default Playwright (`npm run test:e2e`,
port **3100**) skips real 3D assertions; the honest `no WebGPU` / flat path still
runs. E2E is not in CI — run it locally before push.

To actually render and assert the board:

```bash
npm run test:e2e:webgpu
# equivalent:
# npx playwright test -c playwright.webgpu.config.ts e2e/map-board.spec.ts
```

That config uses headed Edge off-screen on port **3101**, where a GPU adapter is
available. Keep WebGPU work serial (`workers: 1`) to avoid device-lost flakes.

Unit coverage that must stay green when map data changes:

- `src/map/data/plates.test.ts`
- place / region anchor tests under `src/map/data/`
- material clearance tests (e.g. swell vs rest height)

Do not leave a stray `next dev` process after local runs; the default e2e port is
3100 (not 3000). Do not pin scraped `verifiedAt` dates or mutable wiki copy in
browser tests — match patterns instead.
