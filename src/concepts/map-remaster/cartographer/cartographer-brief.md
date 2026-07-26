# Team Cartographer — Cartographer's Desk

**Codename:** Cartographer's Desk  
**Agents:** carto-design + carto-build  
**Scope:** concepts lab only (`src/concepts/map-remaster/cartographer/`) — no production map / WebGPU edits  
**Pass bar:** 9.0 (most readable atlas screenshot)

---

## Thesis

Atlas readability over dungeon mood. The war table should read like a **working cartographer's desk**: parchment-lift land plates, **ink-dark coastlines**, rope-and-ivy on land borders, and a **wiki-dense three-band desk under the board**. CEO should plan a region pick from a still screenshot alone.

1. **Parchment land, ink coasts** — slabs wash toward paper grain; coasts are dark ink strokes, not soft fog.
2. **Selection without mint wash** — moderate plinth lift + thick ink outline + paper halo. Gem stays on chrome (nav, pins, focus rings), not as a region flood.
3. **Rope-and-ivy borders** — brown rope stem + green leaves along land coasts (west, south, north ridge, east seam). Subtle leaf sway. Not viewport ribbon chrome.
4. **Cartographic water** — hatch + animated wave polylines. Reads as charted sea, not teal glow blobs.
5. **Pin → parchment slip** — place markers open a sheet dossier *under* the board with content + unique drops (honest empty when none). Fixture-labeled.
6. **Three-band desk** — (1) Regions ledger with crests (2) Place dossier slip (3) Sources strip. Board ~70% height. No permanent third inspector column beside the board.

---

## Layout DNA

```
┌─ NAV  EQUILIBRIUM · Overview Map Tasks Build Combat Data · picks 1/3 ─┐
├─ thesis strip (cartographer · fixture) ───────────────────────────────┤
│                                                                       │
│   BOARD (~70%)                                                        │
│   · hatch/wave sea                                                    │
│   · 11 parchment slabs · ink coast                                    │
│   · focus: lift + ink outline                                         │
│   · rope-ivy on land borders                                          │
│   · pins → sheet                                                      │
│   · small compass (decorative)                                        │
│                                                                       │
├─ BAND 1  REGIONS  crest chips · keyboard ledger ──────────────────────┤
├─ BAND 2  PLACE DOSSIER  parchment side-slip · content | drops ────────┤
├─ BAND 3  SOURCES  sources? · verified fixture · trademark ────────────┤
└───────────────────────────────────────────────────────────────────────┘
```

---

## Interactive demo (required)

| Control | Behavior |
|---|---|
| Region slab click | Selects region; first pin in region opens if any |
| Region ledger chip | Same as slab; owns keyboard-accessible pick list |
| Place pin | Selects place; region follows; sheet animates in under board |
| Clear picks | Present; enabled when pick count &gt; 0 (fixture `1/3`) |
| Empty dossier | Regions without pins (most of map) show honest empty copy |

---

## Fixture honesty

- All places/drops from `../fixture.ts` only.
- Drop names already marked `(fixture)` / `illustrative only`.
- Sheet carries a `fixture` tag; sources band says `verified fixture`.
- No invented league numbers or live claim language.

---

## Anti-slop / craft law

- Editorial tokens only (`parch` / `stone` / `gold` / `gem`).
- Gold = brand + band titles. Gem = interactive active (nav Map, pins, focus-visible, pick count).
- No mint region wash, no SaaS glass, no marketing hero, no gen-AI art.
- Crests from `regionCrestPath` (wilderness → forinthry crest; menaphos has no crest file — chip text only).
- `prefers-reduced-motion` kills wave, leaf, and sheet animations.
- Shared classes (`map-remaster-*`, `mr-*`) used where they help; cartographer overrides kill shared mint focus glow.

---

## Files

| Path | Role |
|---|---|
| `CartographerPreview.tsx` | Interactive mock · export `CartographerPreview` |
| `cartographer.css` | Scoped `.carto` skin |
| `cartographer-brief.md` | This brief |

Arena mounts via `MapRemasterArena` → `./cartographer/CartographerPreview`.

---

## CEO sell (5 bullets)

1. **Readable at rest** — parchment plates and ink coasts beat mud-dark dungeon maps; grain and labels stay legible in a screenshot.
2. **Selection is ink, not mint** — lifted plate + dark outline frames the pick without washing the whole table gem-green.
3. **Vines earn their keep** — rope stem + leaf clusters ride *land* borders (west, south, north, east), not corner ribbons.
4. **Desk plans the run** — regions chips, pin slip with content/drops, and sources strip sit under a ~70% board like a wiki tool, not a side inspector.
5. **Honest fixture** — labeled drops, honest empties, trademark line; CEO can trust what the screenshot claims.
