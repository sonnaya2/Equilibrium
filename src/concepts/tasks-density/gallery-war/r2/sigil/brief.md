# Sigil Focus — Gallery War R2

**Codename:** Sigil Focus · **id:** `sigil` · **round:** 2  
**R1 composite:** 8.81 · detail-width leader  
**Thesis (held):** Expand = full-width focus band under the selected card’s **row**, not a cramped in-card drawer.

## R1 → R2 surgery (mustfix)

| Must | R2 move |
|---|---|
| Closed density | minmax **17rem → 13.5rem**; crest 32→22; kill min-height bloat; content-height tiles |
| Full-set ops | Drop `slice(0, 120)`. **Row virt** over `ceil(n/cols)` with `measureElement` when band open; bar shows `virt n/total` |
| Viewport cost | Band still costs one open row — but denser closed cards recover columns; measureElement keeps scroll honest |
| Idle chrome | Flat `stage` fill at rest. No multi-stop tile wash, no outer blur. Gem border / cue only on `.is-on` |
| Foot | Region lives on the mono ribbon once. Foot is **cue only** (Focus / Open) — Ash rule, not Ash corpse |

## Peer steals

| From | Absorbed |
|---|---|
| **Crucible** | `useVirtualizer` rows, ResizeObserver cols, full filtered set, `virt n/total` |
| **Cipher** | Mono Comp%/pts ribbon — left loc (tier · region), right figures |
| **Grove** | Column pressure direction (not 11.5 crush — 13.5 keeps names readable for the band thesis) |
| **Ash** | Foot discipline: no region restatement |

## Layout DNA

```
┌ facet: title · counts · virt n/N · search · My build · region · tiers ─┐
│ board (scroll, row-virtualized)                                         │
│  [tile] [tile] [tile·on] [tile]     ← closed: face + mono ribbon + cue  │
│  ╔════════════ focus band (full row width) ════════════════════════╗   │
│  ║ sigil mark under open col · name · pts · Comp% · close           ║   │
│  ║ description · requires · wiki                                    ║   │
│  ╚══════════════════════════════════════════════════════════════════╝   │
│  …only mounted rows in the window…                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Interaction law (unchanged)

| Control | Action |
|---|---|
| Card face / ribbon click / Enter / Space | Toggle `selectedId` (band) |
| Checkbox | Complete only — `stopPropagation` |
| Comp% / wiki links | Navigate — `stopPropagation` |
| Close on band | Clear selection |

Checkbox ≠ expand. No auto-select first row for the band. `aria-controls` → `#sigil-focus-band`. Column-aligned sigil mark + `scrollIntoView` kept.

## Signature (kept)

Row-spanning focus band with column-aligned **sigil mark** under the open tile. Detail width stays the structural bet — virt and density are ops, not a new gimmick.

## Hard fails avoided

Invented data · gen-AI art · expand toggles checkbox · permanent right inspector · new palette · 120-cap lie · region in foot · idle gem washes · Bastion 2-col · Vault crest monument.

## Self-score (honest — not a pass claim)

Field law: nobody is at 9.2. This is movement, not promotion.

| Axis | R1 | R2 self | Note |
|---|---:|---:|---|
| scan | 8.9 | **9.05** | Cipher ribbon; mono Comp%/pts baseline |
| viewport | 8.4 | **8.95** | 13.5rem closed denser; open band still costs a row |
| ops | 8.9 | **9.25** | Full-set row virt + measureElement — 120 lie dead |
| craft | 8.9 | **8.85** | Flatter tiles; less paint, more instrument |
| antiSlop | 8.6 | **9.1** | Idle multi-stop / outer blur killed; gem state-only |
| signature | 9.3 | **9.3** | Band + mark held; not diluted by virt plumbing |
| **composite** | **8.81** | **~9.08** | Clears mid-pack; **does not claim 9.2** |

### Residual risk (CEO will hit)

1. Open band still burns vertical board — peers without expand may look denser at a glance.
2. 13.5rem is a compromise between Grove crush and Herald void; names can still wrap at 2 lines on long titles.
3. Virt + band measureElement can jitter once on first open if estimate is cold.

**Verdict self:** ALIVE candidate for R2 scoring · **not production-ready** until composite clears 9.2 under CEO rules.
