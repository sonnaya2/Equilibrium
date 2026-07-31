---
name: data-sync
description: Data ingestion and provenance for RS3 Equilibrium. Use when changing the generated SQLite platform, migrations, content patches, frontend exports, SourceReference fields, or data validation commands.
---

# Data sync and provenance

The tracked data source is deliberately small:

- `data/seed-v1.json.gz` is the immutable compressed baseline. Do not edit or open it for routine work.
- `data/migrations/*.sql` defines the relational schema.
- `data/patches/*.jsonl` contains reviewable content changes.
- `.cache/equilibrium.sqlite`, `public/data/v2/`, and `reports/data-*` are generated and ignored.

`npm run data:rebuild` must work from a clean checkout. It deletes and recreates SQLite, imports the seed, applies every patch transactionally, validates the result, and exports hashed artifacts under `public/data/v2/`: browser shards, plus the seed-shaped documents that back the `#shard/*` imports. The research catalog is fully normalized and server-only: never recreate `data/research/catalog.json` as a file. Never commit the database, generated reports, or anything under `public/data/v2/`.

Do not restore the retired `scraped-data` mutation chain, per-domain JSON authoring files, v1 research store, API, CMS, or a second source of truth. New facts arrive as the smallest sourced JSONL patch that expresses the change. Schema changes arrive as a forward-only migration.

`scripts/data/platform.mjs` is only the CLI; `docs/data-platform.md` maps each module to its responsibility. Put new work in the module that already owns that stage rather than back in the entry point.

## Normal workflow

1. `npm run data:find -- --query "name"`
2. `npm run data:context -- --id stable:id --format markdown`
3. `npm run data:impact -- --id stable:id`
4. Add a dated JSONL patch under `data/patches/`.
5. `npm run data:apply -- data/patches/<file>.jsonl`
6. `npm run data:validate:changed && npm run data:export:changed`
7. Run `npm run audit:data`, tests, and the production build before publishing.

Use `data:query` only for bounded read-only `SELECT` or `WITH` statements. It rejects `EXPLAIN`, `PRAGMA`, writes, and multiple statements. Use `data:doctor`, `data:stats`, and `data:transforms` to diagnose the platform instead of scanning the seed or generated JSON.

## Provenance

Use the actual `SourceReference` type in `src/combat/types.ts` or `src/research/catalog.ts`; do not duplicate its union in documentation. Every shipped factual record needs a usable source URL and `verifiedAt`. Derived values identify their inputs.

- RuneScape Wiki is the default current-game source.
- Jagex posts are authoritative for official announcements, but unreleased League details stay provisional until confirmed by a current source.
- RS Analysis may support combat math or state modelling; keep its provenance rather than promoting one calculator configuration into a universal constant.
- PvME is discovery material until a current Wiki or Jagex source verifies mechanics affected by the 2 March 2026 combat update.
- When sources disagree, retain the claims in quarantine or patch context and choose the app-facing value deliberately. Never blend them silently.

Write facts in this app's words. Do not copy source prose, invent a value to fill an empty record, or strip attribution.
