# Round 3 — H · Hybrid B: Ink First + Control Surface

**Thesis:** Keep production-dark stone (void / rail / panel). Brighten the **parch ink ramp** so Wiki Dense type law actually scans at arm’s length. Full Control Surface three-column shell; region crests in tree + table. Ink first, surface second — no Raised Bench mid-brown desk.

Mock: `src/concepts/r3/HybridInkMock.tsx`  
Proposal ink is **inline style only** — not production `@theme`. **No `app/globals.css` edit this round.**

Parent DNA:

| Source | Keep |
|---|---|
| R1 Control Surface | Tree · table · inspector; route TREE; mount-active leaf |
| R2 Wiki Dense | 15px data, 12px labels, zebra 900/950, sticky opaque head, gem selection |
| R2 Parchment Lift | Quiet/mid parch lifts + secondary cell brightness |
| R2 Raised Bench | Rejected for stage: do **not** lift mid-stone fills |

---

## Proposed `@theme` parch hexes

Stone / gem / gold / path **unchanged**. Only five parch lines ship if this wins.

### Parch (proposal — exact)

| Token | Production | **Proposal** | Role on Hybrid B |
|---|---|---|---|
| `parch-50` | `#efe7d5` | **`#f3ebd9`** | Body / primary table cells, titles |
| `parch-100` | `#d3c8b0` | **`#e8dcc2`** | Secondary body, region/note cells, sticky headers, tree idle |
| `parch-300` | `#a99f88` | **`#d0c0a6`** | Inactive top nav, counts meta — never sole table body |
| `parch-400` | `#948a73` | **`#beaf94`** | Field labels / dt at **12px** (≥4.5:1 on panel) |
| `parch-500` | `#8b7f68` | **`#ad9c7f`** | Quiet captions only; still ≥4.5:1 on `stone-850` and `stone-800` |

### Why these stops (not chalk, not production mud)

1. **Body (`50`)** moves more than R2 Parchment Lift’s `#f2ead8` so primary text gains arm’s-length delta, but stays warm parchment — not near-white wash.
2. **Secondary (`100`)** is the real scan win. CEO R2: region/tier as “muted row” was half the mud. Table secondaries use **`parch-100` body-secondary**, not `300`/`400`.
3. **Quiet end (`400`/`500`)** clears the known `parch-500` on `stone-800` fail without desaturating into gray beige.
4. **Hue stays parchment** (warm gold-umber). Lift is luminance + slight chroma, not cool slate or cyan edge light.
5. **Surfaces do not compensate** — void `#0d0a07`, rail `#14100b`, panel `#1b1610` stay production. Contrast is ink + type size + zebra, not a lighter desk.

### Stone (grounds — keep production)

| Token | Hex | Role |
|---|---|---|
| `stone-750` | `#332a1e` | Hairlines / borders |
| `stone-800` | `#231d15` | Row edge (worst-case quiet ink surface) |
| `stone-850` | `#1b1610` | Panel / selected row |
| `stone-900` | `#14100b` | Tree + inspector + zebra odd |
| `stone-950` | `#0d0a07` | Void / even rows / sticky head fill |
| `stone-carve` | `#463a29` | 1px panel inset only |

**No** Raised Bench `#32291e` / `#3a3024` stage. Cap surface lift at zero for this hybrid.

### Gem / gold (roles — keep)

| Token | Hex | Role |
|---|---|---|
| `gem-300` / `500` | `#57e0ae` / `#1fa372` | Active tab + tree leaf + selected row outline |
| `gem-400` | `#2ecb8f` | Key figure only |
| `gold-400` | `#e0b264` | `EQUILIBRIUM` + inspector `Record` display only |

Path triad stays data semantics — never chrome.

---

## Contrast notes (approx WCAG on proposal ink)

Surfaces (production):

| Surface | Hex | Approx relative L |
|---|---|---|
| `stone-850` | `#1b1610` | ~0.008 |
| `stone-950` | `#0d0a07` | ~0.003 |
| `stone-800` | `#231d15` | ~0.013 |

### Production parch (why tables feel muddy)

| Ink | Hex | on `850` | on `950` | on `800` |
|---|---|---|---|---|
| `parch-50` | `#efe7d5` | ~11–12:1 | ~12–13:1 | ~10:1 |
| `parch-100` | `#d3c8b0` | ~8–9:1 | ~9–10:1 | ~7–8:1 |
| `parch-300` | `#a99f88` | ~7:1 | ~7.5:1 | ~6:1 |
| `parch-400` | `#948a73` | ~5.5–6:1 | ~6:1 | ~5:1 |
| `parch-500` | `#8b7f68` | ~4.8:1 | ~5.1:1 | **~4.3:1 fail** |

Warm-on-warm under-reads the ratio; headers at 11px `400` fail the **scan** test even when math is marginal.

### Proposal parch (target)

| Ink | Hex | on `850` | on `950` | on `800` |
|---|---|---|---|---|
| `parch-50` | `#f3ebd9` | **~12.5–13.5:1** | **~13.5–14.5:1** | **~11–12:1** |
| `parch-100` | `#e8dcc2` | **~11–12:1** | **~12–13:1** | **~10–11:1** |
| `parch-300` | `#d0c0a6` | **~10–11:1** | **~11:1** | **~9–10:1** |
| `parch-400` | `#beaf94` | **~8.5–9:1** | **~9–10:1** | **~7.5–8:1** |
| `parch-500` | `#ad9c7f` | **~7–7.5:1** | **~7.5–8:1** | **~6–6.5:1** |

All steps **≥4.5:1** on panel, void, and raised stone. Headroom at 12px labels.

### Anti-wash checklist

| Check | Hybrid B |
|---|---|
| Void stays `#0d0a07` | Yes |
| Panel stays `#1b1610` | Yes |
| No cool slate / blue-black | Yes |
| Body not `#faf6ee`-class chalk | `#f3ebd9` still parchment |
| Secondary not pure cream wash | `#e8dcc2` retains umber chroma |
| Gem still punches (130° from ground) | Unchanged gem ramp |
| Gold reserved for display | Yes |

If live A/B still feels flat, **prefer one more stop on `parch-100`** before touching stone. Do not bleach `50` toward white.

---

## Wiki Dense type law (binding in mock)

| Step | px | Role |
|---:|---|---|
| Meta floor | 11 | Counts, densest chrome |
| **Label** | **12** | Column headers, tabs, dt/dd, filter label |
| Tree leaf | 13 | Category + region tree rows |
| **Data** | **15** | All table cells |
| Title | 15 | Stage h2 / record name |
| **Key figure** | **22** | Inspector mono (≥20 floor) |

Table rules:

1. Sticky `thead` with **opaque** `stone-950` fill.
2. Zebra odd `stone-900` / even `stone-950` + `stone-750` hairlines.
3. Selected row: `stone-850` + 1px gem outline (inset).
4. Body cells `parch-50`; secondary cells **`parch-100`** (not muted).
5. Headers 12px medium `parch-100` — not 11px uppercase murk.
6. Numeric columns mono + tabular-nums.
7. Row pad ~6px (`py-1.5`).

---

## Shell / IA

Full Control Surface under top route tabs:

```
┌─ EQUILIBRIUM   Overview  Map  Tasks  Build  Combat  [Data] ─────────────┐
│ [Overview] [Map] [Tasks] [Build] [Combat] [Data]     ← gem active tab   │
├────────────┬──────────────────────────────┬─────────────────────────────┤
│ Data tree  │ Browse / Regions · Misthalin │ RECORD (gold display)       │
│  leaf gem  │ Name        Region     Note  │ Sample unlock A             │
│            │ [crest]15px  [crest]15px     │ [crest] Misthalin           │
│ Regions    │ zebra 900/950 · sticky head  │ KEY 20   SOURCES 1          │
│ [crest]…   │ selected: stone-850 + gem    │ Status / Leaf / Provenance  │
│ 220px      │ filter · mount-active leaf   │ @theme parch proposal list  │
└────────────┴──────────────────────────────┴─────────────────────────────┘
  stone-950 void · stone-900 tree/inspector · no mid-brown stage
```

Route tree (same as R1 Control Surface):

| Route | Tree leaves |
|---|---|
| Overview | Status, Planner links, Systems table |
| Map | Picks, Filters, Board — region crests under Picks |
| Tasks | Easy → Master, Search |
| Build | Regions, Relics, Blessings, Share — crests under Regions |
| Combat | Quick, Build, Rotation, Analysis, Reference |
| Data | Browse / Regions|Skills, Progression, Unlocks, Consumables, Systems, Crafting / Arch|Masterwork, Boundaries — crests under Browse / Regions |

Crests: `public/game/regions/{slug}.png` via `<img alt="">` beside labelled text so accessible names stay clean.

---

## What this concept refuses

- Mid-brown Raised Bench stage (`#32291e` / `#3a3024`)
- Production `globals.css` edit this round
- Blue chrome, pink/Print, gold active nav, path triad as buttons
- Marketing hero, glassmorphism default, glow at rest
- Invented league numbers as real (fixtures labeled)
- Dead tree / decorative-only leaves (tabs wire TREE; region picker works)
- Swatch strip stealing workbench height (compact ramp lives in inspector)
- Glyph-only tree without crests on region surfaces

---

## bot-audit traps

| Fail | Avoidance |
|---|---|
| Gold on active tabs/rows | Gem only |
| Order-blue chrome | Path reserved |
| `slate-*` void | Warm stone only |
| `parch-500` as table body | Body = 50/100 |
| 11–13px data “density” | 15px data law |
| Transparent sticky head | Opaque 950 |
| Crest `alt` breaks a11y name | `alt=""` + visible text |
| EverSense pink | Wrong product |

---

## Ship path if this wins

1. Replace only the five `--color-parch-*` lines in `app/globals.css` `@theme` with the proposal table above.
2. Promote Wiki Dense into `.data-table`: 15px td, 12px th `text-parch-100`, zebra or hairline, sticky opaque head, gem selection outline.
3. Inject region crests in Data/Build/Map tree rows and region cells (`/game/regions/*.png`, `alt=""`).
4. Do **not** ship Raised Bench stage hexes; re-meter only if post-ship A/B still fails after ink + type.
5. Spot-check: avoid `text-parch-500` on `stone-800` below 12px; prefer `parch-100` for secondary cells.
6. `npm run build` + visual pass `/data`, `/build`, `/combat` tables + concepts lab.

---

## Paths

| File | Role |
|---|---|
| `src/concepts/r3/HybridInkMock.tsx` | Client fixture mock |
| `src/concepts/r3/hybrid-ink.md` | Tokens, contrast, type law, IA, ship path |
| `src/concepts/ControlSurfaceMock.tsx` | R1 shell DNA (reference) |
| `src/concepts/r2/parchment-lift.md` | R2 ink parent |
| `src/concepts/r2/wiki-dense.md` | R2 table/type parent |
| `app/globals.css` | Canonical tokens — **not edited this round** |
