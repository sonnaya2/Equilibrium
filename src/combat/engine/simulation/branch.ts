import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { cloneAnalysisState, mixAnalysisStates } from "../analysis";
import { prepareCast, type PreparedCast } from "../cast/prepare";
import { castRejection, candidateTick, rngPointsFor } from "../cast/rules";
import { firstLegalTick } from "../runtime/state";
import type { CastRecord, CastRng } from "./contracts";
import type { SimulationRuntime } from "../runtime/runtime";
import { mergeSupportOffsets } from "./stats";
import { advanceToBranches, commitCastBranches } from "./lengLandBranch";

/**
 * Probability-weighted branch for state-changing RNG (Impatient, Relentless,
 * Avernic). Damage-only RNG stays expected-value. Equivalent futures merge:
 * weights sum, expected ledgers are weight-weighted means, support uses min/max.
 */
export interface Branch {
  weight: number;
  rt: SimulationRuntime;
  error?: string;
}

/**
 * How concrete branch weights relate to the full outcome measure.
 * discarded / residual mass is never reassigned to a non-equivalent survivor.
 */
export type BranchExactness =
  | "exact"
  | "merged-exactly"
  | "bounded-approximation"
  | "truncated"
  | "resampled";

/** Live branches plus mass removed without fabricating a concrete state. */
export interface BranchSet {
  branches: Branch[];
  residualWeight: number;
  exactness: BranchExactness;
}

const EXACTNESS_RANK: Record<BranchExactness, number> = {
  exact: 0,
  "merged-exactly": 1,
  truncated: 2,
  "bounded-approximation": 3,
  resampled: 4,
};

/** Lattice join: more approximate wins. */
export function combineExactness(a: BranchExactness, b: BranchExactness): BranchExactness {
  return EXACTNESS_RANK[a] >= EXACTNESS_RANK[b] ? a : b;
}

export function emptyBranchSet(
  branches: readonly Branch[] = [],
  residualWeight = 0,
  exactness: BranchExactness = "exact",
): BranchSet {
  return { branches: [...branches], residualWeight, exactness };
}

/** Independent copy of a runtime: mutable containers cloned, immutable events shared. */
export function snapshotRuntime(rt: SimulationRuntime): SimulationRuntime {
  const recordClones = new Map<CastRecord, CastRecord>();
  const cloneRecord = (record: CastRecord): CastRecord => {
    let clone = recordClones.get(record);
    if (!clone) {
      clone = { ...record, result: { ...record.result, hits: [...record.result.hits] } };
      recordClones.set(record, clone);
    }
    return clone;
  };
  return {
    ...rt,
    queue: rt.queue.clone(),
    state: structuredClone(rt.state),
    casts: rt.casts.map(cloneRecord),
    perAbility: { ...rt.perAbility },
    damageByTick: { ...rt.damageByTick },
    events: [...rt.events],
    recordBySeq: new Map([...rt.recordBySeq].map(([k, r]) => [k, cloneRecord(r)])),
    hitDetails: new Map([...rt.hitDetails].map(([key, value]) => [key, structuredClone(value)])),
    spiritEventMeta: new Map(
      [...rt.spiritEventMeta].map(([key, value]) => [key, structuredClone(value)]),
    ),
    scheduledSpiritTracks: new Set(rt.scheduledSpiritTracks),
    spiritHitCounts: new Map(rt.spiritHitCounts),
    analysis: cloneAnalysisState(rt.analysis),
  };
}

/**
 * Future-evolution key. Omits historical damage ledgers (merged separately).
 * Keeps endTick, hitDetails, spirit meta for terminal metrics and land-time reads.
 */
function branchKey(rt: SimulationRuntime): string {
  return JSON.stringify([
    rt.state,
    rt.queue.signature(),
    [...rt.hitDetails].sort(([a], [b]) => a - b),
    [...rt.spiritEventMeta].sort(([a], [b]) => a - b),
    [...rt.scheduledSpiritTracks].sort(),
    [...rt.spiritHitCounts].sort(([a], [b]) => a.localeCompare(b)),
    rt.endTick,
    rt.nextSeq,
    rt.nextCastSeq,
  ]);
}

/** Weight-average expected ledgers; support extrema via min/max offsets. */
function mergePair(a: Branch, b: Branch): Branch {
  const weight = a.weight + b.weight;
  const keep = a.weight >= b.weight ? a : b;
  const mix = (x: number, y: number) => (a.weight * x + b.weight * y) / weight;
  const bounds = mergeSupportOffsets(
    a.rt.totalMin,
    a.rt.totalMax,
    a.rt.analysis.supportMinOffset,
    a.rt.analysis.supportMaxOffset,
    b.rt.totalMin,
    b.rt.totalMax,
    b.rt.analysis.supportMinOffset,
    b.rt.analysis.supportMaxOffset,
    a.weight,
    b.weight,
  );
  keep.rt.totalMin = bounds.totalMin;
  keep.rt.totalMax = bounds.totalMax;
  keep.rt.totalExpected = mix(a.rt.totalExpected, b.rt.totalExpected);
  keep.rt.endTick = Math.max(a.rt.endTick, b.rt.endTick);
  for (const key of new Set([...Object.keys(a.rt.perAbility), ...Object.keys(b.rt.perAbility)])) {
    keep.rt.perAbility[key] = mix(a.rt.perAbility[key] ?? 0, b.rt.perAbility[key] ?? 0);
  }
  for (const key of new Set([
    ...Object.keys(a.rt.damageByTick),
    ...Object.keys(b.rt.damageByTick),
  ])) {
    const tick = Number(key);
    keep.rt.damageByTick[tick] = mix(a.rt.damageByTick[tick] ?? 0, b.rt.damageByTick[tick] ?? 0);
  }
  // Analysis is ledger-owned: weight-mix, do not rebuild from keep.events.
  keep.rt.analysis = mixAnalysisStates(a.rt.analysis, b.rt.analysis, a.weight, b.weight);
  keep.rt.analysis.supportMinOffset = bounds.supportMinOffset;
  keep.rt.analysis.supportMaxOffset = bounds.supportMaxOffset;
  keep.weight = weight;
  return keep;
}

/** Merge equivalent non-errored branches; errored branches stay separate. */
export function mergeBranches(branches: readonly Branch[]): Branch[] {
  const byKey = new Map<string, Branch>();
  const errored: Branch[] = [];
  for (const branch of branches) {
    if (branch.error !== undefined) {
      errored.push(branch);
      continue;
    }
    const key = branchKey(branch.rt);
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergePair(existing, branch) : branch);
  }
  return [...byKey.values(), ...errored];
}

/** Cap live branches after merge; discarded weight is residual, not reassigned. */
export const MAX_LIVE_BRANCHES = 64;

export function capBranches(
  branches: readonly Branch[],
  max: number = MAX_LIVE_BRANCHES,
): BranchSet {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`capBranches: max must be a positive integer, got ${max}`);
  }
  if (branches.length <= max) {
    return { branches: [...branches], residualWeight: 0, exactness: "exact" };
  }
  const sorted = [...branches].sort((a, b) => b.weight - a.weight);
  const keep = sorted.slice(0, max).map((b) => ({ ...b }));
  let residualWeight = 0;
  for (let i = max; i < sorted.length; i++) residualWeight += sorted[i]!.weight;
  return {
    branches: keep,
    residualWeight,
    exactness: residualWeight > 0 ? "bounded-approximation" : "exact",
  };
}

/** Merge equivalents, then cap live branch count. */
export function mergeAndCapBranches(
  branches: readonly Branch[],
  max: number = MAX_LIVE_BRANCHES,
): BranchSet {
  const before = branches.length;
  const merged = mergeBranches(branches);
  const capped = capBranches(merged, max);
  if (capped.residualWeight > 0) {
    return { ...capped, exactness: "bounded-approximation" };
  }
  if (merged.length < before) {
    return { ...capped, exactness: "merged-exactly" };
  }
  return { ...capped, exactness: "exact" };
}

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
    firstLegalTick(branch.rt.state, ability.id, ability.cooldownGroup ?? ability.replacementGroup),
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
 */
export function materializeCastPlans(
  plans: readonly CastOutcomePlan[],
  max: number = MAX_LIVE_BRANCHES,
): BranchSet {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`materializeCastPlans: max must be a positive integer, got ${max}`);
  }
  const inPlace: CastOutcomePlan[] = [];
  const forked: CastOutcomePlan[] = [];
  for (const plan of plans) {
    if (plan.inPlace) inPlace.push(plan);
    else forked.push(plan);
  }

  let residualWeight = 0;
  let exactness: BranchExactness = "exact";
  const out: Branch[] = [];

  for (const plan of inPlace) {
    const committed = commitCastBranches(
      { weight: plan.weight, rt: plan.parent.rt, error: plan.parent.error },
      plan.prepared,
      plan.auto,
      plan.rng,
    );
    residualWeight += committed.residualWeight;
    exactness = combineExactness(exactness, committed.exactness);
    out.push(...committed.branches);
  }

  let keep = forked;
  if (forked.length > max) {
    const sorted = [...forked].sort((a, b) => b.weight - a.weight);
    keep = sorted.slice(0, max).map((p) => ({ ...p }));
    for (let i = max; i < sorted.length; i++) residualWeight += sorted[i]!.weight;
    if (forked.length > max) exactness = combineExactness(exactness, "bounded-approximation");
  }

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
    out.push(...committed.branches);
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

export type { LengLandOutcome } from "../../styles/melee/lengRng";
export { lengLandOutcomes } from "../../styles/melee/lengRng";
export { expandLengOnLand, advanceToBranches } from "./lengLandBranch";
