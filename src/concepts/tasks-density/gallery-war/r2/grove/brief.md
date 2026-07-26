# Grove Grid — Gallery War R2

**Fighter:** `grove` · codename **Grove Grid**  
**Round:** R2 (survivor surgery)  
**Preview:** `GrovePreview.tsx` · skin `.td-gw-grove` in `grove.css`  
**Scope:** concepts lab only — **no** production `/tasks` or `GalleryWarMount` edits in this drop.

---

## Thesis (R2)

**Keep column pressure; restore Cipher-grade mono scan; full-set virt; kill foot waste.**

R1 won viewport with `minmax(11.5–12.75rem)` and content-height tiles, then lost scan (names crushed, meta ellipsis) and ops honesty (`slice(0, 120)`). R2 steals peer axes without sliding back to Bastion void.

| Keep (R1) | Steal | Kill |
|---|---|---|
| Dense tracks (~11.5–12.75rem via RO) | Cipher mono ribbon Comp%/pts | `slice(0, 120)` |
| Content-height tiles, 0.3rem gap | Crucible row virt + measureElement | Foot / region restatement |
| Crest ~22px, no min-height bloat | Name-only head (meta → ribbon) | Idle gem washes / cue foot |

```
┌─ bar: title · count · virt n/total · search · build · region · tiers ─┐
├─ board (row-virtualized dense grid) ──────────────────────────────────┤
│ ┌ tile ────┐ ┌ tile ────┐ ┌ tile ────┐ …  (~6–7 @1440)              │
│ │□ 🏰 name │ │          │ │          │                               │
│ │┌ ribbon ┐│ │          │ │          │  left: tier·region            │
│ ││loc  %pts││ │          │ │          │  right: Comp% · pts (mono)    │
│ │└────────┘│ │          │ │          │  no foot                      │
│ └──────────┘ └──────────┘ └──────────┘                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Must-fix map

| Mustfix | Surgery |
|---|---|
| Scan baseline | Cipher ribbon: left-loc / right-figures, tabular mono Comp%/pts |
| Name crush | Drop under-name meta; head = check \| crest \| **name only**; 14px 2-line clamp + `overflow-wrap` |
| Full-set ops | `useVirtualizer` rows + ResizeObserver cols; bar shows `virt n/total`; **no TILE_CAP** |
| Foot waste | No foot row; region lives once on ribbon |
| Signature | Dense instrument grid — column count + stealable ribbon peers can absorb |

Column measure (RO, not CSS auto-fill under virt):

| Board inner | min track px | Intent |
|---|---|---|
| default | 184 (~11.5rem) | Dense multi-col early |
| ≥980 | 196 (~12.25rem) | Mid desk name room |
| ≥1280 | 204 (~12.75rem) | 1440p ~6–7 cols |

---

## Fixed recipe

- Editorial Echo tokens only under `.td-gw-grove`
- Expand **in-tile**; checkbox **≠** expand (`stopPropagation`)
- Gem only for selected / done / chip-on state — no idle multi-stop tile washes
- `useTasksDesk` + real Catalyst rows only
- Cap gone; virt is the honesty path

```ts
useTasksDesk(raw, tiers, { rowEstimatePx: 92 })
useVirtualizer({ count: ceil(visible/cols), measureElement on expand })
```

Export: `GrovePreview` · props: `TasksDensityPreviewProps` · CSS `./grove.css`.

---

## Self-score (honest — not craft cosplay)

Pass bar still **9.2**. R1 was **8.76**. Nobody should claim 9.x craft alone.

| Axis | R1 | R2 claim | Why |
|---|---:|---:|---|
| Scan 25% | 8.4 | **8.9** | Ribbon columns Comp%/pts; name-only head |
| Viewport 20% | 9.2 | **9.2** | Dense cols kept; content-height + thin shell |
| Ops 20% | 8.8 | **9.2** | Full filtered set via row virt; `virt n/total` |
| Craft 15% | 8.6 | **8.7** | Cleaner tile; postage-stamp detail still exists |
| Anti-slop 10% | 8.9 | **9.0** | No foot tax; no idle gem chrome |
| Signature 10% | 8.8 | **9.0** | Density + instrument (stealable pair) |
| **Σ (weighted)** | **8.76** | **~9.0** | Clears noise; still short of 9.2 promote |

**Why not 9.2:** in-tile expand is still narrow for long descriptions (Sigil band not absorbed — vertical cost vs column thesis). Ribbon at 11px mono is denser than Cipher’s 12px — scan is better than R1 but not Cipher’s comfortable mid-pack cards. Composite ~9.0 is movement, not promotion.

**Honest risk:** RO min tracks at 184px may still wrap long task names on mid desks; measure live before claiming name win absolute.

---

## Hard fails to avoid

- Expand toggling complete state
- Side inspector / Bastion 2-col fantasy / Vault crest monument
- Reintroducing `slice(0, 120)` without virt
- Region in ribbon **and** a foot row
- Names under 13px; gold CTAs; gen-AI art
