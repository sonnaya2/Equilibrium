# Wave 2 — regional skilling unlocks emit-host fix

**Date:** 2026-07-26  
**Script:** `scripts/sync-regional-skilling-unlocks.mjs`  
**Symptom:** Removed / foreign upgrades reappear on non-home regions after every skilling sync (`normalize:data`).

## Root cause

Catalog placement used full `regionHints` membership:

```js
const additions = records.filter((row) => row.regionHints.includes(region.id));
```

`collectRegions` merges home, required, optional pressure, artifact, and collector tokens into `regionHints`. Optional pressure therefore became full upgrade clones on every listed region. One-shot foreign cleanups (issue-03 single-home purge, etc.) were undone on the next sync because the strip-then-republish path re-cloned onto every pressure host.

`dedupeRegionUpgrades` only collapses hosts when `requiredRegions.length === 1`. Rows with empty `requiredRegions` and multi-hint support pressure were left multi-host.

## Fix

Emit-time host shrink in `sync-regional-skilling-unlocks.mjs`:

```js
function emitHostRegions(row) {
  const req = list(row.requiredRegions).filter(Boolean);
  if (req.length) return [...new Set(req)];
  const home = list(row.regionHints).filter(Boolean)[0];
  return home ? [home] : [];
}

// ...
const additions = records.filter((row) => emitHostRegions(row).includes(region.id));
```

Rules:

| Condition | Catalog hosts |
|---|---|
| `requiredRegions` non-empty | exactly those regions (true multi-req combos stay multi-host; single-home stays one host) |
| else | `regionHints[0]` only (home / first hint) |
| never | full optional-pressure `regionHints` list |

`row.regionHints` on the product record is unchanged — still carries pressure for combo labels and detail. Only **where the upgrade is attached under `catalog.regions[].upgrades`** is narrowed.

`dedupeRegionUpgrades(catalog)` remains the end-of-write fence (already called).

## Out of scope (this patch)

- Does **not** rewrite `data/research/catalog.json` or `regional-skilling-unlocks.json` by itself — next run of the sync applies placement.
- Does not change combat/ironman sync fan-out (same pattern still exists there; separate if needed).
- Does not invent homes for empty-req rows beyond `regionHints[0]`.
- Does not collapse intentional multi-`requiredRegions` combos.

## Verify after next sync

```text
node scripts/sync-regional-skilling-unlocks.mjs
# or full: npm run normalize:data
# Then: multi-host names with requiredRegions.length === 1 should be rare/absent
# unless another writer (combat/ironman/user rulings) re-added them.
```
