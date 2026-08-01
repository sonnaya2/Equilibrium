# Tier 1 relic icons

Source art: official Equilibrium reveal renders for Survivalist, Endless Harvest and Golden Touch,
via runescape.wiki (`File:Survivalist.png`, `File:Endless_Harvest.png`,
`File:Golden_Touch_(relic).png`). Kept in `raw/` unmodified at their original 350x303. No generated
art anywhere in this directory.

The reveal renders arrive on an opaque near-black plate with mint side bars, which reads as a
rectangular card when dropped into a stone UI cell. `champion/` holds the processed 256x256 RGBA
version that ships; `public/game/relics/` holds the WebP conversion the app actually loads. The
`.jpg` news-splash portraits are separate art and are not derived from these.

## Processing

Each icon is chroma-keyed off the plate, clipped to a flat-top hex with a soft antialiased edge,
given a cool radial vignette under the face and a roughly ±8% top-light/bottom-shade bevel at the
rim, then trimmed and fitted to about 92% of a 256x256 transparent canvas. Hue is untouched: the
official teal has to survive, so the grade only multiplies toward a cool dark.

The processing script is local tooling and is not tracked (`scripts/_*` is ignored). Do not hand-edit
the outputs — replace the raw art and re-run.

## Variants

`variants/` keeps three alternatives that were rendered against the stone UI and not shipped:
`a-cutout` (pure chroma cutout, no grade), `b-gem-grade` (graded toward the gem tokens with a baked
rim glow), `c-rim-lit` (face darkened toward stone with a warm gold hairline). They are worth
re-checking if the surrounding panel treatment changes — `c-rim-lit` in particular suits a framed
titlebar better than a dense grid cell.
