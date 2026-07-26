# Variant B — gem grade

Thesis: Editorial gem tokens on stone dark. Icons should read as the same
family as site chrome (`gem-300` / `gem-400`) without going neon.

## Tokens

| Token | Hex | Role |
|---|---|---|
| gem-400 | `#2ecb8f` | Soft outer rim glow (baked, low alpha) |
| gem-300 | `#57e0ae` | Subtle highlight mix on bright facets |
| stone ground | `#100e0b` / `#16120e` | Intended composite backgrounds |

## Pipeline

1. **Alpha-key** mint card background + black side bars via edge flood-fill
   (HSV gate: outer mint H≈156–178, elevated R vs pure gem cyan; olive hex
   plate and icon cyan kept). Pre-keyed transparent corners seeded into the fill.
2. **Largest component** — drop side-bar crumbs and orphan edge pixels.
3. **Soft edge** — partial alpha on silhouette border (no hard 1-bit cutout).
4. **Grade** — mid-tone contrast ×1.12, sat ×1.10 on mids, slight hue pull
   toward gem green (H≈162), green lift / red ease, bright-facet mix to gem-300.
5. **Rim** — ~2px dilated shell of gem-400 under-composited at ~0.28 peak alpha.
6. **Trim + pad** — content bbox → scale to fit 256−28 → center on 256×256 clear PNG.

## Outputs

| File | Bytes | Canvas | Source crop → scaled |
|---|---:|---|---|
| `survivalist.png` | 73699 | 256×256 | 288×252 → 228×200 |
| `endless-harvest.png` | 62033 | 256×256 | 287×252 → 228×200 |
| `golden-touch.png` | 60675 | 256×256 | 285×253 → 228×202 |

## Source

Official Equilibrium T1 relic art in `assets/leagues/equilibrium/relics/raw/`.
No gen-AI. Script: `scripts/_relic_filter_b_gem_grade.mjs`.

## Self-score

**8.4/10** — Clean hex silhouettes on `#100e0b` / `#16120e`; mint + side bars
gone; gem-400 rim readable without milky fringe; glyphs (backpack / harvest hand /
coin pinch) stay sharp. Minor residual olive AA on a few facet corners if
over-zoomed — acceptable for 256 UI use.
