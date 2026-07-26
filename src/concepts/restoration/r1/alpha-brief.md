# Team Alpha · DAYLIGHT — Round 1 brief

**Codename:** Daylight  
**Agents:** alpha-design + alpha-build  
**Thesis:** 2026 keyart daylight — sky, grass, stone fort, living world. A public
companion site players open to plan, not a developer console painted brown.

**Art anchors (mood only — no gen-AI):**

- `public/brand/keyart-2026.jpg` — primary: open sky, green valley, grey fort, teal crystal mountain
- Jagex ArtStation RS environment richness — material separation, not mud soup
- 2026 stone UI refresh — cleaner classic frames, hairline + carve only
- Gem green = interactive chrome only · gold = engraved titles only

**Not this:** SaaS hero funnel, pink Print, inventing league numbers, pure white Inter landing, gold active nav, dungeon-black IDE chrome.

---

## Sampling from keyart-2026

| Keyart region | Lesson for chrome | Do not |
|---|---|---|
| Azure sky + soft cloud | Page can breathe; void is *shaded courtyard*, not absolute black | Cool slate SaaS void, sky-blue buttons |
| Lush grass / hills | Living world — slight cool-green undertone in deep surfaces | Neon grass fill, nature stock wallpaper |
| Grey stone fort | Masonry ladder: readable mortar seams, sunlit top edge | Brown-on-brown dissolve |
| Teal crystal mountain | Equilibrium gem identity — glow reserved for interaction + key figures | Rainbow accents, order-blue chrome |
| Warm sun on timber / figures | Parch ink bright enough for outdoor arm's-length scan | Bleached white body, Inter marketing |

Daylight means **more light reaches the fort courtyard** — surfaces lift one honest step, borders read at arm's length, ink clears 4.5:1 on stage. The room stays RS-warm and dark enough for gold titles and gem chrome to pop.

---

## Full `@theme` hex token table (proposal)

Map into production only if CEO promotes. Scoped demo remaps the same names under
`.restoration-skin--alpha` in `alpha.css`. No production `globals.css` edit in R1.

### Parch — midday scan ink

| Token | Production | **Daylight** | Role |
|---|---|---|---|
| `--color-parch-50` | `#f0e9d7` | **`#f5efe0`** | Primary body, table names, titles |
| `--color-parch-100` | `#e0d4ba` | **`#e9dfc6`** | Secondary cells, bright labels, thead |
| `--color-parch-300` | `#c8b89c` | **`#d4c6a6`** | Meta, dt labels, counts |
| `--color-parch-400` | `#b5a68c` | **`#bfb08e`** | Captions, lab chrome |
| `--color-parch-500` | `#a3967e` | **`#a69474`** | Quiet only — never sole table body |

Never bleach to white. Never put `parch-400/500` on table body text.

### Stone — sunlit fort courtyard

| Token | Production | **Daylight** | Role |
|---|---|---|---|
| `--color-stone-950` | `#0d0a07` | **`#12110e`** | Page void — battlement shade (lifted, still dark) |
| `--color-stone-900` | `#12100c` | **`#1c1a16`** | Shell / nav / tab strip |
| `--color-stone-850` | `#1c1711` | **`#28251f`** | Panel fill, tree + inspector rails |
| `--color-stone-800` | `#231c14` | **`#343028`** | Table stage (mandatory ground under dense data) |
| `--color-stone-raised` | `#2a2218` | **`#423d33`** | Selected row / hover / raised panel |
| `--color-stone-zebra` | `#1a1510` | **`#2e2b24`** | Odd row fill |
| `--color-stone-inset` | `#18140f` | **`#181612`** | Input wells dig in |
| `--color-stone-750` | `#463a29` | **`#5e5748`** | Default border / mortar seam |
| `--color-stone-carve` | `#5c4a34` | **`#7d745f`** | Inset top-edge highlight (sun on stone) |

**Hard cap:** stage stops at `#343028` — not SaaS mid-brown desk, not pure grey board.

### Gold — engraved display only

| Token | Production | **Daylight** | Role |
|---|---|---|---|
| `--color-gold-300` | `#f3c97b` | **`#f5d48e`** | Soft highlight on display type |
| `--color-gold-400` | `#e0b264` | **`#e8c06e`** | Brand wordmark, `Record` headings |
| `--color-gold-500` | `#a87c3c` | **`#b88a42`** | Quiet gold / secondary engraving |

**Never** selected nav, never tab active, never button fill.

### Gem — crystal mountain / interactive chrome only

| Token | Production | **Daylight** | Role |
|---|---|---|---|
| `--color-gem-200` | `#8ff0cd` | **`#9af5d4`** | Focus glow soft |
| `--color-gem-300` | `#57e0ae` | **`#62e8b8`** | Active tab / tree leaf text |
| `--color-gem-400` | `#2ecb8f` | **`#38d49a`** | Active links, key figure, focus ring |
| `--color-gem-500` | `#1fa372` | **`#24a878`** | Selected border |
| `--color-gem-600` | `#157a55` | **`#18805a`** | Pressed / deep gem |

### Path triad + ember (data semantics — unchanged roles)

| Token | Daylight | Role |
|---|---|---|
| `--color-chaos-300` | `#d4614d` | Path data only |
| `--color-chaos-400` | `#b5402f` | Path data only |
| `--color-order-400` | `#4a7ec2` | Path data only — **not** chrome |
| `--color-balance-400` | `#6fae45` | Path data only |
| `--color-ember-400` | `#e2622a` | Data warning / heat only |

No `slate-*`. No EverSense pink. No second brand accent.

---

## Type scale

| Role | Size | Weight / face | Color |
|---|---|---|---|
| Brand wordmark | 13–14px | `font-display`, tracking `0.16–0.2em` | `gold-400` |
| Page / panel title | 15–16px | sans medium | `parch-50` |
| Nav links | 13–14px | sans; active medium | idle `parch-100` · active `gem-400` |
| Tab labels | 12–13px | sans; selected medium | selected `gem-300` + gem border |
| Table body | **15px** | sans, tabular nums | `parch-50` primary · `parch-100` secondary |
| Table headers | **12px** | medium, uppercase, tracking `0.06em` | `parch-100` on opaque stage |
| Meta / provenance | 11–12px | sans | `parch-300` min for scannable meta |
| Key figure | **20–28px** | mono, tabular | `gem-400` |
| Floor (lab only) | 10–11px | mono | `parch-400` — never product body |

**Contrast law:** body and table names ≥4.5:1 on stage. Headers on opaque thead. Sticky head never transparent.

---

## Surface hierarchy

```
┌─ void #12110e ────────────────────────────────────────────────────────────┐
│  ┌─ shell #1c1a16 ── nav (gold brand · gem active) ─────────────────────┐ │
│  │  [optional Overview: quiet keyart strip — art, not funnel CTA]       │ │
│  │  ┌ rail #28251f ─┐  ┌ stage #343028 ──────────────┐  ┌ rail ───────┐ │ │
│  │  │ tree + crests │  │ h2 + filter + 15px table    │  │ inspector   │ │ │
│  │  │ gem leaf      │  │ sticky thead · zebra · gem  │  │ gold title  │ │ │
│  │  │               │  │ select                      │  │ key 22px gem│ │ │
│  │  └───────────────┘  └─────────────────────────────┘  └─────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

Depth method (unchanged law): **hairline border + inset top carve**. Only stop
values move so seams separate panels instead of dissolving.

---

## Layout notes by route

### Overview

- Open on the **working surface**, not a marketing hero.
- Optional full-bleed **keyart band** (real `keyart-2026.jpg`, `object-position` toward sky/crystal): atmosphere only — no “Get started” CTA stack, no three feature cards.
- Below band: compact status strip — region picks `0/3` pattern, last sync date pattern (not invented league facts), one gem key figure (e.g. tracked sources count from fixture).
- Density over empty scenic padding. Crests and game art welcome; no gen-AI fillers.

### Data

- Control-surface shell: **tree · table · inspector** (proven R1–R3 DNA).
- Table law: 15px body, 12px bright headers, zebra, sticky opaque thead, gem outline on selected row.
- Filter field inset; row count mono meta.
- Inspector: gold display title for selected record name, crest, key mono figure, provenance line matching `/sources? · verified <date>/` pattern — fixture-labeled until real catalog is wired.
- Never invent blessing/relic numbers; empty `records: []` stays honest when unrevealed.

### Build

- Segment strip: Regions · Relics · Blessings (no Gear tab).
- Region grid/list uses real crest paths (`/game/regions/<id>.png`), pick counter `n/3`, 4th pick `aria-disabled`.
- Relics/Blessings: unrevealed state is empty or provisional marker — no fake tier math.
- Same stone ladder and gem chrome as Data; Build is not a second theme.

---

## Interaction rules

| Control | Idle | Active / selected |
|---|---|---|
| Top nav | `parch-100` | `gem-400` medium — never gold |
| Tabs / segments | transparent border, `parch-100` | `gem-500` border + `gem-300` text on rail fill |
| Tree leaf | `parch-100` | left gem bar or fill + `gem-300` |
| Table row | zebra stage | `stone-raised` + gem inset outline |
| Focus ring | — | `gem-400` 1px outline, 2px offset |
| Buttons | stone border, parch text | gem border when primary action |

Reduced motion: honor `prefers-reduced-motion` (global already zeros transitions). No ambient particle sky.

---

## Panel / table tweaks (skin-local)

Under `.restoration-skin--alpha` only:

- `.panel` / carved surfaces: stronger carve (`#7d745f`) so fort edges read in daylight lift
- `.data-table` stage on `stone-800`; thead fully opaque; th letter-spacing preserved
- Optional `.daylight-horizon`: 1px cool sky hairline under nav (atmospheric, not a second accent system)
- Keyart strip max-height ~120–160px; fade into shell via gradient mask so it does not fight the table

---

## Anti-slop checklist

- [ ] No hero → 3 cards → CTA
- [ ] No inventing league numbers as real
- [ ] No gen-AI art
- [ ] No EverSense pink / Print notes
- [ ] No gold active nav
- [ ] No pure white / Inter landing
- [ ] Gem only for interaction + key figures
- [ ] Gold only for engraved display
- [ ] Fixture rows labeled fixture / demo
- [ ] Tokens only on `.restoration-skin--alpha` — production globals untouched

---

## Deliverables

| File | Role |
|---|---|
| `alpha-brief.md` | This document |
| `alpha.css` | Scoped CSS variable remap + panel/table tweaks |
| `AlphaPreview.tsx` | Interactive full-bleed preview (nav, tabs, dense table, key figure) |

**Mock:** fixture data only. Crests from `regionCrestPath` when available. Keyart from `/brand/keyart-2026.jpg`.
