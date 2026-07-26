# Agent L — Shell + Build + Map DOM (R4 production polish)

**Scope:** contrast / readability only on Nav, Build planner, Map DOM rail + inspector, Overview secondary copy. No three.js, no palette token edits, no e2e string changes.

## Law applied

From R2–R3 tournament + `equilibrium-ui`:

| Role | Token | Notes |
|---|---|---|
| Primary body / names | `parch-50` | Table cells, titles |
| Secondary body / readable meta | `parch-100` | Inactive nav, purpose lines, inspector dt, secondary sentences |
| Quiet meta / captions | `parch-300` | Counts strip, availability tags, sources line |
| Avoid as readable ink | `parch-400` / `parch-500` | Was muddy brown-on-umber; demoted off live surfaces |

Density: labels prefer **12px** (`text-xs`) over 10.5–11px when they must be read.

## Changes

### `src/components/Nav.tsx`
- Inactive links: `parch-300` → **`parch-100`** (active stays gem-400; hover parch-50).
- Frozen brand string `EQUILIBRIUM` untouched.

### `src/components/BuildPlanner.tsx`
- Segment meta strips: `parch-400` → `parch-300` / `parch-100`.
- Hex caption “starting here”: 11px `parch-300` → **12px `parch-100`**.
- Barred quest num: `parch-500` → `parch-300`.
- Relic/blessing effect prose and empty states lifted off `parch-400/500`.
- Blessing tier index: 10.5px `parch-500` → **12px `parch-300`**.
- Path column labels: 11px → **12px**.
- Share blurb + help + pick summary: `parch-100` / `parch-300`.
- Inspector: uppercase label `parch-300` at 12px; dt rows **13px `parch-100`**; skill chips `text-xs`; hard rules `text-sm`.
- Frozen strings: `Clear picks`, `0/3` / `…/3` counter format unchanged.

### `src/map/RegionLedger.tsx`
- Locked/unlocked row ink: locked uses **`parch-100`** (still dimmed via opacity when pick-blocked).
- Quest count: **`parch-100`** (data, not murk).
- Availability tags + “Elective — pick 3 of 8”: `parch-500` → **`parch-300`**.
- `Clear picks` action: **`parch-100`** (literal string preserved; disabled opacity only).
- No canvas / three changes.

### `src/map/RegionInspector.tsx`
- Unlock line, filter chips (off), empty states, warnings, sources live region: off `parch-500` onto **`parch-300`** / **`parch-100`**.
- Planner value heading: 11px `parch-500` → **12px `parch-300`**.
- Unanchored place chips: `parch-500` → `parch-300`.
- Confirmed status cell: `parch-300`.
- Boundary rules summary hover ladder lifted.
- `section[aria-live]` still emits `N source(s) · verified <date>` — pattern only, no date pin.

### `app/page.tsx`
- Status `dt`: `parch-100`; `dd`: **`parch-50`**.
- Planner purpose lines: `parch-300` → **`parch-100`**.
- Provisional task-point markers: `parch-100` (still distinguishable via `*`, not muddy).
- `PageHeading` note already `parch-100` — no change.

## Frozen e2e contract (not broken)

- Brand accessible name `EQUILIBRIUM`
- Nav six links
- `Clear picks` literal
- Pick counter `0/3` / `3/3` (and hydrate `…/3`)
- Region buttons named starting with display names
- `section[aria-live]` + `/sources? · verified <date>/`
- `no WebGPU` (untouched; lives in map fallback, not this pass)

## Intentionally not touched

- `@theme` parch hex values (already lifted in globals R4 comment block)
- `.stat-strip .stat-label` global (`parch-500`) — shared component class; override would fight specificity without a globals change
- Three.js / map materials / palette.ts
- Combat / Data / Tasks routes
