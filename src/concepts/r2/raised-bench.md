# Raised Bench — Round 2 color / readability concept (Agent E)

**Bias:** Lift panel surfaces toward warmer mid-stone so existing parch ink has real contrast; keep the void dark; strengthen borders one step; leave gem as chrome and gold as title-only ink.

**Problem addressed:** Production `stone-850` / `stone-800` panels sit so close to void that mid-brown `parch-300` / `parch-400` reads muddy (brown on brown), not merely “dark mode.” Raising surfaces is cheaper and more legible than bleaching text or inventing a second ink system.

**Shell DNA:** Round 1 winner Control Surface (tree · table · inspector). This round only re-paints depth — no IA fork, no pink/Print, no production `globals.css` edit.

---

## Thesis

```
void stays black-umber ──► panels lift into mid warm stone ──► parch ink punches
                           borders step up one stop            gem stays chrome
                           tables live on stage, not void     gold = titles only
```

Contrast is mostly a **surface problem**. Keep `parch-50` / `parch-100` / `parch-300` as the ink ladder; move the bench under them.

---

## Proposed token map

Values are **proposal only** (mock uses inline hex). Production tokens stay until a ship decision.

### Surfaces (new ladder)

| Role | Token (proposed) | Hex | vs production |
|---|---|---|---|
| Page void | `--color-stone-950` | `#0d0a07` | **unchanged** — keep the room dark |
| Shell / nav strip | `--color-stone-900` → slightly lifted | `#16120c` | from `#14100b` |
| Tree rail + inspector | `--color-bench-rail` (new) | `#2a2218` | replaces dark `stone-900` side columns |
| Table stage | `--color-bench-stage` (new) | `#32291e` | tables sit here, not on void |
| Raised panel / selected row | `--color-bench-raised` (new) | `#3a3024` | was `stone-850` `#1b1610` |
| Inset field (inputs) | `--color-bench-inset` (new) | `#241c14` | recessed control wells |
| Border default | `--color-stone-750` lift | `#5a4a36` | was `#332a1e` — more visible carve lines |
| Border strong (fields, focus wells) | `--color-bench-border-hi` | `#6b5840` | optional step above default |
| Carve highlight (inset top edge) | `--color-stone-carve` lift | `#7a684c` | was `#463a29` — lit edge readable on raised |

Ship option: keep names `stone-800/850/750` but reassign hexes; or introduce `bench-*` and map `.panel` / `.data-table` to them. Prefer **reassign production stone steps** if hierarchy stays 950→750 so existing class names keep working.

### Ink (keep — do not chalk)

| Role | Token | Hex | Rule |
|---|---|---|---|
| Primary data / row names | `parch-50` | `#efe7d5` | ≥14px table body |
| Secondary data / regions | `parch-100` | `#d3c8b0` | body secondary; preferred over 300 on stage |
| Labels / column heads / meta | `parch-300` | `#a99f88` | ≥11px; **on raised mid-stone only** |
| De-emphasized lab meta | `parch-400` | `#948a73` | captions; avoid for live table cells |
| Engraved titles | `gold-400` | `#e0b264` | display type only — never active nav |
| Active chrome / key figure | `gem-300`–`400` | `#57e0ae` / `#2ecb8f` | tabs, tree active, key number |
| God triad | chaos / order / balance | unchanged | data semantics only |

### Explicit non-goals

- No EverSense pink / Print notes  
- No order-blue chrome  
- No gold as selected state  
- No light theme, no glass, no glow-at-rest  
- No bleaching `parch-50` toward white  

---

## Surface hierarchy

```
┌─ void #0d0a07 ─────────────────────────────────────────────────────────┐
│  ┌─ shell #16120c ── nav + tabs + thesis strip ──────────────────────┐ │
│  │                                                                     │ │
│  │  ┌ rail #2a2218 ┐  ┌ stage #32291e ─────────────┐  ┌ rail ───────┐ │ │
│  │  │ tree         │  │ header + FILTER            │  │ inspector   │ │ │
│  │  │ active leaf  │  │ ┌ sticky thead ──────────┐ │  │ gold title  │ │ │
│  │  │  → stage bg  │  │ │ rows on stage          │ │  │ parch name  │ │ │
│  │  │  + gem rail  │  │ │ selected → raised      │ │  │ ┌ raised ─┐ │ │ │
│  │  │              │  │ │            #3a3024     │ │  │ │ key fig │ │ │ │
│  │  │              │  │ └────────────────────────┘ │  │ └─────────┘ │ │ │
│  │  └──────────────┘  └────────────────────────────┘  └─────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘

Depth method (unchanged law): hairline border + inset top carve edge.
Only the stop values move up so edges separate panels instead of dissolving.
```

### Depth rules

1. **Void never holds table text** — stage is mandatory under dense data.  
2. **One raise per selection** — selected row / panel uses `raised`, not a second accent fill.  
3. **Inset is darker than rail** — inputs dig in (`#241c14`), they do not float lighter than the table.  
4. **Gem is line + type**, not a filled slab at rest (active tab may use thin gem border + rail fill).  

---

## Contrast notes

Approximate WCAG relative luminance pairs (sRGB, conceptual — verify with a meter before ship):

| Pair | Intent | Notes |
|---|---|---|
| `parch-50` on `stage #32291e` | Primary body | Clear lift vs `parch-50` on `stone-850 #1b1610` — same ink, better ground |
| `parch-100` on `stage` | Secondary body | Prefer over `parch-300` for region cells |
| `parch-300` on `raised #3a3024` | Labels / notes | Target ≥4.5:1 for UI text; mid-stone is the fix for muddy meta |
| `parch-300` on production `stone-850` | **defect** | Feels same-hue as ground; fails the squint test even when ratio is borderline |
| `parch-400` on void / shell | Lab captions only | Keep off live data cells |
| `gem-400` on `rail` / `stage` | Active + key figure | Unchanged chrome punch (~130° from umber) |
| `gold-400` on `rail` | Engraved heading | Title strip only |
| Border `#5a4a36` on `rail`/`stage` | Structure | Visible panel seams without chalk outlines |

### Readability floor (binding, same as rubric)

- Data cells ≥ **14px** (mock table body is 14)  
- Labels ≥ **11px**  
- Key figure ≥ **20px** (mock uses 22 mono gem)  
- Head-still three-column shell: tree selects category, table lists, inspector holds selection  
- No invented league numbers — fixture rows labeled fixtures  

### Before / after (production vs Raised Bench)

| Surface | Production | Raised Bench |
|---|---|---|
| Page | `#0d0a07` | `#0d0a07` (keep) |
| Panel / card | `#1b1610` | `#3a3024` raised |
| Side columns | `#14100b` | `#2a2218` rail |
| Table ground | often void / 850 | `#32291e` stage |
| Border | `#332a1e` | `#5a4a36` |
| Body ink | parch-50 | parch-50 (unchanged) |
| Meta ink | parch-300/400 on dark | parch-300 on raised |

---

## IA for data tabs

Same Control Surface tree — mount only the active leaf. Proposed Data tree:

```
Data
├── Browse
│   ├── Regions
│   └── Skills
├── Progression
├── Unlocks
├── Consumables
├── Systems
├── Crafting
│   ├── Arch
│   └── Masterwork
└── Boundaries
```

### Route skins (shell constant; stage content swaps)

| Route | Tree | Stage | Inspector |
|---|---|---|---|
| Overview | Status / links / systems | Dense facts table | Source strip |
| Map | Picks / filters (ledger) | Board fills height | Region detail |
| Tasks | Difficulty tiers + search | Task table | Task notes |
| Build | Regions / Relics / Blessings / Share | Lattice or pick grid | Selection summary |
| Combat | Quick / Build / Rotation / Analysis / Reference | Calculator stage | Loadout / key DPS figure |
| Data | Research categories above | Active browser table only | Selected record + key figure |

Map exception (from R1 must-fix): do not force three columns over the board — ledger owns picks; inspector may collapse. Raised colors still apply to ledger + inspector panels.

---

## Ship checklist (if promoted)

1. Re-map `@theme` stone steps **or** add `bench-*` and point `.panel` / table chrome at them — one PR, no half-migrated routes.  
2. Ensure `.data-table` thead sticky uses **stage**, not void.  
3. Bump default borders site-wide one step; re-check focus ring (`gem-400`) still clears.  
4. Run bot-audit + data-readability squint at 1440×900 on Data + Combat.  
5. Do **not** lighten parch ladder as a substitute if surfaces ship raised.  

---

## Files

| Path | Role |
|---|---|
| `src/concepts/r2/RaisedBenchMock.tsx` | Interactive workbench mock (inline palette) |
| `src/concepts/r2/raised-bench.md` | This brief |

Lab wiring to `/concepts` scoreboard is a separate tournament step — not part of this agent deliverable.
