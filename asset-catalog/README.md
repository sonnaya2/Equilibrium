# Art provenance catalog

The art itself lives in `public/game/` and `public/brand/` — one tree, edited directly, served as-is.
A file's path is its URL. There is no source tree shadowing it and no publish step.

This folder holds **metadata about that art**, never a second copy of it.

```text
asset-catalog/
  schema.json        every field, documented
  rs3/               activities, bosses, combat, regions, skills, upgrades
  leagues/           catalyst, equilibrium
  brand.json
```

## Rows

Sharded by domain so a change is a readable diff. Rows record durable facts only — source page, wiki
file title, attribution. Never download URLs, hashes, or timestamps; those belong to `.asset-cache/`,
which is not tracked.

`path` carries **no extension**: the file on disk decides it.

Where no real source could be established the row says `"provenance": "unverified-local"`. Do not
invent a `canonicalPage` to fill that in — `art:check` fails if a row claims both.

`alsoAt` lists other paths holding the same picture, for the cases where two resolvers want one image
in two places (`activityIconPath` → `/game/activities/…`, `upgradeIconPath` → `/game/upgrades/…`).
`art:check` fails on any byte-identical pair that no `alsoAt` explains, so duplication has to be
deliberate and written down.

Historical duplicate rows are merged as `aliases` or `provenanceAlternates`; do not split the catalog
into numbered manifests again.

## Add or refresh art

1. Add a row to the right shard.
2. Fetch into the local cache — this never writes `public/`:

   ```bash
   npm run art:fetch -- <asset-id>
   ```

3. Promote it into `public/game/`, optimized on the way in:

   ```bash
   npm run art:import -- <asset-id>
   ```

4. Rebuild the icon index and check:

   ```bash
   npm run art:index && npm run art:check
   ```

Fetch and import are separate and per-asset on purpose. A bulk re-download is how optimized art used
to get overwritten by raw upstream copies.

## Checks

| Command | What it proves |
| --- | --- |
| `npm run art:check` | The whole gate; CI runs this |
| `npm run art:index:check` | `src/lib/dataIconIndex.ts` matches `public/game` |
| `npm run art:inventory` | Sizes, duplicates, provenance coverage |
| `npm run optimize:images` | Re-encodes in place; never renames, so no reference goes stale |

Never add unattributed game art. If an image cannot be tied to a Jagex/RuneScape page or a RuneScape
Wiki file page, leave it unresolved. No unrevealed Equilibrium Relic or Blessing art is fabricated.
See the root `NOTICE` for the RuneScape Wiki licence, Jagex Fan Content Policy, and redistribution
boundaries.
