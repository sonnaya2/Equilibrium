import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { costOf, performOffGcdCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { firstLegalTick, firstLegalTickFor } from "../runtime/state";
import {
  appendWithIntermediateCap,
  branchCapsFromBudget,
  combineExactness,
  materializeCastPlans,
  mergeAndCapBranches,
  planCastOutcomes,
  type Branch,
  type BranchExactness,
  type CastOutcomePlan,
} from "./branch";
import type {
  BranchBudget,
  CastAttempt,
  CastContext,
  CastContextInput,
  CastRng,
  SimulateOptions,
} from "./contracts";
import { advanceToBranches } from "./landBranch";
import { combineBranchSummaries } from "./summary";

/**
 * Manual CastContext: multi-branch under the hood.
 * performCast uses planCastOutcomes + materializeCastPlans (same as Revolution/solver),
 * so Icy Tempest forks on coupled integer stack outcomes.
 * finish drains via combineBranchSummaries. getState reads heaviest live branch.
 */
export function createCastContext(
  input: CastContextInput,
  branchBudget?: BranchBudget,
): CastContext {
  const { maxLive, intermediateMax } = branchCapsFromBudget(branchBudget);
  const root = createRuntime(input);
  let branches: Branch[] = [{ weight: 1, rt: root }];
  let residualWeight = 0;
  let exactness: BranchExactness = "exact";
  let sawBranching = false;

  function primary(): Branch {
    const ok = branches.filter((b) => b.error === undefined);
    const pool = ok.length > 0 ? ok : branches;
    return pool.reduce((best, b) => (b.weight > best.weight ? b : best));
  }

  function absorb(set: { branches: Branch[]; residualWeight: number; exactness: BranchExactness }) {
    residualWeight += set.residualWeight;
    exactness = combineExactness(exactness, set.exactness);
    if (set.branches.length > 1) sawBranching = true;
    const capped = mergeAndCapBranches(set.branches, maxLive);
    residualWeight += capped.residualWeight;
    exactness = combineExactness(exactness, capped.exactness);
    if (capped.branches.length > 1) sawBranching = true;
    branches = capped.branches;
  }

  /**
   * When the caller forces CastRng (Relentless/Impatient tests), collapse RNG product
   * arms onto that forced outcome without collapsing distinct future states.
   */
  function applyForcedRng(plans: readonly CastOutcomePlan[], rng: CastRng): CastOutcomePlan[] {
    return plans.map((p) => ({
      ...p,
      rng,
      inPlace: plans.length === 1,
    }));
  }

  return {
    getState: () => primary().rt.state,
    costOf: (ability) => {
      const rt = primary().rt;
      return costOf(rt.state, ability, rt.state.tick);
    },
    firstLegalTick: (abilityId) => {
      const rt = primary().rt;
      const ability = rt.byId.get(abilityId);
      if (ability) return firstLegalTickFor(rt.state, ability, rt.input.level);
      return firstLegalTick(rt.state, abilityId);
    },
    advanceTo: (targetTick) => {
      let next: Branch[] = [];
      let residual = 0;
      let exact: BranchExactness = "exact";
      for (const branch of branches) {
        if (branch.error !== undefined) {
          const folded = appendWithIntermediateCap(next, [branch], maxLive);
          residual += folded.residualWeight;
          exact = combineExactness(exact, folded.exactness);
          next = folded.branches;
          continue;
        }
        const stepped = advanceToBranches(branch, targetTick, maxLive, intermediateMax);
        residual += stepped.residualWeight;
        exact = combineExactness(exact, stepped.exactness);
        if (stepped.branches.length > 1) sawBranching = true;
        const folded = appendWithIntermediateCap(next, stepped.branches, maxLive);
        residual += folded.residualWeight;
        exact = combineExactness(exact, folded.exactness);
        next = folded.branches;
      }
      absorb({ branches: next, residualWeight: residual, exactness: exact });
    },
    performCast: (
      ability: AbilitySpec,
      readyTick: number,
      auto: boolean,
      rng?: CastRng,
    ): CastAttempt => {
      let next: Branch[] = [];
      let residual = 0;
      let exact: BranchExactness = "exact";
      let anyOk = false;
      let lastError: string | undefined;
      for (const branch of branches) {
        if (branch.error !== undefined) {
          const folded = appendWithIntermediateCap(next, [branch], maxLive);
          residual += folded.residualWeight;
          exact = combineExactness(exact, folded.exactness);
          next = folded.branches;
          continue;
        }
        // Same cast pipeline as Revolution/solver: advance + prepare + spend/RNG forks.
        const planned = planCastOutcomes(
          branch,
          ability,
          readyTick,
          auto,
          maxLive,
          intermediateMax,
        );
        residual += planned.residualWeight;
        exact = combineExactness(exact, planned.exactness);

        if (planned.plans.length === 0) {
          // Rejected cast: advance already applied; keep branch castable (no error poison).
          for (const err of planned.errors) {
            const live = { weight: err.weight, rt: err.rt };
            const folded = appendWithIntermediateCap(next, [live], maxLive);
            residual += folded.residualWeight;
            exact = combineExactness(exact, folded.exactness);
            next = folded.branches;
            lastError = err.error ?? lastError;
          }
          continue;
        }

        const plans = rng !== undefined ? applyForcedRng(planned.plans, rng) : [...planned.plans];
        const material = materializeCastPlans(plans, maxLive, intermediateMax);
        residual += material.residualWeight;
        exact = combineExactness(exact, material.exactness);
        if (material.branches.length > 1 || plans.length > 1) sawBranching = true;

        // Sibling arms that rejected: keep advanced state without permanent error.
        for (const err of planned.errors) {
          const live = { weight: err.weight, rt: err.rt };
          const folded = appendWithIntermediateCap(next, [live], maxLive);
          residual += folded.residualWeight;
          exact = combineExactness(exact, folded.exactness);
          next = folded.branches;
          lastError = err.error ?? lastError;
        }
        const folded = appendWithIntermediateCap(next, material.branches, maxLive);
        residual += folded.residualWeight;
        exact = combineExactness(exact, folded.exactness);
        next = folded.branches;
        anyOk = true;
      }
      absorb({ branches: next, residualWeight: residual, exactness: exact });
      if (anyOk) return { ok: true };
      return { ok: false, error: lastError ?? `unable to cast ${ability.id}` };
    },
    performOffGcdCast: (ability) => {
      for (const branch of branches) {
        if (branch.error !== undefined) continue;
        performOffGcdCast(branch.rt, ability);
      }
    },
    cancelCastEvents: (castSeq) => {
      let n = 0;
      for (const branch of branches) {
        n = Math.max(n, branch.rt.queue.cancelByOwner(castSeq));
      }
      return n;
    },
    finish: (error?: string, horizonTicks?: number, options?: SimulateOptions) => {
      const terminal =
        error !== undefined ? branches.map((b) => ({ ...b, error: b.error ?? error })) : branches;
      const finishOpts: SimulateOptions | undefined =
        branchBudget != null || options != null
          ? {
              ...options,
              branchBudget: options?.branchBudget ?? branchBudget,
            }
          : options;
      return combineBranchSummaries(
        terminal,
        horizonTicks ?? input.horizonTicks,
        finishOpts,
        sawBranching,
        residualWeight,
        exactness,
      );
    },
    byId: root.byId,
    basicByStyle: root.basicByStyle,
  };
}
