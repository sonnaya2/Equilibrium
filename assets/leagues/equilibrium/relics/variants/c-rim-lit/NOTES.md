# Variant C — rim-lit stone

Thesis: carved **stone-UI medallions**. Flat mint face darkened toward stone so they don't wash out on dark panels; glyph stays bright teal; warm gold hairline rim (`#e0b264` / gold-400) so the hex sits in stone chrome without floating.

## Pipeline

1. Load official raw hex PNG (no gen-AI).
2. Fit flat-top regular hex silhouette; soft AA edge.
3. Key exterior mint glow + black side bars → alpha.
4. Darken flat mint face (olive-green midtones) toward stone value.
5. Preserve / slight lift on cyan-teal glyph facets + white highlights.
6. Warm outer bevel toward gold/parch; stamp gold hairline at hex perimeter.
7. Mild inner shade under rim for carved depth.
8. Trim + Lanczos contain → **256×256** transparent PNG.

Script: `scripts/_relic_filter_c_rim_lit.mjs`

## Outputs

| File | Size | Dims |
|---|---:|---|
| `survivalist.png` | 22567 B | 256×256 |
| `endless-harvest.png` | 20512 B | 256×256 |
| `golden-touch.png` | 20406 B | 256×256 |

## Self-score (variant C)

| Criterion | Score | Note |
|---|---:|---|
| Transparency / no leftover bars | 9/10 | Hex AA + black key; corner mint fully gone |
| Stone face (not washed mint) | 8/10 | ~14–22% face darken toward stone gray-green |
| Glyph punch | 9/10 | Cyan/teal + white highlights preserved/lifted |
| Gold rim readability on stone | 9/10 | `#e0b264` hairline + warm bevel band |
| 256 fit / centering | 10/10 | Contain after trim |
| Overall ship readiness | **8.5/10** | Strong stone-panel fit; re-tune hair width if monogram frames crop tight |

## Sources

- `assets/leagues/equilibrium/relics/raw/{survivalist,endless-harvest,golden-touch}.png`
