/**
 * Parallel Revolution solver agents — one Web Worker each, different seeds.
 * Host merges progress (best / total evals) and picks the winning DTO.
 */

import type { SerializableSolverRequest, SolverResultDTO } from "./serializable";
import {
  isWorkerToHostMessage,
  type HostToWorkerMessage,
  type SolverProgress,
  type WorkerToHostMessage,
} from "./protocol";
import type { SolveProgressHandler } from "./solveTypes";
import { createSolverWorker, getFirstAckMs } from "./workerCreate";

const MAX_POOL = 4;

export function solverPoolSize(): number {
  if (typeof navigator === "undefined") return 1;
  const hc = navigator.hardwareConcurrency ?? 2;
  // Leave a couple of cores for UI / compositor; at least 1, at most 4.
  return Math.max(1, Math.min(MAX_POOL, Math.max(1, hc - 1)));
}

/** Match host.ts worker construction (and test factory). */
function createWorker(): Worker | null {
  return createSolverWorker();
}

function post(worker: Worker, message: HostToWorkerMessage): void {
  worker.postMessage(message);
}

/** Align with host — DOMException or Error named AbortError. */
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

function mergeProgress(
  parts: readonly (SolverProgress | undefined)[],
  agentCount: number,
  baseBudget: number,
): SolverProgress {
  const live = parts.filter((p): p is SolverProgress => p != null);
  if (live.length === 0) {
    return {
      phase: "seed",
      evaluations: 0,
      uniqueCandidates: 0,
      bestScore: 0,
      windowDpms: 0,
      topBarPreview: [],
      noImprovementCount: 0,
      evaluationBudget: baseBudget * agentCount,
      progressRatio: 0.02,
    };
  }

  let best = live[0]!;
  let evaluations = 0;
  let unique = 0;
  let ratioSum = 0;
  let phase = best.phase;
  for (const p of live) {
    evaluations += p.evaluations;
    unique += p.uniqueCandidates;
    ratioSum += p.progressRatio ?? 0;
    if (p.bestScore > best.bestScore) best = p;
    if (phaseRank(p.phase) > phaseRank(phase)) phase = p.phase;
  }

  // Missing agents count as 0 so the bar does not jump to ~done on first report.
  return {
    phase,
    evaluations,
    uniqueCandidates: unique,
    bestScore: best.bestScore,
    windowDpms: best.windowDpms,
    topBarPreview: best.topBarPreview,
    noImprovementCount: best.noImprovementCount,
    evaluationBudget: baseBudget * agentCount,
    progressRatio: Math.min(0.995, ratioSum / Math.max(1, agentCount)),
    finalizeStep: best.finalizeStep,
    finalizeTotal: best.finalizeTotal,
    proof: best.proof,
  };
}

function mergeResults(results: readonly SolverResultDTO[]): SolverResultDTO {
  if (results.length === 0) {
    throw new Error("revolution solver pool: no results");
  }
  let best = results[0]!;
  for (const r of results) {
    if (r.score > best.score) best = r;
  }
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
  top.sort((a, b) => b.score - a.score);
  const evaluations = results.reduce((s, r) => s + r.evaluations, 0);
  const unique = results.reduce((s, r) => s + r.uniqueCandidates, 0);

  const priorNotes = (best.proof?.notes ?? []).filter((n) => !n.startsWith("parallel agents "));
  const parallelNote =
    results.length > 1
      ? `parallel agents ${results.length}; winner seed ${best.seed}`
      : undefined;
  const notes = parallelNote ? [...priorNotes, parallelNote] : priorNotes;

  return {
    ...best,
    evaluations,
    uniqueCandidates: unique,
    top: top.slice(0, 5),
    proof: {
      ...best.proof,
      notes: notes.length > 0 ? notes : best.proof?.notes,
    },
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

  ensure(n: number): number {
    const want = Math.max(1, Math.min(MAX_POOL, n));
    while (this.slots.length < want) {
      const worker = createWorker();
      if (!worker) break;
      this.slots.push({ worker, requestId: 0 });
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
    // Supersede any previous pool run before starting another.
    this.cancel();

    const want = options?.agents ?? solverPoolSize();
    const n = this.ensure(want);
    if (n === 0) {
      throw new Error("revolution solver pool: no workers available");
    }

    const cancelled = () =>
      options?.isCancelled?.() === true || options?.signal?.aborted === true;
    if (cancelled()) {
      throw new DOMException("revolution solver cancelled", "AbortError");
    }

    const baseBudget =
      request.tier === "unhinged" ? 8_000 : request.tier === "extreme" ? 1_800 : 220;
    const progressParts: (SolverProgress | undefined)[] = Array.from({ length: n });
    const emit = () => {
      if (cancelled()) return;
      onProgress?.(mergeProgress(progressParts, n, baseBudget));
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

    const runOne = (index: number): Promise<SolverResultDTO> => {
      const slot = this.slots[index]!;
      const requestId = ++this.seq;
      slot.requestId = requestId;

      let payload: SerializableSolverRequest;
      try {
        payload = structuredClone({
          ...request,
          seed: (request.seed ?? 1) + index * 9973,
        });
      } catch {
        payload = {
          ...request,
          seed: (request.seed ?? 1) + index * 9973,
        };
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
          settle(() =>
            reject(new DOMException("revolution solver cancelled", "AbortError")),
          );
        };

        const onError = (event: ErrorEvent) => {
          this.replaceDeadWorker(slot, requestId);
          settle(() =>
            reject(new Error(event.message || `solver agent ${index} failed`)),
          );
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
            case "result":
              progressParts[index] = {
                phase: "finalize",
                evaluations: msg.result.evaluations,
                uniqueCandidates: msg.result.uniqueCandidates,
                bestScore: msg.result.score,
                windowDpms: msg.result.score,
                topBarPreview: [...msg.result.bar],
                noImprovementCount: 0,
                evaluationBudget: baseBudget,
                progressRatio: 1,
              };
              try {
                emit();
              } catch {
                // ignore
              }
              settle(() => resolve(msg.result));
              break;
            case "error":
              settle(() => reject(new Error(msg.error)));
              break;
            case "cancelled":
              settle(() =>
                reject(new DOMException("revolution solver cancelled", "AbortError")),
              );
              break;
          }
        };

        // ACK watchdog only — slow import after started is not a pool failure.
        const ackMs = getFirstAckMs();
        bootTimer = setTimeout(() => {
          if (settled || acknowledged) return;
          this.replaceDeadWorker(slot, requestId);
          settle(() =>
            reject(
              new Error(
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
          post(slot.worker, { type: "start", requestId, payload });
        } catch (err) {
          this.replaceDeadWorker(slot, requestId);
          settle(() =>
            reject(err instanceof Error ? err : new Error(String(err))),
          );
        }

        if (cancelled()) onAbort();
      });
    };

    try {
      const settled = await Promise.allSettled(
        Array.from({ length: n }, (_, i) => runOne(i)),
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
        if (isAbortError(reason)) {
          sawAbort = true;
          if (cancelled()) throw reason;
          errors.push(reason instanceof Error ? reason.message : String(reason));
          continue;
        }
        errors.push(reason instanceof Error ? reason.message : String(reason));
      }

      if (ok.length === 0) {
        if (sawAbort && cancelled()) {
          throw new DOMException("revolution solver cancelled", "AbortError");
        }
        throw new Error(errors[0] ?? "revolution solver pool: all agents failed");
      }
      return mergeResults(ok);
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
