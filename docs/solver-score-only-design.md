# Solver score-only engine mode (design)

Status: design only. Do not implement until Phase 3.
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
3. Cast-record hit arrays and `hitDetails` growth when branch keys / land-time
   readers do not need them (see Risks).
4. Branch merge of analysis / perAbility when those maps are empty or unused.
5. `combineBranchSummaries` analysis mix and representative cast/event pick
   when detail level is not full-analysis.

Must keep (ranking + correctness gates):

- `totalExpected` and `damageByTick` weight-mix across branches
- `ok` / `error` / failure weight
- `residualWeight` and exactness lattice (never rank residual / non-exact as
  exact robust scores)
- combat state, queue, cooldowns, land-time resolve (physics unchanged)

## Proposed detail levels

Wire as an explicit sim option (name TBD), default **full-analysis** so UI and
tests stay unchanged.

| Level | Purpose | Payload |
| ----- | ------- | ------- |
| `score-only` | Search + memo hot path | `ok`, `error?`, `horizonTicks?`, `totalExpected`, `damageByTick`, `rng?` gates only |
| `summary` | Light diagnostics / benches | score-only + `dps`, `ticks`, `perAbility`, support bounds; no casts/events/analysis |
| `full-analysis` | Winner UI, tests, forensics | current `RotationSummary` |

Solver policy (Phase 3 intent):

- Exploratory and shortlist **search** evals: `score-only`.
- Final **full** / `finalize` ranking: `score-only` or `summary` is enough for
  metrics; re-sim winner once at `full-analysis` only if the UI needs breakdown.
- Manual combat page / rotation inspector: always `full-analysis`.

`ScoreableSummary` already matches the score-only numeric surface; promote it
as the official score-only return type rather than a partial full summary.

## Parity proof strategy

Goal: **identical ranking metrics**, not identical object graphs.

1. **Golden pair suite**: for a fixed bar set (melee DW, leng, igneous, magic,
   necro), run the same `RevolutionInput` at `score-only` and `full-analysis`.
   Assert equal: `ok`, `totalExpected`, `damageByTick` (tick keys + values),
   `rng.failedWeight`, `rng.residualWeight`, `rng.exactness`, and resulting
   `scoreSummary` / exploratory DPM.
2. **Objective identity**: `scoreFromDamageByTick` inputs only; window DPMs and
   `robustScore` must match bit-for-bit on finite numbers (or `toBeCloseTo` with
   a documented ulp budget if float mix order differs - prefer identical mix
   order so no budget is needed).
3. **Gate identity**: residual / approximated / truncated / resampled still
   hard-fail; exact / merged-exactly still pass when residual ~ 0.
4. **Search honesty**: `scoreHonesty` + benchmark fingerprints
   (`winnerScore`, rankable flag) unchanged under score-only search evals.
5. **Winner re-sim**: if final DTO re-simulates at full-analysis, score must
   match the score-only archive entry used for ranking (same horizon + profile).
6. Bump `OBJECTIVE_VERSION` only if ranking math or gate semantics change; a
   pure detail-level flag with equal metrics does not require a bump.

## Risks

| Risk | Why it matters | Mitigation |
| ---- | -------------- | ---------- |
| Branch analysis ledgers | `mergePair` mixes `analysis` and support offsets; `sourceKindOf` / parent lookup read `events` / `recordBySeq` | Score-only skips analysis entirely; do not leave half-updated ledgers. Support bounds optional. |
| `branchKey` includes `hitDetails` | Dropping hitDetails changes merge equivalence and residual | Keep whatever `branchKey` needs for identical merge topology, or redesign key with a parity test that residual/exactness match full path |
| Exactness labels | Engine summary maps many branch exactness values to `exact` \| `approximated`; solver also rejects `truncated` / `resampled` / `bounded-approximation` | Score-only must still surface residual + non-exact labels so `scoreSummary` fails the same way |
| Cast records for adren / Leng | Land forks and forensic paths touch `recordBySeq` | Do not strip cast identity required for physics; strip display-only hit arrays only after tests |
| Silent thinner defaults | UI breakdown missing if default flips | Default remains full-analysis; solver opts into score-only explicitly |
| Memo / DTO confusion | Caching a thin summary then reading analysis fields | Type the levels; full fields absent, not zero-filled fakes |

## File touch list (Phase 3)

Implementation order suggestion; keep diffs minimal.

1. `src/combat/engine/simulation/contracts.ts` - detail-level option + score-only type
2. `src/combat/engine/runtime/runtime.ts` - flag on runtime / createRuntime
3. `src/combat/engine/resolution/accounting.ts` - conditional log / analysis / hit detail
4. `src/combat/engine/analysis/*` - no-op or skip when score-only
5. `src/combat/engine/simulation/branchCore.ts` - snapshot/merge skip unused maps; key parity
6. `src/combat/engine/simulation/summary.ts` - `finish` / `combineBranchSummaries` thin path
7. `src/combat/engine/simulation/revolution.ts` / `simulate.ts` - thread option
8. `src/combat/solver/evaluate.ts` - request score-only for search; optional full re-sim
9. `src/combat/solver/evaluationSession.ts` - pass level with mode
10. `src/combat/solver/contracts.ts` - document `ScoreableSummary` as score-only wire
11. Tests: `evaluate.test.ts`, `objective.test.ts`, `summary.test.ts`, branch tests,
    `search/scoreHonesty.test.ts`, new parity golden
12. Docs: this file + short note in `docs/combat-engine.md` when shipping

Out of scope for Phase 3: changing objective weights, horizons, proof labels,
or branch cap policy.

## Non-goals

- Faster-but-approximate damage (EV shortcuts that change scores)
- Dropping state-changing RNG branching
- Ranking residual / approximated mass as exact
- Shipping score-only as the public combat inspector default
