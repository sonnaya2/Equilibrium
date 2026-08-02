# Equilibrium

Fan tool for RuneScape 3 **Leagues II: Equilibrium** (starts 10 August 2026).

Pick regions, Relics, and Blessings. Track tasks. Browse regional research. Run a combat calculator built on current RS3 math with league modifiers layered on. All in one place.

**Source:** [github.com/sonnaya2/Equilibrium](https://github.com/sonnaya2/Equilibrium)

Unofficial, free, not for sale. Not affiliated with Jagex. RuneScape is a trademark of Jagex Ltd.

## What you get

| Page | Job |
| --- | --- |
| Overview | Current plan at a glance |
| Map | Elective regions and what they open (3D board when WebGPU is available) |
| Tasks | Browser and progress |
| Build | Regions, Relics, Blessings |
| Combat | Ability damage, loadout, rotation, revolution solver |
| Data | Regional research with sources on each record |

Progress stays in your browser (`localStorage`). No accounts.

## Status

Works: map and region picks, build planner, data browser, wiki-sourced research with citations, combat calculator (still growing).

Still rough:

- Task list may use **Catalyst** stand-ins until Equilibrium’s full list lands. Those rows are marked temporary. Confirmed Equilibrium tiers and point bands stay; middle values from Catalyst stay provisional until replaced.
- Unrevealed league content stays empty. No invented numbers.
- Planner assumes ironman / self-sufficient play.
- Combat uses generic targets, not full boss phases or kill-time simulators.
- The 3D map needs a real WebGPU browser. Headless CI does not exercise it.

## Run it

Node **22+** (data pipeline uses built-in `node:sqlite`).

```bash
git clone https://github.com/sonnaya2/Equilibrium.git
cd Equilibrium
npm ci
npm run dev
```

Open the URL Next prints (usually `http://localhost:3000`). First boot rebuilds game data into local SQLite.

Before a push:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Optional browser tests:

```bash
npm run playwright:install   # once per machine
npm run test:e2e             # default port 3100
npm run test:e2e:webgpu      # headed map board
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (rebuilds data first) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm test` | Unit tests |
| `npm run test:combat` | Combat engine tests only |
| `npm run test:e2e` | Playwright suite |
| `npm run data:rebuild` | Rebuild SQLite and frontend shards |
| `npm run audit:data` | Full data + provenance gate |
| `npm run art:check` | Art index / provenance gate |
| `npm run build:map` | Rebuild map plates and POI atlas |

Data edits: see [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/data-platform.md](./docs/data-platform.md).

## Layout

```text
app/              Next.js routes
src/combat/       Combat engine (no React)
src/league/       Regions, Relics, Blessings
src/tasks/        Task models
src/research/     Research catalog access
src/map/          3D map (only loaded on /map)
src/components/   UI
data/canonical/   Tracked JSONL build input
data/migrations/  SQLite schema
data/patches/     Small sourced content ops
asset-catalog/    Art provenance metadata
public/game/      Game icons and art
public/map/       Map plates and atlas
scripts/data/     Build, validate, export
```

Stack: Next.js App Router, TypeScript, React 19, Tailwind CSS v4, Vitest, Playwright. Map optional path: Three.js / R3F.

Combat base math lives under `src/combat/`. League rules plug in through a ruleset layer so base formulas stay testable on their own.

## Data

Built at compile time, not from a live CMS:

```text
canonical + migrations + patches
  → .cache/equilibrium.sqlite
  → .generated/ shards for the app
```

- Author under `data/canonical/`, `data/migrations/`, `data/patches/`.
- Never hand-edit `data/canonical/` for one fact; write a patch, rebuild, re-export.
- Do not commit `.cache/`, `.generated/`, or run reports.
- Combat and league numbers carry source links. Full credits at `/sources`.

Default authority is the RuneScape Wiki. PvME is for discovery, not a guide dump. Jagex reveals may be cited until the Wiki catches up.

## Licences

| Material | Terms |
| --- | --- |
| Original app code | MIT — [LICENSE](./LICENSE) |
| Wiki-derived text/data | [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) — RuneScape Wiki / Weird Gloop |
| PvME-derived notes | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — PvME / pvme-guides |
| Jagex art and marks | Jagex [Fan Content Policy](https://legal.jagex.com/docs/policies/fan-content-policy) — not for sale |

Do not sell redistributions whose value is game art or wiki/PvME data. MIT on our code is not a free pass over those.

Full split: [NOTICE](./NOTICE). URI map: [licenses/README.md](./licenses/README.md).

## Project notes

- Use real game terms and real numbers. Skip marketing filler.
- Do not invent unrevealed league content.
- Other planners are fine for *ideas*; do not copy their layout, components, or wording.
- Game art and credited Wiki media are fine here. No gen-AI product art.
- Longer notes live under [docs/](./docs/).
