# Sigil Focus — Gallery War R1

**Codename:** Sigil Focus · **id:** `sigil`  
**Thesis:** Expand = full-width focus band under the selected card’s **row**, not a cramped in-card drawer. Still a gallery grid.

## Problem this solves

Herald-style in-tile detail fights card width: description wraps into a postage stamp, requirements vanish, and neighboring cards reflow awkwardly. Sigil keeps compact gallery tiles for scan, then opens a **row-spanning band** so the body text has the full board width.

## Layout DNA

```
┌ facet bar: title · counts · search · My build · region · tiers ─┐
│ board (scroll)                                                   │
│  [tile] [tile] [tile·on] [tile]                                  │
│  ╔════════════ focus band (grid-column 1 / -1) ══════════════╗   │
│  ║ name · pts · Comp% · close                                  ║   │
│  ║ description · requires · wiki                               ║   │
│  ╚════════════════════════════════════════════════════════════╝   │
│  [tile] [tile] [tile] [tile]                                     │
└──────────────────────────────────────────────────────────────────┘
```

- CSS grid `auto-fill` minmax cards.
- Column count from ResizeObserver (same math as CSS minmax) so the band inserts after the **last card of the selected row**.
- Selected tile keeps a gem carve ring (sigil mark); detail lives only in the band.
- No permanent right inspector. No invented tasks.

## Interaction law

| Control | Action |
|---|---|
| Card face click / Enter / Space | Toggle `selectedId` (expand/collapse band) |
| Checkbox | Complete only — `stopPropagation` |
| Comp% / wiki links | Navigate — `stopPropagation` |
| Close on band | Clear selection |

Checkbox ≠ expand. First row is never auto-selected for the band (`selectedId` only).

## Stack contract

- `useTasksDesk` for filter, progress, My build, region rail, tiers.
- Real Catalyst records via `TasksDensityPreviewProps`.
- Editorial tokens only under `.td-gw-sigil` (`stone` / `parch` / `gem` / `gold` display).
- Cap visible cards at 120 (search/filters still apply) — virt is Crucible’s thesis, not this one.
- Names ≥14px; mono tabular pts / Comp%.

## Signature

Row-spanning focus band with a column-aligned **sigil mark** under the selected card (shows which tile owns the open band).

## Hard fails to avoid

Invented data · gen-AI art · expand toggles checkbox · permanent right inspector · new palette · card-garden void · marketing copy.
