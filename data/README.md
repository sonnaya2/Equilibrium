# Data

This folder is the app-facing data store.

- `scraped-data/` contains research and ingest inputs.
- `scripts/normalize-scraped-data.mjs` builds the region, skill and League planner datasets.
- `scripts/sync-reference-data.mjs` copies the combat, historical League and 2026 reference datasets into their app-facing locations.
- `scripts/sync-planner-expansions.mjs` validates the sourced planner rows and copies them into the app-facing research store.
- The app reads `data/` directly. It does not read `scraped-data/` at runtime.
- Changes under `scraped-data/` are normalized and committed back to this branch by `.github/workflows/normalize-data.yml`.

## Source rules

RuneScape Wiki is the default source for settled game data. Rows explicitly sourced from PvME or RS Analysis keep that source. Jagex posts stay attached when they are the actual source for a new League reveal or patch value.

PvME can supply current combat-practice routes and measured throughput. Old combat XP/hour figures are not treated as current after the 2026 combat changes unless they are rechecked.

Historical Catalyst region labels can be useful evidence for ambiguous League localities, but they are marked as precedent rather than presented as an Equilibrium confirmation.

## Current layout

- `combat/modernisation-2026.json` — current combat-system modernisation data
- `league/regions.json` — region names, access and hard boundary rules
- `league/relics.json` — Equilibrium relic tiers and revealed choices
- `league/blessings.json` — Equilibrium blessing structure and revealed choices
- `league/tasks.json` — published/provisional Equilibrium task metadata and task records when available
- `league/catalyst.json` — 2025 Catalyst League historical baseline
- `research/catalog.json` — region/skill browser data
- `research/planner-expansions.json` — combat spots, Runecrafting altars, Invention/Archaeology progression and regional unique drops
- `research/sources.json` — source manifest
- `reference/changes-2026.json` — 2026 update chronology relevant to League planning
- `reference/midgame-rebalance-2026-07-20.json` — July 20 rebalance values
- `reference/unknowns.json` — unrevealed or unresolved facts that must stay unresolved

Do not add guessed League data to fill empty fields. Unknown or unrevealed values stay empty until there is a source.
