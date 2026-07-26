# Issue 08 — region upgrade dedupe fence

## Problem

Regional sync scripts (`sync-regional-skilling-unlocks.mjs`, `sync-regional-combat-unlocks.mjs`,
and similar) push the same upgrade name onto every region listed in `regionHints`. When
`requiredRegions` has exactly one host, those extra copies are **foreign** and bloat the
catalog (same unlock listed under many regions). Sync passes can also leave within-region
name duplicates.

Manual cleanups (`apply-clear-single-home.mjs`, `apply-user-foreign-rulings.mjs`) fix one-off
rulings; this fence is the automatic guard so the next sync does not re-bloat single-home rows.

## Rules

`dedupeRegionUpgrades(catalog)` mutates `catalog.regions[*].upgrades`:

1. **Within-region unique by `name`** — keep the first remaining copy; drop later dups.
2. **Single-home fence** — if any copy has `requiredRegions.length === 1`, that id is the only
   legal host:
   - keep (or move) the best body onto that region
   - drop every foreign host copy
   - set `regionId` to the home when moving
3. **Left alone**
   - `requiredRegions` empty (needs human home / multi-ok / global ruling)
   - `requiredRegions.length > 1` (explicit multi-region; multi-host is allowed)
   - conflicting single homes on different copies of the same name (`ambiguousHomes` stat)

## Library

```text
scripts/lib/dedupe-region-upgrades.mjs
  export function dedupeRegionUpgrades(catalog) → stats
```

## Wired callers

Called at the end of upgrade-writing syncs (before `catalog.json` write):

- `scripts/sync-regional-skilling-unlocks.mjs` (primary bloater — re-pushes all skilling names)
- `scripts/sync-regional-combat-unlocks.mjs` (same `regionHints` fan-out)

## Standalone

Dry-run (no write):

```bash
node scripts/dedupe-catalog-upgrades.mjs --dry-run
```

Apply to `data/research/catalog.json`:

```bash
node scripts/dedupe-catalog-upgrades.mjs
```

Stats printed to stdout: `foreignSingleHomeDropped`, `movedToHome`,
`withinRegionDupesRemoved`, `singleHomeNames`, `ambiguousHomes`, `missingHomeRegion`.

## What this does not do

- Does not invent homes for empty `requiredRegions`.
- Does not collapse intentional multi-req multi-host upgrades.
- Does not touch content / areas / training rows — upgrades only.
- Prefer running dry-run after a large enrichment import before committing catalog churn.
