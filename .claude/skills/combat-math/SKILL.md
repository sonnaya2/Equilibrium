---
name: combat-math
description: RS3 combat engine math for this repo - Damage Potential, the 2026 logarithmic Damage Per Level curve, the layered crit model, hit caps as per-effect metadata, Basic/Enhanced/Ultimate/Utility categories, adrenaline as data, per-style state (Bloodlust, ranged on-hit, Runic Charge and burns, Necromancy souls), the ordered modifier pipeline, and intermediate rounding rules. Use before writing, reviewing, or debugging anything under src/combat/, and when verifying a combat number against the RuneScape Wiki or RS Analysis.
---

# Combat math (current-game RS3)

`AGENTS.md` is authoritative. This is the working mental model for `src/combat/`.

## The game you are modelling

Current RS3, meaning everything from the **4 Mar 2024 Core Combat Update** through the **2 Mar 2026
Combat Style Modernisation** and every patch after it. The 2024 RS Analysis paper is foundational
research, not the current spec. 2 Mar 2026 is not the final patch either - individual abilities and
items were refined on 9 Mar, 16 Mar, 30 Mar 2026 and later.

## Non-negotiable mechanics

**Damage Potential.** Accuracy does not roll hit/miss against NPCs. It scales outgoing damage: 70%
accuracy means the attack connects at 70% Damage Potential. Label it "Damage Potential" in UI, never
"hit chance".

**Damage Per Level.** `DPL(level) = 145 * 2.5 * ln(1 + 0.6 * level / 145) / ln(1.6)`. Implemented in
`src/combat/core/damagePerLevel.ts` with a golden table plus structural tests. Never a lookup table
unless generated from this exact expression. The curve meets the pre-2026 linear `2.5 * level` at
level 145 (362.5) - that identity is the cheapest sanity check you have.

**Crits are layers, never `damage * 1.5`.** Keep separate: Critical Strike Chance, Critical Strike
Damage, guaranteed crits, modifiers to each, crit-eligible vs ineligible damage, and per-hit crit
resolution inside multi-hit abilities. Base Critical Strike Damage reaches 50% at level 90; later
mechanics stack on top as their own layers.

**Hit caps are metadata.** Standard cap is 30,000, but model it as per-effect rules - some effects
alter, bypass, or split it. No single hardcoded global.

**Levels run 1-120** for Attack/Strength/Ranged/Magic/Necromancy, with valid temporary boosts above
120. No slider caps at 99.

**Ability categories** are Basic / Enhanced / Ultimate / Utility for the three original styles.
Do not assume a pre-2026 "threshold" ability still needs 50% adrenaline or costs 15%. Constitution and
Defence may retain threshold semantics - check, don't assume.

**Adrenaline is per-ability data.** Ordinary basics generally generate 9%, not the old 8%. Never a
global constant.

**Weapon speed.** Modernisation standardised fundamental attack timing to ~3 ticks across styles.
Attack-speed metadata may exist for historical/debug purposes only - it does not drive modern math.

**Equipment.** The 9 Mar 2026 rebalance realigned bonuses to tier across armour, rings, amulets,
pocket items, Necromancy and hybrid gear. Never use a 2024/2025 gear spreadsheet. Every item value
carries its own source and verification date.

## Style identities

They are not palette swaps of one another. Shared infrastructure is good, shared fake mechanics are not.

- **Melee** - Bloodlust as *state* (generation, consumption, cap typically 4, Berserk can alter
  capacity), bleeds, empowered abilities, on-next-attack and on-kill effects, dual-wield vs 2H.
- **Ranged** - on-hit effects, hit frequency, ammo and weapon interactions, proc frequency, multi-hit,
  per-hit adrenaline where relevant.
- **Magic** - crits and burns, Runic Charge, channels, empowered-ability interactions.
- **Necromancy** - Necrosis, Residual Souls, conjures, soul-consuming abilities, Living Death and
  Split Soul class effects. Do not force it into a Magic/Melee abstraction.

## Pipeline and rounding

Modifiers are explicit, ordered, deterministic and tested - stage then priority, never one combined
formula. Stages: `base | ability | onCast | roll | critical | onHit | target | postHit`.

Preserve intermediate rounding exactly. `floor(A) -> mod -> floor(B) -> mod -> floor(C)` never
collapses into `floor(A*B*C)`. Where the chain is undocumented, derive it and test against RS Analysis
output rather than guessing.

## Isolation rules

- Core has **zero React dependency**. If a file under `src/combat/` imports React, that is a bug.
- League modifiers layer on top via `calculateCombat(baseState, { ruleset, relics, blessings, regions })`.
  Never bake a relic or blessing into a core formula.
- **Generic target only.** No boss calculators, phase sims, kill-time or enrage math. Target settings
  stop at Defence, accuracy-relevant values, Damage Potential override, size, HP%, vulnerability,
  poisonable, Slayer category, and undead/dragon/demon flags.

## Verifying a number

1. **RuneScape Wiki** current page *and* its update history, scanning forward from 2024-03-04 - not
   stopping at 2026-03-02.
2. **RS Analysis** (rs-analysis.xyz) as an external reference implementation for expected value,
   crit/no-crit splits, and modifier ordering. Read its results, never its source or UI.
3. **PvME** for discovering that a mechanic or interaction exists. Not authoritative for numbers -
   much of its material predates the 2026 modernisation. Re-verify everything it tells you.
4. On disagreement: official Jagex > current Wiki with update history > current RS Analysis >
   verified PvME > other. Use judgment - an experimentally derived RS Analysis mechanic can beat a
   simplified official tooltip. Record the conflict, store both `displayDescription` and
   `mechanicalImplementation` when they diverge.

Tooltip text is not a formula. Never implement mechanics by parsing ability tooltips.

## Validation fixtures

Per style, compare against RS Analysis: basic attack, basic ability, enhanced ability, ultimate,
multi-hit, DoT, crit-heavy ability, style-state ability. Check min/max/mean for noncrit and crit plus
expected mean. Investigate substantial disagreement - do not pick the nicer number.

Run `npm test` before claiming a math change works.
