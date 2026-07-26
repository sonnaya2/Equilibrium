# Team Oracle · Oracle Quiet — Gallery War R1

**Codename:** Oracle Quiet  
**Mock:** `OraclePreview.tsx` · skin `.td-gw-oracle` in `oracle.css`  
**Scope:** concepts lab only — no production `TaskRecords` edits.

---

## Thesis

**Maximum anti-slop.** Gallery Board topology on **flat carved stone** — solid fills, hard 1px edges, zero decorative glow and zero multi-stop gradients. Readability comes from type hierarchy, spacing, and gem chrome used only for state — not from light shows.

Herald polished cards with radial washes and soft shadow. Oracle is the quiet cut of the same board: slab tiles that look quarried, not lit.

---

## Layout DNA (Gallery Board — mandatory)

```
┌──────────────────── shell (full stage height) ────────────────────┐
│ Oracle quiet · n/N · pts · Comp%  [search] [My build] [region]    │
│                                              [All][easy][med]…    │
├───────────────────────────────────────────────────────────────────┤
│  ┌─ tile ─┐ ┌─ tile ─┐ ┌─ tile ─┐ ┌─ tile ─┐                      │
│  │ crest  │ │ crest  │ │ crest  │ │ …auto-fill minmax            │
│  │ ☐ name │ │ ☐ name │ │ ☐ name │                                 │
│  │ tier · region      pts Comp% │  expand detail IN-TILE only    │
│  └────────┘ └────────┘ └────────┘  (no side inspector)            │
└───────────────────────────────────────────────────────────────────┘
```

**Signature in 3s:** flat stone slabs, hard gem border on open tile, no halo.

---

## MUST

| Rule | How |
|---|---|
| `useTasksDesk` | Shared filter / progress / selection — no invented tasks |
| Gallery Board | Side-by-side crest tiles; region select + My build in bar |
| Expand in-tile | `selectedId` toggles detail panel **inside** the article |
| Checkbox decoupled | Own `aria-label` + `stopPropagation` — expand ≠ complete |
| Editorial only | Token ladder via CSS vars under `.td-gw-oracle` — no new hex brand |
| No-slop hardline | No decorative gradient, no glow-at-rest, no soft outer shadow, no marketing copy |

---

## Material law (this fighter)

| Surface | Spec |
|---|---|
| Fill | Solid `stone-900` / `stone-850` / `stone-800` / `raised` / `inset` only |
| Edge | 1px `stone-750` |
| Carve | Single `inset 0 1px 0 stone-carve` on shell + bar only (structural, not gem-glow) |
| Selected | Hard `gem-500` border — **no** outer ring, **no** soft inset gem wash |
| Done | Task name ink → `gem-300` |
| Gold | Display title kicker only |
| Radius | 0–2px |

Forbidden in this skin: multi-stop linear/radial gradients, box-shadow blur, filter drop-shadow, gem “lit plate” halo, marketing hero chrome.

---

## Operability (parity)

- My build (unlocked + global)
- Region `<select>` with crest when leaf picked
- Tier facet chips
- Debounced search via desk
- Progress checkbox (persisted)
- Comp% wiki deep-links (`formatCompRate` + `wikiTaskUrl`)
- First-paint card cap 120 (filters still apply to full `visible`)
- Real Catalyst / Equilibrium records only

---

## Type + ink

| Role | Spec |
|---|---|
| Task names | ≥14px (`0.875rem`+), `parch-50`; done → gem |
| Meta | 12px `parch-300`, capitalize tier · region |
| Pts / Comp% | mono tabular; pts gem, Comp% muted wiki link |
| Bar title | Cinzel uppercase gold, display only |
| Facets | Solid raised + gem border when pressed |

---

## Hard fails avoided

Invented data · gen-AI art · expand toggles checkbox · permanent right inspector · new palette · card-garden void · marketing copy · decorative glow/gradient chrome

---

## Self-score target

Pass bar **9.2**. Win axes: Anti-slop + Scan/readability + Human craft. Risk: Signature can read “sparse” if density slips — tight grid + full viewport shell counters that.
