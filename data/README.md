# Data

This folder is the app-facing data store.

- `scraped-data/` contains research and ingest inputs.
- `scripts/normalize-scraped-data.mjs` builds the region, skill and League planner datasets.
- `scripts/sync-reference-data.mjs` copies the combat, historical League, region-boundary, permanent-unlock, reference-research, focused progression-chain and 2026 datasets into their app-facing locations.
- `scripts/sync-planner-expansions.mjs` validates the sourced base planner rows and applies merge-only audits/enrichments.
- `scripts/sync-planner-supplements.mjs` validates and copies the specialist Slayer, Invention and Archaeology supplements, including Guild progression and non-Guild collection utilities.
- The app reads `data/` directly. It does not read `scraped-data/` at runtime.
- Changes under `scraped-data/` are normalized and committed back to this branch by `.github/workflows/normalize-data.yml`.

## Source rules

RuneScape Wiki is the default source for settled game data. Rows explicitly sourced from PvME or RS Analysis keep that source. Jagex posts stay attached when they are the actual source for a new League reveal or patch value.

PvME can supply current combat-practice routes and measured throughput. Old combat XP/hour figures are not treated as current after the 2026 combat changes unless they are rechecked.

The PvME / RS Analysis crawl is a research index, not another game-constants table. It keeps mechanic and dependency discoveries, architecture notes and source warnings. It does not copy their UI, code, boss rotations, presets or guide prose, and PvME-only discoveries are not promoted to verified facts just because they were crawled.

Historical Catalyst region labels can be useful evidence for ambiguous League localities, but they are marked as precedent rather than presented as an Equilibrium confirmation. A transport/departure point is not enough to assign the destination to that region: external or split areas stay explicit unresolved boundary cases until Equilibrium publishes the rule.

Permanent unlocks record the normal-game dependency first. Equilibrium auto-completed quests, Relics, Blessings and League passives are separate overrides; they do not rewrite the base-game record. Boss/codex drops stay in the regional research instead of being copied into a second reward table.

Focused crafting chains use the same rule. A normal self-source route can create region pressure without making every ingredient a hard region lock. Alternate sources and weaker cross-checks stay visible rather than being flattened into certainty.

Archaeology utility rows describe time, travel and duplicate-mitigation advantages. They never bypass a region, quest, dig-site or collector requirement. The Guild feed remains authoritative for relic presets, shop upgrades, the master outfit and Fixate.

## Current layout

- `combat/modernisation-2026.json` — current combat-system modernisation data
- `league/regions.json` — region names, access and hard boundary rules
- `league/region-dependencies.json` — hard, historical-working and unresolved cross-boundary/external-region rules
- `league/relics.json` — Equilibrium relic tiers and revealed choices
- `league/blessings.json` — Equilibrium blessing structure and revealed choices
- `league/tasks.json` — published/provisional Equilibrium task metadata and task records when available
- `league/catalyst.json` — 2025 Catalyst League historical baseline
- `research/catalog.json` — region/skill browser data
- `research/planner-expansions.json` — combat spots, Runecrafting altars, Invention/Archaeology progression and regional unique drops
- `research/planner-expansions-archaeology-collections.json` — region-sensitive collection rewards and relic hand-in chains
- `research/planner-expansions-archaeology-repeatables.json` — repeatable collection farms and collection relic routes
- `research/planner-expansions-archaeology-guild.json` — corrected 2→3→4 relic presets, Guild shop progression, master outfit and Fixate infrastructure
- `research/planner-expansions-archaeology-utilities.json` — duplicate mitigation, journal collection tracking/routing and museum overflow rules
- `research/reference-site-harvest.json` — deduplicated PvME / RS Analysis mechanic and dependency research notes
- `research/masterwork-staff-chain.json` — tier-100 staff self-source chain with hard vs conditional region pressure
- `research/sources.json` — source manifest
- `reference/changes-2026.json` — 2026 update chronology relevant to League planning
- `reference/midgame-rebalance-2026-07-20.json` — July 20 rebalance values
- `reference/progression-unlocks.json` — quest, activity, account and equipment unlock dependencies used by the planner
- `reference/unknowns.json` — unrevealed or unresolved facts that must stay unresolved

Do not add guessed League data to fill empty fields. Unknown or unrevealed values stay empty until there is a source.
