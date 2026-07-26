# Round 2 — D · Parchment Lift

**Thesis:** Keep the warm stone grounds almost untouched; lift the whole parch ink ramp so muted labels and table secondaries clear ≥4.5:1 (and feel scan-able) without blue chrome, pink, or rainbow gradients.

Mock: `src/concepts/r2/ParchmentLiftMock.tsx`  
Proposal ink is **inline style only** in the mock — not production `@theme`.

---

## Proposed `@theme` token list

Stone / gem / gold stay production values unless noted. Parch is the lift.

### Parch (lifted ink)

| Token | Production | **Proposal** | Role |
|---|---|---|---|
| `parch-50` | `#efe7d5` | **`#f2ead8`** | Body / primary reading ink |
| `parch-100` | `#d3c8b0` | **`#e4d8be`** | Secondary body, table values |
| `parch-300` | `#a99f88` | **`#cdbda3`** | Muted row text, inactive nav |
| `parch-400` | `#948a73` | **`#bcae93`** | Labels, meta, sticky headers (pair with clearer weight) |
| `parch-500` | `#8b7f68` | **`#aa9a7e`** | Quiet labels, captions (must still clear 4.5:1) |

### Stone (grounds — keep)

| Token | Hex | Role |
|---|---|---|
| `stone-750` | `#332a1e` | Lines / borders |
| `stone-800` | `#231d15` | Raised / row hairline |
| `stone-850` | `#1b1610` | Panel fill |
| `stone-900` | `#14100b` | Deep rail / inspector |
| `stone-950` | `#0d0a07` | Void / page ground |
| `stone-carve` | `#463a29` | 1px inset carve highlight |

Optional micro-tweak (not required for this concept): `stone-850` → `#19140f` if panel/body separation needs one more step after live A/B. Default: **do not**.

### Gold (display ink only — keep)

| Token | Hex |
|---|---|
| `gold-300` | `#f3c97b` |
| `gold-400` | `#e0b264` |
| `gold-500` | `#a87c3c` |

### Gem (chrome accent — keep)

| Token | Hex |
|---|---|
| `gem-200` | `#8ff0cd` |
| `gem-300` | `#57e0ae` |
| `gem-400` | `#2ecb8f` |
| `gem-500` | `#1fa372` |
| `gem-600` | `#157a55` |

### Path / ember (data only — keep)

| Token | Hex |
|---|---|
| `chaos-300` | `#d4614d` |
| `chaos-400` | `#b5402f` |
| `order-400` | `#4a7ec2` |
| `balance-400` | `#6fae45` |
| `ember-400` | `#e2622a` |

---

## Contrast notes (approx WCAG relative luminance)

Surfaces:

| Surface | Hex | Approx relative L |
|---|---|---|
| `stone-850` | `#1b1610` | ~0.007 |
| `stone-950` | `#0d0a07` | ~0.003 |
| `stone-800` | `#231d15` | ~0.013 (hairline / raised — worst case for muted ink) |

### Production parch on stone (why tables feel muddy)

Warm-on-warm under-reads the numeric ratio. Math is already marginal for quiet steps on lighter stone:

| Ink | Hex | on `stone-850` | on `stone-950` | on `stone-800` |
|---|---|---|---|---|
| `parch-50` | `#efe7d5` | ~11–12:1 | ~12–13:1 | ~10:1 |
| `parch-100` | `#d3c8b0` | ~8–9:1 | ~9–10:1 | ~7–8:1 |
| `parch-300` | `#a99f88` | ~7:1 | ~7.5:1 | ~6:1 |
| `parch-400` | `#948a73` | ~5.5–6:1 | ~6:1 | ~5:1 |
| `parch-500` | `#8b7f68` | ~4.8:1 | ~5.1:1 | **~4.3:1 fail** |

`parch-500` on `stone-800` fails 4.5:1. `parch-400` / `500` as table meta and header ink also fails the **scan** test: hue proximity to umber panels flattens rows.

### Proposal parch on stone (target)

| Ink | Hex | on `stone-850` | on `stone-950` | on `stone-800` |
|---|---|---|---|---|
| `parch-50` | `#f2ead8` | ~12–13:1 | ~13–14:1 | ~11:1 |
| `parch-100` | `#e4d8be` | ~10–11:1 | ~11–12:1 | ~9–10:1 |
| `parch-300` | `#cdbda3` | **~10:1** | **~10.5:1** | **~9:1** |
| `parch-400` | `#bcae93` | **~8.5:1** | **~9:1** | **~7.5:1** |
| `parch-500` | `#aa9a7e` | **~6.7:1** | **~7.2:1** | **~6:1** |

All proposal steps clear **≥4.5:1** on panel, void, and raised stone. Body (`50`/`100`) stays well above; labels (`400`/`500`) leave headroom for 11px UI chrome.

**data-readability floors in the mock:** table body **14px**; header labels **12px** on lifted `parch-100`; quiet captions **11px** on `parch-500`; key figure **28px** gem mono (≥20px).

---

## ASCII wireframes

### `/data` (Control Surface — ink lift only)

```
┌─ EQUILIBRIUM   Overview  Map  Tasks  Build  Combat  [Data] ─────────────┐
│ Browse · Progression · Unlocks · Consumables · Systems · Crafting · …   │  gem-active tab
├──────────────────────────────┬──────────────────────────────────────────┤
│ Name          Region   Tier  │  INSPECTOR (gold display label)          │
│ Fixture α     Misthalin  I   │  Fixture ability α                       │
│ Fixture β     Karamja    II  │  Misthalin · fixture                     │
│ Fixture γ …                  │                                          │
│  body 14px parch-50/300      │  COST (fixture)                          │
│  header parch-100, not 400   │  24          ← gem-400 · ≥20px mono      │
│  selected row stone-850      │  Tier / Status / Sources  labels 400     │
└──────────────────────────────┴──────────────────────────────────────────┘
  stone-950 void · stone-900 inspector · no new layout chrome
```

### `/build` (same ink; existing lattices)

```
┌─ EQUILIBRIUM   Overview  Map  Tasks  [Build]  Combat  Data ─────────────┐
│ Regions · Relics · Blessings · Share                                    │
├────────────┬────────────────────────────────────────────────────────────┤
│ 0/3 picks  │  hex lattice / blessing columns (unchanged structure)      │
│ Clear…     │  cell labels: parch-100 body, parch-400 meta               │
│            │  selected: gem border/inset only                           │
│ rail text  │  locked timber/crystal materials untouched                 │
│ parch-300  │  PageHeading gold; never gold for active tabs              │
└────────────┴────────────────────────────────────────────────────────────┘
```

No IA change. No new panel recipe. Only ink steps and table header weight.

---

## What this concept refuses to change

- **Stone grounds** as the identity register (no cool slate, no blue-black void)
- **Gem green chrome** for active nav, focus, selected cells — never gold, never order-blue
- **Gold for display titles only** (`EQUILIBRIUM`, page `h1` / inspector display label)
- **Path triad** stays data semantics (Order/Chaos/Balance) — not buttons or borders
- **No blue chrome**, pink, glassmorphism-as-default, rainbow gradients, hero billboards
- **No gen-AI art**; no inventing league numbers as real (fixture rows only)
- **No production `globals.css` edit in this round** — proposal only until a winner ships
- **Layout DNA** from Control Surface / War Table (tabs + stage + inspector) — ink, not topology
- **3D map fence**, frozen e2e strings, component inventory (`Page`, `panel`, `data-table`, …)
- **Radius, fonts, motion rules** — Cinzel display, 90–180ms state motion, gem focus ring

---

## Ship path if this wins

1. Replace only the five `--color-parch-*` lines in `app/globals.css` `@theme`.
2. Spot-check table headers: prefer `text-parch-100` over `text-parch-400` for sticky thead.
3. Avoid `text-parch-500` on `stone-800` for anything smaller than 12px without re-measuring.
4. Leave gem/gold/stone/path alone unless a second pass darkens `stone-850` after live A/B.
5. `npm run build` + visual pass on `/data`, `/build`, `/combat` tables.
