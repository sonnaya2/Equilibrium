import type { AbilitySpec } from "../pipeline/calculateAbility";
import { commitCast, prepareSimulationCast } from "./cast";
import { rngPointFor } from "./castRules";
import type { CastRecord } from "./contracts";
import type { SimulationRuntime } from "./runtime";

/**
 * Probability-weighted branching for state-changing RNG (Impatient / Relentless
 * procs change adrenaline and lockout state, so a flat expected value would
 * spend resources no real branch could have). Damage-only randomness stays
 * expected-value by design.
 *
 * A branch owns an independent runtime produced by snapshotRuntime. Branches
 * whose future evolution is identical (same RotationState, same pending-event
 * structure, same counters) are merged: weights sum and ledgers become the
 * weight-weighted mean, so merged totals equal the mean of the merged
 * trajectories. The kept branch's casts/events log is the modal trajectory.
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
    state: rt.state, // plain data, only ever reassigned — safe to share
    casts: rt.casts.map(cloneRecord),
    perAbility: { ...rt.perAbility },
    damageByTick: { ...rt.damageByTick },
    events: [...rt.events],
    recordBySeq: new Map([...rt.recordBySeq].map(([k, r]) => [k, cloneRecord(r)])),
    hitDetails: new Map(rt.hitDetails),
    spiritEventMeta: new Map(rt.spiritEventMeta),
    scheduledSpiritTracks: new Set(rt.scheduledSpiritTracks),
    spiritHitCounts: new Map(rt.spiritHitCounts),
  };
}

/** Future evolution is fully determined by state + pending events + counters. */
function branchKey(rt: SimulationRuntime): string {
  return JSON.stringify([rt.state, rt.queue.signature(), rt.nextSeq, rt.nextCastSeq]);
}

function mergePair(a: Branch, b: Branch): Branch {
  const weight = a.weight + b.weight;
  const keep = a.weight >= b.weight ? a : b;
  const mix = (x: number, y: number) => (a.weight * x + b.weight * y) / weight;
  keep.rt.totalMin = mix(a.rt.totalMin, b.rt.totalMin);
  keep.rt.totalMax = mix(a.rt.totalMax, b.rt.totalMax);
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
  const point = rngPointFor(
    branch.rt.state,
    ability,
    prepared.candidate,
    prepared.spend,
    branch.rt.input.adrenaline,
  );

  if (!point) {
    commitCast(branch.rt, prepared, auto);
    return [branch];
  }
  const rngKey =
    point.kind === "impatient" ? ("impatientProc" as const) : ("relentlessProc" as const);
  return [
    { proc: true, outcomeWeight: point.chance },
    { proc: false, outcomeWeight: 1 - point.chance },
  ].map(({ proc, outcomeWeight }) => {
    const next = snapshotRuntime(branch.rt);
    commitCast(next, prepared, auto, { [rngKey]: proc });
    return {
      weight: branch.weight * outcomeWeight,
      rt: next,
    };
  });
}
