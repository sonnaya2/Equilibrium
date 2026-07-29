---
name: equilibrium-ui
description: >
  Binding visual system for RS3 Equilibrium (this repo). Palette, gem-green chrome,
  hexagon/shield motifs, component inventory, route anatomy, Tailwind v4 token map,
  3D map fence, frozen e2e contracts, sanctioned no-slop exceptions, and how global
  anti-slop skills + frontend-design + Context7 apply here. Use before any UI, theme,
  CSS, component or copy work in this repo; wins over EverSense/NTE notes in no-slop-ui.
---

# Equilibrium visual system

**Product:** companion webapp for RuneScape 3 Leagues II: Equilibrium.
**Class:** premium public game companion site + planner (not a developer console). Free fan tool — nothing is sold.
**Production skin (provisional R3):** Team Alpha · Daylight tokens — sunlit fort stone, crystal gem chrome, keyart stage on Overview.

This skill is the **binding product law** for UI in `Rs3Equilibrium`. Global skills
(`no-slop-ui`, `human-grade`, `ui-humanizer`, `text-humanizer`, `bot-audit`,
`data-readability`) still apply for fingerprint bans and density floors, but
**EverSense/NTE product bindings do not**. Pink `#FD61A8`, light paper/halftone
Print skin, "not Tailwind", and "all dark grounds rejected" are a different app.

## Precedence

1. **What the user asked for wins.** Skills stop generic model defaults; they do not
   overrule an explicit request. Build the request, note the ban once, move on.
2. **The game's own language wins over the ban list.** Blur on unrevealed content,
   lit bevel on hexes, loud desert terrain — in-world, not slop.
3. **This skill wins over no-slop-ui §5 / §7 product notes** when they conflict.
4. **Fingerprint bans in no-slop-ui §1–4 still win** over pretty defaults (rainbow
   gradients, hero pitch, glassmorphism-as-default, SaaS skeleton).
5. **Claude `frontend-design`** is craft only (type scale, cascade, restraint). Its
   "open with a hero thesis" and trend-palette instincts are overridden — see §Craft
   companions below.
6. **When in doubt, build the bolder game-faithful version.** Over-guarded bleach is
   a failure mode equal to slop (`no-slop-ui` §4.5).

## Stack (do not invent another)

| Layer | Binding choice |
|---|---|
| Framework | Next.js App Router (`app/`), React **19.2.8** exactly (fiber peer) |
| Style | **Tailwind v4 CSS-first** — tokens in `@theme` inside `app/globals.css`. No `tailwind.config`. |
| Display type | **Cinzel** via `next/font/google` → `--font-cinzel` / `--font-display` |
| Body / mono | system ui-sans-serif; ui-monospace + `tabular-nums` (global on body) |
| 3D | `@react-three/fiber` + `drei` + `three`, **fenced under `src/map/`**, loaded `next/dynamic` `ssr: false` |
| Data | static JSON under `data/`; picks in `localStorage` via `@/league/useBuild` |
| Deploy | Vercel, git-connected `main` → production |

**Not this product:** NiceGUI, PySide6, `print-tokens.css`, MiSans, Impact, pink accent.

### Token map (canonical)

Defined in `app/globals.css` `@theme`. Inline hex in components is a defect.
3D mirrors numbers in `src/map/palette.ts` only (TSL/lights need numbers, not CSS vars).

```
parch   50 #f5efe0 · 100 #e9dfc6 · 300 #d4c6a6 · 400 #bfb08e · 500 #a69474
stone   750 line #5e5748 · 800 stage #343028 · 850 panel #28251f
        900 shell #1c1a16 · 950 void #12110e · carve #7d745f
        zebra #2e2b24 · raised #423d33 · inset #181612
gold    300 #f5d48e · 400 #e8c06e · 500 #b88a42     (display ink only)
gem     200 #9af5d4 · 300 #62e8b8 · 400 #38d49a · 500 #24a878 · 600 #18805a
path    chaos-300 #d4614d · chaos-400 #b5402f · order-400 #4a7ec2 · balance-400 #6fae45
ember   400 #e2622a                                 (unlock sweep only)
radius  sm 2px · md 4px
```
Restoration Companion (Alpha Daylight provisional). Sampled from 2026 keyart + stone UI.


**Tailwind class names** match token suffixes: `bg-stone-950`, `text-parch-50`,
`text-gem-400`, `border-stone-750`, `font-display`, `text-gold-400`, `rounded-sm`.

Do **not** invent `stone-700` as a design token — it is not in `@theme`. Prefer
`stone-750` / `stone-800` for edges and raised surfaces. If you see `border-stone-700`
in combat tabs, treat it as accidental Tailwind default leakage and migrate toward
`stone-750` when you touch that file.

Contrast floor: body ≥ 4.5:1 on its surface. Chaos fill `#b5402f` fails as text —
use `chaos-300` when chaos must be read as ink.

## Accent ruling

| Role | Token | Use |
|---|---|---|
| Chrome accent | gem green | Active nav, primary focus ring, selected cell inset, key actions |
| Display ink | gold | Brand mark, `PageHeading` / page `h1` only — never active state |
| Path triad | chaos / balance / order | Blessing path data only — never button/border/active chrome |
| Ember | ember-400 | Unlock sweep transition only — never at rest |
| Neutrals | stone + parch | 95% of chrome |

One chrome accent. Order blue in particular must never become a button or active border.

## Motifs

- **Hexagon** — layout grid (relic tiers, 8×3 blessing lattice, region cells, pip shape). Not a logo stamp.
- **Shield crests** — region identity from `public/game/regions/{id}.png` inside cells.
- **Diamond/hex pips** — progress (`Pips` component); structure mode dims all, progress mode fills.
- **Timber slats + crystal** — locked cells (`.cell-locked`).
- **Carved edge** — sole depth method: 1px `stone-750` border + 1px inset `stone-carve` (`.panel`).

## Component inventory (extend these; do not fork)

| Piece | Path | Job |
|---|---|---|
| `Page` | `src/components/Page.tsx` | Fluid workbench shell (`max-w-[1600px]`) |
| `SectionTabs` | `src/components/SectionTabs.tsx` | Gem-active tablist for Data/Build/etc. |
| Concepts lab | `app/concepts/` | Design tournament only — not primary nav |
| `PageHeading` | `src/components/Heading.tsx` | Gold display title + optional note |
| `Nav` | `src/components/Nav.tsx` | Brand + six primary links |
| `Hex` / `HexRow` / `hexClass` | `src/components/Hex.tsx` | Lattice cells (`open`/`selected`/`locked`/`unrevealed`) |
| `Pips` | `src/components/Pips.tsx` | Hex-pip progress / structure |
| `Stat` | `src/components/Stat.tsx` | Label + mono value |
| `GameIcon` | `src/components/GameIcon.tsx` | `public/game/` art; default `alt=""` inside named controls |
| `panel` / `panel-head` / `panel-body` | `globals.css` | Carved stone surfaces |
| `data-table` / `num` / `stat-key` / `tag` | `globals.css` | Dense records, key figure, state tags |
| `stat-strip` | `globals.css` | Inspector fact strip (4-up) |
| `map-chip` / `slab-chip` / `vine-frame` | `globals.css` | Map overlays and pick-bound vine growth |
| `cell*` | `globals.css` | Hex lattice material states |

Combat UI lives under `src/components/combat/` (Quick, Build, Rotation, Analysis tabs).
Research/data browsers under `src/components/*Research.tsx` + `ResearchBrowser`.

**Art path helper:** `@/lib/gameArt` → `gameIconPath`, `regionCrestPath`, `styleIconPath`.
Source art is `assets/rs3/` (not web-served); published copies are `public/game/`.

## Route anatomy (IA)

```
EQUILIBRIUM   Overview  Map  Tasks  Build  Combat  Data   (+ /sources footer)
```

| Route | Working surface |
|---|---|
| `/` | League status + planner link list + systems table (opens on facts, not a pitch) |
| `/map` | `RegionPlanner`: board (`MapLoader`→3D/`FlatBoard`) + `RegionPicker` rail + `RegionDetails` |
| `/tasks` | Task records (empty Equilibrium list may fall back to Catalyst test data when enabled) |
| `/build` | `BuildPlanner`: region hexes, relic/blessing lattices, share link — same `useBuild` as map |
| `/combat` | Tabs: Quick · Build · Rotation · Analysis · Reference |
| `/data` | Control Surface tabs (Browse · Progression · Unlocks · Consumables · Systems · Crafting · Boundaries); mount-active-only |
| `/concepts` | GUI tournament lab (footer link); not in primary nav |
| `/sources` | Credits and provenance |

Map rule: **ledger owns a11y and e2e picks**; canvas never duplicates accessible pick controls.
3D is the good view; region planning must work without WebGPU (`no WebGPU` fallback string is frozen).

## Frozen UI contracts (e2e pins these — CI does not run Playwright)

Treat as API. Break them only by updating `e2e/` in the same change.

- Brand link accessible name exactly `EQUILIBRIUM`
- `<nav>` with Overview, Map, Tasks, Build, Combat, Data
- Footer substring `RuneScape is a trademark of Jagex Ltd.`
- All 11 regions as `<button>` whose name **starts with** the display name (`GameIcon` inside needs `alt=""`)
- Literal `0/3` and `3/3` pick counters; genuinely `disabled` 4th elective; `Clear picks` verbatim
- `section[aria-live]` for region detail matching `/sources? · verified <date>/` (pattern, not a fixed date)
- Substring `no WebGPU` in the WebGPU-absent fallback

Do not pin scraped `verifiedAt` dates or rule wording in e2e.

## Sanctioned exceptions (do not strip in humanizer)

Each trips a generic ban and is still correct here:

1. **Frosted unrevealed cells** — game blurs unrevealed relics/blessings; not default glassmorphism.
2. **Two material gradients** — top-light on lattice cells; timber slat repeat on locked cells. No brand-chrome gradients.
3. **Dark warm ground** — league panel / Wiki dark mode register. NTE "dark grounds rejected" does not apply.
4. **Selection glow** — selected cell/marker only; nothing glows at rest.
5. **Path triad colors** — data semantics for Order/Chaos/Balance, never chrome.
6. **Vine frame** — pick-count instrument on the map (`vine-frame`); state-change only; reduced-motion kills it.
7. **Honeycomb offset** — region hive may interlock; blessing lattice keeps aligned columns (tier number carries meaning).

## Density floors

`data-readability` is equal law on data surfaces.

- Data ≥14px working (13px densest floor); labels ≥11px; key number ≥20px (`.stat-key` is 1.75rem gem)
- Mono + `tabular-nums` for figures
- ≥70% of 1440p viewport is content on working views; no 40px+ voids inside a work surface
- Related facts adjacent (ledger row next to board; inspector under both — not a 2600px scroll)

Density comes from real records (quests histograms, research catalog). Empty unrevealed lattices stay blurred cells, not "COMING SOON" card gardens.

## Art rules

| Allowed | Banned |
|---|---|
| Extracted game art, wiki imagery (CC BY-NC-SA 3.0 credit), map tiles, skill/combat icons | Gen-AI imagery |
| Procedural/script textures (seeded noise, TSL materials, SVG from data) | Copying pvme / rs-analysis / leagues.build **layout, components, or wording** |

A game tool with no game art fails identity. Prefer more real art, not substitutes.

## Motion

- 90–180ms on color/border/background; state change only
- Map vine grow ~160–180ms; unlock ember is transitional
- `prefers-reduced-motion: reduce` hard-kills transitions (global rule in `globals.css`)
- Focus-visible: 1px `gem-400` outline, offset 2px

## Craft companions (how to load them here)

### no-slop-ui / human-grade / ui-humanizer / text-humanizer / bot-audit

| Step | Skill | Equilibrium binding |
|---|---|---|
| Route | `human-grade` | Product class: **game-world surface + tool workbench**; load this skill as §5 |
| Law | `no-slop-ui` | §§1–4, 4.5, 6, 8–9 apply; **§5 EverSense Print skin and §7 "not Tailwind" do not** |
| Density | `data-readability` | Full apply |
| Surgery | `ui-humanizer` | Tokens = this skill's map; accent = gem, not pink |
| Copy | `text-humanizer` | RS3 player voice; nouns/verbs; no marketing |
| Detect | `bot-audit` | Before ship; **adjudicate** frosted cells, timber gradients, dark ground, path triad via this skill — do not strip sanctioned exceptions |

### Claude frontend-design

Use for craft after law is loaded: type hierarchy, spacing cascade, self-critique, restraint.
**Overridden for this product:**

- No marketing hero / thesis billboard — tools open on the working surface
- No cream+terracotta / acid-green-noir / broadsheet default clusters when they fight the sampled league palette
- No scroll-reveal orchestras; motion stays state-change only
- "One aesthetic risk" = total commitment to RS3 league language (hex lattice, crests, carved stone), not a trend layer

### Context7 (library docs)

Use Context7 when the question is **library API/config**, not visual law:

| Library | Typical Context7 ID |
|---|---|
| Next.js App Router / `next/font` / `dynamic` | `/vercel/next.js` (prefer v16.x) |
| Tailwind v4 `@theme` | `/tailwindlabs/tailwindcss.com` or `/websites/tailwindcss` |
| React Three Fiber / drei | resolve via Context7 library search when editing `src/map/` |

Do **not** use Context7 to invent a new palette or component design language.

## Implementation checklist (every UI change)

- [ ] Tokens from `@theme` / Tailwind classes above — no new hex in JSX
- [ ] Reuse `Page` / `PageHeading` / `panel` / `data-table` / `Hex` / `Pips` / `GameIcon`
- [ ] Active chrome is gem; headings are gold; path colors only on path data
- [ ] Open on working surface; empty = one plain sentence (+ one action if needed)
- [ ] Map/build share `useBuild`; do not fork pick state
- [ ] 3D stays under `src/map/` with `ssr: false`; no `three` in shared layout chunk
- [ ] Crests in named buttons: `alt=""`
- [ ] Frozen e2e strings/roles still match
- [ ] bot-audit clean after adjudicating sanctioned exceptions
- [ ] `npm run typecheck` / `npm test`; `npm run test:e2e` if selectors or map/ledger change

## Tournament ledger

Verdicts so losses are not rebuilt.

- **Hex Lattice — shipped.** Three densities, real crests, timber-crystal lock. Cells read as carved stone.
- **War Table — primary map.** Flat Jagex plate doubled markers; raised authored geometry replaced it. SVG flat board = no-WebGPU fallback. Ledger owns a11y; inspector holds confirmed/inferred filters.
- **Region identity is structural, not hue.** Structure (furrows, canopy, heath) differentiates green regions; shared grade pass unifies.
- **Stone Ledger topology alone — scrapped.** Rail+grid+inspector without world identity had no presence.
- **Honeycomb offset harms tabular meaning** on blessing columns — keep tiers aligned; offset only the region hive.
- **Vine frame — instrument, not décor.** Bound to pick count; one transition on change.
- **Overview is status + systems table**, not a marketing landing.
- **Control Surface shell — tournament winner (9.1/10, round 1).** Fluid `max-w-[1600px]` workbench; Data/Build use gem-active tabs with mount-active-only panels; tree+table+inspector structure. Ship debt: more crests in dense trees. Lab archive: `/concepts`.


## What not to do

- Import EverSense Print tokens, pink accent, or MiSans/Impact as identity
- Add `tailwind.config` or move tokens out of `app/globals.css` `@theme`
- Put hero CTAs, feature-card gardens, or COMING SOON card grids on tool routes
- Let order-blue or gold mark interactive chrome
- Inline hex outside `palette.ts` / documented material exceptions
- Server-render or route-share the Three bundle
- Pin live wiki dates in e2e
- Gen-AI icons or cloned third-party tool chrome
