/**
 * Parallel Revolution solver agents - one Web Worker each, different seeds.
 * Phase 2: host-coordinated global evaluation budget, shared visited set,
 * shared incumbent, early straggler cancel. Batched messages only (no SAB).
 */

import type { SerializableSolverRequest, SolverResultDTO } from "./serializable";
import {
  isWorkerToHostMessage,
  type HostToWorkerMessage,
  type SolverAgentSnapshot,
  type SolverPoolMetrics,
  type SolverProgress,
  type WorkerToHostMessage,
} from "./protocol";
import type { SolveProgressHandler } from "./solveTypes";
import type { SolverProfileSnapshot } from "../profiling/counters";
import { createSolverWorker, getFirstAckMs } from "./workerCreate";
import { TIER_BUDGETS } from "../solve";
import {
  detectHardwareCores,
  planWorkers,
  RESERVES_UI_CORE,
  SAFE_GLOBAL_AGENT_CEILING,
  shouldReserveUiCore,
  TIER_MAX_AGENTS,
  type WorkerAssignment,
} from "../workerPlan";
import { compareTopEntry, pickBestSolverResult } from "../rankResults";
import { solveIdentityFromRequest } from "../identity";
import {
  applyHostIncumbentBaseline,
  evaluateHostIncumbentBaseline,
  type HostIncumbentBaseline,
} from "../hostIncumbent";
import { PoolCoordHost } from "./coord";
import {
  isInfrastructureFailure,
  SolverExecutionError,
  solverFailureFromWorkerMessage,
} from "./failure";
import { noteSolverHost } from "./hostDiagnostics";
import { minimumConstrainedBarSizeForRequest } from "../requestContext";

const MAX_POOL = SAFE_GLOBAL_AGENT_CEILING;

export function solverPoolSize(): number {
  return MAX_POOL;
}

/** Match host.ts worker construction (and test factory). */
function createWorker(): Worker | null {
  return createSolverWorker();
}

function post(worker: Worker, message: HostToWorkerMessage): void {
  worker.postMessage(message);
}

/** Align with host - DOMException or Error named AbortError. */
function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function mergeProfiles(profiles: readonly SolverProfileSnapshot[]): SolverProfileSnapshot {
  const merged: SolverProfileSnapshot = {
    wallMs: 0,
    evaluations: 0,
    searchEvals: 0,
    fullEvals: 0,
    evalsPerSec: 0,
    memoHits: 0,
    uniqueBars: 0,
    progressEmits: 0,
    workerWaitMs: 0,
    neighborGenerated: 0,
    neighborDeduped: 0,
    neighborDuplicateSkipped: 0,
    barKeysSeenWithinWorker: 0,
    duplicateEvalAttempts: 0,
    fingerprintJoins: 0,
    beamChildrenGenerated: 0,
    beamChildrenUniqueKeys: 0,
  };
  for (const profile of profiles) {
    merged.wallMs = Math.max(merged.wallMs, profile.wallMs);
    merged.evaluations += profile.evaluations;
    merged.searchEvals += profile.searchEvals;
    merged.fullEvals += profile.fullEvals;
    merged.memoHits += profile.memoHits;
    merged.uniqueBars += profile.uniqueBars;
    merged.progressEmits += profile.progressEmits;
    merged.workerWaitMs += profile.workerWaitMs;
    merged.neighborGenerated += profile.neighborGenerated;
    merged.neighborDeduped += profile.neighborDeduped;
    merged.neighborDuplicateSkipped += profile.neighborDuplicateSkipped;
    merged.barKeysSeenWithinWorker += profile.barKeysSeenWithinWorker;
    merged.duplicateEvalAttempts += profile.duplicateEvalAttempts;
    merged.fingerprintJoins += profile.fingerprintJoins;
    merged.beamChildrenGenerated += profile.beamChildrenGenerated;
    merged.beamChildrenUniqueKeys += profile.beamChildrenUniqueKeys;
  }
  merged.evalsPerSec = merged.wallMs > 0 ? (merged.evaluations * 1000) / merged.wallMs : 0;
  return merged;
}

function phaseRank(phase: SolverProgress["phase"] | undefined): number {
  switch (phase) {
    case "finalize":
      return 4;
    case "exploit":
      return 3;
    case "explore":
      return 2;
    case "seed":
      return 1;
    default:
      return 0;
  }
}

function withAgentMeta(
  base: SolverAgentSnapshot,
  meta?: {
    recipe?: SolverAgentSnapshot["recipe"];
    barLength?: number;
    finishRank?: number;
    evaluationBudget?: number;
  },
): SolverAgentSnapshot {
  if (meta?.recipe) base.recipe = meta.recipe;
  if (meta?.barLength != null) base.barLength = meta.barLength;
  if (meta?.finishRank != null) base.finishRank = meta.finishRank;
  if (meta?.evaluationBudget != null) base.evaluationBudget = meta.evaluationBudget;
  return base;
}

function agentSnapshot(
  index: number,
  part: SolverProgress | undefined,
  meta?: {
    recipe?: SolverAgentSnapshot["recipe"];
    barLength?: number;
    finishRank?: number;
    evaluationBudget?: number;
  },
): SolverAgentSnapshot {
  if (!part) {
    return withAgentMeta(
      {
        index,
        phase: "seed",
        evaluations: 0,
        bestScore: 0,
        progressRatio: 0,
        finished: false,
      },
      meta,
    );
  }
  const ratio = part.progressRatio ?? 0;
  // Result path sets progressRatio: 1. Also treat idle as done.
  const finished = ratio >= 1 || part.phase === "idle";
  return withAgentMeta(
    {
      index,
      phase: finished ? "idle" : part.phase,
      evaluations: part.evaluations,
      bestScore: part.bestExploratoryScore ?? part.bestScore,
      progressRatio: ratio,
      finished,
    },
    meta,
  );
}

/** Live timing inputs for pool metrics (optional; unit tests omit). */
export type PoolMetricsLive = {
  /** Epoch ms when SolverAgentPool.run started. */
  startedAtMs: number;
  /** Wall ms (relative to start) when each agent posted result. */
  agentFinishedAtMs: readonly (number | undefined)[];
  /** Agent indexes in finish order. */
  finishOrder: readonly number[];
  hardwareCores: number;
  reservedCore: boolean;
  /** Override "now" for deterministic tests (defaults to Date.now()). */
  nowMs?: number;
  globalEvaluations?: number;
  coordStop?: boolean;
  stragglersCancelled?: number;
  /** Host global visited set size (Phase 2). */
  uniqueCandidates?: number;
};

/** NUL-joined bar identity (matches fingerprint.barKey). */
export function progressBarKey(bar: readonly string[] | undefined): string | undefined {
  if (!bar?.length) return undefined;
  return bar.join("\0");
}

/**
 * Collect bar keys from progress messages: explicit seenKeys plus preview bars.
 * Pure snapshot (no cross-call accumulation) - PoolCoordHost owns the host Set.
 */
export function collectProgressBarKeys(
  parts: readonly (SolverProgress | undefined)[],
): Set<string> {
  const keys = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    if (p.seenKeys?.length) {
      for (const k of p.seenKeys) {
        if (k) keys.add(k);
      }
    }
    for (const bar of [p.topBarPreview, p.activeBarPreview, p.scoringBarPreview]) {
      const k = progressBarKey(bar);
      if (k) keys.add(k);
    }
  }
  return keys;
}

/**
 * Resolve merged uniqueCandidates honesty.
 * Prefer host Set size (live.uniqueCandidates); else naive sum (flagged known-wrong).
 */
export function resolveMergedUnique(
  parts: readonly (SolverProgress | undefined)[],
  agentCount: number,
  hostUnique?: number,
): {
  uniqueCandidates: number;
  uniqueCandidatesSum: number;
  uniqueCandidatesSumKnownWrong: boolean;
  uniqueCandidatesEstimate: number;
} {
  let uniqueCandidatesSum = 0;
  for (let i = 0; i < agentCount; i++) {
    uniqueCandidatesSum += parts[i]?.uniqueCandidates ?? 0;
  }
  const estimate = collectProgressBarKeys(parts).size;
  const hasHost = typeof hostUnique === "number" && Number.isFinite(hostUnique) && hostUnique >= 0;
  if (hasHost) {
    return {
      uniqueCandidates: hostUnique,
      uniqueCandidatesSum,
      uniqueCandidatesSumKnownWrong: false,
      uniqueCandidatesEstimate: Math.max(estimate, hostUnique),
    };
  }
  const liveCount = parts.reduce((n, p) => n + (p != null ? 1 : 0), 0);
  const knownWrong = liveCount > 1 || agentCount > 1;
  return {
    uniqueCandidates: uniqueCandidatesSum,
    uniqueCandidatesSum,
    uniqueCandidatesSumKnownWrong: knownWrong,
    uniqueCandidatesEstimate: estimate,
  };
}

/**
 * Build pool metrics. uniqueCandidatesSum is always the naive sum.
 * uniqueCandidates is host set size when live.uniqueCandidates is set.
 */
export function buildPoolMetrics(
  parts: readonly (SolverProgress | undefined)[],
  agentCount: number,
  perAgentBudget: number,
  live?: PoolMetricsLive,
): SolverPoolMetrics {
  const resolved = resolveMergedUnique(parts, agentCount, live?.uniqueCandidates);
  const agentEvaluations: number[] = [];
  for (let i = 0; i < agentCount; i++) {
    agentEvaluations.push(parts[i]?.evaluations ?? 0);
  }

  const globalBudget = perAgentBudget * agentCount;
  const metrics: SolverPoolMetrics = {
    agentCount,
    perAgentBudget,
    globalBudget,
    globalBudgetSum: globalBudget,
    uniqueCandidates: resolved.uniqueCandidates,
    uniqueCandidatesSum: resolved.uniqueCandidatesSum,
    uniqueCandidatesSumKnownWrong: resolved.uniqueCandidatesSumKnownWrong,
    reservedCore: live?.reservedCore ?? RESERVES_UI_CORE,
    agentEvaluations,
  };
  if (resolved.uniqueCandidatesEstimate > 0) {
    metrics.uniqueCandidatesEstimate = resolved.uniqueCandidatesEstimate;
  }
  if (live?.hardwareCores != null) metrics.hardwareCores = live.hardwareCores;
  if (live?.finishOrder?.length) metrics.finishOrder = [...live.finishOrder];
  if (live?.globalEvaluations != null) metrics.globalEvaluations = live.globalEvaluations;
  if (live?.coordStop != null) metrics.coordStop = live.coordStop;
  if (live?.stragglersCancelled != null) metrics.stragglersCancelled = live.stragglersCancelled;

  if (live) {
    const finishedAts = live.agentFinishedAtMs.filter(
      (t): t is number => typeof t === "number" && Number.isFinite(t),
    );
    if (finishedAts.length > 0) {
      const first = Math.min(...finishedAts);
      const last = Math.max(...finishedAts);
      metrics.firstFinishedMs = first;
      metrics.lastFinishedMs = last;
      metrics.stragglerWaitMs = Math.max(0, last - first);
    }
  }

  return metrics;
}

/** Exported for unit tests - host progress merge across parallel agents. */
export function mergeProgress(
  parts: readonly (SolverProgress | undefined)[],
  agentCount: number,
  baseBudget: number,
  agentMeta?: readonly {
    recipe?: SolverAgentSnapshot["recipe"];
    barLength?: number;
    finishRank?: number;
    evaluationBudget?: number;
  }[],
  live?: PoolMetricsLive,
): SolverProgress {
  const agents = Array.from({ length: agentCount }, (_, i) =>
    agentSnapshot(i, parts[i], {
      ...agentMeta?.[i],
      evaluationBudget: agentMeta?.[i]?.evaluationBudget ?? baseBudget,
      finishRank: agentMeta?.[i]?.finishRank,
    }),
  );
  const live_parts = parts.filter((p): p is SolverProgress => p != null);
  if (live_parts.length === 0) {
    const poolMetrics = buildPoolMetrics(parts, agentCount, baseBudget, live);
    return {
      phase: "seed",
      evaluations: 0,
      uniqueCandidates: poolMetrics.uniqueCandidates,
      bestScore: 0,
      windowDpms: 0,
      topBarPreview: [],
      noImprovementCount: 0,
      evaluationBudget: baseBudget * agentCount,
      progressRatio: 0.02,
      agentCount,
      agents,
      poolMetrics,
    };
  }

  let best = live_parts[0]!;
  let evaluations = 0;
  let ratioSum = 0;
  let searchPhase: SolverProgress["phase"] = "seed";
  let anyStillSearching = false;
  let anyFinalize = false;
  let allDone = live_parts.length > 0;
  /** Furthest shortlist score - not the exploratory-score leader. */
  let finalizeLead: SolverProgress | undefined;
  let bestExploratory = Number.NEGATIVE_INFINITY;
  let bestFull = Number.NEGATIVE_INFINITY;
  let hasExploratory = false;
  let hasFull = false;
  let searchEvals = 0;
  let fullEvals = 0;
  let hasSearchEvals = false;
  let hasFullEvals = false;
  let fullMemoHits = 0;
  let hasFullMemo = false;
  /** Busiest unfinished agent’s active bar - keeps the strip cycling under merge. */
  let activeLead: SolverProgress | undefined;

  for (const p of live_parts) {
    evaluations += p.evaluations;
    ratioSum += p.progressRatio ?? 0;
    if (p.bestScore > best.bestScore) best = p;

    const finished = (p.progressRatio ?? 0) >= 1;
    if (!finished) allDone = false;
    const inFinalize = p.phase === "finalize" || finished;
    if (inFinalize) anyFinalize = true;
    // Still exploring/exploiting - do not promote the merged phase to finalize yet.
    if (!finished && p.phase !== "finalize") {
      anyStillSearching = true;
      if (phaseRank(p.phase) > phaseRank(searchPhase)) searchPhase = p.phase;
    }
    if (p.finalizeTotal != null && p.finalizeTotal > 0) {
      const step = p.finalizeStep ?? 0;
      const leadStep = finalizeLead?.finalizeStep ?? -1;
      if (!finalizeLead || step > leadStep) finalizeLead = p;
    }
    if (!finished && p.activeBarPreview?.length) {
      if (!activeLead || p.evaluations >= (activeLead.evaluations ?? 0)) {
        activeLead = p;
      }
    }

    const exp = p.bestExploratoryScore ?? p.bestScore;
    if (Number.isFinite(exp) && exp > bestExploratory) {
      bestExploratory = exp;
      hasExploratory = true;
    }
    if (p.bestFullScore != null && Number.isFinite(p.bestFullScore)) {
      hasFull = true;
      if (p.bestFullScore > bestFull) bestFull = p.bestFullScore;
    }
    if (p.searchEvaluations != null) {
      hasSearchEvals = true;
      searchEvals += p.searchEvaluations;
    }
    if (p.fullEvaluations != null) {
      hasFullEvals = true;
      fullEvals += p.fullEvaluations;
    }
    if (p.fullMemoHits != null) {
      hasFullMemo = true;
      fullMemoHits += p.fullMemoHits;
    }
  }

  // Finalize only when no live agent is still searching.
  let phase: SolverProgress["phase"] = searchPhase;
  if (!anyStillSearching && (anyFinalize || allDone)) phase = "finalize";

  // Missing agents count as 0; cap below finalize band while anyone still searches.
  const rawRatio = ratioSum / Math.max(1, agentCount);
  const progressRatio = anyStillSearching ? Math.min(0.82, rawRatio) : Math.min(0.995, rawRatio);

  const fin = !anyStillSearching ? finalizeLead : undefined;

  let evaluationMode = best.evaluationMode ?? "search";
  if (fin?.evaluationMode) evaluationMode = fin.evaluationMode;
  else if (phase === "finalize") evaluationMode = "finalize";

  let topBarPreview = best.topBarPreview;
  if (fin?.scoringBarPreview?.length) topBarPreview = fin.scoringBarPreview;
  else if (fin?.topBarPreview?.length) topBarPreview = fin.topBarPreview;

  let activeBarPreview: readonly string[] | undefined;
  if (activeLead?.activeBarPreview?.length) activeBarPreview = activeLead.activeBarPreview;
  else if (fin?.activeBarPreview?.length) activeBarPreview = fin.activeBarPreview;
  else if (best.activeBarPreview?.length) activeBarPreview = best.activeBarPreview;

  const poolMetrics = buildPoolMetrics(parts, agentCount, baseBudget, live);
  return {
    phase,
    evaluations: live?.globalEvaluations ?? evaluations,
    // Host global visited size when available; else naive sum fallback.
    uniqueCandidates: poolMetrics.uniqueCandidates,
    // bestScore stays exploratory-only across agents.
    bestScore: hasExploratory ? bestExploratory : best.bestScore,
    ...(hasExploratory ? { bestExploratoryScore: bestExploratory } : {}),
    ...(hasFull ? { bestFullScore: bestFull } : {}),
    ...(hasSearchEvals ? { searchEvaluations: searchEvals } : {}),
    ...(hasFullEvals ? { fullEvaluations: fullEvals } : {}),
    ...(hasFullMemo && fullMemoHits > 0 ? { fullMemoHits } : {}),
    evaluationMode,
    windowDpms: best.windowDpms,
    topBarPreview,
    ...(activeBarPreview ? { activeBarPreview } : {}),
    noImprovementCount: best.noImprovementCount,
    evaluationBudget: baseBudget * agentCount,
    progressRatio,
    agentCount,
    agents,
    poolMetrics,
    ...(fin && fin.finalizeTotal != null && fin.finalizeTotal > 0
      ? {
          finalizeStep: fin.finalizeStep,
          finalizeTotal: fin.finalizeTotal,
          ...(fin.scoringLabel ? { scoringLabel: fin.scoringLabel } : {}),
          ...(fin.scoringBarPreview?.length ? { scoringBarPreview: fin.scoringBarPreview } : {}),
        }
      : {}),
    proof: fin?.proof ?? best.proof,
  };
}

/**
 * Score-first merge - higher score always beats longer bar (see rankResults).
 * When hostRequest is provided, re-stamp solveIdentity from the host/session
 * request (seed + full bar window), not the agent-local patched identity.
 * When hostIncumbent is provided, recompute isUpgrade against that baseline
 * (workers pin bar length and cannot score an out-of-band user bar).
 */
export function mergeResults(
  results: readonly SolverResultDTO[],
  hostRequest?: SerializableSolverRequest,
  poolMetrics?: SolverPoolMetrics,
  hostIncumbent?: HostIncumbentBaseline | null,
): SolverResultDTO {
  if (results.length === 0) {
    throw new Error("revolution solver pool: no results");
  }
  const best = pickBestSolverResult(results);
  const seen = new Set<string>();
  const top: { bar: readonly string[]; score: number; fingerprint?: string }[] = [];
  const push = (bar: readonly string[], score: number, fingerprint?: string) => {
    if (!bar.length) return;
    const fp = fingerprint ?? bar.join("\0");
    if (seen.has(fp)) return;
    seen.add(fp);
    top.push({ bar: [...bar], score, fingerprint: fp });
  };
  push(best.bar, best.score, best.bar.join("\0"));
  for (const r of results) {
    push(r.bar, r.score, r.bar.join("\0"));
    for (const t of r.top ?? []) push(t.bar, t.score, t.fingerprint);
  }
  // Score desc, deterministic fingerprint for ties - never length-over-score.
  top.sort(compareTopEntry);

  let evaluations = 0;
  let uniqueSum = 0;
  for (const r of results) {
    evaluations += r.evaluations;
    uniqueSum += r.uniqueCandidates;
  }

  const uniqueCandidates =
    poolMetrics && !poolMetrics.uniqueCandidatesSumKnownWrong
      ? poolMetrics.uniqueCandidates
      : uniqueSum;

  const priorNotes = (best.proof?.notes ?? []).filter((n) => !n.startsWith("parallel agents "));
  const notes =
    results.length > 1
      ? [...priorNotes, `parallel agents ${results.length}; winner seed ${best.seed}`]
      : priorNotes;

  const merged: SolverResultDTO = {
    ...best,
    // Host session identity when available; else winner stamp (legacy/single-path).
    solveIdentity: hostRequest ? solveIdentityFromRequest(hostRequest) : best.solveIdentity,
    evaluations: poolMetrics?.globalEvaluations ?? evaluations,
    uniqueCandidates,
    top: top.slice(0, 5),
    proof: {
      ...best.proof,
      notes: notes.length > 0 ? notes : best.proof?.notes,
    },
    ...(poolMetrics ? { poolMetrics } : {}),
  };
  return applyHostIncumbentBaseline(merged, hostIncumbent);
}

type Slot = {
  worker: Worker;
  requestId: number;
};

/**
 * Long-lived pool of solver workers. One agent per worker, different seeds.
 */
export class SolverAgentPool {
  private slots: Slot[] = [];
  private seq = 0;
  private activeCancels: Array<() => void> = [];

  size(): number {
    return this.slots.length;
  }

  /** Grow or shrink the pool to exactly n workers (capped at MAX_POOL). */
  ensure(n: number): number {
    const want = Math.max(1, Math.min(MAX_POOL, Math.floor(n) || 1));
    const before = this.slots.length;
    while (this.slots.length < want) {
      const worker = createWorker();
      if (!worker) break;
      this.slots.push({ worker, requestId: 0 });
    }
    while (this.slots.length > want) {
      const slot = this.slots.pop();
      if (!slot) break;
      try {
        slot.worker.terminate();
      } catch {
        // ignore
      }
    }
    if (before !== this.slots.length) {
      noteSolverHost("pool-ensure", { before, after: this.slots.length, want });
    }
    return this.slots.length;
  }

  cancel(): void {
    const hooks = this.activeCancels;
    this.activeCancels = [];
    if (hooks.length > 0) {
      noteSolverHost("pool-cancel", { hooks: hooks.length, workers: this.slots.length });
    }
    for (const cancel of hooks) {
      try {
        cancel();
      } catch {
        // ignore
      }
    }
  }

  dispose(): void {
    const workers = this.slots.length;
    this.cancel();
    for (const slot of this.slots) {
      try {
        slot.worker.terminate();
      } catch {
        // ignore
      }
    }
    this.slots = [];
    if (workers > 0) {
      noteSolverHost("pool-dispose", { terminated: workers });
    }
  }

  private replaceDeadWorker(slot: Slot, requestId: number): void {
    if (slot.requestId !== requestId) return;
    try {
      post(slot.worker, { type: "cancel", requestId });
    } catch {
      // ignore
    }
    try {
      slot.worker.terminate();
    } catch {
      // ignore
    }
    const idx = this.slots.indexOf(slot);
    if (idx < 0) return;
    const next = createWorker();
    if (next) {
      this.slots[idx] = { worker: next, requestId: 0 };
    } else {
      this.slots.splice(idx, 1);
    }
  }

  /**
   * Run `count` agents (capped by live workers). Each gets a distinct seed.
   * Returns the merged best result, or rejects if every agent fails.
   */
  async run(
    request: SerializableSolverRequest,
    onProgress?: SolveProgressHandler,
    options?: {
      isCancelled?: () => boolean;
      signal?: AbortSignal;
      agents?: number;
      profile?: boolean;
      onProfile?: (snapshot: SolverProfileSnapshot) => void;
    },
  ): Promise<SolverResultDTO> {
    this.cancel();

    const hardwareCores = detectHardwareCores();
    const minimumRequiredBarSize = minimumConstrainedBarSizeForRequest(request);
    const plan = planWorkers({
      minBarSize: request.minBarSize,
      maxBarSize: request.maxBarSize,
      minimumRequiredBarSize,
      tier: request.tier,
      baseSeed: request.seed ?? 1,
      agents: options?.agents,
      maxAgents: MAX_POOL,
      hardwareCores,
    });
    const want = plan.agentCount;
    const n = this.ensure(want);
    if (n === 0) {
      throw new SolverExecutionError(
        "infrastructure",
        "revolution solver pool: no workers available",
      );
    }
    const agentCount = Math.min(want, n);
    const assignments: readonly WorkerAssignment[] = plan.assignments.slice(0, agentCount);

    const cancelled = () => options?.isCancelled?.() === true || options?.signal?.aborted === true;
    if (cancelled()) {
      throw new DOMException("revolution solver cancelled", "AbortError");
    }

    // One host full-horizon incumbent score under original min/max (not length pins).
    let hostIncumbent: HostIncumbentBaseline | null = null;
    try {
      hostIncumbent = evaluateHostIncumbentBaseline(request);
    } catch {
      hostIncumbent = null;
    }

    // Preserve Phase-0 total capacity: globalBudget = perAgent * agentCount.
    const perAgentBudget = TIER_BUDGETS[request.tier] ?? TIER_BUDGETS.thorough;
    const baseBudget = perAgentBudget;
    const coordHost = new PoolCoordHost(agentCount, perAgentBudget);
    const progressParts: (SolverProgress | undefined)[] = Array.from({
      length: agentCount,
    });
    const startedAtMs = Date.now();
    const agentFinishedAtMs: (number | undefined)[] = Array.from({ length: agentCount });
    const agentProfiles: (SolverProfileSnapshot | undefined)[] = Array.from({
      length: agentCount,
    });
    const finishOrder: number[] = [];
    const tierMax = TIER_MAX_AGENTS[request.tier] ?? TIER_MAX_AGENTS.thorough;
    const reservedCore = shouldReserveUiCore(tierMax, hardwareCores);

    const liveMetrics = (): PoolMetricsLive => ({
      startedAtMs,
      agentFinishedAtMs,
      finishOrder,
      hardwareCores,
      reservedCore,
      globalEvaluations: coordHost.globalEvaluations,
      coordStop: coordHost.shouldStop,
      stragglersCancelled: coordHost.stragglersCancelled,
      // Only claim honest unique after workers streamed seenKeys (not preview-only).
      ...(coordHost.hasAuthoritativeUnique ? { uniqueCandidates: coordHost.uniqueCandidates } : {}),
    });

    const agentMetaFor = () =>
      assignments.map((a, i) => {
        const rankIdx = finishOrder.indexOf(i);
        return {
          recipe: a.recipe,
          barLength: a.targetLength,
          evaluationBudget: baseBudget,
          ...(rankIdx >= 0 ? { finishRank: rankIdx } : {}),
        };
      });

    const emit = () => {
      if (cancelled()) return;
      onProgress?.(
        mergeProgress(progressParts, agentCount, baseBudget, agentMetaFor(), liveMetrics()),
      );
    };

    const runCancels: Array<() => void> = [];
    const registerCancel = (fn: () => void) => {
      runCancels.push(fn);
      this.activeCancels.push(fn);
    };
    const unregisterCancel = (fn: () => void) => {
      const drop = (list: Array<() => void>) => {
        const i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      };
      drop(runCancels);
      drop(this.activeCancels);
    };

    const markFinished = (index: number) => {
      if (agentFinishedAtMs[index] != null) return;
      agentFinishedAtMs[index] = Date.now() - startedAtMs;
      finishOrder.push(index);
    };

    const postCoord = (index: number) => {
      const slot = this.slots[index];
      if (!slot || slot.requestId === 0) return;
      const batch = coordHost.batchFor(index);
      if (!coordHost.batchIsUseful(batch) && !batch.stop) return;
      try {
        post(slot.worker, { type: "coord", requestId: slot.requestId, batch });
      } catch {
        // ignore
      }
    };

    const broadcastCoord = (except?: number) => {
      for (let i = 0; i < agentCount; i++) {
        if (except != null && i === except) continue;
        if (agentFinishedAtMs[i] != null) continue;
        postCoord(i);
      }
    };

    const hardCancelByAgent: Array<(() => void) | undefined> = Array.from(
      { length: agentCount },
      () => undefined,
    );

    /**
     * Hard-cancel search-phase stragglers when stop is set and we already have
     * at least one finished result. Never cancel agents already in finalize
     * (shortlist scoring) or idle/finished.
     */
    const considerStragglerCancel = (okCount: number) => {
      if (!coordHost.shouldStop) return;
      broadcastCoord();
      if (okCount < 1) return;
      for (let i = 0; i < agentCount; i++) {
        if (agentFinishedAtMs[i] != null) continue;
        const p = progressParts[i];
        const phase = p?.phase;
        const ratio = p?.progressRatio ?? 0;
        // Leave finalize shortlist scoring alone.
        if (phase === "finalize" || phase === "idle" || ratio >= 0.82) continue;
        const fn = hardCancelByAgent[i];
        if (!fn) continue;
        try {
          fn();
        } catch {
          // ignore
        }
      }
    };

    /** True when every unfinished agent has left pure search (finalize/idle). */
    const allLiveFinishedSearch = (): boolean => {
      for (let i = 0; i < agentCount; i++) {
        if (agentFinishedAtMs[i] != null) continue;
        const p = progressParts[i];
        if (!p) return false;
        const phase = p.phase;
        const ratio = p.progressRatio ?? 0;
        if (phase === "finalize" || phase === "idle" || ratio >= 0.82) continue;
        return false;
      }
      return true;
    };

    const ingestProgress = (index: number, progress: SolverProgress) => {
      progressParts[index] = progress;
      coordHost.noteAgentEvaluations(index, progress.evaluations);
      coordHost.noteKeys(progress.seenKeys);
      // Fallback: fold preview bars so unique tracking still moves without keys.
      coordHost.noteBar(progress.topBarPreview);
      coordHost.noteBar(progress.activeBarPreview);
      coordHost.noteBar(progress.scoringBarPreview);
      const exp = progress.bestExploratoryScore ?? progress.bestScore;
      coordHost.noteIncumbent(exp, progress.topBarPreview, progress.bestFullScore);
      if (coordHost.budgetExhausted) coordHost.requestStop();
      // Early stop when every live agent left search and shortlist has a winner path.
      if (finishOrder.length >= 1 && allLiveFinishedSearch()) {
        coordHost.requestStop();
      }
      broadcastCoord(index);
    };

    const runOne = (index: number): Promise<SolverResultDTO> => {
      const slot = this.slots[index]!;
      const requestId = ++this.seq;
      slot.requestId = requestId;

      const assignment = assignments[index]!;
      const patch = {
        seed: assignment.seed,
        minBarSize: assignment.minBarSize,
        maxBarSize: assignment.maxBarSize,
        agentRecipe: assignment.recipe,
      } as const;
      let payload: SerializableSolverRequest;
      try {
        payload = structuredClone({ ...request, ...patch });
      } catch {
        payload = { ...request, ...patch };
      }

      return new Promise<SolverResultDTO>((resolve, reject) => {
        const agentStartedAtMs = Date.now();
        let settled = false;
        let acknowledged = false;
        let bootTimer: ReturnType<typeof setTimeout> | undefined;
        let hardCancelled = false;

        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          if (bootTimer != null) clearTimeout(bootTimer);
          slot.worker.removeEventListener("message", onMessage);
          slot.worker.removeEventListener("error", onError);
          slot.worker.removeEventListener("messageerror", onMessageError);
          options?.signal?.removeEventListener("abort", onAbort);
          unregisterCancel(onAbort);
          hardCancelByAgent[index] = undefined;
          fn();
        };

        const onAbort = () => {
          try {
            post(slot.worker, { type: "cancel", requestId });
          } catch {
            // ignore
          }
          settle(() => reject(new DOMException("revolution solver cancelled", "AbortError")));
        };

        const onHardCancel = () => {
          if (settled || hardCancelled) return;
          hardCancelled = true;
          coordHost.stragglersCancelled += 1;
          try {
            post(slot.worker, { type: "cancel", requestId });
          } catch {
            // ignore
          }
          settle(() => reject(new DOMException("revolution solver cancelled", "AbortError")));
        };
        hardCancelByAgent[index] = onHardCancel;

        const onError = (event: ErrorEvent) => {
          this.replaceDeadWorker(slot, requestId);
          settle(() =>
            reject(
              new SolverExecutionError(
                "infrastructure",
                event.message || `solver agent ${index} failed`,
              ),
            ),
          );
        };

        const onMessageError = () => {
          this.replaceDeadWorker(slot, requestId);
          settle(() =>
            reject(
              new SolverExecutionError("infrastructure", `solver agent ${index} messageerror`),
            ),
          );
        };

        const onMessage = (event: MessageEvent<unknown>) => {
          // Malformed protocol must not kill a healthy agent.
          if (!isWorkerToHostMessage(event.data)) return;
          const msg = event.data as WorkerToHostMessage;
          if (msg.requestId !== requestId) return;
          if (bootTimer != null) {
            clearTimeout(bootTimer);
            bootTimer = undefined;
          }
          switch (msg.type) {
            case "started":
              acknowledged = true;
              postCoord(index);
              break;
            case "progress":
              try {
                ingestProgress(index, msg.progress);
                emit();
                if (coordHost.shouldStop) {
                  considerStragglerCancel(finishOrder.length);
                  if (coordHost.budgetExhausted) postCoord(index);
                }
              } catch {
                // Progress callback exceptions must not kill the agent.
              }
              break;
            case "coord_report":
              try {
                const r = msg.report;
                coordHost.noteAgentEvaluations(index, r.evaluations);
                coordHost.noteKeys(r.seenKeys);
                coordHost.noteIncumbent(r.bestScore, r.topBarPreview, r.bestFullScore);
                if (coordHost.budgetExhausted) coordHost.requestStop();
                if (finishOrder.length >= 1 && allLiveFinishedSearch()) {
                  coordHost.requestStop();
                }
                broadcastCoord(index);
                if (coordHost.shouldStop) considerStragglerCancel(finishOrder.length);
              } catch {
                // ignore
              }
              break;
            case "result": {
              if (msg.profile) {
                agentProfiles[index] = {
                  ...msg.profile,
                  workerWaitMs: Math.max(0, Date.now() - agentStartedAtMs - msg.profile.wallMs),
                };
              }
              const prev = progressParts[index];
              const exp =
                msg.result.bestExploratoryScore ??
                prev?.bestExploratoryScore ??
                prev?.bestScore ??
                0;
              const full = msg.result.bestFullScore ?? msg.result.score;
              markFinished(index);
              coordHost.noteAgentEvaluations(index, msg.result.evaluations);
              if (msg.result.bar?.length) {
                coordHost.noteBar(msg.result.bar);
                for (const t of msg.result.top ?? []) {
                  if (t.fingerprint) coordHost.noteKeys([t.fingerprint]);
                  else if (t.bar?.length) coordHost.noteBar(t.bar);
                }
              }
              coordHost.noteIncumbent(
                Number.isFinite(exp) ? exp : 0,
                msg.result.bar,
                Number.isFinite(full) ? full : undefined,
              );
              if (coordHost.budgetExhausted) coordHost.requestStop();
              progressParts[index] = {
                // idle + ratio 1 marks agent done.
                phase: "idle",
                evaluations: msg.result.evaluations,
                uniqueCandidates: msg.result.uniqueCandidates,
                // bestScore stays exploratory, not full robust.
                bestScore: Number.isFinite(exp) ? exp : 0,
                ...(Number.isFinite(exp) ? { bestExploratoryScore: exp } : {}),
                ...(Number.isFinite(full) ? { bestFullScore: full } : {}),
                windowDpms: 0,
                topBarPreview: [...msg.result.bar],
                noImprovementCount: 0,
                evaluationBudget: baseBudget,
                progressRatio: 1,
                evaluationMode: "finalize",
              };
              try {
                emit();
                broadcastCoord(index);
                considerStragglerCancel(finishOrder.length);
              } catch {
                // ignore
              }
              settle(() => resolve(msg.result));
              break;
            }
            case "error":
              settle(() => reject(solverFailureFromWorkerMessage(msg.error, msg.failureKind)));
              break;
            case "cancelled":
              settle(() => reject(new DOMException("revolution solver cancelled", "AbortError")));
              break;
          }
        };

        // ACK watchdog only - slow import after started is not a pool failure.
        const ackMs = getFirstAckMs();
        bootTimer = setTimeout(() => {
          if (settled || acknowledged) return;
          this.replaceDeadWorker(slot, requestId);
          settle(() =>
            reject(
              new SolverExecutionError(
                "infrastructure",
                `solver agent ${index} did not acknowledge start within ${ackMs}ms`,
              ),
            ),
          );
        }, ackMs);

        slot.worker.addEventListener("message", onMessage);
        slot.worker.addEventListener("error", onError);
        slot.worker.addEventListener("messageerror", onMessageError);
        options?.signal?.addEventListener("abort", onAbort, { once: true });
        registerCancel(onAbort);

        try {
          post(slot.worker, {
            type: "start",
            requestId,
            payload,
            profile: options?.profile === true,
            coord: {
              agentIndex: index,
              agentCount,
              perAgentBudget,
              globalBudget: coordHost.globalBudget,
            },
          });
        } catch (err) {
          this.replaceDeadWorker(slot, requestId);
          settle(() =>
            reject(
              new SolverExecutionError(
                "infrastructure",
                err instanceof Error ? err.message : String(err),
                { cause: err },
              ),
            ),
          );
        }

        if (cancelled()) onAbort();
      });
    };

    try {
      // Emit seed progress so UI/benchmarks see poolMetrics before first worker tick.
      emit();

      const settled = await Promise.allSettled(
        Array.from({ length: agentCount }, (_, i) => runOne(i)),
      );
      if (cancelled()) {
        throw new DOMException("revolution solver cancelled", "AbortError");
      }

      const ok: SolverResultDTO[] = [];
      const errors: unknown[] = [];
      let sawAbort = false;
      for (const s of settled) {
        if (s.status === "fulfilled") {
          ok.push(s.value);
          continue;
        }
        const reason = s.reason;
        if (isAbortError(reason)) {
          sawAbort = true;
          if (cancelled()) throw reason;
          errors.push(reason);
          continue;
        }
        errors.push(reason);
      }

      if (ok.length === 0) {
        if (sawAbort && cancelled()) {
          throw new DOMException("revolution solver cancelled", "AbortError");
        }
        const failure = errors.find(isInfrastructureFailure) ?? errors[0];
        if (failure instanceof Error) throw failure;
        throw new Error(String(failure ?? "revolution solver pool: all agents failed"));
      }

      const poolMetrics = buildPoolMetrics(progressParts, agentCount, baseBudget, liveMetrics());
      if (options?.onProfile) {
        const profiles = agentProfiles.filter(
          (profile): profile is SolverProfileSnapshot => profile !== undefined,
        );
        if (profiles.length > 0) options.onProfile(mergeProfiles(profiles));
      }
      // Re-stamp host identity + recompute upgrade vs host incumbent baseline.
      return mergeResults(ok, request, poolMetrics, hostIncumbent);
    } finally {
      for (const fn of runCancels) unregisterCancel(fn);
    }
  }
}

let sharedPool: SolverAgentPool | null = null;

/** Live agent workers in the shared pool (0 when disposed / never created). */
export function liveSolverPoolWorkerCount(): number {
  return sharedPool?.size() ?? 0;
}

export function getSolverAgentPool(): SolverAgentPool {
  if (!sharedPool) sharedPool = new SolverAgentPool();
  return sharedPool;
}

export function cancelSolverAgentPool(): void {
  sharedPool?.cancel();
}

/** Terminate all agent workers and drop the shared pool (hard failure / fallback). */
export function disposeSolverAgentPool(): void {
  if (!sharedPool) return;
  sharedPool.dispose();
  sharedPool = null;
}

export function resetSolverAgentPoolForTests(): void {
  disposeSolverAgentPool();
}
