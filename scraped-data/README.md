# Equilibrium scraped data

Snapshot date: **2026-07-24**

This folder is a normalized research dump for RuneScape 3 combat, 2026 balance/content changes, Leagues: CATALYST, and Leagues II: EQUILIBRIUM.

The goal is to keep source facts usable by code without copying wiki prose 1:1.

## Files

- `sources.json` — source manifest and provenance.
- `equilibrium.json` — confirmed Leagues II structure, regions, progression systems, and currently revealed relics.
- `catalyst.json` — historical Catalyst progression, relic tiers, passives, and task scoring for comparison.
- `combat-2026.json` — the March 2026 Combat Style Modernisation and related combat-system changes.
- `regions.json` — region-gated content, notable bosses, skilling/training anchors, and upgrade dependencies.
- `training-methods.json` — high-value/current training methods mapped to region access with freshness notes.
- `2026-changes.json` — other 2026 changes that materially affect League planning.
- `unknowns.json` — intentionally unresolved or not-yet-revealed data. Do not silently guess these values.

Later research arrives in named families rather than new top-level files:

- `progression-enrichment-*.json` — merge-only overlays applied to `progression-unlocks.json` by `sync-reference-data.mjs`.
- `planner-enrichment-*.json` — merge-only overlays applied to `planner-expansions.json` by `sync-planner-expansions.mjs`.
- `planner-expansions-*.json` — specialist Slayer, Invention and Archaeology supplements copied to `data/research/` by `sync-planner-supplements.mjs`.
- `combat-consumables-pass-1.json` and `permanent-unlocks-pass-*.json` — permanent-unlock research passes copied to `data/reference/` by `sync-permanent-unlock-passes.mjs`; the consumables pass also enriches the overload chain in `progression-unlocks.json`.
- `*-audit-*.json` — dated audit inputs consumed by sync scripts; they are pipeline inputs, not app data.
- `postits.json` — source-linked working notes for facts still moving. Not app data.
- `pr20-salvage-audit-2026-07-24.json` — PR salvage provenance record. Not app data.

### Not tracked (local / gitignored)

One-shot dumps stay out of the release tree — see root `.gitignore`:

- `pvme-revo/` — research icon harvest (not used by the app)
- `fix-patches/`, `info-patches/`, most `audit-*` status dumps
- `agent-*.json`, harvest reports, equipment-sync reports

Durable pipeline inputs that **are** tracked include the ironman/region-combo audit
JSON files referenced by sync scripts, plus the named enrichment families above.

## Confidence fields

- `confirmed_official` — explicitly stated by Jagex.
- `confirmed_wiki` — directly supported by current RuneScape Wiki data.
- `inferred_region` — location mapping is strong but Equilibrium-specific region behavior has not yet been explicitly confirmed.
- `legacy` — Catalyst-era behavior retained for comparison only.
- `unrevealed` — Jagex has announced the system but has not published the specific value/effect yet.

## Important date caveat

Jagex says daily Equilibrium reveals begin **2026-07-28** and continue through launch on **2026-08-10**. As of this snapshot, only Tier 1 relics are public; later relic choices and the concrete Blessing effects are intentionally left unresolved.
