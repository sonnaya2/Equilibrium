---
name: league-blessings
description: RuneScape 3 Leagues II: Equilibrium blessing reveal data, support status, combat-engine routing, and provisional mechanic rulings. Use when adding or verifying blessing tiers, mapping blessing effects into league loadout context or rotation simulation, or deciding whether a blessing is modeled, partially modeled, unmodeled, or mechanically unverified.
---

# Equilibrium blessings

This skill owns the revealed blessing cards, their source, their calculator support status, and the routing rules for implementing them.

It does not redefine base combat formulas or simulator timing. Use the existing combat documentation and simulation code for shared definitions such as attack, hit, ability damage, Damage Potential, cooldown state, ability tags, and tick timing.

## Source and verification status

Primary source:

- Jagex, “Leagues: Equilibrium Reveals - Releasing August 10th”
- https://secure.runescape.com/m=news/leagues-equilibrium-reveals---releasing-august-10th
- `verifiedAt: 2026-07-30`

The reveal confirms the names, paths, player-facing card text, percentages, and displayed damage bands for tiers 1-3 and God Tier One.

It does not confirm exact in-game implementation details such as modifier stage, rounding order, proc recursion, crit eligibility, hit-cap treatment, per-hit versus per-cast triggering, or interactions with other effects. Those remain mechanically unverified until tested in game or documented by a stronger source.

Use these support labels:

- `modeled` — implemented with no known missing component relevant to the calculator.
- `partially modeled` — the outgoing-damage or rotation component is implemented, but another part is outside calculator scope or still unsupported.
- `not modeled` — shown to the user but excluded from calculated totals.
- `mechanics unverified` — the card is revealed, but one or more implementation details remain provisional.

Never present a provisional interpretation as confirmed game behaviour.

## Domain ownership

The existing league domain owns:

- paths: Order, Balance, and Chaos;
- God Tiers at tiers 4 and 8;
- ordered path history;
- God Tier derivation;
- blessing resets;
- the generated blessing data shard.

The effective named blessing is derived from tier plus chosen path. Combat code should consume stable derived blessing IDs rather than interpret arbitrary display strings.

Tier 5, tier 6, tier 7, and God Tier Two must exist as explicit empty placeholders with:

```json
{
  "revealed": false
}
```

Do not invent names, descriptions, effects, values, or icons for unrevealed tiers.

Author factual changes through the repository's normal JSONL patch workflow. Never hand-edit generated shards.

## Revealed cards

| Tier | Chaos | Balance | Order |
| --- | --- | --- | --- |
| 1 | **Adrenaline Junkie** — maximum adrenaline +50%; adrenaline generation +50% | **Big Boned** — maximum life points +50%; damage dealt gains bonus damage equal to 5% of maximum life points | **Teragard's Aegis** — base ability damage gains 25% of total armour value, doubled with a defender and tripled with a shield; base health regeneration gains 2.5% of maximum life points with the same multipliers |
| 2 | **Abyssal Cinders** — attacks deal 15% of ability damage as bonus damage; 5% on-hit chance to trigger Inferno of Zamorak for 100-200% ability damage to one target | **Barkscales** — incoming damage is reduced by 10% of armour value; after five reductions, trigger Grasp of Guthix for 80-120% ability damage as poison in a 3×3 area | **Striking Light** — basic attack damage +40%; basic attacks trigger Light of Saradomin on a 9-second cooldown for 40-60% ability damage plus 250% of armour value |
| 3 | **Avernic Rampage** — 5% on-attack chance to activate a 7.2-second window where abilities and special attacks cost 0% adrenaline | **Eternal Sustenance** — food is not consumed when eaten; eating no longer drains adrenaline | **Steadfast Will** — empowers Bash, Preparation, Reflect, and Revenge |
| God 1 | **Demon's Mark** — accuracy is always calculated using the target's weakness | **Splash Zone** — AoE and multi-target attacks deal 30% more damage; AoE abilities deal 5% more damage per tile occupied by the target | **Sacred Fervor** — ability and special-attack cooldowns are reduced by 30% for all four combat styles |

## Implementation routing

Classify each effect before writing code, then place it at the matching engine seam. `combat-sim` describes the seams; the mapping is:

| Classification              | Where it lands                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| derived input or override   | shared combat/loadout context feeding `leagueModifiers(loadout)` in `src/combat/league/ruleset.ts` |
| per-hit or per-attack damage | a scheduled event with full provenance, resolved in `engine/resolution/`                          |
| cast-start state change     | `engine/cast/effects/`, in the lifecycle stage and style module that owns it                      |
| landed-hit state change     | `engine/resolution/landed/`, in the style that owns it                                            |
| persistent runtime state    | the style or target bucket of `RotationState`, written through its patch helper                   |
| autonomous actor            | `engine/schedulers/`, with its own scheduler state                                                |

Nothing league-specific goes into a base formula, an unconditional engine branch, or a blessing-only field bolted onto shared state. With the ruleset omitted, base-game totals, event order, and cast sequence must be unchanged.

### Derived inputs and resolver overrides

Use shared combat or loadout context, not hardcoded blessing-local values.

- Adrenaline Junkie maximum adrenaline.
- Big Boned maximum life points.
- Teragard's Aegis armour contribution to base ability damage.
- Demon's Mark accuracy or affinity resolution.
- Sacred Fervor effective base cooldowns.
- Shield and defender classification.
- Total armour value and maximum life points after temporary boosts.

Do not put derived combat stats into an unstructured list of blessing strings.

### Per-hit or per-attack damage events

These need explicit event provenance rather than one anonymous damage multiplier.

- Big Boned bonus damage.
- Abyssal Cinders bonus damage.
- Inferno of Zamorak.
- Grasp of Guthix.
- Light of Saradomin.
- Steadfast Will's Bash damage.
- Reflect, if incoming-combat simulation is added later.

Each event must define:

- trigger scope;
- source damage quantity;
- whether it is a separate hit;
- crit eligibility;
- target modifiers;
- hit-cap behaviour;
- recursion rules;
- proc eligibility.

### Rotation and timing state

These alter future cast legality or cooldown state.

- Adrenaline Junkie generation.
- Avernic Rampage.
- Light of Saradomin's cooldown.
- Inferno of Zamorak's proc roll.
- Sacred Fervor.
- Preparation.
- Revenge, if incoming-combat state is added later.

Do not reduce state-changing RNG to a flat average when it can change which later abilities are legal.

### Outside the outgoing-damage calculator

Display these effects, but do not assign estimated damage value to them.

- Eternal Sustenance.
- Teragard's Aegis health regeneration.
- Big Boned's survival benefit.
- Barkscales incoming-damage reduction and automatic five-hit trigger timing.
- Reflect without incoming-attack simulation.
- Revenge without incoming-attack simulation.
- Mobility, ammo conservation, rune conservation, degradation removal, and other non-damage tier passives.

## Current support rulings

### Adrenaline Junkie

Status: `mechanics unverified`

Provisional implementation:

- normal maximum adrenaline becomes 150%;
- adrenaline generation is multiplied by 1.5;
- no other known maximum-adrenaline increase currently needs stacking rules.

Still unverified:

- whether refunds, item effects, or every non-standard adrenaline source receive the generation multiplier;
- exact rounding for fractional adrenaline.

### Big Boned

Status: `partially modeled`, `mechanics unverified`

Provisional implementation:

- its own +50% maximum-life-points increase contributes to the 5% damage amount;
- armour-derived life-point bonuses also contribute;
- the survival benefit is displayed but not converted into damage value.

Still unverified:

- whether bonus damage is once per attack or once per damaging hit;
- whether it is a separate hit;
- crit eligibility;
- hit-cap treatment;
- whether damage-over-time, proc damage, conjures, poison, or reflected damage trigger it.

Do not silently treat it as a generic final `damage × 1.05` modifier.

### Teragard's Aegis

Status: `partially modeled`, `mechanics unverified`

Provisional implementation:

- total armour includes equipment and temporary armour increases, including potions, overload effects, Excalibur, and other armour boosts;
- add 25% of total armour value to base ability damage;
- multiply that armour contribution by 2 with a defender or 3 with a shield;
- shield and defender states are mutually exclusive;
- health regeneration is not modeled.

Still unverified:

- exact calculation and rounding stage;
- whether every temporary armour source is included exactly as displayed;
- regeneration tick timing.

### Abyssal Cinders

Status: `mechanics unverified`

Provisional implementation:

- the guaranteed 15% bonus applies to every qualifying damaging hit, including multi-hit and damage-over-time hits;
- Inferno of Zamorak rolls once per attack or ability use, not once per individual hit;
- Inferno behaves like a randomly triggered 100-200% ability-damage attack;
- Inferno may crit;
- blessing-generated damage cannot recursively trigger Abyssal Cinders itself.

The general first-hit trigger rule does not apply to the guaranteed 15% portion.

Still unverified:

- whether the guaranteed bonus is a separate hit;
- exact crit and hit-cap behaviour;
- whether proc damage can trigger unrelated on-hit effects;
- exact random-band distribution and rounding.

### Barkscales

Status: `not modeled`, `mechanics unverified`

Provisional interpretation:

- reduce incoming damage after ordinary mitigation;
- never reduce a hit below zero;
- each qualifying enemy hit advances the five-hit counter;
- after the fifth reduction, Grasp of Guthix is placed at the selected target's location;
- poison-immune targets take no poison damage;
- normal poison modifiers such as weapon poison and Cinderbane-style effects are expected to affect Grasp.

The outgoing calculator cannot trigger Barkscales automatically because it has no enemy attack timeline.

A future manual “Grasp active” calculation may model the proc damage separately, but that is not full Barkscales support.

### Striking Light

Status: `mechanics unverified`

Provisional implementation:

- “basic attack” includes auto-attacks and abilities categorized as Basic;
- the +40% increase applies after the ordinary basic attack or Basic ability damage is established;
- Light of Saradomin activates from the first qualifying hit while off cooldown;
- Light is a separate hit and may crit;
- Light damage is the 40-60% ability-damage band plus a flat 250% of armour value;
- the cooldown is 9 seconds.

Still unverified:

- whether the reveal's “basic attack” wording truly includes Basic-category abilities;
- cooldown start timing;
- hit-cap and recursion behaviour;
- exact ordering between the ability-damage and armour components.

### Avernic Rampage

Status: `mechanics unverified`

Provisional implementation:

- roll once per auto-attack or ability use, not once per individual hit;
- the triggering attack does not benefit;
- 7.2 seconds is 12 game ticks;
- abilities and special attacks cost zero adrenaline during the window;
- normal starting-adrenaline requirements do not block those casts;
- another activation refreshes or extends the active window.

Use probability-weighted state branching with equivalent states merged when practical. Use seeded Monte Carlo only if exact branching becomes unreasonably expensive. Do not model it as a flat average adrenaline discount.

Still unverified:

- refresh versus extension behaviour;
- channel, upkeep, or drain interactions;
- the precise proc timing within the triggering attack.

### Eternal Sustenance

Status: `not modeled`

Current ruling:

- food can be eaten without being consumed;
- only the ordinary food adrenaline penalty is removed;
- do not generalize this to potions, brews, or unrelated consumables without a source;
- display the effect, but exclude it from damage totals and rotation calculations unless food-use simulation is explicitly added.

### Steadfast Will

Status: `partially modeled`, `mechanics unverified`

#### Bash

- keep Bash's ordinary damage;
- add 350-450% of armour value as additional damage;
- do not replace the original Bash hit.

Still unverified:

- whether the additional armour damage is a separate hit;
- crit and hit-cap treatment;
- exact roll and rounding behaviour.

#### Preparation

- subtract 12 seconds from every active ability cooldown;
- do not reduce Preparation's own cooldown;
- do not reduce another cooldown completely to zero;
- use the simulator's existing cooldown state rather than rewriting canonical ability data.

The minimum remaining cooldown is still unresolved and must not be invented.

#### Reflect

- not modeled without incoming-attack simulation;
- provisional interpretation uses raw incoming damage;
- reflected damage may crit;
- reflected damage must not recursively trigger itself.

#### Revenge

- not modeled without incoming-attack and stack simulation;
- display doubled duration, doubled cooldown, and a maximum of 20 stacks;
- do not estimate a damage contribution.

### Demon's Mark

Status: `partially modeled`, `mechanics unverified`

Provisional implementation:

- use the target affinity corresponding to its most favorable weakness;
- if the target has no applicable weakness, the blessing has no effect;
- the existing accuracy and Damage Potential resolver remains authoritative;
- weakness-dependent equipment such as Hexhunter bow, Terrasaur maul, and Inquisitor's staff is provisionally allowed to recognize the selected weakness.

The weakness-dependent equipment interaction must be labeled untested.

Do not describe the mechanic only as “lowest affinity” unless the target schema proves that lower numbers are always more favorable.

### Splash Zone

Status: `mechanics unverified`

Provisional implementation:

- AoE status comes from existing ability tags or equipment behaviour such as chinchompas;
- multi-target status uses existing attack metadata;
- the +30% bonus and +5%-per-tile bonus may apply together;
- tile count uses the target's full footprint from game data;
- the two Splash Zone bonuses are additive with each other;
- interaction with unrelated modifiers follows the existing ordered modifier pipeline.

Still unverified:

- whether all tagged AoE abilities qualify identically;
- whether occupied tiles means full footprint or tiles actually struck;
- whether the tile bonus has a cap;
- exact modifier stage and rounding.

### Sacred Fervor

Status: `mechanics unverified`

Provisional implementation:

- effective base cooldown is `floor(defaultCooldown × 0.7)`;
- the blessing is always active, so there is no mid-cooldown activation case;
- later cooldown reductions apply to the reduced base cooldown;
- apply the rule when cooldown state is created rather than mutating canonical ability records.

Still unverified:

- whether rounding occurs in seconds or game ticks;
- minimum cooldown;
- charge and shared-cooldown behaviour;
- dynamically calculated cooldowns;
- whether every weapon special-attack cooldown is included.

## General trigger and recursion rules

Until testing proves otherwise:

- an unspecified on-hit proc uses the first qualifying hit of an attack;
- a blessing that explicitly applies to all hits overrides that default;
- proc chance described per attack rolls once per attack or ability use;
- blessing-generated damage cannot trigger the same blessing recursively;
- ordinary downstream target modifiers still apply;
- interactions with unrelated poison, healing, proc counters, or other blessings remain unverified unless tested.

## RNG policy

`combat-sim` owns it. Blessing procs follow the same rule as every other state-changing roll: expected value only when the outcome cannot change future state, probability-weighted branching when it can, and a labelled method whenever an approximation is used. Avernic Rampage and Inferno of Zamorak are branching cases, not flat averages.

## Required context additions

Blessing implementation may require shared derived context for:

- total armour value after all active boosts;
- maximum life points after all active bonuses;
- shield or defender state;
- target footprint;
- target weakness or affinities;
- attack and ability tags;
- auto-attack versus Basic-category ability;
- hit provenance;
- active cooldown state;
- current adrenaline and maximum adrenaline.

Add these to the appropriate shared combat or simulator context. Do not hardcode them inside blessing handlers.

## Test requirements

For each implemented blessing, test the ruleset enabled and disabled.

Base-game numerical output and cast sequence must remain identical when Equilibrium blessings are absent.

The general simulator matrix — hit counts, channels, tick boundaries, crit paths, event ordering — belongs to `combat-sim`. On top of it, blessings need:

- ruleset `"base"` versus `"equilibrium"`, with base totals and cast sequence unchanged;
- no shield, defender, and shield;
- 1×1 and larger targets;
- auto-attack versus Basic-category ability;
- AoE versus multi-target;
- first-hit and per-hit trigger boundaries;
- proc cooldown boundaries;
- separate-hit and hit-cap treatment;
- no recursive self-triggering;
- poisonable and poison-immune targets;
- unsupported effects displayed but excluded from totals.

Test names must state any provisional assumption or expected-value smoothing. Do not move a golden total to accommodate a blessing without the source that justifies the new number.

Run `npm run typecheck`, `npm test`, and `npm run build`, plus `npm run test:e2e` when a support label or displayed metric changed, before claiming blessing support is complete.
