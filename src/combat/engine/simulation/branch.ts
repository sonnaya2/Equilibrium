import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { cloneAnalysisState, mixAnalysisStates } from "../analysis";
import { commitCast, prepareSimulationCast, type PreparedCast } from "../cast";
import { rngPointsFor } from "../cast/rules";
import type { CastRecord, CastRng } from "./contracts";
import type { SimulationRuntime } from "../runtime/runtime";
import { mergeSupportOffsets } from "./stats";

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

/** Cap live branches after merge; discarded weight folds into the heaviest. */
export const MAX_LIVE_BRANCHES = 64;

export function capBranches(
  branches: readonly Branch[],
  max: number = MAX_LIVE_BRANCHES,
): Branch[] {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`capBranches: max must be a positive integer, got ${max}`);
  }
  if (branches.length <= max) return [...branches];
  const sorted = [...branches].sort((a, b) => b.weight - a.weight);
  const keep = sorted.slice(0, max).map((b) => ({ ...b }));
  let discardedWeight = 0;
  for (let i = max; i < sorted.length; i++) discardedWeight += sorted[i]!.weight;
  if (discardedWeight > 0) {
    keep[0] = { ...keep[0]!, weight: keep[0]!.weight + discardedWeight };
  }
  return keep;
}

/** Merge equivalents, then cap live branch count. */
export function mergeAndCapBranches(
  branches: readonly Branch[],
  max: number = MAX_LIVE_BRANCHES,
): Branch[] {
  return capBranches(mergeBranches(branches), max);
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
 * Prepare one cast and enumerate state-changing RNG as weight plans.
 * No snapshot/commit; materializeCastPlans materializes the heaviest survivors.
 */
export function planCastOutcomes(
  branch: Branch,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
): { error: Branch } | { plans: CastOutcomePlan[] } {
  const preparation = prepareSimulationCast(branch.rt, ability, readyTick);
  if (!preparation.ok) return { error: { ...branch, error: preparation.error } };
  const { prepared } = preparation;
  const points = rngPointsFor(
    branch.rt.state,
    ability,
    prepared.candidate,
    prepared.spend,
    branch.rt.input.adrenaline,
    branch.rt.input.league,
  );

  if (points.length === 0) {
    return {
      plans: [{ weight: branch.weight, parent: branch, prepared, auto, inPlace: true }],
    };
  }
  const plans: CastOutcomePlan[] = [];
  for (const { rng, weight } of rngWeightProduct(points)) {
    if (weight <= 0) continue;
    plans.push({
      weight: branch.weight * weight,
      parent: branch,
      prepared,
      auto,
      rng,
      inPlace: false,
    });
  }
  if (plans.length === 0) {
    return {
      plans: [{ weight: branch.weight, parent: branch, prepared, auto, inPlace: true }],
    };
  }
  return { plans };
}

/**
 * Snapshot+commit plans, keeping at most `max` forks by weight (capBranches policy).
 * In-place plans always commit; discarded fork weight folds into the heaviest kept.
 */
export function materializeCastPlans(
  plans: readonly CastOutcomePlan[],
  max: number = MAX_LIVE_BRANCHES,
): Branch[] {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`materializeCastPlans: max must be a positive integer, got ${max}`);
  }
  const inPlace: CastOutcomePlan[] = [];
  const forked: CastOutcomePlan[] = [];
  for (const plan of plans) {
    if (plan.inPlace) inPlace.push(plan);
    else forked.push(plan);
  }

  const out: Branch[] = [];
  for (const plan of inPlace) {
    commitCast(plan.parent.rt, plan.prepared, plan.auto, plan.rng);
    out.push({ weight: plan.weight, rt: plan.parent.rt, error: plan.parent.error });
  }

  let keep = forked;
  if (forked.length > max) {
    const sorted = [...forked].sort((a, b) => b.weight - a.weight);
    keep = sorted.slice(0, max).map((p) => ({ ...p }));
    let discardedWeight = 0;
    for (let i = max; i < sorted.length; i++) discardedWeight += sorted[i]!.weight;
    if (discardedWeight > 0) {
      keep[0] = { ...keep[0]!, weight: keep[0]!.weight + discardedWeight };
    }
  }

  for (const plan of keep) {
    const next = snapshotRuntime(plan.parent.rt);
    commitCast(next, plan.prepared, plan.auto, plan.rng);
    out.push({ weight: plan.weight, rt: next });
  }
  return out;
}

/**
 * One cast with state-changing RNG: prepare once, commit each outcome on a clone.
 * Rejected cast -> single error branch. Multi-branch: plan then materializeCastPlans.
 */
export function castOutcomes(
  branch: Branch,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
): Branch[] {
  const planned = planCastOutcomes(branch, ability, readyTick, auto);
  if ("error" in planned) return [planned.error];
  return materializeCastPlans(planned.plans, Number.MAX_SAFE_INTEGER);
}
