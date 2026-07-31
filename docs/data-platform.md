# Equilibrium data platform

Game data is built into a queryable database rather than maintained as large JSON files:

```text
one compressed seed
  -> schema migrations
  -> normalized SQLite + transactional content patches
  -> validation and bounded query CLI
  -> versioned manifest, bounded indexes, and page-sized frontend shards
```

Three things are tracked. Everything downstream of them is generated and ignored by Git.

| Path                          | Tracked | Role                                                                        |
| ----------------------------- | ------- | --------------------------------------------------------------------------- |
| `data/seed-v1.json.gz`        | yes     | Immutable consolidated baseline of the 65 original source documents         |
| `data/migrations/`            | yes     | Forward-only SQLite schema changes                                          |
| `data/patches/`               | yes     | Small immutable JSONL content operations against stable IDs                 |
| `.cache/equilibrium.sqlite`   | no      | The built database; regenerate, never edit or commit                        |
| `public/data/v2/`             | no      | Every generated artifact, with size and SHA-256 metadata in the manifest    |
| `reports/data-*.json`         | no      | Validation, quarantine and parity reports                                   |

There is no hosted database, API or CMS. The site is static; user progress lives in `localStorage`.

`public/data/v2/` holds two kinds of artifact. **Shards** (`domains/`, `indexes/`, `regions/`,
`research/`) are fetched by the browser and are capped at 500 KiB each. **Documents**
(`documents/…`, addressed as `#shard/…`) are seed-shaped JSON that a module imports whole at build
time; Next inlines them into the server bundle, so they are build inputs rather than payloads and the
shard cap does not apply. Two of them are around 1 MiB. What keeps that honest is `npm run
audit:data`, which walks imports transitively from every `"use client"` file and fails if a document
over 250 KiB is reachable from the client.

## Why `node:sqlite`

The implementation uses Node's built-in `node:sqlite` `DatabaseSync`. The build targets Node 22 or
newer, where `node:sqlite` is available without an experimental flag and ships with foreign keys and
FTS5 enabled. That avoids a native addon install during Windows development and Vercel builds. See
the [Node SQLite API](https://nodejs.org/download/release/latest-v22.x/docs/api/sqlite.html).

## Schema

A shared entity/source/region core plus domain tables for quests, tasks, training methods, equipment
and stats, abilities, prayers, spells, invention perks, activities, unlocks, effects, requirements,
relationships, map points, and the research catalog's region entries, skills and training links.
Foreign keys, checks, uniqueness constraints, indexes and FTS5 enforce the common invariants. Rare
source-specific fields stay in validated JSON columns; regions, sources, requirements, effects and
relationships are also materialized relationally.

The research catalog is normalized into those tables and is never written back out as a
`catalog.json`.

## Pipeline

`scripts/data/` declares five transforms — ingest, normalize, enrich, validate, export. Each records
its version, dependencies, input hash, output count and validation contract in `transform_runs`.

A clean `npm run data:rebuild` deletes only the ignored cache database, applies migrations, imports
the seed, applies patches transactionally, rebuilds search, validates exact research parity, and
rewrites only the artifacts whose bytes changed.

| Module          | Responsibility                                                     |
| --------------- | ------------------------------------------------------------------ |
| `platform.mjs`  | CLI entry point and command dispatch                               |
| `config.mjs`    | Paths, limits, region taxonomy, transform declarations             |
| `utilities.mjs` | Deterministic JSON, hashing, slugs, file walking, atomic writes    |
| `database.mjs`  | Connections, transactions, statement cache, migrations             |
| `ingest.mjs`    | Seed parsing, import, document rebuild, search index               |
| `normalize.mjs` | Record-to-entity mapping, sources, regions, domain tables          |
| `patches.mjs`   | JSONL parsing, operation handlers, patch ledger                    |
| `validate.mjs`  | Invariant checks and the validation/quarantine reports             |
| `research.mjs`  | Research catalog reconstruction, region panels, seed parity        |
| `export.mjs`    | Domain shards, ID indexes, manifest, byte-diffed writes            |
| `queries.mjs`   | Bounded read commands: find, context, query, doctor, stats         |
| `pipeline.mjs`  | `rebuild` and single-patch `apply` sequencing                      |
| `benchmark.mjs` | Scoped patch and rebuild measurements                              |

## Editing a record

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

Schema or broad taxonomy work uses `data:rebuild`; normal record work does not.

Guard rails worth knowing about: a patch file is capped at 1 MiB and 1,000 operations and applies in
a single transaction, so a rejected operation leaves nothing behind. An applied migration or patch
whose content later changes is an error rather than a silent re-run. `data:query` accepts one bounded
read-only `SELECT` or `WITH` and rejects writes, PRAGMA, attachment, DDL and multiple statements.
`data:context` defaults to a 16 KB output ceiling and reports truncation.

## Frontend consumption

Server-rendered catalog summaries query the normalized tables directly. `/data` loads the small v2
research index and one region shard at a time, then fetches only the active region/tab payload.
Domain artifacts are chunked near 220 KiB, hashed in the manifest, and resolved through bounded ID
index shards; the manifest regression test rejects any browser-fetched shard at or above 500 KiB.

Every rebuild independently reconstructs the 11 research payloads from the normalized tables and
requires exact parity with the immutable seed before export succeeds.
