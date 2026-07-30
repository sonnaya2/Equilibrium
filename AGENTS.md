# AGENTS.md — RS3 Equilibrium

Companion webapp for RuneScape 3's **Leagues II: Equilibrium** (launches 10 Aug 2026): build planner,
task tracker, and a from-scratch current-RS3 combat calculator with League modifiers layered on top.

Next.js App Router + TypeScript + Tailwind on Vercel. Game data is rebuilt into local SQLite and
static frontend shards during the build; user progress lives in `localStorage`.

- Remote `https://github.com/sonnaya2/Equilibrium`, public, default branch `main`
- Live `https://equilibrium-ruddy.vercel.app`, Vercel project `ever-sense/equilibrium`
- `CLAUDE.md` imports this file, so edit this one only
- Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.

## Detail lives in the area guides, not here

Read the guide for the area you are touching. They hold the working model this file deliberately does
not repeat.

| Guide                 | Covers                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `combat-math`         | Damage Potential, the 2026 DPL curve, crit layers, hit caps, style state, modifier order, rounding       |
| `league-data`         | Regions, relics, blessings, task presentation and data boundaries, Catalyst test data, provisional rules |
| `data-sync`           | `SourceReference` provenance, tracked-entity scanning, staleness, the sync report format                 |
| `equilibrium-ui`      | UI rules: reference precedence, Tasks browser contract, routes, map fence, e2e contracts, rendered QA    |
| `map-3d`              | Generated map data, WebGPU fence, controls, fallback, and rendered verification                          |
| `lean-implementation` | How much implementation a change deserves, and which complexity is load-bearing                          |

The full text lives in `.claude/skills/`; the tracked `skills/` files are one-line pointers to it.
A supplied reference and an explicit requirement both outrank anything written here — remove an
obsolete rule instead of stacking exceptions around it. General interface-review checklists are
detectors, never authority over a supplied visual reference, and `lean-implementation` limits code
and dependency weight, not visual quality or rendered iteration.

**Comment hygiene.** Keep comments for non-obvious mechanics, compatibility, safety, provenance, or
tool directives. Cut implementation history, decorative headings, notes about how the code was
produced, and prose that only restates the line below it.

## Gotchas

**Deploys are automatic.** The Vercel project is git-connected, so any push to `main` ships to
production. There is no staging gate — run `npm run build`, `npm test` and `npm run test:e2e` locally
first.

**Publish directly from the primary `main` checkout.** Do not create feature branches, extra
worktrees, or pull requests unless the user explicitly asks for one. Fetch and reconcile
`origin/main`, validate, commit on `main`, then push `main` directly.

**The repo is public.** Git identity here is the noreply address
(`299354192+sonnaya2@users.noreply.github.com`), set repo-locally because GitHub blocks pushes that
would publish the private one.

**Playwright runs on port 3100**, not 3000 — another app on this machine holds 3000. E2E is _not_ in
CI (`.github/workflows/validate.yml` stops at `build` — no Playwright job, optional or otherwise).
Run `npm run test:e2e` locally before pushing; a broken selector ships silently otherwise. WebGPU /
3D map paths are easy to flake in headless CI, so keep e2e local. Next refuses a second dev server
in the same directory, so a dev server you started yourself blocks `test:e2e` from booting its own;
stop it first.

**Do not pin sourced values in e2e.** `verifiedAt` dates and rule wording move with content patches,
and a hardcoded date turns every data refresh into a red suite. Match a pattern.

**Tailwind v4 is CSS-first.** There is no `tailwind.config`; design tokens live in the `@theme` block
of `app/globals.css`.

**React is pinned to exactly `19.2.8`** for the `@react-three/fiber` 9 peer range.

**The 3D map's geometry is generated from the HD Wiki raster and committed.** `npm run build:map`
cuts `public/map/world-surface-wiki.webp` into region plates, a terrain field and a POI atlas; the
app never does that work at runtime. Re-run it after patching the map seed data or swapping the
raster, and commit the outputs. Never hand-author region polygons — a previous set,
authored in uv against an older base image, ended up drawing borders in open ocean. See the
`map-3d` skill.

**Headless Chromium has no WebGPU adapter**, so `npm run test:e2e` skips every 3D assertion and the
board goes unverified. `npx playwright test -c playwright.webgpu.config.ts e2e/map-board.spec.ts`
runs the same specs in a headed off-screen Edge on port 3101, where the adapter is real. Use
Playwright for browser work here, and do not leave a dev server running in the background.

**`assets/` is not web-served.** It is the source library managed by `scripts/sync-assets.mjs`;
generated web assets live under `public/game/`. Run `node scripts/sync-assets.mjs --check` instead of
pinning a count in documentation.

## Boundaries that carry weight

**League planning is ironman / self-sufficient.** No GE dual mode and no trade-path splits — region picks, unlocks, and combos assume you source everything yourself. Blessings stay empty until official reveals.

**One editable data system.** Root `data/` contains one immutable compressed seed, SQL migrations,
and small JSONL content patches — that is the whole of the tracked authoring surface.
`.cache/equilibrium.sqlite`, `.cache/data/`, `public/data/v2/`, and the data reports are generated
build artifacts and are never committed. Do not add a hosted database, API, CMS, or second authoring
tree. Architecture and commands: `docs/data-platform.md`.

### Data editing rules

1. Never open or rewrite a complete generated dataset to change one record.
2. Never edit `.cache/equilibrium.sqlite` or `public/data/` manually.
3. Search with `npm run data:find`, inspect with `data:context`, and check `data:impact` first.
4. Make factual changes as validated JSONL operations under `data/patches/` with stable IDs and sources.
5. Run changed validation/export for record work; use `data:rebuild` for schema, pipeline, or taxonomy changes.
6. Do not replace the immutable seed unless a separately verified compaction migration requires it.

**Combat core has zero React dependency** and is unit-testable standalone. League Relics and Blessings
enter through the ruleset boundary rather than being baked into base formulas, so base RS3 math stays
independently validatable and can be toggled off for comparison.

**Generic target only.** Target settings stop at Defence, accuracy-relevant values, Damage Potential
override, size, HP%, vulnerability, poisonable, Slayer category, and creature-type flags. Boss
calculators, phase sims, kill-time and enrage math are out of scope; elsewhere in the planner, bosses
appear only as region unlocks or task associations.

**The 3D map is fenced inside `app/map/`.** The `<Canvas>` and everything under it is client-only,
loaded via `next/dynamic` with `ssr: false`. If `three` reaches the shared chunk, every other route
pays for it. Region planning stays completable without the 3D map ever loading — the 3D is the good
version of the experience, not a dependency of it.

**Unrevealed data stays empty.** An empty `records: []` is correct until a source exists. Never invent
a number to fill a stub, and never present a stale value as current — every combat and league number
carries its own `SourceReference`.

## Design

Read `equilibrium-ui` before UI work. Interface review checklists are a final pass, not a layout
generator or a reason to flatten hierarchy and depth.

Visual identity is a **premium public game companion site** (not a developer console):

| Area     | Direction                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------- |
| Colors   | Warm Editorial tokens in `@theme`                                                                   |
| Overview | plan overview / keyart aperture                                                                     |
| Map      | interactive map board — 3D top, detail under board, no side inspector                               |
| Tasks    | Reference-led League browser: summary cards · planner filters · spacious task cards · progress rail |
| Build    | region, relic, and blessing planner (monogram frames until Jagex icons land)                        |
| Combat   | combat calculator with clear calculation hierarchy                                                  |
| Data     | regional research browser with full sources inspector                                               |

Gem marks interactive state; gold marks display headings; path colors carry data meaning only.
Keep route-specific spacing and depth without reviving retired layouts.

Visual references: **2026 RS keyart / stone UI**, **RuneScape Wiki** density, and **game
crests/icons**. Do not clone third-party tool layouts.

**Art and design are separate rules, and only one of them is a ban.**

_Art is fair game._ Game assets, wiki imagery, world-map art, icons and map tiles can all be used.
The RuneScape Wiki is CC BY-NC-SA 3.0 and this is a free non-commercial fan tool, so credit it where
it shows and keep derived art under the same terms. Extracted game art (the region crests in
`public/game/`) is the identity — use more of it, not less. Procedural and script-generated
textures are fine too; only gen-AI imagery is banned.

_Licensing is load-bearing._ Original code is MIT (scoped — see `LICENSE`); wiki-adapted data is
CC BY-NC-SA 3.0; PvME-adapted notes are CC BY-NC-SA 4.0; Jagex art/marks stay under the Fan Content
Policy and are **not for sale**. Authoritative split: root `NOTICE`. Never re-label wiki/PvME JSON
as MIT-only, never strip `SourceReference`, never drop footer or `/sources` attribution. Never sell
`assets/` or `public/game/` as a product. PvME is discovery only until Wiki/Jagex re-verify.

_Copying another tool's design is the ban._ pvme.io, rs-analysis.xyz and leagues.build are for facts
and lessons. Never their layout, component structure, class names, or wording — if a screen would be
recognisable as theirs, it is wrong.

Top-level IA:

```
EQUILIBRIUM     Overview  Map  Tasks  Build  Combat  Data
```

`Build` holds Regions, Relics and Blessings (no Gear tab). `Combat` holds Quick, Setup, Analysis,
Rotation. Tasks uses a wide, polished card browser—not a dense table or generic checklist.
While Equilibrium has no published list it may show Catalyst stand-in data, unmistakably marked as
temporary test data. Do not fabricate categories, milestones, rewards, or unlock rules.

For `/tasks`, target a 1500-1650px desktop frame, five readable cards where space permits, a
300-340px progress rail, real gutters, strong 28-34px page hierarchy, custom-styled accessible
controls, and the shared Editorial stone surfaces with restrained gold. Gem belongs to active and
progression state, not a route-wide tint. Render against the supplied
reference, record the five largest mismatches, fix them, and render again before calling it done.

### Frozen UI contract

`e2e/` pins these and CI does not run Playwright, so treat them as API:

- brand link named exactly `EQUILIBRIUM`; a `<nav>` landmark containing the six links above
- footer string `RuneScape is a trademark of Jagex Ltd.`
- all 11 regions as `<button>` whose accessible name _starts with_ the display name — an icon inside
  one needs `alt=""` or the name breaks
- literal `0/3` and `3/3` pick counters; 4th pick `aria-disabled="true"` (still focusable); `Clear picks` always present (disabled when empty)
- `section[aria-live]` holding the region detail **under the board/ledger stack** (not a side inspector), matching `/sources? · verified <date>/`
- the substring `no WebGPU` in the WebGPU-absent fallback

## Commands

```bash
npm run dev          # next dev
npm run typecheck    # tsc --noEmit
npm run lint
npm run format:check
npm test             # vitest run
npm run test:e2e     # playwright, boots its own server on 3100
npm run build
npm run audit:data   # shipped-data gate
npm run build:data   # rebuild SQLite, remaining compatibility cache, and frontend shards
npm run normalize:data # alias for a clean data rebuild
```

`scripts/shots.mjs` and `scripts/shot-map3d.mjs` capture routes for before/after diffing; neither is
wired to an npm script.
