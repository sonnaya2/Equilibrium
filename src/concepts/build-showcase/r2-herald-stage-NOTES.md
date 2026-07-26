# R2 Herald Stage — craft notes

**Codename:** Share Stage  
**Route:** `/concepts/build-showcase/herald-stage`  
**Files:** `HeraldStage.tsx` + `.bs-herald-stage` block in `build-showcase.css`

## Thesis

Screenshot-ready share plaque first; full planner tools always operable underneath — no section tabs.

## Layout DNA

| Zone | Content |
|------|---------|
| Plaque | EQUILIBRIUM seal · all-region crest row (lit = unlocked) · official hex stamp (PNG) with monogram fallback · gold relic title · path ribbon · `N/3` · Clear picks · Copy share link |
| Tools | Full region pick grid · T1 relic row with hex icons · full 3×8 blessing lattice (path + god) |

Plate texture: thin `LEAGUE_ART.trophy` wash (soft-light, ~7% opacity). Seated relic may also wash portrait under the stamp.

## Operability

- `useShowcaseActions` → live `useBuild` (regions, T1 relic, blessing path, clear electives, share URL)
- Frozen: `Clear picks`, pick counter `N/3` or `…/3`
- Crests `alt=""`; gem for interactive/selected; gold for display titles only
- Mobile: column — plaque then tools stack

## Self-score (R2 rubric)

| Axis | Score | Note |
|------|------:|------|
| Identity (official art + League stone) | **22 / 25** | Hex PNGs + crest seals + trophy plate; monogram only as empty fallback |
| Operability (all systems one surface) | **24 / 25** | Regions + relics + full lattice + share — no tabs |
| Density | **17 / 20** | Plaque is airy on purpose for crop; tools pack tight |
| Shareability | **14 / 15** | Tall plaque crop reads on mobile/Discord |
| Anti-slop | **13 / 15** | Scoped CSS, no hero CTA, plate is texture not marketing |
| **Total** | **90 / 100** | |

## Diff from R1 Herald Card

R1 uses monogram-only stamp and next-path-only pickers. R2 stamps official hex art, shows full blessing lattice, and keeps every tool visible without a tools toggle.
