# Equilibrium

Fan-made companion for RuneScape 3 **Leagues II: Equilibrium** (launches 10 August 2026).

Plan regions, Relics, and Blessings; track tasks; browse regional research; and run a
from-scratch current-RS3 combat calculator with league modifiers layered on top — in one place
instead of juggling reveal posts, Wiki tabs, spreadsheets, and a separate DPS tool.

**Live:** `<NEW_HOMEPAGE_URL>`  
**Source:** `<NEW_REPOSITORY_URL>`

Unofficial, non-commercial fan project. Not affiliated with or endorsed by Jagex.
RuneScape is a trademark of Jagex Ltd.

---

## Features

| Route | What it does |
| ----- | ------------ |
| **Overview** | Plan overview and key art |
| **Map** | Interactive world map (WebGPU 3D when available) for the three elective region picks and what each unlocks |
| **Tasks** | Task browser and progress tracking |
| **Build** | Regions, Relics, and Blessings planner (no separate gear tab) |
| **Combat** | Current-RS3 combat calculator; league rules enter through a separate ruleset boundary |
| **Data** | Regional research browser with per-record sources |

Progress is stored in the browser (`localStorage`). There are no accounts and no hosted user API.

---

## Current status

**Working today**

- Region map, build state (regions / Relics / Blessings), and the data browser
- Quest and research records generated from revision-pinned Wiki data with source links
- Combat engine rebuilt for post-2026 RS3 math (still under active development)
- Local-first data pipeline: SQLite at build time, static routes, no CMS

**Limitations**

- **Tasks** may use **Catalyst** stand-in data while Equilibrium’s official list is incomplete.
  Stand-ins are marked as temporary test data. Confirmed Equilibrium tiers (Easy–Master) and the
  10–400 point range are kept; middle values that came from Catalyst stay marked provisional until
  an Equilibrium source replaces them.
- Unrevealed league content stays **empty** — no invented numbers to fill stubs.
- League planning assumes **ironman / self-sufficient** play (no GE dual mode or trade-path splits).
- Combat targets stay **generic** (defence, accuracy-relevant stats, size, HP%, flags). No boss
  phase sims, kill-time, or enrage calculators.
- Headless browsers have no WebGPU; 3D map checks need a headed WebGPU-capable browser.

Pushes to `main` deploy to production (Vercel). Run checks locally before pushing.

---

## Local setup

Requires **Node.js 22+** (the data layer uses built-in `node:sqlite`).

```bash
npm ci
npm run dev
```

`predev` / `prebuild` / `pretest` rebuild game data into local SQLite and frontend artifacts.
Open the URL Next prints (default `http://localhost:3000`).

### Before you push

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Playwright starts its own server on **port 3100** by default (another app may already use 3000).
Stop a dev server from the same checkout first if the e2e runner would conflict, or set
`PLAYWRIGHT_PORT`. WebGPU / 3D map paths are validated separately with:

```bash
npm run test:e2e:webgpu
```

---

## Principal commands

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Next.js dev server (rebuilds data first) |
| `npm run build` | Production build (rebuilds data first) |
| `npm start` | Serve a production build |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier check |
| `npm test` | Vitest unit tests |
| `npm run test:combat` | Combat engine unit tests only |
| `npm run test:e2e` | Playwright e2e (managed local server) |
| `npm run test:e2e:webgpu` | Headed WebGPU map board specs |
| `npm run data:rebuild` | Rebuild SQLite and generated frontend artifacts |
| `npm run audit:data` | Full data rebuild + architecture / provenance gates |
| `npm run data:find -- --query "…"` | Search tracked entities |
| `npm run data:context -- --id …` | Inspect one record |
| `npm run data:impact -- --id …` | Downstream impact of a record change |
| `npm run data:canonical:export` | Re-export `data/canonical/` from the validated DB |
| `npm run data:canonical:validate` | Structural + parity checks on canonical data |
| `npm run art:check` | Art provenance / index / alias / duplicate gate |
| `npm run art:index` | Regenerate icon index from `public/game` |
| `npm run build:map` | Rebuild map terrain plates and POI atlas |

Data patch workflow and ownership rules: [`CONTRIBUTING.md`](./CONTRIBUTING.md) and
[`docs/data-platform.md`](./docs/data-platform.md).

---

## Architecture

```text
app/                 Next.js App Router routes (Overview, Map, Tasks, Build, Combat, Data, Sources)
src/combat/          Standalone combat engine (no React dependency)
src/league/          Regions, Relics, Blessings, share/persistence
src/tasks/           Task models and presentation
src/research/        Typed access to normalized research catalog
src/map/             3D map (client-only; fenced under app/map/)
src/components/      Shared UI
src/lib/             Browser helpers, wiki helpers, storage

data/canonical/      Tracked JSONL mirror of the validated database (build input)
data/migrations/     SQLite schema (forward-only)
data/patches/        Small JSONL content operations (reviewable facts)
asset-catalog/       Art provenance metadata only (images live under public/)
scripts/data/        SQLite pipeline, query CLI, validation, export
public/game/         Game art served as-is (path = URL)
public/map/          Generated map plates, terrain field, POI atlas
```

**Stack:** Next.js (App Router) · TypeScript · React 19 · Tailwind CSS v4 · Vitest · Playwright.
Optional 3D map: Three.js / React Three Fiber (loaded only on `/map`).

**Combat boundary:** Base RS3 formulas live in `src/combat/` and are unit-testable alone. League
Relics and Blessings enter through a ruleset layer so base math stays independently validatable.

**Map fence:** WebGPU/Three code is client-only under `app/map/` via `next/dynamic` with `ssr: false`,
so other routes do not pay for the 3D bundle. Region planning remains usable without the 3D board.

---

## Data and provenance

Game data is built at compile time, not fetched from a hosted database:

```text
data/canonical/*.jsonl  +  migrations  +  patches
        →  .cache/equilibrium.sqlite
        →  validation / reports
        →  .generated/ build shards (imported at build; not published under public/data/)
```

- **Tracked authoring surface:** `data/canonical/`, `data/migrations/`, `data/patches/`.
- **Generated (never commit):** `.cache/`, `.generated/`, most of `reports/`.
- **Do not hand-edit** `data/canonical/` or the SQLite file. Fix facts with a patch under
  `data/patches/`, then rebuild / re-export as documented.
- Every combat and league number that came from outside carries a **`SourceReference`** (URL,
  publisher, verification where applicable). Full credit list on-site at `/sources`.

Default authority is the **RuneScape Wiki**. Rows lifted specifically from PvME or RS Analysis keep
those citations. Fresh Jagex reveals may cite Jagex until the Wiki catches up. PvME is used for
**discovery** (what to re-check), not as a guide mirror.

Details: [`docs/data-platform.md`](./docs/data-platform.md), [`docs/canonical-data.md`](./docs/canonical-data.md).

---

## Attribution and licensing

| Material | Terms |
| -------- | ----- |
| Original app code (`app/`, `src/`, product scripts, tests, original docs) | **MIT** — see [`LICENSE`](./LICENSE) (scoped: original software only) |
| Wiki-derived text and data | **[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/)** — [RuneScape Wiki](https://runescape.wiki/) / Weird Gloop — adapted; share-alike; **non-commercial** |
| PvME-derived research notes | **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)** — [PvME](https://pvme.io/) / [pvme-guides](https://github.com/pvme/pvme-guides) — discovery only; **non-commercial** |
| Jagex art, marks, icons, map media (`public/game/`, related trees) | Jagex property under the [Fan Content Policy](https://legal.jagex.com/docs/policies/fan-content-policy) — **not for sale** |

Cross-checks against [RS Analysis](https://rs-analysis.xyz/) may be cited on individual rows; their
UI, code, and guide prose are not copied.

**Do not sell redistributions whose value is game art or wiki/PvME data.** MIT on original code is
not a licence to commercialise Jagex media or re-label third-party data as MIT-only.

Authoritative split: [`NOTICE`](./NOTICE). URI map: [`licenses/README.md`](./licenses/README.md).
Contributing rules: [`CONTRIBUTING.md`](./CONTRIBUTING.md). On-site credits: [`/sources`](./app/sources/page.tsx) (served at `/sources`).

---

## Project notes

- Prefer exact game terms, numbers, and stated limitations over marketing copy.
- Do not invent unrevealed league data.
- Prefer lessons from PvME, RS Analysis, and other planners — never their layout, components,
  class names, or wording.
- Game art and credited Wiki media are fine in this free fan tool; generative AI imagery is not used
  as product art.
- Longer maintainer notes live under [`docs/`](./docs/).
