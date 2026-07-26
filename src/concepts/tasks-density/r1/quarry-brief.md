# Team Quarry · Crest Compact — Tasks density R1

**Codename:** Crest Compact  
**Mock:** `QuarryPreview.tsx` · skin `.td-quarry` in `quarry.css`  
**Scope:** concepts lab only — no production `TaskRecords` edits.

---

## Thesis

Keep the **three-bay DNA** (region rail · stage · inspector) that Crystal × Data already won, but **compress hard** so first-screen real estate is almost all actionable rows.

| Bay | Production | Crest Compact |
|---|---|---|
| Rail | ~10.5rem name + crest + count | **7.5rem crests-only** — title tooltip + mono count |
| Stage bar | multi-wrap title / chips | **one line** (nowrap scroll if needed) |
| Rows | name + region subline | **single line** — name · tier · Comp% · pts |
| Inspector | ~15–20rem padded prose | **12rem** dense `dl` + clamped body |

Still Crystal facet chips + carved stone. Still Editorial tokens. No topology fork — only density surgery.

---

## Layout DNA

```
┌─ 7.5rem ──┬──────────── stage (flex) ────────────┬─ 12rem ─┐
│  Region   │ Tasks  n/N · pts · Comp% [Filter]    │ TASK     │
│  Σ  420   │ My build · All easy med hard elite…  │ crest    │
│  [crest]  ├──────────────────────────────────────┤ name     │
│   38      │ ☐  Name…………………  tier  Comp%  pts   │ Pts  ·   │
│  [crest]  │ ☐  Name…………………  tier  Comp%  pts   │ Comp% ·  │
│   22      │ … virtualized, min(78vh)             │ Locality │
│  …        │                                      │ body…    │
└───────────┴──────────────────────────────────────┴──────────┘
```

**Signature in 3s:** crests without labels on the left, table fills the middle, skinny dossier on the right.

---

## Operability (parity)

- `useTasksDesk` — shared filter / progress / virtualizer
- My build toggle (unlocked + global)
- Crest rail region filter (title = display name)
- Tier facets
- Debounced search
- Checkbox progress (persisted)
- Comp% wiki deep-links (`formatCompRate` + `wikiTaskUrl`)
- Virtualization (`rowEstimatePx: 28`)
- Real Catalyst / Equilibrium records only — no invented tasks

---

## Type + ink

| Role | Spec |
|---|---|
| Task names | **14px** (`0.875rem`), parch-50; done → gem-bright |
| Secondary cells | 11–12px mono tabular |
| Rail counts | 10px mono parch-300 |
| Inspector kicker | Cinzel uppercase gold, 10px |
| Facets | Crystal gem-on when pressed |

Gem = interactive chrome only. Gold = display kicker only. No gold buttons.

---

## Why this wins density

1. **Rail width cut ~30%** without losing region filter — crests are already the identity.
2. **Row height cut** by dropping the region subline (region is the rail’s job).
3. **Inspector stays permanent but skinny** — detail without a third-column void larger than the list.
4. Stage bar stays one scan line so the list starts higher.

---

## Hard fails avoided

- No invented data
- No new palette
- No permanent empty inspector larger than the list
- Names ≥ 14px
- Progress + wiki + My build all live
