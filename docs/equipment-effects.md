# Equipment effects

Boundary from a sourced item fact to combat behavior: slots, bonuses, passives, enchantments, set thresholds, special-attack references, and how each routes into hit math or the simulator.

Hit formulas and verification hierarchy: [`combat-model.md`](./combat-model.md). Timing, events, and state: [`combat-engine.md`](./combat-engine.md). Data authoring and provenance workflow: [`data-platform.md`](./data-platform.md).

## Code paths

| Area | Responsibility |
| ---- | -------------- |
| `data/patches/` | Authored item and effect facts with `SourceReference` |
| `data/canonical/` / shards | Generated outputs — never hand-edit |
| `src/combat/data/records.ts` | Type contract: slots, bonuses, passive IDs, weapon classes, set IDs, special-attack refs |
| `src/combat/shared/equipmentStats.ts` | Pure equipment-stat and weapon-configuration derivation |
| `src/combat/shared/equipment.ts` | Active passives, enchantments, set thresholds, crit/DP modifiers, support status |
| `src/combat/shared/equippedState.ts` | Equipped-state helpers |
| `src/components/combat/loadoutStats.ts` | UI-loadout → engine-stats boundary (outside pure combat package) |
| `src/combat/engine/` | Cast, clock, event, target, and landed-hit behavior |

Records carry sourced facts (numbers, unlocks, provenance), **not** executable math. Ingestion supplies candidates; the engine owns verified mechanical rules.

## Item record contract

`EquipmentRecord` (via `records.ts` + generated data) includes among other fields:

- Slot (`mainhand | offhand | twohand | helmet | body | … | ammo`)
- Style, weapon class, shield/defender flags
- Bonuses (explicit overrides when sourced)
- Passive IDs (`ItemPassiveId`)
- Set membership (`setId`)
- Special-attack references
- `sources: SourceReference[]` with mandatory `verifiedAt`

Ability records store per-ability adrenaline, cooldowns, hit bands, and effect ids. Prefer `requiredPassiveAnyOf` over hard-coded item-id lists when multiple items grant the same unlock.

When tooltip text and live mechanic diverge, store both `displayDescription` and `mechanicalImplementation`.

## Route each mechanic once

| Kind | Where it lives |
| ---- | -------------- |
| Static item value | Derive in `equipmentStats.ts`. Weapon accuracy from weapon tier/config curve; armour and accessory bonuses remain explicit. Exact `EquipmentRecord.bonuses` override derived values. Unknown stays null — never invent a zero. |
| Fixed-loadout passive or set threshold | `activeEquipmentEffects` once at tick 0 (`equipment.ts`). Count equipped records via `resolvedEquipmentSlots`, not UI unlock pins. Duplicate item ids count once. |
| Pure outgoing modifier | Existing modifier / crit / Damage Potential pipeline at the correct stage ([`combat-model.md`](./combat-model.md)). Flat damage, multipliers, and hit-stage effects are distinct. |
| Cast-time transition | Cast preparation / effects (resources, cooldowns, durations). |
| Landed-hit effect or proc | Resolution `landed/` or a scheduled event. Preserve source-hit provenance and proc eligibility; attached damage is not automatically a new hit. |
| Persistent clock or stack | `RotationState`, grouped with its style or target unless genuinely global. |
| Incoming, defensive, target-specific, or unsupported | Keep the sourced fact; label `not-modeled` / `outgoing-only`. Never turn descriptive text into fake math. |

Special attacks belong to the item record; hit math follows the combat model; timing/state follows the engine. Enchantments modify the passive they name — they are **not** equipment slots.

## Equipped state resolution

`resolvedEquipmentSlots` is the only correct answer to “what is the player wearing”:

- When `twohand` is occupied, `mainhand` and `offhand` are locked out (persisted loadouts may still store stale one-handers).
- All consumers — stat aggregation, weapon configuration, passives, sets, League blessings that inspect weapons — resolve through this helper.

`wieldedOffhandKind` returns `"shield" | "defender" | null` from the equipped record’s own classification (Bone Shield without a real shield does not read as wielded shield; conduits are neither).

## Stats derivation (`equipmentStats.ts`)

- Armour tier base: `f(t) = t³/500 + 10t + 100` (equivalent to `2.5 × accuracyCurve(t)`).
- Class armour tier: tank `t`, power `t−5`, hybrid `t−15`, PvP `t`.
- Slot multipliers (head 0.2, body 0.23, legs 0.22, hands/feet 0.05, cape 0.03, ring 0.02, shield 0.2).
- Armour and damage floor to one decimal (`floorOneDecimal`); life points are integers.
- Weapon accuracy slots (`mainhand` / `offhand` / `twohand`) already feed `playerAccuracy(level, weaponTier)` — do not double-count Accuracy bonuses from those slots.

Style damage on armour/accessories is **not** folded into base ability damage; AD stays level + weapon tier driven.

Post–9 Mar 2026 rebalance realigned bonuses to tier across armour, rings, amulets, pocket, Necromancy, and hybrid gear. Never use a 2024/2025 gear spreadsheet.

## Sets and activation

- Catalogue: combat-relevant sets only (shard / `EQUIPMENT_SETS` in `equipment.ts`).
- Activation mode: **`pre-activated-static-loadout`** — set bonuses are a static loadout calculation until mid-rotation gear switching exists.
- Effects kinds include `critChancePerPiece`, `damageMult`, `damageMultPerPiece` (optional context gates e.g. Tumeken + Sunshine).
- Set crit bonuses feed `CritLayers.chance`, not the damage modifier pipeline.
- Piece counting: `equippedSetCounts` from `setId`; special weights (e.g. Visage of the First Necromancer counts 2) live in `SET_PIECE_WEIGHTS`. Cap at set `maxPieces`.

Example of derived active fields on `ActiveEquipmentEffects`:

- `passiveIds`, `enchantments`
- `weaponClass`, `defenderEquipped`
- Passage / Agony coupling for Gloves of Passage
- Am-zi flat damage / Am-hej damage bonus from effective levels
- Vestments of Havoc piece thresholds (Herald of Chaos, Berserk extension, adrenaline cap)

## Enchantments

Known ids: `agony | heroism | shadows | metaphysics`. They gate or modify the passive they attach to (e.g. Agony + Passage). Tracked on the loadout and on `ActiveEquipmentEffects`, not as slots.

## Invention and on-hit procs

Crackling / Aftershock ranks enter via `SimulateInput.procs` and simulation invention state. Proc resolution:

- Uses landed-hit eligibility and provenance ([`combat-engine.md`](./combat-engine.md) hit-count integrity).
- Does not treat attached damage components as extra proc rolls.
- Cooldown / charge clocks live under `RotationState.invention`.

Perks such as Precise (min-hit raise before pipeline), Impatient, and Relentless are configured on the simulation input; state-changing ranks use probability branching, not flat EV that spends resources no real branch would have.

## Bleed duration extension and similar passives

Ability metadata may declare equipment-gated duration rules (e.g. `bleedDurationExtension: { equipmentPassive: "masterwork-spear-bleed-extension" }`). Scheduling reads metadata; it does not hardcode ability ids for eligibility. Shared helpers (e.g. `shared/bleedDurationExtension.ts`) apply when the passive is active.

## Support status for equipment-backed mechanics

Same honesty labels as abilities:

- Fully modeled (no `supportStatus`) within generic outgoing PvM scope
- `partially-modeled` / `not-modeled` / `mechanics-unverified`

Keep generic **outgoing** PvM support separate from player Defence/Armour and incoming-damage support. A fact with no supported engine input stays a fact, not an approximation.

Update **record contract, routing, support label, and focused tests** together.

## Invariants

1. Item facts require `SourceReference`. Prefer `npm run data:find` / `data:context` / `data:impact`, then validated patches and canonical export — never rewrite generated full datasets by hand.
2. Set activation is static-loadout until gear switching is modeled mid-rotation.
3. Weapon Accuracy from tier curve is not double-counted with weapon-slot Accuracy bonuses.
4. Attached damage ≠ new hit for procs, stacks, adrenaline, counters, or extension counts.
5. Special-attack damage and timing follow combat-model + combat-engine, not a parallel formula tree.
6. Unrevealed or unsupported numbers stay empty or labeled — never invented fillers.

## Testing expectations

| Layer | What to pin |
| ----- | ----------- |
| Equipment / loadout | Static derivation, twohand lockout, set piece counts, passive activation thresholds |
| Ability calculation | Modifier stage placement, flat vs mult, crit chance from sets |
| Simulator | Procs, clocks, resources, stacks, provenance, cancel/replace schedules |

A total-damage snapshot alone does not prove correct timing or trigger provenance. After shared contract changes, run typecheck.

## Related

- [`combat-model.md`](./combat-model.md)
- [`combat-engine.md`](./combat-engine.md)
- [`data-platform.md`](./data-platform.md)
- [`canonical-data.md`](./canonical-data.md)
)
