# Contributing

Fan project for RS3 **Leagues II: Equilibrium**. Not affiliated with Jagex.

Longer notes: [docs/data-platform.md](docs/data-platform.md), [docs/canonical-data.md](docs/canonical-data.md), [docs/combat-model.md](docs/combat-model.md), [docs/combat-engine.md](docs/combat-engine.md), [docs/map-rendering.md](docs/map-rendering.md), [docs/ui-contracts.md](docs/ui-contracts.md). Licensing authority: root [NOTICE](NOTICE).

## Setup

Node **22** (data uses built-in `node:sqlite`).

```bash
git clone https://github.com/sonnaya2/Equilibrium.git
cd Equilibrium
npm ci
npm run dev
```

First run rebuilds data into `.cache/` and `.generated/`. Open http://localhost:3000.

Playwright (once per machine):

```bash
npm run playwright:install
```

E2E boots its own server on port **3100** (WebGPU map pass uses 3101).

## Commands

### Everyday

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (rebuilds data first) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier check |

### Tests

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests |
| `npm run test:combat` | Combat package |
| `npm run test:e2e` | Full Playwright suite |
| `npm run test:e2e:combat` | Combat-focused Playwright config |
| `npm run test:e2e:webgpu` | Headed WebGPU map board |

### Data

| Command | What it does |
| --- | --- |
| `npm run data:rebuild` | SQLite + frontend shards from canonical + migrations + patches |
| `npm run data:find` / `data:context` / `data:impact` | Inspect records |
| `npm run data:apply -- path/to.patch.jsonl` | Apply one patch |
| `npm run data:canonical:export` | Rewrite tracked `data/canonical/` from the validated DB |
| `npm run data:canonical:validate` | Structural + parity checks |
| `npm run audit:data` | Rebuild + architecture / provenance gate (CI) |

### Art and map

| Command | What it does |
| --- | --- |
| `npm run art:check` | Provenance and index gate (CI) |
| `npm run art:index` | Regenerate icon index from `public/game` |
| `npm run build:map` | Rebuild map plates / terrain / POI atlas |

Prefer npm scripts in `package.json`. Local one-offs under `scripts/_*` are gitignored.

## Data workflow

Tracked authoring surface:

| Path | Role |
| --- | --- |
| `data/canonical/` | Build input JSONL — **do not hand-edit** |
| `data/migrations/` | Forward-only schema |
| `data/patches/` | Small immutable content ops with sources |

Never commit: `.cache/`, `.generated/`, `reports/`.

### Rules

1. Do not rewrite a whole dataset for one fact.
2. Do not edit `.cache/` or `.generated/` by hand.
3. Search (`data:find`), inspect (`data:context`), check impact first.
4. Put facts in a new file under `data/patches/` with stable IDs and sources.
5. Rebuild, validate, re-export canonical, commit patch + export together.
6. Schema changes only via migrations.
7. Empty stays empty for unrevealed league content.

## Combat

`src/combat/` has no React. League rules enter through the ruleset layer. Keep that boundary.

When you change combat math: unit tests in the same area, and update e2e if UI contracts change.

## Map

WebGPU/Three code loads only on `/map` (`ssr: false`). Do not import it from other routes.

## UI contracts

Frozen presentation and a11y pins live in [docs/ui-contracts.md](docs/ui-contracts.md) and `e2e/`. Change product and tests together when you break a pin.

## Licences (short)

- Original code: MIT (`LICENSE`).
- Wiki-derived data: CC BY-NC-SA 3.0.
- PvME-derived notes: CC BY-NC-SA 4.0.
- Jagex art: Fan Content Policy — not for sale.

Full text: [NOTICE](NOTICE). Do not strip footers or `/sources`.

## Comments

Agent and human comment rules: **[AGENTS.md](AGENTS.md)**. CI gate: `npm run audit:comments` (no em/en dash in `//` or block comments; no lecture stock).

## Pull requests

- Small, focused commits when you can.
- Say what changed and why in plain language.
- Include data rebuild / test notes when relevant.
- No gen-AI product art. No invented league numbers.
