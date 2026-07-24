---
name: equilibrium-ui
description: The RS3 Equilibrium visual system - the palette sampled from the in-game league panel and RuneScape DragonWilds key art, the gem-green chrome accent ruling, the hexagon lattice and shield-crest motifs, the game art pipeline, density floors, and the exceptions to no-slop-ui that are sanctioned for this product. Use before any UI, theme, CSS, component or copy work in this repo, and when a bot-audit finding needs adjudicating.
---

# Equilibrium visual system

This is the RS3 counterpart to `no-slop-ui` §5. That section's rulings were measured against
EverSense/NTE, a different product: its `#FD61A8` pink accent, its "all dark grounds are now
rejected" verdict and its "this codebase is not Tailwind" note describe that product, not this one.
Everything else in `no-slop-ui` still applies as law, and its bans still win over generic pretty
defaults.

**Product class:** game-world surface plus tool workbench. A free fan tool for players. Nothing is
sold, nothing converts.

## Palette, and where it came from

Measured, not recalled. Two sources, blended: the in-game Leagues II panel supplies the structure,
RuneScape: DragonWilds supplies the warmth.

DragonWilds key art (`WILheader.png`, pixel-bucketed): near-black `#060707` ground; dark olive
`#262817` / `#2a3418` / `#363717`; a saturated green ramp `#013801` to `#018700`; sunlit sand-gold
display type `#f3c97b`. DragonWilds gameplay stills average luminance 111 and saturation 0.50 with a
timber/earth ramp `#553d1d` to `#aa844a` across half the frame — the game itself is warm and bright,
not dark. The in-game Equilibrium panel supplies dark warm stone, a brass double-line frame,
parchment text, the teal gem, diamond progress pips, and the chaos-red / balance-green / order-blue
row triad.

```
surface  void #0d0a07 · deep #14100b · panel #1b1610 · raised #231d15
edge     line #332a1e · carve #463a29
ink      #efe7d5 · #d3c8b0 · #a2957a · #8b7f68
gem      #8ff0cd · #57e0ae · #2ecb8f · #1fa372 · #157a55
gold     #f3c97b · #e0b264 · #a87c3c
path     chaos #b5402f · balance #6fae45 · order #4a7ec2
ember    #e2622a
radius   2px, 4px
```

Tokens live in the `@theme` block of `app/globals.css` (Tailwind v4 is CSS-first, there is no config
file). Inline hex is a defect.

## The accent ruling

**Chrome accent is gem green.** Ground is warm umber (hue ~30°), accent is gem green (hue ~160°) —
130° apart, which keeps the accent able to punch. Warming the ground toward DragonWilds while keeping
brass as the accent would put both in the same hue family and cannibalise it, and it re-triggers the
"gold edge highlights on every panel" failure.

**Gold is engraved display ink only.** Headings and the brand mark. It never marks an interactive
state, an active nav item, or a selected row. That is the gem's job.

**The path triad is data, never chrome.** Order blue in particular must never reach a border, button
or active state — `no-slop-ui` bans blue as chrome, and it is only admissible here because it carries
a real game semantic.

**Ember is transition-only.** It appears inside the unlock sweep and never at rest, which keeps "one
chrome accent" strictly true.

Contrast is gated at 4.5:1 against the surface a token actually sits on. `#7a6f5b` was the original
faint ink and fails at 3.86:1 — `#8b7f68` replaced it at 4.87:1. Chaos `#b5402f` fails as text at
3.39:1, so it is a fill or marker; use `#d4614d` when chaos must be read as text.

## Motifs

The game gives us two distinct shapes and they mean different things. Keeping them separate is what
stops this reading as generic hex decoration.

- **Hexagon** is the lattice system: relic tiers, the 8×3 blessing lattice, the league gem, and the
  region-lock barrier. It is a layout grid, not a logo.
- **Shield crests** are region identity. The 11 real in-game crests live in `assets/rs3/regions/` and
  sit *inside* lattice cells.
- **Diamond pips** mark progress along a track, as the in-game progress bars do.
- **Timber slats with green crystal** is the locked state, lifted from the region-lock barrier.
- **Carved edge** is the single depth method: 1px `line` border with a 1px inset `carve` highlight.
  Not blur plus glow plus inset plus border at once.

## Sanctioned exceptions

Each of these trips a `no-slop-ui` or `bot-audit` pattern and is nonetheless correct here. Do not
strip them in a humanizer pass; the citation is the justification.

**Frosted unrevealed cells.** Blur on unrevealed relics and blessings reproduces how the game itself
renders them — the in-game Relics and Blessings tabs show unrevealed content blurred. This is the
§4.5 "prove it with a screenshot of the game" exemption, not glassmorphism-as-default. It also solves
a real problem: `blessings.json` has 8 tiers and zero revealed choices and `tasks.json` has zero
records, so any other treatment becomes the banned "COMING SOON" card grid. The lattice is the shape
of the choice, not a guess at its contents.

**Two material gradients.** A low-opacity top-light on lattice cells (the game's own hexes are
top-lit) and a repeating slat gradient for locked-cell timber. Both are world material, which §4.5
explicitly permits — the ban targets brand-chrome gradients on text, buttons and hairlines. No other
gradient is allowed, and never a div-painted scene faking key art.

**Dark ground.** Correct for this product. The "all dark grounds rejected" verdict is an NTE finding;
RS3's own league panel is dark and the Wiki's dark mode is the familiar register for this audience.

**Selection glow.** Permitted on the selected cell or marker. Nothing glows at rest.

## Density floors

`data-readability` is law equal to `no-slop-ui` on any data surface. Data values 14px working size and
13px absolute floor in the densest tables; labels 11px; the key number on a screen 20px+; mono with
`tabular-nums` for figures; at least 70% of a 1440p viewport is real content; no 40px+ voids inside a
working surface; related facts adjacent so the eye does not cross the viewport to join two facts about
one thing.

Density has to come from real records. Regions (11), relics (3 revealed choices) and blessings (0)
cannot carry a screen alone. `data/league/quests.json` has 281 records plus precomputed
`region_group_counts` and `primary_region_counts` histograms, and `data/research/catalog.json` is
157KB — lead with those.

## Art pipeline

Real game art is the identity; a game tool with no game art scores BUSTED on `bot-audit` sweep 5.
`assets/rs3/` holds 121 real PNGs and is not web-served, so art reaches the app through
`public/game/`. Generated art stays banned. When a crest sits inside a region button, it needs
`alt=""` or it changes the accessible name the e2e suite pins.

## Tournament ledger

Verdicts, so losses are not rebuilt.

- **Hex Lattice — shipped.** The hexagon as literal layout grid at three densities, real crests inside
  cells, locked cells behind timber-and-crystal barrier. Survives because cells read as carved stone
  rather than neon.
- **War Table — runner-up, in development as the 3D map.** A stage carrying real data. Its flat form
  failed on one hard fact: `public/map/league-map.jpg` is a screenshot of the game's own Regions tab,
  so it already carries Jagex's markers and every overlaid crest reads doubled. Raised per-region
  geometry replacing the flat plate is the way out.
- **Stone Ledger — scrapped.** Rail plus dense grid plus inspector. Passed every ban and had no
  identity; the Fribbels topology alone is not a visual direction.
- **Honeycomb offset harms tabular meaning.** The region hive interlocks, but the blessing lattice
  keeps aligned columns because the tier number above each column carries the meaning. Shape is the
  motif; the grid is the data.
