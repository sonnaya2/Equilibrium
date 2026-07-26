# Crucible Virt · Gallery War R2

**Codename:** Crucible Virt  
**Id:** `crucible`  
**Round:** R2  
**Preview:** `CruciblePreview.tsx` · skin `.td-gw-crucible-r2` in `crucible.css`  
**Scope:** concepts lab only — no production `/tasks` / `globals.css` edits.  
**R1 score:** 8.84 (reach leader, ALIVE)

---

## Thesis

**Full virtualized window + Cipher mono scan ribbon.** R1 owned reach (`useVirtualizer` over every filtered task, no `slice(0, 120)`). R2 marries that to Cipher’s Comp%/pts instrument so engineering alone is not the scan story. Denser column track, no foot region restatement, no idle diagonal wash.

```
┌─ FACETS: Crucible · count · virt n/total · search · [My build] · region · tiers ─┐
│  ┌ tile ──────────────┐  ┌ tile ──────────────┐     ← only on-screen rows mount │
│  │ □ [crest] name     │  │ □ [crest] name     │                                  │
│  │ ┌─ mono ribbon ──┐ │  │ ┌─ mono ribbon ──┐ │                                  │
│  │ │ easy · Glob 10p│ │  │ │ hard · Asg 25p │ │  ← left loc / right figures     │
│  │ └────────────────┘ │  │ └────────────────┘ │                                  │
│  │            Details │  │            Details │  ← open-hint only, no region foot│
│  └────────────────────┘  └────────────────────┘                                  │
│  … virtualized rows for remaining filtered set …                                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## R2 surgery (mustfix)

| Must | What changed |
|---|---|
| Scan line | Absorbed Cipher mono ribbon — tier·region left, Comp%/pts right, tabular mono baseline |
| Tile density | `MIN_CARD_PX` 276 → **242** (~15.1rem); gap 9 → 6; crest 34 → 22; collapsed row est 152 → 118 |
| Foot | Region foot **deleted**. Ribbon owns region; cue is open-hint only (Ash discipline) |
| Idle chrome | Diagonal multi-stop tile wash **stripped**. Flat `stone-800` at rest; gem edge only `.is-on` |
| Keep | `useVirtualizer` rows, ResizeObserver cols, full filtered set, `virt n/total` in bar, measureElement on expand |

---

## Fixed recipe

- Editorial Echo tokens only under `.td-gw-crucible-r2`
- Crystal facet chips for My build + tiers; gem interactive / gold display
- Feature parity via `useTasksDesk` — My build, region, tier, search, checkbox progress, Comp% wiki
- Expand **in-tile**; checkbox **decoupled** (`stopPropagation`)
- Names 15px (`0.9375rem`); mono tabular ribbon
- No `slice(0, N)`; no permanent inspector; no gen-AI; no new palette

---

## Hook contract

```ts
useTasksDesk(raw, tiers, { rowEstimatePx: 118 })
// listRef = scroll parent for row virtualizer
// local useVirtualizer over ceil(visible.length / cols)
// measureElement + measure() on selection / cols change
```

Export: `CruciblePreview` · props: `TasksDensityPreviewProps` · CSS `./crucible.css`.

---

## Hard fails to avoid

- Reintroducing `slice(0, N)` or any hard card cap
- Region restated in foot while ribbon/meta already carries it
- Rest-state multi-stop washes / outer blurs (Ember kill condition)
- Expand coupled to checkbox
- Bastion 2-col fantasy / Vault crest monument

---

## Honest residual risk

- In-tile expand is still a **postage stamp** for long descriptions (Sigil band not absorbed — not mandatory for Crucible this round; field law #7 still applies if CEO scores detail width hard).
- Density push can wrap long names at 2 lines — same clamp as Cipher; not Grove crush.
- Hybrid signature (virt + stolen ribbon) may read as “Cipher with virt” rather than a new instrument — acceptable if ops + scan both clear.

---

## Self-score (author — R2)

Field law: **nobody is at 9.2**; do not invent craft 9.x.

| Axis | Wt | R1 | R2 | Note |
|---|---:|---:|---:|---|
| Scan / readability | 25 | 8.5 | **8.95** | Ribbon columns Comp%/pts; quiet head; 15px names. Not pure Cipher (virt row jitter still a risk). |
| Viewport fill | 20 | 9.0 | **9.05** | Same shell fill; denser minmax packs more cards per row. |
| Operability | 20 | 9.15 | **9.2** | Full-set virt kept — only R1 fighter that already refused the 120 lie. |
| Human craft | 15 | 8.3 | **8.55** | Flat rest plates; ribbon inset is the craft; less crest theater. |
| Anti-slop | 10 | 8.7 | **9.0** | Idle wash cut; foot redundancy cut; editorial only. |
| Signature | 10 | 9.1 | **8.9** | Reach still unique; scan is now shared DNA with Cipher — hybrid, not pure thesis. |
| **Weighted** | | **8.84** | **~9.0** | |

**Pass bar 9.2 — honest miss (~9.0).** Movement on every mandatory axis. Residual: postage-stamp detail + signature dilution from steal. CEO owns the composite; this is not a self-promotion.
