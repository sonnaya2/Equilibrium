# Data

This folder is the app-facing data store.

- `scraped-data/` contains research and ingest inputs.
- `scripts/normalize-scraped-data.mjs` builds the region, skill and League planner datasets.
- `scripts/sync-reference-data.mjs` copies the combat, historical League and 2026 reference datasets into their app-facing locations.
- The app reads `data/` directly. It does not read `scraped-data/` at runtime.
- Changes under `scraped-data/` are normalized and committed back to this branch by `.github/workflows/normalize-data.yml`.

## Source rules

RuneScape Wiki is the default source for game data. Rows explicitly sourced from PvME or RS Analysis keep that source. Jagex posts are used for new League or patch information until the Wiki has caught up.

## Current layout

- `combat/modernisation-2026.json` — current combat-system modernisation data
- `league/regions.json` — region names, access and hard boundary rules
- `league/relics.json` — Equilibrium relic tiers and revealed choices
- `league/blessings.json` — Equilibrium blessing structure and revealed choices
- `league/tasks.json` — published Equilibrium task data
- `league/catalyst.json` — 2025 Catalyst League historical baseline
- `research/catalog.json` — region/skill browser data
- `research/sources.json` — source manifest
- `reference/changes-2026.json` — 2026 update chronology relevant to League planning
- `reference/midgame-rebalance-2026-07-20.json` — July 20 rebalance values
- `reference/unknowns.json` — unrevealed or unresolved facts that must stay unresolved

Do not add guessed League data to fill empty fields. Unknown or unrevealed values stay empty until there is a source.
