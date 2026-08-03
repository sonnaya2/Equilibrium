# Asset catalog

Game art is stored under `public/game/` and `public/brand/`. The files in this folder are metadata only: source pages, attribution, aliases, and the paths used by the app.

There is no second source-art tree and no publish step. A file's location under `public/` is its served URL.

```text
asset-catalog/
  schema.json
  brand.json
  rs3/
  leagues/
```

The catalog is split by domain so changes stay readable.

## Important fields

`path` is written without a file extension. The file on disk determines the extension.

`provenance` records how confidently the source is known. Use `unverified-local` when a real source page cannot be established. Do not invent a `canonicalPage` to make an unresolved row look complete.

`alsoAt` lists intentional copies of the same image at other app paths. `npm run art:check` reports unexplained byte-identical duplicates, so repeated files need to be declared rather than ignored.

Older duplicate records should be represented with aliases or alternate provenance, not separate numbered manifests.

## Add or update an asset

1. Add or update the metadata row in the appropriate shard.
2. Fetch the source file into the local asset cache:

   ```bash
   npm run art:fetch -- <asset-id>
   ```

3. Import the checked file into `public/game/`:

   ```bash
   npm run art:import -- <asset-id>
   ```

4. Rebuild the icon index and run the asset checks:

   ```bash
   npm run art:index
   npm run art:check
   ```

Fetch and import are separate so a bulk download cannot overwrite optimized files already in `public/`.

## Checks

```bash
npm run art:check        # full asset gate used by CI
npm run art:index:check  # checks the generated icon index
npm run art:inventory    # sizes, duplicates, and provenance coverage
npm run optimize:images  # re-encodes files in place without renaming them
```

Do not add unattributed game art. Leave an asset unresolved when it cannot be tied to a Jagex page or RuneScape Wiki file page. Unrevealed Equilibrium Relic and Blessing art is not fabricated.

See the root [NOTICE](../NOTICE) for the RuneScape Wiki licence, Jagex Fan Content Policy, and redistribution limits.
