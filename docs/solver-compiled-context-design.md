# Solver compiled evaluation context (design)

Status: Phase 4 landed - compile-once catalogue + byId in evaluate/session; createRuntime reuses abilityRegistry when compiled context is present.
Scope: compile ability catalogue, id maps, basics, and Strength Cape variants
**once per solver request**, then reuse them for every bar evaluation. Measure-
first (Phase 0); no scoring or eligibility changes.

Related: score-only detail levels are Phase 3 (`docs/solver-score-only-design.md`).
Hit-level `compileModifiers` / exact plateau means live on
`grok/combat-pipeline-performance` and are orthogonal (per-hit, not per-request).

## Problem

A thorough solve can call `evaluateRevolutionBar` thousands of times. Most of the
inputs to the Revolution driver are **request-invariant**: full ability
catalogue, Basic Attacks, Strength Cape Dismember patch, cast-modifier
factory, league/equipment fields. Today those structures are rebuilt on every
bar, and again inside every `createRuntime` for every branch root.

Phase 4 removes that duplicate setup without changing sim physics or scores.

## What evaluate does today (per bar)

Source of truth: `src/combat/solver/evaluate.ts`.

After eligibility succeeds:

1. Resolve the bar to `AbilitySpec[]` via `pool.byId.get(id)`.
2. **Rebuild a full catalogue Map** (request-invariant work, every eval):

```ts
// evaluate.ts - runs on every successful bar path
const abilityMap = new Map<string, AbilitySpec>();
for (const ability of simFields.abilities) abilityMap.set(ability.id, ability);
for (const ability of pool.byId.values()) {
  abilityMap.set(ability.id, ability as AbilitySpec);
}
for (const ability of resolved) abilityMap.set(ability.id, ability);

const strengthCape99 = (sim as { strengthCape99?: boolean }).strengthCape99 === true;
const catalogue = strengthCape99
  ? withStrengthCape99Dismember([...abilityMap.values()], STRENGTH_CAPE_DISMEMBER_EXTRA_HITS)
  : [...abilityMap.values()];
const resolvedBar = strengthCape99
  ? withStrengthCape99Dismember(resolved, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS)
  : resolved;
```

3. Call `simulateRevolution({ ...simFields, abilities: catalogue, bar: resolvedBar, ... })`.
4. Inside the engine, every sim root rebuilds maps again:

```ts
// engine/runtime/runtime.ts createRuntime
byId: mapAbilitiesById(input.abilities),
basicByStyle: mapBasicsByStyle(input.abilities),
```

`solveFromRequest` already merges catalogue + pool **once** into
`simCommon.abilities` and builds `reviveModifiers` once. Evaluate then **re-merges
and re-clones** that same surface for each bar, and Strength Cape walks the full
catalogue (not just Dismember / bar slots) every time the flag is set.

Cost shape (order of magnitude):

| Work | Frequency today | Should be |
| ---- | --------------- | --------- |
| Merge sim.abilities + pool.byId into Map | per bar | once per request |
| `withStrengthCape99Dismember` on full catalogue | per bar when cape | once per request |
| `withStrengthCape99Dismember` on resolved bar | per bar when cape | once per bar **or** lookup pre-patched specs from byId |
| `mapAbilitiesById` / `mapBasicsByStyle` | per `createRuntime` (each branch root) | once per request, shared readonly maps |
| Resolve bar id list -> specs | per bar | per bar (unavoidable; cheap Map.get) |
| Eligibility + simulate + score | per bar | per bar |

## Compile-once product

### Name

Working name: **`CompiledEvaluationContext`** (file: `src/combat/solver/compiledContext.ts`).

Built once when the evaluation session starts (same place as `simCommon` /
`createEvaluateFn` in `solveFromRequest` / `evaluationSession`). Immutable for
the life of that solve. Not shared across workers or across distinct loadouts.

### Contents (request-invariant)

| Field | Meaning |
| ----- | ------- |
| `style` | Combat style for the request |
| `catalogue` | Final `readonly AbilitySpec[]` for runtime registry (includes Basic Attacks) |
| `byId` | `ReadonlyMap<string, AbilitySpec>` - full catalogue index (`mapAbilitiesById` semantics, including conflict checks) |
| `basicByStyle` | `ReadonlyMap<style, AbilitySpec>` - first Basic Attack per style (`mapBasicsByStyle`) |
| `strengthCape99` | Whether cape patch was applied to the catalogue |
| `pool` | Existing candidate pool (already request-scoped) |
| `simBase` | Shared Revolution fields **without** `abilities` / `bar` / horizons (modifiers factory already revived) |

Optional (Phase 4 stretch, only if measured useful):

| Field | Meaning |
| ----- | ------- |
| `baseModsByAbilityId` | Prebuilt `CombatModifier[]` per ability id from the cast-modifier factory (global + ultimatums/lunging). Avoids per-cast array spread in `prepare` when the factory is pure on `(ability.id, category)`. |
| `orderedGlobalMods` | Global-only modifiers ordered once (feeds into ability-aware assembly). |

### What stays per-bar

- Eligibility (`validateBarEligibility`).
- Bar as ordered `readonly string[]` -> `resolved: AbilitySpec[]` via `byId.get` (same object references as catalogue; no deep clone).
- `durationTicks` / explore vs full horizon.
- `simulateRevolution` mutable runtime (state, queue, ledgers) - still created per branch.
- Objective scoring from the summary.

### Strength Cape variants

Cape only mutates Dismember hit lists (`withStrengthCape99Dismember` in
`styles/melee/abilities.ts`; idempotent if already extended).

Compile rule:

1. If `strengthCape99 !== true`, catalogue is the plain merge.
2. If true, apply the helper **once** to the merged catalogue before building
   `byId` / `basicByStyle`. Every bar lookup then returns the patched Dismember
   automatically; no second pass on `resolved`.

Do not keep two live catalogues unless tests need a side-by-side. If identity
fingerprints must distinguish cape on/off, they already do via
`canonicalEvaluationContext` / loadout `strengthCape99`.

### Relationship to engine `createRuntime`

Full win requires the runtime to **accept** prebuilt maps instead of rebuilding
them from `input.abilities` every time:

```text
CastContextInput (or adjacent options):
  abilities: readonly AbilitySpec[]   // still required for any path that scans the array
  abilityRegistry?: {
    byId: ReadonlyMap<string, AbilitySpec>
    basicByStyle: ReadonlyMap<style, AbilitySpec>
  }
```

When `abilityRegistry` is present, `createRuntime` uses it and skips
`mapAbilitiesById` / `mapBasicsByStyle`. When absent, current behavior stays
(manual combat UI, unit tests, one-off sims).

Branch clones must keep sharing the same readonly maps (they already share
`input`; maps stay on `SimulationRuntime` as readonly fields).

### Modifiers (immutable portion)

Already compile-once-ish:

- `reviveModifiers(sources, league)` in `solveFromRequest` builds one factory
  closed over a global list.

Still per-cast today (`cast/prepare.ts`):

```ts
baseMods:
  typeof input.modifiers === "function" ? input.modifiers(ability) : (input.modifiers ?? []),
```

Factory body (`worker/revive.ts`) spreads `global` and optionally appends
ultimatums/lunging. That is cheap vs full sim, but if Phase 0 counters show cast
prep as hot, prefill `baseModsByAbilityId` for every id in the catalogue (and a
fallback for unexpected ids). Do **not** pre-sort/filter land-time window mods
(`resolution/modifiers.ts`); those depend on tick/state.

Hit pipeline compile (`compileModifiers` / exact plateau means) is **not** this
phase unless that work is already merged from `combat-pipeline-performance`.
Phase 4 only freezes request-level ability + optional baseMods maps.

## Target call shape

```text
solveFromRequest
  -> buildCandidatePoolForRequest
  -> compileEvaluationContext({ request, pool, simBase, catalogue, strengthCape99 })
  -> createEvaluateFn({ compiled, ... })
       evaluateRevolutionBar({ bar, durationTicks, compiled, profileId, ... })
         -> eligibility(bar, compiled.pool, ...)
         -> resolved = bar.map(id => compiled.byId.get(id))
         -> simulateRevolution({
              ...compiled.simBase,
              abilities: compiled.catalogue,
              abilityRegistry: { byId: compiled.byId, basicByStyle: compiled.basicByStyle },
              bar: resolved,
              style, durationTicks,
            })
         -> score
```

Standalone `evaluateRevolutionBar` without `compiled` (tests / benches) may keep
building a one-shot context via a helper `compileEvaluationContextFromEvalRequest`
so goldens stay simple - same function production uses, not a second merge path.

## Parity proof strategy

Goal: **identical scores and sim totals**, not identical allocation counts.

1. **Golden bars**: same cases as score-only / quick bench (melee 2H, DW, leng,
   igneous, magic, necro). For each bar, compare:
   - `summary.ok`, `totalExpected`, `damageByTick`
   - exploratory DPM and `scoreSummary` robust score
   - resolved bar ability ids and Dismember hit counts with/without cape
2. **Cape pair**: `strengthCape99` false vs true; Dismember in and out of bar;
   catalogue Dismember must match `withStrengthCape99Dismember` oracle.
3. **Registry conflict**: duplicate conflicting ability ids still throw at
   compile time (same as `mapAbilitiesById`), not silently at first sim.
4. **Benchmark fingerprints**: `winnerScore`, rankable flag, context fingerprint
   unchanged vs Phase 0 baseline when only this optimization lands.
5. No `OBJECTIVE_VERSION` / `SOLVER_SCHEMA_VERSION` bump for pure reuse of the
   same AbilitySpec contents.

## Risks

| Risk | Why | Mitigation |
| ---- | --- | ---------- |
| Mutating a shared AbilitySpec | One bar path mutates hits/cooldowns and poisons later bars | Specs stay readonly after compile; cape produces new objects once at compile |
| Pool entry is not full AbilitySpec | `pool.byId` typed as PoolAbility; cast needs hits | Keep current `poolAsSpecs` / catalogue merge rules; compile fails closed if hits missing for a resolved id |
| Basic Attack missing from a saved bar | Stable IDs resolve through the full catalogue | Keep the four established engine IDs and storage mappings |
| Branch key / equality assumes fresh maps | Unlikely maps are not in branch keys today | Confirm `branchKey` does not identity-compare byId Map instances |
| API split: evaluate with and without compiled | Two merge paths drift | Single `compileEvaluationContext` helper; evaluate always goes through it |
| Engine option unused by manual UI | Dead field | Optional registry only; default rebuild path remains tested |

## File touch list (Phase 4)

Implementation order suggestion; keep diffs minimal. **Do not start until Phase 0
baselines are recorded and Phase 3 score-only is either landed or explicitly
deferred.**

1. `src/combat/solver/compiledContext.ts` - types + `compileEvaluationContext` pure builder
2. `src/combat/solver/evaluate.ts` - accept optional/required compiled context; **delete** per-bar `abilityMap` rebuild and per-bar full-catalogue cape pass
3. `src/combat/solver/evaluationSession.ts` / `solveFromRequest.ts` - compile once; pass into evaluate
4. `src/combat/solver/requestContext.ts` - optional: fold catalogue merge helper next to `poolAsSpecs` so solve and compile share one merge
5. `src/combat/engine/simulation/contracts.ts` - optional `abilityRegistry` on cast/revo input
6. `src/combat/engine/runtime/runtime.ts` - honor registry; keep rebuild fallback
7. `src/combat/engine/simulation/revolution.ts` / `context.ts` - thread option if needed
8. Benchmarks / invariants that inline the same Map merge (`benchmarks/runBenchmark.ts`, `invariants.test.ts`) - use compile helper
9. Tests: `evaluate.test.ts` (cape + parity), new `compiledContext.test.ts`, registry conflict, existing revolution goldens unchanged
10. Docs: this file status -> implemented; one line in `docs/combat-engine.md` solver table when shipping
11. Optional later: `baseModsByAbilityId` if profiling shows cast prep cost

Out of scope for Phase 4:

- Score-only summary thinning (Phase 3)
- Changing objective weights, horizons, proof labels, branch caps
- Approximate EV / dropping RNG branches
- Freezing land-time window modifiers
- Requiring hit-pipeline `compileModifiers` from the pipeline-performance branch

## Non-goals

- Faster-but-different damage numbers
- Sharing compiled context across different loadouts or workers without recompile
- Mutating pool / catalogue during search
- Removing Strength Cape support or moving it into UI-only code

## Phase map (solver performance rewrite)

| Phase | Intent |
| ----- | ------ |
| 0 | Measure-first baselines, profile counters, no speed claims |
| 1–2 | (other rewrite slices as planned on the branch) |
| 3 | Score-only / thinner summary for search ranking |
| 4 | **This doc** - compile-once ability registry + optional baseMods |
| later | Wire pipeline-performance hit compile if/when merged |

Phase 0 remains measure-first: design and types-only stubs are allowed; evaluate
behavior stays unchanged until Phase 4 implementation.
