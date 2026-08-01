# Equilibrium data platform

Game data is built into a queryable database rather than maintained as large JSON files:

```text
data/canonical/*.jsonl
  -> schema migrations
  -> validated direct import into SQLite + transactional content patches
  -> validation and bounded query CLI
  -> versioned manifest, bounded indexes, and page-sized frontend shards
```

Three things are tracked. Everything downstream of them is generated and ignored by Git.

| Path                          | Tracked | Role                                                                        |
| ----------------------------- | ------- | --------------------------------------------------------------------------- |
| `data/canonical/`             | yes     | The build input: explicit JSONL, one record per line; see `canonical-data.md` |
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

`scripts/data/` declares five transforms — ingest, relational core, enrich, validate, export. Each
records its version, dependencies, input hash, output count and validation contract in
`transform_runs`.

A clean `npm run data:rebuild` deletes only the ignored cache database, applies migrations, imports
`data/canonical/`, applies patches transactionally, rebuilds search, validates exact research parity,
and rewrites only the artifacts whose bytes changed.

| Module                     | Responsibility                                                   |
| -------------------------- | ---------------------------------------------------------------- |
| `platform.mjs`             | CLI entry point and command dispatch                             |
| `config.mjs`               | Paths, limits, region taxonomy, transform declarations           |
| `utilities.mjs`            | Deterministic JSON, hashing, slugs, region taxonomy, atomic writes |
| `database.mjs`             | Connections, transactions, statement cache, migrations           |
| `ingest.mjs`               | The ingestion entry: validate, read, insert, search index        |
| `canonical/schema.mjs`     | The one declaration of the canonical files and their fields      |
| `canonical/read.mjs`       | Canonical JSONL -> records, with declared defaults               |
| `canonical/insert.mjs`     | Records -> SQLite rows, in one ordered list of direct inserts    |
| `canonical/validate.mjs`   | Structural validation and the parity report                      |
| `canonical/export.mjs`     | Database -> `data/canonical/`, byte-diffed                       |
| `patching/parse.mjs`       | Patch file reading, limits, line numbers                         |
| `patching/validate.mjs`    | Allowed and required fields per operation                        |
| `patching/operations.mjs`  | One handler per operation, writing canonical columns             |
| `patching/apply.mjs`       | Patch identity, transaction, dispatch, ledger, changed entities  |
| `validate.mjs`             | Invariant checks and the validation/quarantine reports           |
| `research.mjs`             | Research catalog reconstruction, region panels, export parity    |
| `export.mjs`               | Domain shards, whole documents, ID indexes, manifest             |
| `queries.mjs`              | Bounded read commands: find, context, query, doctor, stats       |
| `pipeline.mjs`             | `rebuild` and single-patch `apply` sequencing                    |
| `benchmark.mjs`            | Scoped patch and rebuild measurements                            |
| `audit.mjs`                | Shipped-data gate and the architecture ratchets                  |

See [`canonical-data.md`](canonical-data.md) for the file format itself.

### Importing canonical data

`ingest.mjs` validates `data/canonical/`, reads it through `canonical/read.mjs`, and writes it into a
freshly migrated database in one transaction. `canonical/insert.mjs` holds the whole import as a
single ordered list, so the dependency order is one readable thing:

1. entities
2. sources
3. tags
4. regions — carries the region entity's own ID and name, so it follows entities
5. domain tables (equipment before equipment stats; tasks and quests reference regions)
6. entity-source links
7. entity-region links
8. requirements, then effects
9. relationships
10. entity-tag links
11. aliases and map points
12. provenance: source files, document skeletons, source records
13. the research catalog and its orderings
14. quarantine

Foreign keys are on throughout, so a step that ran too early fails on the row that needed the missing
parent; `PRAGMA foreign_key_check` runs before the transaction commits. A rejected record names the
file, line, record key and reason, and leaves no partially built database.

The importer does not infer an entity type from a filename, derive an ID from a name, search
arbitrary key paths, accept a second spelling of a field, or classify anything by keyword. Everything
it needs is a declared field.

Three columns are recomputed rather than stored twice: `entities.slug` and `regions.entity_id` from
the ID, and `entities.extra_json` from the entity's provenance record. `source_documents` holds each
source document's shape with its records removed, which is what lets `public/data/v2/documents/**` be
rebuilt from the database alone.

### Applying a patch

`patching/` splits the four things a patch does, so each is inspectable on its own:

- **parse** reads the file, enforces the 1 MiB and 1,000-operation limits, and returns the operations
  exactly as written. It never mutates one — the content hash is the patch's identity, so the file
  and the applied operation have to say the same thing.
- **validate** holds one table of the fields every operation accepts and requires, and returns a
  frozen validated copy with defaults applied, regions folded into the taxonomy and URLs normalized.
  Assignment keys are copied out of a fixed allowlist of column names, which is why the handlers can
  interpolate them into `SET`.
- **operations** is one handler per operation. Each writes canonical database columns and returns the
  entity IDs it changed. Handlers own no transaction and no ledger. The set is `upsert`,
  `upsert-source`, `link`/`unlink-region`, `link`/`unlink-source`, `relate`/`unrelate`, `remove`, and
  `add`/`remove-requirement`, `add`/`remove-effect`, `add`/`remove-tag`. Ordinals are the handler's
  job, not the author's: a requirement or effect appends after what the entity already has, and
  re-adding one it already carries is a no-op rather than a duplicate row.
- **apply** owns identity, one transaction per file, dispatch, the changed-entity set, the
  `patch_changes` rows and the `patch_ledger` entry.

A patch writes the database. It does not write back into the provenance record the entity came from:
`source_records.raw_json` is what the source document said, and stays that way.

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

`data/canonical/` mirrors the database *after* patches, and every rebuild replays every patch, so a
new patch is not lost — but the tracked mirror is stale until it is re-exported, and
`data:canonical:validate` fails while it is. Commit the two together:

```bash
npm run data:canonical:export && npm run data:canonical:validate
```

Guard rails worth knowing about: a patch file is capped at 1 MiB and 1,000 operations and applies in
a single transaction, so a rejected operation leaves nothing behind. An applied migration or patch
whose content later changes is an error rather than a silent re-run. `data:query` accepts one bounded
read-only `SELECT` or `WITH` and rejects writes, PRAGMA, attachment, DDL and multiple statements.
`data:context` defaults to a 16 KB output ceiling and reports truncation.

## How canonical data changes

The model is an immutable baseline plus ordered immutable patches:

```text
data/canonical/  +  data/patches/*.jsonl  ->  .cache/equilibrium.sqlite  ->  data/canonical/
```

The loop closes: the database built from the baseline and the patches exports back to a baseline, and
`data:canonical:validate` is what says the two agree. That gives four moves, and which one a change
needs is not a judgement call.

**Add a patch** for any factual change to a record that already exists, or for a record that should:
a corrected value, a new source, a region link, a duplicate to retire. This is the normal case and it
is the only one that needs no rebuild. A patch is immutable once applied — a later correction is a
new patch, never an edit to an old one.

**Write a migration** when the shape changes rather than the content: a new column, table, index or
constraint. Migrations are forward-only and numbered, and an applied one whose bytes later change is
an error. One migration per schema change, never one per content correction.

**Regenerate the baseline** — that is, re-export `data/canonical/` and commit it — after every patch,
because the tracked mirror is stale until you do and `data:canonical:validate` fails while it is.
That is a re-export of what the database already says, not an authoring act, and it never rewrites a
record: `data:canonical:export` writes only the files whose bytes changed. Nothing else may write
these files by hand.

**Squash the patch history** only at a major data version. Replaying every patch on every rebuild
costs nothing at this size, and the ledger is how `data:context` answers which patch changed a record
and why. When the replay does become the slow part of a rebuild, or a patch names entities that no
longer exist, fold the applied patches into a fresh baseline in one commit: export canonical, delete
the folded patch files, rebuild from empty, and confirm the export is byte-identical to the one you
started from. Until then, keep them.

The one thing not to do is rewrite the baseline to express an edit. Hand-editing `data/canonical/`
loses the record of who changed what and why, and the export would overwrite it on the next rebuild
anyway.

### Source authority

When two sources disagree about a value, this is the order, highest first:

1. **Jagex / official League material** — official League rules, reveals and the region taxonomy
2. **RuneScape Wiki** — general game-data ground truth
3. **Project specialized research** — where the project deliberately did work the Wiki does not cover
4. **Project research overlays** — snapshots and inference
5. **Clearly labelled project inference** — only where no authoritative source exists

Two rules constrain it. Do not replace a verified specialized record with a less-specific Wiki
summary — rank 2 beating rank 3 is wrong when rank 3 is verified and more precise. And authority
decides which *value* wins, never which source a surviving value is attributed to: the winning
record keeps its own `SourceReference`.

Within a rank, the document that owns the domain wins — `combat/equipment.json` for equipment,
`combat/abilities.json` for abilities — and a verified dated snapshot beats a general overlay.

Where the order does not settle it, leave the conflict. A record that needs a human to choose stays
unresolved rather than being quietly picked; the sixty entries in `quarantine.jsonl` are exactly
that, kept so the collision stays auditable instead of disappearing into a merge.

### What counts as a duplicate

`npm run audit:data` fails on two live records of one entity type and name when they either come from
different source documents or land on the same region page. The second case is the one nothing else
catches: a document can duplicate a record on its own, and `misthalin:explorers-ring` and
`misthalin:area-tasks-explorers-ring` share no ID for anything to key on.

Same name is not always the same record, though, and three shapes are excluded rather than reported:

- **A prayer that exists in two books.** `curse:dark-form` and `seren:dark-form` are different
  prayers; merging them loses one.
- **A training method listed once per skill it trains.** Merging empties a skill's method list.
- **A League task.** Its identity is Jagex's `wiki:N`, not its label — "Defeat the empowered Barrows
  Brothers." is legitimately `wiki:740` and `wiki:741`.

The rule is that a group told apart by a domain scope is not a duplicate. `entityOverlaps` in
`queries.mjs` is where that lives, so a new scope of the same kind is one entry there.

Retiring the losing record is only half of it. Everything it holds that the survivor lacks —
requirements, effects, region links, sources, tags — moves across first, each carrying the ID of the
record it came from in its patch `reason`. That is what the requirement, effect and tag operations
exist for, and `npm run audit:data` fails if two documents ever claim one domain again.

## Frontend consumption

Server-rendered catalog summaries query the normalized tables directly. `/data` loads the small v2
research index and one region shard at a time, then fetches only the active region/tab payload.
Domain artifacts are chunked near 220 KiB, hashed in the manifest, and resolved through bounded ID
index shards; the manifest regression test rejects any browser-fetched shard at or above 500 KiB.

Every rebuild independently reconstructs the 11 research payloads from the normalized tables and
requires exact parity with the shipped shards before export succeeds.
