# Variant D — stone inset plate

Thesis: ship each T1 relic hex as if recessed into a stone bezel — transparent
outside the hex, a soft cool dark radial under the face, micro top-light /
bottom-shade bevel on the rim. Official teal identity preserved; no gold or
purple recolor. Goal: reads finished in a UI cell without CSS filters.

## Pipeline

1. Load official raw PNG (`assets/leagues/equilibrium/relics/raw/`).
2. Chroma-key near-black plate + dark-teal fringe → alpha.
3. Geometric flat-top hex mask (soft AA) kills residual plate outside the gem.
4. Soft cool radial vignette (center clear → ~20% dark teal-black at rim).
5. Micro bevel: lighten upper face ~8%, darken lower face ~8% (stronger at rim).
6. Trim transparent padding, lanczos fit to ~92% of 256×256, center on clear canvas.
7. Write PNG (compression 9).

Script: `scripts/_relic_filter_d_stone_inset.mjs` (Node + sharp, no new deps).

## Outputs

| File | Bytes | Source |
|---|---:|---|
| `survivalist.png` | 58055 | 350×303 raw |
| `endless-harvest.png` | 51604 | 350×303 raw |
| `golden-touch.png` | 52023 | 349×303 raw |

All outputs: **256×256** RGBA PNG.

## Self-score (Agent D)

| Criterion | Score | Note |
|---|---:|---|
| Alpha cleanliness | 8.5/10 | Hex mask + dark-teal key; soft AA, no rectangular card |
| Stone inset read | 8/10 | Radial cool shadow under face; subtle, not a drop-shadow blob |
| Teal identity | 9.5/10 | No hue shift; only multiply toward cool dark + ±8% bevel |
| Bevel craft | 7.5/10 | Gentle; does not invent a hard rim light |
| Cell-ready (no CSS) | 8.5/10 | Transparent pad + inset shading should sit on stone UI as-is |
| Fidelity to official art | 9/10 | Same geometry/icon; only plate removal + inset grade |

**Overall: 8.5/10** — shippable as the recessed / inset candidate. Re-run script
if raw plates change; do not hand-edit the PNGs.

## Hard rules honored

- Official art only (no gen-AI).
- Does not touch other variants or production UI paths.
- No new npm dependencies (uses existing `sharp`).
