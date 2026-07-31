# Stage 0 audit and Stage 1 adjudication

Classification of every research and game-data input, produced before the canonical dataset was
built. Stage 0 classified the inputs; Stage 1 adjudicated them, and its record is the last two
sections.

**This is a historical record, not a live description of the platform.** It describes the compressed
seed and the inference-based importer that read it, both of which were deleted once
`data/canonical/` became the only build input — see [`data-platform.md`](data-platform.md) for how
the platform works now. It is kept because it is the evidence behind decisions the current dataset
still carries: which source document wins a conflict, why 70 records are quarantined rather than
merged, and why the overlap baseline in `scripts/data/audit.mjs` still lists seven file pairs. The
inventory tooling and its `reports/legacy-data-*` output were deleted with the seed; the conclusions
below are what survived.

## The thing that makes this audit non-obvious

**The research documents are not files.** `data/research/`, `data/combat/` and `data/reference/` do
not exist on disk — every document lives inside `data/seed-v1.json.gz`. A filesystem walk finds
none of them, and neither did any previous review. That is how several generations of overlays,
audits and snapshots survived unexamined.

There are also two live data paths, not one:

```text
seed document ─┬─> importer ─> SQLite ─> public/data/v2 shards ─> browser
               └─> documents/ ─> #shard/… whole-document import ─> server bundle
```

Most documents are imported *whole* through `#shard`. So "produces no database rows" does
not mean dead, and "produces database rows" does not mean it is the only representation.

## Compaction

The audit found 65 documents; 9 are gone and the rest lost every field nothing reads.

| | Before | After |
| --- | ---: | ---: |
| documents | 65 | 56 |
| seed (compressed) | 1,100,044 B | 1,010,967 B |
| record keys | — | 226 removed, 2,739 occurrences |

`npm run data:compact-seed` performs it and writes `reports/seed-compaction.json`. It is the
"separately verified compaction migration" `AGENTS.md` requires before the immutable seed may be
replaced, and the verification is the rebuild after it: **4,790 entities before and after, zero
gained, zero lost, all 29 table counts identical, `equipment_stats` and every region link
byte-identical.** Everything removed was already unreachable.

Three rules keep it safe, each learned by breaking something:

- **Only a record's own keys are schema.** Deeper keys can be data — `bonuses` children are stat
  names like `accuracy` and `life_points` that become `equipment_stats.stat` values. Stripping by
  name at any depth deletes 1,042 equipment stats.
- **A key nobody names can still hold records.** `unlock_profiles` and `historical_removed_unlocks`
  appear in no source file, but the importer finds objects inside arrays at any depth, so those
  arrays are 19 entities. The first run of this migration deleted them; 131 keys are now protected
  for holding records.
- **Provenance stays, read or not.** 57 keys are kept purely because they are the attribution trail
  `AGENTS.md` protects. An unread wiki revision id is still the evidence for a value.

## Disposition after compaction

| Disposition | Documents | Bytes |
| --- | ---: | ---: |
| active-authoritative | 6 | 2,947 KiB |
| duplicate | 27 | 1,374 KiB |
| active-raw-source | 21 | 139 KiB |
| legacy-needed-for-migration | 2 | 10 KiB |
| orphaned | 0 | 0 |

`duplicate` means the records reach SQLite **and** the document is imported whole — two live
representations. It does not mean the document is worthless: it still carries hundreds of fields the
relational schema never modelled, which is why every record body is kept verbatim in
`data/canonical/provenance/source-records.jsonl`.

### The second layer: files on disk

The table above is documents *inside* the seed. The inventory also classifies the 242 data files
that carry them — the seed, migrations, patches, the tracked canonical export, and every generated
shard and report:

| Disposition | Files | Bytes |
| --- | ---: | ---: |
| active-generated | 233 | 23,759 KiB |
| active-authoritative | 9 | 2,095 KiB |

Nine authored files against 233 generated ones is the shape the architecture is supposed to have.
The nine are the seed, four migrations, two patches and two asset manifests. The only generated
files that are tracked are the 32 under `data/canonical/`, tracked deliberately so the dataset is
reviewable in a diff. Scripts and components get no disposition of their own — the eight
dispositions describe data, not the code that moves it, so those appear as the producers, readers
and tests of these paths.

Every generated file now has an identified producer. One did not at first:
`reports/data-icon-audit.json` is written by `src/lib/dataIconAudit.test.ts`, not by any script — a
test that emits a report is worth knowing about, because nothing in the build pipeline regenerates
it.

### Provenance, measured rather than assumed

Each document is scored by the share of its entities carrying at least one citation:

| Quality | Documents |
| --- | ---: |
| cited (≥90%) | 27 |
| not-applicable (no entities) | 23 |
| partial | 5 |
| uncited | 1 |

The single uncited document is `data/combat/modernisation-2026.json` (3 entities). The five partial
ones are `permanent-unlocks-pass-3.json` (10 of 34), `region-combos.json` (16 of 25),
`spellbooks.json` (5 of 14), `planner-expansions.json` (5 of 15) and `prayer-books.json` (3 of 10).
None is a defect on its own; they are where Stage 1 should expect to do citation work.

### Largest domains

| Domain | Docs | Bytes | Notes |
| --- | ---: | ---: | --- |
| regional skilling and combat unlocks | 5 | 2,012 KiB | Largest domain and the largest conflict source |
| research catalog | 5 | 1,316 KiB | One document, `catalog.json`, is 1.2 MiB of it |
| equipment and combat | 22 | 790 KiB | Most fragmented: 13 duplicate, 3 orphaned |
| quests and tasks | 6 | 602 KiB | |

## Documents removed

Nine documents reached neither the database nor the browser — 330 KiB of seed content. All are
deleted. The first seven were unreachable outright:

| Document | Bytes | Evidence |
| --- | ---: | --- |
| `data/combat/equipment-icons.json` | 224 KiB | `gameArt.ts` imports only `equipment-icon-slugs.json`; the `scripts/sync-equipment-icons.mjs` its comment names no longer exists |
| `data/research/equipment-region-index.json` | 44 KiB | Named only by a classification regex in `audit.mjs` and `ingest.mjs`, never read |
| `data/combat/ability-icons.json` | 33 KiB | Same as the equipment icons; `scripts/sync-ability-icons.mjs` is gone |
| `data/combat/ability-audit-2026-07-24.json` | 10 KiB | An audit of a data format that no longer exists |
| `data/league/quest-region-rules.json` | 4 KiB | 11 records, none mapped, no importer |
| `data/league/equilibrium-auto-quests.json` | 1 KiB | Empty of records |
| `data/league/quest-region-review.json` | 0 KiB | Empty |

Two more were reachable only from React components that no route renders. `ReferenceNotesResearch`
and `RegionBoundariesResearch` — along with `researchStatus.ts`, which only they imported — were
deleted, taking `reference/midgame-rebalance-2026-07-20.json` and `league/region-dependencies.json`
with them.

`research/reference-site-harvest.json` was in the same position but contributes 20 entities, so it
stays in the seed and merely stops being exported as a document. Removing it would silently drop 20
records from `/data`, which is a content decision, not cleanup.

### Why `documents/research/` is still large

23 research documents remain in `public/data/v2/documents/research/` (536 KiB). They are not dead
weight — the `/data` research browser imports each of them whole through `#shard`, so they are the
live backing store for that route. Deleting them means porting those panels onto the normalized
shards, which is the Stage 3 cutover, not a deletion. The reachability trace that proves this lives
in the inventory: 48 documents are imported by modules reachable from `app/`, and after this cleanup
none are imported only by unreachable ones.

## Conflicts queued for Stage 1

70 logical records disagree. The grouping key is the entity the importer resolved a record to — not
the raw `id` field, which is unique only *within* a document and would match a revolution bar against
the Ranged skill.

- **64 disagree across two files.** The top pair is
  `progression-unlocks.json` + `regional-skilling-unlocks.json` with 49 conflicts: two generations of
  the same unlock research, both live. By type: 33 activities and 16 equipment.
- **6 disagree inside one document.**

674 entities are built from more than one source record; those 64 are the ones whose records
actually disagree. 62 further logical records are stored byte-identically more than once.

### What the importer actually does with them

Not a drop — a **merge**, and the halves come from different records:

| Part of the entity | Behaviour |
| --- | --- |
| scalar fields (name, descriptions, status, sortKey, verifiedAt) | first record wins |
| body (`extra_json`) | first record wins |
| domain row | first record wins (`INSERT OR IGNORE`) |
| regions, requirements, effects, tags, sources | **union of every contributing record** |

So a conflicted entity is a composite that matches no single source. `anachronia:herb-bag-current`
takes its `league_treatment` from `progression-container-bags-2026-07-25.json` and silently drops
the value `progression-unlocks.json` gives for the same field, while keeping the relations from
both.

**This is the finding that most justifies the four-stage plan.** The current SQLite database is not
clean ground truth: on 64 records it shows a blend of disagreeing sources rather than any one of
them.

### Colliding identities, separate from disagreeing values — fixed

Eight prayers existed in two different prayer books under the same name. `entityCandidate` built a
prayer's ID from `prayer:<key>:<name>` where `<key>` was the array key `prayers` in both books, so
the book never reached the ID and the two records collapsed into one entity.

This is now fixed. Records carry their enclosing record, a prayer is scoped by its book, and
`prayer:standard-prayers:protect-item` and `prayer:ancient-curses:protect-item` are separate
entities. 4,790 entities became 4,798 — exactly the eight that were merged — and the empty `book`
column went from 94 of 195 to 4 of 203. None of the 90 renamed `prayer:prayers:*` IDs were
referenced in patches, tests, e2e or app code.

The scope stayed on prayers deliberately: a general parent-aware scope would have renamed 442
records across four files, 262 of them in the research catalog, to fix nine collisions.

## The duplication the conflict report cannot see

**This is the largest finding in the audit, and it was missed until now.**

`research-conflicts.json` groups records by the entity the importer resolved them to. By
construction, that cannot see two files describing the same thing under *different* entity IDs —
those records never group, so they never appear as a conflict, and the earlier passes reported them
as clean.

Grouping by entity type and name instead finds **253 logical records that exist in more than one
source file as separate entities**, across 18 file pairs. `reports/research-overlaps.json` has them.

| Files | Records |
| --- | ---: |
| `data/combat/prayers.json` + `data/reference/prayers.json` | 87 |
| `data/reference/progression-unlocks.json` + `data/research/catalog.json` | 86 |
| `data/combat/equipment.json` + `data/reference/progression-unlocks.json` | 33 |
| `data/league/quests.json` + `data/reference/progression-unlocks.json` | 9 |
| `data/combat/perks.json` + `planner-expansions-invention-active-perks.json` | 8 |

The prayers pair is the clearest case, and Stage 1 has now resolved it — see below. `data/combat/prayers.json`
and `data/reference/prayers.json` described the same 98 prayers — matched on (book, name), every one
in the first was in the second and neither held a single prayer the other lacked. They produced 196
entities where the game has 98, because one file keys a record `prayer:protect-item` and the other
`prayer:standard-prayers:protect-item`. (The table said 87 rather than 98 because it groups on name
alone, and 8 prayer names appear in two books.) The two files also disagreed on how to spell a book:
`standard` / `ancient` / `seren` against `Standard Prayers` / `Ancient Curses` / `Seren Prayers`.

Two things this is **not**:

- **Not caused by the prayer-book split.** `data/combat/prayers.json` always produced unqualified
  IDs, so the two sets were already separate entities before that change. The split fixed a
  collision *within* `data/reference/prayers.json`; it neither created nor widened this overlap.
- **Not automatically a duplicate to delete.** Two files describing one prayer may still disagree
  about its values, and the authority order decides which value wins, not which file is deleted.
  Every one of the 253 is marked `humanAdjudicationRequired`.

## Source authority policy for Stage 1

Applied to the file a record came from, highest first:

1. **Jagex / official League material** — for official League rules, reveals and region taxonomy
   (`data/league/`)
2. **RuneScape Wiki** — general game-data ground truth (`data/combat/`, `data/reference/`)
3. **Project specialized research** — `data/research/catalog.json`, where the project deliberately
   did work the Wiki does not cover
4. **Project research overlays** — everything else under `data/research/`; snapshots and inference,
   lowest authority
5. **Clearly labelled project inference** — only where no authoritative source exists

Two rules constrain that order:

- **Do not replace a verified specialized record with a less-specific Wiki summary.** Rank 2 beating
  rank 3 is wrong when rank 3 is verified and more precise.
- **Preserve attribution at record level.** Authority decides which *value* wins; it never rewrites
  which source a surviving value came from.

Where the order does not settle it, the record is marked `humanAdjudicationRequired` and stays
unresolved rather than being quietly picked.

**The importer now applies this order itself.** `ingest.mjs` sorts documents by authority before
importing records, so when several resolve to one entity the winner of the scalar fields is the
source the project trusts most, not whichever the seed happened to store first. Ties break on path,
so the order is total and a rebuild is reproducible.

Worth being precise about what that changed: **nothing, today.** Zero entities and zero exported
files differ. The seed's natural order already matched the policy on every conflict, so the right
record was already winning — by luck. The ordering makes it true by construction instead.

### Two things the conflicts are not

- **Not a `residual` bug.** 31 of the 47 `category` conflicts differ only by the word `residual`
  (`player-owned farm permanent perk residual` vs `player-owned farm permanent perk`), which looks
  exactly like a processing artifact. It is not safe to strip: **Residual Soul** is a real Necromancy
  mechanic, and the token appears in 18 entity names and 16 IDs. Rewriting those values would
  corrupt game data to tidy a category string.
- **Not always a real disagreement.** The first pass of the conflict detector reported 108; the true
  figure is 70. It was grouping an equipment record with its own `sources[]` entry, because a
  citation's `title` repeats the name of the thing it cites, and grouping parent records with the
  records nested inside them. Both are now excluded.

## Future owner per domain

There must not be two active editable sources for one fact after the cleanup.

| Domain | Future canonical owner |
| --- | --- |
| regions and taxonomy | canonical `regions.jsonl` + `entity-regions.jsonl` |
| research catalog | canonical `research/*.jsonl` |
| equipment | canonical `domains/equipment.jsonl` + `equipment-stats.jsonl` |
| abilities · prayers · spells · invention perks | canonical `domains/*.jsonl` |
| quests · tasks · training methods | canonical `domains/*.jsonl` |
| unlocks and activities | canonical `domains/unlocks.jsonl` + `activities.jsonl` |
| source provenance | canonical `sources.jsonl` + `entity-sources.jsonl` |
| map geometry | generated only (`public/map/`) |
| frontend shards | generated only (`public/data/v2/`) |
| SQLite | generated only (`.cache/`) |
| raw seed documents | migration-only, retired after Stage 3 |

## Architecture gates

Added to `npm run audit:data`, which already fails the build:

| Gate | Fails when |
| --- | --- |
| tracked generated files | `data/canonical/`, `reports/*`, `.cache/` become tracked |
| revived orphans | any of the seven orphaned documents gains a `#shard` import |
| dead package scripts | a package script names a `scripts/…` file that does not exist |
| undocumented data roots | `data/` grows a directory outside seed / migrations / patches / canonical |
| oversized client data | a document over 250 KiB is reachable from a `"use client"` module (pre-existing) |
| two files claiming one domain | a **new** file pair overlaps, or an existing pair grows |

The dead-script gate caught `build:icon-maps` on its first run: it invoked
`scripts/_build-icon-maps.mjs` and `scripts/_emit-data-icon-index.mjs`, neither of which exists.
Removing that entry is the only deletion in this stage.

The domain gate is a **ratchet, not a fix**. Every overlapping file pair is baselined with its exact
record count, so the backlog stays visible in the report while a new pair — or an existing pair
gaining a record — fails the build. Stage 0 did not adjudicate them; it stopped the problem growing.
Stage 1 lowers the baseline as pairs are resolved: 18 pairs / 253 records at the end of Stage 0,
7 pairs / 41 records now.

## Stage 1 — overlap adjudication

**225 of the 253 overlaps are resolved.** 41 remain, all blocked on one thing, and the ledger for
both is `reports/research-adjudication.json`.

### How a resolution is made

An overlap is resolved by deciding which file *owns* the record, never by merging the two rows —
merging is what produced the blended entities this audit exists to report. The winner is chosen by
the authority order above, with completeness as the tiebreak inside a rank. Then, in one patch:

1. every source link the superseded record holds that the survivor lacks moves onto the survivor
   (`link-source`), so no citation is lost;
2. the same for region links (`link-region`);
3. the superseded record is `remove`d, which is a status change — exports drop it while its
   provenance and its row in `patch_changes` stay auditable.

Two invariants are checked after every round, and both hold: **no removed record's sources or region
links failed to survive on its winner, and no source lost its last active citer.**

### Round 1 — prayers (98 records)

`data/combat/prayers.json` and `data/reference/prayers.json` matched 1:1 on (book, name) across 98
prayers. Both files rank 2 under the authority order, so the order did not settle it; completeness
did, decisively. `combat` carried identical sources and identical region links, plus 98 requirements,
201 effects and 4 levels that `reference` did not have at all — a strict superset — and it already
namespaces by book (`prayer:` / `curse:` / `seren:`), which is why its eight same-name pairs are
correctly separate entities rather than collisions.

`data/patches/2026-07-31-prayer-domain-authority.jsonl` removes `reference`'s 98. Prayer entities
went 203 → 105 with all 98 requirements and 201 effects intact. The three prayer-book container
records in that file are untouched. Nothing outside this audit's own tests referenced the removed
IDs.

Note what this did *not* change: `data/reference/prayers.json` is still imported whole through
`#shard` by the `/data` research browser, so that route renders exactly as before. Deduplicating the
relational layer and retiring the document are different jobs, and the second one is Stage 3.

### Round 2 — 33 records across ten pairs

`data/patches/2026-07-31-overlap-authority-round-1.jsonl` resolves every record where the authority
order and the richer record agree and nothing would be lost: 74 operations, of which 34 migrate
sources and 7 migrate region links before 33 removals.

### Round 3 — 94 records, applying the policy's exception as written

The first pass deferred 93 records as "authority versus completeness", on the grounds that the order
picked one file while the richer record sat in the other. That was reading the policy too loosely.
The exception is conditional: rank 2 beating rank 3 is wrong *when rank 3 is verified and more
precise*. Whether the specialized record is the more precise one is measurable, not a judgement call,
so the rule decides these after all.

`data/patches/2026-07-31-overlap-authority-round-2.jsonl` applies the order strictly, with that
exception evaluated per record — 117 operations, 15 source and 8 region migrations ahead of 94
removals. The exception fires in both directions, which is the point:

| Winner ← superseded | Records | Rule |
| --- | ---: | --- |
| `progression-unlocks.json` ← `catalog.json` | 84 | rank 2 over rank 3; the catalog record is not the more precise one |
| `catalog.json` ← `regional-skilling-unlocks.json` | 4 | rank 3 over rank 4 |
| `catalog.json` ← `progression-unlocks.json` | 3 | the exception firing — here the catalog record *is* richer |
| `progression-unlocks.json` ← `progression-support-items` | 2 | same rank, richer record |
| `progression-unlocks.json` ← `planner-expansions.json` | 1 | rank 2 over rank 4 |

### Why the last 41 are not resolved

All 41 are blocked on one thing, and deferring them is a refusal to guess rather than unfinished
mechanics: **the superseded record holds requirements or effects the survivor lacks, and a patch can
move sources and region links but not those.**

`item:abyssal-scourge` carries `League self-supply: misthalin + forinthry`, which
`misthalin:abyssal-scourge` does not have at all. Unioning the two requirement lists would rebuild
precisely the composite-that-matches-no-source problem this audit exists to report, so it is not the
fix. Either a human decides which list is right, or the patch vocabulary grows a requirement
operation and the same authority pass runs again — and the second option is only safe once someone
has confirmed that a union is ever the right answer here.

### What Stage 1 still has to do

1. Adjudicate the 41 in `reports/research-adjudication.json` — decide, per record, which requirement
   list is correct, then either remove the superseded record or keep both deliberately.
2. Resolve the 70 conflicts in `reports/research-conflicts.json`, starting with the 49 between
   `progression-unlocks.json` and `regional-skilling-unlocks.json`. Every intentional difference from
   the current database needs a written justification. **These cannot be resolved the way the
   overlaps were.** An overlap is two records for one thing, so the authority order can pick the
   owner; a conflict is two records that disagree about a *value*, and picking a category or a
   region-requirement type is a claim about the game that has to be checked against the Wiki, not
   derived from which file it sits in. Inventing one would breach the rule against presenting an
   unverified value as current.

   Worth ruling out explicitly: none of the 70 is inert. The differing fields are 47 `category`,
   13 `regionRequirementType`, 8 `league_treatment`, 6 `confidence`, 4 `effect` and a tail of
   singles. `confidence` looks retired — migration `003-drop-confidence.sql` removed the column —
   but that migration's own note records that the value players see is read from the record's
   `confidence` in `entities.extra_json`, which survives. `comboLabel` and `isRegionCombo` are read
   by `ArchaeologyProductionResearch` and `CombatBisResearch`. Every differing field still reaches
   something.
3. Decide each conflicted entity as a whole rather than inheriting the current blend of first-wins
   scalars and unioned relations.
4. ~~Normalize book, spellbook and category labels.~~ Done for prayers, as a side effect of round 1:
   only `combat`'s spelling survives, so the active `prayers.book` values are now `standard`,
   `ancient` and `seren` with no title-case twins. There is no spellbook equivalent to fix — the
   `spells` table has no `book` column. The remaining `category` disagreements are not a labelling
   problem; they are 47 of the 70 conflicts above, and belong to that item.
5. Keep the best available provenance per record; never re-label a source. `modernisation-2026.json`
   is uncited and the five partial documents listed above are where citation work is owed.
6. Label provisional and inferred records explicitly.
7. Keep lowering `OVERLAP_BASELINE` in `scripts/data/audit.mjs` as pairs are resolved, and delete the
   entry at zero. The gate only ratchets if the baseline follows the work down.

Stage 0 listed `reports/canonical-vs-current-db.json`, `canonical-source-coverage.json` and
`canonical-retired-files.json` as Stage 1 outputs. Those were planning names for work that already
had homes: parity against the database is `canonical-parity.json`, source coverage is the
`provenanceQuality` field on every document in the inventory, and retirement is the `successor` field.
`research-adjudication.json` is the one genuinely new artifact, and it exists.

The canonical exporter, schema, validator and parity harness under `scripts/data/canonical/` are the
mechanism; `data/canonical/` is regenerated and back at parity after each round.
