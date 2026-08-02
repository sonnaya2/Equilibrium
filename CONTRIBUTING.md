# Contributing

Unofficial, non-commercial fan project for RS3 **Leagues II: Equilibrium**.
Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.

This guide is for people changing code, data, tests, or art. Deeper architecture notes live in
[`docs/data-platform.md`](docs/data-platform.md), [`docs/canonical-data.md`](docs/canonical-data.md),
[`docs/combat-model.md`](docs/combat-model.md), [`docs/combat-engine.md`](docs/combat-engine.md),
[`docs/map-rendering.md`](docs/map-rendering.md), and [`docs/ui-contracts.md`](docs/ui-contracts.md).
Licensing authority is root [`NOTICE`](NOTICE).

---

## Setup

Requires **Node.js 22** (the data pipeline uses built-in `node:sqlite`).

```bash
git clone <NEW_REPOSITORY_URL>
cd Equilibrium
npm ci
npm run dev
```

`predev` / `pretest` / `pretypecheck` rebuild game data into `.cache/` and `.generated/` from the
tracked inputs under `data/`. First boot after clone can take a moment.

Open [http://localhost:3000](http://localhost:3000). Playwright E2E uses **port 3100** by default
(and 3101 for the WebGPU map pass), not 3000.

Browsers for E2E (once per machine or after a Playwright bump):

```bash
npm run playwright:install
```

---

## Commands

### Everyday

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server (rebuilds data first) |
| `npm run build` | Production build (rebuilds data first) |
| `npm start` | Serve a production build |
| `npm run typecheck` | `tsc --noEmit` (rebuilds data first) |
| `npm run lint` | ESLint, zero warnings |
| `npm run format:check` | Prettier check on app/src configs |

### Tests

| Command | What it does |
| --- | --- |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`; rebuilds data first) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:combat` | Combat package only |
| `npm run test:simulation` | Combat engine only |
| `npm run test:solver` | Combat solver only |
| `npm run test:components` | Component tests only |
| `npm run test:e2e` | Full Playwright suite (headless Chromium; boots its own server) |
| `npm run test:e2e:combat` | Combat-focused Playwright config |
| `npm run test:e2e:webgpu` | Headed Edge WebGPU map board (`e2e/map-board.spec.ts`) |

### Data

| Command | What it does |
| --- | --- |
| `npm run data:rebuild` | Rebuild SQLite + frontend shards from canonical + migrations + patches |
| `npm run data:find` / `data:context` / `data:impact` | Inspect records before editing |
| `npm run data:apply -- path/to.patch.jsonl` | Apply one patch file |
| `npm run data:validate:changed` | Validate only entities touched by the last apply |
| `npm run data:export:changed` | Export changed frontend artifacts |
| `npm run data:canonical:export` | Rewrite tracked `data/canonical/` from the validated DB |
| `npm run data:canonical:validate` | Structural + parity checks (`reports/canonical-parity.json`) |
| `npm run audit:data` | Rebuild + architecture / provenance gate (CI) |

### Art and map

| Command | What it does |
| --- | --- |
| `npm run art:check` | Provenance, index drift, aliases, unexplained duplicates (CI) |
| `npm run art:index` | Regenerate `src/lib/dataIconIndex.ts` from `public/game` |
| `npm run art:fetch` / `art:import` | Cache then promote a catalog asset into `public/game` |
| `npm run optimize:images` | Re-encode game images in place (never renames) |
| `npm run build:map` | Rebuild committed map plates / terrain field / POI atlas |

Prefer the npm scripts in `package.json`. One-off local tooling under `scripts/_*` is gitignored.

---

## Data editing workflow

There is **one** editable data system. Tracked authoring surface:

| Path | Role |
| --- | --- |
| `data/canonical/` | Build input: generated JSONL mirror of the validated DB — **never hand-edit** |
| `data/migrations/` | Forward-only SQLite schema changes |
| `data/patches/` | Small immutable JSONL content operations (stable IDs + sources) |

Generated and **never committed**:

| Path | Role |
| --- | --- |
| `.cache/` | Built SQLite (and related cache) |
| `.generated/` | Build shards (`#shard/*`) |
| `reports/` | Validation / parity / audit run reports |

There is no hosted database, CMS, or second authoring tree. Nothing generated is published under
`public/data/`. Details: [`docs/data-platform.md`](docs/data-platform.md),
[`data/README.md`](data/README.md).

### Rules

1. Never open or rewrite a complete dataset (or hand-edit `data/canonical/`) to change one record.
2. Never edit `.cache/`, `.generated/`, or generated reports by hand.
3. Search with `data:find`, inspect with `data:context`, check `data:impact` first.
4. Put factual changes in a new file under `data/patches/` with stable IDs and `SourceReference`s.
5. Patches are **immutable once applied** — a later correction is a **new** patch, not an edit to an old one.
6. Use a SQL migration only for schema shape (column/table/index/constraint), never for one content fix.
7. Re-export `data/canonical/` and commit it **with** the patch that changed it.

### Correct one record

```bash
npm run data:find -- --query "Seismic wand"
npm run data:context -- --id item:seismic-wand --format markdown
npm run data:impact -- --id item:seismic-wand
# write data/patches/YYYY-MM-DD-short-description.jsonl
npm run data:apply -- data/patches/YYYY-MM-DD-short-description.jsonl
npm run data:validate:changed
npm run data:export:changed
npm run data:canonical:export
npm run data:canonical:validate
```

Schema, pipeline, or taxonomy work: `npm run data:rebuild` (and the audit below).

Before you open a PR or push:

```bash
npm run audit:data
npm run typecheck
npm test
```

### When adding or citing facts

- Prefer RuneScape Wiki URLs on every external fact (`SourceReference`).
- If a fact came from PvME, tag source `pvme` and re-verify on the Wiki before treating it as verified.
- Never strip source URLs to “clean” a row.
- Never invent unrevealed Equilibrium numbers — empty is correct until a source exists.
- Never copy PvME / RS Analysis / leagues.build guide prose or UI.

---

## Generated-output rules

| May edit / commit | Must not hand-edit or treat as source of truth |
| --- | --- |
| `data/patches/*.jsonl` | `.cache/**` |
| `data/migrations/*.sql` | `.generated/**` |
| `data/canonical/**` **only** via `data:canonical:export` | `reports/**` (generated) |
| `public/game/`, `public/brand/` (art files) | Live SQLite as an authoring surface |
| `public/map/*` outputs of `build:map` when map seed/raster changed | Hand-drawn region polygons |
| `asset-catalog/**` (provenance metadata) | |

- `data/canonical/` is generated but **tracked** so reviews see a readable JSONL diff. Always export
  after patches; `data:canonical:validate` fails while patch and canonical disagree.
- Map geometry is produced by `npm run build:map` from `public/map/world-surface-wiki.webp` plus seed
  data. Commit those outputs when the inputs change. Do not hand-author region rings in UV space.
- Icon index: after art changes, `npm run art:index` and `npm run art:check`.

---

## Test policy

### What CI runs

[`.github/workflows/validate.yml`](.github/workflows/validate.yml) on push to `main` (path-filtered):

1. `npm run audit:data`
2. `npm run art:check`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run format:check`
6. `npm test` (Vitest)
7. `npm run build`

**Full Playwright is not in default CI.** Combat-only E2E is optional via
`workflow_dispatch` → `enable_combat_e2e`. Map / WebGPU coverage is local-only. Run browser tests on
your machine before merging UI or flow changes.

### Absolute rule

A failing test is not automatically a broken test. Classify first:

1. Production code is wrong → fix production; keep the valid test.
2. Expectation is wrong → fix from independent evidence (game rules, Wiki, specs), not from current output alone.
3. Mechanic or feature intentionally changed / removed → update or delete with a clear reason.
4. Flaky / wrong layer / stale fixture / selector drift → fix the harness or move the assertion.

**Never weaken a valid test so incorrect production behavior passes.** Do not:

- copy current engine output into the expected value to green the suite;
- loosen tolerances without a mechanic-based reason;
- replace exact assertions with vague existence checks or broad snapshots;
- skip or delete a valid regression without identifying cause and coverage elsewhere;
- pin moving content in e2e (`verifiedAt` dates, rule wording) — match a pattern instead.

### Layers

- **Vitest** (`src/**/*.test.ts`): formulas, combat engine/solver, parsers, data validation, component logic that does not need a real browser.
- **Playwright** (`e2e/`): real browser flows — navigation, loadouts, rotation/solver UI, persistence, critical a11y paths, map contracts.

Prefer roles, labels, and accessible names in e2e. Use test IDs only when no stable semantic selector
exists.

### Local validation before merge

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:e2e          # if you touched UI, routes, or browser contracts
npm run test:e2e:webgpu   # if you touched the 3D map
npm run build
```

While iterating, a single Vitest file is fine (`npx vitest run path/to/file.test.ts`). Final checks
should use the normal npm scripts when data or shared fixtures were involved. Leave the tree clean:
do not commit dirty generated files from a partial rebuild.

---

## Map and WebGPU local testing

Headless Chromium has **no WebGPU adapter**. Default `npm run test:e2e` honestly skips 3D board
assertions; that does not mean the map was verified.

To actually render the board:

```bash
npm run test:e2e:webgpu
# equivalent:
# npx playwright test -c playwright.webgpu.config.ts e2e/map-board.spec.ts
```

That config runs **headed Microsoft Edge**, parked off-screen, on **port 3101**, with a single
worker (multiple WebGPU contexts on one adapter flake).

### E2E ports and servers

| Port | Use |
| --- | --- |
| 3000 | Ordinary `npm run dev` |
| 3100 | Default Playwright (`PLAYWRIGHT_PORT` overrides) |
| 3101 | WebGPU map pass only |

Playwright’s `webServer` starts `next dev` for its port. A second `next dev` in the same checkout
is rejected (Next lockfile). Stop your local dev server for this repo before a full e2e run, or set
`PLAYWRIGHT_PORT` to a free port and ensure `reuseExistingServer` can attach to a matching app.

Prefer the package scripts (`npm run test:e2e`, focused files via Playwright’s path args). Stop a
local `next dev` on the same checkout before a full e2e run if the Next lockfile rejects a second
server, or set `PLAYWRIGHT_PORT` to a free port so Playwright can start its own.

Do not delete `.next/dev/lock` or kill every Node process to “fix” a stuck server — inspect the
existing process first.

After changing map seed data or the wiki surface raster, regenerate and commit map artifacts:

```bash
npm run build:map
```

---

## Pull requests

Pushes to `main` deploy production on Vercel automatically. There is no staging environment.

1. Branch from an up-to-date `main`.
2. Keep the change focused: one problem or one coherent feature.
3. For data: include the patch file **and** the re-exported `data/canonical/` updates in the same PR.
4. For art: register provenance in `asset-catalog/`, run `art:check`, and do not invent sources.
5. For tests: follow the test policy above; do not “fix” CI by weakening assertions.
6. Describe what changed and how you validated it (commands run, local e2e / WebGPU if relevant).
7. Do not invent unrevealed league content or clone third-party tool layouts.

Suggested subject style: short, plain English, names the primary change (about 3–8 words). No essay
bodies or tool/agent attribution trailers required.

Before you mark the PR ready:

```bash
npm run audit:data   # if data changed
npm run art:check    # if art or catalog changed
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:e2e     # UI / browser contract changes
npm run build
```

CI will re-run the non-Playwright gate on `main`; browser coverage is still your responsibility
locally when you change those paths.

### Frozen UI contracts (e2e)

These are treated as public API. Prefer updating production to match unless the product intentionally
changes:

- Brand link named exactly `EQUILIBRIUM`; nav landmark with Overview, Map, Tasks, Build, Combat, Data
- Footer string `RuneScape is a trademark of Jagex Ltd.`
- Eleven regions as buttons whose accessible names start with the display name (`alt=""` on decorative icons)
- Pick counters `0/3` / `3/3`; fourth pick `aria-disabled="true"`; `Clear picks` always present
- Region detail in `section[aria-live]` under the board stack (not a side inspector)
- WebGPU-absent fallback includes the substring `no WebGPU`

---

## Attribution and licensing

Read [`NOTICE`](NOTICE) and [`LICENSE`](LICENSE) before shipping a fork or redistribution.

| Material | Terms |
| --- | --- |
| Original app code (`app/`, `src/`, product scripts, tests) | MIT — see `LICENSE` (scoped) |
| Wiki-derived data / prose (`data/`, patches, research) | **CC BY-NC-SA 3.0** — not MIT |
| PvME-derived research notes | **CC BY-NC-SA 4.0** — not MIT |
| Jagex art / icons / screenshots (`public/game/`, brand, map art) | Jagex property / [Fan Content Policy](https://legal.jagex.com/docs/policies/fan-content-policy) — not MIT |

### Hard bans

- Do not sell or commercially package `public/game/`, other Jagex media, or redistributions whose value is game art or wiki/PvME data.
- Do not re-label wiki (CC BY-NC-SA 3.0) or PvME (CC BY-NC-SA 4.0) material as MIT-only.
- Do not strip footer credits, `/sources`, or per-record `SourceReference` fields when forking.
- Do not ship gen-AI game art or fabricated unrevealed Relic/Blessing icons.
- Do not clone pvme.io, rs-analysis.xyz, or leagues.build layout, components, class names, or wording.

### When adding art

1. Add a provenance row under `asset-catalog/` (see [`asset-catalog/README.md`](asset-catalog/README.md)).
2. `npm run art:fetch -- <asset-id>` then `npm run art:import -- <asset-id>`.
3. `npm run art:index && npm run art:check`.

The art tree is `public/` — a file’s path is its URL. Catalog holds metadata only, never a second
image tree.

### House rules (product)

- League planning assumes ironman / self-sufficient play (no GE dual mode).
- Combat core stays free of React; league Relics/Blessings enter through the ruleset boundary.
- Generic combat target only — no boss phase sims, kill-time, or enrage calculators in scope.
- Unrevealed league data stays empty until sourced.

Questions about licensing or redistribution: keep `NOTICE` intact and prefer Wiki attribution forms
described there. On-site credits: `/sources`.
