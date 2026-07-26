# Ash · Ashen Ledger — R1 brief

**Codename:** Ashen Ledger  
**Thesis:** Stone-heavy, minimal gradient, wiki-card density.

## Beat Herald on

| Herald waste | Ash cut |
|---|---|
| Shell radial gem/gold washes | Flat `stone-900` shell; carve highlight only |
| Tile diagonal multi-stop gradient | Solid `stone-850` panel; inset carve edge |
| `minmax(17.5–19rem)` + 0.55–0.65rem gap | `minmax(13.5–14.25rem)` + 0.35–0.4rem gap |
| Crest slot 2.75rem + heavy medallion chrome | Crest 1.85rem flat stone inset |
| Tile min-height 7.5rem + fat padding | Content-height cards; 0.4rem head padding |
| Foot restates region already in meta | Foot = open hint only |
| Dual decorative shadows | Selected = gem border + thin inset; rest is flat |

## Layout

```
┌── bar: title · counts · search · My build · region · tiers ──┐
├── optional electives hint ────────────────────────────────────┤
├── board (scroll) ─────────────────────────────────────────────┤
│  [tile][tile][tile][tile]…  auto-fill denser columns          │
│  expand opens INSIDE the clicked tile (no side inspector)     │
└───────────────────────────────────────────────────────────────┘
```

Scoped root: **`.td-gw-ash`** (`ash.css`). Editorial tokens only.

## Ops (via `useTasksDesk`)

- My build · region select · tier chips · search
- Checkbox progress (stopPropagation; **no** `label htmlFor` on name)
- Expand = tile head `role="button"`; checkbox is separate
- Comp% + wiki deep-link · `RegionCrest` real art · 120-tile paint cap

## Scan contract

- Name ≥14px; pts mono gem; Comp% secondary mono
- Gold only on small display title
- Gem on selected border, done name, pts, pressed chips
- Zero marketing copy; open on the board
