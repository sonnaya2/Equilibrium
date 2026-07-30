# Equilibrium data platform

Equilibrium now builds queryable data instead of mutating large JSON files in place:

```text
one compressed seed
  -> schema migrations
  -> normalized SQLite + transactional content patches
  -> validation and bounded query CLI
  -> versioned manifest, bounded indexes, and page-sized frontend shards
```

## SQLite decision

The implementation uses Node's built-in `node:sqlite` `DatabaseSync`. The project and GitHub Actions already target Node 22, `node:sqlite` has been available since Node 22.5, and it stopped requiring the experimental flag in Node 22.13. Local verification also confirms foreign keys and FTS5. This avoids a native addon install during Windows development and Vercel builds. The generated database is `.cache/equilibrium.sqlite`, which is ignored by Git and never treated as source of truth. See the [Node SQLite API](https://nodejs.org/download/release/latest-v22.x/docs/api/sqlite.html).

## Ownership

- `data/migrations/`: deterministic relational schema changes.
- `data/seed-v1.json.gz`: immutable consolidated baseline.
- `data/patches/`: small immutable content operations with stable targets.
- `.cache/equilibrium.sqlite`: generated query/build cache; never edit or commit it.
- `.cache/data/`: generated compatibility shapes for existing TypeScript imports.
- `public/data/v2/`: generated frontend exports with size and SHA-256 metadata; never edit or commit them.
- `reports/data-quarantine.json`: generated conflict report; conflicts are never fuzzy-merged.

The schema has a shared entity/source/region core plus domain tables for quests, tasks, training methods, equipment and stats, abilities, prayers, spells, invention perks, activities, unlocks, effects, requirements, relationships, and map points. Foreign keys, checks, uniqueness constraints, indexes, and FTS5 enforce the common invariants. Rare source-specific fields remain in validated JSON columns; regions, sources, requirements, effects, and relationships are also materialized relationally.

## Pipeline

`scripts/data/platform.mjs` owns five declared transforms: ingest, normalize, enrich, validate, and export. Each records its version, dependencies, input hash, output count, and validation contract in `transform_runs`. A clean `npm run data:rebuild` deletes only the ignored cache database, applies migrations, imports the seed, applies patches transactionally, rebuilds search, validates exact research parity, materializes compatibility data, and rewrites only changed v2 artifacts.

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

`data:query` accepts one bounded read-only `SELECT` or `WITH` statement and rejects writes, PRAGMA, attachment, DDL, and multiple statements. `data:context` defaults to a 16 KB output ceiling and reports truncation.

Schema or broad taxonomy work uses `data:rebuild`. Normal record work does not.

## Frontend compatibility

`/data` loads the small v2 research index and one region shard at a time. The regional and permanent-unlock panels then fetch only the active region/tab payload. Domain artifacts are chunked near 220 KiB, hashed in the manifest, and resolved through bounded ID index shards. Every rebuild independently reconstructs the 11 research payloads from the consolidated seed and requires exact parity before export succeeds.

The production build moved the permanent-unlock client data from 1,115,254 bytes to about 27 KiB of component code and the regional-unlock data from 731,860 bytes to about 20 KiB. The largest generated panel payload is 170,035 bytes; the manifest regression test rejects any frontend artifact at or above 500 KiB.
