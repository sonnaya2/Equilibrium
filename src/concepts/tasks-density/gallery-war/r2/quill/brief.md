# Quill Index · Gallery War R2

**Codename:** Quill Index  
**Id:** `quill`  
**Skin:** `.td-gw-quill` in `quill.css`  
**Preview:** `QuillPreview.tsx`  
**Scope:** concepts lab only — no production `/tasks` edits.  
**R1 composite:** 8.81 · chrome-height leader · ALIVE

---

## Thesis (kept)

**Facet bar is one dense track.** Shell `calc(100vh - 5.5rem)`. Board owns remaining height. Expand **in-tile**. No side inspector. Gold mark only; gem for interactive state.

R2 does not abandon the track — it makes the **board** match the chrome win.

---

## R2 surgery (mustfix)

| Must | R2 move |
|---|---|
| Board DNA densify | Drop Herald minmax/min-height. Row virt measures denser cards (`MIN_CARD_PX` 210 ≈ 13.1rem). Content-height tiles (no 6.75rem floor). Crest medallion 24px → 22px. |
| Full-set ops | **No `slice(0, 120)`.** Steal Crucible: `useVirtualizer` over `ceil(visible/cols)`, ResizeObserver cols, `measureElement` on expand, `virt n/total` in track count. |
| Discoverability | Outer track no longer scrolls as one blob. **Fixed cluster** (mark · count · search · My build · tiers) + **nested crest rail** with thin scrollbar + edge mask. Filters stay on-screen without a second toolbar row. |
| Foot | **Kill region restatement.** Region lives once on the mono ribbon (`tier · region`). Foot = Details/Open cue only (Ash discipline). |
| Steal peer axes | **Cipher** mono Comp%/pts ribbon; **Crucible** reach/virt; **Grove** column pressure via denser card width; keep Quill chrome height. |

```
┌─ track ~2.15rem ─────────────────────────────────────────────────────►
│ [Index · virt · Filter · My build · tiers] │ Σ crest crest … (scroll)│
├──────────────────────────────────────────────────────────────────────┤
│ dense tile · dense tile · dense tile     full filtered set (virt)   │
│ mono ribbon: Easy · Misthalin     12.4%  10pts                       │
│                                              Details                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Interaction law

1. **Default:** no tile expanded.
2. **Click / Enter / Space** on tile body or ribbon: toggle expand.
3. **Checkbox:** `stopPropagation` — complete ≠ expand.
4. **Filter change:** desk clears `selectedId`.
5. **Close** / re-select collapse. Expand height remeasured for virt.

---

## Visual law

- Scope under `.td-gw-quill` (Editorial `--color-*`).
- Gem = pressed chips / selected / wiki / pts / virt count. Gold = “Index” only.
- Names **14px** (`0.875rem`) — denser cards, still readable (not Grove crush).
- Mono tabular ribbon for Comp%/pts.
- No rest-state multi-stop washes / outer blurs. Flat panel + inset ribbon.
- No glass, no marketing strip, no gold buttons.

---

## Honest self-score (R2, pre-CEO)

Field law: nobody is at 9.2 until composite beats Herald on scan + full-set + no chrome tax. Scores are **surgery progress**, not pass claims.

| Axis | Wt | R1 | R2 | Note |
|---|---|---|---|---|
| Scan / readability | 25 | 8.6 | **8.95** | Cipher ribbon + denser columns; names 14px hold |
| Viewport fill | 20 | 9.1 | **9.25** | Track still thin; board denser (more tiles in same shell) |
| Operability | 20 | 9.0 | **9.2** | Full-set virt + fixed filter cluster; checkbox ≠ expand |
| Human craft | 15 | 8.4 | **8.7** | Ribbon + carved flats; no idle gem wash |
| Anti-slop | 10 | 8.8 | **9.1** | Foot discipline; no region double-print |
| Signature | 10 | 9.0 | **9.15** | Thin track still obvious; now paired with dense board |
| **Weighted** | | **8.81** | **~9.05** | Clears “chrome only” trap; still under 9.2 production bar |

**Hard-fail check:** no permanent inspector; no invented data; expand ≠ checkbox; Editorial only; gallery + in-tile expand; no 120-cap lie.

**Risks CEO still owns:** in-tile detail body remains tighter than Sigil band on long prose (mitigated with `max-height` scroll on detail body — not a full band). If R2 wants detail-width parity, next steal is Sigil structure without growing chrome.

---

## Files

| Path | Role |
|---|---|
| `src/concepts/tasks-density/gallery-war/r2/quill/QuillPreview.tsx` | Preview (`export function QuillPreview`) |
| `src/concepts/tasks-density/gallery-war/r2/quill/quill.css` | Scoped skin `.td-gw-quill` |
| `src/concepts/tasks-density/gallery-war/r2/quill/brief.md` | This brief |

**Not edited:** production `/tasks`, `GalleryWarMount` (still wires r1 until PM rewires), other survivors.
