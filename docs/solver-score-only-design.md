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
3. Cast-record hit arrays and UI `hitDetails` growth when branch keys / land-time
   readers do not need them (engine **keeps** `hitDetails` map for derived hits
   + `branchKey` parity - only cast presentation hit arrays are skipped).
4. Branch merge of analysis / perAbility when those maps are empty or unused.
5. `combineBranchSummaries` analysis mix and representative cast/event pick
   when detail level is not full-analysis.

Must keep (ranking + correctness gates):

- `totalExpected` and `damageByTick` weight-mix across branches
- `ok` / `error` / failure weight
- `residualWeight` and exactness lattice (never rank residual / non-exact as
  exact robust scores)
- combat state, queue, cooldowns, land-time resolve (physics unchanged)
- `hitDetails` for derived-hit resolve + merge `branchKey` topology

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

- Optional prune of `hitDetails` entries no longer referenced by pending queue
  (risky for branchKey - needs dedicated parity)
- Summary level is plumbed in helpers but not a separate optimized finish path
  beyond skipping analysis/history
- Benchmark numbers (alloc / wall-time) not yet re-baselined under score-only

## Non-goals

- Faster-but-approximate damage (EV shortcuts that change scores)
- Dropping state-changing RNG branching
- Ranking residual / approximated mass as exact
- Shipping score-only as the public combat inspector default
