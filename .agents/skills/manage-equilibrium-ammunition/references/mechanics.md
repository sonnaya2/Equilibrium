# Current ranged ammunition mechanics

Use this as a routing index, not as a substitute for checking the linked current page and patch
history. Values reflect the 2026 combat-style state known when this skill was authored.

## Arrows and dinarrows

| Mechanic                  | Current fact                                                                                                                                                             | Engine shape                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Ordinary arrows           | Projectile tier only                                                                                                                                                     | Static tier/capability                        |
| Attuned bane arrows/bolts | Matching target gets +25% ability damage, +40% auto damage, and +30 hit-chance points                                                                                    | Target-gated source and accuracy modifier     |
| Black Stone               | Each eligible hit reduces original base armour by `floor(min(0.75%, 22))`; total `floor(min(15%, 454))`; 1,200 ticks; target death/clear resets                          | Lane-local target state; later hits benefit   |
| Deathspore                | Each ranged hit adds a stack; 12 grants a 15-tick free-adrenaline-cost buff; fixed 50-tick cooldown                                                                      | Existing ranged hit/cast state                |
| Splintering               | Each ranged attack hit adds Punctured, stores 1% current ability damage, cap 250, scheduled 0.5/0.2/0.15/0.1/0.05 damage, 50-tick expiry                                 | Existing landed state and events              |
| Bik                       | Ability hits add Evolving Toxin, cap 150; poison damage gains 3% per stack                                                                                               | Existing ranged/poison state                  |
| Ful                       | Abilities gain 15% damage and lose 10 hit-chance points; autos unaffected                                                                                                | Ability source and pre-cap accuracy modifiers |
| Jas dragonbane/demonbane  | Matching target gains 30% damage and 20 hit-chance points                                                                                                                | Target-gated source and accuracy modifiers    |
| Wen                       | Basic-ability hits build 10 Icy Chill; next enhanced/ultimate/special consumes all and grants 15 ticks of +30% base damage and +30 hit-chance points to those categories | Lane-local stacks and buff                    |

Current Elder God dinarrows have requirement tier 95 and stat/damage tier 100. Deathspore and
Splintering are stat tier 95; Black Stone is stat tier 92. Verify exact record bonuses on the item
page rather than deriving them from requirement level.

Primary entry points:

- `https://runescape.wiki/w/Combat_Style_Modernisation`
- `https://runescape.wiki/w/Black_stone_arrows`
- `https://runescape.wiki/w/Deathspore_arrows`
- `https://runescape.wiki/w/Splintering_arrows`
- `https://runescape.wiki/w/Bik_arrows`
- `https://runescape.wiki/w/Ful_arrows`
- `https://runescape.wiki/w/Jas_dragonbane_arrows`
- `https://runescape.wiki/w/Wen_arrows`

## Special-purpose projectiles

These are not all proc ammunition. Preserve their exact numeric projectile record and add runtime
behavior only where a target gate changes legality or damage.

| Projectile                                                              | Current fact                                                                  | Support rule                                                                                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Abyssalbane, basiliskbane, dragonbane, wallasalkibane arrows/bolts      | The generic attuned-bane modifier applies only to the matching creature group | Model only with a sourced target classification                                                   |
| Ice arrows                                                              | Required to damage Fareed, Flambeed, and the Fire Warrior of Lesarkus         | Unsupported until those encounter immunities exist                                                |
| Broad arrows/bolts and royal bolts                                      | Can damage Turoths and Kurasks                                                | Preserve target-eligibility fact; do not invent a general DPS boost                               |
| Fragment arrows                                                         | Bonus against Ascension creatures, described as slightly below tier 80        | Partial until an exact current damage value and rounding path are sourced                         |
| Guthix/Saradomin/Zamorak arrows                                         | Requirement 50 but sourced ability-damage value 792                           | Ordinary runtime mechanic; preserve the explicit bonus instead of forcing standard tier-50 damage |
| Araxyte, stalker, wild, primal, blight, ascension, and royal ammunition | No named outgoing proc beyond their sourced tier or target-eligibility fact   | Ordinary mechanic unless a current item page proves otherwise                                     |

Chinchompas and other thrown weapons are weapon behavior, not ammo-slot projectiles. Bolt pouches
and quiver storage quantities are inventory behavior, not combat-damage state.

Primary entry points:

- `https://runescape.wiki/w/Weapon/Ranged_weapons`
- `https://runescape.wiki/w/Dragon_slayer_(effect)`
- Exact item pages for each attuned-bane or target-restricted projectile

## Enchanted bolts

Activation chance is a fraction in engine code. Apply Elite Seers' Village first as `+0.02`, then
the Ranged cape multiplier `*1.2`:

| Group                                                   | Base | Cape | Elite Seers |  Both |
| ------------------------------------------------------- | ---: | ---: | ----------: | ----: |
| Opal/Jade/Pearl/Topaz/Sapphire/Ruby/Diamond/Dragonstone | 0.05 | 0.06 |        0.07 | 0.084 |
| Emerald                                                 | 0.55 | 0.66 |        0.57 | 0.684 |
| Onyx/Hydrix/Ascendri                                    | 0.10 | 0.12 |        0.12 | 0.144 |

| Effect                       | Current fact                                                                        | Engine shape/support                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Opal, Lucky Lightning        | +10% damage                                                                         | Damage-only source payload                                                                                              |
| Pearl, Sea Curse             | +15% against water weakness; -15% against fire weakness; PvP run prevention         | Target-weakness modifier; PvP control unsupported                                                                       |
| Jade, Earth's Fury           | 4.8-second stun; PvP bind                                                           | Control only; unsupported for outgoing DPS                                                                              |
| Topaz, Down to Earth         | Reduce target Magic by 2 and damage by 1%; caps 10 and 5%                           | Incoming/target-stat state unsupported                                                                                  |
| Sapphire, Clear Mind         | Steal 5% target maximum prayer                                                      | Unsupported until target prayer exists                                                                                  |
| Emerald, Magical Poison      | One poison-type hit for 2%-4% weapon damage; poison modifiers can apply             | Separate non-recursive poison hit, not persistent weapon-poison scheduling                                              |
| Ruby, Blood Forfeit          | Add 25%-125% ability damage based on current target LP; recoil 5% maximum player LP | Future-changing target/player LP; lane-local proc                                                                       |
| Diamond, Armour Piercing     | Perfect accuracy and up to 15% more damage                                          | Keep partial until roll distribution and modifier ordering are proved                                                   |
| Dragonstone, Dragon's Breath | Separate dragonfire hit at 25%; dragons and dragonfire-immune targets block it      | Separate non-recursive hit; verify whether the current source defines triggering hit or current attack before promotion |
| Onyx, Life Leech             | +25% damage; heal 25% of original damage potential, cap 2,500                       | Future-changing player LP; original-potential snapshot                                                                  |
| Hydrix/Ascendri, Deathmark   | Gain 10% adrenaline; for 15 seconds basics grant +1%; reactivation refreshes        | Future-changing lane-local resource clock                                                                               |

Enchanted bakriminel bolts use stat tier 95 with requirement 99. Ascendri bolts use stat tier 94
with requirement 90. Ordinary enchanted variants keep their individually sourced lower tiers while
sharing the named modern effect unless current item text says otherwise.

Eligibility details:

- Effects can trigger on eligible auto and ability hits unless their page narrows the trigger.
- Multi-hit abilities roll each eligible hit. Ricochet-style secondary-target hits roll separately.
- Corruption Shot and Deadshot bleed damage cannot trigger bakriminel effects.
- An ammunition-created separate hit cannot trigger another ammunition effect.
- Inventory bolt consumption, cape recovery, quiver recovery, and Blightbound saving do not change
  simulated DPS while inventory quantities are absent.

Primary entry points:

- `https://runescape.wiki/w/Bolts`
- `https://runescape.wiki/w/Bakriminel_bolts_(type)`
- `https://runescape.wiki/w/Opal_bakriminel_bolts_(e)`
- `https://runescape.wiki/w/Diamond_bakriminel_bolts_(e)`
- `https://runescape.wiki/w/Onyx_bakriminel_bolts_(e)`
- `https://runescape.wiki/w/Template:Enchanted_touch`
- `https://runescape.wiki/w/Update:RuneScape_-_Combat_Update`

## Quivers and weapon capability

| Item/capability          | Current fact                                                                                                           | Model rule                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Tirannwn quiver 1-4      | Ammo storage plus sourced prayer bonuses 1/2/3/4                                                                       | Quiver profile; selected projectile remains separate          |
| Pernix's quiver          | Stores two ammo types, prayer +4, raises only the maximum damage band by 4% of the ability maximum below 25% target LP | Quiver passive and lane-local target-health check             |
| Required bow/crossbow    | Needs compatible arrows/bolts                                                                                          | Missing or wrong family is invalid                            |
| Chargebow/no-ammo weapon | Generates its own projectile                                                                                           | External projectile not required; keep explicit capability    |
| Optional-ammo weapon     | Can use a compatible external projectile or its own profile                                                            | External projectile can clamp tier; absence keeps weapon tier |

Pernix example: a 20%-100% ability range becomes 20%-104%, not 20.8%-104%. Apply the threshold
against current target LP and use the existing target-vitality state.

Primary entry points:

- `https://runescape.wiki/w/Pernix%27s_quiver`
- `https://runescape.wiki/w/Weapon/Ranged_weapons`
