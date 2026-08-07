import { cloneAnalysisState, mixAnalysisStates } from "../analysis";
import type { BranchBudget, CastRecord } from "./contracts";
import { keepsAnalysisLedgers, keepsPerAbilityMap, keepsPresentationHistory } from "./contracts";
import type { SimulationRuntime } from "../runtime/runtime";
import { mergeSupportOffsets } from "./stats";
import { buildBranchKey } from "./branchKey";
import { mergeTargetWeaponPoisonHistories, patchTarget } from "../runtime/state";

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
  "exact" | "merged-exactly" | "bounded-approximation" | "truncated" | "resampled";

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

// Phase-0 branching cost profile (measure only; no semantic effect).
// Gate: RS3_BRANCH_PROF=1|true, or enableBranchProfiling().

export interface BranchProfile {
  /** snapshotRuntime invocations. */
  branchSnapshots: number;
  /** Structural field/entry units cloned across all snapshots. */
  snapshotFieldsCloned: number;
  /** Order-of-magnitude bytes cloned (not exact heap). */
  snapshotBytesEstimate: number;
  /** branchKey builds (merge equivalence keys). */
  branchKeySerializations: number;
  /** Sum of serialized key string lengths (UTF-16 code units). */
  branchKeyChars: number;
  /** Wall ms spent in branchKey construction (when profiling). */
  branchKeyConstructionMs: number;
  /** mergeAndCapBranches invocations. */
  mergeAndCapCalls: number;
  /** Branches dropped by hard cap (merged count - kept count). */
  mergeAndCapDiscards: number;
  /** mergeAndCap outcomes with exactness merged-exactly. */
  exactMerges: number;
  /** Cap/merge results with residualWeight > 0. */
  residualMassEvents: number;
  /** Sum of residualWeight across residualMassEvents. */
  residualMassTotal: number;
  /** Peak live branch array length observed on instrumented paths. */
  maxLiveBranches: number;
  /** Adaptive fidelity sim attempts (solver branchFidelity ladder). */
  fidelityRetries: number;
  /** Wall ms spent in instrumented revolution sims (adaptive ladder). */
  simWallMs: number;
}

const EMPTY_BRANCH_PROFILE: BranchProfile = {
  branchSnapshots: 0,
  snapshotFieldsCloned: 0,
  snapshotBytesEstimate: 0,
  branchKeySerializations: 0,
  branchKeyChars: 0,
  branchKeyConstructionMs: 0,
  mergeAndCapCalls: 0,
  mergeAndCapDiscards: 0,
  exactMerges: 0,
  residualMassEvents: 0,
  residualMassTotal: 0,
  maxLiveBranches: 0,
  fidelityRetries: 0,
  simWallMs: 0,
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

/** Adaptive fidelity attempt + optional sim wall time. No-op when profiling off. */
export function noteFidelityRetry(simMs = 0): void {
  if (!branchProfEnabled) return;
  branchProf.fidelityRetries += 1;
  if (simMs > 0) branchProf.simWallMs += simMs;
}

/** Accumulate branchKey construction wall time. No-op when profiling off. */
export function noteBranchKeyConstructionMs(ms: number): void {
  if (!branchProfEnabled || !(ms > 0)) return;
  branchProf.branchKeyConstructionMs += ms;
}

/** Record residual mass outside mergeAndCap (e.g. forked-plan pre-trim). */
export function noteResidualMass(weight: number): void {
  if (!branchProfEnabled || !(weight > 0)) return;
  branchProf.residualMassEvents += 1;
  branchProf.residualMassTotal += weight;
}

/**
 * Cheap structural cost of one snapshotRuntime (not a heap walk).
 * Score-only omits presentation history / analysis / perAbility / cast hit arrays.
 * Deep targets: state only. Map shells for hitDetails/spirit meta (values shared).
 */
function estimateSnapshotCost(rt: SimulationRuntime): { fields: number; bytes: number } {
  const scoreOnly = rt.detailLevel === "score-only";
  const queueLen = rt.queue.length;
  const casts = rt.casts.length;
  const recordBySeq = rt.recordBySeq.size;
  const hitDetails = rt.hitDetails.size;
  const spiritMeta = rt.spiritEventMeta.size;
  const spiritTracks = rt.scheduledSpiritTracks.size;
  const spiritHits = rt.spiritHitCounts.size;
  const damageByTick = Object.keys(rt.damageByTick).length;

  // Score-only: no events/analysis/perAbility/hit-array walk.
  let castHits = 0;
  let events = 0;
  let perAbility = 0;
  let analysisUnit = 0;
  if (!scoreOnly) {
    events = rt.events.length;
    perAbility = Object.keys(rt.perAbility).length;
    analysisUnit = 1;
    if (keepsPresentationHistory(rt.detailLevel)) {
      for (const c of rt.casts) castHits += c.result.hits.length;
    }
  }

  // One unit per container clone + per entry walk (maps/arrays).
  const fields =
    1 + // queue.clone
    1 + // structuredClone(state) — always, never shared by ref
    casts +
    castHits +
    (scoreOnly ? 0 : 1 + perAbility) + // perAbility spread only when kept
    1 + // damageByTick spread
    damageByTick +
    events +
    recordBySeq +
    hitDetails + // map entry only; HitResult shared by ref
    spiritMeta + // map entry only; SpiritEventMeta shared by ref
    spiritTracks +
    spiritHits +
    analysisUnit;

  // Order-of-magnitude payload (tuned for relative A/B, not allocator truth).
  const bytes =
    queueLen * 160 +
    900 + // RotationState deep clone ballpark
    casts * (scoreOnly ? 200 : 280) +
    castHits * 24 +
    perAbility * 32 +
    damageByTick * 24 +
    events * 96 +
    recordBySeq * (scoreOnly ? 200 : 280) +
    hitDetails * 40 + // key + pointer; HitResult not deep-cloned
    spiritMeta * 40 +
    spiritTracks * 32 +
    spiritHits * 32 +
    (scoreOnly ? 0 : 256); // analysis maps/sets base

  return { fields, bytes };
}

/**
 * Clone cast/record shell. HitResult entries in result.hits are immutable number
 * bags and already shared by ref across branches (same as hitDetails values).
 *
 * Score-only never grows result.hits; share the hits array by ref (usually empty)
 * and only clone the mutable expected/min/max result bag.
 */
function cloneCastRecord(
  record: CastRecord,
  cache: Map<CastRecord, CastRecord>,
  scoreOnly: boolean,
): CastRecord {
  let clone = cache.get(record);
  if (!clone) {
    if (scoreOnly) {
      // Share hits array (never pushed on score-only); still clone result bag
      // so expected/min/max mutations cannot leak across branches.
      clone = { ...record, result: { ...record.result } };
    } else {
      clone = { ...record, result: { ...record.result, hits: [...record.result.hits] } };
    }
    cache.set(record, clone);
  }
  return clone;
}

/** Independent copy of a runtime: mutable containers cloned, immutable values shared. */
export function snapshotRuntime(rt: SimulationRuntime): SimulationRuntime {
  if (branchProfEnabled) {
    branchProf.branchSnapshots++;
    const est = estimateSnapshotCost(rt);
    branchProf.snapshotFieldsCloned += est.fields;
    branchProf.snapshotBytesEstimate += est.bytes;
  }

  const scoreOnly = rt.detailLevel === "score-only";
  const recordClones = new Map<CastRecord, CastRecord>();

  // Cast records stay mutable (expected/min/max, adren after) even on score-only;
  // independent shells required. Presentation hit arrays stripped on score-only.
  const casts =
    rt.casts.length === 0
      ? ([] as CastRecord[])
      : rt.casts.map((r) => cloneCastRecord(r, recordClones, scoreOnly));

  let recordBySeq: Map<number, CastRecord>;
  if (rt.recordBySeq.size === 0) {
    recordBySeq = new Map();
  } else {
    recordBySeq = new Map();
    for (const [k, r] of rt.recordBySeq) {
      recordBySeq.set(k, cloneCastRecord(r, recordClones, scoreOnly));
    }
  }

  // HitResult is a flat number bag. Production only sets new values / reads fields
  // (never mutates). Cast-record clone already shares the same refs in result.hits.
  // Map shell must be independent so set/delete on a branch cannot leak.
  const hitDetails = rt.hitDetails.size === 0 ? new Map() : new Map(rt.hitDetails);

  // SpiritEventMeta is {id, untilTick, kind}; only keys are deleted/replaced.
  const spiritEventMeta = rt.spiritEventMeta.size === 0 ? new Map() : new Map(rt.spiritEventMeta);

  // Score-only never appends presentation history; skip the events walk/copy.
  // full-analysis: resolved history entries are immutable; array shell independent.
  const events = scoreOnly
    ? ([] as SimulationRuntime["events"])
    : rt.events.length === 0
      ? []
      : [...rt.events];

  // score-only never mutates analysis ledgers; share the empty shell.
  // full-analysis must deep-clone so branch merges cannot leak.
  const analysis = keepsAnalysisLedgers(rt.detailLevel)
    ? cloneAnalysisState(rt.analysis)
    : rt.analysis;

  // Score-only never writes perAbility; skip shallow-copy of the empty map.
  const perAbility = scoreOnly ? ({} as Record<string, number>) : { ...rt.perAbility };

  return {
    ...rt,
    queue: rt.queue.clone(),
    // Runtime state is mutable; structuredClone preserves branch isolation.
    state: structuredClone(rt.state),
    casts,
    perAbility,
    damageByTick: { ...rt.damageByTick },
    events,
    recordBySeq,
    hitDetails,
    spiritEventMeta,
    scheduledSpiritTracks: new Set(rt.scheduledSpiritTracks),
    spiritHitCounts: new Map(rt.spiritHitCounts),
    analysis,
  };
}

/**
 * Future-evolution key (branchKey.ts). Omits ledgers, endTick, seq allocators.
 * Live hitDetails / spirit meta stay in the key for land-time reads.
 * RS3_BRANCH_KEY_JSON=1 restores full JSON for debug/oracle.
 */
function branchKey(rt: SimulationRuntime): string {
  const t0 = branchProfEnabled ? performance.now() : 0;
  const key = buildBranchKey(rt);
  if (branchProfEnabled) {
    branchProf.branchKeySerializations++;
    branchProf.branchKeyChars += key.length;
    branchProf.branchKeyConstructionMs += performance.now() - t0;
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
  keep.rt.totalHealed = mix(a.rt.totalHealed, b.rt.totalHealed);
  // Presentation + allocators: max so merged survivor can keep assigning ids.
  keep.rt.endTick = Math.max(a.rt.endTick, b.rt.endTick);
  keep.rt.nextSeq = Math.max(a.rt.nextSeq, b.rt.nextSeq);
  keep.rt.nextCastSeq = Math.max(a.rt.nextCastSeq, b.rt.nextCastSeq);
  // damageByTick always mixed - ranking windows depend on it.
  for (const key of new Set([
    ...Object.keys(a.rt.damageByTick),
    ...Object.keys(b.rt.damageByTick),
  ])) {
    const tick = Number(key);
    keep.rt.damageByTick[tick] = mix(a.rt.damageByTick[tick] ?? 0, b.rt.damageByTick[tick] ?? 0);
  }
  if (keepsPerAbilityMap(keep.rt.detailLevel)) {
    for (const key of new Set([...Object.keys(a.rt.perAbility), ...Object.keys(b.rt.perAbility)])) {
      keep.rt.perAbility[key] = mix(a.rt.perAbility[key] ?? 0, b.rt.perAbility[key] ?? 0);
    }
  }
  // Analysis is ledger-owned: weight-mix, do not rebuild from keep.events.
  // Score-only skips analysis entirely (support offsets unused for ranking).
  if (keepsAnalysisLedgers(keep.rt.detailLevel)) {
    keep.rt.analysis = mixAnalysisStates(a.rt.analysis, b.rt.analysis, a.weight, b.weight);
    keep.rt.analysis.supportMinOffset = bounds.supportMinOffset;
    keep.rt.analysis.supportMaxOffset = bounds.supportMaxOffset;
  }
  keep.rt.state = patchTarget(keep.rt.state, {
    weaponPoison: mergeTargetWeaponPoisonHistories(
      a.rt.state.target.weaponPoison,
      b.rt.state.target.weaponPoison,
    ),
  });
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
  if (branches.length <= 1) return [...branches];
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

/** Default branch budget (single-shot product path). Adaptive ladders override live caps. */
export function defaultBranchBudget(): BranchBudget {
  return {
    maxLiveBranches: MAX_LIVE_BRANCHES,
    maxIntermediateBranches: MAX_LIVE_BRANCHES * 2,
    maximumResidualWeight: 0,
  };
}

/**
 * Resolve a partial budget. Live >= 1; intermediate >= live; residual threshold >= 0.
 * Omitted fields fall back to defaults (64 / 128 / 0).
 */
export function resolveBranchBudget(partial?: Partial<BranchBudget> | null): BranchBudget {
  const base = defaultBranchBudget();
  if (partial == null) return base;
  const maxLiveBranches =
    partial.maxLiveBranches !== undefined ? partial.maxLiveBranches : base.maxLiveBranches;
  const maxIntermediateBranches =
    partial.maxIntermediateBranches !== undefined
      ? partial.maxIntermediateBranches
      : Math.max(base.maxIntermediateBranches, maxLiveBranches * 2);
  const maximumResidualWeight =
    partial.maximumResidualWeight !== undefined
      ? partial.maximumResidualWeight
      : base.maximumResidualWeight;
  if (!Number.isInteger(maxLiveBranches) || maxLiveBranches < 1) {
    throw new RangeError(
      `resolveBranchBudget: maxLiveBranches must be a positive integer, got ${maxLiveBranches}`,
    );
  }
  if (!Number.isInteger(maxIntermediateBranches) || maxIntermediateBranches < maxLiveBranches) {
    throw new RangeError(
      `resolveBranchBudget: maxIntermediateBranches must be an integer >= maxLiveBranches, got ${maxIntermediateBranches}`,
    );
  }
  if (!(Number.isFinite(maximumResidualWeight) && maximumResidualWeight >= 0)) {
    throw new RangeError(
      `resolveBranchBudget: maximumResidualWeight must be a non-negative finite number, got ${maximumResidualWeight}`,
    );
  }
  return { maxLiveBranches, maxIntermediateBranches, maximumResidualWeight };
}

/** Live + intermediate caps for drivers that only need numbers. */
export function branchCapsFromBudget(budget?: Partial<BranchBudget> | null): {
  maxLive: number;
  intermediateMax: number;
} {
  const b = resolveBranchBudget(budget);
  return { maxLive: b.maxLiveBranches, intermediateMax: b.maxIntermediateBranches };
}

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
    if (branchProfEnabled) branchProf.exactMerges += 1;
    return { ...capped, exactness: "merged-exactly" };
  }
  return { ...capped, exactness: "exact" };
}

/**
 * Documented peak after one expand onto a full live set (~max + max before fold).
 * materializeCastPlans / multi-parent outer product.
 */
export const MAX_INTERMEDIATE_BRANCHES = MAX_LIVE_BRANCHES * 2;

/**
 * Append survivors with early mergeAndCap (materializeCastPlans absorb parity).
 * Pre-caps a single expansion over max; after append, mergeAndCap when over max.
 * Peak live ~2*max. Residual disclosed; never reassigned to a non-equivalent.
 * When max is oracle-scale (MAX_SAFE_INTEGER/2+), never intermediate-caps.
 */
export function appendWithIntermediateCap(
  acc: Branch[],
  added: readonly Branch[],
  max: number = MAX_LIVE_BRANCHES,
): BranchSet {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`appendWithIntermediateCap: max must be a positive integer, got ${max}`);
  }
  if (max >= Number.MAX_SAFE_INTEGER / 2) {
    if (added.length === 0) {
      return { branches: acc, residualWeight: 0, exactness: "exact" };
    }
    if (acc.length === 0) {
      const out = [...added];
      noteBranchLiveCount(out.length);
      return { branches: out, residualWeight: 0, exactness: "exact" };
    }
    acc.push(...added);
    noteBranchLiveCount(acc.length);
    return { branches: acc, residualWeight: 0, exactness: "exact" };
  }

  let residualWeight = 0;
  let exactness: BranchExactness = "exact";
  let chunk: readonly Branch[] = added;
  if (added.length > max) {
    const pre = mergeAndCapBranches(added, max);
    residualWeight += pre.residualWeight;
    exactness = combineExactness(exactness, pre.exactness);
    chunk = pre.branches;
  }
  if (chunk.length === 0) {
    return { branches: acc, residualWeight, exactness };
  }
  let out: Branch[];
  if (acc.length === 0) out = [...chunk];
  else {
    acc.push(...chunk);
    out = acc;
  }
  noteBranchLiveCount(out.length);
  if (out.length <= max) {
    return { branches: out, residualWeight, exactness };
  }
  const folded = mergeAndCapBranches(out, max);
  return {
    branches: folded.branches,
    residualWeight: residualWeight + folded.residualWeight,
    exactness: combineExactness(exactness, folded.exactness),
  };
}
