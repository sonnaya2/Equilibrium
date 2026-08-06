# Player-applied poison implementation plan

Status: implemented and verified on 2026-08-06
Research baseline: 2026-08-06
Scope: player-applied weapon poison, Cinderbane gloves, upgraded bone blowpipe, Laniakea's spear, Kwuarm incense, Bik arrows, poison susceptibility, and Envenomed

This is the implementation record and original design handoff. Production wiring now covers the resolved model, worker identity, exact state-changing branches, analysis UI, all four potion tiers, Envenomed, and target poison immunity. Cinderbane's Wiki-marked unclear 16-tick guarantee remains the only equipment support exclusion.

## Ownership

- **Sol:** design and review. Validate architecture, source decisions, phase boundaries, and acceptance criteria. Sol does not implement or mutate the checkout.
- **Codex:** implementation. Codex makes all production/data/UI changes, runs verification, and reports the final diff and support status.
- **Luna:** no role in this work.

## Start here in the new chat

1. Read `AGENTS.md` and `.grok/skills/equilibrium-poison/SKILL.md` completely. The skill requires `.grok/skills/equilibrium-poison/references/mechanics.md` as well.
2. Run `git status --short` and `git worktree list --porcelain`. This is a shared `main` checkout and had concurrent edits in `damageProvenance.ts`, `branchKey.ts`, and League combat files when this plan was written. Preserve them.
3. Recheck the current Jagex combat-modernisation notes, RuneScape Wiki pages, and PVME page listed below before changing mechanics. Current official values outrank stale Wiki calculators or guides.
4. Implement one phase at a time. Do not expose a UI control as modeled until its value reaches the resolved model, main-thread simulation, worker simulation, identity, and analysis output.
5. Keep Putrid Zombie poison separate. Its event family is architectural evidence, not a player-poison implementation to reuse wholesale.

## 1. Research findings

### Source authority

Use sources in this order:

1. Current Jagex patch notes or item text.
2. Current RuneScape Wiki mechanics pages.
3. PVME for behavior Jagex does not document.
4. A reproducible live-game fixture for unresolved timing, rounding, or reset semantics.

Primary references:

- Jagex combat modernisation: <https://secure.runescape.com/m=news/patch-notes-part-2---combat-style-modernisation>
- Jagex Kwuarm item text: <https://secure.runescape.com/m=itemdb_rs/Kwuarm+incense+sticks/viewitem?obj=47709>
- Poison: <https://runescape.wiki/w/Poison>
- Weapon-poison comparison: <https://runescape.wiki/w/Template:Weapon_poison_compare>
- Cinderbane gloves: <https://runescape.wiki/w/Cinderbane_gloves>
- Upgraded bone blowpipe: <https://runescape.wiki/w/Upgraded_bone_blowpipe>
- Laniakea's spear: <https://runescape.wiki/w/Laniakea%27s_spear>
- Kwuarm incense sticks: <https://runescape.wiki/w/Kwuarm_incense_sticks>
- Bik arrows: <https://runescape.wiki/w/Bik_arrow>
- PVME poison mechanics: <https://pvme.io/pvme-guides/miscellaneous-information/mechanics/>

### Confirmed tier and duration model

The `50-250` values are tier scalars, not literal fixed hit damage.

| Active source                    | Tier | Tier scalar | Base coefficient |           Player buff duration | Initial min / average / max |
| -------------------------------- | ---: | ----------: | ---------------: | -----------------------------: | --------------------------: |
| Weapon poison                    |    1 |          50 |              20% |        250 ticks / 2.5 minutes |           13% / 19.5% / 26% |
| Weapon poison+                   |    2 |         100 |              25% |          500 ticks / 5 minutes |    16.25% / 24.375% / 32.5% |
| Weapon poison++                  |    3 |         150 |              30% |       1,000 ticks / 10 minutes |        19.5% / 29.25% / 39% |
| Weapon poison+++                 |    4 |         200 |              35% |       1,200 ticks / 12 minutes |    22.75% / 34.125% / 45.5% |
| Cinderbane alone                 |    2 |         100 |              25% |                 While equipped |    16.25% / 24.375% / 32.5% |
| Weapon poison+++ plus Cinderbane |    5 |         250 |              40% | Potion duration while equipped |             26% / 39% / 52% |

The potion duration is the player's opportunity to make poison-application rolls. A successful application creates or refreshes a separate 300-tick target status.

### Application, cadence, refresh, and decay

- A qualifying landed hit makes one effective poison-application roll at 1/8, or 12.5%.
- Laniakea's spear adds 5 percentage points, producing 17.5%. It does not create a poison source by itself.
- A successful application schedules the first poison hit two ticks later.
- That delayed application hit is hit 1 of the total 18-hit sequence. It is not a nineteenth hit.
- Standard poison schedules the remaining hits every 16 ticks, or 9.6 seconds. With an application at tick 0, uninterrupted hits land at ticks `2, 18, 34, ..., 274`.
- Reapplication while poisoned schedules its additional hit two ticks later, renews the 300-tick status, cancels and replaces the pending ordinary poison event, resets the hit budget, and resets the decay index to zero.
- Standard poison has 18 total hits after each application. Blowpipe poison has 36 over the same status, at an 8-tick cadence.
- Schedule only the next poison event. Do not enqueue an entire three-minute tail.

For zero-based poison hit index `i`:

```text
tierCoefficient = [0.20, 0.25, 0.30, 0.35, 0.40][tier - 1]
minimumFactor = 0.65 - 0.015 * i
maximumFactor = 1.30 - 0.03 * i
expectedFactor = (minimumFactor + maximumFactor) / 2

minimumDamage = abilityDamage * tierCoefficient * minimumFactor
expectedDamage = abilityDamage * tierCoefficient * expectedFactor
maximumDamage = abilityDamage * tierCoefficient * maximumFactor
```

The supported sequences never require an invented lower-bound clamp. At standard hit 18 (`i = 17`) and blowpipe hit 36 (`i = 35`), both factors remain positive. Refresh resets `i` before any unsupported negative range can occur.

Required unmodified numeric fixtures:

| Case           | Minimum |  Average | Maximum |
| -------------- | ------: | -------: | ------: |
| Tier 1, hit 1  |     13% |    19.5% |     26% |
| Tier 2, hit 1  |  16.25% |  24.375% |   32.5% |
| Tier 3, hit 1  |   19.5% |   29.25% |     39% |
| Tier 4, hit 1  |  22.75% |  34.125% |   45.5% |
| Tier 5, hit 1  |     26% |      39% |     52% |
| Tier 4, hit 2  | 22.225% | 33.3375% |  44.45% |
| Tier 4, hit 18 | 13.825% | 20.7375% |  27.65% |

Damage-range RNG is damage-only and stays expected-value. Keep min and max for analysis; do not branch on the 65-130% roll.

### Named integrations

#### Cinderbane gloves

- Cinderbane supplies the 1/8 roll and tier 2 when it is the only poison source.
- With another poison source it raises the effective tier by one, capped at tier 5.
- Cinderbane plus a potion uses one application roll, not one potion roll plus one Cinderbane roll.
- A successful reapplication to an already-poisoned target creates the delayed additional hit and refresh described above.
- A Cinderbane poison hit can itself make the continuation roll. This can repeat through further two-tick application hits.
- For continuation chance `p`, the expected number of extra continuation hits is `p / (1 - p)`: `1/7` at 12.5%, or `7/33` at 17.5%. This is a test oracle only. It cannot replace stateful branching because every success resets timing, hit budget, and decay.

The Wiki's reported guaranteed activation after 16 ticks is marked as needing clarification and does not define the clock anchor, qualifying activity, or reset. Do not implement bad-luck protection until a live fixture resolves those semantics.

#### Upgraded bone blowpipe

- Supplies inherent tier 1 poison.
- Existing data already records explicit accuracy `2458` and damage `1224`; retain those separate sourced bonuses rather than flattening its tier 90 accuracy and tier 85 damage into one mechanic value.
- Halves all player weapon-poison damage from the equipped profile, including Cinderbane poison.
- Changes target-poison cadence from 16 ticks to 8 ticks and therefore produces 36 hits over the same 300-tick status.
- Does not double the poison application chance or Cinderbane continuation chance.

#### Laniakea's spear

- Adds 5 percentage points to the single application or Cinderbane-continuation roll: 12.5% becomes 17.5%.
- Multiplies player weapon-poison damage by 1.05.
- Requires another active poison source; the spear alone does not start poison.

#### Kwuarm incense

- Potency is an integer from 0 through 4.
- Damage bonus is 2.5% per potency: `0%, 2.5%, 5%, 7.5%, 10%`.
- Lighting begins at potency 1 for 10 minutes and rises one level every 10 minutes. Extra sticks add 10 minutes up to 60 minutes. Overloading consumes six sticks and begins at potency 4 with 10 minutes.
- Initial Equilibrium support should select the current potency in Buffs. Do not simulate stick consumption or potency progression until the product supports mid-buff elapsed-time scenarios.

#### Bik arrows and Evolving Toxin

- Bik arrows do not create poison by themselves.
- Current post-2-March-2026 values are 150 stacks and +3% poison damage per stack, up to +450% or a `5.5x` total multiplier.
- Every qualifying ability hit adds one stack and refreshes the whole stack set.
- All stacks expire together after 50 ticks without a refresh.
- Multi-hit abilities add a stack per qualifying landed hit.
- Post-modernisation Basic Attacks qualify; removed legacy auto-attacks do not.
- State is target-owned. The current engine simulates one target, so target switching means a new target runtime. Do not build a target-id map before multi-target rotations exist.
- Bleed ticks, attached or derived components, and converted channels need explicit post-modernisation eligibility fixtures before being labeled fully supported.

### Trigger boundary

Add explicit provenance capabilities rather than checking ability IDs or reusing `procEligible`:

- `canApplyWeaponPoison`: a landed damage event may make the single application roll while a poison source is active.
- `canApplyEvolvingToxin`: a landed ability hit may add a Bik stack while Bik arrows are active.

Initial support must be table-driven and tested by provenance kind. Direct player ability hits and each independent hit of a multi-hit ability qualify. Player poison only qualifies for Cinderbane continuation. Putrid Zombie poison does not. Attached components do not get a second roll merely because they add damage. Equipment, reflection, bleed, derived, and converted-channel classes must be enabled only where the source audit explicitly supports that class.

### Modifier boundary

Use this order for a poison hit, without inventing intermediate floors:

1. Ability damage at the poison land tick.
2. Effective tier coefficient.
3. Decaying min, expected, or max factor.
4. Blowpipe `0.5x` if the applying profile used it.
5. Laniakea `1.05x` if active on the applying profile.
6. Kwuarm `1 + 0.025 * potency`.
7. Target-global poison multipliers at land time: Evolving Toxin and Vulnerability.

Do not apply Accuracy or Damage Potential again. Poison does not crit or miss and does not use ordinary prayers, ability windows, hit caps, life steal, resource generation, invention procs, blessing on-hit rolls, or generic recursive damage. Add only a sourced exception.

### Source conflicts and open gates

| Topic                        | Decision                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kwuarm                       | Jagex and Wiki say 2.5% per potency. PVME's 2% line conflicts with its own 10% level-4 cap and is rejected.                                                                |
| Bik                          | Jagex's 150 stacks and +3% per stack supersede older 200-stack / +2% references.                                                                                           |
| Cinderbane chance            | Current Wiki and PVME say 1/8. Ignore older 1/6 guides.                                                                                                                    |
| PVME 19.5% poison            | This is tier 1's average, not a fixed hit.                                                                                                                                 |
| Application hit count        | Project requirement: the +2-tick application hit is hit 1 of 18, not an extra nineteenth hit.                                                                              |
| Cinderbane 16-tick guarantee | Do not implement until live-game anchor and reset behavior are known.                                                                                                      |
| Integer rounding             | Keep current min/expected/max arithmetic unrounded until a live fixture proves the floor chain. Never collapse a later proven floor chain.                                 |
| Ability-damage snapshot      | Resolve from the current land-time ability-damage helper initially. Mark gear or temporary-level snapshot semantics provisional until a swap/window fixture confirms them. |
| Bik ambiguous hit classes    | Keep support labels provisional and the capability false until a current fixture resolves each class.                                                                      |

## 2. Current architecture map

| Concern                | Existing path                                                                                                                                                                      | Reuse or required change                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persisted buff inputs  | `src/components/combat/loadout/model.ts`, `src/components/combat/loadout/useLoadout.ts`                                                                                            | Add normalized weapon-poison selection and Kwuarm potency. Preserve old saves with `none` and `0`.                                                    |
| Buff controls          | `src/components/combat/BuffsPanel.tsx`                                                                                                                                             | Add a weapon-poison selector and potency `0-4`; no React-side formulas.                                                                               |
| Poison immunity        | `src/components/combat/TargetPanel.tsx`, `src/components/combat/loadout/model.ts`, `resolveStages.ts`                                                                              | The checkbox exists. Carry it into the resolved model and both simulator paths.                                                                       |
| Equipment effects      | `src/combat/data/records.ts`, `src/combat/passives/`, `src/combat/shared/equipment.ts`                                                                                             | Add data-backed passive IDs for Cinderbane, blowpipe, and Laniakea. Do not add item-ID conditionals to the engine.                                    |
| Ammo                   | `src/combat/styles/ranged/ammoModel.ts` and current `ammo` unions                                                                                                                  | Add `bik`; derive it from the ammo slot and preserve manual/solver parity.                                                                            |
| UI to domain           | `src/components/combat/toResolvedCombatModel.ts`, `src/combat/model/contracts.ts`, `resolve.ts`                                                                                    | Compile one immutable player poison profile and target susceptibility into `ResolvedCombatModel`.                                                     |
| Main/worker payload    | `src/combat/model/simulationInput.ts`, `simulationBase.ts`, `src/components/combat/solverSnapshot.ts`, `src/combat/solver/packRequest.ts`, `identity.ts`, `worker/serializable.ts` | Carry every poison field, include it in canonical identity, and bump `SOLVER_SCHEMA_VERSION`.                                                         |
| Damage classification  | `src/combat/shared/damageProvenance.ts` and eligibility matrices                                                                                                                   | Add `player_poison`, `canApplyWeaponPoison`, and `canApplyEvolvingToxin`. Keep `conjure_poison` unchanged.                                            |
| Target state           | `src/combat/engine/runtime/state.ts`                                                                                                                                               | Add target weapon-poison and Evolving Toxin state with inactive constructors.                                                                         |
| Event queue            | `src/combat/engine/runtime/events.ts`                                                                                                                                              | Reuse `(tick, seq)`, cloning, `cancelBySeq`, and `cancelWhere`. Add player-poison origin/metadata only where analysis needs it.                       |
| Current poison routing | `runtime/clock.ts` and `simulation/lengLandBranch.ts` route every `family === "poison"` to `processSpiritEvent`                                                                    | Dispatch by provenance. `conjure_poison` goes to the zombie scheduler; `player_poison` goes to the player-poison scheduler.                           |
| Recurring effects      | `src/combat/engine/schedulers/conjures.ts`                                                                                                                                         | Reuse the one-next-event scheduling pattern, not zombie damage values or spirit identity. Add a separate player-poison scheduler.                     |
| Stateful land RNG      | `src/combat/engine/simulation/lengLandBranch.ts`, `branchCore.ts`, `branch.ts`                                                                                                     | Add poison success/failure expansion after the parent event is recorded. This is already the branch-aware event clock despite the legacy filename.    |
| Branch equivalence     | `src/combat/engine/simulation/branchKey.ts`                                                                                                                                        | Include live poison profile/state, pending poison future, and live Bik stacks/expiry. Normalize expired states to inactive.                           |
| Land-time base AD      | private helpers in `src/combat/engine/resolution/castHit.ts`                                                                                                                       | Extract or expose the existing Naragi-aware base-at-land helper; do not duplicate temporary-level logic.                                              |
| Accounting and output  | `src/combat/engine/analysis/`, `simulation/summary.ts`, `src/components/combat/RotationAnalysis.tsx`, timeline/source presentation                                                 | Attribute player poison separately and expose weighted applications, hits, damage, current decay, tier, proc chance, Bik stacks, and remaining ticks. |

The key pipeline is:

```text
Loadout buffs + resolved equipment/ammo + target
  -> ResolvedCombatModel
  -> serializable simulation base + canonical identity
  -> landed eligible event
  -> record parent damage and ordinary landed effects
  -> exact poison application branch
  -> target poison state + one queued +2 event
  -> player-poison scheduler resolves expected min/average/max at land
  -> advance or refresh target state, then optional Cinderbane continuation branch
  -> accounting, source breakdown, event timeline, solver weighted summary
```

## 3. Gap and risk analysis

### Reusable architecture

- Immutable `RotationState.target` already owns target debuffs.
- `EventQueue` already supports deterministic same-tick order, branch cloning, and cancellation.
- Existing recurring schedulers prove the one-next-event pattern.
- Provenance capabilities already centralize hit eligibility.
- The branch engine already expands state-changing RNG, exactly merges equivalent futures, caps live classes, and reports residual probability mass.
- The resolved-model and worker projection tests already enforce main-thread/worker parity.
- The target UI already has a poison-immunity control.

### Missing pieces

- No player-poison source/profile contract.
- No player-poison provenance or poison/Bik eligibility capabilities.
- No target weapon-poison or Evolving Toxin state.
- No player-poison event dispatcher; the current `poison` family assumes Putrid Zombie.
- No model, worker, identity, or solver fields for poison.
- No Bik ammo variant in the current style-ammo union.
- No player-poison accounting or UI presentation.

### Highest risks

1. **Branch explosion:** every eligible hit can refresh future state, and Cinderbane poison can continue recursively. Do not flatten this to expected DPS. Exact-merge after every land, use the existing branch budget, and expose residual mass.
2. **Wrong refresh ordering:** a refresh must replace the pending ordinary hit. Leaving both queued creates duplicate tails and more than 18 or 36 hits per sequence.
3. **Conjure contamination:** routing all `family: poison` events through the zombie handler would corrupt player-poison state and attribution.
4. **Main/worker drift:** omitting one field from packing or identity can make the solver reuse a result for a different poison setup.
5. **Same-tick ordering:** multi-hit casts and a poison event can share a tick. Preserve `(tick, seq)` order and test reapplications on the same tick.
6. **Dynamic versus snapshotted modifiers:** target-global Bik/Vulnerability must resolve at poison land. Source tier, cadence, and gear modifiers belong to the applying profile. Ability-damage snapshot and integer floors remain provisional until fixtures settle them.
7. **Eligibility overreach:** `procEligible` includes mechanics poison must not inherit. Use dedicated capabilities and an audited matrix.
8. **Analysis dishonesty:** branch-capped runs must not present a representative timeline as the full probability distribution. Preserve current proof/residual labels.
9. **Concurrent work:** `damageProvenance.ts` and `branchKey.ts` were already dirty. Re-read their current state before editing and integrate rather than overwrite.

## 4. Recommended design

### Domain input

Keep one compact, serializable profile. Names may follow current conventions, but the responsibilities should remain:

```ts
type WeaponPoisonChoice =
  "none" | "weapon" | "weapon-plus" | "weapon-plus-plus" | "weapon-plus-plus-plus";
type PoisonTier = 1 | 2 | 3 | 4 | 5;
type KwuarmPotency = 0 | 1 | 2 | 3 | 4;

interface ResolvedPlayerPoisonProfile {
  potion: WeaponPoisonChoice;
  potionUntilTick: number;
  kwuarmPotency: KwuarmPotency;
  cinderbane: boolean;
  blowpipe: boolean;
  laniakea: boolean;
}
```

Do not precompute one eternal tier because potion expiry can change the active source. A small pure resolver should produce the applying snapshot at the landed hit's tick.

### Effective source at an eligible hit

```text
otherTier = max(activePotionTier, blowpipe ? 1 : 0)

if cinderbane and otherTier > 0:
  effectiveTier = min(5, otherTier + 1)
else if cinderbane:
  effectiveTier = 2
else:
  effectiveTier = otherTier

procChance = effectiveTier > 0 ? 0.125 + (laniakea ? 0.05 : 0) : 0
cadenceTicks = blowpipe ? 8 : 16
hitBudget = blowpipe ? 36 : 18
sourceDamageMultiplier = (blowpipe ? 0.5 : 1)
  * (laniakea ? 1.05 : 1)
  * (1 + 0.025 * kwuarmPotency)
```

The target state snapshots the successful application's effective tier, cadence, hit budget, and source-local multiplier. Potion expiry prevents later potion-backed applications but does not retroactively erase a target status already applied.

### Target state

Store under `RotationState.target`:

```ts
interface TargetWeaponPoisonState {
  active: boolean;
  appliedAtTick: number;
  expiresAtTick: number;
  effectiveTier: PoisonTier;
  decayIndex: number;
  remainingHits: number;
  cadenceTicks: 8 | 16;
  nextHitTick: number;
  pendingEventSeq: number;
  sourceDamageMultiplier: number;
  cinderbaneContinuation: boolean;
  continuationChance: number;
  sourceLabel: string;
}

interface EvolvingToxinState {
  stacks: number;
  expiresAtTick: number;
}
```

Use an inactive constructor rather than optional partially-initialized objects. Expired poison and Bik states normalize to inactive in branch keys.

### Event and refresh flow

1. Resolve and record a qualifying parent damage event.
2. Apply Bik stack state for that landed ability hit when eligible.
3. Resolve whether an active poison source exists at this tick.
4. Fork failure/success branches with weights `1 - p` and `p`.
5. On success, cancel the target state's `pendingEventSeq` if present, replace the target poison state, and queue one `player_weapon_poison` event at `landTick + 2`.
6. The poison event resolves ability-damage range at its land tick, applies source-local and target-global poison multipliers, and records with `family: "poison"`, `provenance.kind: "player_poison"`, and a distinct analysis origin.
7. On a normal poison continuation, decrement `remainingHits`, increment `decayIndex`, and queue the next event at `landTick + cadenceTicks` while hits remain.
8. If Cinderbane continuation is active, the landed poison hit also forks on its single continuation chance. The failure branch keeps the ordinary next event; the success branch cancels it, refreshes the state, and queues a new application hit at `landTick + 2`.

This order makes the current hit common to both branches and prevents double-recording it.

### Branching and deterministic behavior

- Keep damage-range RNG as min/expected/max arithmetic.
- Branch only application and continuation success because they change future timing and state.
- Add the poison/Bik future to both structural and JSON branch keys, including pending event identity where it affects ordering.
- Reuse runtime snapshot and queue clone behavior; do not place mutable poison state in module globals or closures.
- Rename `lengLandBranch.ts` to the generic `landBranch.ts` when adding the poison expansion, provided the file is not concurrently modified. Keep Leng and poison expansion helpers in focused modules rather than growing one poison switchboard.
- Use the existing `MAX_LIVE_BRANCHES`, merge, cap, exactness, and residual-mass policy. No arbitrary Cinderbane recursion limit is needed because the simulation horizon and branch budget are already finite.
- Combat scores are probability-weighted and deterministic. Solver seeds control search, not a sampled poison outcome. Identical rotations and inputs must produce identical poison totals across seeds and worker/main execution.

### Analysis contract

Use a stable player-poison ledger ID, for example `player_weapon_poison`, and keep source detail separate from the key. Report:

- selected source and effective tier
- poison proc chance, not hit chance
- expected application attempts and successes
- separate poison hits
- min, expected, and max poison damage
- current decay index and remaining target-poison ticks on the representative path
- Bik stacks and expiry
- branch probability mass, residual mass, and support status

Never rename Damage Potential to hit chance. The UI should format engine output only.

## 5. Phased implementation plan

Each phase is a safe stopping point for a separate Codex implementation task. Sol may review the design or completed phase, but implementation remains with Codex.

### Phase A: checkout and source gate

Goal: establish a conflict-safe baseline before production edits.

- Read the poison skill and current combat/data skills.
- Inspect current `main`, dirty files, and concurrent worktrees.
- Reopen all source pages and record any values changed since 2026-08-06.
- Capture or explicitly defer the three open live fixtures: Cinderbane 16-tick guarantee, rounding order, and ambiguous Bik hit classes.
- Do not block the confirmed baseline on those deferred mechanics; label them provisional and leave them off where required.

Stop when the source table and working-tree ownership are clear.

### Phase B: data, passives, and serializable inputs

Goal: make poison configuration a real domain input with no engine behavior yet.

Likely files:

- dated `data/patches/YYYY-MM-DD-*.jsonl`
- generated canonical output through the normal rebuild/export workflow
- `src/combat/data/records.ts`
- `src/combat/passives/definitions.ts`, `registry.ts`, `validate.ts`
- `src/combat/shared/equipment.ts`
- `src/combat/styles/ranged/ammoModel.ts`
- `src/components/combat/loadout/model.ts`
- `src/components/combat/toResolvedCombatModel.ts`
- `src/combat/model/contracts.ts`, `resolve.ts`, `simulationInput.ts`, `simulationBase.ts`
- `src/components/combat/solverSnapshot.ts`
- `src/combat/solver/packRequest.ts`, `identity.ts`, `worker/serializable.ts`, `contracts.ts`

Work:

- Add data-backed passive IDs for Cinderbane, blowpipe, and Laniakea without changing their existing sourced equipment bonuses.
- Add `bik` to the shared ammo type and equipment-derived resolver.
- Add normalized loadout values for weapon poison and Kwuarm potency. Invalid old data becomes `none` and `0`.
- Carry poison immunity, source profile, and Bik ammo through the frozen model and every main/worker payload.
- Include these values in canonical simulation identity and bump `SOLVER_SCHEMA_VERSION`.

Checks before stopping:

- passive registry exhaustiveness
- loadout normalization and persistence round-trip
- resolved-model immutability
- `projectSerializableSimBase`, model packing, snapshot packing, worker revival, and identity parity
- poison-off inputs produce the exact prior payload behavior apart from the intentional schema bump

### Phase C: pure mechanics and target scheduler

Goal: prove formula and timing independently of stochastic application.

Likely files:

- new focused `src/combat/poison/mechanics.ts`
- `src/combat/engine/runtime/state.ts`
- new `src/combat/engine/schedulers/playerPoison.ts`
- `src/combat/engine/runtime/events.ts`
- `src/combat/engine/runtime/clock.ts`
- `src/combat/engine/resolution/castHit.ts` plus a shared land-time base helper if needed
- focused tests beside the new modules

Work:

- Implement tier, source, chance, cadence, hit-budget, decay, and multiplier helpers as pure functions.
- Add inactive target poison and Evolving Toxin state.
- Add player-poison event provenance and dispatch it separately from `processSpiritEvent`.
- Implement forced application/refresh scheduling: first hit at +2, one pending event, 18/36 budget, cancel-and-replace refresh.
- Resolve poison min/expected/max without crit, accuracy, cap, prayer, resources, invention, or generic riders.

Checks before stopping:

- all numeric fixtures in this document
- tick lists `2..274` for standard and `2..282` for blowpipe
- refresh cancellation and decay reset
- poison immunity creates no target state or queued event
- Putrid Zombie behavior and tests remain unchanged

### Phase D: exact application and Cinderbane branching

Goal: connect eligible landed hits to state-changing probability branches.

Likely files:

- `src/combat/shared/damageProvenance.ts` and eligibility matrix tests
- mechanical rename `src/combat/engine/simulation/lengLandBranch.ts` to `landBranch.ts`
- new focused `src/combat/engine/simulation/poisonLandBranch.ts`
- `src/combat/engine/simulation/branchKey.ts`, `branchCore.ts` only if an existing helper is insufficient
- branch, manual, Revolution, score-only, and residual-exactness tests

Work:

- Add explicit poison and Bik eligibility capabilities.
- Expand a qualifying landed hit into fail/success branches after recording the common parent hit.
- Apply one 12.5% or 17.5% roll per qualifying hit.
- Add Cinderbane continuation branching after a player-poison hit, with the ordinary next event retained only on failure.
- Include every live poison future in branch equivalence and normalize expiry.
- Merge after every land and use the existing cap/residual disclosure.

Checks before stopping:

- branch weights for 12.5% and 17.5%
- Cinderbane continuation oracle approaches `1/7` and `7/33` over a long enough fixed horizon
- no second parallel Cinderbane roll with a potion
- multi-hit per-hit application attempts
- same-tick `(tick, seq)` determinism
- branch clone isolation and exact merging
- long-rotation `concreteMass + residualWeight` conservation
- main/manual/Revolution parity

### Phase E: equipment, consumable, and target integrations

Goal: complete all confirmed named interactions.

Work and fixtures:

- Effective tiers: Cinderbane alone 2; potion tiers 1-4; Cinderbane raises them to 2-5.
- Blowpipe: inherent tier 1, half damage, 8-tick cadence, 36 hits, unchanged application chance, Cinderbane damage also halved.
- Laniakea: no source by itself, +5 percentage points and `1.05x` with an active source, including Cinderbane continuation.
- Kwuarm: exact integer potency mapping `0-4` to `0-10%`.
- Potion player-buff expiry: no potion-backed applications after 250/500/1000/1200 ticks; an already-applied target status may continue.
- Poison-immune target: no application, refresh, Cinderbane continuation, or player-poison damage.
- Vulnerability is read at poison land time.

Stop when every cross-product above has focused tests and poison-off regressions remain unchanged.

### Phase F: Bik target state

Goal: add current Evolving Toxin behavior without broadening unsupported hit classes.

Work:

- Add one stack per qualifying Bik ability hit, cap at 150, and refresh the shared expiry to hit tick + 50.
- Normalize all stacks to zero at expiry.
- Apply `1 + 0.03 * stacks` to player poison at land time.
- Add direct and multi-hit eligibility first. Add bleed, derived, attached, or converted-channel eligibility only when the phase-A source fixture supports it.
- Preserve single-target semantics; document target switching as reset/new runtime.

Checks before stopping:

- 0, 1, and 150-stack damage multipliers
- cap at 150
- expiry at the exact half-open boundary
- multi-hit stack and refresh order
- a poison hit at +2 reads the stacks then active on its land tick
- branch keys merge expired Bik state with clean state

### Phase G: analysis and UI

Goal: expose only engine-backed poison controls and results.

Likely files:

- `src/components/combat/BuffsPanel.tsx`
- existing Target panel wiring
- `src/combat/engine/analysis/*`
- `src/combat/engine/simulation/contracts.ts`, `summary.ts`
- `src/components/combat/RotationAnalysis.tsx` and existing source/timeline presentation helpers

Work:

- Add weapon-poison selection and Kwuarm potency `0-4` in Buffs.
- Keep the existing poison-immunity checkbox and wire its resolved value.
- Show engine-produced source, effective tier, poison proc chance, damage band, applications, separate hits, decay, remaining duration, Bik stacks, and support/residual status.
- Keep player poison distinct from Putrid Zombie poison in per-source totals and timeline labels.
- Hide poison analysis when no source is active; do not print fake zeroes.

Checks before stopping:

- UI persistence/normalization tests
- component tests for potency and source selection
- model-to-visible-output integration test
- main-thread and worker results match for the same visible setup
- focused browser QA after reading `.claude/skills/playwright-e2e/SKILL.md`

### Phase H: full verification and performance gate

Goal: prove the feature is shippable in the current shared `main` state.

- Run focused poison tests first.
- Run `npm run test:combat`, `npm run audit:architecture`, `npm run audit:comments`, `npm run typecheck`, lint/format checks, and the relevant build.
- If data changed, run rebuild, canonical export, `data:show` for all four equipment items, and `npm run audit:data`.
- Benchmark a realistic multi-hit Cinderbane+Bik rotation in score-only and full-analysis modes.
- Require probability-mass conservation and honest residual labels. Do not call a capped run exact.
- Inspect the final diff against the starting dirty state. Do not stage unrelated concurrent files.

Stop only when poison-off behavior is unchanged and every supported poison path is engine-backed in manual, Revolution, solver worker, identity, accounting, and UI.

## 6. Consolidated test plan

### Pure unit tests

- Tier scalar and coefficient for tiers 1-5.
- Initial min/average/max table for all tiers.
- Tier 4 hit 2 and hit 18 decay fixtures.
- Effective-tier matrix for potion, Cinderbane, and blowpipe combinations.
- Proc chance 0, 0.125, and 0.175.
- Kwuarm potency validation and exact multiplier mapping.
- Blowpipe half-damage and cadence/hit budget.
- Bik stack multiplier at 0, 1, and 150.

### Stateful timeline tests

- Application at tick 0 lands poison at tick 2.
- Standard sequence has exactly 18 hits through tick 274.
- Blowpipe sequence has exactly 36 hits through tick 282.
- Refresh before the pending hit cancels and replaces it.
- Refresh after decay resets hit index to zero and renews 300 ticks.
- Potion expiry prevents new potion applications without deleting an existing target status.
- Cinderbane continuation lands at two-tick steps and does not leave the ordinary cadence event behind on success.
- Same-tick multi-hit ordering is stable by `seq`.

### Eligibility tests

- One roll for each supported independent player hit.
- No extra roll for attached damage.
- Player poison can roll only the Cinderbane continuation path.
- Putrid Zombie passive poison never applies Cinderbane poison.
- Conjure, invention, and blessing-generated damage remain ineligible unless a sourced exception is added.
- Bik qualifies each supported ability hit but not removed legacy autos.

### Branch and solver tests

- Exact branch weights for base and Laniakea chance.
- Cinderbane geometric expectation as a bounded-horizon oracle.
- Runtime snapshots isolate target poison, queue, counters, and Bik state.
- Structural and JSON keys partition all different live futures identically.
- Expired poison/Bik states merge with clean inactive states.
- Low branch caps disclose residual mass and conserve total probability.
- Score-only and full-analysis totals agree within existing parity tolerances.
- Solver seed changes search only, not the score of a fixed rotation.
- Main-thread, packed worker, checkpoint, and canonical identity distinguish every poison input.

### Accounting and UI tests

- Player poison has its own source and does not merge into Putrid Zombie.
- Applications, expected successes, separate hits, and damage totals reconcile under branch weights.
- Damage band and timeline ticks match engine events.
- Buff controls persist `none`, `weapon`, `weapon+`, `weapon++`, `weapon+++`, and Kwuarm `0-4` safely.
- Poison immunity suppresses modeled output rather than showing misleading damage.
- The UI says `poison proc chance`; Accuracy and Damage Potential labels remain unchanged.

## 7. Verification commands

Use exact project scripts available in the current checkout. The expected minimum is:

```text
npx vitest run <focused poison tests> src/combat/engine/simulation/branchKey.test.ts
npm run test:combat
npm run audit:architecture
npm run audit:comments
npm run typecheck
```

When equipment data/passives change:

```text
npm run data:rebuild
npm run data:canonical:export
npm run data:show -- --id item:cinderbane-gloves
npm run data:show -- --id item:upgraded-bone-blowpipe
npm run data:show -- --id item:laniakeas-spear
npm run data:show -- --id item:bik-arrows
npm run audit:data
```

Run the repository's current lint, format, build, and browser commands after inspecting their definitions. Before every Playwright command, read `.claude/skills/playwright-e2e/SKILL.md`; report a flaky or hung harness honestly.

## 8. Codex implementation handoff prompt

```text
Continue this goal by implementing player-applied poison in C:\Users\Sonnaya\Rs3Equilibrium using docs/player-applied-poison-implementation-plan.md and the equilibrium-poison skill. Sol owns design review; you, Codex, own every implementation change and verification step. Read AGENTS.md, .grok/skills/equilibrium-poison/SKILL.md, and its mechanics reference completely first. Work directly on the existing shared main checkout, inspect and preserve all concurrent changes, and do not create a branch or PR unless I ask.

Implement the phases in order, using the current event-driven target-state, provenance, queue, exact branch, resolved-model, worker, identity, analysis, and loadout architecture. Do not use flat expected DPS, parallel potion/Cinderbane rolls, React-side calculations, item-ID switchboards, arbitrary recursion caps, or Putrid Zombie state. The +2-tick application hit is hit 1 of 18; blowpipe uses 36 hits at 8-tick cadence and half damage; Kwuarm is 2.5% per selected potency 0-4; current Bik is 150 stacks at +3% each with 50-tick full expiry.

Keep the Cinderbane 16-tick guarantee, integer floor order, and ambiguous Bik hit classes explicitly provisional until the plan's live-fixture gates are satisfied. Verify each phase with its focused tests, then run the full affected gates and report exact files, results, residual-mass behavior, and any unresolved support labels.
```
