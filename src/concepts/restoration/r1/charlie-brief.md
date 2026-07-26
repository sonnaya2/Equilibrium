# Team Charlie · CINEMATIC — Restoration Round 1

**Agents:** charlie-design + charlie-build  
**Codename:** CINEMATIC  
**Mock:** `CharliePreview.tsx` · skin `charlie.css` (`.restoration-skin--charlie`)  
**Scope:** Concepts lab only — **no** production `globals.css` / `@theme` edits.

---

## Thesis

Jagex ArtStation environment richness as **product craft**, not a texture paste.

The site should feel like a top-studio **public game surface + tools hybrid**: atmospheric mid-dark chambers, premium carved materials, keyart teal-crystal gem chrome — without a marketing funnel, feature-card garden, or SaaS skeleton. Arm’s-length tables stay the product. Cinematic is depth and material, not mud and bloom.

**Mood only (never copy layout/wording):** Menaphos gold warmth, Anachronia canopy green depth, City of Um cool shadow pockets, Fort Forinthry timber edges, Sanctum of Rebirth chamber richness. Equilibrium **gem** is the sole interactive chrome (keyart teal crystal family). Gold is engraved display type only.

```
atmosphere void (not #000)
  → chamber shell
    → dark material rail
    → lit stage under data (mandatory)
    → raised selection / inspector cards
gem line + type = active   ·   gold = titles only   ·   15px table body
```

---

## Why this lane wins (or dies)

| Wins when… | Dies when… |
|---|---|
| Surfaces separate like lit stone and timber | Brown-on-brown mud fails the squint test |
| Public-site craft without a hero pitch | IDE / console aesthetic |
| Dense Control Surface DNA (tree · table · inspector) | Atmosphere becomes fog; body ink softens |
| Crests + real game art in rows | Rainbow “region palette” as chrome |
| Gem-only interaction | Gold active nav, order-blue buttons, glow-at-rest |

---

## Proposed token map (skin-scoped)

All values live under `.restoration-skin--charlie` custom properties. Production tokens are untouched.

### Surfaces — atmospheric mid-dark ladder

| Role | CSS var | Hex | Intent |
|---|---|---|---|
| Page void | `--rc-void` | `#12141a` | Cool-warm atmosphere chamber — **not** `#000`, not pure umber mud |
| Shell / nav | `--rc-shell` | `#181a1f` | Slightly lifted chamber wall |
| Tree + inspector rail | `--rc-rail` | `#1c1e24` | Deep material columns; still darker than stage |
| Table stage | `--rc-stage` | `#262a32` | **Mandatory** ground under dense data — mid material, scanable |
| Raised / selected / cards | `--rc-raised` | `#30353f` | Premium panel one step above stage |
| Zebra odd row | `--rc-zebra` | `#22262e` | Between stage and raised; no second accent |
| Inset fields | `--rc-inset` | `#15171c` | Inputs dig in — darker than rail |
| Border default | `--rc-border` | `#4a5348` | Material seam (Anachronia-moss stone edge) |
| Border strong | `--rc-border-hi` | `#5e6a5c` | Inputs, focus wells |
| Carve highlight | `--rc-carve` | `#6f7d6a` | Lit top rim on raised panels (polished edge) |
| Atmosphere wash | `--rc-haze` | `rgba(46, 203, 143, 0.04)` | Micro gem haze in void — not a glow blob |

### Ink — bright enough to punch mid materials

| Role | CSS var | Hex | Rule |
|---|---|---|---|
| Primary data | `--rc-parch-50` | `#f2efe6` | ≥15px table body / names |
| Secondary data | `--rc-parch-100` | `#ddd6c6` | Region cells, bright labels, thead |
| Meta / counts | `--rc-parch-300` | `#b8b0a0` | dt labels; never sole body ink |
| Captions | `--rc-parch-400` | `#9e9688` | Lab / quiet chrome only |
| Quiet | `--rc-parch-500` | `#878074` | Must still clear stage if used |

### Chrome / display (unchanged roles)

| Role | CSS var | Hex | Rule |
|---|---|---|---|
| Engraved title | `--rc-gold` | `#e0b264` | Brand + page `h1` only — **never** active |
| Gem active | `--rc-gem` | `#2ecb8f` | Tabs, tree leaf, row outline, key figure |
| Gem bright | `--rc-gem-bright` | `#57e0ae` | Selected label emphasis |
| Gem deep | `--rc-gem-deep` | `#1fa372` | Active border line |

Path triad (chaos / order / balance) is **data only** if shown — never chrome.

---

## Surface hierarchy

```
┌─ void #12141a (+ micro gem haze) ─────────────────────────────────────┐
│  ┌─ shell #181a1f ── brand gold · nav · gem-active tab ─────────────┐ │
│  │  ┌ rail #1c1e24 ─┐  ┌ stage #262a32 ────────────┐  ┌ rail ─────┐ │ │
│  │  │ system tree   │  │ filter + sticky thead     │  │ inspector │ │ │
│  │  │ gem leaf bar  │  │ 15px body · zebra         │  │ gold head │ │ │
│  │  │ crests        │  │ select → raised + gem     │  │ key ≥20px │ │ │
│  │  └───────────────┘  └───────────────────────────┘  └───────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

Depth method: hairline border + inset top carve (same law as product). Atmosphere is **stop separation + cool mid void**, not blur glass.

---

## Readability law (binding in this mock)

- Table body **15px** primary (`--rc-parch-50` on `--rc-stage`)
- Column heads **12px** bright (`--rc-parch-100`)
- Labels ≥ **11px**; key figure ≥ **20px** mono gem
- Sticky opaque thead on stage (not void)
- Zebra or hairline rows; selected = raised fill + gem outline
- Secondary cells use `--rc-parch-100`, never quiet 400/500 as body
- Fixture rows labeled as fixtures — no invented league facts as real

Contrast intent (meter before any ship): primary ink on stage and raised clears **≥4.5:1**. Mid-dark stage exists so ink does not fight a near-black void.

---

## Public-site craft (without sales)

| Do | Do not |
|---|---|
| Open on the workbench (tree · table · inspector) | Hero → three cards → CTA |
| Material depth that reads premium at rest | Glassmorphism / glow-at-rest / blur panels |
| Real region crests + game icons | Gen-AI art, invented icons |
| Gold brand mark + gold section titles | Gold as selected nav / button |
| One gem chrome accent | Rainbow region hues as UI chrome |
| Dense scannable catalog | Empty “coming soon” card gardens |

---

## Control Surface DNA (inherited)

Round 1 layout winner still applies: **tree selects · table lists · inspector holds selection**. CINEMATIC repaints atmosphere and material stops; it does not invent a new IA.

Map exception remains: do not force three columns over the 3D board — ledger owns picks.

---

## Explicit non-goals

- Pure void black `#000`
- Production `@theme` mutation this round
- EverSense pink / Print skin
- Order-blue interactive chrome
- SaaS desk overshoot (Raised Bench `#3a3024` warm mud) — Charlie uses cool-mid stone instead
- Gen-AI imagery
- Marketing funnel or feature-card landing

---

## Files

| Path | Role |
|---|---|
| `src/concepts/restoration/r1/charlie-brief.md` | This brief |
| `src/concepts/restoration/r1/charlie.css` | Scoped skin `.restoration-skin--charlie` |
| `src/concepts/restoration/r1/CharliePreview.tsx` | Client fixture: dense table + inspector |

---

## Hex summary (quick paste)

```
void    #12141a
shell   #181a1f
rail    #1c1e24
stage   #262a32
raised  #30353f
zebra   #22262e
inset   #15171c
border  #4a5348
carve   #6f7d6a
parch   #f2efe6 / #ddd6c6 / #b8b0a0
gold    #e0b264
gem     #2ecb8f / #57e0ae / #1fa372
```
