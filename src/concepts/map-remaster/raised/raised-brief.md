# Team Raised — Raised Court

**Codename:** Raised Court  
**Agents:** raised-design + raised-build  
**Pass bar:** 9.0 (map remaster tournament)

## Thesis

The board is a **theatre, not a flat atlas**. One region takes the stage — tall plinth, hard spotlight, bright stone. Everyone else recedes toward a **dark reflective sea** with a visible swell. Frontiers grow **thick hedge vines** (volume, not neon wire). Place markers are **vertical steles**; a click opens a **floating bottom dossier bar** — never a permanent side inspector.

```
dark reflective sea ──► land slabs near waterline
                        │
                        └─ focus region ──► tall plinth (~3× lift) + spotlight
frontier (locked | unlocked) ──► chunky 3D hedge volume
both unlocked ──► hedge thins / recedes (open court language)
stele pin ──► court dossier bar (crest · content · drops)
```

## Must sell (demo)

| Beat | Execution |
|------|-----------|
| Dramatic elevation | Focus slab lifts ~3× a subtle hover; others sit near the waterline when something is selected |
| Reflective water | Multi-layer dark sea + animated swell + land reflection sheen — reads as water at rest |
| Volume vines | Thick tube/leaf CSS+SVG hedges on **land borders**, not viewport frame ribbons |
| Receding vines | Segments between two unlocked regions thin and desaturate |
| Stele pins | Tall markers on places; open floating **court dossier** bar |
| Board primacy | Board ≈ full viewport; ledger = compact crest/name row (real buttons) |
| Overview legibility | With **no selection**, all 11 regions stay bright enough and labeled |
| UI shell | Mock nav + picks `N/3`; no third inspector column |
| Honesty | Fixture labels on drops/content; no invented league facts as real |

## Layout DNA

```
┌─ NAV  EQUILIBRIUM · Overview Map* Tasks Build Combat Data · 1/3 Clear ─┐
├─ LEDGER strip  [crest Misthalin] [Asgarnia] … 11 region buttons         │
├─ COURT BOARD (flex:1 · almost full height)                              │
│   · dark reflective water (animated swell)                              │
│   · 11 region slabs (perspective war table)                             │
│   · hedge vines on locked frontiers                                     │
│   · vertical stele place pins                                           │
│   · spotlight cone on focus                                             │
└─ DOSSIER BAR (transient, bottom float when pin open)                    │
     crest header · place name · content list · drops grid · close        │
```

**Not Board Sky clone:** Daylit owns noon warmth; Boardsky owns pure stack fidelity. Raised Court owns **theatre height + dark sea + floating dossier**.

## Selection model

- **Ledger button** → select / reselect region focus (also toggles pick when under cap).
- **Slab click** → focus region only (does not steal ledger a11y for picks).
- **Stele pin** → opens dossier for that place; focuses parent region.
- **Nothing selected** → all slabs at “court overview” height; labels readable; water still present but land is not drowned.
- **Something selected** → focus rises on a thick plinth; non-focus dim toward the sea (not mint-wash, not total blackout — multi-region comparison stays possible).

## Materials (Editorial tokens)

- Void / sea: deep umber-teal (`stone-950` + ink teal layers)
- Land: region `tone` with stone grain, raised carve edge
- Gem: interactive only (ledger pressed, pin active, close/chrome)
- Gold: display titles only (dossier place name, nav brand)
- Path triad: not used as chrome

## Vines (volume law)

Hard-fail if sold as flat ribbon frame. Each hedge is:

1. **Trunk extrusion** — stacked rounded bars with depth shadow  
2. **Leaf clusters** — SVG ellipses / CSS blobs along the run  
3. **Border-anchored** — positioned on slab edges / between neighbor pairs  
4. **State** — full mass when either side locked; `is-open` class thins mass when both unlocked  

## Dossier (court bar)

Transient floating bar at board bottom (or shell bottom), not a layout column:

- Crest-style header (region crest + place name in gold display)
- Content rows (kind · name) from fixture
- Drops grid — honest empty state when none; fixture-labeled when present
- Close control (gem chrome)

## Anti-slop / hard fails to avoid

- Permanent side inspector  
- Flat neon “vines” in viewport corners  
- Gen-AI art / photo plate as the table albedo  
- Unreadable dark board (overview must keep all 11 legible)  
- Invented drop tables presented as real league data  
- three.js (CSS/SVG mock only in this lab)

## Ship read

Would a player remember **“the raised court”** after one session? If the selected land does not feel like a stage over dark water, we failed the codename.
