# Team Prism · FACET DESK — Hybrid Composition R1

**Codename:** Facet Desk  
**Agents:** prism-design + prism-build  
**Skin:** `.hybrid-skin--prism` in `prism.css`  
**Preview:** `PrismPreview.tsx`  
**Scope:** concepts lab only — **no** production `globals.css` / `@theme` edits.

---

## Fixed recipe (must hit)

| Slot | DNA | Prism execution |
|---|---|---|
| Colors | Editorial | Echo-line warm void/stage ladder, magazine mast + gold display |
| Overview | Daylight | Courtyard gate: standing picks · keyart aperture · milestones |
| Map | Editorial + 3D top, **no inspector** | Crest wartable stage + pick ledger strip; no right rail |
| Tasks | Crystal × Data | **Twin of Data** — same lattice tabs · daylight crest rail · facet chips · full source inspector |
| Build | Editorial + Jagex relic icons | Regions crests + progression icons when revealed; blessings empty |
| Combat | Crystal main, Editorial accents | Facet style chips, empty DPL bay, editorial chrome frames |
| Data | Lattice + Editorial + Daylight browse + **full source inspector** | Category lattice tabs · crest browse rail · facet filters · right panel dumps **every field + every source** |

Hard fail if Data inspector only shows a sources count line. Hard fail if Tasks is a thin checklist while Data is a workbench.

---

## Thesis

**Data and Tasks are the same desk cut twice.** One lattice, one daylight crest rail, one crystal facet chip row, one full-field source inspector on the right. Players who live in the catalog should feel zero mental model switch when they flip to tasks.

Prism signature is **operable twin density**, not a new palette story. Editorial colors are the room; Crystal is the **facet** of every chip/filter edge; Daylight is the **browse rail** language (crests standing like courtyard posts).

```
┌─ EQUILIBRIUM  Overview  Map  Tasks  Build  Combat  Data ─────────────┐
│  Lattice tabs (category)                                              │
│  ┌ Daylight crest rail ┐  ┌ Stage table 15px ─┐  ┌ Facet inspector ─┐ │
│  │ all 11 regions      │  │ sticky thead      │  │ ALL fields       │ │
│  │ gem selected leaf   │  │ zebra · select    │  │ ALL sources      │ │
│  │                     │  │ facet chip filters│  │ url·title·date·ty│ │
│  └─────────────────────┘  └───────────────────┘  └──────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

Tasks reuses this exact three-column DNA. Toolbar density matches: filter chips, row counts, mono points, provisional tag.

---

## Source inspector contract (non-negotiable)

Selected record right panel **must** show:

1. Gold display title + region crest  
2. Every scalar field on the fixture (id, kind, status, region, qty/points, notes, tags, provisional flag)  
3. **Sources block** — not a single provenance string. Each source is a card/row with:
   - `title`
   - `url` (literal, linkable in fixture)
   - `verifiedAt` (ISO date string, pattern-friendly)
   - `sourceType` (wiki | official | community | fixture)
4. Fixture label when demo data — never present as published Equilibrium truth

If a record has multiple sources, list **all** of them. Empty sources = honest empty list, not invented refs.

---

## Tokens (Editorial spine)

Scoped under `.hybrid-skin--prism`. Bridge to shared `--color-*` names so preview markup stays portable.

| Role | Token | Hex |
|---|---|---|
| Void | `--prism-void` | `#0a0806` |
| Shell | `--prism-shell` | `#100e0b` |
| Rail | `--prism-rail` | `#16120e` |
| Stage | `--prism-stage` | `#1f1912` |
| Raised | `--prism-raised` | `#2a231b` |
| Zebra | `--prism-zebra` | `#18140f` |
| Inset | `--prism-inset` | `#12100c` |
| Border | `--prism-border` | `#4a3d2c` |
| Carve | `--prism-carve` | `#6a563e` |
| Body | `--prism-parch-50` | `#f1e9d6` |
| Secondary | `--prism-parch-100` | `#e0d4b8` |
| Meta | `--prism-parch-300` | `#c4b59a` |
| Quiet | `--prism-parch-400` | `#a8987c` |
| Gold | `--prism-gold` | `#e0b264` |
| Gem | `--prism-gem` | `#2ecb8f` |
| Gem bright | `--prism-gem-bright` | `#57e0ae` |
| Gem deep | `--prism-gem-deep` | `#1fa372` |
| Facet edge | `--prism-facet` | `#4de8b8` |
| Facet core | `--prism-facet-core` | `#06352f` |

Gem = interactive only. Gold = engraved titles only. Path triad data-only if shown.

---

## Route notes

### Overview — Daylight

Courtyard gate architecture (Alpha lesson): west standing picks with real crests, center keyart aperture (`/brand/keyart-2026.jpg`), east milestones (`n/3`, task done/total, catalog count, blessings unrevealed). Desk ledger under gate. No marketing CTA.

### Map — Editorial 3D-top, no inspector

Full-width crest board as wartable stand-in. Pick counter live. Focus highlight on crest tiles. **No right inspector column** — detail is a thin bottom ledger strip only (a11y region name + pick state). Production 3D remains fenced in `app/map/`.

### Tasks — twin desk

Lattice-ish status segments + region crest rail + facet chips (All / Open / Done / Locked / Provisional) + 15px table + full source inspector. Catalyst stand-in rows labeled provisional. Points are fixture/demo when not from published list.

### Build — Editorial + relic art

Segments Regions · Relics · Blessings. Live `n/3` picks, 4th `aria-disabled`, Clear picks. Relic strip uses real `public/game/upgrades/` icons where present; unrevealed tiers stay empty copy. No invented relic effects.

### Combat — Crystal main

Segment Quick · Setup · Analysis · Rotation. Facet style chips with style icons. Empty DPL / hit-cap bay — structured vacancy, never fake numbers. Editorial panel frames.

### Data — Lattice + full sources

Category lattice tabs (Browse · Progression · Unlocks · Systems · Sources). Daylight crest rail filters by region. Facet chips filter kind/status. Inspector dumps full fields + multi-source list.

---

## Interaction law

| Control | Idle | Active |
|---|---|---|
| Nav | parch-100 | gem-400 + gem underline — never gold |
| Lattice tab | transparent | gem border + gem-300 text |
| Crest rail leaf | parch-100 | left gem bar + gem-300 |
| Facet chip | stone border | gem outline + facet top-light |
| Table row | zebra | raised + gem inset outline |
| Focus | — | gem 1px / 2px offset |

`prefers-reduced-motion`: no idle facet shimmer; transitions ≤90ms color only.

---

## Anti-slop

- [ ] No hero → cards → CTA  
- [ ] No invented league / blessing / DPL numbers  
- [ ] No gen-AI art — keyart + `public/game/` only  
- [ ] No gold active nav  
- [ ] No EverSense pink / Print  
- [ ] Fixture rows labeled fixture / provisional  
- [ ] Tasks density matches Data (hard Prism signature)  
- [ ] Source inspector lists url · title · verifiedAt · sourceType for **each** source  

---

## Self-score target (CEO hardass)

| Axis | Aim | Proof |
|---|---|---|
| Recipe fidelity | 9.5+ | Every recipe slot visibly executed |
| Public craft | 9+ | Editorial mast, not console |
| Data readability | 9.5+ | 15px tables, full source dump scannable |
| Operability | 9.5+ | Live picks, twin desks, multi-source inspector |
| Anti-slop | 9+ | Checklist clean |
| Signature | 10 | Twin Facet Desk unmistakable |

Pass bar 9.0. GO FOR 10.
