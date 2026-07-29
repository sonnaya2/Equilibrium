# AGENTS.md — RS3 Equilibrium

Companion webapp for RuneScape 3's **Leagues II: Equilibrium** (launches 10 Aug 2026): build planner,
task tracker, and a from-scratch current-RS3 combat calculator with League modifiers layered on top.

Next.js App Router + TypeScript + Tailwind on Vercel. No backend and no database — game data ships as
static JSON in `data/`, user progress lives in `localStorage`.

- Remote `https://github.com/sonnaya2/Equilibrium`, public, default branch `main`
- Live `https://equilibrium-ruddy.vercel.app`, Vercel project `ever-sense/equilibrium`
- `CLAUDE.md` imports this file, so edit this one only
- Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.

## Detail lives in skills, not here

Load these when working in their area. They hold the working model this file deliberately does not
repeat.

| Skill | Covers |
|---|---|
| `combat-math` | Damage Potential, the 2026 DPL curve, crit layers, hit caps, style state, modifier pipeline, rounding |
| `skills/league-data/SKILL.md` | Regions, relics, blessings, task presentation/data boundaries, Catalyst test-data law, provisional rules |
| `data-sync` | `SourceReference` provenance, tracked-entity scanning, staleness, the sync report format |
| `skills/equilibrium-ui/SKILL.md` | Authoritative UI law: reference precedence, Tasks browser contract, routes, map fence, e2e contracts, rendered QA |
| `no-slop-ui`, `human-grade`, `ui-humanizer`, `text-humanizer`, `bot-audit`, `data-readability` | Optional audit companions; use as detectors, never as authority over a supplied visual reference |
| `rs3-ponytail` | Lean-code intensity per domain |

`skills/equilibrium-ui/SKILL.md` and `skills/league-data/SKILL.md` are authoritative. Their protected
`.agents/skills/` auto-discovery copies are legacy and must not govern work.
Supplied references and explicit user requirements override historical tournament treatments;
remove obsolete rules instead of stacking exceptions around them. `rs3-ponytail` limits code and
dependency weight, not visual quality or rendered iteration.
Global anti-slop skills now multi-product route: EverSense Print/pink notes do not apply. Tailwind
v4 `@theme` is correct. Claude `frontend-design` is craft only (no marketing hero). Context7 for
library APIs (Next/Tailwind/R3F), not palette.

**Comment hygiene.** Keep comments for non-obvious mechanics, compatibility, safety, provenance, or
tool directives. Remove agent/prompt/pass/reviewer notes, implementation history, decorative
headings, and prose that only restates the code.

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

**Playwright runs on port 3100**, not 3000 — another app on this machine holds 3000. E2E is *not* in
CI (`.github/workflows/validate.yml` stops at `build` — no Playwright job, optional or otherwise).
Run `npm run test:e2e` locally before merge; a broken selector ships silently otherwise. WebGPU /
3D map paths are easy to flake in headless CI, so keep e2e local. Next refuses a second dev server
in the same directory, so a dev server you started yourself blocks `test:e2e` from booting its own;
stop it first.

**Do not pin scraped values in e2e.** `verifiedAt` dates and rule wording move whenever the sync
scripts run, and a hardcoded date turns every data refresh into a red suite. Match a pattern.

**Tailwind v4 is CSS-first.** There is no `tailwind.config`; design tokens live in the `@theme` block
of `app/globals.css`.

**React is pinned to exactly `19.2.8`** for the `@react-three/fiber` 9 peer range.

**Worktrees start without `node_modules`.** Run `npm ci` in a fresh one.

**The 3D map's geometry is generated from the HD Wiki raster and committed.** `npm run build:map`
cuts `public/map/world-surface-wiki.webp` into region plates, a terrain field and a POI atlas; the
app never does that work at runtime. Re-run it after editing `data/map/region-seeds.json` or
swapping the raster, and commit the outputs. Never hand-author region polygons — a previous set,
authored in uv against an older base image, ended up drawing borders in open ocean. See the
`map-3d` skill.

**Headless Chromium has no WebGPU adapter**, so `npm run test:e2e` skips every 3D assertion and the
board goes unverified. `npx playwright test -c playwright.webgpu.config.ts e2e/map-board.spec.ts`
runs the same specs in a headed off-screen Edge on port 3101, where the adapter is real. Use
Playwright for browser work here, and do not leave a dev server running in the background.

**`npm run sync:league:disabled` (was `sync:league`) exits 1** — it used to write a blessings/relics
envelope the app cannot read. League planner JSON is produced by `npm run normalize:data`.

**`assets/` is not web-served.** It holds 121 real RS3 PNGs (11 region crests, 29 skill icons, 10
combat icons) managed by `scripts/sync-assets.mjs`. Art reaches the app through `public/game/`.

## Boundaries that carry weight

**League planning is ironman / self-sufficient.** No GE dual mode and no trade-path splits — region picks, unlocks, and combos assume you source everything yourself. Blessings stay empty until official reveals.

**One data store.** Root `data/combat/*.json` and `data/league/*.json` are canonical, written by the
sync scripts. `src/combat/data/` only reads and types them — a parallel copy under `src/` means two
sources of truth and one of them is wrong.

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

Read `skills/equilibrium-ui/SKILL.md` before UI work. Use anti-slop skills as a final fingerprint
audit, not as a layout generator or a reason to flatten hierarchy and depth.

Visual identity is a **premium public game companion site** (not a developer console):

| Area | Direction |
|---|---|
| Colors | Warm Editorial tokens in `@theme` |
| Overview | plan overview / keyart aperture |
| Map | interactive map board — 3D top, detail under board, no side inspector |
| Tasks | Reference-led League browser: summary cards · planner filters · spacious task cards · progress rail |
| Build | region, relic, and blessing planner (monogram frames until Jagex icons land) |
| Combat | combat calculator with clear calculation hierarchy |
| Data | regional research browser with full sources inspector |

Gem marks interactive state; gold marks display headings; path colors carry data meaning only.
Keep route-specific spacing and depth without reviving retired layouts.

Visual references: **2026 RS keyart / stone UI**, **RuneScape Wiki** density, and **game
crests/icons**. Do not clone third-party tool layouts.

**Art and design are separate rules, and only one of them is a ban.**

*Art is fair game.* Game assets, wiki imagery, world-map art, icons and map tiles can all be used.
The RuneScape Wiki is CC BY-NC-SA 3.0 and this is a free non-commercial fan tool, so credit it where
it shows and keep derived art under the same terms. Extracted game art (the region crests in
`public/game/`) is the identity — use more of it, not less. Procedural and script-generated
textures are fine too; only gen-AI imagery is banned.

*Licensing is load-bearing.* Original code is MIT (scoped — see `LICENSE`); wiki-adapted data is
CC BY-NC-SA 3.0; PvME-adapted notes are CC BY-NC-SA 4.0; Jagex art/marks stay under the Fan Content
Policy and are **not for sale**. Authoritative split: root `NOTICE`. Never re-label wiki/PvME JSON
as MIT-only, never strip `SourceReference`, never drop footer or `/sources` attribution. Never sell
`assets/` or `public/game/` as a product. PvME is discovery only until Wiki/Jagex re-verify.

*Copying another tool's design is the ban.* pvme.io, rs-analysis.xyz and leagues.build are for facts
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
- all 11 regions as `<button>` whose accessible name *starts with* the display name — an icon inside
  one needs `alt=""` or the name breaks
- literal `0/3` and `3/3` pick counters; 4th pick `aria-disabled="true"` (still focusable); `Clear picks` always present (disabled when empty)
- `section[aria-live]` holding the region detail **under the board/ledger stack** (not a side inspector), matching `/sources? · verified <date>/`
- the substring `no WebGPU` in the WebGPU-absent fallback

## Commands

```bash
npm run dev          # next dev
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:e2e     # playwright, boots its own server on 3100
npm run build
npm run normalize:data
```

`scripts/shots.mjs` and `scripts/shot-map3d.mjs` capture routes for before/after diffing; neither is
wired to an npm script.
