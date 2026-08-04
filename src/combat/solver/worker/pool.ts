/**
 * Parallel Revolution solver agents - one Web Worker each, different seeds.
 * Host merges progress (best / total evals) and picks the winning DTO.
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
import { createSolverWorker, getFirstAckMs } from "./workerCreate";
import { TIER_BUDGETS } from "../solve";
import {
  detectHardwareCores,
  planWorkers,
  RESERVES_UI_CORE,
  SAFE_GLOBAL_AGENT_CEILING,
  type WorkerAssignment,
} from "../workerPlan";
import { compareTopEntry, pickBestSolverResult } from "../rankResults";
import { solveIdentityFromRequest } from "../identity";

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

/** Live timing inputs for Phase-0 pool metrics (optional; unit tests omit). */
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
};

/**
 * Build measure-only pool metrics from independent per-agent budgets + live timing.
 * uniqueCandidatesSum is the naive sum (known-wrong double-count).
 */
export function buildPoolMetrics(
  parts: readonly (SolverProgress | undefined)[],
  agentCount: number,
  perAgentBudget: number,
  live?: PoolMetricsLive,
): SolverPoolMetrics {
  let uniqueCandidatesSum = 0;
  const agentEvaluations: number[] = [];
  for (let i = 0; i < agentCount; i++) {
    const p = parts[i];
    uniqueCandidatesSum += p?.uniqueCandidates ?? 0;
    agentEvaluations.push(p?.evaluations ?? 0);
  }

  const metrics: SolverPoolMetrics = {
    agentCount,
    perAgentBudget,
    globalBudgetSum: perAgentBudget * agentCount,
    uniqueCandidatesSum,
    uniqueCandidatesSumKnownWrong: true,
    reservedCore: live?.reservedCore ?? RESERVES_UI_CORE,
    agentEvaluations,
  };
  if (live?.hardwareCores != null) metrics.hardwareCores = live.hardwareCores;
  if (live?.finishOrder?.length) metrics.finishOrder = [...live.finishOrder];

  if (live) {
    const finishedAts = live.agentFinishedAtMs
      .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
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
    return {
      phase: "seed",
      evaluations: 0,
      uniqueCandidates: 0,
      bestScore: 0,
      windowDpms: 0,
      topBarPreview: [],
      noImprovementCount: 0,
      // Global sum of independent budgets (not a shared cap).
      evaluationBudget: baseBudget * agentCount,
      progressRatio: 0.02,
      agentCount,
      agents,
      poolMetrics: buildPoolMetrics(parts, agentCount, baseBudget, live),
    };
  }

  let best = live_parts[0]!;
  let evaluations = 0;
  let unique = 0;
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
    unique += p.uniqueCandidates;
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

  return {
    phase,
    evaluations,
    // Known-wrong sum of per-agent uniqueCandidates (see poolMetrics).
    uniqueCandidates: unique,
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
    // Global sum of independent per-agent budgets (not a shared cap yet).
    evaluationBudget: baseBudget * agentCount,
    progressRatio,
    agentCount,
    agents,
    poolMetrics: buildPoolMetrics(parts, agentCount, baseBudget, live),
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
 */
export function mergeResults(
  results: readonly SolverResultDTO[],
  hostRequest?: SerializableSolverRequest,
  poolMetrics?: SolverPoolMetrics,
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
  let unique = 0;
  for (const r of results) {
    evaluations += r.evaluations;
    unique += r.uniqueCandidates;
  }

  const priorNotes = (best.proof?.notes ?? []).filter((n) => !n.startsWith("parallel agents "));
  const notes =
    results.length > 1
      ? [...priorNotes, `parallel agents ${results.length}; winner seed ${best.seed}`]
      : priorNotes;

  return {
    ...best,
    // Host session identity when available; else winner stamp (legacy/single-path).
    solveIdentity: hostRequest
      ? solveIdentityFromRequest(hostRequest)
      : best.solveIdentity,
    evaluations,
    // Known-wrong sum across agents (see poolMetrics.uniqueCandidatesSumKnownWrong).
    uniqueCandidates: unique,
    top: top.slice(0, 5),
    proof: {
      ...best.proof,
      notes: notes.length > 0 ? notes : best.proof?.notes,
    },
    ...(poolMetrics ? { poolMetrics } : {}),
  };
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
    return this.slots.length;
  }

  cancel(): void {
    const hooks = this.activeCancels;
    this.activeCancels = [];
    for (const cancel of hooks) {
      try {
        cancel();
      } catch {
        // ignore
      }
    }
  }

  dispose(): void {
    this.cancel();
    for (const slot of this.slots) {
      try {
        slot.worker.terminate();
      } catch {
        // ignore
      }
    }
    this.slots = [];
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
    options?: { isCancelled?: () => boolean; signal?: AbortSignal; agents?: number },
  ): Promise<SolverResultDTO> {
    this.cancel();

    const hardwareCores = detectHardwareCores();
    const plan = planWorkers({
      minBarSize: request.minBarSize,
      maxBarSize: request.maxBarSize,
      tier: request.tier,
      baseSeed: request.seed ?? 1,
      agents: options?.agents,
      maxAgents: MAX_POOL,
      hardwareCores,
    });
    const want = plan.agentCount;
    const n = this.ensure(want);
    if (n === 0) {
      throw new Error("revolution solver pool: no workers available");
    }
    const agentCount = Math.min(want, n);
    const assignments: readonly WorkerAssignment[] = plan.assignments.slice(0, agentCount);

    const cancelled = () => options?.isCancelled?.() === true || options?.signal?.aborted === true;
    if (cancelled()) {
      throw new DOMException("revolution solver cancelled", "AbortError");
    }

    // Independent per-agent budget (Phase 0): each agent still gets the full tier budget.
    const baseBudget = TIER_BUDGETS[request.tier] ?? TIER_BUDGETS.thorough;
    const progressParts: (SolverProgress | undefined)[] = Array.from({
      length: agentCount,
    });
    const startedAtMs = Date.now();
    const agentFinishedAtMs: (number | undefined)[] = Array.from({ length: agentCount });
    const finishOrder: number[] = [];

    const liveMetrics = (): PoolMetricsLive => ({
      startedAtMs,
      agentFinishedAtMs,
      finishOrder,
      hardwareCores,
      reservedCore: RESERVES_UI_CORE,
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
        let settled = false;
        let acknowledged = false;
        let bootTimer: ReturnType<typeof setTimeout> | undefined;

        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          if (bootTimer != null) clearTimeout(bootTimer);
          slot.worker.removeEventListener("message", onMessage);
          slot.worker.removeEventListener("error", onError);
          slot.worker.removeEventListener("messageerror", onMessageError);
          options?.signal?.removeEventListener("abort", onAbort);
          unregisterCancel(onAbort);
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

        const onError = (event: ErrorEvent) => {
          this.replaceDeadWorker(slot, requestId);
          settle(() => reject(new Error(event.message || `solver agent ${index} failed`)));
        };

        const onMessageError = () => {
          this.replaceDeadWorker(slot, requestId);
          settle(() => reject(new Error(`solver agent ${index} messageerror`)));
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
              break;
            case "progress":
              try {
                progressParts[index] = msg.progress;
                emit();
              } catch {
                // Progress callback exceptions must not kill the agent.
              }
              break;
            case "result": {
              const prev = progressParts[index];
              const exp =
                msg.result.bestExploratoryScore ??
                prev?.bestExploratoryScore ??
                prev?.bestScore ??
                0;
              const full = msg.result.bestFullScore ?? msg.result.score;
              markFinished(index);
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
              } catch {
                // ignore
              }
              settle(() => resolve(msg.result));
              break;
            }
            case "error":
              settle(() => reject(new Error(msg.error)));
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
            reject(new Error(`solver agent ${index} did not acknowledge start within ${ackMs}ms`)),
          );
        }, ackMs);

        slot.worker.addEventListener("message", onMessage);
        slot.worker.addEventListener("error", onError);
        slot.worker.addEventListener("messageerror", onMessageError);
        options?.signal?.addEventListener("abort", onAbort, { once: true });
        registerCancel(onAbort);

        try {
          post(slot.worker, { type: "start", requestId, payload });
        } catch (err) {
          this.replaceDeadWorker(slot, requestId);
          settle(() => reject(err instanceof Error ? err : new Error(String(err))));
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
      const errors: string[] = [];
      let sawAbort = false;
      for (const s of settled) {
        if (s.status === "fulfilled") {
          ok.push(s.value);
          continue;
        }
        const reason = s.reason;
        const message = reason instanceof Error ? reason.message : String(reason);
        if (isAbortError(reason)) {
          sawAbort = true;
          if (cancelled()) throw reason;
          errors.push(message);
          continue;
        }
        errors.push(message);
      }

      if (ok.length === 0) {
        if (sawAbort && cancelled()) {
          throw new DOMException("revolution solver cancelled", "AbortError");
        }
        throw new Error(errors[0] ?? "revolution solver pool: all agents failed");
      }

      const poolMetrics = buildPoolMetrics(
        progressParts,
        agentCount,
        baseBudget,
        liveMetrics(),
      );
      // Re-stamp host/session identity (agents use patched seed + bar bands).
      return mergeResults(ok, request, poolMetrics);
    } finally {
      for (const fn of runCancels) unregisterCancel(fn);
    }
  }
}

let sharedPool: SolverAgentPool | null = null;

export function getSolverAgentPool(): SolverAgentPool {
  if (!sharedPool) sharedPool = new SolverAgentPool();
  return sharedPool;
}

export function cancelSolverAgentPool(): void {
  sharedPool?.cancel();
}

/** Terminate all agent workers and drop the shared pool (hard failure / fallback). */
export function disposeSolverAgentPool(): void {
  sharedPool?.dispose();
  sharedPool = null;
}

export function resetSolverAgentPoolForTests(): void {
  disposeSolverAgentPool();
}
