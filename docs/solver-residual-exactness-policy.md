# Residual / exactness product law (solver objective)

**Status:** locked product law (2026-08). Gates in `scoreSummary` stay hard-fail.  
**Driver:** `leng-icy-context` degrades because `residualWeight > 0` / `exactness=bounded-approximation` fails full-horizon robust scoring.

## Decision

| Option | Verdict |
|--------|---------|
| **1.** Rank hard-cap residual as labeled bounded-approx (still "verified") | **Reject.** Cap residual discards **non-equivalent** futures (stack / frost windows). Not equivalent-mass leftover. Plan: no fake verified. |
| **2.** Reduce residual so exactness stays exact more often | **Accept (preferred).** Coordinate with Leng EV / hybrid fold work; exact merge first. |
| **3.** Search-only rank under explicit bounded-approx proof (not verified) | **Reject as primary.** Product already has proof labels + exploratory short-horizon path; do not add full-horizon rank-under-residual without a separate design + `OBJECTIVE_VERSION` bump. Prefer zero residual instead. |

**Never launder residual into exact.** Residual mass must stay disclosed on the sim summary; survivors never absorb discarded non-equivalent weight.

## Current gates (do not weaken)

Source: `src/combat/solver/objective.ts` (`scoreSummary`, `summaryEligibleForObjectiveScore`, `summaryObjectiveIneligibilityReason`, `exactnessEligibleForExactProof`).

Hard-fail **any** rankable score (full robust **and** short exploratory) when any of:

1. `summary.ok === false`
2. `rng.failedWeight > 0`
3. `rng.residualWeight > 0`
4. `damage.scope` / `rng.totalsBasis` is not unit-mass (`known-mass-contribution` or `concrete-terminals`)
5. `rng.exactness` ∈ `{ approximated, bounded-approximation, truncated, resampled }`

Exact proof eligibility: only `exact`, `merged-exactly`, or missing exactness.

Pinned by:

- `src/combat/solver/objective.test.ts`
- `src/combat/solver/evaluate.test.ts` (exploratory residual gate)
- `src/combat/solver/search/scoreHonesty.test.ts` (residual never unlocks exact proof)
- `src/combat/engine/simulation/stochasticSummary.contract.test.ts` (known-mass primary)
- Leng branch tests: `lengLandBranch.test.ts`, `styles/melee/leng.test.ts`

`OBJECTIVE_VERSION` is **4**: residual / non-unit-mass / non-exact hard-fail on explore and full. Changing these gates requires a version bump and honesty test updates.

## What residual means for Leng

- Leng land RNG is **state-changing** (Primordial Ice stacks + Frostblades window), not damage-only EV.
- Live set is hard-capped (`MAX_LIVE_BRANCHES = 64`). Discarded weight → `residualWeight` + `exactness=bounded-approximation`.
- That residual is **not** "equivalent paths we failed to merge"; stack/frost diverge futures intentionally.

## Preferred residual → 0 path

1. **Exact atom merge only** when all future-relevant Leng values match. Expired stack and Frostblades timestamps normalize independently to zero.
2. Do **not** raise caps silently or reassign discarded mass onto a survivor class.

## Probability semantics under residual (Phase 2)

When `residualWeight > 0`, engine primary totals are **not** E[D|concrete] renormalized to mass 1:

| Field | Meaning |
|-------|---------|
| `conditionalConcreteMean` | E[D\|concrete] (diagnostic only; never ranks) |
| `knownMassExpectedDamage` | `concreteMass * conditionalConcreteMean` = sum w_i D_i |
| `expectedDamage` / `totalExpected` | known-mass contribution; `scope` / `totalsBasis` = `known-mass-contribution` |
| `damageByTick` | same known-mass scale |

Residual mass stays unassigned (not invented damage). See `reports/solver-probability-semantics-phase2.md`.

## No exploratory fallback as solved result (Phase 4)

When full-horizon objective fails for every shortlist candidate (including residual):

- Full eval: `validForFinalRanking=false`, objective reason carries residual / exactness / non-unit-mass basis.
- Search short horizon: residual / non-unit-mass / non-exact summaries are **not** finite rankable scores (same gate as full). Residual-free short DPM remains exploratory-only (`validForFinalRanking=false`).
- Finalize: **`status=failed`**, **`best=null`**, **`proof=failed`**. Exploratory scores stay on `bestExploratoryScore` (debug / progress only).
- **Never** emit applyable `degraded-exploratory-fallback` winners. DTO builder rejects nonvalidated winners. Apply stays disabled.

UI labels residual / known-mass basis (`revoStochasticLabels`); that is **presentation**, not solver ranking permission.

## Out of scope for this policy

- Raising `MAX_LIVE_BRANCHES` for Leng-only without measuring residual and wall time.
- Ranking full-horizon robust windows over residual mass.
- Calling exploratory DPM "verified" or "exact robust".

## Adaptive branch fidelity (related)

Prefer **adaptive live caps** over a silent global raise: pass `BranchBudget`
through the sim and escalate (64→…→4096 by mode) until residual/exactness meet
a configurable completeness bar, else unrankable. See
`docs/solver-branch-fidelity-design.md`. Completeness thresholds do not weaken
the gates above.
