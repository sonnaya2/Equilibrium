# Asset archive

This directory is the local asset archive for Equilibrium. It is intentionally separate from `public/`: harvested media is source material first, and only assets actually used by the app should be copied or wired into the shipped UI.

## Provenance

`source-manifest.json` is the requested asset catalog. `manifest.generated.json` is written by `scripts/sync-assets.mjs` after a harvest and records, for every resolved file:

- local path
- canonical subject page
- exact source/file page
- direct download URL used
- MIME type and byte size
- SHA-256 of the local copy
- upstream image dimensions/SHA-1 when the RuneScape Wiki exposes them
- attribution/copyright note
- verification timestamp

Never add an unattributed game asset. If an image cannot be tied back to a Jagex/RuneScape page, RuneScape Wiki file page, or another explicit retrieval source, leave it unresolved instead of guessing.

## Layout

```text
assets/
  rs3/
    skills/        current RS3 skill icons
    combat/        combat-system / ability-category UI assets
    regions/       representative region/location UI assets
    upgrades/      item icons referenced by planner research
  leagues/
    catalyst/
      relics/      Catalyst relic art, grouped by tier in filenames
      items/       League-only items granted by relics
      trophies/    Catalyst trophy tiers
      overrides/   reward override tokens / scrolls
      tasks/       task difficulty graphics
      official/    official Catalyst web art
    equilibrium/
      official/    only officially published Leagues II media
```

No unrevealed Equilibrium relic or Blessing art is fabricated. When Jagex publishes new assets, add their official page or Wiki file target to `source-manifest.json` and run:

```text
npm run sync:assets
```

The branch workflow also runs the harvester automatically when the source catalog or sync script changes.
