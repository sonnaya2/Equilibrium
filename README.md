# Equilibrium

Equilibrium is an unofficial planner and combat sandbox for RuneScape 3 **Leagues II: Equilibrium**, which starts on 10 August 2026.

It keeps the parts of league planning that normally end up spread across Wiki tabs and spreadsheets in one place: region picks, Relics, Blessings, tasks, unlocks, sourced game data, and combat testing.

Progress is stored in the browser. There are no accounts or backend services.

## Current state

The map, build planner, regional data browser, and shared build state are working. The combat section includes loadouts, individual ability calculations, manual rotations, Revolution simulation, and a bar solver. Combat coverage is still being expanded and corrected as mechanics are verified.

A few limits are intentional:

- Unrevealed league content is left blank rather than guessed.
- Some task rows are marked Catalyst placeholders until the full Equilibrium task list is published.
- Combat currently uses a configurable generic target, not full boss phases or kill-time models.
- The 3D map requires WebGPU. It falls back when WebGPU is unavailable.

## Run locally

Requires Node.js 22 or newer. The data tools use Node's built-in SQLite support.

```bash
git clone https://github.com/sonnaya2/Equilibrium.git
cd Equilibrium
npm ci
npm run dev
```

The first run rebuilds the local database and generated app data. Next.js will print the local URL, normally `http://localhost:3000`.

Useful checks:

```bash
npm run audit:data
npm run art:check
npm run audit:architecture
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Browser tests are separate:

```bash
npm run playwright:install
npm run test:e2e
npm run test:e2e:combat
npm run test:e2e:webgpu
```

## Repository layout

```text
app/              Next.js routes
src/combat/       Combat engine and solver
src/league/       Regions, Relics, Blessings, and league rules
src/research/     Access to normalized research data
src/tasks/        Task models and progress
src/map/          WebGPU/Three.js map code
src/components/   React UI

data/canonical/   Tracked normalized build input
data/migrations/  SQLite schema migrations
data/patches/     Small sourced data changes
asset-catalog/    Art provenance metadata
public/game/      Game icons and art
public/map/       Map plates and map assets
scripts/          Data, asset, map, audit, and benchmark tools
```

The main stack is Next.js, TypeScript, React, Tailwind CSS, Vitest, and Playwright. The map uses Three.js through React Three Fiber.

## Data and sources

The app does not read from a live CMS. Build data follows this path:

```text
data/canonical + migrations + patches
  -> .cache/equilibrium.sqlite
  -> .generated/ app shards
```

Changes to game data should be made through a sourced patch, then rebuilt and validated. Do not edit `.cache/` or `.generated/` by hand, and do not commit them.

The RuneScape Wiki is the default source. Jagex material is used for new reveals and patch information when necessary. PvME and RS Analysis are used where they provide mechanics or research that is not available from the Wiki. Records keep their own source links where possible.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/data-platform.md](./docs/data-platform.md) before changing the data pipeline.

## Licensing

- Original project code: MIT, subject to the scope described in [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
- RuneScape Wiki-derived material: CC BY-NC-SA 3.0.
- PvME-derived notes: CC BY-NC-SA 4.0.
- RuneScape art, names, and marks remain Jagex property and are used under the Jagex Fan Content Policy.

The MIT licence for the original code does not relicense Jagex media or third-party data. See [licenses/README.md](./licenses/README.md) for the short licence map.

Equilibrium is free, unofficial, and not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.
