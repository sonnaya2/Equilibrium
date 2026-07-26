# Team Delta · CRYSTAL — Round 1 brief

**Agents:** delta-design + delta-build  
**Codename:** Crystal  
**Skin class:** `.restoration-skin--delta`  
**Scope:** concepts lab only — no production `globals.css` edits

---

## Thesis

The 2026 keyart puts an **emerald/teal crystal mountain** at the vanishing point of the world. Equilibrium’s product mark is already a **gem hex**. CRYSTAL treats those as one identity system:

1. **Gem chrome is the only interactive accent** — full force on active nav, tabs, selection, focus, key figures. No half-muted green, no gold-as-active, no second chrome hue.
2. **Crystal mountain is the art anchor** — a thin keyart band (not a marketing hero) frames the workbench; the public site opens on tool + world, not a funnel.
3. **Modern public-site punch** — high-contrast data, crisp type hierarchy, arm’s-length tables. Warm RS stone stays the room; crystal cools the *edge*, not the entire desk into teal SaaS.
4. **Gold is engraved display only** — brand wordmark + page titles. Never nav fill, never buttons.

Not SaaS purple gradient. Not brown-on-brown mud. Not daylight landscape (Alpha). Not carved-stone museum (Bravo). Not atmospheric fog (Charlie). Not editorial magazine (Echo).

---

## Hex summary (token remaps under the skin)

Sampled from keyart crystal body/glow + Equilibrium gem mark. Warm parchment kept for scan. Surfaces stay league-dark with a **micro-cool void** so gem facets read as light, not mud.

| Token | Hex | Role |
|---|---|---|
| `--color-stone-950` | `#0a0e0d` | void — cool crystal night (not pure brown) |
| `--color-stone-900` | `#111614` | shell / rail |
| `--color-stone-850` | `#181e1b` | panel fill |
| `--color-stone-800` | `#1f2622` | table stage |
| `--color-stone-raised` | `#28322d` | selected / raised well |
| `--color-stone-zebra` | `#1a211e` | odd-row zebra |
| `--color-stone-inset` | `#0e1311` | input wells |
| `--color-stone-750` | `#3a554c` | default border — moss crystal edge |
| `--color-stone-carve` | `#4f8a74` | inset top-light (facet) |
| `--color-parch-50` | `#f0ebe0` | primary data body ≥15px |
| `--color-parch-100` | `#ddd4c0` | secondary body / bright headers |
| `--color-parch-300` | `#c4b9a0` | meta / counts |
| `--color-parch-400` | `#b0a48c` | quiet chrome |
| `--color-parch-500` | `#9a8f78` | quietest (captions only) |
| `--color-gem-200` | `#9af5d4` | facet highlight |
| `--color-gem-300` | `#4de8b8` | active bright / tree selected |
| `--color-gem-400` | `#26d4a0` | **chrome accent** (nav, focus, select) |
| `--color-gem-500` | `#14a87a` | fill / pips |
| `--color-gem-600` | `#0c7354` | deep / outline select |
| `--color-gold-300` | `#f3c97b` | display hi |
| `--color-gold-400` | `#e0b264` | **titles only** |
| `--color-gold-500` | `#a87c3c` | display lo |

Skin-only extras (not production `@theme`):

| Token | Hex | Role |
|---|---|---|
| `--delta-core` | `#06352f` | crystal mountain core (art strip shade) |
| `--delta-facet` | `#4de8b8` | facet edge / brand gem stroke |
| `--delta-glow` | `#26d4a0` | key figure / active underline |

Path triad (`chaos` / `order` / `balance`) **unchanged** — data semantics only.

---

## Material language

| Move | Rule |
|---|---|
| Panel depth | Single carved method: 1px border + **gem-tinted** top-light carve (not multi-shadow glass) |
| Selection | Gem outline / inset only when selected — **nothing glows at rest** |
| Brand mark | Equilibrium hex gem at full chrome; stroke `gem-400`, core `gem-500` |
| Keyart band | Thin crop of `public/brand/keyart-2026.jpg`, object-position toward crystal peak; no CTA, no slogan stack |
| Table law | Wiki Dense: 15px body, 12px bright headers, zebra, sticky opaque thead, gem row select |
| Type | Display (Cinzel) + gold for titles; sans body; mono tabular nums |

---

## Shell (R1 Control Surface DNA)

```
[ brand EQUILIBRIUM + gem ] [ Overview Map Tasks Build Combat Data ]
[ keyart band — crystal mountain crop — no hero copy ]
[ tree 220 | table flex | inspector ~300 ]
```

- Opens on **Data** workbench (tool first).
- Fixture rows only — labeled; never invent league numbers.
- Crests on region-bearing rows (game art density).

---

## Do / Don’t

**Do**
- Commit gem chrome fully on every interactive active state.
- Keep data ≥15px and ≥4.5:1 on stage.
- Show real keyart + region crests.
- Reduced-motion: no idle facet animation.

**Don’t**
- Purple/indigo SaaS gradients or glassmorphism stacks.
- Gold as active nav or button fill.
- Marketing hero → 3 cards → CTA.
- Cool-teal-wash the entire desk into a cyber dashboard.
- Gen-AI imagery (keyart file + game crests only).

---

## Ship map (if CEO picks Crystal)

1. Remap gem ramp + micro-cool void / moss border in `@theme` (or keep gem-only if surfaces stay production).
2. Promote facet top-light as optional `.panel` carve mix (documented exception).
3. Optional keyart strip on Overview only — never block map/combat.
4. No parallel token file in product; skin dies with the tournament.

---

## Self-score target (R1)

| Axis | Aim |
|---|---|
| Public site craft | 9 — art band + clean chrome, not IDE |
| RS art fidelity | 9 — keyart crystal + crests |
| Data readability | 9 — Wiki Dense floors |
| Anti-slop | 9 — no funnel / no purple / gold titles only |
| Equilibrium identity | 9.5 — gem chrome fully committed |
| Operability | 8.5 — frozen nav names, reduced-motion ok |
