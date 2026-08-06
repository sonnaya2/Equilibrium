import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { prepareCast, type PreparedCast } from "../cast/prepare";
import { castRejection, candidateTick, resolveCastAbility, rngPointsFor } from "../cast/rules";
import { resolveIcyTempest } from "../../styles/melee/icyTempest";
import { firstLegalTickFor } from "../runtime/state";
import type { CastRng } from "./contracts";
import {
  combineExactness,
  appendWithIntermediateCap,
  mergeAndCapBranches,
  MAX_INTERMEDIATE_BRANCHES,
  MAX_LIVE_BRANCHES,
  noteBranchLiveCount,
  noteResidualMass,
  snapshotRuntime,
  type Branch,
  type BranchExactness,
  type BranchSet,
} from "./branchCore";
import { advanceToBranches, commitCastBranches } from "./lengLandBranch";
import { runWithHitReuseScope } from "../resolution/hitReuse";

export type { Branch, BranchExactness, BranchSet, BranchProfile } from "./branchCore";
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
  defaultBranchBudget,
  resolveBranchBudget,
  branchCapsFromBudget,
  enableBranchProfiling,
  isBranchProfilingEnabled,
  resetBranchProfile,
  getBranchProfile,
  noteBranchLiveCount,
  noteFidelityRetry,
  noteBranchKeyConstructionMs,
  noteResidualMass,
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
 * cast-time RNG (Impatient / Relentless / Avernic / Spectral Scythe soul) as weight plans.
 * No snapshot/commit; materializeCastPlans materializes the heaviest survivors.
 * Rejected post-advance arms are returned as `errors` so mass is not dropped.
 */
export function planCastOutcomes(
  branch: Branch,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
  maxLive: number = MAX_LIVE_BRANCHES,
  intermediateMax: number = MAX_INTERMEDIATE_BRANCHES,
): {
  plans: CastOutcomePlan[];
  errors: Branch[];
  residualWeight: number;
  exactness: BranchExactness;
} {
  if (branch.error !== undefined) {
    return { plans: [], errors: [branch], residualWeight: 0, exactness: "exact" };
  }

  // Igneous (etc.): base ultimate on the bar becomes the unlocked upgrade.
  const { ability: castAbility } = resolveCastAbility(ability, {
    byId: branch.rt.byId,
    weaponConfiguration: branch.rt.input.weaponConfiguration,
    equipmentIds: branch.rt.input.equipmentIds,
    passiveIds: branch.rt.input.equipmentEffects?.passiveIds,
  });

  const candidate = Math.max(
    candidateTick(branch.rt.state, readyTick),
    firstLegalTickFor(branch.rt.state, castAbility, branch.rt.input.level),
  );
  const advanced = advanceToBranches(branch, candidate, maxLive, intermediateMax);

  const plans: CastOutcomePlan[] = [];
  const errors: Branch[] = [];
  for (const at of advanced.branches) {
    if (at.error !== undefined) {
      errors.push(at);
      continue;
    }
    const rejection = castRejection(
      at.rt.state,
      castAbility,
      candidate,
      at.rt.input.weaponConfiguration,
      at.rt.input.equipmentIds,
      at.rt.input.equipmentEffects?.passiveIds,
      at.rt.byId,
    );
    if (rejection) {
      errors.push({ ...at, error: rejection });
      continue;
    }
    // Icy Tempest: enumerate coupled stack, damage, spend, and post-cast state.
    if (castAbility.id === "icy_tempest") {
      const resolved = resolveIcyTempest(
        at.rt.state.melee.primordialIce,
        candidate,
        at.rt.state.ringOfVigour,
      );
      for (const outcome of resolved.outcomes) {
        if (!(outcome.probability > 0)) continue;
        const outcomePrepared = prepareCast(at.rt, castAbility, candidate, outcome);
        const points = rngPointsFor(
          at.rt.state,
          castAbility,
          outcomePrepared.candidate,
          outcomePrepared.spend,
          at.rt.input.adrenaline,
          at.rt.input.league,
        );
        if (points.length === 0) {
          plans.push({
            weight: at.weight * outcome.probability,
            parent: at,
            prepared: outcomePrepared,
            auto,
            inPlace: resolved.outcomes.length === 1,
          });
          continue;
        }
        for (const { rng, weight } of rngWeightProduct(points)) {
          if (weight <= 0) continue;
          plans.push({
            weight: at.weight * outcome.probability * weight,
            parent: at,
            prepared: outcomePrepared,
            auto,
            rng,
            inPlace: false,
          });
        }
      }
      continue;
    }

    const prepared = prepareCast(at.rt, castAbility, candidate);
    const points = rngPointsFor(
      at.rt.state,
      castAbility,
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
      error: `unable to prepare ${castAbility.id} at tick ${candidate}`,
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
  intermediateMax: number = MAX_INTERMEDIATE_BRANCHES,
): BranchSet {
  return runWithHitReuseScope(() => materializeCastPlansInner(plans, max, intermediateMax));
}

function materializeCastPlansInner(
  plans: readonly CastOutcomePlan[],
  max: number,
  intermediateMax: number,
): BranchSet {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`materializeCastPlans: max must be a positive integer, got ${max}`);
  }
  if (!Number.isInteger(intermediateMax) || intermediateMax < max) {
    throw new RangeError(
      `materializeCastPlans: intermediateMax must be an integer >= max, got ${intermediateMax}`,
    );
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
      max,
      intermediateMax,
    );
    residualWeight += committed.residualWeight;
    exactness = combineExactness(exactness, committed.exactness);
    absorb(committed.branches);
  }

  let keep = forked;
  if (forked.length > max) {
    const sorted = [...forked].sort((a, b) => b.weight - a.weight);
    keep = sorted.slice(0, max).map((p) => ({ ...p }));
    let trimmed = 0;
    for (let i = max; i < sorted.length; i++) trimmed += sorted[i]!.weight;
    residualWeight += trimmed;
    if (trimmed > 0) noteResidualMass(trimmed);
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
      max,
      intermediateMax,
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
 * Oracle-scale materialize skips intermediate caps; plan advance uses live budget.
 */
export function castOutcomes(
  branch: Branch,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
  maxLive: number = MAX_LIVE_BRANCHES,
  intermediateMax: number = MAX_INTERMEDIATE_BRANCHES,
): BranchSet {
  const planned = planCastOutcomes(branch, ability, readyTick, auto, maxLive, intermediateMax);
  if (planned.plans.length === 0) {
    return {
      branches: planned.errors,
      residualWeight: planned.residualWeight,
      exactness: planned.exactness,
    };
  }
  const material = materializeCastPlans(
    planned.plans,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
  );
  return {
    branches: [...planned.errors, ...material.branches],
    residualWeight: planned.residualWeight + material.residualWeight,
    exactness: combineExactness(planned.exactness, material.exactness),
  };
}

export type { CompiledLengLandTable, LengLandArm } from "../../styles/melee/lengRng";
export {
  compileLengLandArms,
  compileLengLandTable,
  FROSTBLADES_DURATION_TICKS,
  lengLandTableFor,
} from "../../styles/melee/lengRng";
export {
  expandLengOnLand,
  advanceToBranches,
  MAX_LENG_INTERMEDIATE_BRANCHES,
} from "./lengLandBranch";
