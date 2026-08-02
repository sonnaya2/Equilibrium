# Canonical data

`data/canonical/` is an explicit, reviewable representation of the validated database, and it is the
only dataset the database is built from:

```text
data/canonical/ + data/patches/
  -> scripts/data/ingest.mjs (+ migrations, patch apply)
  -> .cache/equilibrium.sqlite   (validated, local only)
  -> data/canonical/             (re-exported; byte-compared against itself)
```

It is **generated, not authored**: `data:canonical:export` writes it from the database. A record is
changed through a patch under `data/patches/`, never by editing these files. The loop closes because
the export is deterministic — the files a rebuild produces from canonical data export back to the
same bytes.

## Why this tree is tracked

Canonical is the one generated tree that **is** committed (see `.gitignore` comment and
`.gitattributes` `eol=lf`). Reasons:

| Need                    | How canonical meets it                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Diff review             | Patch + JSONL mirror land in the same PR/commit; reviewers see the post-patch state |
| Reproducible rebuild    | No private seed required — clone → `data:rebuild` → identical SQLite                |
| Staleness gate          | `data:canonical:validate` fails if the mirror disagrees with the DB after patches   |
| Provenance continuity   | `provenance/*` retains the retired seed's documents and every raw record body       |

Never hand-edit these files. Never leave a patch committed without its matching re-export.

[`data-platform.md`](data-platform.md) has the module layout, source-vs-generated inventory, and the
rules for when a change is a patch, a migration, or a baseline re-export.

## What must not be tracked

| Path                                         | Why                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `.cache/equilibrium.sqlite`                  | Machine-local build product; always regenerable                          |
| `.cache/data-changed.json`                   | Apply/rebuild bookkeeping                                                |
| `.generated/documents/**`                    | `#shard/*` rebuild from SQLite                                           |
| `reports/data-*.json`, `reports/data-*.md`   | Validation / inventory / export / audit outputs                          |
| `reports/canonical-*.json`                   | Parity report from `data:canonical:validate`                             |
| `docs/data-catalog.md`                       | Generated domain summary                                                 |
| `public/data/v*`                             | Retired shard publish path (export removes empty tree)                   |

`scripts/data/audit.mjs` fails the architecture gate if reports, `.cache/**`, or `public/data/v*`
are tracked, or if `data/` gains an undocumented root beyond `canonical/`, `migrations/`, `patches/`,
and `README.md`.

## Commands

```bash
npm run data:canonical:export
```

```bash
npm run data:canonical:validate
```

Export writes only the files whose bytes changed; a second run in a row writes nothing. Validate
checks the files on their own terms and then writes `reports/canonical-parity.json`, which is the
machine-readable proof that they still match the database.

Full rebuild + ship gate:

```bash
npm run data:rebuild
npm run data:canonical:export
npm run data:canonical:validate
# ship gate (rebuild + architecture audit + doctor):
npm run audit:data
```

After a normal content patch (DB already present):

```bash
npm run data:apply -- data/patches/YYYY-MM-DD-description.jsonl
npm run data:validate:changed
npm run data:export:changed
npm run data:canonical:export
npm run data:canonical:validate
```

## Rules

- **One name per concept.** `entityId`, `regionId`, `sourceId`, `ordinal`, `record` mean the same
  thing in every file. No aliases, no snake_case, no per-file spelling.
- **One line per record**, JSON object, no blank lines, file ends with a newline.
- **Sorted by primary key**, comparing key parts numerically when both sides are numbers and by
  UTF-16 code unit otherwise — never `localeCompare`, whose order depends on the machine.
- **Keys within a line are sorted**, so two exports of one database are byte-identical.
- **A field equal to its default is omitted.** Defaults are documented per field below; a line that
  spells one out is a validation failure, because it would let the same record have two encodings.
- **No duplicate copies.** An entity body is stored once, in `provenance/source-records.jsonl`, and
  referenced by `entities.recordRef`.
- **Nothing is classified by filename.** Every record carries its own `type`, `section` or
  `relation`.
- **No empty collections.** A collection with no rows is not written at all.

Types used below: `string`, `integer`, `number`, `boolean`, `json` (any JSON value). A trailing `?`
means the field may be null.

## Layout

Counts below are the current tracked mirror (one JSON object per line). They move when patches land;
`data:canonical:validate` is authoritative if a count and the database disagree.

| File                                     | Key                                    | Records |
| ---------------------------------------- | -------------------------------------- | ------: |
| `entities.jsonl`                         | `id`                                   |   4,809 |
| `entity-aliases.jsonl`                   | `entityId`, `alias`                    |       5 |
| `sources.jsonl`                          | `id`                                   |   2,639 |
| `entity-sources.jsonl`                   | `entityId`, `sourceId`, `role`         |   8,666 |
| `regions.jsonl`                          | `id`                                   |      12 |
| `entity-regions.jsonl`                   | `entityId`, `regionId`, `relation`     |   7,736 |
| `requirements.jsonl`                     | `entityId`, `kind`, `description`      |   5,470 |
| `effects.jsonl`                          | `entityId`, `key`, `ordinal`           |   1,441 |
| `relationships.jsonl`                    | `subjectId`, `predicate`, `objectId`   |     269 |
| `tags.jsonl`                             | `id`                                   |     918 |
| `entity-tags.jsonl`                      | `entityId`, `tagId`                    |   2,831 |
| `map-points.jsonl`                       | `id`                                   |     384 |
| `quarantine.jsonl`                       | `sourceFile`, `recordPath`, `error`    |      60 |
| `domains/equipment.jsonl`                | `entityId`                             |     940 |
| `domains/equipment-stats.jsonl`          | `entityId`, `stat`                     |   1,064 |
| `domains/abilities.jsonl`                | `entityId`                             |     100 |
| `domains/prayers.jsonl`                  | `entityId`                             |     203 |
| `domains/spells.jsonl`                   | `entityId`                             |       3 |
| `domains/invention-perks.jsonl`          | `entityId`                             |     106 |
| `domains/activities.jsonl`               | `entityId`                             |     669 |
| `domains/unlocks.jsonl`                  | `entityId`                             |     667 |
| `domains/tasks.jsonl`                    | `entityId`                             |   1,117 |
| `domains/quests.jsonl`                   | `entityId`                             |     294 |
| `domains/training-methods.jsonl`         | `entityId`                             |     428 |
| `research/catalog.jsonl`                 | `id`                                   |       1 |
| `research/regions.jsonl`                 | `regionId`                             |      11 |
| `research/region-entries.jsonl`          | `regionId`, `section`, `ordinal`       |     796 |
| `research/region-skills.jsonl`           | `regionId`, `ordinal`                  |     165 |
| `research/region-training.jsonl`         | `regionId`, `ordinal`                  |     420 |
| `research/skill-methods.jsonl`           | `skillEntityId`, `ordinal`             |     428 |
| `provenance/source-files.jsonl`          | `path`                                 |      56 |
| `provenance/source-documents.jsonl`      | `path`                                 |      56 |
| `provenance/source-records.jsonl`        | `sourceFile`, `recordPath`             |   7,867 |

`scripts/data/canonical/schema.mjs` is the executable version of this table. It is the single
declaration the exporter, the validator and the parity report all read, so a field cannot drift
between them.

## Record shapes

### `entities.jsonl`

| Field                 | Type      | Default | Notes                                                    |
| --------------------- | --------- | ------- | -------------------------------------------------------- |
| `id`                  | string    | —       | Stable ID; never regenerated                             |
| `type`                | string    | —       | Explicit entity type, never inferred from a filename     |
| `name`                | string    | —       |                                                          |
| `sortKey`             | string    | —       | Display order within a type                              |
| `status`              | string    | `active`|                                                          |
| `shortDescription`    | string    | `""`    |                                                          |
| `detailedDescription` | string    | `""`    |                                                          |
| `verifiedAt`          | string?   | `null`  | ISO date; null and `""` are different and stay different |
| `createdSource`       | string    | —       | Seed document or `patch:<file>` that created the record  |
| `updatedSource`       | string    | —       | Same, for the last write                                 |
| `recordRef`           | string?   | `null`  | `"<sourceFile>#<recordPath>"` into the provenance file   |
| `record`              | json?     | `null`  | Inline body when no provenance record matches            |

`recordRef` and `record` are mutually exclusive, and both are absent for the synthetic
`region:global` entity, which has no body. 4,779 entities reference a provenance record; 29 skill
entities carry an inline body because their `methods` key is stripped — those methods are entities of
their own, exported as `research/skill-methods.jsonl`. A patched entity still references its
provenance record, because a normal patch writes database columns and never the record body
(`set-record` is the explicit exception; see `data-platform.md`).

### `sources.jsonl`

`id`, `url`, `family` are required. `role` defaults to `verification`; `pageTitle` and `publisher`
default to `""`; `verifiedAt`, `retrievedAt` and `contentHash` default to null.

### `regions.jsonl`

`id` (one of the eleven league regions or `global`) and `taxonomyOrder` are required.
`availability` defaults to `unknown`, `verified` to `false`.

### `entity-regions.jsonl`

`entityId`, `regionId` and `relation` are required. `relation` is one of `primary`, `required`,
`optional`, `hint`, `excluded`, `global`. `ordinal` defaults to `0` and `requirementGroup` to `""`;
the group names how several links combine (`all_required`, `any_optional`, and the fifteen other
values the seed uses).

### `requirements.jsonl`

`entityId`, `description` and `ordinal` are required. `kind` defaults to `text`; `skill`, `level`
and `targetEntityId` default to null. The key is `(entityId, kind, description)` rather than
`(entityId, ordinal)` because two source records can contribute the same position.

### `effects.jsonl`

`entityId`, `key`, `ordinal` and `description` are required; `valueText` defaults to `""` and
`metadata` to `{}`.

### `relationships.jsonl`

`subjectId`, `predicate`, `objectId` required; `ordinal` defaults to `0`, `metadata` to `{}`.
`predicate` is `requires` for every current row, resolved only where a prerequisite name matched
exactly one entity.

### `map-points.jsonl`

`id`, `label`, `x`, `y` required; `z`, `regionId`, `entityId` default to null, `pointType` to
`place`, `metadata` to `{}`.

### `quarantine.jsonl`

`sourceFile`, `recordPath`, `error`, `suggestedResolution` and `record` are required; `stableId` and
`conflictingRecord` default to null. Sixty records are quarantined, all of them stable-ID collisions
between two differently-typed seed records; they are kept, not dropped, so the collision stays
auditable.

### `domains/*.jsonl`

One row per entity, keyed by `entityId`, holding only that domain's own columns. Every field except
`entityId` (and `stat`/`value` in `equipment-stats.jsonl`) has a default and is omitted when empty.

### `research/*.jsonl`

`catalog.jsonl` is the single snapshot header. `regions.jsonl` holds each region's `areas`,
`hardRules`, `warnings` and `source` — source-shaped JSON that is genuinely per-region prose, not a
normalizable relation. The three link files carry the orderings the site renders:
`region-entries.jsonl` (`section` is `content` or `upgrades`), `region-skills.jsonl` and
`region-training.jsonl`, plus `skill-methods.jsonl` for the training methods under each skill.

### `provenance/*.jsonl`

`source-files.jsonl` records each of the 56 source documents with its classification, content hash
and byte count. `source-records.jsonl` is the addressable body of every record found in them,
including thousands that never became entities. `record` is the one place a source-shaped object is
stored.

`source-documents.jsonl` holds each document's `skeleton`: its shape with every top-level array
record replaced by `null`. Export writes each source record back over its own `recordPath` to rebuild
`.generated/documents/**`, and record paths sort parent-before-child, so a nested record lands
inside the parent body that was just restored. Ninety-four KB of scaffolding stands in for ~1.5 MB of
documents, and it is the last thing the frontend artifacts needed the seed for.

## Provenance guarantees (canonical layer)

1. **Citation rows are first-class** — `sources.jsonl` + `entity-sources.jsonl` link every entity to
   URL/family/role/`verifiedAt` (and related fields). Do not strip them in exports or app surfaces.
2. **Bodies are single-homed** — the source-shaped object lives in `provenance/source-records.jsonl`;
   entities point at it with `recordRef` instead of copying.
3. **Created/updated lineage** — `createdSource` / `updatedSource` name the seed document or
   `patch:<file>` responsible for the write.
4. **Quarantine is retention** — collisions stay in `quarantine.jsonl` until a human patch resolves
   them; they are not deleted to green a report.
5. **Parity excludes only recomputable columns** — see below; `data:canonical:validate` recomputes
   every excluded column and fails on any mismatch.

## What is not exported

Five tables and six columns are left out. Each is either build bookkeeping or recomputable, and
`npm run data:canonical:validate` recomputes every excluded column from the canonical files and
fails if a single row disagrees.

| Table            | Reason                                                        | Evidence                                                              |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `schema_migrations` | Applied-migration ledger for the SQLite build              | Rewritten by `database.mjs:migrate` on every rebuild                  |
| `transform_runs` | Per-run transform bookkeeping                                  | Written by `recordTransform`; only `databaseInputHash` reads it back  |
| `patch_ledger`   | Which `data/patches/*.jsonl` were applied                      | Read only to refuse a re-application; canonical data is post-patch    |
| `patch_changes`  | Per-patch changed-entity log                                   | Written by `patching/apply.mjs`; read only by `data:context`          |
| `entity_search`  | FTS5 index and its shadow tables                               | Rebuilt from entities + aliases by `ingest.mjs:rebuildSearch`         |

| Column                                    | Reason                                          | Evidence                                                        |
| ----------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `entities.slug`                           | Always derived from `entities.id`               | All entity rows must reconstruct                                |
| `entities.extra_json`                     | The entity body, carried once via `recordRef`   | Referenced / inline / empty cases must reconstruct              |
| `regions.entity_id`                       | Always `'region:' \|\| regions.id`              | All region rows must reconstruct                                |
| `regions.name`                            | Duplicate of the region entity's name           | All region rows must reconstruct                                |
| `source_records.record_hash`              | `sha256` of the key-sorted record body          | All source-record rows must reconstruct                         |
| `effects.metadata_json` (`key = 'record'`)| A second copy of the effect entity's own body   | Matching effect rows must reconstruct                           |

## Unknown and rare fields

The 56 source documents were written over two years with no shared schema, and their records carry
hundreds of distinct top-level keys. Only some feed a canonical column; the rest are kept verbatim in
`provenance/source-records.jsonl` and promoted nowhere. That is retention, not modelling — the key is
still there to read, it just has no column of its own.

Promoting one is a schema migration plus a re-export, and the case for it is frequency: a key on one
record is a one-off note, while keys that appear on every task (or every equipment row) belong as
domain columns.

## Parity report

`reports/canonical-parity.json` (generated, git-ignored) holds:

- `collections[]` — per file, the database row count, the canonical record count, and whether the
  file is byte-identical to a fresh export
- `checks[]` — entity counts by type, a digest over the exact entity ID set, a digest over the
  eleven reconstructed research region payloads, and the quarantine count with its distinct-error
  count
- `excludedColumns[]` — each excluded column with the rows checked and the mismatches found
- `excludedTables[]` — the exclusions above, with their evidence
- `validation` — the structural result: JSON, keys, references, ordering, types, defaults

The research check is the strongest one: it rebuilds `research.mjs:readResearchCatalog` from the
canonical files alone — resolving every `recordRef` back to a body and every ordinal back into
order — and compares the digest against the same function reading the database.

## Regenerating

```bash
npm run data:rebuild
npm run data:canonical:export
npm run data:canonical:validate
```

Because the rebuild now reads these files, a regeneration is a fixed point rather than a one-way
export: the database built from `data/canonical/` exports back to the same bytes, and
`data:canonical:validate` is what says so.

The export is deterministic: given the same database it produces the same bytes, so the second run
of a pair reports an empty `written` list. If it does not, something in the pipeline became
order-dependent, and that is the bug — not the file.
