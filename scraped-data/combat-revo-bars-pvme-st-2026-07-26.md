# PvME single-target Revolution bars (2026-07-26)

**Source:** https://pvme.io/pvme-guides/miscellaneous-information/revolution-bars/

**App scope:** single-target only (multi-target intentionally omitted).

## Configuring Revolution++ (page bottom)

For all bars that are **not** marked Basics only:

1. Toggle on **Auto-retaliate** next to the adrenaline bar
2. Settings → search `action bar`
3. Toggle on **Revolution Combat Mode**
4. **Automatically trigger** Basic + Threshold + Enhanced + Ultimate (all four)
5. Screenshot config: **Revolution size 14**, **Auto Attack off**

## Catalogue shipped in `data/combat/revolution-bars.json`

| id | Style | Kind | Slots |
|----|-------|------|------:|
| melee-two-handed | Melee 2h | Revo++ ST | 11 |
| melee-dual-wield | Melee DW | Revo++ ST | 10 |
| ranged | Ranged (Ful arrow) | Revo++ ST | 10 |
| magic | Magic (Exsanguinate) | Revo++ ST | 10 |
| necromancy | Necromancy | Revo++ ST | 11 |
| melee-basics | Melee | Basics only | 5 |
| ranged-basics | Ranged | Basics only | 3 |
| magic-basics | Magic | Basics only | 3 |
| necromancy-basics | Necromancy | Basics only | 5 |

Ability order decoded from PvME bar images (feature-matched / visual re-read against wiki ability icons). Conjure slots stay `abilityId: null` (unmodelled).

PvME page still carries a post-CSM “content outdated” banner; these bars are the current published ST recommendations on that guide.

---

## Re-verification (2026-07-26, pass 2)

**Method:** Re-read full bar PNGs under `scraped-data/pvme-revo/*.png` and per-slot crops under `id/*/`, compare to wiki ability icons (local `icons/` + fresh wiki downloads for Punish / Massacre / Dismember / Slaughter). Prefer high-confidence visual matches; no invented ability ids.

### Correction applied

| Bar | Slot | Was | Now | Confidence | Evidence |
|-----|-----:|-----|-----|------------|----------|
| `melee-two-handed` | 10 | Massacre | **Punish** | **High** | Slot crop = open palm + orange flame. Wiki **Punish** icon is the same art. Wiki **Massacre** (post-CSM 2026-03-02) = clenched fist + yellow 4-point starburst — not a match. **Slice** = silver dagger — not a match. |
| `melee-dual-wield` | 8 | Massacre | **Punish** | **High** | Same icon as 2h slot 10 / basics slot 4. |
| `melee-basics` | 4 | Massacre | **Punish** | **High** | Same icon. Also: Massacre is Enhanced (Dismember recast #3 post-CSM); a Basics-only row having Massacre was inconsistent; Punish is Basic. |

All three slots share one art identity; only ability id changed.

### Confirmed unchanged (high confidence)

**Melee 2h (11):** Chaos Roar, Meteor Strike, Rend, Berserk, Pulverise, Overpower, Greater Fury, Hurricane, Dismember, ~~Massacre~~ → **Punish**, Adaptive Strike  
**Melee DW (10):** Meteor Strike, Rend, Berserk, Greater Flurry, Overpower, Greater Fury, Dismember, ~~Massacre~~ → **Punish**, Adaptive Strike, Chaos Roar  
**Ranged ST (10):** Imbue: Shadows, Galeshot, Greater Death's Swiftness, Rapid Fire, Deadshot, Greater Ricochet, Corruption Shot, Snipe, Snap Shot, Piercing Shot  
**Magic ST (10):** Greater Sunshine (silhouette figure vs plain Sunshine), Asphyxiate, Greater Concentrated Blast, Omnipower, Tsunami, Combust, Corruption Blast, Sonic Wave, Dragon Breath, Greater Chain  
**Necro ST (11):** Conjure Undead Army (`null`), Death Skulls, Conjure Vengeful Ghost (`null`), Living Death, Conjure Skeleton Warrior (`null`), Soul Sap, Touch of Death, Sacrifice, Volley of Souls, Finger of Death, Bloat  
**Melee basics (5):** Rend, Adaptive Strike, Greater Fury, ~~Massacre~~ → **Punish**, Attack  
**Ranged basics (3):** Greater Ricochet, Piercing Shot, Ranged (auto)  
**Magic basics (3):** Greater Concentrated Blast, Dragon Breath, Sonic Wave  
**Necro basics (5):** three conjures (`null`), Touch of Death, Soul Sap  

### Residual uncertainty

| Item | Note |
|------|------|
| Slot art vs wiki chrome | PvME bar slots have dark frame + lower res; wiki icons are clean 120². High-contrast abilities (skulls, bows, chains, suns) still read cleanly. |
| Prior “Slice” weak match | Slot 10 previously matched Slice weakly in feature match; Slice is **not** in `abilities.json` and art is a silver dagger — **not** present on these bars. No change beyond Punish correction. |
| Dismember / Slaughter / Massacre sequence | Post-CSM (2026-03-02): Dismember → Slaughter → Massacre is one ability sequence (recasts). Bars correctly carry **Dismember** only for the bleed opener; separate Massacre slot was a misread, not a missing sequence step. |
| Conjures | Undead Army / Vengeful Ghost / Skeleton Warrior remain `abilityId: null` (not in engine model). |
| PvME freshness | Guide still shows post-CSM “content outdated” banner; images are still the published ST recommendations. |
| Multi-target bars | Intentionally out of scope for this catalogue. |

### Ability id policy

- Every non-null `abilityId` exists in `data/combat/abilities.json`.
- Sources remain PvME (`pvme.io` revo guide + per-bar image URLs).
- No Slice id invented.

### Image map (scraped)

| Bar | Image |
|-----|-------|
| melee-two-handed | `scraped-data/pvme-revo/melee-st-2h.png` · https://img.pvme.io/images/4GRVbRCIrH.png |
| melee-dual-wield | `scraped-data/pvme-revo/melee-st-dw.png` · https://img.pvme.io/images/j0dgYXvsJu.png |
| ranged | `scraped-data/pvme-revo/ranged-st.png` · https://img.pvme.io/images/KmRIXlvu9H.png |
| magic | `scraped-data/pvme-revo/magic-st.png` · https://img.pvme.io/images/bhR6hl4v5i.png |
| necromancy | `scraped-data/pvme-revo/necro-st.png` · https://img.pvme.io/images/W1aR6C8RKQ.png |
| melee-basics | `scraped-data/pvme-revo/melee-basics.png` · https://img.pvme.io/images/MkYI07ZGxg.png |
| ranged-basics | `scraped-data/pvme-revo/ranged-basics.png` · https://img.pvme.io/images/rOeskZlbkA.png |
| magic-basics | `scraped-data/pvme-revo/magic-basics.png` · https://img.pvme.io/images/3GjyY2BiZQ.png |
| necromancy-basics | `scraped-data/pvme-revo/necro-basics.png` · https://img.pvme.io/images/d22p6ur7lj.png |
