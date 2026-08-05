# Phase 2: probability semantics (ranking honesty)

**Date:** 2026-08-04  
**Status:** landed on working tree (not necessarily committed)

## Invariant

A conditional mean over retained branches must **never** be exposed as unit-mass expected damage and must **never** be used as a solver ranking score.

## Semantics

| Quantity | Definition | Rankable? |
|----------|------------|-----------|
| `concreteMass` | Sum of expanded terminal weights | n/a |
| `residualMass` / `residualWeight` | Unexpanded / cap-discarded mass | n/a |
| `conditionalConcreteMean` | E[D\|concrete] = weight-normalized mean over expanded terminals | **No** |
| `knownMassExpectedDamage` | `concreteMass * conditionalConcreteMean` = ∑ wᵢ Dᵢ | **No** (diagnostic / known contribution only) |
| `expectedDamage` / `totalExpected` | unit-mass EV when residual ~ 0; known-mass contribution when residual > 0 | Only when scope is `unit-mass` and exact |
| `damageByTick` | Same scale as primary (`knownMassScale` when residual) | Only unit-mass ledger ranks |
| `scope` / `totalsBasis` | `unit-mass` \| `known-mass-contribution` \| `concrete-terminals` | unit-mass only |
| `eligibleForRanking` | residual ~ 0 and exact and ok | gate |

Under residual:

- Primary is **not** E[D\|concrete] renormalized to mass 1.
- Primary is **known-mass contribution** (∑ wᵢ Dᵢ), with explicit scope `known-mass-contribution`.
- Residual is **not** invented as damage; it remains unassigned.
- Conditional mean is preserved on `conditionalConcreteMean` for diagnostics only.

## Solver gates (`OBJECTIVE_VERSION = 4`)

`summaryObjectiveIneligibilityReason` fails ranking for:

- `failedWeight > 0`
- `residualWeight > 0`
- non-unit-mass totals basis (`concrete-terminals`, `known-mass-contribution`)
- non-exact exactness

Applied to:

- full/medium `scoreSummary`
- short exploratory `evaluateRevolutionBar` (no finite score from residual conditional DPM)
- evaluation session maps non-rankable to `finite: false`

## Files

- `src/combat/engine/simulation/contracts.ts`
- `src/combat/engine/simulation/summary.ts`
- `src/combat/solver/contracts.ts` (OBJECTIVE_VERSION 4, ScoreableSummary)
- `src/combat/solver/objective.ts` / `evaluate.ts` / `evaluationSession.ts`
- UI residual notes: `revoStochasticLabels.ts`
- Tests: stochastic contract, objective, evaluate, labels, repro

## Verify

```bash
npx vitest run src/combat/engine/simulation
npx vitest run src/combat/solver/objective.test.ts src/combat/solver/evaluate.test.ts src/combat/solver/search/scoreHonesty.test.ts src/combat/solver/repro
npx vitest run src/components/combat/revoStochasticLabels.test.ts
```
