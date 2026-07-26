# Grove Grid — Gallery War R1

**Fighter:** `grove` · codename **Grove Grid**  
**Preview:** `GrovePreview.tsx` · skin `.td-gw-grove` in `grove.css`  
**Scope:** concepts lab only — **no** production `/tasks` or `globals.css` edits.

---

## Thesis

**Tighter auto-fill minmax; more columns @1440p; kill card air.**

Gallery Board topology (crest tiles, expand in-tile, no side inspector) — but Herald-scale minmax wastes width. Grove packs the board:

| Break | minmax | Intent |
|---|---|---|
| &lt;720 | 1fr | Single column phone |
| default | `11.5rem` | Dense multi-col early |
| ≥1100 | `12.25rem` | Mid desk |
| ≥1400 (1440p) | `12.75rem` | **~6–7 cols** in 1600 shell (Herald ~4–5 @19rem) |

Cards lose padding, oversized crest chrome, and min-height voids. Scan stays ≥14px names; pts/Comp% mono tabular.

```
┌─ bar: title · count · search · [My build] · region · tiers ─┐
├─ board (auto-fill grid, tight gap) ─────────────────────────┤
│ ┌ tile ┐ ┌ tile ┐ ┌ tile ┐ ┌ tile ┐ ┌ tile ┐ ┌ tile ┐      │
│ │crest │ │ …    │ │ …    │ │ …    │ │ …    │ │ …    │      │
│ │□ name│ │      │ │      │ │      │ │      │ │      │      │
│ │pts % │ │      │ │      │ │      │ │      │ │      │      │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
│  (selected tile grows detail block inside the same card)   │
└────────────────────────────────────────────────────────────┘
```

Vs Gallery War peers:

| Fighter | Density move |
|---|---|
| Bastion | Fewer wider cards (2-col until xl) |
| Vault | Oversized crest medallion |
| **Grove** | **More columns + less air** |
| Herald (R3 ref) | Large polished tiles @17.5–19rem |

---

## Fixed recipe

- Editorial Echo tokens only under `.td-gw-grove` (gem interactive, gold display)
- Crystal facet chips for My build + tiers
- `useTasksDesk` + `TasksDensityPreviewProps` — real Catalyst rows only
- Expand **in-tile**; checkbox **≠** expand (`stopPropagation`)
- No permanent right inspector; no invented data; no gen-AI art; no marketing copy
- Cap first paint at 120 tiles (Crucible owns full virt window)

---

## Hook contract

```ts
useTasksDesk(raw, tiers, { rowEstimatePx: 108 })
formatCompRate / wikiTaskUrl from same module
```

Export: `GrovePreview` · props: `TasksDensityPreviewProps` · CSS `./grove.css`.

---

## Hard fails to avoid

- Expand toggling complete state
- Side inspector / third column
- Card-garden void (large minmax + big padding)
- Names under 13px; new palette; gold CTAs
