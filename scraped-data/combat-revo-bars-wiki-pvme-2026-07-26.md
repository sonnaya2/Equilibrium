# Combat revo bars: Wiki vs PvME (audit 2026-07-26)

Updated after product decision: **PvME single-target is primary for the app.** Multi-target omitted for simplicity.

---

## Verdict (current product)

| Source | Role in Equilibrium |
|--------|---------------------|
| **PvME** [Revolution Bars](https://pvme.io/pvme-guides/miscellaneous-information/revolution-bars/) | **Primary bar layouts** for the app (single-target Revo++ + Basics only). Orders decoded from official bar PNGs + wiki icon match. |
| **RuneScape Wiki** | Mechanics reference (revo size, ability types); optional cross-check. Not the app catalogue. |

**App scope:** single-target only. Multi-target PvME/wiki bars are intentionally not shipped.

### Configuring Revolution++ (PvME page bottom — product config)

For all bars that are **not** Basics only:

1. Auto-retaliate **on**
2. Revolution Combat Mode **on**
3. Automatically trigger **Basic + Threshold + Enhanced + Ultimate**
4. Revolution size **14** (screenshot)
5. Auto Attack **off**

### Catalogue (`data/combat/revolution-bars.json`)

| id | Kind |
|----|------|
| `melee-two-handed` | PvME ST Revo++ (11) |
| `melee-dual-wield` | PvME ST Revo++ (10) |
| `ranged` | PvME ST Revo++ Ful arrow (10) |
| `magic` | PvME ST Revo++ Exsanguinate (10) |
| `necromancy` | PvME ST Revo++ (11) |
| `melee-basics` / `ranged-basics` / `magic-basics` / `necromancy-basics` | PvME Basics only |

Detail + image IDs: `scraped-data/combat-revo-bars-pvme-st-2026-07-26.md`.

---

## Caveats

- PvME still shows a post-CSM “content outdated” site banner; the revo channel is the published recommendation the user selected.
- Bars are **image-only** on PvME — order provenance is icon match to wiki ability art, not scrapeable text lists.
- Wiki [Revolution/Bars](https://runescape.wiki/w/Revolution/Bars) remains useful for multi-target / levelling if the app expands later.
- Still-valid process tips (either source): revo size 1–14; empty slots skipped free; revo++ = all four ability types; learning path to full manual for hard PvM.
