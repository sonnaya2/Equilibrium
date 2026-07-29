# Asset archive

`assets/` is the source archive for game art. `public/game/` contains the subset served by the app.

## Provenance

`source-manifest.json` is the single canonical asset catalog. Every row keeps its local path,
RuneScape or Jagex source, and the exact Wiki file title when known. Historical duplicate rows were
merged as `aliases` or `provenanceAlternates`; do not split the catalog into numbered manifests
again.

`manifest.generated.json` is a local build artifact written by `scripts/sync-assets.mjs`. It records
resolved download URLs, hashes, dimensions, attribution, and unresolved rows, then feeds
`scripts/publish-assets.mjs`. It is intentionally gitignored.

Never add unattributed game art. If an image cannot be tied to a Jagex/RuneScape page or a
RuneScape Wiki file page, leave it unresolved.

## Add or refresh an asset

1. Add or update its row in `source-manifest.json`.
2. Validate the catalog without network access:

   ```bash
   node scripts/sync-assets.mjs --check
   ```

3. Harvest and publish:

   ```bash
   npm run sync:assets
   ```

4. Check archive/public coverage:

   ```bash
   npm run audit:assets-provenance
   ```

The manual GitHub asset workflow runs the same harvest and publish path after review.

## Layout

```text
assets/
  rs3/
    skills/
    combat/
    regions/
    upgrades/
  leagues/
    catalyst/
    equilibrium/
```

No unrevealed Equilibrium Relic or Blessing art is fabricated. See the root `NOTICE` for the
RuneScape Wiki licence, Jagex Fan Content Policy, and redistribution boundaries.
