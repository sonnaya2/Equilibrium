---
name: data-sync
description: Data ingestion and provenance for RS3 Equilibrium. Use when changing scripts, canonical data under data/, generated research shards, assets, SourceReference fields, Wiki revision tracking, or data audit and normalization commands.
---

# Data sync and provenance

Keep one shipped source of truth: tracked JSON under `data/`.

## Data flow

- `scraped-data/` is an ignored local research workspace. Components never read it.
- `npm run normalize:data` converts that workspace into canonical `data/`. It is local-only because a fresh clone does not contain `scraped-data/`.
- `npm run build:data` generates `public/data/v1/research/` from `data/research/catalog.json`. Never hand-edit the generated shards.
- `npm run audit:data` checks the shipped data and generated research store.
- `npm run sync:combat` updates the Wiki revision ledger in `data/combat/update-index.json`; it detects stale tracked pages but does not scrape combat values into records.
- `npm run sync:league:disabled` intentionally exits 1. Do not use it; the old writer produced an incompatible shape.
- `npm run sync:assets` publishes attributed source art from `assets/` to `public/game/`. Use `node scripts/sync-assets.mjs --check` as the manifest gate.

Do not add a database, API, CMS, client-side mirror, or parallel authoring copy under `src/`.

## Provenance

Use the actual `SourceReference` type in `src/combat/types.ts` or `src/research/catalog.ts`; do not duplicate its union in documentation. Every shipped factual record needs a usable source URL and `verifiedAt`. Derived values identify their inputs.

Source policy:

- RuneScape Wiki is the default current-game source.
- Jagex posts are authoritative for official announcements, but unreleased League details stay provisional until confirmed by a current source.
- RS Analysis may support combat math or state modelling; keep its provenance rather than promoting one calculator configuration into a universal constant.
- PvME is discovery material until a current Wiki or Jagex source verifies mechanics affected by the 2 March 2026 combat update.
- When sources disagree, retain the claims in the audit layer and choose the app-facing value deliberately. Never blend them silently.

Write facts in this app's words. Do not copy source prose or strip attribution.

## Patch-day loop

1. Run `npm run sync:combat`; changed tracked revisions are a review queue.
2. Verify only records the app uses and update their canonical source data.
3. Run `npm run normalize:data` when the ignored local source workspace changed.
4. Inspect the `data/` diff.
5. Run `npm run audit:data`, `npm run audit:combat`, tests, and build.

Never invent a value to fill an empty record. Empty unrevealed data is valid.
