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
- `scenario-dependent` — implemented, but it needs an input the outgoing rotation cannot supply, so
  it has no calculated damage until the user states that scenario.
- `not modeled` — shown to the user but excluded from calculated totals.
- `mechanics unverified` — the card is revealed, but one or more implementation details remain provisional.

Never present a provisional interpretation as confirmed game behaviour, and never let an unsupported
or scenario-dependent blessing read as an ordinary `0 DPM`: a zero must mean the calculator modelled
the mechanic and got zero.

## Domain ownership

The existing league domain owns:

- paths: Order, Balance, and Chaos;
- progression slots 1-8, with path slots 1, 2, 3, 5, 6, 7;
- public path tiers 1-6 and public God Tiers One and Two at progression slots 4 and 8;
- ordered path history;
- God Tier derivation;
- blessing resets;
- the generated blessing data shard.

The data record keeps `progressionSlot`, public `tier`, and public `godTier` separate. Path selections
persist both the progression slot and public path tier. Legacy rows whose `tier` held a progression
slot are normalized by stable blessing ID; persisted paths and share links must not be renumbered in
place.

Do not invent names, descriptions, effects, values, or icons for unrevealed tiers.

Author factual changes through the repository's normal JSONL patch workflow. Never hand-edit generated shards.

## Revealed cards

| Tier  | Chaos                                                                                                                                                              | Balance                                                                                                                                                               | Order                                                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Adrenaline Junkie** — maximum adrenaline +50%; adrenaline generation +50%                                                                                        | **Big Boned** — maximum life points +50%; damage dealt gains bonus damage equal to 5% of maximum life points                                                          | **Teragard's Aegis** — base ability damage gains 25% of total armour value, doubled with a defender and tripled with a shield; base health regeneration gains 2.5% of maximum life points with the same multipliers |
| 2     | **Abyssal Cinders** — attacks deal 15% of ability damage as bonus damage; 5% on-hit chance to trigger Inferno of Zamorak for 100-200% ability damage to one target | **Barkscales** — incoming damage is reduced by 10% of armour value; after five reductions, trigger Grasp of Guthix for 80-120% ability damage as poison in a 3×3 area | **Striking Light** — basic attack damage +40%; basic attacks trigger Light of Saradomin on a 9-second cooldown for 40-60% ability damage plus 250% of armour value                                                  |
| 3     | **Avernic Rampage** — 5% on-attack chance to activate a 7.2-second window where abilities and special attacks cost 0% adrenaline                                   | **Eternal Sustenance** — food is not consumed when eaten; eating no longer drains adrenaline                                                                          | **Steadfast Will** — empowers Bash, Preparation, Reflect, and Revenge                                                                                                                                               |
| God 1 | **Demon's Mark** — accuracy is always calculated using the target's weakness                                                                                       | **Splash Zone** — AoE and multi-target attacks deal 30% more damage; AoE abilities deal 5% more damage per tile occupied by the target                                | **Sacred Fervor** — ability and special-attack cooldowns are reduced by 30% for all four combat styles                                                                                                              |
| 4     | **Havoc Born**                                                                                                                                                    | **True Equilibrium**                                                                                                                                                 | **Higher Power**                                                                                                                                                                                                      |
| 5     | **Unholy Critual**                                                                                                                                                 | **Lord of Light**                                                                                                                                                    | **Tearing Thorns**                                                                                                                                                                                                    |
| 6     | **Perfidious**                                                                                                                                                     | **Envenomed**                                                                                                                                                        | **Tempered Heart**                                                                                                                                                                                                    |
| God 2 | **Chaotic Insight**                                                                                                                                                 | **Power Archive**                                                                                                                                                    | **Genesis Essence**                                                                                                                                                                                                   |

### Tier-level progression passives

Tier-level passives are typed data, not card combat records. The current documented passives are:

- God Tier One: choose the Araxxor, Rise of the Six, or Vorago rotation; this is a non-combat progression effect.
- Tier 4: unlock all War's Wares rewards as the League entitlement `wars-wares`; increase maximum adrenaline by 25%.
- Tier 5: preserve charges for god books, scriptures, grimoires, and scrimshaws; prevent equipment degradation.

Only Tier 4 maximum adrenaline enters combat totals in this phase. The cap uses one source-aware
resolver shared by loadout resolution and runtime creation. It stacks with Adrenaline Junkie,
Vestments, and Heightened Senses; the other passives remain displayed and excluded from combat.

## Implementation routing

Classify each effect before writing code, then place it at the matching engine seam. `combat-sim` describes the seams; the mapping is:

| Classification               | Where it lands                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| derived input or override    | shared combat/loadout context feeding `leagueModifiers(loadout)` in `src/combat/league/ruleset.ts` |
| per-hit or per-attack damage | a scheduled event with full provenance, resolved in `engine/resolution/`                           |
| cast-start state change      | `engine/cast/effects/`, in the lifecycle stage and style module that owns it                       |
| landed-hit state change      | `engine/resolution/landed/`, in the style that owns it                                             |
| persistent runtime state     | the style or target bucket of `RotationState`, written through its patch helper                    |
| autonomous actor             | `engine/schedulers/`, with its own scheduler state                                                 |

Nothing league-specific goes into a base formula, an unconditional engine branch, or a blessing-only field bolted onto shared state. With the ruleset omitted, base-game totals, event order, and cast sequence must be unchanged.

### Derived inputs and resolver overrides

Use shared combat or loadout context, not hardcoded blessing-local values.

- Adrenaline Junkie maximum adrenaline and Tier 4 maximum adrenaline through the shared cap resolver.
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
- the source-aware cap resolver also accounts for Vestments and Heightened Senses.

The multiplier applies to the ability's **listed** generation only. Flat grants and refunds are added
after it, so Impatient's sourced +3 stays +3 rather than becoming +4.5, and Jaws of the Abyss, the
Vestments ultimate refund and a Relentless refund are likewise untouched.

Still unverified:

- whether any non-standard adrenaline source does receive the generation multiplier in game;
- exact rounding for fractional adrenaline.

### Big Boned

Status: `modeled`, `mechanics unverified` (edge cases)

The wiki card reads "**all damage you deal** gains 5% of your maximum life points as bonus damage",
which is wider than the Cinders wording and is not once per cast. It rides every qualifying damage
instance, through the shared eligibility policy below.

**Confirmed (Jagex Mod Sponge on Discord):** per hit, and works with other blessings.

**Product model:**

- Calculator totals and solver rankings **always include** the 5% max-life outgoing rider on every
  unique rider-eligible hit (direct multi-hit components, DoT ticks, command hits).
- The +50% maximum-life multiplier (`blessingLifeMultiplier` / `maximumLifeMultiplier`) always
  applies when the blessing is picked.
- Assumption strings live in `BIG_BONED_OUTGOING_ASSUMPTIONS` in `src/combat/league/ruleset.ts`.

Implementation:

- per unique hit: attached flat bonus = 5% of `resolveMaximumLife` at land tick;
- attached bonus inheriting the host hit's crit result, `attached: true`, `expectedSeparateHits: 0`;
- its own +50% maximum-life increase contributes to the 5% amount;
- temporary max-life (Fortitude, bonfires, thermal baths, Powerburst) raises the bonus while active;
- BB and Cinders may attach independently to the same qualifying attack hit, but BB never rides the attached Cinders component;
- separate Light and Inferno hits may host BB; BB itself cannot host another BB;
- the survival benefit is displayed but not converted into extra damage beyond the rider.

Still unverified:

- exact formula stage and hit-cap treatment details;
- DoT / conjure / poison / reflected-damage edge cases if any differ from the shared rider policy;
- live magnitude confirmation beyond the card + Sponge ruling.

Do not silently treat it as a generic final `damage × 1.05` modifier.

### Teragard's Aegis

Status: `partially modeled`, `mechanics unverified`

**Two different numbers are called armour, and they must never share a field.**
`src/combat/core/defence.ts` keeps them apart:

- `totalArmour` — the player's total Armour stat, shown on the Loadout screen's Hero tab. Wiki
  `Armour` derives it from each item's own tier and slot, so the player's Defence level is not in it.
- `blockArmourRating` — `floor(equipment Armour + f(block level))`, the hit-chance denominator `d`
  from wiki `Hit chance`. Fortitude's ×1.15, prayer and curse block levels, and the Defence level
  itself live here and nowhere else.

Every "% of your armour value" effect — Aegis, Striking Light, Barkscales, Steadfast Will's Bash —
reads `totalArmour`. A boost that only moves the block calculation must never reach them.

Implementation:

- add 25% of the total Armour stat to base ability damage, 50% wielding a defender, 75% wielding a
  shield — the card's three flat shares, so the percentage resolves before a single rounding:
  `floor(armour × 0.75)`, not `floor(armour × 0.25) × 3`;
- it is additive base ability damage, never a final-damage multiplier. At 1,000 qualifying armour a
  later 150% band reads 1,875 / 2,250 / 2,625 raw, not 1.25×/1.5×/1.75× of final damage;
- the wielded off-hand comes from `wieldedOffhandKind`, over the canonical resolved equipped state,
  so a stored shield or defender under a two-handed weapon cannot multiply it, a Necromancy conduit
  reads as neither, and an ability-granted shield effect such as Bone Shield is not a wielded shield;
- health regeneration is not modeled.

Still unverified:

- whether "total armour value" is confirmed in game to be the Loadout-screen stat rather than the
  internal armour rating — the single assumption the whole magnitude rests on;
- whether the Loadout screen's combat-triangle style bonus adjusts the qualifying value;
- the rounding stage against live values;
- regeneration tick timing.

### Abyssal Cinders

Status: `mechanics unverified`

The wiki card prefixes **both** clauses with "On hit", so both are per landed attack hit. Inferno
rolls once per qualifying direct hit, not once per cast: seven-hit Greater Ricochet expects 0.35
applications and eight-hit Rapid Fire 0.40. Poison, DoT, conjure, proc, reflected, attached, and
blessing-generated damage are not attack hits and do not reopen either clause.

Eligibility for every blessing rider and on-hit roll is one policy — `blessingHitEligibility` in
`src/combat/league/damage.ts` — shared by the Quick calculator and the simulator so the two cannot
drift apart:

| Damage source                         | Big Boned rider | Cinders 15% and Inferno |
| ------------------------------------- | --------------- | ----------------------- |
| direct hit (incl. channel, multi-hit) | yes             | yes                     |
| damage-over-time tick                 | yes             | no                      |
| conjure command                       | yes             | no                      |
| autonomous conjure auto or poison     | yes             | no                      |
| invention proc                        | yes             | no                      |
| equipment proc                        | no              | no                      |
| attached component                    | no              | no                      |
| separate Light or Inferno hit         | yes             | no                      |
| player weapon-poison hit              | yes             | no                      |

Attached components are excluded by the hit-count integrity rule; blessing damage is excluded so
nothing recurses. Damage Potential replaces hit/miss rolls against NPCs, so there is no missed-hit
case, and a zero-damage event is excluded by the caller.

Inferno is one non-recursive, critical-eligible Bernoulli event. Its `max` represents the proc
landing, so read it together with `expectedOccurrences` and never as a guaranteed hit. It may roll
weapon poison and host Big Boned, but neither outcome can trigger Cinders.

Still unverified:

- whether the guaranteed bonus is a separate hit;
- whether a damage-over-time tick really rolls nothing;
- exact crit and hit-cap behaviour;
- exact random-band distribution and rounding.

### Barkscales

Status: `scenario-dependent`, `mechanics unverified`

`scenario-dependent` is its own support status and is **not** `not modeled`: the mechanic is
implemented and waiting on an input, so it must never be presented as a calculated `0 DPM`.

`src/combat/league/barkscales.ts` takes one bounded incoming scenario — the interval between
qualifying incoming hits, the occupied tiles, and poison immunity — and reports the counter
arithmetic that follows. With no interval stated it returns `support: "scenario-dependent"` and names
the missing input rather than a number. Do not turn this into a boss simulator.

Interpretation:

- the reduction takes 10% of the total Armour stat, after ordinary mitigation, never below zero;
- each qualifying enemy hit advances the five-hit counter, which resets to zero on trigger;
- Grasp of Guthix lands at the attacker's location and resolves through the shared hit pipeline as
  non-critical poison, so it deals nothing to a poison-immune target and cannot generate further
  blessing damage;
- each occupied tile of the 3×3 counts as one application, kept separate from single-target damage.

Still unverified: whether a hit fully absorbed by the reduction, a blocked hit, or several hits on
one tick each advance the counter; whether the counter carries overflow; whether every tile takes its
own hit; whether weapon poison and Cinderbane-style modifiers affect Grasp.

### Striking Light

Status: `mechanics unverified`

The March 2026 Combat Style Modernisation **removed auto-attacks** and replaced them with basic
attacks, which are ordinary Basic-category abilities reading ability damage (melee Attack 110-130%,
Ranged and Magic 90-110%). "Basic attack" is now a precise game term for those four abilities, so the
card's wording has two readings and the broader one is implemented.

Provisional implementation:

- “basic attack” is read as the whole Basic category, including the four basic attacks;
- the +40% increase applies after the ordinary Basic ability damage is established;
- Light of Saradomin activates from the first landed direct hit while off cooldown, once per cast —
  its 9-second cooldown outlives any single cast;
- Light is a separate hit and may crit;
- Light damage is the 40-60% ability-damage band plus a flat 250% of the **total Armour stat**, the
  same value Teragard's Aegis reads;
- the cooldown is 9 seconds.

Still unverified:

- whether “basic attack” means the whole Basic category or only the four basic attacks;
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

`combat-sim` owns it. Blessing procs follow the same rule as every other state-changing roll: expected value only when the outcome cannot change future state, probability-weighted state where it can, and a labelled method whenever an approximation is used. Avernic Rampage uses global state branching. Inferno damage stays expected-value, while poison observes its Bernoulli occurrence inside the exact poison-local distribution rather than cloning the combat runtime.

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
