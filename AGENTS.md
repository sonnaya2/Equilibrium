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
| `league-data` | Regions, the 7 relic tiers, the 8 blessing tiers and God Tier derivation, tasks, the provisional rule |
| `data-sync` | `SourceReference` provenance, tracked-entity scanning, staleness, the sync report format |
| `equilibrium-ui` | Binding UI law: tokens, components, routes, map fence, e2e contracts, sanctioned exceptions |
| `no-slop-ui`, `human-grade`, `ui-humanizer`, `text-humanizer`, `bot-audit`, `data-readability` | Fingerprint bans, density, surgery, detection — product-aware; load after `equilibrium-ui` |
| `rs3-ponytail` | Lean-code intensity per domain |

`equilibrium-ui` is binding for chrome, stack, motifs, and Hybrid Composite 9.2 route DNA here.
Global anti-slop skills now multi-product route: EverSense Print/pink notes do not apply. Tailwind
v4 `@theme` is correct. Claude `frontend-design` is craft only (no marketing hero). Context7 for
library APIs (Next/Tailwind/R3F), not palette.

## Gotchas

**Deploys are automatic.** The Vercel project is git-connected, so any push to `main` ships to
production. There is no staging gate — run `npm run build`, `npm test` and `npm run test:e2e` locally
first.

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

**The 3D map is a wartable of original geometry** (`MapTable` / region slabs), not a photo plate —
there is no served `public/map/league-map.jpg`. Do not reintroduce a Regions-tab screenshot as the
board texture (it doubles Jagex markers and fights the slab model).

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

Load `equilibrium-ui` first, then `no-slop-ui` / `human-grade` for fingerprint law; run `bot-audit`
before calling a screen shippable. The tool opens on the working surface. Nothing here is being sold.

Visual identity is a **premium public game companion site** (not a developer console). Hybrid
composition champion (tournament 9.2):

| Layer | DNA |
|---|---|
| Colors | Editorial (Echo ladder in `@theme`) |
| Overview | Daylight courtyard / keyart aperture |
| Map | Editorial Board Sky — 3D top, detail under board, no side inspector |
| Tasks | Cipher Gallery Board (track + crest rail · card tiles · focus band) |
| Build | Editorial Relic Court (monogram frames until Jagex icons land) |
| Combat | Crystal desk + Editorial chrome |
| Data | Lattice + Daylight browse rail + full sources inspector |

Gem = interactive chrome only; gold = display; path triad = data. `equilibrium-ui` is binding.

Three references, zero clones: **2026 RS keyart / stone UI**, **RuneScape Wiki** density, **game
crests/icons**. No third-party tool layout clones.

**Art and design are separate rules, and only one of them is a ban.**

*Art is fair game.* Game assets, wiki imagery, world-map art, icons and map tiles can all be used.
The RuneScape Wiki is CC BY-NC-SA 3.0 and this is a free non-commercial fan tool, so credit it where
it shows and keep derived art under the same terms. Extracted game art (the region crests in
`public/game/`) is the identity — use more of it, not less. Procedural and script-generated
textures are fine too; only gen-AI imagery is banned.

*Copying another tool's design is the ban.* pvme.io, rs-analysis.xyz and leagues.build are for facts
and lessons. Never their layout, component structure, class names, or wording — if a screen would be
recognisable as theirs, it is wrong.

Top-level IA:

```
EQUILIBRIUM     Overview  Map  Tasks  Build  Combat  Data
```

`Build` holds Regions, Relics and Blessings (no Gear tab). `Combat` holds Quick, Setup, Analysis,
Rotation. Tasks gets a purpose-built interface rather than a generic checklist grid; while
Equilibrium has no published list it may show Catalyst stand-in data, marked provisional.

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
