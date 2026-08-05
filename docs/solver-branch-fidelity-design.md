# Adaptive branch fidelity (Phase 3)

Status: **landed** (engine budget threading + adaptive ladders + solver opt-in).

Branch-**width** fidelity is separate from horizon multi-fidelity
(`docs/solver-multi-fidelity-design.md`: short/medium/full **ticks**).

## Problem

A single global `MAX_LIVE_BRANCHES = 64` forces residual on hard Impatient /
Relentless / Avernic / Tsunami fanout. Raising the constant only delays the
failure and slows residual-free bars.

## Design

### BranchBudget (passed through sim)

```ts
interface BranchBudget {
  maxLiveBranches: number;
  maxIntermediateBranches: number;
  maximumResidualWeight: number; // acceptance threshold, not a sim discard knobs
}
```

- Omitted budget → defaults `{ 64, 128, 0 }` (behavior-preserving).
- Discarded mass stays residual; never reassigned onto survivors.
- `SimulateOptions.branchBudget` threads live/intermediate into revolution,
  manual simulate, advance/drain, materialize, and summary combine.

### Adaptive ladders (configurable)

| Mode | liveCaps (start) | residual ≤ | exactness |
| ---- | ---------------- | ---------- | --------- |
| exploratory | 64 → 128 → 256 → 512 | 1e-3 | any |
| medium | 256 → 512 → 1024 | 1e-4 | any |
| full | 512 → 1024 → 2048 → 4096 | 1e-12 | exact or merged-exactly |

Values may change after profiling via `branchFidelityOverrides` / ladder resolve.

Policy:

1. Run initial live cap.
2. If residual/exactness incomplete, retry at next cap.
3. Stop immediately when residual is numerically free (`<= 1e-12`) and exactness ok.
4. residual in `(0, mode threshold]` is guidance-complete: **keep escalating while
   higher rungs remain** so unit-mass ranking can still succeed; on the **last**
   rung, accept as complete (may still be unrankable under OBJECTIVE v4).
5. Ladder exhausted with residual above threshold → incomplete / unrankable
   (last summary kept for diagnostics; known-mass ledger only).

### Honesty (unchanged product law)

- Full ranking still requires residual-free unit-mass + exact/merged-exactly
  (`OBJECTIVE_VERSION` 4 gates in `objective.ts`).
- Residual summaries use **known-mass contribution**, never renormalized
  conditional mean (`docs/solver-residual-exactness-policy.md`).
- Mode residual thresholds (1e-3 / 1e-4 / 1e-12) gate adaptive **effort**, not
  permission to rank residual as unit-mass EV.
- Prefer unrankable over fabricated high scores.

### Occupancy path

`commitCastBranches` / cast occupancy advance must receive the same live and
intermediate caps as the outer driver. A silent `MAX_LIVE_BRANCHES=64` inside
commit would defeat adaptive width on Leng / multi-hit lands.

### Solver wiring

- `evaluationSession` sets `branchFidelityMode` from short/medium/full.
- Standalone `evaluateRevolutionBar` / `simulateRevolution` stay single-shot
  unless `branchFidelityMode` is set.
- Memo context includes branch fidelity mode so ladders never mix with default 64.

## Files

| File | Role |
| ---- | ---- |
| `src/combat/engine/simulation/contracts.ts` | `BranchBudget` on `SimulateOptions` |
| `src/combat/engine/simulation/branchCore.ts` | `resolveBranchBudget` / defaults |
| `src/combat/solver/branchFidelity.ts` | ladders, completeness, adaptive sim |
| `src/combat/solver/evaluate.ts` | adaptive opt-in + incomplete → unrankable |
| `src/combat/solver/evaluationSession.ts` | solver maps horizon mode → ladder |

## Non-goals

- Raising only `MAX_LIVE_BRANCHES` as the fix.
- Ranking residual / bounded-approximation as full robust proof.
- Changing horizon budget shares (`TIER_BUDGETS` / fidelity.ts).

## Verify

```text
npx vitest run src/combat/solver/branchFidelity.test.ts `
  src/combat/solver/objective.test.ts src/combat/solver/evaluate.test.ts `
  src/combat/solver/search/scoreHonesty.test.ts `
  src/combat/engine/simulation/branch.test.ts
```
