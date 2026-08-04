# Solver score-only engine mode (design)

Status: **Phase 3 complete** (plumbing + search score-only + winner full-analysis re-sim).
Scope: cut per-eval allocation/work during Revolution search ranking while
keeping identical ranking metrics to the full-analysis path.

## Problem

Every `evaluateRevolutionBar` call runs `simulateRevolution` and builds a full
`RotationSummary`: casts, event log, hit details, per-ability map, damage-by-
source/effect analysis, history provenance, support bounds, optional tails.
Search runs this thousands of times. Ranking only needs a thin slice of that
surface.

## What evaluate / objective need today

Source of truth: `ScoreableSummary` + exploratory path in `evaluate.ts`.

| Consumer | Fields used for ranking |
| -------- | ----------------------- |
| `scoreSummary` / `scoreFromDamageByTick` | `ok`, `error`, `horizonTicks`, `damageByTick` |
| Objective gates (hard fail) | `rng.failedWeight`, `rng.residualWeight`, `rng.exactness` |
| Search horizon (`durationTicks < MIN_RANKABLE_HORIZON_TICKS`) | `totalExpected` only (single-window DPM) |
| Full horizon | window DPMs from `damageByTick` -> `robustScore` |

Not used for ranking today:

- `casts`, `events`, `hitDetails`, `analysis` (bySource / byEffect)
- `perAbility` (objective never reads it)
- `duration` / `dps` / `dpsDetail` / `metric` (display / diagnostics)
- support min/max (`totalMin` / `totalMax` / `damage.support*`)
- `tails` / `includeTails` (solver never opts in)
- representative history provenance

`evaluateRevolutionBar` still attaches a full `summary` on success for tests and
winner diagnostics. Search memo (`EvalResult`) only keeps score tags.

## What can be dropped for search ranking

Hot-path skips (same sim physics, thinner bookkeeping):

1. Event log append (`rt.events`) when no consumer needs reconciliation UI.
2. Analysis ledgers (`accountAnalysisEvent` / `finalizeAnalysis`) when score-
   only; keep support-offset math only if a non-score consumer still needs
   bounds (ranking does not).
3. Cast-record result/hit arrays skipped on score-only. `hitDetails` retained
   only while pending derivedFrom / Lightning Surge consumers need them;
   score-only `branchKey` encodes live derived sources only (not historical
   full HitResult maps).
4. Branch merge of analysis / perAbility when those maps are empty or unused.
5. `combineBranchSummaries` analysis mix and representative cast/event pick
   when detail level is not full-analysis.

Must keep (ranking + correctness gates):

- `totalExpected` and `damageByTick` weight-mix across branches
- `ok` / `error` / failure weight
- `residualWeight` and exactness lattice (never rank residual / non-exact as
  exact robust scores)
- combat state, queue, cooldowns, land-time resolve (physics unchanged)
- Live `hitDetails` for pending derived-hit resolve + score-only live branchKey

## Detail levels (implemented)

Wire: `SimulateOptions.detailLevel` + `CastContextInput.detailLevel` ->
`SimulationRuntime.detailLevel`. Default **full-analysis**.

| Level | Purpose | Payload |
| ----- | ------- | ------- |
| `score-only` | Search + memo hot path | ranking metrics; empty casts/events/analysis/perAbility |
| `summary` | Light diagnostics / benches | score-only + dps/ticks/perAbility/support; no casts/events/analysis |
| `full-analysis` | Winner UI, tests, forensics | current `RotationSummary` |

Solver policy:

- `createEvaluateFn` / evaluation session: always `detailLevel: "score-only"`.
- Standalone `evaluateRevolutionBar` / combat UI: default full-analysis unless
  `detailLevel` is set.
- After ranking, winner is re-simmed once at `full-analysis` for DTO `summary` /
  `rng` / `proof.recheckScore` (ranking score stays score-only).

`ScoreableSummary` is the official score-only wire type for objective scoring.

## Parity proof strategy

Goal: **identical ranking metrics**, not identical object graphs.

1. **Golden pair suite** (`scoreOnlyParity.test.ts`): fixed bars (melee,
   Impatient/Relentless branching, magic, necro) at score-only and full-analysis.
   Assert equal: `ok`, `totalExpected`, `damageByTick`, rng gates, `scoreSummary`.
2. **Objective identity**: window DPMs and `robustScore` match.
3. **Gate identity**: residual / approximated / truncated / resampled still
   hard-fail the same way.
4. **Search honesty**: unchanged (session only changes bookkeeping depth).
5. **Winner re-sim**: `solveFromRequest` re-runs winner at full-analysis;
   ranking score stays score-only; DTO gets presentation summary + recheckScore.
6. `OBJECTIVE_VERSION` **not** bumped (pure detail-level flag, equal metrics).

## Risks

| Risk | Why it matters | Mitigation |
| ---- | -------------- | ---------- |
| Branch analysis ledgers | `mergePair` mixes `analysis` and support offsets | Score-only skips analysis mix entirely |
| `branchKey` includes `hitDetails` | Dropping hitDetails changes merge topology | **Keep** hitDetails always |
| Exactness labels | Non-exact must still fail ranking | Score-only still builds full rng summary |
| Cast records for adren / Leng | Physics needs cast identity | Keep cast records; strip hit arrays only |
| Silent thinner defaults | UI breakdown missing if default flips | Default remains full-analysis |
| Memo / DTO confusion | Thin summary then reading analysis | Presentation fields empty, not zero-faked numbers |

## File touch list (Phase 3 — done)

1. `src/combat/engine/simulation/contracts.ts` - detail-level option + helpers
2. `src/combat/engine/runtime/runtime.ts` - flag on runtime / createRuntime
3. `src/combat/engine/resolution/accounting.ts` - conditional log / analysis / hit arrays
4. `src/combat/engine/simulation/branchCore.ts` - merge skip unused maps
5. `src/combat/engine/simulation/summary.ts` - finish / combine thin path
6. `src/combat/engine/simulation/revolution.ts` / `simulate.ts` - thread option
7. `src/combat/solver/evaluate.ts` - detailLevel + winner presentation projection
8. `src/combat/solver/evaluationSession.ts` - score-only for session ranking evals
9. `src/combat/solver/contracts.ts` - ScoreableSummary + EvalDetailLevel
10. `src/combat/solver/solveFromRequest.ts` / `resultBuilder.ts` - winner full-analysis re-sim
11. `src/combat/solver/search/finalize.ts` - ranking shortlist remains score-only
12. Tests: `scoreOnlyParity.test.ts`, `winnerPresentation.test.ts`, `resultBuilder.test.ts`

## Remaining debt

- Score-only live hitDetails retention + cheaper live branchKey: done
  (branch + scoreOnlyParity cover plain attacks, bloat tails, ranking parity)
- Summary level is plumbed in helpers but not a separate optimized finish path
  beyond skipping analysis/history
- Benchmark numbers (alloc / wall-time) not yet re-baselined under score-only

## Leng score-only EV collapse (search exception)

Dual-Leng land RNG (Endless Frost x Boundless Chill) is **state-changing** and
normally multi-branches every eligible land. On `detailLevel: "score-only"`
only, `expandLengOnLand` collapses arms to a single in-place EV state:

- `E[stacks]` + `E[frostUntil]` via `expectedLengLandState` (`lengDistribution`)
- `residualWeight = 0` (mass folded into EV, not discarded onto a survivor)
- `exactness = bounded-approximation` (summary wire: `approximated`)
- **zero** `snapshotRuntime` from the Leng expand path

This is an intentional **search approximation**, not bookkeeping parity with
full-analysis. Full-analysis / summary still multi-arm fork. Full robust
`scoreSummary` still hard-fails non-exact exactness (no residual laundering).
Winner presentation re-sims at full-analysis.

## Non-goals

- Silent EV shortcuts on full-analysis / summary detail levels
- Ranking residual / approximated mass as exact robust scores
- Claiming score-only dual-Leng totals equal the multi-arm tree
- Shipping score-only as the public combat inspector default
