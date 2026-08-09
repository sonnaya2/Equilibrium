# Solver multi-fidelity search (Phase 7)

Status: **landed** (staged allocation + medium screen + honesty gates).
Scope: reduce short-explore vs full-robust divergence by spending part of the
existing evaluation budget on a medium-horizon robust-shaped screen, without
lowering `TIER_BUDGETS`.

## Problem

Short exploratory DPM (`durationTicks < MIN_RANKABLE_HORIZON_TICKS`) and the
full robust objective (proportional open/mid/steady windows at tier full
horizon) often disagree on ranking. Search spends the whole budget on short
scores, then finalize only full-rescores a small shortlist - so good full
bars can be discarded early.

## Design

Three fidelities; **scales never mix** for final ranking:

| Stage | Horizon | Objective | `validForFinalRanking` | Budget |
| ----- | ------- | --------- | ---------------------- | ------ |
| short | `exploreTicks` (tier exploreSeconds) | single-window DPM | **false** | ~65% of search budget |
| medium | midpoint explore/full, clamp `[MIN_RANKABLE, full-1]` | same weights / proportional windows as full | **false** | ~35% + unused short |
| full finalize | `fullTicks` (tier fullSeconds) | robust (existing) | **true** when ok | force-evals (outside share math) |

- Total search budget stays `TIER_BUDGETS[tier] * lenScale` (unchanged numbers).
- Tiny budgets (`< 32`) stay short-only so unit tests and quick benches do not
  split.
- If no useful medium horizon exists (full already at min rankable), medium
  stage is skipped and 100% stays short.

## Orchestration (`solve` / `solveAsync`)

1. `planFidelityStages(config)` from `mediumHorizonTicks` + budget.
2. `beginShortStage` caps `budget.remaining` to the short share.
3. Existing phases: seed, exhaustive, beam, evo, LNS, anneal, local (all
   `mode: "search"`).
4. `beginMediumStage` grants medium share + unused short remainder.
5. `runMediumScreen`: rescore short-stage incumbents (best explore, seeds,
   archive tops) at `mode: "medium"`, plus a few swaps of the medium best.
6. `finalizeSearch*`: shortlist prefers medium incumbents, then explore;
   **always** `forceEval(..., "full")` for finalists.

## Honesty rules

- Medium never sets `validForFinalRanking` (even if a mock claims true).
- Medium never updates `bestFull` / full leaderboard.
- Degraded fallback still only uses exploratory search scores, never pretends
  medium is full robust.
- Memo / cache keys include mode + horizon so short/medium/full never collide.
- Progress may report `fidelity` / `evaluationMode: "medium"`; `bestScore`
  stays exploratory DPM for the whole run.

## Incumbents

Previous winners feed the next stage:

- Medium: short best + authored seeds + search archive tops.
- Finalize shortlist: seed best, authored seeds, **medium best / medium
  archive**, then diverse exploratory fillers.

## Files

| File | Role |
| ---- | ---- |
| `src/combat/solver/fidelity.ts` | shares, medium horizon, helpers |
| `src/combat/solver/search/fidelityBudget.ts` | stage plan + budget caps |
| `src/combat/solver/search/mediumScreen.ts` | medium incumbent rescoring |
| `src/combat/solver/search/types.ts` | medium mode cache / bestMedium |
| `src/combat/solver/solve.ts` | staged solve/solveAsync |
| `src/combat/solver/search/finalize.ts` | medium-aware shortlist |
| `src/combat/solver/evaluationSession.ts` | mediumTicks path; strip final rank |
| `src/combat/solver/requestContext.ts` | compute mediumTicks |
| `src/combat/solver/fidelity.test.ts` | allocation + honesty gates |

## Non-goals

- Lowering `TIER_BUDGETS` or cutting total evals.
- Ranking medium scores against full scores.
- Replacing finalize full-horizon rescoring with medium.
- Changing expected-value or future-state RNG treatment.

## Verify

```text
npx vitest run src/combat/solver/fidelity.test.ts src/combat/solver/search/scoreHonesty.test.ts
```
