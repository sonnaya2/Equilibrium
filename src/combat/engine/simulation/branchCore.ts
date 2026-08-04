import { cloneAnalysisState, mixAnalysisStates } from "../analysis";
import type { CastRecord } from "./contracts";
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

// ---------------------------------------------------------------------------
// Phase-0 branching cost profile (measure only; no semantic effect).
// Gate: RS3_BRANCH_PROF=1|true, or enableBranchProfiling().
// ---------------------------------------------------------------------------

export interface BranchProfile {
  /** snapshotRuntime invocations. */
  branchSnapshots: number;
  /** Structural field/entry units cloned across all snapshots. */
  snapshotFieldsCloned: number;
  /** Order-of-magnitude bytes cloned (not exact heap). */
  snapshotBytesEstimate: number;
  /** branchKey JSON.stringify calls (merge equivalence keys). */
  branchKeySerializations: number;
  /** Sum of serialized key string lengths (UTF-16 code units). */
  branchKeyChars: number;
  /** mergeAndCapBranches invocations. */
  mergeAndCapCalls: number;
  /** Branches dropped by hard cap (merged count - kept count). */
  mergeAndCapDiscards: number;
  /** Cap/merge results with residualWeight > 0. */
  residualMassEvents: number;
  /** Sum of residualWeight across residualMassEvents. */
  residualMassTotal: number;
  /** Peak live branch array length observed on instrumented paths. */
  maxLiveBranches: number;
}

const EMPTY_BRANCH_PROFILE: BranchProfile = {
  branchSnapshots: 0,
  snapshotFieldsCloned: 0,
  snapshotBytesEstimate: 0,
  branchKeySerializations: 0,
  branchKeyChars: 0,
  mergeAndCapCalls: 0,
  mergeAndCapDiscards: 0,
  residualMassEvents: 0,
  residualMassTotal: 0,
  maxLiveBranches: 0,
};

function envBranchProfEnabled(): boolean {
  if (typeof process === "undefined" || process.env == null) return false;
  const v = process.env.RS3_BRANCH_PROF;
  return v === "1" || v === "true";
}

let branchProfEnabled = envBranchProfEnabled();
const branchProf: BranchProfile = { ...EMPTY_BRANCH_PROFILE };

export function enableBranchProfiling(on = true): void {
  branchProfEnabled = on;
}

export function isBranchProfilingEnabled(): boolean {
  return branchProfEnabled;
}

export function resetBranchProfile(): void {
  Object.assign(branchProf, EMPTY_BRANCH_PROFILE);
}

export function getBranchProfile(): Readonly<BranchProfile> {
  return { ...branchProf };
}

/** Record a live branch-array size (peak tracker). No-op when profiling off. */
export function noteBranchLiveCount(n: number): void {
  if (!branchProfEnabled || n <= branchProf.maxLiveBranches) return;
  branchProf.maxLiveBranches = n;
}

/**
 * Cheap structural cost of one snapshotRuntime (not a heap walk).
 * Deep targets: state, hitDetails values, spiritEventMeta values.
 * Shallow: queue, casts/records, maps/sets, ledger objects, analysis.
 */
function estimateSnapshotCost(rt: SimulationRuntime): { fields: number; bytes: number } {
  const queueLen = rt.queue.length;
  const casts = rt.casts.length;
  const events = rt.events.length;
  const recordBySeq = rt.recordBySeq.size;
  const hitDetails = rt.hitDetails.size;
  const spiritMeta = rt.spiritEventMeta.size;
  const spiritTracks = rt.scheduledSpiritTracks.size;
  const spiritHits = rt.spiritHitCounts.size;
  const perAbility = Object.keys(rt.perAbility).length;
  const damageByTick = Object.keys(rt.damageByTick).length;
  let castHits = 0;
  for (const c of rt.casts) castHits += c.result.hits.length;

  // One unit per container clone + per entry walk (maps/arrays).
  const fields =
    1 + // queue.clone
    1 + // structuredClone(state)
    casts +
    castHits +
    1 + // perAbility spread
    perAbility +
    1 + // damageByTick spread
    damageByTick +
    events +
    recordBySeq +
    hitDetails + // structuredClone each HitResult
    spiritMeta +
    spiritTracks +
    spiritHits +
    1; // cloneAnalysisState

  // Order-of-magnitude payload (tuned for relative A/B, not allocator truth).
  const bytes =
    queueLen * 160 +
    900 + // RotationState deep clone ballpark
    casts * 280 +
    castHits * 24 +
    perAbility * 32 +
    damageByTick * 24 +
    events * 96 +
    recordBySeq * 280 +
    hitDetails * 480 +
    spiritMeta * 72 +
    spiritTracks * 32 +
    spiritHits * 32 +
    256; // analysis maps/sets base

  return { fields, bytes };
}

/** Independent copy of a runtime: mutable containers cloned, immutable events shared. */
export function snapshotRuntime(rt: SimulationRuntime): SimulationRuntime {
  if (branchProfEnabled) {
    branchProf.branchSnapshots++;
    const est = estimateSnapshotCost(rt);
    branchProf.snapshotFieldsCloned += est.fields;
    branchProf.snapshotBytesEstimate += est.bytes;
  }
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
  const key = JSON.stringify([
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
  if (branchProfEnabled) {
    branchProf.branchKeySerializations++;
    branchProf.branchKeyChars += key.length;
  }
  return key;
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
  // Never invent success: if either arm failed, survivor stays failed.
  if (a.error !== undefined || b.error !== undefined) {
    keep.error = a.error ?? b.error;
  }
  return keep;
}

/**
 * Merge equivalent futures. Failed arms with the same error + state merge
 * (Leng residual drain); different errors stay separate. Never clears error.
 */
export function mergeBranches(branches: readonly Branch[]): Branch[] {
  if (branchProfEnabled) noteBranchLiveCount(branches.length);
  const byKey = new Map<string, Branch>();
  for (const branch of branches) {
    const key =
      branch.error !== undefined
        ? `e:${branch.error}\0${branchKey(branch.rt)}`
        : branchKey(branch.rt);
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergePair(existing, branch) : branch);
  }
  const out = [...byKey.values()];
  if (branchProfEnabled) noteBranchLiveCount(out.length);
  return out;
}

/** Cap live branches after merge; discarded weight is residual, not reassigned. */
export const MAX_LIVE_BRANCHES = 64;

/**
 * Keep heaviest `max` arms. If the cut would drop every failed arm while any
 * failed mass existed, swap the lightest survivor for the heaviest failed discard
 * so ok/failureWeight cannot silently become pure success.
 */
export function capBranches(
  branches: readonly Branch[],
  max: number = MAX_LIVE_BRANCHES,
): BranchSet {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`capBranches: max must be a positive integer, got ${max}`);
  }
  if (branchProfEnabled) noteBranchLiveCount(branches.length);
  if (branches.length <= max) {
    return { branches: [...branches], residualWeight: 0, exactness: "exact" };
  }
  const sorted = [...branches].sort((a, b) => b.weight - a.weight);
  const keep = sorted.slice(0, max).map((b) => ({ ...b }));
  const discarded = sorted.slice(max);
  if (!keep.some((b) => b.error !== undefined)) {
    let heaviestFailed: Branch | undefined;
    for (const b of discarded) {
      if (b.error === undefined) continue;
      if (!heaviestFailed || b.weight > heaviestFailed.weight) heaviestFailed = b;
    }
    if (heaviestFailed !== undefined) {
      let lightIdx = 0;
      for (let i = 1; i < keep.length; i++) {
        if (keep[i]!.weight < keep[lightIdx]!.weight) lightIdx = i;
      }
      keep[lightIdx] = { ...heaviestFailed };
    }
  }
  // Residual = total mass - kept mass (swap-safe; discarded success re-enters residual).
  const keptMass = keep.reduce((s, b) => s + b.weight, 0);
  const totalMass = sorted.reduce((s, b) => s + b.weight, 0);
  const residualWeight = Math.max(0, totalMass - keptMass);
  if (branchProfEnabled) noteBranchLiveCount(keep.length);
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
  if (branchProfEnabled) {
    branchProf.mergeAndCapCalls++;
    noteBranchLiveCount(before);
  }
  const merged = mergeBranches(branches);
  const capped = capBranches(merged, max);
  if (branchProfEnabled) {
    noteBranchLiveCount(merged.length);
    noteBranchLiveCount(capped.branches.length);
    const discards = Math.max(0, merged.length - capped.branches.length);
    branchProf.mergeAndCapDiscards += discards;
    if (capped.residualWeight > 0) {
      branchProf.residualMassEvents++;
      branchProf.residualMassTotal += capped.residualWeight;
    }
  }
  if (capped.residualWeight > 0) {
    return { ...capped, exactness: "bounded-approximation" };
  }
  if (merged.length < before) {
    return { ...capped, exactness: "merged-exactly" };
  }
  return { ...capped, exactness: "exact" };
}
