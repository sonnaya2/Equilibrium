# Crucible Virt — Gallery War R1

**Codename:** Crucible Virt  
**Preview:** `CruciblePreview.tsx` · skin `.td-gw-crucible` in `crucible.css`  
**Scope:** concepts lab only — no production `TaskRecords` / `globals.css` edits.

---

## Thesis

**Full virtualized window over filtered tasks — no arbitrary 120 cap.** Herald Gallery Board DNA (side-by-side crest tiles, expand in-tile) kept; the scroll body is a **row-virtualized grid** so every filtered task is reachable without mounting the full DOM.

```
┌─ FACETS: title · count · search · [My build] · <region> · tiers ─────────────┐
├─ hint (starters-only when needed) ───────────────────────────────────────────┤
│  ┌ tile ┐ ┌ tile ┐ ┌ tile ┐     ← only on-screen rows + overscan in DOM     │
│  │crest │ │crest │ │crest │                                                  │
│  │ name │ │ name │ │expand│     ← detail opens inside the selected tile     │
│  └──────┘ └──────┘ └──────┘                                                  │
│  … virtualized rows for remaining filtered set …                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

Vs rivals:

| Fighter | Differentiator |
|---|---|
| Herald (baseline) | Gallery board, **slice(0, 120)** first-paint cap |
| Grove | Tighter auto-fill minmax columns |
| Bastion | Fewer wider cards |
| **Crucible** | **Same board, full filtered set via virt rows** |

---

## Fixed recipe (non-negotiable)

- Editorial Echo tokens only under `.td-gw-crucible` (gem interactive, gold display)
- Crystal facet chips for My build + tiers
- Feature parity: My build, region, tier, search, checkbox progress, Comp% wiki deep-links
- Real Catalyst data via `useTasksDesk` / `TasksDensityPreviewProps` — no invented rows
- Expand **in-tile**; checkbox **decoupled** (`stopPropagation` on change/click)
- Names ≥14px (`0.875rem+`); mono tabular Comp%/pts
- No permanent right inspector; no gen-AI art; no new palette

---

## Layout law

1. **Gallery board shell** — facets + optional hint + scroll board. No crest side rail, no third column.
2. **Column count from board width** — ResizeObserver → `floor((innerW + gap) / (minCard + gap))`, min 1.
3. **Virtualize rows, not a 120 slice** — `useVirtualizer` over `ceil(visible.length / cols)`; each row renders `cols` tiles.
4. **In-tile expand** — `selectedId` toggles detail inside the card; row remeasures via `measureElement` + `measure()` on selection change.
5. **Checkbox decoupled** — toggle never opens/closes expand.
6. **Viewport fill** — shell `calc(100vh - 8rem)`; board flexes; no empty inspector bay.

---

## Hook contract

```ts
useTasksDesk(raw, tiers, { rowEstimatePx: 152 })
// desk.listRef = scroll parent for row virtualizer
// row virtualizer is local (grid rows); desk virtualizer unused for layout
formatCompRate / wikiTaskUrl from same module
```

Export: `CruciblePreview` · props: `TasksDensityPreviewProps` · CSS import `./crucible.css`.

---

## Hard fails to avoid

- Reintroducing `slice(0, N)` or any hard card cap
- Expand toggle coupled to checkbox
- Permanent right inspector / invented task rows
- Names under 13px; gold interactive chrome; card-garden void

---

## Self-score (author)

| Axis | Wt | Score | Note |
|---|---:|---:|---|
| Scan / readability | 25 | 8.6 | 15px names, mono pts/Comp%, crest + tier meta; card body denser than table but scan line holds |
| Viewport fill | 20 | 9.0 | Shell fills `100vh - 8rem`; board flex; no third bay / 120 void |
| Operability | 20 | 9.2 | Full desk ops via `useTasksDesk`; wiki Comp%; progress; My build; region/tier/search; full virt window |
| Human craft | 15 | 8.4 | Carved tile plate, gem selected edge, restraint on glow; not a card garden |
| Anti-slop | 10 | 9.0 | Editorial tokens only; no marketing; no gen-AI; checkbox decoupled |
| Signature | 10 | 9.3 | Thesis lands: `virt mounted/total` + row virtualizer over **all** filtered tasks |
| **Weighted** | | **8.9** | Strong R1 contender; expand remeasure + column observer need live soak |

Pass bar 9.2 — honest miss on scan/craft vs table dens; signature + ops carry the brief.
