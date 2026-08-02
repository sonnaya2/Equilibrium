import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { cloneAnalysisState, mixAnalysisStates } from "../analysis";
import { commitCast, prepareSimulationCast } from "../cast";
import { rngPointsFor } from "../cast/rules";
import type { CastRecord, CastRng } from "./contracts";
import type { SimulationRuntime } from "../runtime/runtime";
import { mergeSupportOffsets } from "./stats";

/**
 * Probability-weighted branching for state-changing RNG (Impatient, Relentless,
 * and Avernic Rampage procs change resources and windows, so a flat expected value would
 * spend resources no real branch could have). Damage-only randomness stays
 * expected-value by design.
 *
 * A branch owns an independent runtime produced by snapshotRuntime. Branches
 * whose future evolution is identical (same RotationState, same pending-event
 * structure, same counters) are merged: weights sum, expected ledgers become
 * the weight-weighted mean, and support damage bounds take min/max of each
 * branch's support (not a weighted mean of path extrema). Cast and event logs
 * retain one representative from the highest-weight terminal equivalence class.
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
 * Future evolution signature. Historical damage ledgers (`totalExpected`,
 * path conditionals / support offsets, `perAbility`, `damageByTick`, event/cast
 * logs) are intentionally omitted: `mergePair` combines expected ledgers as a
 * weight-weighted mean and support extrema via min/max, so two branches that
 * only differ in past damage may merge when their remaining state, queue, and
 * counters match.
 *
 * Keep `endTick` — it feeds metric denominators and is not re-derived solely
 * from future events once a branch is terminal. Keep hitDetails / spirit meta
 * because pending derived events read them at land time.
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

/**
 * Path conditionals (`totalMin`/`totalMax`) are weight-averaged.
 * Support extrema use min/max via offsets so later landings that bump the
 * conditionals keep true support bounds without replaying history.
 */
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
  // Quantitative analysis is ledger-owned: weight-mix, never rebuild from keep.events.
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

/**
 * Hard cap on live probability branches after merge. Impatient + Relentless +
 * Avernic (and similar) can otherwise explode over a long Revolution horizon
 * even when equivalent branches merge. Keep the heaviest survivors and fold
 * discarded weight into the top branch so total probability mass is preserved.
 */
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

/**
 * Run one cast with its state-changing RNG enumerated. The cast is prepared
 * ONCE on the branch's own runtime (canonical advance + validation + prepared
 * cast), the RNG point is read from that prepared cast, and each outcome
 * commits the same prepared cast on a clone of the already-advanced, validated
 * runtime. A rejected cast has no RNG outcomes — it produces one error branch.
 */
export function castOutcomes(
  branch: Branch,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
): Branch[] {
  const preparation = prepareSimulationCast(branch.rt, ability, readyTick);
  if (!preparation.ok) return [{ ...branch, error: preparation.error }];
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
    commitCast(branch.rt, prepared, auto);
    return [branch];
  }
  const outcomes = points.reduce<Array<{ rng: CastRng; weight: number }>>(
    (current, point) =>
      current.flatMap(({ rng, weight }) => [
        { rng: { ...rng, [point.id]: true }, weight: weight * point.chance },
        { rng: { ...rng, [point.id]: false }, weight: weight * (1 - point.chance) },
      ]),
    [{ rng: {}, weight: 1 }],
  );
  return outcomes.map(({ rng, weight }) => {
    const next = snapshotRuntime(branch.rt);
    commitCast(next, prepared, auto, rng);
    return {
      weight: branch.weight * weight,
      rt: next,
    };
  });
}
