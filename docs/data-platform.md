# Equilibrium data platform

Equilibrium now builds queryable data instead of mutating large JSON files in place:

```text
tracked legacy evidence + raw snapshots
  -> schema migrations
  -> normalized SQLite + transactional content patches
  -> validation and bounded query CLI
  -> hashed domain indexes and page-sized frontend shards
```

## SQLite decision

The implementation uses Node's built-in `node:sqlite` `DatabaseSync`. The project and GitHub Actions already target Node 22, `node:sqlite` has been available since Node 22.5, and it stopped requiring the experimental flag in Node 22.13. Local verification also confirms foreign keys and FTS5. This avoids a native addon install during Windows development and Vercel builds. The generated database is `.cache/equilibrium.sqlite`, which is ignored by Git and never treated as source of truth. See the [Node SQLite API](https://nodejs.org/download/release/latest-v22.x/docs/api/sqlite.html).

## Ownership

- `data/migrations/`: deterministic relational schema changes.
- `data/patches/`: small immutable content operations with stable targets.
- tracked `data/**/*.json`: compatibility seed evidence until each consumer migrates.
- `.cache/equilibrium.sqlite`: generated query/build cache; never edit or commit it.
- `public/data/v2/`: generated, hashed frontend exports; never edit them.
- `reports/data-quarantine.json`: conflicts preserved for explicit resolution, never fuzzy-merged.

The schema has a shared entity/source/region core plus domain tables for quests, tasks, training methods, equipment and stats, abilities, prayers, spells, invention perks, activities, unlocks, effects, requirements, relationships, and map points. Foreign keys, checks, uniqueness constraints, indexes, and FTS5 enforce the common invariants. Rare source-specific fields remain in validated JSON columns; regions, sources, requirements, effects, and relationships are also materialized relationally.

## Pipeline

`scripts/data/platform.mjs` owns five declared transforms: ingest, normalize, enrich, validate, and export. Each records its version, dependencies, input hash, output count, and validation contract in `transform_runs`. A clean `npm run data:rebuild` deletes only the ignored cache database, applies migrations, imports tracked evidence, applies patches transactionally, rebuilds search, validates, checks v1 research parity, and rewrites only changed v2 artifacts.

The former broad mutation chain remains temporarily as `npm run normalize:data:legacy`. It requires ignored scrape inputs and is not part of normal builds. It stays only until the remaining server-side research, combat, map, and planner consumers have domain-specific compatibility tests.

## Normal editing

```text
npm run data:find -- --query "Seismic wand" --limit 20
npm run data:context -- --id item:seismic-wand --format markdown
npm run data:impact -- --id item:seismic-wand
# add one data/patches/YYYY-MM-DD-description.jsonl
npm run data:apply -- data/patches/YYYY-MM-DD-description.jsonl
npm run data:validate:changed
npm run data:export:changed
npm run data:diff
```

`data:query` accepts one read-only `SELECT` or `WITH` statement, applies a row limit, and rejects writes, PRAGMA, attachment, DDL, and multiple statements. `data:context` defaults to a 16 KB output ceiling and reports truncation.

Schema or broad taxonomy work uses `data:rebuild`. Normal record work does not.

## Frontend compatibility

`/data` loads the small v2 research index and one region shard at a time. Domain artifacts are chunked near 220 KiB, content-hashed in their filenames, and resolved through bounded ID index shards. The old v1 research store remains committed as a parity oracle; every rebuild compares all 11 region payloads exactly before v2 export succeeds.
