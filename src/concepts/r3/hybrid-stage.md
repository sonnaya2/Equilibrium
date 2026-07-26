# Hybrid A — Raised Stage + Wiki Table · Round 3 · Agent G

**Thesis:** Keep Raised Bench’s full Control Surface shell, but lift **only the
table stage** — not the whole room into mid-brown desk. Apply Wiki Dense table
law on that stage (15px `parch-50` body, 12px bright headers, zebra, sticky
opaque head). Rail stays darker than stage so void `#0d0a07` still reads as a
league tool. Pay crest / `GameIcon` debt in tree + rows.

**Fixture only.** `HybridStageMock.tsx` + this note. **No production
`globals.css` edit this PR.**

**Pass bar:** 9.0. R2 max was Raised Bench 8.4 — hybrid must clear shell + scan
+ identity without SaaS-bench overshoot.

---

## DNA sources

| Source | Take |
|---|---|
| R1 Control Surface | tree · table · inspector; mount-active leaf; route tabs |
| R2 Raised Bench (8.4) | surface contrast diagnosis; stage under data; full IA shell |
| R2 Wiki Dense (7.9) | 15px body, 12px headers, zebra, sticky opaque thead, gem selection |
| R2 Parchment Lift (6.9) | quiet-end parch bumps **after** surface + type — not alone |
| CEO R2 verdict | hybrid brief; void stays; tokens only; crests; prove ≥9 arm’s-length |

### What R2 got wrong that this fixes

1. **Raised Bench** overshot stage/rail (`#32291e` / `#2a2218` / `#3a3024`) → brown desk, soft identity.
2. **Wiki Dense** won scan but underbaked tree + zero crests.
3. **Parchment Lift** ink-only on production grounds — weak arm’s-length delta.

Hybrid: **stage-only lift** (rail dark) + **Wiki type/zebra law** + **crests**.

---

## Surface hierarchy (binding)

```
┌─ void #0d0a07 ──────────────────────────────────────────────────────────┐
│  ┌─ shell/rail #14100b (stone-900) ── nav · tabs · tree · inspector ──┐ │
│  │                                                                     │ │
│  │  ┌ rail ─────────┐  ┌ STAGE #201a12 ────────────────┐  ┌ rail ───┐ │ │
│  │  │ tree          │  │ header + FILTER               │  │ inspect │ │ │
│  │  │ active → stage│  │ ┌ sticky thead (opaque stage)┐│  │ gold    │ │ │
│  │  │ fill + gem    │  │ │ even: stage                ││  │ Record  │ │ │
│  │  │ rail darker   │  │ │ odd:  zebra #16120c        ││  │ crest   │ │ │
│  │  │ than stage    │  │ │ sel:  raised #2a231a+gem   ││  │ key 22  │ │ │
│  │  └───────────────┘  │ └────────────────────────────┘│  └─────────┘ │ │
│  │                     └───────────────────────────────┘              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Depth rules

1. **Void never holds table text** — stage is mandatory under dense data.
2. **Rail < stage luminance** — tree/inspector stay `stone-900`; only stage lifts.
3. **One raise per selection** — selected row uses `raised` + gem outline, not a fill slab of gem.
4. **Inset digs in** — filter fields darker than stage (`#100c08`).
5. **Borders** slightly stronger than prod on stage so seams do not dissolve — still warm umber, not chalk.

### Dial vs R2 Raised Bench

| Role | R2 Raised Bench | Hybrid A (this) | Why |
|---|---|---|---|
| void | `#0d0a07` | `#0d0a07` | keep league dark |
| rail | `#2a2218` | **`#14100b`** | pull back — rail is not mid-desk |
| stage | `#32291e` | **`#201a12`** | modest lift only |
| raised / selected | `#3a3024` | **`#2a231a`** | one step above stage, not SaaS |
| border | `#5a4a36` | **`#3a3024`** | +1 from prod `#332a1e`, not +2 |

---

## Full proposed `@theme` deltas

Only change what the hybrid needs. Gem / gold / path triad **unchanged**.
Values are proposal — mock uses inline hex; production waits for CEO ship.

### Stone / stage (grounds)

| Token | Production | **Proposal** | Role |
|---|---|---|---|
| `--color-stone-950` | `#0d0a07` | **unchanged** | page void |
| `--color-stone-900` | `#14100b` | **unchanged** | rail, shell, deep columns |
| `--color-stone-850` | `#1b1610` | **unchanged** | generic `.panel` fill (non-table) |
| `--color-stone-800` | `#231d15` | **unchanged** | legacy raised / hairline uses |
| **`--color-stone-825`** (new) | — | **`#201a12`** | **table stage ground** (optional stone step) |
| **`--color-stone-870`** (new, optional) | — | **`#16120c`** | **zebra odd** on stage (between 900 and 850) |
| `--color-stone-750` | `#332a1e` | **`#3a3024`** | default border — seams readable on stage |
| `--color-stone-carve` | `#463a29` | **`#5a4a36`** | inset top edge on raised wells |

**Ship preference:** add **one** optional step `--color-stone-825` (stage). Map zebra odd to existing `stone-900` if you want zero second new stop — mock uses `#16120c` for a softer band than pure 900 on stage; either is valid if contrast holds.

Selected row fill: use a utility mapping to **`#2a231a`** — either:

- reassign nothing and use `bg-stone-800` with a **documented** temporary mismatch until `stone-825` exists and selected is `color-mix` / a named `--color-stage-raised`, **or**
- add **`--color-stage-raised: #2a231a`** only if one new token is preferred over reusing 800.

**Recommended minimal set:**

```css
/* app/globals.css @theme — proposal only, not applied this PR */
--color-stone-950: #0d0a07; /* keep */
--color-stone-900: #14100b; /* keep — rail */
--color-stone-870: #16120c; /* NEW optional — zebra odd */
--color-stone-850: #1b1610; /* keep — panel */
--color-stone-825: #201a12; /* NEW — table stage */
--color-stone-800: #231d15; /* keep */
--color-stage-raised: #2a231a; /* NEW optional — selected row / key well */
--color-stone-750: #3a3024; /* lift from #332a1e */
--color-stone-carve: #5a4a36; /* lift from #463a29 */
```

If CEO wants **one** new token only: ship `--color-stone-825` for stage; zebra = `stone-900`; selected = `stone-800`; borders stay production until metered.

### Parch ramp (concrete production proposal)

Body already works on stage at 15px. Lift **quiet end** so labels/meta clear scan on warm stone; micro-lift primary so secondary steps do not crowd.

| Token | Production | **Proposal** | Role after hybrid |
|---|---|---|---|
| `--color-parch-50` | `#efe7d5` | **`#f0e9d7`** | primary table body (micro; not chalk) |
| `--color-parch-100` | `#d3c8b0` | **`#d9cfb8`** | secondary body, **12px bright headers**, region secondary |
| `--color-parch-300` | `#a99f88` | **`#b5a990`** | meta / counts / tree caption — not table body |
| `--color-parch-400` | `#948a73` | **`#a3967e`** | captions, lab chrome only |
| `--color-parch-500` | `#8b7f68` | **`#9a8e76`** | quietest chrome; must stay ≥4.5:1 on stage/rail |

**Do not** bleach `parch-50` toward white. R2 Parchment Lift’s larger jumps (`#f2ead8` / `#e4d8be`) are optional A/B if quiet-end still muddies after stage ships — start with the micro ramp above.

### Unchanged (explicit)

| Family | Tokens |
|---|---|
| Gold | `gold-300/400/500` — display / engraved titles only |
| Gem | `gem-200…600` — active chrome + key figure |
| Path / ember | chaos / order / balance / ember — **data semantics only** |
| Fonts / radius | Cinzel display, mono, `radius-sm/md` |

---

## Table / type law (Wiki Dense, binding)

| Rule | Spec |
|---|---|
| Body | **15px** / `0.9375rem`, `parch-50` (proposal hex) |
| Headers | **12px**, medium, **`parch-100`** — not `parch-300` murk, not 11px caps |
| Zebra | even = stage (`825`), odd = `870` or `900`; always hairline `stone-750` |
| Sticky thead | **opaque** stage fill — transparent sticky is a defect |
| Selected | `stage-raised` + 1px gem outline inset; gem never paints every row |
| Numeric | `font-mono` + `tabular-nums` |
| Density | row pad ~6px (`py-1.5`); no 40px voids in stage |
| Key figure | ≥**20px** mono (mock **22**), `gem-400` |
| Labels | ≥12px preferred on live chrome |

---

## Game art debt (paid in mock)

- Region crests from `/game/regions/` via `GameIcon` + `regionCrestPath`.
- Mock shows **Misthalin** and **Asgarnia** crests in tree leaves and dense rows (plus other mapped regions).
- `alt=""` inside buttons so accessible names stay text (e2e law).
- Production follow-up: same pattern on Data / Tasks / Build region lists — not gray text alone.

---

## Tailwind mapping (when shipping)

```text
bg-stone-950          → void / page
bg-stone-900          → rail, shell, inspector, optional zebra
bg-stone-825          → stage (needs @theme token)
bg-stone-870          → zebra odd (optional)
bg-[stage-raised]     → selected / key well
border-stone-750      → seams (reassigned hex)
text-parch-50         → table body
text-parch-100        → headers, secondary cells, inactive chrome hover target
text-parch-300        → meta only
text-gem-300/400      → active tab, active leaf, key figure
text-gold-400         → Record / engraved display only
```

Utility sketch (production later):

```css
.data-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-stone-825);
  font-size: 0.75rem;
  color: var(--color-parch-100);
}
.data-table tbody tr:nth-child(even) { background: var(--color-stone-825); }
.data-table tbody tr:nth-child(odd)  { background: var(--color-stone-870); }
.data-table td {
  font-size: 0.9375rem; /* 15px */
  color: var(--color-parch-50);
}
```

---

## Contrast notes (conceptual — meter before ship)

| Pair | Intent |
|---|---|
| `parch-50` on stage `#201a12` | primary body — clearer than same ink on void-only tables |
| `parch-100` on stage | headers + secondary — ≥4.5:1 target |
| `parch-300` on rail `#14100b` | meta OK; never sole table data |
| `parch-50` on raised `#2a231a` | selected row still readable |
| gem on rail/stage | active punch unchanged |
| border `#3a3024` on stage | seam without chalk outline |

Hard floors: data ≥14–15px, labels ≥12px preferred, key ≥20px, contrast ≥4.5:1 on **actual stage**, still looks RS3 (not slate SaaS).

---

## bot-audit / hard-fail checklist

| Fail if | Status in mock |
|---|---|
| Marketing hero | none |
| EverSense pink / Print | none |
| Order-blue chrome | none |
| Gold on active tabs/rows | gold = Record only |
| Invented league numbers as real | fixtures labeled |
| Transparent sticky head | opaque stage |
| `parch-500` as body | body = parch-50 |
| 11–12px table data | 15px body |
| Stage = mid-brown desk (R2 overshoot) | stage dialed to `#201a12` |
| Zero crests | crests in tree + rows |
| Inline hex permanent in product | lab mock only; ship via `@theme` |

---

## Ship path (if CEO promotes)

1. Add `@theme` deltas: at minimum `--color-stone-825`; optional `870` + `stage-raised`; parch micro ramp; border/carve +1.
2. Point `.data-table` stage container at `stone-825`; sticky thead opaque; zebra; 15px td; 12px `parch-100` th.
3. Keep rail / page on `stone-900` / `950` — **do not** reassign rail to R2 `#2a2218`.
4. Inject `GameIcon` crests on region-bearing rows and tree leaves.
5. Re-run visual squint at 1440×900; meter contrast; `bot-audit` before claiming 9.0.
6. No half-migration — one PR for token + table utility, or tokens first then utilities.

---

## Paths

| File | Role |
|---|---|
| `src/concepts/r3/HybridStageMock.tsx` | Interactive hybrid fixture |
| `src/concepts/r3/hybrid-stage.md` | This brief + `@theme` deltas |
| `src/concepts/r2/raised-bench.md` | Shell / surface DNA (overshot values) |
| `src/concepts/r2/wiki-dense.md` | Table / type law |
| `src/concepts/r2/ceo-verdict.md` | Binding R3 must-fix |
| `app/globals.css` | Canonical tokens — **not edited this round** |
