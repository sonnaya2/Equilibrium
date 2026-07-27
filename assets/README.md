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

### Provenance gap (closing)

Bulk harvests left many files on disk without per-path rows in
`manifest.generated.json`. Path match is authoritative; basename-only soft
matches can false-positive across categories.

#### Audit (report only, exit 0)

```bash
node scripts/audit-public-game-provenance.mjs
# -> scraped-data/public-game-provenance-gap.json
```

Counts from the 2026-07-27 path-level audit (re-run after harvest to refresh):

| Tree | Total | Path-matched | Soft-only | Path-unmatched |
|------|------:|-------------:|----------:|---------------:|
| `public/game` | 2565 | 2095 | 457 | **470** |
| `assets/rs3` | 2539 | 2099 | 440 | 440 |
| `assets/leagues` | 88 | 72 | 16 | 16 |

`manifest.generated.json` at audit time: **2170** rows.

Priority path-gaps under `public/game` (subset of the 470): permanent-unlocks
~247, skilling-production ~57, combat/equipment ~49, progression ~41, other
inventory buckets smaller; ~45 non-priority (leagues promo, terrain, etc.).

#### Local registration (no re-download)

```bash
node scripts/register-local-assets-provenance.mjs
```

Registers existing `assets/rs3/**` (and leagues) files into
`manifest.generated.json` and writes
`source-manifest-expansion-bulk-local-2026-07-27.json`. Wiki `File:` titles
are **slug guesses** — re-verify high-value icons with a real wiki resolve
when convenient. Note: that bulk filename is **not** picked up by
`scripts/sync-assets-expanded.mjs` (regex is `source-manifest-expansion(-N)?\.json`
only); it is applied by the local register script itself.

#### Expansion 42 (inventory path-gaps)

`source-manifest-expansion-42.json` — **271** inventory-style path-gap entries
(permanent-unlocks, combat/equipment, progression, skilling-*), kebab slug
guesses for `canonicalPage` / `sourcePage` / `fileTitle`. Skips activity-place
dumps misfiled under permanent-unlocks when the stem is also under
`activities/` and does not look item-like. Cap was 400; 271 after filters.

After expansion 42 is harvested into the generated manifest, expect roughly
**~200 remaining path-unmatched** under `public/game` (mostly place/activity
dumps under permanent-unlocks, leagues promo art, terrain, and other
non-inventory leftovers). Re-run the audit to get the exact residual.

#### Complete the harvest (prefer single-expansion)

Do **not** run full `npm run sync:assets` just to absorb expansion 42 — it
re-resolves/re-downloads the whole catalog and can take hours.

```bash
# After editing source-manifest-expansion-N.json (wiki resolve + download)
node scripts/sync-assets-expanded.mjs

# Publish attributed rows into public/game (manifest-driven copy)
node scripts/publish-assets.mjs

# Refresh gap report
node scripts/audit-public-game-provenance.mjs
```

If files already sit on disk under the expansion `path` and you only need
manifest rows, prefer extending/using `register-local-assets-provenance.mjs`
rather than re-fetching. Full `npm run sync:assets` remains for intentional
catalog rebuilds.

See root `NOTICE` for license carve-outs.

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
