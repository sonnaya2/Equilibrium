# Team Composite · R2 CHAMPION — Hybrid Composition

**Agents:** composite-design + composite-build  
**Codename:** Steal Matrix  
**Mock:** `CompositePreview.tsx` · skin `.hybrid-skin--composite` in `composite.css`  
**Scope:** concepts lab only — **no** production `globals.css` / `@theme` edits.  
**Orchestrator:** ships later — these three files are the deliverable.

---

## Fixed recipe (non-negotiable)

| Slot | DNA | Steal from |
|---|---|---|
| **Colors** | Editorial throughout | Echo ladder (`--echo-*` → `--color-*`) |
| **Overview** | Daylight courtyard gate | **Nova** — lintel · west picks · keyart aperture · east milestones · desk |
| **Map** | Editorial 3D-top · **NO inspector** | **Orbit Board Sky** — tall board, ledger a11y, Clear picks, `N/3` |
| **Tasks** | Crystal × Data twin | **Prism** — lattice · crest rail · facets · full source inspector |
| **Build** | Editorial + relic presentation | **Ridge Relic Court** — T1 monogram frames (SV / EH / GT) |
| **Combat** | Crystal main · Editorial accents | **Forge Calc Crystal** — real ability icons · honest DPL vacancy |
| **Data** | Lattice + Daylight browse + **FULL sources** | **Prism Facet Desk** — multi-source title · url · verifiedAt · sourceType |

Pass bar remains **9.0**. Specialists who only polish one signature fail. This file is the mash.

---

## Thesis

**Execute the CEO steal matrix without cloning markup.** One Editorial skin, six routes, each route owns the DNA of the R1 specialist who won that slot — re-skinned under composite tokens, not copy-pasted class names from rival teams.

R2 wins when:

1. Overview’s three-bay **courtyard gate** reads public-site craft (Nova depth: lintel / jamb / aperture carve).
2. Map board is **majority height**; ledger owns picks; **zero RegionInspector** third column.
3. Data **and** Tasks are the **same twin desk** cut twice with full multi-source SourceReference cards.
4. Build seats **Survivalist · Endless Harvest · Golden Touch** with monogram frames — never Catalyst PNGs, never weapon cosplay.
5. Combat densifies ability scan with real icons and **structured `—` vacancy wells** for DPL / adren.
6. Gem = interactive only. Gold = engraved display only. Path triad = data labels only. Fixture rows labeled fixture / provisional.

Not a SaaS funnel. Not a developer console. Not gen-AI art. No production globals.

---

## Token contract (Editorial ladder)

Scoped under `.hybrid-skin--composite` only.

| Role | `--echo-*` | Hex | `--color-*` bridge |
|---|---|---|---|
| Void | `--echo-void` | `#0a0806` | `--color-stone-950` |
| Shell / mast | `--echo-shell` | `#100e0b` | `--color-stone-900` |
| Rail | `--echo-rail` | `#16120e` | `--color-stone-850` |
| Stage | `--echo-stage` | `#1f1912` | `--color-stone-800` |
| Raised | `--echo-raised` | `#2a231b` | `--color-stone-raised` |
| Zebra | `--echo-zebra` | `#18140f` | `--color-stone-zebra` |
| Inset | `--echo-inset` | `#12100c` | `--color-stone-inset` |
| Border | `--echo-border` | `#4a3d2c` | `--color-stone-750` |
| Carve | `--echo-carve` | `#6a563e` | `--color-stone-carve` |
| Body | `--echo-parch-50` | `#f1e9d6` | `--color-parch-50` |
| Secondary | `--echo-parch-100` | `#e0d4b8` | `--color-parch-100` |
| Meta | `--echo-parch-300` | `#c4b59a` | `--color-parch-300` |
| Quiet | `--echo-parch-400` | `#a8987c` | `--color-parch-400` |
| Gold | `--echo-gold` | `#e0b264` | `--color-gold-400` |
| Gem | `--echo-gem` | `#2ecb8f` | `--color-gem-400` |
| Gem bright | `--echo-gem-bright` | `#57e0ae` | `--color-gem-300` |
| Gem deep | `--echo-gem-deep` | `#1fa372` | `--color-gem-500` |
| Facet edge | `--comp-facet` | `#4de8b8` | combat / desk chips |
| Vacancy | `--comp-vacancy` | `#1a1612` | empty math wells |

Contrast: parch-50 on stage ≈ 11:1 body; gem on void ≈ 9.5:1 chrome.

---

## Per-route DNA

### Overview — Nova courtyard gate

```
┌─ LINTEL (gold title · fixture meta) ─────────────────────────────────┐
├─ WEST JAMB (3 standing pick posts) │ APERTURE (keyart) │ EAST (milestones) ─┤
└─ COURTYARD DESK (plan ledger + next board · slate panels) ───────────┘
```

- Keyart: `/brand/keyart-2026.jpg` inside the aperture, not a full-bleed hero.
- Live pick state from shared Map/Build loadout.
- Relic milestone shows seated T1 monogram when chosen.
- No CTA funnel, no feature-card garden.

### Map — Orbit Board Sky (no inspector)

```
┌─ Ledger (~220px) ────────┬─ Tall board zone (minmax 0,1fr) ──────────┐
│  Picks N/3               │  "3D board" structure (MapLoader-shaped)  │
│  Clear picks             │  terrain plate · crest markers · sky veil │
│  11 region buttons       │  no inspector · no third column           │
│  Focus card (inline)     │  fills remaining viewport height          │
└──────────────────────────┴───────────────────────────────────────────┘
```

- Real crests: `/game/regions/{id}.png` via `regionCrestPath`, `alt=""`.
- Cap 3; 4th pick `aria-disabled="true"` (still focusable); Clear always present.
- Region button accessible name **starts with** display name.
- Focus card lives **in the ledger** — never a right-rail RegionInspector.

### Tasks — Prism twin desk

Same three-column DNA as Data:

```
Lattice tabs · Daylight crest rail · facet chips · 15px table · FULL source inspector
```

Catalyst stand-ins marked provisional. Points are fixture/demo.

### Build — Ridge Relic Court

```
Segments: Regions · Relics · Blessings
RELICS: tier hex rail (T1 open · T2–T7 sealed)
        three monogram cards: SV Survivalist · EH Endless Harvest · GT Golden Touch
        full effects folio + provenance (data/league/relics.json)
REGIONS: crest lattice · N/3 · Clear picks · 4th aria-disabled
BLESSINGS: empty lattice · path colors as data labels only
```

**Hard ban:** no Catalyst `t1-*` PNGs, no weapon/upgrade icons as “relics,” no invented T2–T7 effects.

### Combat — Forge Calc Crystal

```
[ Quick | Setup | Analysis | Rotation ]
[ style icon chips: All · Melee · Magic · Ranged · Necromancy · Defence ]
[ facet ability bar — real icons when available — 5 slots ]
[ wiki-dense ability table | vacancy wells for Adren + DPL ]
```

Ability **names/icons** dense. Math columns stay `—` until the live combat core binds. Never invent DPL %.

### Data — Prism Facet Desk (FULL sources)

```
Tabs: Browse | Progression | Unlocks | Systems | Sources
┌─ Crest rail ──┬─ Stage table 15px ──┬─ Inspector ────────────────────┐
│  all 11       │  sticky · zebra     │  gold title · crest · every    │
│  regions      │  facet filters      │  scalar field · Sources list   │
│               │  Daylight band      │  each: title · url · verifiedAt│
│               │                     │  · sourceType · optional note  │
└───────────────┴─────────────────────┴────────────────────────────────┘
```

Multi when multi. Empty list when empty. Never invent refs. Linkable URLs required.

---

## Shared state

- **Picks:** `RegionId[]` max 3, live across Overview · Map · Build.
- **Seated relic:** one of three T1 ids or null — surfaces on Overview milestones + Build court.
- **No global hotkeys.** Buttons only.

---

## Frozen e2e / contract strings

- Brand named exactly `EQUILIBRIUM`
- Nav: Overview · Map · Tasks · Build · Combat · Data
- Footer: `RuneScape is a trademark of Jagex Ltd.`
- Literal `0/3` and `3/3` pick counters; `Clear picks` always present
- Region buttons: accessible name starts with display name; crests `alt=""`
- Map WebGPU-absent cue substring: `no WebGPU` (fallback strip)
- `section[aria-live]` for region detail under board/ledger
- Fixture / provisional labels on demo rows

---

## Art rules

| Allowed | Forbidden |
|---|---|
| `/brand/keyart-2026.jpg` | Gen-AI anything |
| `public/game/regions/*` crests | Catalyst relic PNGs as Equilibrium |
| `public/game/skills/*` as **related skill chips** only | Weapon / upgrade PNGs labeled as relics |
| `public/game/combat/*` ability + style icons | Invented DPL / adren numbers |
| CSS monogram placeholder frames | Invented T2–T7 effects |
| Real T1 names + effects from `data/league/relics.json` | Mislabeling Catalyst as T1 |

---

## Anti-slop

- No hero funnel · no “Choose your region” CTA stack · no feature-card garden  
- No gold active nav · no order-blue chrome · no Inter marketing  
- No third-column Map inspector  
- Data ≥15px body · contrast ≥4.5:1 on stage  
- Reduced-motion: color only ≤90ms  
- Thesis copy stays in this brief — not in player-facing lintels  

---

## Proof recipe hit list (R2 self-audit)

| # | Rule | Proof in mock |
|---|---|---|
| 1 | Editorial colors | `.hybrid-skin--composite` echo ladder only |
| 2 | Overview Daylight courtyard | `OverviewPane` lintel/jamb/aperture/desk |
| 3 | Map no inspector | Two-column ledger + board; focus card in ledger |
| 4 | Map Clear picks + N/3 | Toolbar + ledger controls |
| 5 | Tasks Crystal×Data twin | Same desk shell as Data with sources |
| 6 | Build T1 monogram court | Survivalist / Endless Harvest / Golden Touch |
| 7 | No Catalyst / weapon relics | Monogram frames only |
| 8 | Combat vacancy law | Adren + DPL wells + table `—` |
| 9 | Real ability icons | `/game/combat/abilities/...` + style icons |
| 10 | Data FULL multi-source | SourceList: title, url, verifiedAt, sourceType |
| 11 | Live shared picks | Root state → Overview / Map / Build |
| 12 | Fixture labeled | provisional tags + fixture sourceType |
| 13 | Gem/gold law | gem active nav; gold titles only |
| 14 | No production globals | skin-scoped CSS only |

---

## What R1 specialists still own (do not dilute)

- **Nova:** courtyard gate material depth — do not collapse Overview to a status strip.
- **Orbit:** board majority height — do not grow ledger into a third column under pressure.
- **Prism:** full SourceList — do not regress to a sources count caption.
- **Ridge:** monogram law — never wire Catalyst icons “temporarily.”
- **Forge:** vacancy wells — never invent demo DPL to look complete.

---

*Team Composite · R2 · prize on the line · no trophies until 9.0.*
