# Team Orbit · Board Sky — Hybrid Composition Round 1

**Agents:** orbit-design + orbit-build  
**Codename:** Board Sky  
**Mock:** `OrbitPreview.tsx` · skin `.hybrid-skin--orbit` in `orbit.css`  
**Scope:** concepts lab only — no production `globals.css` edits. No gen-AI.

---

## Thesis

The **Map is the product’s sky.** Everything else is ground control under Editorial stone.

A player opens Equilibrium to plan three regions under a living board — not a spreadsheet with a map tab bolted on. Orbit ships that hierarchy: a **tall 3D-top board zone** (mock structure labeled for MapLoader parity), a **ledger that owns all pick a11y** (`N/3`, `Clear picks`, region buttons with crest + name-first accessible names), and **no RegionInspector**. Detail never steals height from the sky.

Other routes honor the **fixed hybrid recipe** without diluting the signature:

| Route | DNA (recipe) | Orbit execution |
|---|---|---|
| Colors | Editorial | Full warm umber void · gem chrome · gold display only |
| Overview | Daylight | Courtyard gate · keyart aperture · standing picks · plan ledger |
| Map | Editorial 3D-top · **no inspector** | Board Sky masterpiece · ledger only · focus strip in ledger |
| Tasks | Crystal × Data | Facet tier rail + wiki-dense table + slim crystal inspector |
| Build | Editorial | Segment strip · crest lattice · pick counter · Clear picks |
| Combat | Crystal + Editorial | Facet style desk · Editorial chrome · honest empty calc bay |
| Data | Lattice + Editorial + Daylight browse · **full sources inspector** | 3-col lattice · Daylight browse plate · SourceReference block complete |

---

## Angle (from teams.ts)

> Map 3D-first Editorial gazetteer; ledger a11y without inspector bloat.

**Board Sky law:**

1. Board column is **majority height and majority width**. Ledger is instrument, not stage.
2. **Zero third column** on Map. Focused region lives as a **ledger focus card**, not an inspector rail.
3. Pick contracts frozen for e2e parity: literal `0/3` / `3/3`, `Clear picks` always present, fourth pick `aria-disabled="true"` (still focusable), region button accessible name **starts with** display name, crests `alt=""`.
4. Atmosphere is keyart + carved stone + terrain plates — **no blue horizon chrome**, no SaaS funnel, no marketing hero CTA.

---

## Layout DNA

### Shell (all routes)

```
┌─ MAST (Editorial shell · gold EQUILIBRIUM · gem-active nav) ─────────┐
│  Overview  Map  Tasks  Build  Combat  Data                           │
├─ ROUTE STAGE (fills remaining height) ───────────────────────────────┤
│  …per-route DNA below…                                               │
└──────────────────────────────────────────────────────────────────────┘
```

### Overview · Daylight

```
┌─ Lintel: Courtyard plan ─────────────────────────────────────────────┐
│  Standing picks │ Keyart aperture (fort gate) │ Milestones            │
├─ Courtyard desk ─────────────────────────────────────────────────────┤
│  Plan ledger (dl) · next board actions · fixture honesty note        │
└──────────────────────────────────────────────────────────────────────┘
```

Keyart is **architecture** (`/brand/keyart-2026.jpg`), not a pitch strip. Status chips are **data** (picks / tasks / catalog / blessings empty).

### Map · Board Sky (signature)

```
┌─ Ledger (~220px) ────────┬─ Tall board zone (minmax 0,1fr) ──────────┐
│  Picks N/3               │  "3D board" structure (MapLoader-shaped)  │
│  Clear picks             │  terrain plate · crest markers · sky veil │
│  11 region buttons       │  no inspector · no third column           │
│  Focus card (inline)     │  fills remaining viewport height          │
└──────────────────────────┴───────────────────────────────────────────┘
```

### Tasks · Crystal × Data

```
┌─ Facet tier rail ──┬─ Wiki table (15px) ──┬─ Crystal note panel ─────┐
│  All / Easy / …    │  sticky head · zebra │  points key · provisional│
└────────────────────┴──────────────────────┴──────────────────────────┘
```

### Build · Editorial

```
Segments: Regions | Relics | Blessings
Stage: crest pick lattice · N/3 · Clear picks · 4th aria-disabled
Relics/Blessings: honest empty (unrevealed)
```

### Combat · Crystal + Editorial

```
Quick | Setup | Analysis | Rotation
Facet style chips + generic target · result bay empty until bind
No invented DPL / hit-cap numbers
```

### Data · Lattice + Daylight browse + full sources

```
Tabs: Browse | Progression | Unlocks | Systems
┌─ Tree rail ──┬─ Stage table ──┬─ Inspector ──────────────────────────┐
│  crest/skill │  filter · 15px │  gold title · key figure · FULL       │
│  leaves      │  Daylight band │  SourceReference list (label, kind,  │
│              │  on Browse     │  verifiedAt, note) · sources? line   │
└──────────────┴────────────────┴──────────────────────────────────────┘
```

---

## Token contract (Editorial)

Scoped under `.hybrid-skin--orbit` only. Bridges to shared `--color-*` so arena shells and `GameIcon` rows stay consistent without touching production theme.

| Role | Use |
|---|---|
| Gold | Brand + engraved titles only |
| Gem | Active nav, selected rows, key figures, focus rings |
| Parch ladder | Body / secondary / meta scan ink |
| Stone ladder | Void → shell → rail → stage → raised → inset |
| Order / Chaos / Balance | Data semantics only — never chrome |

Crystal accents appear **only** on Tasks and Combat surfaces (facet panels, moss-edge where the recipe calls for Crystal DNA). They do not recolor the Editorial product spine.

---

## Fixture honesty

- All catalog rows labeled **Fixture** / **demo**.
- Tasks marked **Provisional** (Catalyst stand-in until Equilibrium list publishes).
- Blessings / Relics remain **empty** until official reveal.
- Combat result bay: **Awaiting calc bind** — never fake DPL.
- Sources use plausible `verifiedAt` dates as **fixture provenance**, not live scrape claims.

---

## Anti-slop checklist

- [x] No SaaS funnel / feature-card garden / “Join thousands”
- [x] No gen-AI imagery — real crests, terrain, keyart only
- [x] No gold on interactive selected chrome
- [x] No order-blue horizon as brand chrome
- [x] No RegionInspector on Map
- [x] Table body ≥15px · sticky opaque thead · zebra
- [x] Frozen strings: `EQUILIBRIUM`, six nav links, `Clear picks`, `N/3`, region name-first buttons

---

## CEO axes self-target (aim 10 — earn it)

| Axis | Orbit bet |
|---|---|
| Recipe fidelity | Per-route DNA explicit in CSS modifiers + pane structure |
| Public craft | Daylight gate + Board Sky atmosphere; companion site, not console |
| Data readability | 15px tables, contrast ladder, full sources inspector |
| Operability | Live picks shared Map/Build/Overview; Data 3-col fully interactive |
| Anti-slop | Fixture labels, empty honesty, gem/gold law |
| Signature | Map without inspector is unmistakable Board Sky |

Pass bar **9.0**. No fake 10 — execution must hold under hardass review.
