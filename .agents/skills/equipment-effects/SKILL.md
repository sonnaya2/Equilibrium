---
name: equipment-effects
description: Equipment and item mechanics for RS3 Equilibrium. Use when adding or verifying item stats, slots, weapon classes, passive IDs, enchantments, set membership or thresholds, special-attack references, equipment modifiers, procs, or support labels in the combat calculator and simulator.
---

# Equipment effects

Own the boundary from a sourced item fact to its combat behavior. Read `combat-math` for damage,
accuracy, crit, Defence, modifier order, and rounding; read `combat-sim` when an effect changes time,
state, resources, events, or landed-hit behavior; read `data-sync` before changing item records.

## Current path

| Area                                    | Responsibility                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `data/patches/`                         | Authored item and effect facts with sources                                          |
| `src/combat/data/records.ts`            | Slots, bonuses, passive IDs, weapon classes, set IDs, and special-attack references  |
| `src/combat/shared/equipmentStats.ts`   | Pure equipment-stat and weapon-configuration derivation                              |
| `src/combat/shared/equipment.ts`        | Active passives, enchantments, set thresholds, crit/DP modifiers, and support status |
| `src/components/combat/loadoutStats.ts` | The UI-loadout-to-engine-stats boundary                                              |
| `src/combat/engine/`                    | Cast, clock, event, target, and landed-hit behavior; follow `combat-sim`             |

Generated shards and `data/canonical/` are outputs. Never hand-edit them.

## Route each mechanic once

1. **Static item value** — derive it in `equipmentStats.ts`. Weapon accuracy comes from the weapon
   tier/config curve; armour and accessory bonuses remain explicit.
2. **Fixed-loadout passive or set threshold** — derive `ActiveEquipmentEffects` once at tick 0 in
   `equipment.ts`. Count equipped records, not UI unlock pins; do not double-count duplicate IDs.
3. **Pure outgoing modifier** — place it in the existing modifier, crit, or Damage Potential pipeline
   at the exact `combat-math` layer. Flat damage, multipliers, and hit-stage effects are distinct.
4. **Cast-time transition** — use cast preparation/effects for resources, cooldowns, and durations.
5. **Landed-hit effect or proc** — use resolution/landed or a scheduled event. Preserve source-hit
   provenance and proc eligibility; attached damage is not automatically a new hit.
6. **Persistent clock or stack** — store it in `RotationState`, grouped with its style or target
   unless it is genuinely global.
7. **Incoming, defensive, target-specific, or unsupported behavior** — keep the sourced fact and
   label it `not-modeled` or `outgoing-only`. Never turn descriptive text into fake math.

Special attacks belong to the item record, but their hit math follows `combat-math` and timing/state
follows `combat-sim`. Enchantments modify the passive they name; they are not equipment slots.

## Invariants

- Item facts require `SourceReference`. Use `data:find`, `data:context`, and `data:impact`, then the
  canonical validation/export workflow.
- Set activation is a static-loadout calculation until real mid-rotation gear switching exists.
- Keep generic outgoing PvM support separate from player Defence/Armour and incoming-damage support.
- A fact with no supported engine input stays a fact, not an approximation.
- Update the record contract, routing, support label, and focused tests together.

## Verification

Use equipment/loadout tests for static derivation, ability calculation tests for modifier placement,
and simulator state/event tests for procs, clocks, resources, and stacks. Run typecheck after shared
contract changes. A total-damage snapshot alone does not prove correct timing or trigger provenance.
