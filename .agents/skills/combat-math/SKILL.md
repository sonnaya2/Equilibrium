---
name: combat-math
description: RS3 combat engine math for this repo - base ability damage by weapon configuration, Damage Potential, the 2026 logarithmic Damage Per Level curve, the layered crit model, hit caps as per-effect metadata, Basic/Enhanced/Ultimate/Utility categories, adrenaline as data, per-style state (Bloodlust, ranged on-hit, Runic Charge and burns, Necromancy souls), the ordered modifier pipeline, intermediate rounding, and the source hierarchy every combat number must clear. Use before writing, reviewing, or debugging anything under src/combat/, and when verifying a combat number.
---

# Combat math (current-game RS3)

`AGENTS.md` is authoritative. This is the working mental model for `src/combat/`.

This skill owns **what a hit is worth** and **how a combat number is verified**. `combat-sim` owns
the engine under `src/combat/engine/`: when events happen and what state survives between them.
`league-blessings` owns revealed blessing facts, support labels, and blessing routing.
`equipment-effects` owns item records, passive/set activation, enchantments, and their routing into
these math layers.

## Where the code lives

| Path                                                 | Owns                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/combat/core/`                                   | DPL, bands and base ability damage, crit layers, hit caps, Damage Potential, rounding, ticks |
| `src/combat/pipeline/`                               | the ordered modifier pipeline, `calculateHit`, `calculateAbility`                            |
| `src/combat/shared/`                                 | equipment, prayers, potions, perks, vulnerability                                            |
| `src/combat/styles/{melee,ranged,magic,necromancy}/` | ability tables and the state machines that are genuinely that style's                        |
| `src/combat/target/`                                 | the generic target                                                                           |
| `src/combat/data/`                                   | sourced records, ability specs, `SourceReference` constants                                  |
| `src/combat/league/ruleset.ts`                       | the one League boundary                                                                      |
| `src/combat/engine/`                                 | simulation — read `combat-sim` before touching it                                            |
| `src/combat/index.ts`                                | the deliberate external API                                                                  |

`src/combat/index.ts` must name every module an outside consumer may reach for, so adding a module
that UI or tooling will import means adding it to the barrel. `engine/cast/`, `engine/resolution/`,
`engine/runtime/` and `engine/schedulers/` are engine internals: nothing outside `src/combat/`
imports them.

## The game you are modelling

Current RS3, meaning everything from the **4 Mar 2024 Core Combat Update** through the **2 Mar 2026
Combat Style Modernisation** and every patch after it. The 2024 RS Analysis paper is foundational
research, not the current spec. 2 Mar 2026 is not the final patch either - individual abilities and
items were refined on 9 Mar, 16 Mar, 30 Mar 2026 and later.

## Source hierarchy

Exact formulas, timings, cooldowns and rounding behaviour are source-verified **before**
implementation, in this order:

1. **Current official Jagex update notes** — patch notes, newsposts, dev blogs.
2. **Current live RuneScape Wiki** mechanics pages and documented formulas, read together with the
   page's update history scanned forward from 2024-03-04 — not stopping at 2026-03-02.
3. **PvME or RS Analysis**, only where the primary sources are incomplete. PvME establishes that a
   mechanic or interaction exists; it is not authoritative for numbers, and much of its material
   predates the 2026 modernisation. RS Analysis (rs-analysis.xyz) is an external reference
   implementation for expected value, crit splits and modifier ordering — read its results, never
   its source or UI.
4. **RS-Rot** only as a discrepancy signal, or as a post-implementation comparison. A disagreement
   sends you back to sources 1-2; it is never itself a value to copy.

None of the following is mechanics proof: a comment in this repo, an existing test's expectation, a
support label, a commit message, or an ability tooltip. Tooltip text is not a formula — never
implement mechanics by parsing one. When a mechanic cannot clear the hierarchy it stays
unimplemented or explicitly provisional. Do not invent a number to fill the gap.

On disagreement, record the conflict rather than blending sources, and store both
`displayDescription` and `mechanicalImplementation` when they diverge. Use judgment: an
experimentally derived RS Analysis result can beat a simplified official tooltip — say so in the
record when it does.

## Non-negotiable mechanics

**Base ability damage is complete per weapon configuration.** `src/combat/core/abilityDamage.ts`
must cover every configuration a loadout can produce — main-hand alone, main-hand plus off-hand,
two-handed melee, two-handed ranged, two-handed magic, and Necromancy — not only the easy cases.

- Intermediate floors are part of the mechanic. `floor(DPL(level)) + floor(9.6 × tier + styleBonus)`
  never collapses into a single floor at the end, and each configuration's test asserts the floors
  stay separate rather than only checking the total.
- The gear style damage bonus enters **inside** the weapon term's floor, at that term's own
  multiplier: `1` for main-hand, `0.5` for the two-handed melee/ranged term, `1.5` for two-handed
  magic.
- Tier caps clamp the weapon term, not the total. Spell tier (magic), ammo tier (ranged) and the
  melee tier cap are separate rules, so one can never silently stand in for another. The
  wielder-level cap stays out until its start date is sourced.
- **Necromancy is not a two-handed melee weapon.** Its main-hand weapon and its conduit are their
  own configuration and need an explicit branch; do not let Necromancy fall through the
  melee/ranged two-handed term. The current explicit branch gives the conduit half of its
  tier-derived main-hand term.

**Hit caps are per-effect metadata.** `standardHitCap` (30,000) is enabled by default and every hit
passes through `applyHitCap` unless an effect's own sourced rule raises, splits or bypasses it.
Bypass is explicit (`bypass: true`) and sourced — never an omitted cap or a hardcoded global.

**A partially clipped band needs exact expected value.** When a cap falls inside a hit's range
(`min < cap < max`), the mean is not the average of the independently capped ends. For a uniform
band the expected value is the probability-weighted mix of the unclipped part and the cap:

```text
E[min(X, cap)] = P(X <= cap) * mean(min, cap) + P(X > cap) * cap
```

Capping min and max and averaging them — what `calculateHit` does today — is correct only while the
band is wholly under or wholly over the cap, and understates the mean in between. The same rule
applies to any other clamp that lands inside a band.

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

**Levels run 1-120** for Attack/Strength/Ranged/Magic/Necromancy, with valid temporary boosts above 120. No slider caps at 99.

**Ability categories** are Basic / Enhanced / Ultimate / Utility for the three original styles.
Do not assume a pre-2026 "threshold" ability still needs 50% adrenaline or costs 15%. Constitution and
Defence may retain threshold semantics - check, don't assume.

**Adrenaline is per-ability data.** Ordinary basics generally generate 9%, not the old 8%. Never a
global constant.

**Weapon speed.** Modernisation standardised fundamental attack timing to ~3 ticks across styles.
Attack-speed metadata may exist for historical/debug purposes only - it does not drive modern math.

**Equipment.** Read `equipment-effects` before changing item stats, passives, enchantments, set
thresholds, or special-attack routing. The 9 Mar 2026 rebalance realigned bonuses to tier across armour, rings, amulets,
pocket items, Necromancy and hybrid gear. Never use a 2024/2025 gear spreadsheet. Every item value
carries its own source and verification date.

## Style identities

They are not palette swaps of one another. Shared infrastructure is good, shared fake mechanics are not.

- **Melee** - Bloodlust as _state_ (generation, consumption, cap typically 4, Berserk can alter
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
collapses into `floor(A*B*C)`. Where the chain is undocumented, derive it from the sources and pin
the derivation in the test rather than guessing.

## Isolation rules

- Core has **zero React dependency**. If a file under `src/combat/` imports React, that is a bug.
- League modifiers enter through `leagueModifiers(loadout)` in `src/combat/league/ruleset.ts` and
  feed the existing `CombatModifier[]` pipeline. Never bake a relic or blessing into a core formula.
  With the League loadout omitted, base-game output must be byte-identical.
- **Generic target only.** No boss calculators, phase sims, kill-time or enrage math. Target settings
  stop at Defence, accuracy-relevant values, Damage Potential override, size, HP%, vulnerability,
  poisonable, Slayer category, and undead/dragon/demon flags.

## Validation fixtures

Read and follow `test-maintainer` before writing, editing, or triaging any combat test. That skill is
mandatory for suite work; this section only names how goldens must be derived.

Golden fixtures are **derived independently** — from the sourced formula, worked out in the test
itself — and never pasted from another calculator's output. A fixture that only records what RS
Analysis or RS-Rot printed proves agreement with that tool, not with the game, and will happily pin
its bug alongside yours.

Per style, cover: basic attack, basic ability, enhanced ability, ultimate, multi-hit, DoT,
crit-heavy ability, and a style-state ability. Assert min, max and mean on both the crit and
non-crit paths plus the expected mean, and assert the intermediate floors wherever a formula has
them.

Use RS Analysis and RS-Rot afterwards, as a discrepancy signal. Substantial disagreement opens an
investigation — do not pick the nicer number, and never relax a golden to turn a red test green
without a source for the new value.

Run `npm test` before claiming a math change works, and `npm run typecheck` when types moved.
