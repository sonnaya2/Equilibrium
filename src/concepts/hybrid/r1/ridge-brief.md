# Team Ridge · RELIC COURT — Hybrid Composition R1

**Agents:** ridge-design + ridge-build  
**Codename:** Relic Court  
**Mock:** `RidgePreview.tsx` · skin `.hybrid-skin--ridge` in `ridge.css`  
**Scope:** concepts lab only — no production `globals.css` edits.  
**Fixed recipe:** Editorial colors · Daylight Overview · Editorial Map · Crystal×Data Tasks · Editorial Build · Crystal Combat · Lattice Data.

---

## Thesis

The Build route is the product’s **court of relics** — a formal presentation hall where revealed T1 choices stand as engraved cards in a hex lattice, region crests hold the standing picks, and the blessing lattice stays empty with path colors as **data labels only**. Everything else in the hybrid recipe is executed honestly so the court can own the room without fighting chrome.

Not a SaaS relic shop. Not Catalyst icons wearing Equilibrium names. Not invented tier art.

---

## Signature (what CEO should notice in 3 seconds)

1. **Relic Court stage** on Build → Relics: three T1 choice cards (Survivalist · Endless Harvest · Golden Touch) with carved placeholder frames — monogram + name — never Catalyst `t1-*` art, never gen-AI.
2. **Hex lattice for tiers** (T1 open, T2–T7 unrevealed cells) interlocking like the product blessing lattice.
3. **Region crest board** with literal `0/3` · `3/3` pick counters and `Clear picks`.
4. **Blessing lattice** with Order / Balance / Chaos ink on path labels only — never as nav chrome.

---

## Recipe fidelity map

| Route | Recipe DNA | Ridge execution |
|---|---|---|
| **Colors** | Editorial | Magazine type, art-stage energy, roomier public spacing, gem active / gold engraved |
| **Overview** | Daylight | Courtyard gate: keyart aperture, standing region posts, plan ledger — not tree·table·inspector |
| **Map** | Editorial + 3D top, **no inspector** | Keyart plate + full 11-crest gazetteer + 3D wartable cue strip; pick/focus on tiles only |
| **Tasks** | Crystal × Data | Faceted filter chips + wiki-dense table + side detail; Catalyst stand-ins marked provisional |
| **Build** | Editorial + relic art | **Masterpiece.** Court · hex tier rail · T1 cards · crest regions · empty blessing lattice |
| **Combat** | Crystal main, Editorial accents | Crystal style facets + empty result bay; Editorial gold section titles; no invented DP |
| **Data** | Lattice + Editorial + Daylight browse + full sources | Hex category rail · Daylight stage table · art-stage mast · inspector with complete source block |

---

## Art rules (hard)

| Allowed | Forbidden |
|---|---|
| `/brand/keyart-2026.jpg` | Gen-AI anything |
| `public/game/regions/*` crests | Catalyst relic PNGs as Equilibrium |
| `public/game/skills/*` as **related skill chips** only | Mislabeling Catalyst items as T1 relics |
| CSS monogram placeholder frames | Invented official-looking relic icons |
| Real T1 names + effects from `data/league/relics.json` | Invented T2–T7 effects |

**Icon check (R1):** `public/game/` has **no** Equilibrium relic icons. Assets under `assets/leagues/catalyst/relics/` are Catalyst-only — **do not wire**. Placeholder frame + name is correct until Jagex art lands.

---

## T1 court content (from data — not invented)

Source: Jagex “Countdown to LEAGUES II: EQUILIBRIUM!” · verified envelope `2026-07-25`.

| Choice | Court monogram | Related skill chips (not icons-of-relic) |
|---|---|---|
| Survivalist | SV | Mining · Fishing · Woodcutting · Archaeology |
| Endless Harvest | EH | Farming · Fishing · Mining · Woodcutting · Archaeology |
| Golden Touch | GT | Agility · Thieving |

Effects copy from the data envelope (truncated in UI; full list in inspector panel).

---

## Layout DNA — Build (masterpiece)

```
┌─ BUILD SEGMENTS: Regions · Relics · Blessings ─────────────────────┐
│  RELICS court:                                                      │
│  ┌─ Tier hex rail (T1 selected · T2–T7 unrevealed) ──────────────┐ │
│  │  [T1] [T2?] [T3?] [T4?] [T5?] [T6?] [T7?]                     │ │
│  ├─ Court cards (3 hex-framed editorial cards) ───────────────────┤ │
│  │  [SV] Survivalist   [EH] Endless Harvest   [GT] Golden Touch   │ │
│  │  effects · skill chips · source line                           │ │
│  └─ Detail folio (selected relic · full effects · provenance) ────┘ │
│  REGIONS: crest grid · 0/3 · 3/3 · Clear picks · 4th aria-disabled │
│  BLESSINGS: empty lattice · path colors on labels only · unrevealed │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Token contract (skin only)

Scoped under `.hybrid-skin--ridge`. Editorial ladder; no production token rewrite.

| Role | Hex | Notes |
|---|---|---|
| Void | `#0c0a08` | Deeper under art plate |
| Shell / mast | `#14110e` | Nav + segments |
| Rail | `#1a1612` | Hex rail, side panels |
| Stage | `#242018` | Table / card ground |
| Raised | `#302a20` | Selected / hover |
| Border / carve | `#524636` / `#6b5840` | Hairline + sunlit inset |
| Parch body | `#f2ead8` | ≥15px table body |
| Gold display | `#e8bc6a` | Cinzel titles only |
| Gem chrome | `#3fd4a0` | Active nav, selected, focus |
| Order / Balance / Chaos | product triad | **Data labels only** |

---

## Anti-slop

- No hero funnel · no “Choose your relic” CTA stack · no feature-card garden  
- No gold active nav · no order-blue chrome · no Inter marketing  
- No Catalyst art · no gen-AI · no inventing unrevealed tiers  
- Data ≥15px · contrast ≥4.5:1 on stage · reduced-motion: color only ≤90ms  

---

## Frozen e2e strings (honor in mock)

- Brand `EQUILIBRIUM`  
- Nav: Overview · Map · Tasks · Build · Combat · Data  
- Footer trademark string present in shell footer  
- Region buttons: accessible name **starts with** display name; crests `alt=""`  
- `0/3` and `3/3` pick counters; 4th pick `aria-disabled="true"`; `Clear picks` always present  
- `section[aria-live]` region detail with sources line pattern  
- Map WebGPU-absent cue includes substring `no WebGPU`  

---

## Must-prove for CEO (axes)

| Axis | How Ridge hits 9+ |
|---|---|
| Recipe fidelity | Every route DNA present; Build owns Editorial+relic presentation |
| Public craft | Court stage reads premium companion, not console |
| Data readability | 15px tables, crest + name cells, secondary ladder |
| Operability | Pick regions, select T1 relic, filter tasks, sources inspector complete |
| Anti-slop | Honest placeholders; empty blessings; no fake math |
| Signature | Relic Court is unmistakable without breaking hybrid unity |

---

## R2 openers if scored under 9

- Wire real Jagex T1 icons **only** when they land under `public/game/`  
- Live-bind `loadConceptBuildProps()` instead of fixture effects (same copy source)  
- 3D wartable `next/dynamic` plate on Map if CEO demands motion  
