# Asset archive

`assets/` is the only editable image tree. `public/game/` and `public/brand/` are generated from it
by `scripts/publish-assets.mjs` on every dev, build and test run, and are not tracked — never edit
them, and never expect a hand-made file there to survive.

```text
assets/
  catalog/           provenance rows, sharded by domain
  rs3/               RS3 game art        -> public/game/**
  leagues/           League media        -> routed explicitly
    catalyst/
    equilibrium/
  brand/             site key art        -> public/brand/**
```

## Provenance

`assets/catalog/` is the canonical catalog, sharded so a change is a readable diff. `schema.json`
documents every field. Rows record durable facts only — source page, wiki file title, attribution —
never download URLs, hashes, or timestamps; those belong to `.asset-cache/`, which is not tracked.

A `path` carries **no extension**: the extension follows whatever is on disk.

Where no real source could be established the row says `"provenance": "unverified-local"`. Do not
invent a `canonicalPage` to fill that in. Historical duplicate rows are merged as `aliases` or
`provenanceAlternates`; do not split the catalog into numbered manifests again.

## Routing

`scripts/assets/routes.mjs` is the single description of what publishes where. `assets/rs3` and
`assets/brand` publish by path convention. `assets/leagues` predates that convention, so its
published files are named one by one.

Never served, at any depth: `_*` (dev artefacts), `raw/` (pre-optimization originals), `variants/`
(design explorations that lost).

One file can serve several URLs. When two resolvers want the same picture at different paths, the row
lists the extras under `publish` instead of the tree holding a second copy of the bytes.

## Add or refresh an asset

1. Add a row to the right shard under `assets/catalog/`.
2. Fetch into the local cache — this never touches `assets/`:

   ```bash
   npm run assets:fetch -- <asset-id>
   ```

3. Promote into `assets/`, optimized on the way in:

   ```bash
   npm run assets:import -- <asset-id>
   ```

4. Rebuild the index, republish, and check:

   ```bash
   npm run assets:index && npm run assets:publish && npm run assets:check
   ```

Fetch and import are deliberately separate and per-asset. Bulk re-downloads are how optimized art
used to get overwritten by raw upstream copies.

## Checks

| Command | What it proves |
| --- | --- |
| `npm run assets:check` | The whole gate; CI runs this |
| `npm run assets:publish:check` | `public/` matches what `assets/` says it should be |
| `npm run assets:index:check` | `src/lib/dataIconIndex.ts` matches `assets/` |
| `npm run assets:inventory` | Baseline report: sizes, duplicates, orphans |

Never add unattributed game art. If an image cannot be tied to a Jagex/RuneScape page or a RuneScape
Wiki file page, leave it unresolved. No unrevealed Equilibrium Relic or Blessing art is fabricated.
See the root `NOTICE` for the RuneScape Wiki licence, Jagex Fan Content Policy, and redistribution
boundaries.
