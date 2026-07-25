# War Table — implementation plan

Target: `app/map/` + `src/map/` in `rs3-equilibrium`. Verified against the installed tree
(`three@0.185.1`, `@react-three/fiber@9.6.1`, `@react-three/drei@10.7.7`, `three-stdlib@2.36.1`,
`next@16.2.11`, `react@19.2.8`), not from memory.

---

## 1. Creative direction

Eleven carved slabs on a dark umber table. Each region is a separate piece of the board, cut along
shared seams, so the board visibly comes apart. Unlocked pieces are lifted and lit; locked pieces sit
sunken in their sockets, drained of colour, capped by the green hex barrier the game uses for region
locking. The extruded side wall of every raised piece shows the cut: topsoil, subsoil, rock, deep
rock, with root streaks in the top band. Lock state is a property of the geometry — height, colour
temperature and the barrier lattice — so the board needs no legend and no status badge.

The camera never tumbles. It sits on a small set of authored framings and moves between them on a
damped arc that keeps it above the board the whole way, so every frame is a shot someone chose.

Guthixian vine growth frames the viewport edge as an SVG overlay outside the canvas. It is not
decoration: its extent is the pick counter. Zero picks, bare corners; three picks, a closed frame.
It grows and retracts on state change only, and it renders identically in the 2D fallback.

Every slab carries real data at war-table scale — its region crest (real game art from
`assets/rs3/regions/`) and its auto-completed quest count in 20px mono. The board is the primary
data surface, not a stage over a data dock. The dock beside it is a full 11-row ledger and an
inspector that touches it.

**The one line that governs everything:** eleven surfaces, one node graph, one grade pass. The
regions differ by six uniforms each. That is what makes the board read as a single carved object
rather than eleven stickers.

---

## 2. Region geometry — the decision

### The constraint, measured

`public/map/league-map.jpg` (865×404, 83.5 KB) quantizes to exactly three classes:

| class | colour | share |
|---|---|---|
| sea | `#182830` and neighbours | ~50% |
| locked land | `#486848` / `#487050` | ~20% |
| unlocked land (Misthalin + Havenhythe only) | `#08b880` | 1.8% |

**There are no region borders in the image.** Jagex's Regions tab draws a coastline and colours the
two currently-unlocked regions; the other nine are one undifferentiated green mass. Any mask
extraction can recover coastline, and can recover the true Misthalin and Havenhythe silhouettes, and
nothing else. That kills the "just extract masks" path as a source of truth.

I prototyped the obvious repair — close the mask (5px dilate/erode, which patches most of the holes
Jagex's own labels and marker discs punch through the land) and partition it by nearest anchor from
`REGION_ANCHORS`. It runs, it produces a clean 11-way partition with sane area shares (6.2%
Asgarnia to 14.1% Wilderness), and the result is in
`scratchpad/voronoi.png`. It also looks like a Voronoi diagram: real coastline on the outside,
dead-straight invented chords on the inside, and residual speckle holes where the labels sat. Not
shippable. Useful as a first draft.

### The alternatives, with effort

| # | Approach | Effort | Verdict |
|---|---|---|---|
| A | Hand-traced SVG path per region over the map, in a vector editor | 25–40 min/region → **5–7 h** authoring, plus a conversion pipeline | Reject as primary |
| B | Offline mask extraction → per-region alpha masks | script **3–4 h**, hand-repair **4–6 h** | Keep as an authoring aid only |
| C | `SVGLoader` → `ExtrudeGeometry` at runtime | **1 h** once paths exist | Reject the loader, keep the extruder |
| D | Heightmap / displacement | **2 d** | Reject |
| E | **Low-poly authored slabs on a shared border graph** | tooling **3–4 h** + authoring **2–3 h** = **~6 h** | **Ship this** |

Why each falls out:

**A.** Adjacent regions will not share edges. A vector editor gives you eleven independent closed
paths; where two of them meet you get a sub-pixel gap or a sub-pixel overlap, and at extrusion depth
that becomes a visible crack or z-fighting along every interior seam. You can fix it by hand eleven
times and break it again on the first edit. It is also a direct trace of Jagex art, which collides
with `docs/3d-map-handoff.md` decision #2.

**B.** Cannot produce borders that do not exist in the source. Good for a starting draft, and I
would keep the script, but it is an input to a human, not an output to a renderer.

**C.** Two separate findings. First, the loader:
`node_modules/three/examples/jsm/loaders/SVGLoader.js:21` reads `} from 'three';` — it imports the
WebGL entry (`build/three.module.js`), not `three/webgpu`. Both builds re-export the shared
`build/three.core.js`, so there is *no* duplicate-class hazard (that is worth knowing, because the
usual warning does not apply here), but you would be adding the WebGL renderer's export surface to a
chunk that already carries `three.webgpu.js`, purely to run a parser you only need at build time.
Second, the extruder: `three/webgpu` exports `Shape`, `Path`, `ShapePath`, `ShapeGeometry` and
`ExtrudeGeometry` directly — I confirmed all five in the build's export block. So build
`THREE.Shape` from plain point arrays and extrude it with zero addon imports. **Keep
`ExtrudeGeometry`, drop `SVGLoader`.**

**D.** A heightmap needs a densely subdivided plane and destroys the crisp vertical cut that is the
entire point of the direction. Vertex count explodes for a worse result.

**E — ship this.** Eleven rings of 14–22 points each, authored as plain `[x, y]` pairs in TypeScript
against a **shared border-node table**, so an interior edge is literally the same two vertices in
both neighbours.

```ts
// src/map/data/regionShapes.ts
export const BORDER_NODES: Record<string, readonly [number, number]> = {
  n_lum_mouth: [0.532, 0.548],
  n_asg_mist:  [0.472, 0.470],
  // …~70 nodes total, in map-uv space (0..1, x east, y south)
};

export interface RegionShape {
  id: RegionId;
  /** Closed ring, CCW, as BORDER_NODES keys. Shared keys guarantee shared edges. */
  ring: readonly string[];
  /** Where the crest decal and the count chip sit, in map-uv. */
  markerUv: readonly [number, number];
  /** Slab thickness in world units; larger regions sit thicker. */
  depth: number;
  framing: Framing;
}
```

Five reasons this is the right call, in priority order:

1. **The flat plate is already ruled out.** The `equilibrium-ui` tournament ledger records the War
   Table's flat form failing on exactly one fact: `league-map.jpg` is a screenshot of the game's own
   Regions tab, so it already carries Jagex's markers and labels and every overlay reads doubled.
   The fix on record is "raised per-region geometry replacing the flat plate". Once the plate is
   gone, coastline fidelity buys nothing — nobody checks your Karamja crenellation against the wiki
   from a 3/4 camera 1.2 units out. What has to survive is topology: Karamja south of Misthalin,
   Anachronia and Havenhythe off the east, Wilderness across the north, Tirannwn on the west edge.
   Sixteen points carry that.
2. **Shared edges are only achievable on a graph.** This is the difference between eleven slabs and
   a board that came apart, and it is not a detail — it is the read.
3. **It pays for itself twice.** The same rings render as SVG `<polygon>` elements in the 2D
   fallback, which turns the fallback from one apologetic sentence into a real board. A 60-point
   bezier trace would also render, but it would look like a squashed screenshot; the low-poly
   version looks deliberate. This is the strongest argument in the set.
4. **Cheap and clean downstream.** ~1.5k tris per slab with a 2-segment bevel; clean strata banding
   on the walls because the walls are large flat quads; no simplification step; no UV authoring
   (the material reads `positionWorld`, not `uv`).
5. **It is unambiguously our own art**, so `docs/3d-map-handoff.md` decision #2 stays true and the
   derivative-work question never comes up.

Authoring flow: `scripts/bake-region-draft.mjs` (the option-B prototype, promoted to a committed
dev-only script) emits a draft ring per region from mask ∩ Voronoi, contour-traced and simplified to
~20 points. A human then opens a dev-only overlay editor and drags nodes until the interior seams
follow coast, mountain and river rather than Voronoi chords. Re-authoring one region later is five
minutes, not forty.

Invariants get a vitest file, because this is real logic with real constraints:

```
src/map/data/regionShapes.test.ts
  - every ring key resolves in BORDER_NODES
  - every ring is closed, CCW, and non-self-intersecting
  - every interior edge (a,b) appears in exactly two rings, reversed
  - no ring shares a node with a region it does not border
  - all 11 RegionIds are present exactly once
```

### The plate

Delete it. `MapPlane` in `MapTable.tsx` goes away with the doubled-marker problem. Move
`public/map/league-map.jpg` to `assets/leagues/equilibrium/official/regions-tab.jpg` (out of the
served bundle) and change the credit under the board from "Map image: Jagex…" to a line that is
actually true once the plate is gone — the region layout still follows Jagex's map, and saying so is
the honest attribution.

---

## 3. Camera

### What changes in `CameraRig.tsx`

Delete these four things:

- `import { OrbitControls } from "@react-three/drei"` and the `<OrbitControls>` element
- `import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"`
- `controlsRef` and every `controls.target` / `controls.update()` call
- the `onStart` handler that lets user input win

`OrbitControls` is the only reason `three-stdlib` is in the map chunk
(`node_modules/@react-three/drei/core/OrbitControls.js:4` imports it, and `three-stdlib` peer-deps
`'three'`). Removing it is a bundle win as well as a design one.

Keep: the aspect-aware distance fit, `invalidate()` on every moving frame, the reduced-motion snap.

### What replaces it

Framings are data, authored beside the shapes:

```ts
export interface Framing {
  /** Camera position in board-spherical coords around the framing target. */
  azimuth: number;   // radians, 0 = due south of target
  elevation: number; // radians above the board plane
  radius: number;
  target: readonly [number, number, number];
  fov: number;
}

export const TABLE_FRAMING: Framing = {
  azimuth: 0, elevation: 0.82, radius: 1.62, target: [0, 0, 0.06], fov: 38,
};
```

`TABLE_FRAMING` is the default 3/4 war-table shot. Each `RegionShape` carries its own `framing` —
authored, not derived from the centroid, because the derived version shoots edge regions from off
the board. Tirannwn and Anachronia get pulled inward; Wilderness gets a lower elevation so the
northern slabs stack in frame.

`radius` scales with aspect exactly as today (`max(radius, 2.9 / aspect)` on the table framing only)
so narrow viewports still fit the board.

**Transition — the part that matters.** Do not lerp cartesian position: for two far-apart regions
that path cuts through the board and the shot dies mid-move. Lerp the three spherical scalars plus
the target plus fov:

```ts
const k = 1 - Math.exp(-delta * 6.5);
cur.azimuth   = lerpAngle(cur.azimuth, want.azimuth, k);  // shortest arc
cur.elevation += (want.elevation - cur.elevation) * k;
cur.radius    += (want.radius - cur.radius) * k;
cur.target.lerp(want.target, k);
cam.fov       += (want.fov - cam.fov) * k;
```

The camera stays above the board for the entire move by construction. Settles in ~350 ms perceived;
`moving` clears when all five deltas are under threshold. `reducedMotion` copies instead of lerping.
Every moving frame calls `invalidate()`, unchanged from today.

**Pointer parallax.** Applied *after* the framing solve, so it can never fight it:

```
azimuth   += clamp(ndcX, -1, 1) * 0.030
elevation += clamp(ndcY, -1, 1) * 0.015   // ~1.7° / 0.9°
```

Damped at `k = 1 - exp(-delta * 4)`. Zero under `prefers-reduced-motion`. `onPointerMove` on the
canvas wrapper calls `invalidate()`; when the pointer stops, the damping settles and the frameloop
sleeps. This is input-driven, not idle — the state that changed is the pointer — so it is inside the
design law, and it never runs when nobody is moving a mouse.

**No canvas keyboard controls, deliberately.** Every region is reachable from the DOM ledger, and
focusing a ledger row drives the camera. The 3D is a view over the store; it is never the only way
to do anything. `onPointerMissed` returns to `TABLE_FRAMING`.

**Intro.** Keep the existing behaviour: mount wide and high, settle to `TABLE_FRAMING` on the first
frames, hard cut under reduced motion. One authored move, once.

---

## 4. Vines

### The conflict, stated plainly

`no-slop-ui` §6.7: *"Motion is functional and fast. 120–200ms ease-out, only on state change.
Nothing loops, floats, pulses, or glows on idle."* An ambient swaying vine is exactly the banned
thing. And `frameloop="demand"` means the canvas is asleep whenever nothing changed, so in-scene
vines would either not animate or would force the loop awake permanently, burning a GPU on
decoration.

### DOM/SVG overlay, not in-scene geometry

Not close. Reasons:

- Vines at the *viewport edge* must track the camera, so in-scene they would end up screen-space
  anyway — paying 3D cost for a 2D result.
- They must render in the WebGPU-less fallback too. A DOM overlay does that for free: same
  component, same store, one implementation.
- The `frameloop="demand"` conflict evaporates. The SVG is CSS transitions; the canvas stays asleep
  through the entire vine animation.
- Crisp at any DPR, no AA cost, no draw calls, no geometry to dispose, ~5 KB of path data.

This is the general rule for this route: **all continuous-ish motion lives outside the canvas.** The
canvas wakes only for camera transitions, slab raise/lower, hover, unlock sweep and resize — each
of which invalidates and settles.

### Version A — strict, state-driven (recommended)

`src/map/VineFrame.tsx`, absolutely positioned over the canvas, `pointer-events: none`,
`aria-hidden="true"`. Four corner brackets, each one `<path>` with `pathLength="1"` and
`stroke-dasharray="1"`; leaves are small filled shapes along each stem.

```
--vine-grow: calc(1 - var(--picks) / 3)     /* 1 = retracted, 0 = full frame */
path  { stroke-dashoffset: var(--vine-grow);
        transition: stroke-dashoffset 180ms cubic-bezier(.2,.7,.3,1); }
.leaf { transform: scale(var(--leaf-on)); transform-origin: center;
        transition: transform 160ms cubic-bezier(.2,.7,.3,1); }
```

Corners stagger via `transition-delay: 0 / 60 / 120 / 180ms`; leaves derive their delay from their
position along the stem. Each *element* animates for 160–180 ms, which is what the law constrains;
the frame as a whole completes in ~360 ms. Growth and retraction are the same transition run in
opposite directions, so `Clear picks` is free.

Colour: stroke `--color-gem-600` at 0.55 alpha, leaves `--color-gem-500`. No filter, no glow, no
drop-shadow.

Reduced motion needs no code: `app/globals.css` already forces
`transition-duration: 0.01ms !important` under `prefers-reduced-motion`. Verify it, do not add a
second path.

### Version B — documented low-amplitude idle sway

Same component, plus a `@keyframes` rotating 3–4 leaf tips ±0.6° on a 9 s ease-in-out loop,
amplitude under 1 px of travel, `animation-play-state: paused` when the document is hidden.

### Recommendation: ship A, and do not ship B

1. It is the law, and this repo's law is explicit rather than vibes.
2. B is invisible-to-the-author and loud-to-the-auditor. A `bot-audit` sweep greps for idle
   animation; it will find `@keyframes` and it has no way to know the amplitude was deliberate. You
   would be spending a documented exception on a leaf twitch nobody sees.
3. Reduced motion already kills B globally via the existing `!important` rule, so B ships two
   different behaviours and the second one is the one the law wanted anyway.
4. A is a *better idea*. The vine-as-progress-meter earns its pixels: it is a second, peripheral
   read of "how many picks have I spent", visible while your eyes are on the board and not on the
   counter. Decoration that turns out to be an instrument is the whole trick.

If someone later insists on B, the sanctioned form is one line in `equilibrium-ui`'s exceptions
list with a screenshot of the game's own moving foliage as the justification — the same standard the
frosted-cell exception met. Not before.

---

## 5. Materials and textures

### One graph, eleven parameter sets

Gen-AI imagery stays banned, and there is no artist to hand-author eleven tiling surfaces. Wiki and
game art are available under CC BY-NC-SA, but photoreal scans fight the flat vector crests, so the
board wants a stylised surface. So: **one shared TSL node graph, per-region uniforms, one grade pass
applied identically to all eleven.** That last part is the mechanism that makes them read as one
artifact. Reference tiles built from this exact parameter table already exist (seeded procedural
noise, seam-verified) and can either ship as textures or be ported straight into TSL.

`ExtrudeGeometry` emits exactly two material groups — group `0` for the caps, group `1` for the side
walls (verified in `three.core.js`: `addGroup(start, …, 0)` on the lid block, `…, 1)` on the
sidewalls block). So each slab is one mesh with a two-element material array. Cap material and wall
material are separate graphs and the split is free.

```tsx
<mesh geometry={slabGeometry}>
  <meshStandardNodeMaterial attach="material-0" ref={capMat} />
  <meshStandardNodeMaterial attach="material-1" ref={wallMat} />
</mesh>
```

TSL surface confirmed present in `three/tsl` at r185: `mx_noise_float`, `mx_fractal_noise_float`,
`mx_worley_noise_float`, `positionWorld`, `normalWorld`, `color`, `uniform`, `mix`, `step`,
`smoothstep`, `remap`, `saturate`, `Fn`, `float`, `vec2/3/4`.

### Cap graph (the region surface)

```
n1 = mx_fractal_noise_float(positionWorld.xz * grainFreq, 2 octaves)
n2 = mx_noise_float(positionWorld.xz * 0.6)            // large-scale variation
base   = mix(tintLow, tintHigh, n1.mul(0.5).add(0.5))
base   = mix(base, base.mul(1.0 + n2*0.10), 0.7)        // kills tile-read
speck  = step(speckThresh, mx_worley_noise_float(positionWorld.xz * speckFreq))
base   = mix(base, speckColor, speck.mul(speckAmount))
graded = mix(base, BOARD_MEAN, 0.14)                    // <-- the unifier
graded = mix(graded, desaturate(graded).mul(0.42), lockAmount)
```

`BOARD_MEAN = #2a2318`. That one `mix` is applied byte-identically to all eleven and it is what
turns eleven surfaces into one carved board. `lockAmount` is a single 0..1 uniform per region, so
the entire unlock transition is one number animating — the slab raise, the colour return and the
barrier fade all key off it.

Per-region parameters, graded into the Equilibrium palette rather than sampled from nature:

| region | tintLow | tintHigh | grain | speckle | rough |
|---|---|---|---|---|---|
| misthalin | `#3c4a2c` | `#55663a` | 5.5 | none | 0.88 |
| havenhythe | `#3a4a38` | `#586b4e` | 5.0 | `#8b7f68` low | 0.85 |
| karamja | `#233522` | `#3d5a30` | 8.0 | `#14100b` high | 0.92 |
| asgarnia | `#3b3a30` | `#57544a` | 4.0 | `#6b675c` mid | 0.80 |
| kandarin | `#35452f` | `#4e6440` | 5.0 | `#a2957a` low | 0.86 |
| fremennik | `#4a4f4c` | `#7d8480` | 3.0 | `#d3c8b0` mid | 0.72 |
| forinthry | `#332a1e` | `#4a3b28` | 7.0 | `#1b1610` high | 0.94 |
| desert | `#6b5734` | `#a87c3c` | 3.5 | none | 0.78 |
| morytania | `#2b2a30` | `#42404c` | 6.5 | `#1b1610` mid | 0.90 |
| tirannwn | `#26401f` | `#3d6630` | 6.0 | `#57e0ae` v.low | 0.84 |
| anachronia | `#2f3d24` | `#4d5f33` | 7.5 | `#463a29` mid | 0.88 |

Every value sits inside the umber/olive band the palette defines. Desert is the warmest, Fremennik
the coolest, and the 14% grade pulls both back toward the board. No region gets a hue that is not
already in the surface or ink ramps — that constraint is what stops this becoming eleven stickers.

### Wall graph (the underearth cross-section)

This is the money shot and it costs one remap.

```
t = remap(positionWorld.y, slabBottom, slabTop, 0, 1)
jitter = mx_noise_float(positionWorld.xz * 14).mul(0.045)
band = t + jitter
strata:
  band > 0.80  topsoil    #463a29
  band > 0.55  subsoil    #332a1e
  band > 0.24  rock       #1b1610
  else         deep rock  #14100b
roots = step(0.72, mx_noise_float(vec2(tangentialCoord * 42, positionWorld.y * 3)))
        masked to band > 0.62, multiplied into topsoil at 0.55
```

Boundaries are noise-perturbed so they are not perfect stripes. Root streaks read correctly at
war-table distance and cost one extra noise sample. Locked slabs sit deep enough that only the
rock bands show above their socket, which is itself the lock signal.

### Locked barrier lattice

A second `ShapeGeometry` built from the same ring, raised `+0.006` above the cap, with a
`MeshBasicNodeMaterial`:

```
hex = hexDistance(positionWorld.xz * 26)     // axial coords, ~26 cells across the board
line = 1 - smoothstep(0.04, 0.07, hex)
opacity = line * 0.5 * lockAmount
color = #2ecb8f
```

Reading the lattice from `positionWorld.xz` rather than per-slab UV means the hex grid is
**continuous across the whole board** — locked neighbours share a lattice instead of each wearing
their own. That is what sells it as a barrier over the map rather than a texture on a slab. It also
matches `equilibrium-ui`'s ruling that the hexagon is a layout grid, not a logo.

### Crests — real game art

`assets/rs3/regions/*.png` has all 11 real in-game crests and is not web-served. Extend
`scripts/sync-assets.mjs` to copy them to `public/game/regions/`, then render each as a small quad
on its slab (`markerUv`, ~0.09 world units, alpha-tested, unlit). This satisfies `equilibrium-ui`'s
art-pipeline requirement — a game tool with no game art scores BUSTED on bot-audit sweep 5 — and it
identifies each region without a text label, which is what makes the count chip affordable.

### Palette module

Add `src/map/palette.ts` exporting the ruled hexes as numbers, and import from it everywhere in
`src/map/`. `MapTable.tsx` currently hardcodes `0x2ecb8f`, `0x33453b`, `0x17140f`, and `MapScene.tsx`
hardcodes `#0e0d0b`, `#cfd8c8`, `#e4efd6`, `#7fd0a8`. Inline hex is a defect and two of those colours
are not in the palette at all.

### Lighting

Currently cool sage and mint (`#cfd8c8`, `#e4efd6`, `#7fd0a8`) against a warm umber board — it will
never read warm. Replace with: key `#f0dcb4` at 1.5 from `[1.6, 2.4, 0.9]`, fill `#463a29` at 0.35
ambient, rim `#2ecb8f` at 0.4 from `[-1.8, 1.2, -1.6]` so unlocked slab edges separate from the
void. Background `#0d0a07`.

### Renderer: stay WebGPU-only

Keep it, and do not add a WebGL fallback. The entire material design above is TSL; a WebGL path
would mean authoring the strata, the lattice and the grade twice in GLSL — doubling the surface area
of the hardest part of the build for browsers that should be getting the 2D board anyway. The right
investment is to make the **fallback better**, not the 3D more portable. Today the fallback is one
sentence in a `panel-body`; it becomes `FlatBoard.tsx`, an SVG board rendered from the same
`REGION_SHAPES` rings with the same crests, lock states and quest counts. Same data, ~120 lines, no
canvas. The substring `no WebGPU` survives in the copy above it.

### Effects.tsx: enable it, scoped to two states

Enable the commented-out `<Effects />` at `MapScene.tsx:82`. It is currently imported but never
mounted, so it is dead weight in the chunk today.

Bloom applies to the emissive MRT target only, and **nothing is emissive at rest**:

- **Focus rim** — the focused slab's cap gets `emissiveNode = gem * 0.9 * focusAmount`, and
  `focusAmount` is 0 for every unfocused slab. This is the sanctioned selection glow.
- **Unlock sweep** — a ~600 ms `unlockAmount` ramp drives emissive from ember `#e2622a` to gem
  `#2ecb8f` and back to 0. Ember is transition-only by ruling; it never rests on screen.

Params: `bloom(emissiveTex, 0.35, 0.4, 0.9)`. Threshold 0.9 keeps the map surface out of it.

Compatibility with `frameloop="demand"` is verified against the R3F source: `update()` runs only
when `state.internal.frames > 0`, and `if (!state.internal.priority && state.gl.render)` means a
`useFrame` at priority 1 replaces R3F's automatic render without changing when frames happen. So
`Effects` at priority 1 and `demand` compose correctly. The one hazard is that a state change that
does not invalidate leaves a stale frame on screen — see risk 3.

---

## 6. Data layer and layout

### What the repo can actually put on screen today

Real counts, joined by region id from `data/league/quests.json` (`region_group_counts`) and
`data/research/catalog.json`:

| region | quests | content | upgrades | training | areas |
|---|---:|---:|---:|---:|---:|
| misthalin | 145 | 16 | 8 | 4 | 3 |
| kandarin | 94 | 5 | 4 | 8 | 3 |
| asgarnia | 90 | 15 | 6 | 4 | 9 |
| desert | 48 | 8 | 6 | 5 | 2 |
| fremennik | 32 | 3 | 2 | 4 | 3 |
| morytania | 29 | 5 | 4 | 1 | 2 |
| karamja | 19 | 4 | 3 | 0 | 4 |
| anachronia | 11 | 5 | 6 | 5 | 3 |
| tirannwn | 10 | 4 | 4 | 7 | 2 |
| havenhythe | 4 | 12 | 3 | 5 | 8 |
| forinthry | 4 | 8 | 6 | 7 | 2 |

`quests` is the auto-completed-quest count if you unlock that region — genuinely
decision-relevant, and the only number in the repo with enough spread (4→145) to make a board read
as data. `tasks.json` has zero published records and `blessings.json` has zero revealed choices, so
nothing on this screen may depend on them.

### On the table vs in the dock

**On the table** (per slab, at war-table scale):
- the region crest, ~64 px on screen at the default framing — identity without a text label
- the quest count, **20 px mono**, `--color-parch-50`, no chip background, sitting on the slab
- lock state, carried by height + desaturation + the barrier lattice — never a badge
- the region name, only on hover/focus, as a `<div>` chip

**In the dock** (everything countable and comparable):
- the pick counter, **28 px mono** — the single focal point of the screen
- the 11-row ledger: crest, name, access, quest count, picked state
- the inspector: a 4-cell stat strip (quests / content / upgrades / training, each 20 px mono),
  the area list, and the content + upgrade tables side by side

The rule being applied is `data-readability`'s adjacency clause: the ledger row and the inspector
that explains it are in the same column, one vertical eye move apart. Nothing on this screen makes
the eye cross the viewport to join two facts about one region.

### Layout at 1440×900

Viewport 1440 wide; page inner 1376 after 32 px gutters. Everything below fits in 900 px with no
scroll, which is the point.

```
0                                                                            1440
├──32──┬───────────────────────── 1376 ──────────────────────────────┬──32──┤

┌────────────────────────────────────────────────────────────────────────────┐
│ REGION MAP                                                                 │ 28
│ Misthalin and Havenhythe are fixed. Karamja lands at the first milestone.  │ 18
└────────────────────────────────────────────────────────────────────────────┘ 12
┌──────────────────────────────────────────────┬─────────────────────────────┐
│ ┌ vine frame (SVG overlay, canvas edge) ────┐│┌ PICKS    ◆◆◇   2/3  ──────┐│ 44
│ │                                           │││ ▣ Misthalin   start    145││ 32
│ │      ╭──────╮   ╭──────╮        ╭─────╮   │││ ▣ Havenhythe  start      4││ 32
│ │    ╭─┤Fremen├───┤ Wild ├──╮  ╭──┤Anach│   │││ ▣ Karamja     m/stone   19││ 32
│ │    │ │  32  │   │   4  │  ├──┤  │  11 │   │││── elective — pick 3 of 8 ─││ 22
│ │    ╰─┴──┬───┴─┬─┴───┬──┴──╯  ╰─────╯      │││ ◆ Kharidian Desert      48││ 32
│ │  ╭────╮╭┴────╮╭┴───╮│    ╭──────╮         │││ ◆ Morytania             29││ 32
│ │  │Tira││Kanda││Asga││    │ Mory │  ╭────╮ │││ ◆ Tirannwn              10││ 32
│ │  │ 10 ││  94 ││ 90 │╯    │  29  │  │Have│ │││ ◇ Asgarnia              90││ 32
│ │  ╰────╯╰─────╯╰──┬─╯     ╰──────╯  │  4 │ │││ ◇ Kandarin              94││ 32
│ │      ╭──────╮╭───┴───╮              ╰────╯│││ ◇ Fremennik Province    32││ 32
│ │      │Karam ││Misthal│                    │││ ◇ Wilderness             4││ 32
│ │      │  19  ││  145  │                    │││ ◇ Anachronia            11││ 32
│ │      ╰──────╯╰───┬───╯                    │││───────────────────────────││
│ │          ╭───────┴──╮                     │││ Clear picks               ││ 32
│ │          │ Kharidian│                     ││└───────────────────────────┘│
│ │          │    48    │                     ││ Region layout follows       │ 16
│ └───────────────────────────────────────────┘│ Jagex's Equilibrium map.    │
│              976 × 520 canvas                │        388 ledger           │
└──────────────────────────────────────────────┴─────────────────────────────┘ 12
┌────────────────────────────────────────────────────────────────────────────┐
│ KHARIDIAN DESERT               elective · picked · 3 sources · ver 2026-07-25│ 34
├──────────────────┬──────────────────┬──────────────────┬───────────────────┤
│ QUESTS       48  │ CONTENT       8  │ UPGRADES      6  │ TRAINING        5 │ 52
├──────────────────┴──────────────────┴──────────────────┴───────────────────┤
│ Al Kharid · Sophanem                                                       │ 22
├────────────────────────────────────────┬───────────────────────────────────┤
│ CONTENT          KIND        STATUS    │ UPGRADE            KIND           │ 24
│ Kalphite King    boss        confirmed │ Menaphite gift…    passive        │ 26
│ Nex              boss        confirmed │ Sceptre of the…    teleport       │ 26
│ Sophanem Slayer  dungeon     inferred  │ Keldagrim…         access         │ 26
│ …5 more                                │ …3 more                           │ 26
└────────────────────────────────────────┴───────────────────────────────────┘
```

Vertical budget: 46 + 12 + 520 + 12 + 34 + 52 + 22 + 110 = 808, plus 24 top and 24 bottom page
padding = 856. Fits 900.

Content fill: canvas 976×520 = 39%, ledger 388×520 = 16%, inspector 1376×218 = 23%, header 5%.
**83% real content**, comfortably over the 70% floor, and the canvas counts because it carries
eleven crests, eleven numbers and the lock geometry — not because it is pretty. No void exceeds
12 px inside the working surface.

Type: ledger names 14 px, ledger counts 14 px mono right-aligned, section labels 11 px uppercase,
slab counts 20 px mono, stat-strip values 20 px mono, pick counter 28 px mono. One focal point:
the pick counter.

Below 1100 px the ledger drops under the board and the canvas goes full width at 340 px tall. Below
760 px the canvas is not mounted at all and `FlatBoard` takes over — same data, same buttons.

### E2E API, preserved exactly

Everything Playwright pins survives because the ledger inherits it from `RegionPlanner`:

- 11 `<button>` elements whose accessible name **starts with** the display name. Crests inside them
  get `alt=""`.
- literal `0/3` and `3/3` text nodes
- a genuinely `disabled` 4th elective pick
- a `Clear picks` button
- `section[aria-live]` on the inspector
- the substring `no WebGPU` in the fallback copy

**Hard rule for the 3D layer:** nothing rendered inside the canvas may be a `<button>` or carry an
accessible name matching a region. Two matches means a Playwright strict-mode violation. In-scene
chips are `<div aria-hidden="true">`. The current `Html` hover chip already complies; keep it that
way.

---

## 7. File-by-file changes

### New

| Path | What |
|---|---|
| `src/map/data/regionShapes.ts` | `BORDER_NODES`, `REGION_SHAPES`, `TABLE_FRAMING`, `shapeFor(id)`, `Framing` |
| `src/map/data/regionShapes.test.ts` | partition invariants (closed, CCW, shared edges, all 11) |
| `src/map/data/regionMetrics.ts` | joins `quests.json` counts + catalog counts by region id |
| `src/map/palette.ts` | numeric mirrors of the `@theme` tokens for scene use |
| `src/map/materials/regionMaterial.ts` | cap + wall TSL graphs, per-region uniform sets |
| `src/map/materials/hexBarrier.ts` | world-space hex lattice material for locked caps |
| `src/map/RegionSlab.tsx` | one slab: geometry, 2 materials, raise spring, crest, count chip, pointer |
| `src/map/BoardLights.tsx` | the three-light rig, lifted out of `MapScene` |
| `src/map/VineFrame.tsx` | SVG edge frame bound to pick count; used by 3D and fallback |
| `src/map/FlatBoard.tsx` | SVG 2D board over the same rings — the real fallback |
| `src/map/RegionLedger.tsx` | the 11-row rail; owns the e2e button API |
| `src/map/RegionInspector.tsx` | `section[aria-live]` detail + 4-cell stat strip |
| `scripts/bake-region-draft.mjs` | dev-only authoring aid: mask + Voronoi → draft rings |

### Changed

| Path | What |
|---|---|
| `src/map/MapTable.tsx` | delete `MapPlane` and the `league-map.jpg` load; becomes the slab container |
| `src/map/CameraRig.tsx` | drop `OrbitControls` + `three-stdlib`; spherical framing solver + parallax |
| `src/map/MapScene.tsx` | palette import, lights out to `BoardLights`, `<Effects />` uncommented, pointer handler, `VineFrame` sibling |
| `src/map/Effects.tsx` | tune bloom to `(0.35, 0.4, 0.9)`; no other change — disposal is already correct |
| `src/map/MapLoader.tsx` | render `FlatBoard` as the `loading` skeleton and as the unsupported state |
| `src/map/RegionPlanner.tsx` | split into `RegionLedger` + `RegionInspector`; file retires |
| `src/map/data/regionAnchors.ts` | `REGION_ANCHORS` becomes crest/label anchors inside shapes; `MAP_IMAGE` credit reworded; `MAP_WORLD`/`anchorWorld` unchanged |
| `app/map/page.tsx` | 3-zone shell, wide container, metrics join |
| `src/components/Page.tsx` | add `wide` prop (`max-w-[1440px]`) |
| `app/globals.css` | migrate surface/ink ramps to the ruled palette; add `--color-gold-*`, `--color-ember-400`; add `.vine-frame`, `.slab-chip`, `.stat-strip` |
| `scripts/sync-assets.mjs` | copy `assets/rs3/regions/*.png` → `public/game/regions/` |
| `e2e/map3d.spec.ts` | assert board-agnostic behaviour that passes on both the 3D and fallback paths |
| `docs/3d-map-handoff.md` | superseded banner (see §10) |

### Moved / removed

| Path | What |
|---|---|
| `public/map/league-map.jpg` | → `assets/leagues/equilibrium/official/regions-tab.jpg` (out of the served bundle) |
| `@react-three/drei` | no longer imported by `src/map/` once `OrbitControls` goes and `Html` is hand-rolled (see risk 4). Keep the dependency for now; drop it from `package.json` only after the chip layer proves out. |

---

## 8. Risks

**1 — Ring authoring is the schedule risk.** Six hours of hand work with no test that says "this
looks right".
*Mitigation:* Phase 1 ships the rings as a flat SVG board **before** any 3D touches them. Bad
topology is visible in five seconds at zero 3D cost, and the fallback gets built as a side effect.

**2 — WebGPU in Playwright.** `playwright.config.ts` runs chromium; headless chromium may or may not
expose a WebGPU adapter, so `map3d.spec.ts` can land on either branch run to run.
*Mitigation:* keep the `canvas.or(fallback)` hedge, and put every real assertion on the DOM ledger,
which exists identically on both paths. Do not write a test that requires the canvas.

**3 — Stale frame under `demand` + priority-1 render.** Any state change that does not call
`invalidate()` leaves the last frame on screen — a silent, intermittent bug.
*Mitigation:* one `useInvalidateOnBuild()` hook subscribing to `useBuild` and calling `invalidate()`;
mount it once in `MapScene`. Same for hover state and resize.

**4 — Eleven `Html` chips.** drei's `Html` runs a matrix solve per instance per frame and injects
eleven DOM subtrees.
*Mitigation:* under `demand` they only recompute on invalidated frames, so measure first. If it is
slow, replace with a single absolutely-positioned DOM layer outside the canvas whose positions come
from projecting the eleven `markerUv` points once per settled frame (~50 lines). That also removes
`@react-three/drei` from the map chunk entirely, since `OrbitControls` is already gone.

**5 — Accessible-name collision.** An in-scene label that becomes focusable double-matches every
`getByRole("button", { name: /^Region/ })` in `e2e/map.spec.ts` and fails strict mode.
*Mitigation:* in-scene HTML is `<div aria-hidden="true">`, always. Crest `<img>` inside ledger
buttons gets `alt=""`. Add a Playwright assertion that each region button resolves to exactly one
element.

**6 — GPU memory across route changes.** `MapScene` already disposes the renderer and `Effects`
already disposes its render targets. Eleven slabs add 22 node materials, 11 extruded geometries and
11 lattice geometries.
*Mitigation:* build geometries in a `useMemo` keyed on nothing and dispose in its cleanup; navigate
away and back 10× with the memory panel open before calling it done.

**7 — Palette migration is a whole-app diff.** Changing the surface and ink ramps touches all six
routes.
*Mitigation:* it is Phase 0, its own commit, with a visual pass on every route before anything 3D
lands.

**8 — Seam artifacts.** Shared vertices are exact in the data but bevels can still overlap.
*Mitigation:* the partition test covers topology; a 0.004-unit inset per slab hides sub-pixel
seams; `bevelSize` stays under half the inset.

**9 — Bundle regression.** `three/webgpu` is ~668 KB minified before gzip.
*Mitigation:* it is already lazy behind `next/dynamic` + `ssr: false`, and this plan only removes
imports (`three-stdlib`, `SVGLoader`, the plate JPEG, eventually drei). Assert it: check the build
output for `three` in any shared chunk before each push.

---

## 9. Build order

Each phase ends in something that ships and something you can check.

**P0 — Palette and data joins. No 3D. (~0.5 d)**
Migrate `app/globals.css` to the ruled tokens, add `--color-gold-*` and `--color-ember-400`, fix the
`parch-500` contrast defect. Add `src/map/palette.ts` and `src/map/data/regionMetrics.ts`. Put quest
counts into the existing planner.
*Verify:* `npm run build && npm test && npm run test:e2e` green; all six routes eyeballed; every
text token measured at ≥4.5:1.

**P1 — Rings and the flat board. (~1 d)**
Write `scripts/bake-region-draft.mjs`, hand-author `regionShapes.ts` from its draft, add
`regionShapes.test.ts`, build `FlatBoard.tsx`, wire it as both the loading skeleton and the
WebGPU-less state.
*Verify:* `npm test` covers the partition; the fallback path completes a full 3-pick plan; `no
WebGPU` copy intact; the board is recognisably Gielinor at a glance.

**P2 — Slabs replace the plate. (~1 d)**
Delete `MapPlane` and the JPEG. Mount extruded slabs with flat palette colours and no TSL yet.
Raise/sink by lock state. Crest decals, count chips.
*Verify:* screenshot at 1440×900; no request for `league-map.jpg` on `/map`; `three` absent from the
shared chunk; memory flat across 10 route round-trips.

**P3 — Camera. (~0.5 d)**
`OrbitControls` out, spherical framing solver in, per-region framings authored, pointer parallax,
reduced-motion cut.
*Verify:* clicking a ledger row lands the camera on that slab; the board cannot be tumbled; every
frame of every transition looks composed; reduced motion cuts hard; the frameloop sleeps when the
pointer stops.

**P4 — Materials. (~1 d)**
Cap and wall TSL graphs, strata, roots, hex barrier lattice, the shared grade pass, the new light
rig.
*Verify:* squint test — the eleven read as one board; locked slabs read as locked with no legend;
frame time at 1440p on a mid-range discrete GPU.

**P5 — Vines, unlock transition, bloom. (~0.5 d)**
`VineFrame.tsx` bound to pick count; `<Effects />` enabled and scoped to focus rim + unlock sweep.
*Verify:* `grep -rn "@keyframes\|animation:" src/` returns nothing on the map route; the canvas is
asleep with the pointer parked; `bot-audit` verdict is PASSES or documented SMELL only.

**P6 — Density and layout. (~0.5 d)**
New `app/map/page.tsx` three-zone shell, `Page wide`, `RegionLedger` + `RegionInspector` with the
stat strip.
*Verify:* the four `data-readability` self-tests at 1440×900; ≥70% content fill measured, not
estimated; the full route fits 900 px without scrolling; e2e green unchanged.

Total ~5 days.

---

## 10. Things in the code that contradict the brief

1. **`docs/3d-map-handoff.md` is stale as a spec and wrong as a description.** It says
   `app/map/page.tsx` is a `<Stub />`, `data/league/regions.json` is empty, `src/league/index.ts` is
   `export {}`, `public/` is empty, and no 3D libraries are installed. All five are false now. Put a
   superseded banner on it.

   Decision #2 has since been corrected: wiki and game art *are* usable under CC BY-NC-SA with
   attribution, and the real ban is copying another tool's interface. Authored geometry is still the
   right call for the board — the plate carries Jagex's own baked-in markers, so overlaying ours
   doubles every one — but that is now a design reason, not a licensing one, and tracing the world
   map for coastline fidelity is allowed.

2. **`app/globals.css` is on the old palette.** The gem ramp and the Order/Chaos/Balance triad match
   the ruling exactly. Nothing else does: surface is `#0e0d0b / #171613 / #1c1a17 / #23211d` where
   the ruling says `#0d0a07 / #14100b / #1b1610 / #231d15`; ink is `#e8e3d6 / #cfc7b4 / #a99f88 /
   #7d7462` where the ruling says `#efe7d5 / #d3c8b0 / #a2957a / #8b7f68`; and `brass-*`
   (`#d9b84a / #c9a227 / #8f721b`) is a different colour from `gold-*` (`#f3c97b / #e0b264 /
   #a87c3c`). There is no ember token at all.

3. **`--color-parch-500: #7d7462` is a live contrast defect.** `equilibrium-ui` records that
   `#7a6f5b` failed at 3.86:1 and was replaced by `#8b7f68` at 4.87:1. `#7d7462` sits in the same
   failing band and it is used in 13 places, including the map credit, the ledger's
   "start"/"first milestone" labels and the source-count line.

4. **`MapScene.tsx` lights are the wrong temperature.** `#cfd8c8`, `#e4efd6` and `#7fd0a8` are cool
   sage and mint over a warm-umber palette. The board cannot read warm under them. Background
   `#0e0d0b` is also the old token.

5. **Inline hex in the scene.** `MapTable.tsx` hardcodes `0x2ecb8f`, `0x33453b`, `0x17140f` and
   `MapScene.tsx` hardcodes four more. `equilibrium-ui`: "Inline hex is a defect." Two of those
   colours (`0x33453b`, `0x17140f`) are not in the palette at all.

6. **`CameraRig.tsx` ships free orbit**, which is the opposite of the locked-camera direction, and
   it costs bundle: `drei/core/OrbitControls.js:4` pulls `three-stdlib`, which peer-deps `'three'`,
   into a chunk that already carries `three/webgpu`. `drei/web/Html.js:4` imports `'three'`
   directly for the same reason. (Both builds share `build/three.core.js`, so there is no
   duplicate-class hazard — but the WebGL export surface is riding along for nothing.)

7. **`Effects.tsx` is imported but never mounted** (`MapScene.tsx:8` imports it, `:82` comments out
   the JSX). It is in the chunk graph today doing nothing. Either enable it — which this plan does —
   or delete the import.

8. **`e2e/map3d.spec.ts` cannot fail.** `canvas.or(fallback)` matches on every branch, so the test
   asserts nothing about the 3D and nothing about the fallback. It should assert that the region
   ledger completes a 3-pick plan regardless of which branch rendered.

9. **The credit line outlives its subject.** `MAP_IMAGE.credit` renders under the canvas
   (`MapScene.tsx:85`) and says "Map image: Jagex…". Once the plate is gone that sentence is false;
   the honest replacement credits the layout, not an image we no longer show.

10. **`src/map/RegionPlanner.tsx` lives under `src/map/` but has no 3D dependency** and is imported
    by a server component (`app/map/page.tsx:4`). That is correct today and worth keeping explicit:
    the fencing rule is about `three`, not about the directory, and `RegionPlanner` /
    `RegionLedger` / `FlatBoard` must all stay `three`-free so they can render without the canvas.
