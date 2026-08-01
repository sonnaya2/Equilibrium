import { impatientProcChance, relentlessProcChance } from "../shared/perks";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { performCast, spendOf } from "./cast";
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
  for (const key of new Set([...Object.keys(a.rt.damageByTick), ...Object.keys(b.rt.damageByTick)])) {
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
 * Run one cast with its state-changing RNG enumerated. At most one RNG point
 * applies per cast (a basic never costs adrenaline): Impatient on basics,
 * Relentless on adrenaline spenders off lockout. Each outcome gets an
 * independent runtime snapshot; without an RNG point the branch continues
 * unchanged. Explicit outcomes only — performCast never rolls for itself.
 */
export function castOutcomes(
  branch: Branch,
  ability: AbilitySpec,
  readyTick: number,
  auto: boolean,
): Branch[] {
  const rt = branch.rt;
  const rules = rt.input.adrenaline;
  const candidate = Math.max(readyTick, rt.state.tick);
  const isBasic = ability.category === "basic" || !!ability.autoAttack;

  let point: "impatient" | "relentless" | null = null;
  let chance = 0;
  if (isBasic && (rules?.impatientRank ?? 0) > 0) {
    point = "impatient";
    chance = impatientProcChance(rules!.impatientRank!, rules?.impatientLevel20);
  } else if (
    (rules?.relentlessRank ?? 0) > 0 &&
    candidate >= rt.state.relentlessUntilTick &&
    spendOf(rt, ability, candidate) > 0
  ) {
    point = "relentless";
    chance = relentlessProcChance(rules!.relentlessRank!, rules?.relentlessLevel20);
  }

  if (!point) {
    const attempt = performCast(rt, ability, readyTick, auto);
    return attempt.ok ? [branch] : [{ ...branch, error: attempt.error }];
  }
  const rngKey = point === "impatient" ? ("impatientProc" as const) : ("relentlessProc" as const);
  return [
    { proc: true, outcomeWeight: chance },
    { proc: false, outcomeWeight: 1 - chance },
  ].map(({ proc, outcomeWeight }) => {
    const next = snapshotRuntime(branch.rt);
    const attempt = performCast(next, ability, readyTick, auto, { [rngKey]: proc });
    return {
      weight: branch.weight * outcomeWeight,
      rt: next,
      ...(attempt.ok ? {} : { error: attempt.error }),
    };
  });
}
