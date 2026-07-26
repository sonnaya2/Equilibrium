# Hybrid C · Full Readable System — Round 3 · Agent I

**Thesis:** Ship one system, not three repaints. Control Surface shell (tree ·
table · inspector) + **slight** panel lift under the table + a quiet parch ink
bump + Wiki Dense table law + region crests. Contrast is surface **and** ink
**and** type size together. Keep the room dark — warm umber only.

**Mock:** `src/concepts/r3/HybridFullMock.tsx` (interactive Data ⇄ Build).  
**No production `globals.css` edit in this deliverable** — values below are the
shipping proposal when CEO promotes.

---

## What this hybrid takes

| Source | Keep | Drop / dial |
|---|---|---|
| R1 Control Surface | 3-col shell, mount-active tree, filter, key ≥20px | Crest-starved gray tree |
| R2 Raised Bench | Surface-first diagnosis, stage under table, stronger borders | Aggressive mid-brown desk (`#32291e` / `#3a3024`) |
| R2 Wiki Dense | 15px body, 12px bright headers, zebra, sticky opaque head, gem select | Dead tree; type-scale legend as product chrome |
| R2 Parchment Lift | Quiet parch ramp lift for scan ink | Swatch-strip stage; 2-col incomplete shell |

---

## Proposed `@theme` tokens (ship map)

Map into `app/globals.css` `@theme`. Prefer **reassigning stone steps** so
existing `stone-*` / `.panel` classes keep working; optional `bench-*` aliases
noted for clarity.

### Stone / surface ladder (slight lift)

Void stays. Rails and stage rise **one careful step** — still league-dark, not
SaaS desk.

| Role | Token | Production | **Proposal** | Notes |
|---|---|---|---|---|
| Page void | `stone-950` | `#0d0a07` | **`#0d0a07`** | Unchanged — keep the room dark |
| Shell / nav / tab strip | `stone-900` | `#14100b` | **`#12100c`** | Micro lift (or keep production if shell reads fine) |
| Tree + inspector rail | *(bench-rail)* → map to `stone-850` or new | `#1b1610` | **`#1c1711`** | Side columns; still deep umber |
| Table stage | *(bench-stage)* | often void | **`#231c14`** | Mandatory ground under dense data |
| Raised / selected / `.panel` | `stone-800` / panel fill | `#231d15` / `#1b1610` | **`#2c241a`** | One raise for selection + carved panels |
| Zebra odd row | — | — | **`#1a1510`** | Between stage and rail; not a second accent |
| Inset fields | — | stone-900-ish | **`#18140f`** | Inputs dig in; darker than stage |
| Border default | `stone-750` | `#332a1e` | **`#463a29`** | = current carve — seams must read |
| Border strong | *(bench-border-hi)* | — | **`#5a4a36`** | Inputs, focus wells |
| Carve highlight | `stone-carve` | `#463a29` | **`#6b5840`** | Inset top edge on raised panels |

**Ship option A (preferred):** reassign hexes on existing `stone-800/850/750/carve`
and document stage/zebra as utilities (`.data-stage`, `.data-table tbody tr:nth-child(odd)`).

**Ship option B:** introduce `--color-bench-rail|stage|raised|inset|border-hi` and
point `.panel` / `.data-table` at them in one PR — no half-migrated routes.

**Hard cap:** stage must not climb to Raised Bench `#32291e` / raised `#3a3024`
without a meter pass that still reads “RS3 league panel.” Hybrid stops at
`#231c14` / `#2c241a`.

### Parch (quiet lift — scan end of the ramp)

| Token | Production | **Proposal** | Role |
|---|---|---|---|
| `parch-50` | `#efe7d5` | **`#f2ead8`** | Primary body / table names / titles |
| `parch-100` | `#d3c8b0` | **`#e4d8be`** | Secondary cells (region), bright labels, headers |
| `parch-300` | `#a99f88` | **`#cdbda3`** | Meta, dt labels, counts — never sole table body |
| `parch-400` | `#948a73` | **`#bcae93`** | Captions, lab chrome |
| `parch-500` | `#8b7f68` | **`#aa9a7e`** | Quiet only; must clear 4.5:1 on actual stage |

Do **not** bleach toward white. Do **not** use `parch-400/500` as table body.

### Unchanged chrome / display / data

| Family | Tokens | Rule |
|---|---|---|
| Gem | `gem-200`…`600` production | Active chrome only (tabs, tree leaf, row outline, key figure) |
| Gold | `gold-300`…`500` production | Engraved display / `Record` headings — **never** selected state |
| Path triad | chaos / order / balance | Blessing data semantics only — not buttons |
| Ember | `ember-400` | Data only |

No `slate-*`, no cool gray void, no order-blue chrome, no EverSense pink/Print.

---

## Surface hierarchy (head-still)

```
┌─ void #0d0a07 ──────────────────────────────────────────────────────────┐
│  ┌─ shell #12100c ── nav + gem tabs + preview chrome ─────────────────┐ │
│  │  ┌ rail #1c1711 ─┐  ┌ stage #231c14 ──────────────┐  ┌ rail ─────┐ │ │
│  │  │ tree + crests │  │ h2 + filter                 │  │ inspector │ │ │
│  │  │ gem leaf bar  │  │ sticky thead (opaque stage) │  │ gold title│ │ │
│  │  │               │  │ zebra + hairline rows       │  │ crest     │ │ │
│  │  │               │  │ selected → raised + gem     │  │ key 22px  │ │ │
│  │  └───────────────┘  └─────────────────────────────┘  └───────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

Depth method (unchanged law): hairline border + inset top carve. Only stop
values move so edges separate panels instead of dissolving.

### Depth rules

1. **Void never holds table text** — stage under every dense catalog.
2. **One raise per selection** — selected row uses `raised` + gem outline; no glow at rest.
3. **Inset darker than stage** — inputs dig in (`#18140f`).
4. **Gem is line + type**, not a filled slab on every row.
5. **Build segment strip** shares gem-active tab chrome; stage swaps content; inactive segments unmount.

---

## Type scale (binding)

| Step | px | Role |
|---:|---|---|
| Meta floor | 11 | Counts, mono meta only |
| **Label / header** | **12** | Column heads, field labels, tabs, inspector dt |
| Tree leaf | 13 | Category rows |
| **Data body** | **15** | Table cells (Wiki dense working size) |
| Title | 15–16 | Stage h2 / record name |
| **Key figure** | **20–22** | Inspector mono + tabular-nums (floor 20) |
| Display | Cinzel | Gold engraved headings only |

Floors from `equilibrium-ui` / `data-readability`: data ≥14 (we ship 15), labels
≥11 (we ship 12), key ≥20, body contrast ≥4.5:1 on **actual stage color**.

---

## Table CSS rules (ship into `.data-table` / globals)

Promote Wiki Dense law — this is the readability contract regardless of which
surface ladder wins the last millimeter of lift.

```css
/* Proposal only — do not paste until CEO promotes tokens */
.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 15px; /* 0.9375rem */
  color: var(--color-parch-50);
}

.data-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-bench-stage, #231c14); /* opaque — no bleed */
}

.data-table th {
  padding: 0.5rem 0.75rem;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-parch-100);
  border-bottom: 1px solid var(--color-stone-750);
}

.data-table td {
  padding: 0.375rem 0.75rem; /* ~py-1.5 */
  font-size: 15px;
  line-height: 1.35;
  border-bottom: 1px solid var(--color-stone-750);
  color: var(--color-parch-50);
}

.data-table td.secondary {
  color: var(--color-parch-100); /* region / note — not parch-300 murk */
}

.data-table tbody tr:nth-child(odd) {
  background: var(--color-bench-zebra, #1a1510);
}

.data-table tbody tr:nth-child(even) {
  background: var(--color-bench-stage, #231c14);
}

.data-table tbody tr[aria-selected="true"],
.data-table tbody tr.is-selected {
  background: var(--color-bench-raised, #2c241a);
  outline: 1px solid var(--color-gem-500);
  outline-offset: -1px;
}

.data-table td.num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

### Table law checklist

1. Sticky head with **opaque** stage fill (transparent sticky = defect).
2. Zebra **or** mandatory 1px hairline every row — never whitespace alone.
3. Selected = raised fill + 1px gem outline (inset). Gem only on selection.
4. Body 15px `parch-50`; secondary cells `parch-100` (not muted 300/400).
5. Headers 12px medium `parch-100` — not 11px uppercase `parch-400`.
6. Numeric columns mono + tabular-nums.
7. Row pad ~6px vertical; no 40px voids inside the stage.
8. Table + inspector stay one head-still plane (Control Surface DNA).
9. Crests / `GameIcon` in name cells and tree leaves where region-bound.

---

## IA (shell constant; stage content swaps)

### Data

```
Data
├── Browse › Regions | Skills     ← tree depth; crests on region leaves
├── Progression
├── Unlocks
├── Consumables
├── Systems
├── Crafting › Arch | Masterwork
└── Boundaries
```

Top strip may show primary groups (Browse / Progression / …) as gem-active tabs;
**tree owns leaf depth**. Only the active leaf mounts tables.

### Build

```
Build segments (gem strip): Regions | Relics | Blessings | Share
├── left: segment list / region tree with crests
├── stage: lattice / pick grid fills height
└── inspector: selection + picks key figure ≥20px
```

Map exception (R1): do not force three columns over the 3D board — ledger owns
picks; inspector may collapse. Hybrid colors still apply to ledger + inspector.

### Route skins

| Route | Tree / rail | Stage | Inspector |
|---|---|---|---|
| Overview | Status / systems | Dense facts | Sources |
| Map | Picks / filters | Board fills height | Region detail |
| Tasks | Difficulty + search | Task table (wiki law) | Task notes |
| Build | Segment strip + list | Lattice / picks | Selection + picks N/3 |
| Combat | Mode tabs | Calculator | Key DPS figure ≥20px |
| Data | Research categories | Active browser only | Record + key figure |

---

## Contrast notes (target, approximate)

Verify with a meter on the **proposal stage** before ship — warm-on-warm under-reads ratios.

| Pair | Intent |
|---|---|
| `parch-50` `#f2ead8` on stage `#231c14` | Primary body — arm’s-length scan |
| `parch-100` `#e4d8be` on stage | Secondary body + headers |
| `parch-300` `#cdbda3` on raised `#2c241a` | Meta / dt labels ≥4.5:1 |
| `parch-500` on stage | Quiet only; fail if used as body |
| `gem-400` on rail/stage | Active + key figure punch |
| `gold-400` on rail | Engraved title only |
| Border `#463a29` on rail/stage | Visible seams without chalk outlines |

### Before → hybrid (why tables stop muddying)

| Problem | Fix |
|---|---|
| Brown-on-brown (ink only lift) | Slight stage under table + bright headers |
| Mid-brown SaaS desk (R2 E overshoot) | Cap stage at `#231c14`, raised `#2c241a` |
| Rows bleed | Zebra + hairline + sticky opaque head |
| Secondary cells murk | Region/note → `parch-100`, not `parch-300` |
| Identity soft | Crests in tree, rows, inspector, Build lattice |
| Incomplete shell | Full 3-col + Data tree + Build segment demo |

---

## bot-audit / hard fails

| Failure | Why |
|---|---|
| Gold on active tabs / rows | Gold = display only; interactive = gem |
| Order-blue / chaos as chrome | Path triad is data |
| `slate-*` / cool gray void | Breaks warm umber → cyber SaaS |
| Glow at rest / marketing hero | Tool opens on work surface |
| `parch-500` as table body | Contrast + scan fail |
| 11–13px working data | Below floor; density ≠ illegibility |
| Transparent sticky head | Rows show through headers |
| Invented league numbers as real | Fixtures must be labeled |
| EverSense pink / Print | Wrong product |
| Permanent inline hex in product JSX | Ship via `@theme` only |
| Cloned wiki / rs-analysis markup | Steal the lesson, never the layout |

**Should PASS:** dark warm ground, gem active, gold Record only, crests present,
fixture labels, focus-visible gem ring, reduced-motion respected.

---

## Ship checklist (when promoted)

1. Apply `@theme` parch + stone (or `bench-*`) in **one** PR; no half routes.
2. Wire `.data-table` rules above; sticky head uses stage token.
3. Inject `GameIcon` / `regionCrestPath` into Data tree + dense rows + Build picks.
4. Build segment strip = gem-active `role="tablist"`; mount-active segment only.
5. Inspector key figures: mono ≥20px, gem on the primary number only.
6. Squint test at 1440×900: head-still three columns, data readable at arm’s length,
   still looks like RS3 Equilibrium (not a brown SaaS bench).
7. `npm run build` + `npm test` + `npm run test:e2e` before push to `main`
   (Vercel deploys on push; Playwright is local-only).
8. Re-run bot-audit / data-readability; no hard-fail regressions.

---

## Mock interaction contract

| Control | Behavior |
|---|---|
| **Data preview / Build preview** | Swaps full workbench; shared void/shell/gem law |
| Data category tree | Selects leaf; only that research mounts |
| Data filter | Filters fixture rows; resets selection |
| Data row click | Selects row; inspector + key figure update |
| Build segment strip | Regions / Relics / Blessings / Share |
| Build region cells / tree | Selection + crest inspector; picks key `N/3` |

All rows and region cards are **fixtures** — not published league numbers.

---

## Files

| Path | Role |
|---|---|
| `src/concepts/r3/HybridFullMock.tsx` | Interactive hybrid mock (inline proposal palette) |
| `src/concepts/r3/hybrid-full.md` | This shipping token + table CSS brief |
| `src/concepts/ConceptFrame.tsx` | Shared lab chrome (unchanged) |
| `app/globals.css` | Canonical tokens — **not edited this round** |

Lab wiring to `/concepts` scoreboard is a separate tournament step — not part of
this agent deliverable.
