# War Court (R2) — craft notes

**Codename:** Open Relic Court  
**Export:** `WarCourt` from `WarCourt.tsx`  
**Scope:** no section tabs — regions, relics, blessings, share actions on one surface.

## Layout
1. Mast — title, `N/3` / `…/3`, Copy link, Clear picks  
2. Main band — region crest grid | relic hex choices + T1–T7 rail | portrait detail + effects  
3. Full-width blessing lattice (Order/Chaos/Balance × 8 tiers, God ★ at 4 & 8) + Reset  

Atmosphere: desaturated `LEAGUE_ART.relicMenu` underlay; empty detail can show plate grain.

## Operability
- Live `useShowcaseActions` → same store as production Build / Map  
- Regions: electives via `canSelectElective`; fixed regions display-only on  
- Relics: PNG hex via `relicIcon()`; monogram only if icon missing; unrevealed tiers frosted lock cells  
- Blessings: `pickBlessing` / `resetBlessings` / `godTierAlignments`; empty reveals still plan-ahead  

## Self-score (craft pass)
| Axis | /10 | Note |
|---|---|---|
| Identity | 9 | Real crests, wiki hex icons, official portrait splash, carved stone court |
| Operability | 9 | All three systems + share/clear/reset without tabs |
| Density | 8.5 | Three-column war table + lattice; mobile stacks regions→relics→blessings |
| Shareability | 8 | Mast actions always visible; screenshot reads as full plan |
| Anti-slop | 9 | No hero CTA, no COMING SOON, gem chrome / gold titles / path triad on data |

**Overall ~8.7** — premium war table, concept-ready for CEO compare with Dossier Board / Herald Stage.
