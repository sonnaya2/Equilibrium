import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { costOf, performOffGcdCast, prepareSimulationCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { firstLegalTick } from "../runtime/state";
import {
  appendWithIntermediateCap,
  combineExactness,
  mergeAndCapBranches,
  type Branch,
  type BranchExactness,
} from "./branch";
import type { CastAttempt, CastContext, CastContextInput, CastRng, SimulateOptions } from "./contracts";
import { advanceToBranches, commitCastBranches } from "./lengLandBranch";
import { combineBranchSummaries } from "./summary";

/**
 * Manual CastContext: multi-branch under the hood so land-time Leng forks keep
 * stack EV. prepareSimulationCast may advance with advanceTo; commit uses
 * commitCastBranches. finish drains via combineBranchSummaries (drainBranchToEnd).
 * getState / costOf / firstLegalTick read the heaviest live branch (representative).
 *
 * Multi-parent expansions intermediate-cap via appendWithIntermediateCap
 * (materializeCastPlans absorb parity) so parent*Leng products never peak unbounded.
 */
export function createCastContext(input: CastContextInput): CastContext {
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
    const capped = mergeAndCapBranches(set.branches);
    residualWeight += capped.residualWeight;
    exactness = combineExactness(exactness, capped.exactness);
    if (capped.branches.length > 1) sawBranching = true;
    branches = capped.branches;
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
      return firstLegalTick(
        rt.state,
        abilityId,
        ability?.cooldownGroup ?? ability?.replacementGroup,
      );
    },
    advanceTo: (targetTick) => {
      let next: Branch[] = [];
      let residual = 0;
      let exact: BranchExactness = "exact";
      for (const branch of branches) {
        if (branch.error !== undefined) {
          const folded = appendWithIntermediateCap(next, [branch]);
          residual += folded.residualWeight;
          exact = combineExactness(exact, folded.exactness);
          next = folded.branches;
          continue;
        }
        const stepped = advanceToBranches(branch, targetTick);
        residual += stepped.residualWeight;
        exact = combineExactness(exact, stepped.exactness);
        if (stepped.branches.length > 1) sawBranching = true;
        const folded = appendWithIntermediateCap(next, stepped.branches);
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
          const folded = appendWithIntermediateCap(next, [branch]);
          residual += folded.residualWeight;
          exact = combineExactness(exact, folded.exactness);
          next = folded.branches;
          continue;
        }
        // Advance may use plain advanceTo inside prepare; Leng expands on commit.
        const preparation = prepareSimulationCast(branch.rt, ability, readyTick);
        if (!preparation.ok) {
          const folded = appendWithIntermediateCap(next, [branch]);
          residual += folded.residualWeight;
          exact = combineExactness(exact, folded.exactness);
          next = folded.branches;
          lastError = preparation.error;
          continue;
        }
        const committed = commitCastBranches(branch, preparation.prepared, auto, rng);
        residual += committed.residualWeight;
        exact = combineExactness(exact, committed.exactness);
        if (committed.branches.length > 1) sawBranching = true;
        const folded = appendWithIntermediateCap(next, committed.branches);
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
        error !== undefined
          ? branches.map((b) => ({ ...b, error: b.error ?? error }))
          : branches;
      return combineBranchSummaries(
        terminal,
        horizonTicks ?? input.horizonTicks,
        options,
        sawBranching,
        residualWeight,
        exactness,
      );
    },
    byId: root.byId,
    basicByStyle: root.basicByStyle,
  };
}
