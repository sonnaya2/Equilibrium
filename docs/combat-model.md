# Combat model

Hit math for current RS3: base ability damage, Damage Potential, DPL, crit layers, hit caps, the ordered modifier pipeline, rounding, and how every combat number is verified. Simulation timing and state live in [`combat-engine.md`](./combat-engine.md). Item/passive routing lives in [`equipment-effects.md`](./equipment-effects.md).

The combat package (`src/combat/`) has **zero React dependency** and is unit-testable standalone.

## Scope of the game model

Current RS3 from the **4 Mar 2024 Core Combat Update** through the **2 Mar 2026 Combat Style Modernisation** and subsequent patches (9 / 16 / 30 Mar 2026 and later). The 2024 RS Analysis paper is foundational research, not the live spec.

**In scope**

- Outgoing damage on a **generic target** (Defence, accuracy-relevant values, Damage Potential override, size, HP%, vulnerability, poisonable, Slayer category, undead/dragon/demon flags).
- Ability categories **Basic / Enhanced / Ultimate / Utility** for the three original styles. Do not assume pre-2026 “threshold” costs (50% / 15%) still apply; Constitution/Defence may retain threshold semantics when sourced.
- Levels **1–120** for Attack/Strength/Ranged/Magic/Necromancy, with temporary boosts above 120 valid.

**Out of scope**

- Boss phase sims, kill-time, enrage math.
- Incoming damage / player Defence as a full defensive model (outgoing PvM only).
- Invented numbers for unrevealed or unsourceable mechanics.

League Relics and Blessings enter only through `src/combat/league/ruleset.ts` as `CombatModifier[]` / simulation state. With the League loadout omitted, base-game output must be identical.

## Module map

| Path | Owns |
| ---- | ---- |
| `src/combat/core/` | DPL, bands, base ability damage, crit layers, hit caps, Damage Potential, Defence, LP, rounding, ticks |
| `src/combat/pipeline/` | Ordered modifier stages, `calculateHit`, `calculateAbility` |
| `src/combat/shared/` | Equipment effects, stats, prayers, potions, perks, vulnerability |
| `src/combat/styles/{melee,ranged,magic,necromancy}/` | Ability tables and style state machines |
| `src/combat/target/` | Generic target |
| `src/combat/data/` | Sourced records, ability specs, `SourceReference` constants |
| `src/combat/league/ruleset.ts` | Single League boundary |
| `src/combat/engine/` | Simulation — see [`combat-engine.md`](./combat-engine.md) |
| `src/combat/index.ts` | Deliberate external API (barrel) |

`engine/cast/`, `engine/resolution/`, `engine/runtime/`, and `engine/schedulers/` are package-internal: nothing outside `src/combat/` imports them. Consumers use the barrel.

## Source hierarchy

Exact formulas, timings, cooldowns, and rounding are verified **before** implementation, in this order:

1. **Current official Jagex update notes** — patch notes, newsposts, dev blogs.
2. **Current live RuneScape Wiki** mechanics pages and documented formulas, with page history scanned forward from 2024-03-04 (not stopping at 2026-03-02).
3. **PvME or RS Analysis**, only where primaries are incomplete. PvME establishes that a mechanic exists; it is not authoritative for numbers, and much material predates 2026 modernisation. RS Analysis (rs-analysis.xyz) is an external reference for expected value, crit splits, and modifier ordering — use results, never its source tree or UI as a template.
4. **RS-Rot** only as a discrepancy signal or post-implementation comparison. Disagreement sends you back to (1)–(2); never copy values from it.

Not mechanics proof: repo comments, existing test expectations, support labels, commit messages, or ability tooltips. Tooltip text is not a formula.

Every combat and league number carries a `SourceReference` (`source`, `url`, `verifiedAt`, optional `revision` / `publishedAt` / `derivedFrom`). On source conflict, record both sides rather than blending; store `displayDescription` and `mechanicalImplementation` when tooltip and mechanic diverge. An experimentally derived RS Analysis result may beat a simplified official tooltip when the record says so.

Unrevealed data stays empty (`records: []`). Never invent a number to fill a stub.

## Damage Per Level (DPL)

Implemented in `src/combat/core/damagePerLevel.ts`:

```text
DPL(level) = 145 × 2.5 × ln(1 + 0.6 × level / 145) / ln(1.6)
```

Anchors to the pre-2026 linear `2.5 × level` at level 145 (value 362.5). Never replace with a hand-authored lookup table unless generated from this expression. `legacyDamagePerLevel` exists for comparison only.

## Base ability damage

`src/combat/core/abilityDamage.ts` must cover every loadout configuration: main-hand alone, main-hand + off-hand, two-handed melee/ranged/magic, and Necromancy.

**Intermediate floors are part of the mechanic.** Composition never collapses into a single floor at the end.

Main-hand term:

```text
floor(DPL(level)) + floor(9.6 × tier + styleBonus)
```

- Style damage bonus enters **inside** the weapon-term floor, at that term’s own multiplier: `1` main-hand, `0.5` on the secondary two-hand melee/ranged term, `1.5` for two-handed magic’s weapon term.
- Tier caps clamp the **weapon term**, not the total:
  - Melee: level cap on tier.
  - Ranged: ammunition tier.
  - Magic: spell tier.
- Off-hand (main-hand config): half of an independently floored main-hand term for the off-hand tier.
- Two-handed melee/ranged: `floor(DPL) + floor(DPL/2)` level terms + primary `9.6` + secondary `4.8` weapon floors (with styleBonus split).
- Two-handed magic: same level terms + `floor(14.4 × tier + 1.5 × styleBonus)`.
- **Necromancy is not two-handed melee.** Death guard uses the main-hand term; conduit adds half of its own main-hand-equivalent term when present.

Bands: `bandOf(base, { minPct, maxPct })` applies `percentFloor` to each end; expected mean of the inclusive integer band is `(min + max) / 2` before the full hit pipeline.

## Damage Potential

Against NPCs, accuracy is not a binary hit/miss roll. Accuracy scales outgoing damage: 70% accuracy → attack connects at 70% Damage Potential. UI must say **Damage Potential**, never “hit chance”.

```text
damagePotential(accuracy) = clamp(accuracy, 0..1); 0 if < 0.01
applyDamagePotential(damage, accuracy) = damage × damagePotential(accuracy)
```

Code: `src/combat/core/damagePotential.ts`.

## Critical strikes

Crit is **layers**, never `damage × 1.5` (`src/combat/core/critical.ts`):

| Layer | Role |
| ----- | ---- |
| Strike chance | Final chance 0..1 (base + modifiers summed by caller) |
| Strike damage | Base multiplier from level + `damageBonus` |
| Guaranteed | Skips the chance roll |
| Disabled | Blocks all crits including guarantees |
| Eligibility | `eligible: false` → no crit (default for bleed tails) |

Base crit damage is stepwise (not interpolated): +10% at 1–19, +5% per further 10 levels, capped +50% from 90. Boosted levels past 90 stay at +50%. Multi-hit abilities resolve crit **per hit**.

## Hit caps

Per-effect metadata, not a silent global (`src/combat/core/hitCaps.ts`):

- Default: `standardHitCap` = **30_000**.
- Every hit passes `applyHitCap` unless the effect’s sourced rule raises, splits, or sets `bypass: true`.
- Bypass is explicit and sourced — never “omit the cap field”.

**Partial band clipping.** When `min < cap < max`, expected value is not the average of independently capped ends. `calculateHit` enumerates the inclusive integer band (exact mean), preserving floors and partial caps:

```text
E[min(X, cap)] via per-roll pipeline, not (cap(min)+cap(max))/2
```

`uncappedExpected` / `capLoss` support analysis attribution.

## Ability categories and adrenaline

- Categories: `basic | enhanced | ultimate | utility`.
- Adrenaline is **per-ability data** (`AbilitySpec.adrenaline`, ability records). Ordinary basics generally generate 9%, not a global constant. Never hardcode generation/cost globally.
- Weapon speed: modernisation standardised fundamental attack timing to ~3 ticks (`STANDARD_ATTACK_TICKS`). Attack-speed metadata is historical/debug only.

## Style identities

Styles are not palette swaps.

| Style | Distinct state / mechanics |
| ----- | -------------------------- |
| Melee | Bloodlust (stacks, cap typically 4; Berserk can alter capacity), bleeds, empowered variants, on-next-attack / on-kill, dual-wield vs 2H |
| Ranged | On-hit effects, hit frequency, ammo/weapon interactions, multi-hit, per-hit adrenaline where sourced |
| Magic | Crits and burns, Runic Charge, channels, empowered interactions |
| Necromancy | Necrosis, Residual Souls, conjures, soul-consuming abilities, Living Death / Split Soul class effects — not a Magic or Melee abstraction |

## Modifier pipeline and rounding

Stages (`src/combat/pipeline/modifierPipeline.ts`), in order:

```text
base → ability → onCast → roll → critical → onHit → target → postHit
```

Within a stage, sort by `priority`. Deterministic; never one combined closed-form formula.

**Intermediate rounding** (`mulFloor`, `percentFloor` in `src/combat/core/rounding.ts`):

```text
floor(A) → mod → floor(B) → mod → floor(C)
```

never collapses to `floor(A×B×C)`. Pin undocumented chains from sources in tests.

### Single-hit path (`calculateHit`)

```text
band roll (optional Precise min raise)
  → modifier pipeline
  → crit as second pass (crit mult injected at critical stage)
  → Damage Potential
  → floor
  → hit cap
```

Crit-only modifiers share one path with the non-crit pass. Expected damage is chance-weighted across crit and non-crit exact means.

### Ability path (`calculateAbility`)

Sums per-hit results from `AbilitySpec.hits`. Each `AbilityHit` declares:

- `band`, optional `tickOffset`
- `critEligible` (default true unless set false)
- **`dot`** — explicit; never inferred from late land or crit-ineligibility. Magma Tempest lands over many ticks and cannot crit but is **not** DoT; Corruption Shot’s first bleed can land on the cast tick and **is** DoT.

## Support honesty labels

On `AbilitySpec` / registry:

| Label | Meaning |
| ----- | ------- |
| *(absent)* | Fully modeled within generic-target scope |
| `partially-modeled` | Meaningful component missing or excluded |
| `not-modeled` | Displayed but excluded from calculated totals / cast logic |
| `mechanics-unverified` | Implemented under a provisional interpretation |

Never present a result as complete while a known mechanic can change damage, timing, resources, or cast legality. Solver eligibility excludes partial / not-modeled / unverified by default.

## Isolation rules

1. No React under `src/combat/`.
2. League only via `leagueModifiers` / `resolveLeagueRules` — not baked into core formulas.
3. Generic target only — no boss calculators in this package.
4. Goldens are **derived independently** from sourced formulas in the test, never pasted from another calculator. Use RS Analysis / RS-Rot only as post-check discrepancy signals.
5. Do not update a golden total without a source for the delta.

## Testing expectations (math)

Per style, cover: basic attack, basic ability, enhanced, ultimate, multi-hit, DoT, crit-heavy, and a style-state ability. Assert min / max / mean on crit and non-crit paths, expected mean, and intermediate floors where the formula has them.

`src/combat/testing/goldens.ts` and colocated `*.test.ts` under `core/` and `pipeline/` own the math suite. Focused formula assertions over aggregate DPS snapshots.

## Related

- [`combat-engine.md`](./combat-engine.md) — tick clock, casts, events, branching, horizons
- [`equipment-effects.md`](./equipment-effects.md) — item facts → combat behavior
- [`data-platform.md`](./data-platform.md) — data authoring and canonical export
)
