# Player-applied poison baseline

Verified 2026-08-06. Recheck current Jagex notes before implementation because combat values can change.

## Sources

- Jagex combat modernisation notes: https://secure.runescape.com/m=news/patch-notes-part-2---combat-style-modernisation
- Jagex Kwuarm item text: https://secure.runescape.com/m=itemdb_rs/Kwuarm+incense+sticks/viewitem?obj=47709
- RuneScape Wiki poison overview: https://runescape.wiki/w/Poison
- Weapon poison comparison: https://runescape.wiki/w/Template:Weapon_poison_compare
- Cinderbane gloves: https://runescape.wiki/w/Cinderbane_gloves
- Upgraded bone blowpipe: https://runescape.wiki/w/Upgraded_bone_blowpipe
- Laniakea's spear: https://runescape.wiki/w/Laniakea%27s_spear
- Kwuarm incense sticks: https://runescape.wiki/w/Kwuarm_incense_sticks
- Bik arrows: https://runescape.wiki/w/Bik_arrow
- Conjuration interactions: https://runescape.wiki/w/Conjuration
- Putrid Zombie update history: https://runescape.wiki/w/Conjure_Putrid_Zombie
- Blood Reaver on-hit fix: https://secure.runescape.com/m=news/november-postjam-patch-week---this-week-in-runescape
- PVME poison mechanics: https://pvme.io/pvme-guides/miscellaneous-information/mechanics/

## Core values

| Source | Tier | Tier scalar | Base coefficient | Player buff | Initial range |
| --- | ---: | ---: | ---: | ---: | ---: |
| Weapon poison | 1 | 50 | 20% | 250 ticks | 13-26% ability damage |
| Weapon poison+ | 2 | 100 | 25% | 500 ticks | 16.25-32.5% |
| Weapon poison++ | 3 | 150 | 30% | 1,000 ticks | 19.5-39% |
| Weapon poison+++ | 4 | 200 | 35% | 1,200 ticks | 22.75-45.5% |
| Cinderbane alone | 2 | 100 | 25% | equipped | 16.25-32.5% |
| Cinderbane with poison+++ | 5 | 250 | 40% | 1,200 potion ticks while equipped | 26-52% |

- The `50-250` values identify the internal poison tier; they are not literal fixed damage. Tier 1 starts at 20% ability damage and each tier adds 5 percentage points: 20%, 25%, 30%, 35%, 40%. The final poison range starts at 65-130% of that coefficient.
- Potion durations enable the player's poison rolls; every successfully poisoned target has its own 300-tick status.
- A successful application schedules the first poison hit two ticks after the applying hit. That delayed hit is hit 1 of the 18-hit, 300-tick target-poison sequence; it is not a nineteenth hit. Subsequent hits use the ordinary 16-tick cadence.
- An ordinary successful reapplication while poison is active refreshes the 300-tick status and decay but does not earn a second application hit. A Cinderbane reapplication while poison is active earns an additional poison hit two ticks later, refreshes the status and decay, and resets the ordinary 16-tick timer. It does not cancel other delayed hits that were already earned.
- For zero-based poison hit index `i`, the damage factors are `minimum = 0.65 - 0.015 * i` and `maximum = 1.30 - 0.03 * i`. The first three ranges are 65-130%, 63.5-127%, and 62-124%. Use their midpoint for expected damage; refresh resets `i` to 0.
- Standard poison proc chance is 1/8 on an eligible hit against a poisonable target. Laniakea changes the single chance to 17.5%. Cinderbane plus a potion does not add a second parallel roll.

## Damage calculation

For tier `t` and zero-based poison hit index `i`:

```text
tierCoefficient = [0.20, 0.25, 0.30, 0.35, 0.40][t - 1]
minimumFactor = 0.65 - 0.015 * i
maximumFactor = 1.30 - 0.03 * i
expectedFactor = (minimumFactor + maximumFactor) / 2
expectedBaseDamage = abilityDamage * tierCoefficient * expectedFactor
```

Damage-only RNG stays expected-value in the engine. Preserve minimum and maximum for analysis, but do not sample the random damage roll. Apply the sourced poison multipliers after the decaying base calculation; keep integer rounding order provisional until a fixture proves it.

Required numeric fixtures before modifiers:

| Case | Minimum | Average | Maximum |
| --- | ---: | ---: | ---: |
| Tier 1, hit 1 (`i = 0`) | 13% | 19.5% | 26% |
| Tier 4, hit 1 (`i = 0`) | 22.75% | 34.125% | 45.5% |
| Tier 5, hit 1 (`i = 0`) | 26% | 39% | 52% |
| Tier 4, hit 2 (`i = 1`) | 22.225% | 33.3375% | 44.45% |
| Tier 4, hit 18 (`i = 17`) | 13.825% | 20.7375% | 27.65% |

## Named interactions

- Cinderbane gloves provide the 1/8 application roll when they are the only poison source. With another source active, they raise its tier by one and let poison hits reapply recursively; current Wiki and PVME descriptions do not support a second parallel potion-plus-Cinderbane roll. If already poisoned, success schedules an extra poison hit two ticks later, refreshes the target state, and that hit may continue the chain. For continuation chance `p`, expected hits are `p / (1 - p)`: `1/7` at `p = 1/8`, or `7/33` with Laniakea at `p = 0.175`. Use this only as an aggregate test oracle; runtime state remains one concrete sample per stochastic lane.
- Cinderbane acts as Weapon poison+ without a potion and adds one tier when a potion is active, up to effective tier 5.
- Upgraded bone blowpipe supplies inherent tier 1 poison, halves poison damage including Cinderbane hits, and changes the recurring cadence from 16 to 8 ticks. The same 300-tick poison status deals 36 hits instead of 18. It does not double the Cinderbane roll.
- Laniakea's spear adds 5 percentage points to the single poison application or Cinderbane-continuation chance and multiplies poison damage by 1.05. It modifies an active poison source; do not let it create poison by itself without evidence.
- Kwuarm potency adds 2.5% weapon-poison damage per level, up to 10% at potency 4. Lighting starts a 10-minute buff at potency 1; potency rises every 10 minutes to 4. Extra sticks add 10 minutes up to 60, while overloading consumes six sticks and starts potency 4 with 10 minutes. Jagex item text and the Wiki agree on the damage; PVME's current `+2%` line conflicts with its own `10% at potency 4` cap and must not be used. Store potency as integer `0-4` in Buffs; defer elapsed-time stick consumption and potency ramp until a real long-horizon requirement exists.
- Bik arrows do not poison. Every ability hit, including the post-2026 basic attacks, adds Evolving Toxin to the target; legacy auto-attacks do not. Current Jagex values are 150 stacks and +3% poison damage per stack. All stacks expire together after 50 ticks without refresh.
- Current source wording supports multi-hit ability stacking. Bleed, derived-hit, and converted-channel Bik eligibility needs an explicit current verification fixture before full support.

## Source conflicts

- Jagex item text and the current Wiki say Kwuarm is +2.5% per potency. PVME says +2% but also says potency 4 is +10%; use 2.5%.
- Jagex changed Bik to 150 stacks and +3% per stack on 2 March 2026. Older Bik page snapshots and the Wiki poison calculator still expose 200 and +2%; ignore them.
- The current Cinderbane page and PVME say 1/8. Older guides and Fandom snapshots still say 1/6.
- PVME's `Weapon Poison: 19.5%` entry is the 13-26% range's average, not a fixed hit.

## Modifier boundary

- Source-local: effective poison tier, Cinderbane, Laniakea, Kwuarm, blowpipe cadence and half-damage.
- Target-global at poison land: Evolving Toxin, Vulnerability, and any other explicitly sourced target poison multiplier.
- Big Boned is appended after poison multipliers; Cinderbane, Laniakea, Kwuarm, Evolving Toxin,
  Vulnerability, and Envenomed do not amplify its flat maximum-life term.
- Excluded by default: critical strikes, Damage Potential/miss rolls, ability-specific windows, ordinary prayer modifiers, hit caps, life steal, resource gain, invention procs, blessing on-hit rolls, and style state.

## Trigger boundary

Apply one roll per eligible hitsplat, not once per ability and not after every global damage event. Encode the decision through `canApplyWeaponPoison`; never infer it from `procEligible` alone.

| Damage source | Rolls weapon poison/Cinderbane? |
| --- | --- |
| Player basic, ability, or separate multi-hit hitsplat | Yes |
| Player bleed or DoT tick | Yes |
| Verified player auxiliary hit such as a god book/scripture, reflect, cannon, invention/equipment proc, bolt extra hit, parasite tick, or blood-necklace hit | Yes |
| Separate player-attributed blessing hit such as Inferno | Yes; use provenance rather than blessing IDs |
| Attached bonus rider such as Big Boned | No; it is part of the receiving poison occurrence |
| Normal Summoning-familiar attack or scroll | No |
| Necromancy conjure auto or command | No |
| Putrid Zombie attack or poison pulse | No new roll; its poison damage still receives poison modifiers |
| Blood Reaver passive damage | No; Jagex removed player on-hit effects on 25 November 2024 |
| Player weapon-poison hit | Only the Cinderbane continuation roll |

Weapon-poison damage is status damage, not an attack hit. It never receives Abyssal Cinders' attached 15% bonus and never rolls Inferno. On a qualifying direct attack, Cinders and Big Boned are independent attached components on the original hit; Big Boned is not added again to the Cinders component. Inferno is one separate 5% hit, may roll weapon poison, and may host Big Boned without reopening Cinders.

The Conjuration page explicitly excludes conjure autos and commands. The Putrid Zombie's 23 October 2023 fix stopped its passive from attempting Cinderbane applications. Jagex's 25 November 2024 patch stopped Blood Reaver passive damage from triggering poison or god books.

## Open verification gates

- Exact integer rounding order and whether the applying profile snapshots ability damage across gear/window changes.
- Bik eligibility for bleed ticks, attached/derived components, and converted channels after the 2026 combat rewrite.

Keep these as provisional support labels until a current source or reproducible live fixture resolves them.
