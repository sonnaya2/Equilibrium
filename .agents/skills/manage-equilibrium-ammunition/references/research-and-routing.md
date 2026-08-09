# Ammunition research and routing

## Source workflow

1. Search the exact current RuneScape Wiki title with `site:runescape.wiki`, then open the page.
2. Open the item's `Passive effect`, `Damage analysis`, `Combat stats`, `Changes`, and reference
   sections. Record requirement and combat/stat tier separately.
3. Open the named effect page or template. Templates often hold activation chances and shared
   mechanics that item pages duplicate incompletely.
4. Search official RuneScape news and current patch notes for changes after the item's release.
5. Check the Wiki page history or an `oldid` when a search result may be stale. Record `accessedOn`.
6. Use the aggregate pages only to discover candidates; verify exact facts on item/effect pages.

Useful entry points:

- `https://runescape.wiki/w/Bolts`
- `https://runescape.wiki/w/Bakriminel_bolts_(type)`
- `https://runescape.wiki/w/Combat_Style_Modernisation`
- `https://runescape.wiki/w/Weapon/Ranged_weapons`
- `https://runescape.wiki/w/Hit_chance`
- `https://runescape.wiki/w/Pernix%27s_quiver`
- `https://runescape.wiki/api.php?action=parse&page=TITLE&prop=wikitext&format=json`

Replace `TITLE` with an encoded exact page title when normal page extraction omits a table. Do not
cite a search-result snippet as the source. Never substitute an Old School RuneScape page.

## Conflict policy

Use this precedence when sources disagree:

1. Newer official RuneScape patch notes for changed values or chronology.
2. Current Wiki item/effect/template text with explicit formula, timing, or test evidence.
3. Current aggregate Wiki tables for catalogue coverage and discovery.
4. Historical pages only to explain a transition, never as current behavior.

If a current formula, random distribution, rounding point, or eligibility exception remains
ambiguous, keep the record `partially-modeled` or `unsupported`. State the unresolved fact in the
support note and add a focused research test or TODO outside production comments.

## Fact sheet

Capture these fields before implementation:

| Fact         | Required detail                                                                  |
| ------------ | -------------------------------------------------------------------------------- |
| Identity     | Canonical item ID, exact display name, variant, family                           |
| Tiers        | Requirement tier, stat/damage tier, numeric damage bonus                         |
| Capability   | Required/optional/none; arrows/bolts; chargebow exception                        |
| Trigger      | Per landed hit/per cast/per crit; ability/auto; multi-hit and AoE rules          |
| Chance       | Base fraction, cape/achievement modifiers, cap, order                            |
| Payload      | Source multiplier, ability-damage addition, separate hit, resource, heal, debuff |
| Ordering     | Accuracy stage, DP stage, crit, caps, floors, event tick                         |
| State        | Stack cap, duration, refresh, cooldown, expiry convention, reset                 |
| Targets      | Race, weakness, immunity, PvM/PvP, poisonability                                 |
| Interactions | Quiver, poison modifiers, equipment passives, consumption saving                 |
| Support      | Modeled/partial/unsupported and the exact missing consumer                       |

## Repository discovery

Run narrow discovery before edits:

```text
git status --short
git worktree list --porcelain
rg -n "ammo|ammunition|quiver|StyleAmmoId" src data/patches
npm run data:find -- --query "<item or effect>"
npm run data:context -- --id item:<slug>
npm run data:impact -- --id item:<slug>
```

Inspect the current `EquipmentRecord`, loadout normalization, weapon configuration, resolved combat
model, simulation contract, worker serializer/revival, solver identity, UI fingerprint, landed-hit
resolution, and analysis attribution. Do not design from a stale file list.

## Data path

Author a dated `data/patches/*.jsonl` patch with source records. Apply the repository's documented
data-sync workflow, then verify each record directly:

```text
npm run data:rebuild
npm run data:canonical:export
npm run data:show -- --id item:<slug>
npm run data:canonical:validate
npm run audit:data
npm run data:doctor
```

Patch and canonical outputs ship together only after shared data owners release the files. Never
mutate an applied patch to rewrite provenance and never hand-edit generated output.

## Engine routing decision

| Mechanic shape                    | Route                                                    |
| --------------------------------- | -------------------------------------------------------- |
| Projectile tier/capability        | Equipment resolution and base weapon profile             |
| Fixed loadout passive             | `ActiveEquipmentEffects` or resolved ammo/quiver profile |
| Source damage/accuracy modifier   | Existing modifier or hit-chance pipeline                 |
| Damage-only landed proc           | Landed boundary plus expected-value payload              |
| Separate proc hit                 | Scheduled event with non-recursive provenance            |
| Future adrenaline/LP/stack/debuff | Lane-local state and deterministic ensemble              |
| Target armour change              | Target state; recompute later hit chance before cap      |
| Unsupported incoming/control fact | Data/support output only                                 |

Do not compute combat math in React, duplicate formulas in the worker, or reconstruct weighted totals
from the most common sampled history.

## Evidence tests

Prefer behavior assertions over snapshots alone:

- exact intermediate tiers, chance fractions, floors, and half-open ticks;
- trigger counts for multi-hit, secondary, attached, bleed, poison, and proc-hit cases;
- state before/after activation, expiry, refresh, cap, death, and clear;
- 128-lane deterministic repeat and probability-mass invariants for future-changing RNG;
- score-only damage parity with presentation ledgers intentionally absent;
- support/presentation text that does not claim disconnected mechanics are modeled.
