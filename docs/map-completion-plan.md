# Map completion plan

> **Status: phases 1–6 are landed.** Everything below is kept as the record of what
> the work was for and why each call was made. Two things were not in the plan and
> turned out to matter more than several things that were:
>
> - **Coastlines.** The rings are subdivided into curves in `src/map/data/regionCurve.ts`,
>   per edge in canonical node order so shared seams stay byte-identical. Interpolation
>   alone turned the islands into pebbles, so each span also gets a seeded perpendicular
>   displacement. `regionCurve.test.ts` holds the seam parity, the winding, and a new
>   invariant: a ring may not cross a region it shares no border with — which caught
>   Karamja sitting under Kandarin's south coast, invisible on the 3D board and plain
>   on the flat one.
> - **Geometry offsets.** `ExtrudeGeometry` puts its bevel *outside* the requested
>   depth, so anything laid on a cap has to clear `depth + bevelThickness`. That is
>   what hid the barrier lattice completely and left the crests z-fighting.

Supersedes phases P3–P6 of `docs/wartable-plan.md`. That document still holds the
design rationale and the region-geometry decision; this one is the work queue from
here, written against what is actually on screen rather than what was projected.

## Where it stands

Kimi landed P0–P2 plus a texture/dispose fix. The data layer is genuinely good and
is not the problem: the region ledger, the inspector with its 17-row content table
carrying `INFERRED`/`confirmed` status, source counts with verified dates, the
"what each pick opens" table and the boundary rules all work and all read from
canonical data. Geometry, invariant tests, the flat SVG fallback and the extruded
slabs are in. `npm test` is 158/158 and typecheck is clean.

What is missing is everything that makes it *look* like a war table, plus the
interaction that makes it a map rather than a diagram.

## The problems, in the order they hurt

### G1 — the board is nearly black. One root cause.

`RegionSlab` sets cap albedo to `SURFACE_RAISED` (`0x231d15`) and wall albedo to
`EDGE_LINE` (`0x332a1e`). Those are **UI chrome tokens** — they are the values a
flat DOM panel should *end up* being on screen. Used as albedo under a
`meshStandardMaterial`, lighting multiplies them down, so a token meant to read as
`#231d15` renders far darker than that. The palette is being applied one stage too
late in the pipeline.

Compounding it: the lights are still the original cool sage and mint
(`#cfd8c8`, `#e4efd6`, `#7fd0a8`) over a warm umber board, which was flagged in the
original plan's §10.4 and never changed. There is no rim light, so extruded edges
never separate from the ground.

Fix is not "raise the brightness" — it is to stop using chrome tokens as albedo,
and to light the board deliberately.

### G2 — no materials at all

P4 never happened, so:
- the extruded walls are a flat fill, which means **the exposed-underearth premise
  is entirely invisible** — strata are the reason the slabs are extruded
- locked slabs have no barrier lattice, so lock state reads only as "slightly darker"
- every region has the identical surface, so the board is eleven identical shapes

Eleven seamless terrain tiles already exist for this, built from the plan's own
parameter table and seam-verified. They are sitting unused in the scratchpad.

### G3 — count chips sit on top of the crests

`RegionSlab` places the crest quad and the count `<Html>` at the same `mx, mz`,
separated only in Y. From the camera they overlap: "94" lands on Kandarin's shield,
"19" on Karamja's, "4" on Havenhythe's. Both are unreadable as a result.

### G4 — the canvas is mostly empty

62vh of canvas with the board occupying roughly the middle 40%. Large dead black
margins on all four sides. `data-readability` calls empty flanks a defect on a
working view.

### G5 — no selection state on the board

Clicking a region updates the DOM panels but nothing on the board changes. The map
and the data are two separate things sharing a page.

### F1–F5 — the missing features

- **Camera.** `CameraRig` still uses `OrbitControls` + `three-stdlib`. The authored
  per-region framings exist in `regionShapes.ts` but nothing consumes them, so the
  board can be tumbled into meaningless angles and never frames a region.
- **Selection does not open anything.** The requested behaviour — the picked tile
  grows and its content moves onto a filterable panel — does not exist.
- **No location markers.** Region content is listed as table rows; none of it is
  placed on the map, so the map answers "which shape is this" but never "where is
  the thing".
- **`Effects` is imported and commented out** at `MapScene.tsx:114` — dead weight in
  the chunk today, and no unlock or focus treatment exists.
- **Terrain textures unused.**

### L1 — the page is a 2646px scroll with duplication

Four stacked sections where "What each pick opens" duplicates the ledger's numbers
and "Boundary rules" duplicates rules already shown in the inspector. Comparing two
regions requires scrolling, which is the head-still rule broken.

---

## Plan

Each phase ends shippable and verifiable. Phases 1–3 are the pain point; 4–6 are the
features.

### Phase 0 — reconcile what is uncommitted (30 min)

`regionShapes.ts` and `MapTable.tsx` are dirty in the working tree with my changes:
the 11 authored camera framings (which is also what makes the tree compile — the
`framing` field is required and had no data), denser geometry (~50 border nodes to
~100, seams as shared polylines), and a per-mount texture fix.

Kimi's `6b30572` fixed the same texture crash a different way, in `MapScene` by
deferring renderer dispose past the StrictMode replay. **Determine whether both are
needed**: run `scripts/probe-map-texture.mjs` with my `MapTable` change reverted. If
Kimi's fix alone holds, drop mine — one fix is better than two overlapping ones.

Then commit. Everything after this assumes a clean tree.

### Phase 1 — make the board legible (half day)

The single highest-value phase. Nothing else matters while the board is black.

1. **Split the palette.** Add a `TERRAIN_*` group to `src/map/palette.ts` for lit
   albedo, distinct from the `SURFACE_*` chrome tokens. Chrome tokens stay for DOM
   and for unlit/basic materials only. Add a comment saying why, because this is
   exactly the trap that was fallen into once.
2. **Relight.** Key `#f0dcb4` at ~1.5 from `[1.6, 2.4, 0.9]`; ambient fill `#463a29`
   at ~0.35; rim `#2ecb8f` at ~0.4 from `[-1.8, 1.2, -1.6]` so unlocked slab edges
   separate from the void. Background `#0d0a07`.
3. **Ship the terrain tiles.** Copy the 11 seam-verified PNGs to
   `public/game/terrain/`, add the mirror to `scripts/sync-assets.mjs`, and sample
   them as the cap map. Downscale to 256px first — 1.4 MB at 512 is more than a
   slab needs.
4. **Strata on the walls.** The wall material remaps world Y into four bands
   (topsoil `#463a29`, subsoil `#332a1e`, rock `#1b1610`, deep rock `#14100b`) with
   noise-perturbed boundaries so they are not perfect stripes. This is the payoff
   for extruding at all.
5. **Separate crest and count.** Offset the count chip along the slab's minor axis
   so it sits beside the crest, not on it. Give it the `.slab-chip` plate it already
   has a class for.

**Verify:** screenshot at 1440×900; every region distinguishable at a glance; body
contrast ≥4.5:1; the squint test leaves the biggest number as the focal point.

### Phase 2 — camera (half day)

Delete `OrbitControls` and the `three-stdlib` import — it is the only thing pulling
that package into the map chunk. Replace with the spherical solver the framings were
authored for: lerp `azimuth`/`elevation`/`radius`/`target`/`fov`, never cartesian
position, so a move between two far-apart regions arcs over the board instead of
cutting through it. `k = 1 - exp(-delta * 6.5)`, settling ~350 ms, `invalidate()` on
every moving frame, hard cut under `prefers-reduced-motion`.

Pointer parallax applied *after* the framing solve, clamped to ~±1.7°/±0.9°, zero
under reduced motion. Input-driven, so it does not violate the idle-motion rule and
the frameloop still sleeps.

Focusing a ledger row drives the camera. `onPointerMissed` returns to `TABLE_FRAMING`.

**Verify:** the board cannot be tumbled; every transition is a composed shot; the
loop sleeps with the pointer parked.

### Phase 3 — selection you can feel (half day)

The requested behaviour, and what turns the board into a map:

- The selected slab rises further and gets the focus rim; every other slab drops
  slightly and desaturates. Enable `<Effects />` scoped to exactly two states — the
  focus rim and the unlock sweep (ember → gem, ~600 ms, never at rest). Nothing is
  emissive when idle.
- Locked slabs sink into their sockets behind the green hex barrier lattice, read
  from world XZ so the grid is continuous across neighbours rather than per-slab.
- The unlock transition is one `lockAmount` uniform animating: the rise, the colour
  return and the barrier fade all key off it.

**Verify:** lock state is readable with no legend; `grep -rn "@keyframes\|animation:"
src/map/` finds nothing.

### Phase 4 — location markers (1 day)

The "where is the thing" answer. `data/research/catalog.json` already carries per-region
content, upgrades and training rows; several have area names that resolve to known places.

- Add `src/map/data/placeAnchors.ts`: uv positions for the named areas already in the
  data (Lumbridge, Varrock, Falador, Prifddinas, Menaphos…). Hand-authored, same
  pattern as the border nodes, with a test that every anchor resolves to a real
  catalog area and lands inside its region's ring.
- Render as small markers on the slab, only for the focused region — showing 100+
  markers at once would be noise. Marker style follows the crest treatment.
- Wiki icons are now sanctioned, so activity icons (boss, skilling, dungeon) can come
  from the wiki under CC BY-NC-SA with the attribution already on `/sources`.

**Verify:** focusing a region shows its places; nothing renders for unfocused regions;
anchors test passes.

### Phase 5 — the inspector panel and filters (1 day)

Fixes L1 and delivers the filterable popup.

- Collapse the four stacked sections into a stage + docked inspector. "What each pick
  opens" and "Boundary rules" fold into the inspector rather than repeating below it.
- The inspector gets filters over the content table: kind (boss / skilling / dungeon /
  quest), status (`confirmed` vs `INFERRED`), and a text match. The status filter is
  the valuable one — it lets a player see only what is actually confirmed.
- Selecting a content row highlights its marker on the board, and vice versa. That
  is the map-to-data link the whole route exists for.
- Keep the frozen e2e contract intact: 11 region `<button>`s whose accessible name
  starts with the display name, `0/3`/`3/3`, a genuinely disabled 4th pick,
  `Clear picks`, `section[aria-live]`, and `no WebGPU` in the fallback. Nothing inside
  the canvas may be a button or carry a region name — two matches is a strict-mode
  violation.

**Verify:** full route fits 1440×900 without scrolling; ≥70% content fill measured;
`npm run test:e2e` green.

### Phase 6 — vines and polish (half day)

`VineFrame.tsx` as an SVG overlay outside the canvas, bound to the pick count:
`stroke-dashoffset` driven by `--picks`, 180 ms per element, corners staggered. It
grows as picks are spent and retracts on `Clear picks`, so it is a peripheral read of
build progress rather than decoration. Renders identically in the 2D fallback, and
costs the canvas nothing.

You asked for animated vines specifically. Idle sway is available if you want it —
say so and it ships as a documented exception in `equilibrium-ui`; the default here is
state-driven only because that is what the design law prefers, not because the request
was refused.

Then the flat board gets the same terrain treatment so the no-WebGPU path is not a
poor relation.

---

## Running order and cost

| Phase | What | Cost |
|---|---|---|
| 0 | Reconcile uncommitted, drop the duplicate texture fix | 0.5 h |
| 1 | **Legibility: albedo split, lighting, terrain, strata, chip** | 0.5 d |
| 2 | Camera: framings, spherical solver, drop OrbitControls | 0.5 d |
| 3 | Selection, barrier lattice, unlock sweep, Effects on | 0.5 d |
| 4 | Location markers | 1 d |
| 5 | Inspector, filters, layout collapse | 1 d |
| 6 | Vines, fallback parity | 0.5 d |

~4.5 days. Phase 1 alone removes most of the complaint.

## Verification, every phase

```bash
npm run typecheck && npm test && npm run build
```

```bash
npm run test:e2e
```

Plus: `node scripts/probe-map-texture.mjs` for console cleanliness, a 1440×900
screenshot compared against the previous phase, and `bot-audit` before calling the
route done. Contrast gate on every ink token against the surface it sits on.
