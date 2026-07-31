# Canonical data

> **Parked.** The exporter, schema, validator and parity harness below are built and tested, but
> `data/canonical/` is git-ignored and no production path reads it. Stage 0
> (`legacy-data-stage0.md`) found 78 conflicting records the current database resolves by keeping
> whichever source was read first, so Stage 1 will rebuild this dataset from adjudicated records
> rather than from the database as-is. What changes then is the *input*, not this machinery.

`data/canonical/` is an explicit, reviewable representation of the validated database. It is
generated, not authored:

```text
data/seed-v1.json.gz + data/patches/
  -> existing importer and normalizer
  -> .cache/equilibrium.sqlite   (validated)
  -> data/canonical/             (this document)
```

The production pipeline is unchanged: nothing in `npm run data:rebuild`, the frontend shards, or the
site reads these files yet. They exist so a later cutover can drop the seed's filename heuristics,
key-name guessing and camelCase/snake_case alias handling in favour of a format that says what it
means.

```bash
npm run data:canonical:export
```

```bash
npm run data:canonical:validate
```

Export writes only the files whose bytes changed; a second run in a row writes nothing. Validate
checks the files on their own terms and then writes `reports/canonical-parity.json`, which is the
machine-readable proof that they still match the database.

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

| File                                     | Key                                    | Records |
| ---------------------------------------- | -------------------------------------- | ------: |
| `entities.jsonl`                         | `id`                                   |   4,790 |
| `entity-aliases.jsonl`                   | `entityId`, `alias`                    |       5 |
| `sources.jsonl`                          | `id`                                   |   2,636 |
| `entity-sources.jsonl`                   | `entityId`, `sourceId`, `role`         |   8,498 |
| `regions.jsonl`                          | `id`                                   |      12 |
| `entity-regions.jsonl`                   | `entityId`, `regionId`, `relation`     |   7,400 |
| `requirements.jsonl`                     | `entityId`, `kind`, `description`      |   5,344 |
| `effects.jsonl`                          | `entityId`, `key`, `ordinal`           |   1,311 |
| `relationships.jsonl`                    | `subjectId`, `predicate`, `objectId`   |     269 |
| `tags.jsonl`                             | `id`                                   |     918 |
| `entity-tags.jsonl`                      | `entityId`, `tagId`                    |   2,766 |
| `map-points.jsonl`                       | `id`                                   |     384 |
| `quarantine.jsonl`                       | `sourceFile`, `recordPath`, `error`    |      60 |
| `domains/equipment.jsonl`                | `entityId`                             |     929 |
| `domains/equipment-stats.jsonl`          | `entityId`, `stat`                     |   1,042 |
| `domains/abilities.jsonl`                | `entityId`                             |     100 |
| `domains/prayers.jsonl`                  | `entityId`                             |     195 |
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
| `provenance/source-files.jsonl`          | `path`                                 |      65 |
| `provenance/source-records.jsonl`        | `sourceFile`, `recordPath`             |   7,920 |

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
`region:global` entity, which has no body. 4,760 entities reference a provenance record; 29 skill
entities carry an inline body because normalization strips their `methods` key, which is exported
separately as `research/skill-methods.jsonl`.

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

`source-files.jsonl` records each of the 65 seed documents with its classification, content hash and
byte count. `source-records.jsonl` is the addressable body of every record found in them, including
the 2,447 that never became entities. `record` is the one place a source-shaped object is stored.

## What is not exported

Five tables and six columns are left out. Each is either build bookkeeping or recomputable, and
`npm run data:canonical:validate` recomputes every excluded column from the canonical files and
fails if a single row disagrees. The current run reports zero mismatches across 17,543 checked rows.

| Table            | Reason                                                        | Evidence                                                              |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `schema_migrations` | Applied-migration ledger for the SQLite build              | Read only by `database.mjs:migrate` and the schema-version check      |
| `transform_runs` | Per-run transform bookkeeping                                  | Written by `recordTransform`; only `databaseInputHash` reads it back  |
| `patch_ledger`   | Which `data/patches/*.jsonl` were applied                      | Read only to refuse a re-application; canonical data is post-patch    |
| `patch_changes`  | Per-patch changed-entity log                                   | Written by `applyPatch`, never read                                   |
| `entity_search`  | FTS5 index and its shadow tables                               | Rebuilt from entities + aliases by `ingest.mjs:rebuildSearch`         |

| Column                                    | Reason                                          | Evidence                                                        |
| ----------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `entities.slug`                           | Always `slugify(entities.id)`                   | 4,790 of 4,790 rows match                                        |
| `entities.extra_json`                     | The entity body, carried once via `recordRef`   | 4,760 referenced, 29 inline, 1 empty; 4,790 of 4,790 reconstruct |
| `regions.entity_id`                       | Always `'region:' \|\| regions.id`              | 12 of 12 rows match                                              |
| `regions.name`                            | Duplicate of the region entity's name           | 12 of 12 rows match                                              |
| `source_records.record_hash`              | `sha256` of the key-sorted record body          | 7,920 of 7,920 rows match                                        |
| `effects.metadata_json` (`key = 'record'`)| A second copy of the effect entity's own body   | 31 of 31 rows match                                              |

## Unknown and rare fields

The 65 seed documents were written over two years with no shared schema, and their records carry 606
distinct top-level keys. Seventy-seven of them feed a canonical column; the other 529 are kept verbatim
in `provenance/source-records.jsonl` and promoted nowhere. That is retention, not modelling, so the
validator writes the full list to `reports/canonical-unmodelled-fields.json` rather than letting
those keys disappear quietly into a blob:

```json
{ "key": "wikiTaskId", "records": 1117, "example": "data/league/catalyst-tasks-snapshot.json#$.records[0]" }
```

It is a report, not a gate — an unmodelled key is not a defect. The count matters, though: a key on
one record is a one-off note, while `catalystCompletionRate`, `localityKey`, `localityLabel` and
`wikiTaskId` on all 1,117 tasks are columns `domains/tasks.jsonl` is missing. One hundred and seventy
keys appear exactly once.

`CONSUMED_RECORD_KEYS` in `scripts/data/canonical/schema.mjs` is the list of keys the normalizer
reads, grouped by where `normalize.mjs` reads each one. It is maintained by hand and has to move
when the normalizer does; an entry that drifts out of date is worse than no entry, because it hides
a key instead of surfacing it.

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

The export is deterministic: given the same database it produces the same bytes, so the second run
of a pair reports an empty `written` list. If it does not, something in the pipeline became
order-dependent, and that is the bug — not the file.
