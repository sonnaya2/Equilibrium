---
name: manage-equilibrium-ammunition
description: Research, add, integrate, or review ranged ammunition and quivers in RS3 Equilibrium. Use for arrows, bolts, enchanted and bakriminel effects, ammunition tiers and weapon compatibility, chargebows, quiver selection, ammunition proc eligibility, landed-hit routing, ammunition RNG or state, loadout persistence, support labels, and ammunition data patches.
---

# Manage Equilibrium ammunition

Model one ammunition identity from sourced data through loadout selection, combat execution, solver
serialization, and UI presentation. Do not maintain a second UI-only ammunition catalogue.

## Runtime role gate

Fresh implementation workers are Luna-only. Sol and Terra may use this skill to research,
coordinate leases, review diffs, and accept or reject a delivery, but they must not start ammunition
implementation in a new worker chat.

Before any repository access, project-instruction read, command, test, or edit in every worker turn:

1. Require a registration message containing the worker task ID, source-owner task ID/host, and the
   expected runtime `gpt-5.6-luna/xhigh`. An unregistered bootstrap turn may only reply that it is
   awaiting registration.
2. Locate the registered task's rollout JSONL under the Codex sessions or archived-sessions roots.
3. Read the newest `turn_context.payload.model` and `.effort` for the current turn. Prompt text and
   thread titles are not identity evidence.
4. Continue only when the values are exactly `gpt-5.6-luna` and `xhigh`.
5. On Sol, Terra, another model, missing metadata, or mismatched effort, send the source owner one
   fail-closed callback with `status: wrong_model`, task ID, observed model/effort, expected model,
   no repository access, no files touched, and the next action `retry with Luna XHigh`; then stop.

Repeat the gate at the start of every follow-up turn. Never infer that a prior Luna turn proves the
current turn. Use `orchestrate-luna` for task creation, registration, callbacks, correction rounds,
and archival.

## Read first

- Read `references/mechanics.md` for any named ammunition or quiver effect.
- Read `references/research-and-routing.md` before researching, implementing, or reviewing a mechanic.
- Read `data-sync` before changing equipment data, `equipment-effects` for item routing,
  `combat-math` for tier/damage/accuracy layers, and `combat-sim` for time, state, or RNG.
- Read `equilibrium-ui` for loadout controls and `test-maintainer` before Vitest or Playwright work.

## Workflow

1. Inspect `git status --short` and current owners before edits. Preserve every unrelated shared-main
   hunk; do not assume a clean-looking generated file is yours.
2. Classify the subject as projectile data, weapon capability, quiver/storage, a passive modifier,
   a damage proc, or future-changing state. A single item can occupy more than one class.
3. Build a fact sheet from current sources: item ID/name, family, requirement tier, stat/damage tier,
   weapon compatibility, proc chance, eligibility, damage layer, rounding, duration, reset rules,
   target restrictions, interactions, and support status.
4. Resolve contradictions before coding. Prefer newer official patch notes over stale item prose; use
   the current Wiki item/effect/template pages to fill details. Never use OSRS mechanics.
5. Patch authored data through dated JSONL. Never hand-edit `data/canonical/` or generated shards.
6. Resolve equipment records once into a compact immutable ammunition profile. Persist only the
   selected projectile ID for a real quiver; derive family, mechanic, tier, passives, and capability.
7. Route the mechanic at its real engine boundary. Keep static source modifiers, landed procs,
   separate hits, clocks, and resources distinct.
8. Add behavior tests at the owning layer and parity tests across Manual/Revolution, host/worker,
   fingerprints, and solver identity.
9. Rebuild, export, validate, audit, and run focused combat gates after shared data ownership clears.

## Tier and compatibility law

- `requirementTier` is legality only. Never use it as projectile damage tier.
- Resolve projectile stat tier from `damageTier ?? tier`. Preserve sourced numeric damage bonuses;
  do not reverse-engineer a tier from a rounded bonus when a source provides the tier.
- For compatible external ammunition, effective ranged profile tier is
  `min(weaponProfileTier, projectileStatTier)` at the existing weapon-damage seam.
- A required-ammunition bow or crossbow without a compatible projectile is invalid, not a
  chargebow. An optional/no-ammunition weapon keeps its weapon tier when the capability permits it.
- Match explicit `arrows` or `bolts` capability. Do not infer compatibility from item names.
- A quiver is not a projectile and contributes no projectile tier. Resolve its selected projectile,
  accepted families, and passive IDs separately.
- Keep manual tier inputs only as an intentional compatibility fallback; selected canonical
  equipment outranks them.

## Eligibility law

Start with a ranged, proc-eligible, landed player attack. Require direct-hit provenance and reject
attached riders. Then apply the named mechanic's exceptions from `references/mechanics.md`.

- Multi-hit abilities roll or apply once per eligible landed hit unless the source says per cast.
- Secondary-target hits are their own eligible hits when their provenance remains a player attack.
- Bleeds, DoTs, reflected damage, poison ticks, conjure damage, attached bonus riders, and
  ammunition-created separate hits do not recursively trigger ammunition by default.
- An attached rider inherits its parent crit outcome but is not a second ammunition trigger.
- Black Stone changes later hits, not the hit that applied the reduction.
- Inventory consumption and ammunition saving are not DPS semantics. Keep those facts sourced and
  unsupported until the app has an inventory resource model.

## RNG and state routing

- Keep damage-only RNG in expected-value math when it cannot change later state.
- Use the deterministic 128-lane stratified ensemble when a proc changes future adrenaline, life
  points, target armour, stacks, buffs, cooldowns, or later eligibility.
- Store each clock/stack/resource in its owning lane-local `RotationState`; normalize expired clocks.
- Schedule a distinct proc hit as an event with its own origin and `procEligible: false`. Do not
  disguise it as an attached multiplier or allow it to reopen the ammunition proc.
- Apply source-hit modifiers at the established modifier layer and preserve floor chains, crit
  layers, Damage Potential, hit caps, and receiving-effect analysis attribution.

## Loadout and serialization

- The ammo slot holds either a projectile or a quiver. A quiver selection stores only
  `selectedAmmunitionId`; clear it when the equipped ammo-slot item is not a quiver.
- Normalize renamed catalogue IDs at the saved-loadout boundary and preserve old art through the
  existing icon-alias seam.
- Remove independent Rotation UI ammunition overrides. Manual and Revolution consume the same
  resolved profile from the loadout.
- Serialize compact facts only. Never send `EquipmentRecord`, source text, or UI catalogue objects to
  solver workers. Ammunition is part of request identity, not a solver decision variable.

## Support labels

- `modeled`: the sourced fact reaches production runtime and presentation with behavior tests.
- `partially-modeled`: data or a pure descriptor exists, but a trigger, state path, interaction, or
  output remains disconnected.
- `unsupported`: preserve the fact and say which missing engine input prevents honest modeling.

Never promote a non-ordinary mechanic because a helper exists. Catalogue presence, a typed
descriptor, or a total-damage approximation is not runtime support.

## Verification

At minimum, test:

- direct projectile versus the same projectile selected inside a compatible quiver;
- required, optional, no-ammunition, wrong-family, and missing-ammunition capability cases;
- weapon/projectile tier clamping and requirement-tier separation;
- one-hit, multi-hit, secondary-target, attached, DoT, and recursive-proc eligibility;
- exact proc chance modifiers and fraction/percent conversion;
- half-open clock expiry, refresh, cap, reset, and deterministic repeated runs;
- Manual/Revolution and host/worker parity plus solver/fingerprint identity changes;
- support labels, source references, patch IDs/indices, and canonical export drift.

Use focused tests first, then the matching repository gates. `npm run audit:comments` is mandatory;
do not weaken it or add narrative comments to explain the implementation.
