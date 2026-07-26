# Team Echo · EDITORIAL — Restoration Round 1

**Agents:** echo-design + echo-build  
**Codename:** EDITORIAL  
**Mock:** `EchoPreview.tsx` · skin `.restoration-skin--echo` in `echo.css`  
**Scope:** concepts lab only — no production `globals.css` edits.

---

## Thesis

A **top-end editorial game companion** — art-stage energy from the 2026 keyart, refined type hierarchy, and dense scannable data underneath. Looks like a senior product designer and senior FE shipped it together: magazine craft on the masthead, wiki-grade tables on the work surface.

Not a SaaS landing. Not a feature-card garden. Not “Join thousands.” Opens on **real data patterns** (picks, sources, fixture catalog). Gem = active chrome only; gold = engraved display only.

---

## Bias (from teams.ts)

Marketing-site **craft** without SaaS funnel. Steal the lesson from high-end brand renewals and ArtStation presentation discipline: stage the world, then put the tool in the reader’s hands.

---

## References (mood, not clones)

| Source | Steal | Leave |
|---|---|---|
| 2026 keyart (`/brand/keyart-2026.jpg`) | Daylight landscape plate as **art stage**; emerald crystal mountain as identity echo | Full marketing hero with CTA stack |
| Jagex ArtStation / brand renewal | Material confidence, quiet luxury of type + plate, arm’s-length polish | Layout clones; gen-AI fillers |
| RS Wiki dark mode | Density, sticky heads, secondary-cell ladder | Utilitarian zero-art chrome |
| Equilibrium production tokens | Gem / gold / stone / parch roles | Random new accent families |

---

## Layout DNA

```
┌─ ART STAGE (keyart plate · ~200px · gradient into void) ─────────────┐
│  brand mark (gold Cinzel) · kicker · status chips (data, not pitch)   │
├─ NAV (six links · gem active · hairline rule) ───────────────────────┤
│  [tree / filters] │  STAGE: sticky table 15px · zebra · crests       │
│                   │  inspector: gold title · key ≥20px · sources     │
└─────────────────────────────────────────────────────────────────────┘
```

- **Art stage is atmosphere**, not a pitch billboard. No primary CTA. No three feature cards.
- **Workbench fills height** after the stage — Control Surface lesson without IDE austerity.
- Fixture rows labeled **fixture** — never invent league numbers.

---

## Type hierarchy (editorial)

| Role | Spec | Ink |
|---|---|---|
| Brand / page display | Cinzel, uppercase, tracking ~0.16em, 22–28px | gold-400 |
| Section / inspector title | Cinzel, uppercase, tracking ~0.12em, 13–15px | gold-400 |
| Nav active | 13px medium | gem-300 |
| Nav idle | 13px | parch-100 |
| Table body | 15px / 1.4 | parch-50 |
| Table secondary | 15px | parch-100 |
| Table headers | 12px uppercase tracking 0.06em | parch-100 |
| Meta / captions | 11–12px | parch-300 |
| Key figure | mono 22px tabular | gem-400 |

No Inter landing. No pure-white display. No gold on selected controls.

---

## Surface + hex summary (skin tokens)

Scoped under `.restoration-skin--echo`. Deeper void under the plate so keyart pops; stage still league-dark (not SaaS desk).

| Role | Token | Hex |
|---|---|---|
| Void | `--echo-void` | `#0a0806` |
| Shell / mast | `--echo-shell` | `#100e0b` |
| Rail | `--echo-rail` | `#16120e` |
| Stage (table ground) | `--echo-stage` | `#1f1912` |
| Raised / hover | `--echo-raised` | `#2a231b` |
| Zebra | `--echo-zebra` | `#18140f` |
| Inset | `--echo-inset` | `#12100c` |
| Border | `--echo-border` | `#4a3d2c` |
| Carve | `--echo-carve` | `#6a563e` |
| Body ink | `--echo-parch-50` | `#f1e9d6` |
| Secondary | `--echo-parch-100` | `#e0d4b8` |
| Meta | `--echo-parch-300` | `#c4b59a` |
| Quiet | `--echo-parch-400` | `#a8987c` |
| Display gold | `--echo-gold` | `#e0b264` |
| Gem active | `--echo-gem` | `#2ecb8f` |
| Gem bright | `--echo-gem-bright` | `#57e0ae` |
| Gem deep | `--echo-gem-deep` | `#1fa372` |

Depth method unchanged: 1px border + 1px inset carve. Stage veil under keyart is a vertical gradient only (plate → void), not a brand rainbow.

---

## Anti-slop contract

- No hero funnel · no feature-card garden · no “Join / Get started” CTAs  
- No Inter / indigo / glassmorphism defaults  
- No gold active nav · no order-blue chrome · no EverSense pink  
- No gen-AI art — only `/brand/keyart-2026.jpg` + `public/game/` crests  
- Data ≥15px body, ≥4.5:1 on stage · reduced-motion: no plate pan, transitions ≤90ms color only  

---

## Operability (R1 proof)

- Keyboard-focusable nav / tree / rows (gem focus ring)  
- Row selection drives inspector (name, region crest, key figure, sources line)  
- Filter narrows fixture catalog  
- `prefers-reduced-motion` respected in skin  

---

## Must-prove for CEO axes

| Axis | How Echo proves it |
|---|---|
| Public site craft | Art stage + type discipline reads “shipped brand site,” not IDE |
| RS art fidelity | Real 2026 keyart plate + region crests in table/inspector |
| Data readability | Wiki Dense table law under editorial masthead |
| Anti-slop | Opens on picks/status + catalog — zero SaaS garden |
| Equilibrium identity | Gem chrome · gold titles · crests |
| Operability | Interactive filter, selection, focus rings |

---

## Round 2 open if scored under 9

- Dial stage hex if CEO calls desk-brown  
- Crest density on tree leaves (not only name cells)  
- Optional Build segment strip under same skin (no new palette)
