import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { prepareCast, type PreparedCast } from "../cast/prepare";
import { castRejection, candidateTick, rngPointsFor } from "../cast/rules";
import { resolveIcyTempest } from "../../styles/melee/icyTempest";
import { firstLegalTickFor } from "../runtime/state";
import type { CastRng } from "./contracts";
import {
  combineExactness,
  appendWithIntermediateCap,
  mergeAndCapBranches,
  MAX_LIVE_BRANCHES,
  noteBranchLiveCount,
  snapshotRuntime,
  type Branch,
  type BranchExactness,
  type BranchSet,
} from "./branchCore";
import { advanceToBranches, commitCastBranches } from "./lengLandBranch";
import { runWithHitReuseScope } from "../resolution/hitReuse";

export type {
  Branch,
  BranchExactness,
  BranchSet,
  BranchProfile,
} from "./branchCore";
export {
  combineExactness,
  emptyBranchSet,
  snapshotRuntime,
  mergeBranches,
  MAX_LIVE_BRANCHES,
  capBranches,
  mergeAndCapBranches,
  appendWithIntermediateCap,
  MAX_INTERMEDIATE_BRANCHES,
  enableBranchProfiling,
  isBranchProfilingEnabled,
  resetBranchProfile,
  getBranchProfile,
  noteBranchLiveCount,
} from "./branchCore";

/** Weight plan for one RNG outcome before snapshot+commit. */
export interface CastOutcomePlan {
  weight: number;
  parent: Branch;
  prepared: PreparedCast;
  auto: boolean;
  rng?: CastRng;
  /** Single non-RNG path: commit on parent without cloning. */
  inPlace: boolean;
}

function rngWeightProduct(
  points: ReturnType<typeof rngPointsFor>,
): Array<{ rng: CastRng; weight: number }> {
  return points.reduce<Array<{ rng: CastRng; weight: number }>>(
    (current, point) =>
      current.flatMap(({ rng, weight }) => [
        { rng: { ...rng, [point.id]: true }, weight: weight * point.chance },
        { rng: { ...rng, [point.id]: false }, weight: weight * (1 - point.chance) },
      ]),
    [{ rng: {}, weight: 1 }],
  );
}

/**
 * Advance (with Leng land forks) to the candidate tick, prepare, and enumerate
 * cast-time RNG (Impatient / Relentless / Avernic) as weight plans.
 * No snapshot/commit; materializeCastPlans materializes the heaviest survivors.
 * Rejected post-advance arms are returned as `errors` so mass is not dropped.
 */
export function planCastOutcomes(
  branch: Branch,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
): {
  plans: CastOutcomePlan[];
  errors: Branch[];
  residualWeight: number;
  exactness: BranchExactness;
} {
  if (branch.error !== undefined) {
    return { plans: [], errors: [branch], residualWeight: 0, exactness: "exact" };
  }

  const candidate = Math.max(
    candidateTick(branch.rt.state, readyTick),
    firstLegalTickFor(branch.rt.state, ability, branch.rt.input.level),
  );
  const advanced = advanceToBranches(branch, candidate);

  const plans: CastOutcomePlan[] = [];
  const errors: Branch[] = [];
  for (const at of advanced.branches) {
    if (at.error !== undefined) {
      errors.push(at);
      continue;
    }
    const rejection = castRejection(
      at.rt.state,
      ability,
      candidate,
      at.rt.input.weaponConfiguration,
      at.rt.input.equipmentIds,
      at.rt.input.equipmentEffects?.passiveIds,
    );
    if (rejection) {
      errors.push({ ...at, error: rejection });
      continue;
    }
    const prepared = prepareCast(at.rt, ability, candidate);

    // Icy Tempest: fork only on distinct post-cast adrenaline spends (at most 4 groups).
    if (ability.id === "icy_tempest") {
      const resolved = resolveIcyTempest(
        at.rt.state.melee.primordialIce,
        candidate,
        at.rt.state.ringOfVigour,
      );
      const groups = resolved.spendDistribution.filter((g) => g.probability > 0);
      for (const group of groups) {
        const groupPrepared: PreparedCast = { ...prepared, spend: group.spend };
        const points = rngPointsFor(
          at.rt.state,
          ability,
          groupPrepared.candidate,
          groupPrepared.spend,
          at.rt.input.adrenaline,
          at.rt.input.league,
        );
        if (points.length === 0) {
          plans.push({
            weight: at.weight * group.probability,
            parent: at,
            prepared: groupPrepared,
            auto,
            inPlace: groups.length === 1,
          });
          continue;
        }
        for (const { rng, weight } of rngWeightProduct(points)) {
          if (weight <= 0) continue;
          plans.push({
            weight: at.weight * group.probability * weight,
            parent: at,
            prepared: groupPrepared,
            auto,
            rng,
            inPlace: false,
          });
        }
      }
      continue;
    }

    const points = rngPointsFor(
      at.rt.state,
      ability,
      prepared.candidate,
      prepared.spend,
      at.rt.input.adrenaline,
      at.rt.input.league,
    );
    if (points.length === 0) {
      plans.push({
        weight: at.weight,
        parent: at,
        prepared,
        auto,
        inPlace: true,
      });
      continue;
    }
    for (const { rng, weight } of rngWeightProduct(points)) {
      if (weight <= 0) continue;
      plans.push({
        weight: at.weight * weight,
        parent: at,
        prepared,
        auto,
        rng,
        inPlace: false,
      });
    }
  }

  // Never collapse multi-arm rejects onto one rt (would steal banked damage/state).
  if (plans.length === 0 && errors.length === 0) {
    errors.push({
      ...branch,
      error: `unable to prepare ${ability.id} at tick ${candidate}`,
    });
  }
  return {
    plans,
    errors,
    residualWeight: advanced.residualWeight,
    exactness: advanced.exactness,
  };
}

/**
 * Snapshot+commit plans (Leng land forks inside commit), keeping at most `max`
 * pre-commit forks by weight. Discarded fork mass is residual (not reassigned).
 *
 * Merge+cap after every expansion when survivors exceed `max` (same constant as
 * mergeAndCapBranches / MAX_LIVE_BRANCHES). Bounds peak at ~2*max instead of
 * O(parents * Leng survivors). Heaviest-k on a partial set then heaviest-k of
 * (kept U new) matches global heaviest-k; residual still disclosed.
 */
export function materializeCastPlans(
  plans: readonly CastOutcomePlan[],
  max: number = MAX_LIVE_BRANCHES,
): BranchSet {
  return runWithHitReuseScope(() => materializeCastPlansInner(plans, max));
}

function materializeCastPlansInner(
  plans: readonly CastOutcomePlan[],
  max: number,
): BranchSet {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`materializeCastPlans: max must be a positive integer, got ${max}`);
  }
  // Oracle path (castOutcomes uses MAX_SAFE_INTEGER): appendWithIntermediateCap skips cap.
  const inPlace: CastOutcomePlan[] = [];
  const forked: CastOutcomePlan[] = [];
  for (const plan of plans) {
    if (plan.inPlace) inPlace.push(plan);
    else forked.push(plan);
  }

  let residualWeight = 0;
  let exactness: BranchExactness = "exact";
  let out: Branch[] = [];

  const absorb = (added: readonly Branch[]) => {
    const folded = appendWithIntermediateCap(out, added, max);
    residualWeight += folded.residualWeight;
    exactness = combineExactness(exactness, folded.exactness);
    out = folded.branches;
  };

  for (const plan of inPlace) {
    const committed = commitCastBranches(
      { weight: plan.weight, rt: plan.parent.rt, error: plan.parent.error },
      plan.prepared,
      plan.auto,
      plan.rng,
    );
    residualWeight += committed.residualWeight;
    exactness = combineExactness(exactness, committed.exactness);
    absorb(committed.branches);
  }

  let keep = forked;
  if (forked.length > max) {
    const sorted = [...forked].sort((a, b) => b.weight - a.weight);
    keep = sorted.slice(0, max).map((p) => ({ ...p }));
    for (let i = max; i < sorted.length; i++) residualWeight += sorted[i]!.weight;
    if (forked.length > max) exactness = combineExactness(exactness, "bounded-approximation");
  }

  noteBranchLiveCount(keep.length + inPlace.length);
  for (const plan of keep) {
    const next = snapshotRuntime(plan.parent.rt);
    const committed = commitCastBranches(
      { weight: plan.weight, rt: next },
      plan.prepared,
      plan.auto,
      plan.rng,
    );
    residualWeight += committed.residualWeight;
    exactness = combineExactness(exactness, committed.exactness);
    absorb(committed.branches);
  }

  const capped = mergeAndCapBranches(out, max);
  return {
    branches: capped.branches,
    residualWeight: residualWeight + capped.residualWeight,
    exactness: combineExactness(exactness, capped.exactness),
  };
}

/**
 * One cast with state-changing RNG: prepare once, commit each outcome on a clone.
 * Returns BranchSet so residual / exactness are never dropped (oracle-safe).
 * Pre-cast advance and land-time Leng still use MAX_LIVE_BRANCHES inside
 * advanceToBranches; residualWeight discloses any discarded mass.
 */
export function castOutcomes(
  branch: Branch,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
): BranchSet {
  const planned = planCastOutcomes(branch, ability, readyTick, auto);
  if (planned.plans.length === 0) {
    return {
      branches: planned.errors,
      residualWeight: planned.residualWeight,
      exactness: planned.exactness,
    };
  }
  const material = materializeCastPlans(planned.plans, Number.MAX_SAFE_INTEGER);
  return {
    branches: [...planned.errors, ...material.branches],
    residualWeight: planned.residualWeight + material.residualWeight,
    exactness: combineExactness(planned.exactness, material.exactness),
  };
}

export type {
  CompiledLengLandTable,
  LengLandArm,
  LengLandOutcome,
  LengStackRow,
} from "../../styles/melee/lengRng";
export {
  compileLengLandArms,
  compileLengLandTable,
  FROSTBLADES_DURATION_TICKS,
  lengLandOutcomes,
  lengLandTableFor,
  materializeLengLandOutcomes,
} from "../../styles/melee/lengRng";
export {
  expandLengOnLand,
  advanceToBranches,
  MAX_LENG_INTERMEDIATE_BRANCHES,
} from "./lengLandBranch";
