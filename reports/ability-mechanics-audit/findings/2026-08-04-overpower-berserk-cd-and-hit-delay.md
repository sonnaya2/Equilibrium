# Finding: Overpower Berserk CD + hit delay

| Field | Value |
|-------|--------|
| Status | **MISMATCH** (fixed) |
| Engine ids | `overpower`, `overpower_igneous` |
| Style | melee |
| Date | 2026-08-04 |
| HEAD base | `e505b7f53b15e47efeabd4dcdcee0c4f867e5ba1` |

## Evidence

1. **Wiki Berserk** (https://runescape.wiki/w/Berserk): while active, "Overpower: Cooldown reduced to 9s (15 ticks)". Added with Combat Style Modernisation (2 Mar 2026).
2. **Wiki Overpower** (https://runescape.wiki/w/Overpower): "Overpower hits 3 ticks after it was cast." Igneous hits are simultaneous.
3. Engine notes in `MELEE_EFFECTS` already claimed the 9s CD; runtime did not implement it.

## Runtime path (before)

- `applyCastCooldown` always used `ability.cooldownSeconds` (30) for Overpower.
- Spec hits had no `tickOffset` → land at cast tick.

## Reproduction

- Cast Berserk then Overpower; read `state.cooldowns.overpower`.
- Expected ready tick = cast + 15; actual was cast + 50.
- Overpower land events at cast+0 vs expected cast+3.

## Fix

- `BERSERK_OVERPOWER_COOLDOWN_SECONDS = 9` in `bloodlust.ts`.
- `applyCastCooldown`: when CD key is `overpower` and `berserkUntilTick > candidate`, use 9s.
- Spec hits: `tickOffset: 3` for base and both igneous hits.
- Tests: `bloodlust.test.ts` (CD), `abilities.test.ts` (offsets).

## Decision

Production fix applied. Static bands/adren/CD base remain wiki-matched (520-570 / 60% / 30s outside Berserk).
