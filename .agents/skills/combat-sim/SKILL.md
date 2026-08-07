---
name: combat-sim
description: "RS3 Rotation and Revolution simulation semantics for this repo: the src/combat/engine/ layout, tick advancement, cast legality, channels, event provenance, per-hit effects, resource and cooldown clocks, state-changing RNG, sequences, conjure scheduling, and horizon accounting. Use before writing, reviewing, or debugging anything under src/combat/engine/, style on-cast state, scheduled combat events, or any Quick, Rotation, or Revolution result whose timing or state looks wrong."
---

# Combat simulation semantics

This skill owns **when combat events happen and what state survives between them**, and the shape of `src/combat/engine/`.

`combat-math` owns what a hit's damage is: base ability damage, Damage Potential, DPL, crit layers, hit caps, modifier ordering, rounding, and the source hierarchy every combat number must clear. `equipment-effects` owns item records, static activation, passive/set/enchantment routing, and equipment support status. `league-blessings` owns revealed blessing facts, support status, and the routing decision for each blessing effect. Ability and equipment data own sourced mechanic values such as durations, stack thresholds, hit offsets, and cooldowns.

This document describes the simulator's target semantics, not whichever buggy behavior happens to exist today. Fix code to match the rules; do not weaken the rules to preserve a defect.

## Engine architecture

The engine is split by responsibility, and each folder has exactly one:

```text
src/combat/engine/
  cast/          the atomic cast transition
    effects/     cast-start state changes, by lifecycle stage then style
  runtime/       clock, per-run mutable runtime, event queue, RotationState
  resolution/    land-time damage calculation
    landed/      on-hit state transitions, by style
  simulation/    drivers, branching, contracts, summaries
  schedulers/    autonomous actors (conjures)
```

The boundaries that make it work:

- **Preparation is read-only.** `cast/prepare.ts` computes everything the cast needs against the advanced state and records each implied mutation as a `PreparedTransition` variant. A new mechanic adds a variant, not another boolean on `PreparedCast`.
- **A rejected cast mutates nothing** beyond the canonical time advance — no resources, cooldowns, scheduled events, or cast records. `prepareSimulationCast` is the single boundary where readiness and affordability are decided, shared by the manual driver, Revolution, and the branch layer.
- **Cast effects are split by lifecycle and by style.** `cast/effects/` holds prepared transitions, cooldowns, resources, completion, and one module per style. A cast has exactly one style, so style modules never interleave; effects needing a finished channel belong in `completion.ts`, applied after advancing through occupancy.
- **Resolution calculates; recording writes.** Resolvers return an `EventResolution` and touch no runtime ledger. `resolution/record.ts` is the orchestration boundary that writes totals, per-ability ledgers, hit details and the event log, then dispatches domain handlers: `accounting.ts` (ledgers), `league/blessingDamage.ts`, `procs/invention.ts` (Crackling/Aftershock), and `landed/` (style on-hit state).
- **`resolution/landed/` applies on-hit state**, dispatched to the style that owns it, and only for real hits — attached components, conjure autos, poison ticks and procs are excluded by the caller.
- **Runtime state is grouped by combat style and target.** `RotationState` carries the genuinely global clocks (`tick`, `adrenaline`, `cooldowns`, `relentlessUntilTick`) plus one bucket per style and one for the target. Each style's state and its constructor live in that style's module, so the engine composes state rather than declaring it. Debuffs the simulation put on the target (burns, Bloat) live in `target`, not in player state.
- **Every state write goes through a patch helper** (`patchMelee`, `patchRanged`, `patchMagic`, `patchNecro`, `patchConjures`, `patchTarget`). No nested object is mutated in place, so a branch snapshot stays isolated.
- **Conjures use capability-specific discriminated types.** `ActiveConjure` carries exactly the tracks a spirit has — the skeleton's auto track and Rage, the zombie's auto and poison tracks, the ghost's auto, the phantom's neither. A poison track on a skeleton is a compile error, not a test someone has to remember. Never reintroduce a shared shape with sentinel values or a runtime `id ===` guard standing in for a type.
- **Damage-over-time classification is declared, not inferred.** An `AbilityHit` carries an explicit `dot` flag and the scheduler classifies from it. Landing late and being crit-ineligible are two unrelated axes and neither implies DoT: Corruption Shot's first bleed tick lands on the cast tick and is still DoT; Magma Tempest lands over 16 ticks, cannot crit, and is still a direct hit. Classification is decided once, where the event is scheduled, and passed to the resolver.
- **`src/combat/index.ts` is the deliberate external API.** It must name every module an outside consumer may reach for. `cast/`, `resolution/`, `runtime/` and `schedulers/` are internal; nothing outside `src/combat/` imports them.

`src/combat/rotation/` no longer exists. Do not recreate it, `castEffects.ts`, the old flat `resolution.ts`, a flat eighteen-field `RotationState`, or a single conjure shape with unusable fields. If a module is growing into a dispatcher that touches every mechanic, split it along these seams instead of adding another branch to it.

Two more structural rules, for the same reason:

- No arbitrary callback plumbing. A mechanic declares data — a `PreparedTransition`, a scheduled event with provenance, a state field — and the canonical path acts on it. A callback whose captured state is not visible at the call site is hidden simulation state.
- No hidden compatibility layer. When a shape changes, change the callers. Do not leave a shim that quietly accepts the old shape, and do not keep a deprecated field alive "just in case" — a stale field will get read.

## Verification and support status

Do not promote the current implementation, a tooltip, or a bug report into mechanical truth.

For exact tick timings, stack counts, trigger scope, cooldown behavior, or effect ordering, follow the source hierarchy and verification rules in `combat-math`. Record provisional assumptions and test them at their boundary. Do not duplicate volatile numeric tables in this skill.

When simulator support is exposed to users, use the same honesty labels as the blessing domain where applicable:

- `modeled` — all mechanics relevant to the shown result are implemented;
- `partially modeled` — a meaningful component is missing or excluded;
- `not modeled` — displayed but excluded from calculated totals or cast logic;
- `mechanics unverified` — implemented behavior depends on a provisional interpretation.

Never label a result complete while a known mechanic can change its damage, timing, resource state, or future cast legality.

## State model

`RotationState` is the complete simulation state. Do not hide combat state in module globals, mutable singletons, UI components, or callbacks with undocumented captured state.

Use the repository's established state idioms:

- `state.tick` is the next tick on which the actor may begin another cast;
- per-ability cooldown readiness lives in the cooldown state and is combined with cast availability by `firstLegalTick` or its canonical replacement;
- expiring effects use explicit clocks such as `*UntilTick` rather than parallel booleans and ad hoc timers;
- per-style state mutates through its existing helpers so caps, spending, and invariants stay centralized.

Per-run mutable bookkeeping — the event queue, ledgers, sequence counters, the event log — lives on the `SimulationRuntime` created once per run and threaded through, never in a module-level singleton, so concurrent simulations cannot interfere.

**Starting state is configurable wherever a comparison depends on it.** A run that always begins at zero adrenaline, no stacks, every cooldown ready and no active window can only answer one question. Any metric used to compare rotations, gear, or rulesets must let the caller state the opening conditions it is comparing under, and the result must report which ones it used. Defaults stay explicit and documented; never bury an assumed opening state inside a driver.

Unless a sourced mechanic requires different treatment, timed windows are half-open: active from their start tick while `currentTick < untilTick`, and inactive at `untilTick`. Boundary behavior must be covered by tests.

The same input, ruleset, and RNG method must produce the same event log and result. Same-tick event ordering must be explicit and stable; never depend on object-key, map, or incidental insertion order.

## Canonical tick advancement

Time advances through one canonical path. `advanceTo(targetTick)` or its equivalent must:

1. process scheduled events in chronological and stable same-tick order;
2. apply passive resource generation and other time-based state changes due by the target tick;
3. expire clocks at their defined boundaries;
4. stop with state representing the target tick before affordability and requirement checks are finalized.

Do not inspect a future cast against stale pre-advance resources. Waiting may generate adrenaline, expire a lockout, advance a sequence, or change another requirement.

Do not implement separate partial advancement paths for manual rotations, Revolution, Quick estimates, conjures, or league effects. They must share the same clock semantics.

## Atomic cast transitions

A cast is one atomic state transition. The canonical order is:

1. determine the earliest candidate tick from GCD or cast occupancy and ability cooldowns;
2. advance the simulator to that tick;
3. re-check requirements, target conditions, and affordability against the advanced state;
4. resolve any empowered variant and consume its resources in the same transition;
5. start cooldown and cast occupancy;
6. schedule hits, channels, damage-over-time events, and other delayed effects with provenance;
7. apply immediate on-cast grants or windows in their sourced order.

A rejected cast must not leave partial mutations. An empowered cast must not resolve without its spend. After a spender consumes a capped resource, the next spender remains unempowered until the resource is rebuilt.

Bloodlust, Deathspore, Necrosis, Residual Souls, Runic Charge, ammo effects, and league-specific state all follow this rule through their own helpers. Do not special-case them in the outer rotation loop.

## Cast occupancy, GCD, and channels

GCD, cast occupancy, cooldown, and hit timing are separate concepts.

Every channelled ability must declare:

- total channel or occupancy duration;
- hit offsets within that duration;
- whether and how it can be cancelled;
- what happens to unlanded hits after cancellation.

Revolution completes channels. Manual simulation also completes them by default. Cancellation exists only when the caller supplies an explicit cancellation point; all later channel events are then removed or marked cancelled. Never award a full channel while advancing the actor by only one GCD.

A hit scheduled beyond the reporting horizon does not count as landed damage merely because its cast began inside the horizon.

## Event provenance and per-hit scope

Every damaging or state-changing event must preserve enough provenance to answer:

- which cast or scheduler created it;
- whether it is a real hit, attached damage component, proc, damage-over-time tick, bounce, conjure auto, or command hit;
- its hit index and scheduled tick;
- which modifiers and proc families it may trigger;
- whether it inherits crit or other state from a source event;
- whether it may recursively create another event of the same family.

Next-hit effects are consumed by the first eligible landed hit, not applied to an entire ability before per-hit resolution. Multi-hit abilities, channels, bounces, and damage-over-time must evaluate eligibility at event scope.

Derived events inherit crit state or other source properties only when the mechanic explicitly says so. Do not assume all tails, bounces, or bonus components are independent, and do not assume they are correlated without a source.

## Hit-count integrity

One `AbilityHit` or equivalent hit event represents one real proc-eligible hit.

Damage added to an existing hit remains an attached component unless the mechanic explicitly creates a separate hit. Attached damage must not inflate:

- on-hit proc rolls;
- stack generation;
- adrenaline generation;
- hit counters;
- effect extension counts.

A separate-hit mechanic must be represented as a separate event with explicit crit, hit-cap, target-modifier, recursion, and proc-eligibility rules.

## RNG policy

Do not flatten all randomness into expected damage.

Use deterministic expected value only when the random outcome changes damage but does **not** change future state, event topology, or cast legality.

Use probability-weighted state branching when randomness changes any of the following:

- adrenaline or another spendable resource;
- cooldowns or active windows;
- stack state;
- scheduled future events;
- target state used by later mechanics;
- future cast requirements or legality.

Merge equivalent states to control growth. Use seeded Monte Carlo only when exact branching is unreasonably expensive. Any approximation must expose its method and assumptions in tests and result metadata.

**Branch-relevant event provenance belongs in the equivalence signature.** Two branches are equivalent when their `RotationState`, pending-event signature, and run counters match. Every field of a pending event that can change how it resolves belongs in that signature — `derivedFrom` included, since tails deriving from different source hits resolve to different damage and are not the same branch. Adding such a field to `ScheduledEvent` means adding it to the signature in the same change; omitting it silently merges branches that were never equivalent, and the totals are then wrong in a way no damage assertion will catch. `resolve` closures stay out: equivalent branches scheduled identical events from identical casts.

**Historical damage ledgers are not future state.** `totalExpected` / `totalMin` / `totalMax` / `perAbility` / `damageByTick` and event/cast logs must not appear in the branch equivalence key: `mergePair` already weight-averages those ledgers. Two branches with identical future state and different past damage must merge; two with different queues or `RotationState` must not.

## Resource clocks and lockouts

A timed resource mechanic owns all state required to model its lifecycle. A typical clocked resource may need:

- current stacks or charges;
- an active-spend or free-cast window;
- a rebuild lockout or proc cooldown;
- an expiration tick;
- provenance for the event that granted or consumed it.

Keep these fields together in the appropriate style or effect state. Do not represent one lifecycle across unrelated booleans, cooldown maps, and local variables.

Clocks are checked after canonical time advancement. Spending, conversion, and lockout start happen atomically. Stack generation while a sourced lockout is active must be rejected by the state helper, not merely hidden in the UI.

## Sequences and target-dependent mechanics

Enable chains are explicit state machines. Store the current stage, the event or cast that granted it, and its expiration tick. A follow-up without its live predecessor is rejected or skipped according to the rotation mode; it is never silently treated as legal.

Mechanics that depend on target HP%, weakness, size, poisonability, incoming attacks, or another target property require that state in the simulation input. When the required context is unavailable, mark the mechanic partially modeled or not modeled instead of inventing a default that changes the result.

## Conjure and auxiliary schedulers

Conjures, companions, damage-over-time sources, and similar autonomous actors use the same event queue but own their own scheduler state.

A command that pauses, replaces, delays, or resets an autonomous attack schedule must mutate that scheduler. The command and normal auto schedule do not run concurrently unless the sourced mechanic explicitly allows it.

Keep global combat modifiers separate from cast-specific modifiers. Event provenance determines which modifiers apply; the presence of a command or scheduler callback must not erase unrelated global effects.

Damage formulas, accuracy treatment, and sourced hit values remain in `combat-math` and combat data. This skill owns only their scheduling and state interaction.

## Horizon semantics

The canonical DPS metric is **landed damage within the horizon**:

- process casts, channel hits, damage-over-time ticks, procs, conjure events, and delayed tails only through `horizonTicks`;
- do not drain the remaining lifetime of a conjure, channel, or damage-over-time effect after the horizon;
- divide only the damage that actually landed within the measured interval by that interval.

A second metric, **damage from casts begun within the horizon**, may include later tails only when explicitly requested. It must be separately named and must never be presented as fixed-window DPS.

**Fixed-window and natural-completion metrics are different numbers and are named differently.** A per-minute figure can mean either:

- **fixed-window DPM** — everything that lands inside a stated window, divided by that window. Unfinished tails past the edge are excluded; the window length is an input, not a consequence of the rotation.
- **natural-completion DPM** — a rotation run to its own end, including every scheduled tail, divided by the elapsed time it actually took. The denominator is an output.

They diverge whenever a rotation ends on a long DoT, a live conjure, or a channel. Never label one with the other's name, never compare a fixed-window number against a natural-completion number, and always report which one a result is along with its window or elapsed ticks. When both are shown, show the denominators too.

## League effect routing

Follow `league-blessings` rather than inventing a parallel lettered routing taxonomy.

- Derived inputs and resolver overrides enter shared combat or loadout context.
- Per-hit or per-attack blessing damage uses the event and provenance model.
- Effects that alter adrenaline, cooldowns, active windows, stacks, or future legality enter simulation state.
- Effects outside outgoing-damage simulation remain displayed but excluded from totals.

Nothing league-specific is baked into base formulas or unconditional simulator state. With the league ruleset and loadout omitted, base-game output, event order, and cast sequence must remain unchanged.

## Implementation workflow

Before changing simulation code:

1. identify whether the mechanic belongs to hit math, event scheduling, persistent state, league routing, or unsupported target/incoming-combat context — then to which engine folder above, so it lands with the one responsibility that owns it rather than in whichever file is already open;
2. verify its timings, trigger scope, and ordering against the `combat-math` source hierarchy rather than inferring them from tooltip prose, a comment, or an existing test's expectation;
3. define the state fields, clocks, event provenance, and boundary behavior;
4. write a regression test named for the intended behavior, not a bug number;
5. implement through the canonical advancement, cast, state-helper, and event paths;
6. compare the event log and state snapshots before trusting only the final damage total.

Keep bug inventories and temporary backlogs outside this skill. They change; these invariants should not.

## Test requirements

Read and follow `test-maintainer` before writing, editing, or triaging any test. That skill is
mandatory for suite work; this section only names which simulator contracts to pin.

Every simulator change needs focused state and event assertions, not only an aggregate DPS snapshot.

Use relevant cases including:

- GCD versus longer cast occupancy;
- channel completion and explicit cancellation;
- single-hit, multi-hit, bounce, and damage-over-time events;
- first-hit versus per-hit consumption;
- attached damage versus a true separate hit;
- resource generation exactly at the ready tick;
- stack spend, expiry, rebuild, and lockout boundaries;
- sequence success, missing predecessor, and expiration;
- simultaneous events with deterministic ordering;
- state-neutral expected value versus state-changing RNG branches;
- autonomous scheduler plus command interaction;
- events landing exactly before, at, and after the horizon;
- ruleset `"base"` versus `"equilibrium"`;
- unsupported or provisional mechanics excluded or labeled honestly.

Base-ruleset fixtures must remain identical when league modifiers are absent.

**Never update a snapshot or a golden total to make a test pass.** A moved number is a claim about the game, and it needs the same source treatment as the original: identify the mechanic that changed, verify it against the `combat-math` source hierarchy, and say in the test or the commit which source moved it. If you cannot explain the delta, the change is a regression, not a new baseline. Prefer focused state and event assertions over aggregate snapshots precisely because a snapshot fails without telling you what broke.

Run `npm run typecheck`, `npm test`, and `npm run build` before claiming a simulator change works. Run `npm run test:e2e` (Playwright, port 3100, not in CI) when the change affects user-visible support labels, rotation controls, or reported metrics — see `equilibrium-ui` for the rendered-QA rules.
